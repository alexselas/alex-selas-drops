import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import crypto from 'crypto';
const U_TOKEN_MAX_AGE=30*24*60*60*1000;function verifyUserToken(h:string|undefined):{valid:boolean;userId?:string}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('user.'))return{valid:false};const p=t.split('.');if(p.length!==4)return{valid:false};const[,uid,ts,hm]=p;if(!uid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>U_TOKEN_MAX_AGE||a<0)return{valid:false};const s=process.env.ADMIN_SECRET||'';const py=`user.${uid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true,userId:uid};}catch{return{valid:false};}}

const redis = new Redis({ url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '' });
const CREDIT_COSTS:Record<string,number>={extended:1,mashups:2,livemashups:2,hypeintros:2,transiciones:2,remixes:3,sesiones:5,originales:0};

// Rate limit: max 20 purchases per 5 minutes per user
const purchaseLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '5 m'), prefix: 'rl:purchase' });

function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = verifyUserToken(req.headers.authorization);
  if (!auth.valid || !auth.userId) return res.status(401).json({ error: 'Inicia sesion para descargar' });

  // Rate limit per user
  const { success: rlOk } = await purchaseLimit.limit(auth.userId);
  if (!rlOk) return res.status(429).json({ error: 'Demasiadas compras. Espera unos minutos.' });

  try {
    const { trackId } = req.body;
    if (!trackId || typeof trackId !== 'string') return res.status(400).json({ error: 'Track ID requerido' });

    // Use a lock key to prevent race conditions
    const lockKey = `lock:purchase:${auth.userId}`;
    const lockAcquired = await redis.set(lockKey, '1', { nx: true, ex: 10 });
    if (!lockAcquired) return res.status(409).json({ error: 'Procesando otra compra. Intenta de nuevo.' });

    try {
      const user = await redis.get(`user:${auth.userId}`) as any;
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const tracks = await redis.get('tracks') as any[];
      const track = tracks?.find((t: any) => t.id === trackId);
      if (!track) return res.status(404).json({ error: 'Track no encontrado' });

      // Check if already purchased (free re-download — no URL exposed, just flag)
      const downloads = (await redis.get(`user-downloads:${auth.userId}`) as any[]) || [];
      if (downloads.find((d: any) => d.trackId === trackId)) {
        return res.status(200).json({ success: true, alreadyOwned: true, creditsRemaining: user.credits || 0 });
      }

      const cost = CREDIT_COSTS[track.category] || 1;

      // Free tracks (0 cost) — no credit check needed
      if (cost > 0) {
        if ((user.credits || 0) < cost) return res.status(402).json({ error: 'Drops insuficientes', required: cost, available: user.credits || 0 });

        // Deduct credits atomically
        user.credits = (user.credits || 0) - cost;
        await redis.set(`user:${auth.userId}`, user);
      }

      // Log download
      const isInternal = !!user.internal;
      const dlEntry: any = {
        trackId,
        title: track.title,
        artist: track.artist,
        authors: track.authors || '',
        coverUrl: track.coverUrl || '',
        genre: track.genre || '',
        bpm: track.bpm || 0,
        category: track.category,
        collaboratorId: track.collaboratorId || 'alex-selas',
        credits: cost,
        internal: isInternal,
        date: new Date().toISOString(),
        fingerprint: crypto.createHash('sha256').update(`${auth.userId}:${trackId}:${Date.now()}`).digest('hex').slice(0, 16),
      };
      downloads.unshift(dlEntry);
      await redis.set(`user-downloads:${auth.userId}`, downloads);

      // Log to global revenue ledger (only external purchases)
      if (!isInternal && cost > 0) {
        const month = new Date().toISOString().slice(0, 7); // YYYY-MM
        const ledger = (await redis.get(`revenue:${month}`) as any[]) || [];
        ledger.push({ trackId, collaboratorId: track.collaboratorId || 'alex-selas', drops: cost, userId: auth.userId, date: new Date().toISOString() });
        await redis.set(`revenue:${month}`, ledger);
      }

      // Return success — NO file URL exposed. Frontend uses /api/download?session_id=credits
      return res.status(200).json({ success: true, creditsUsed: cost, creditsRemaining: user.credits || 0 });
    } finally {
      await redis.del(lockKey);
    }
  } catch (error: any) {
    console.error('Download error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
