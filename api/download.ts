import type { VercelRequest, VercelResponse } from '@vercel/node';
import NodeID3 from 'node-id3';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import crypto from 'crypto';
const U_TOKEN_MAX_AGE=30*24*60*60*1000;function verifyUserToken(h:string|undefined):{valid:boolean;userId?:string}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('user.'))return{valid:false};const p=t.split('.');if(p.length!==4)return{valid:false};const[,uid,ts,hm]=p;if(!uid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>U_TOKEN_MAX_AGE||a<0)return{valid:false};const s=process.env.ADMIN_SECRET||'';const py=`user.${uid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true,userId:uid};}catch{return{valid:false};}}

function sanitizeTag(s: string, max = 200): string {
  return s ? s.replace(/[\x00-\x1F\x7F]/g, '').trim().substring(0, max) : '';
}
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}
function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Filename, X-Folder'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});
const downloadLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'dl-limit' });

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  const { success: rlOk } = await downloadLimit.limit(ip);
  if (!rlOk) return res.status(429).json({ error: 'Demasiadas descargas. Intenta en 1 minuto.' });

  try {
    const { trackId, fileUrl: legacyFileUrl, session_id } = req.query as Record<string, string>;
    const { title, artist, authors, coverUrl, genre, bpm } = req.query as Record<string, string>;

    if (!session_id) {
      return res.status(403).json({ error: 'Falta verificación de pago' });
    }

    // Resolve fileUrl: either from trackId (normal users) or legacy fileUrl (admin)
    let fileUrl = '';

    if (trackId) {
      // Single Redis call for all checks
      const allTracks = await redis.get('tracks') as any[] | null;
      if (!allTracks || !Array.isArray(allTracks)) {
        return res.status(500).json({ error: 'Error cargando datos' });
      }

      const track = allTracks.find((t: any) => t.id === trackId);
      if (!track) {
        return res.status(404).json({ error: `Track ${trackId} no encontrado` });
      }
      if (!track.fileUrl) {
        return res.status(404).json({ error: `Track sin archivo asociado` });
      }

      // Admin downloads
      if (session_id === 'admin') {
        if (!verifyAdminToken(req.headers.authorization as string | undefined)) {
          return res.status(403).json({ error: 'No autorizado' });
        }
      }
      // Credit-based downloads: verify user owns this track
      else if (session_id === 'credits') {
        const userAuth = verifyUserToken(req.headers.authorization);
        if (!userAuth.valid || !userAuth.userId) {
          return res.status(403).json({ error: 'No autorizado' });
        }
        const downloads = (await redis.get(`user-downloads:${userAuth.userId}`) as any[]) || [];
        if (!downloads.find((d: any) => d.trackId === trackId)) {
          return res.status(403).json({ error: 'No has comprado este track' });
        }
      }
      // Free downloads
      else if (session_id === 'free') {
        // For free tracks OR tracks that belong to a free pack
        const isFreeTrack = track.price <= 0;
        const isInFreePack = track.packId && allTracks.filter((t: any) => t.packId === track.packId).every((t: any) => t.price <= 0);
        if (!isFreeTrack && !isInFreePack) {
          return res.status(403).json({ error: 'Este track requiere pago' });
        }
      }
      // Paid downloads: verify Stripe session
      else {
        try {
          const session = await stripe.checkout.sessions.retrieve(session_id);
          if (session.payment_status !== 'paid') {
            return res.status(403).json({ error: 'Pago no confirmado' });
          }
          const purchasedIds = session.metadata?.track_ids?.split(',').filter(Boolean) || [];
          // Expand to all pack members
          const authorizedIds = new Set(purchasedIds);
          for (const pid of purchasedIds) {
            const pt = allTracks.find((t: any) => t.id === pid);
            if (pt?.packId) {
              for (const t of allTracks) {
                if (t.packId === pt.packId) authorizedIds.add(t.id);
              }
            }
          }
          if (!authorizedIds.has(trackId)) {
            return res.status(403).json({ error: 'Track no incluido en esta compra' });
          }
        } catch (e: any) {
          console.error('Stripe session verify error:', e?.message);
          return res.status(403).json({ error: 'Sesion de pago no valida' });
        }
      }

      fileUrl = track.fileUrl;
    } else if (legacyFileUrl) {
      // Legacy: admin passes fileUrl directly
      if (!verifyAdminToken(req.headers.authorization as string | undefined)) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      fileUrl = legacyFileUrl;
    } else {
      return res.status(400).json({ error: 'Falta trackId' });
    }

    // Only serve files from Vercel Blob or Cloudflare R2 storage
    if (!fileUrl.includes('.vercel-storage.com') && !fileUrl.includes('.public.blob.vercel-storage.com') && !fileUrl.includes('.r2.dev') && !fileUrl.includes('.r2.cloudflarestorage.com')) {
      return res.status(400).json({ error: 'URL de archivo no válida' });
    }

    // Fetch the original file
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      return res.status(502).json({ error: 'No se pudo descargar el archivo' });
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // Generate user fingerprint for watermark tracking
    const userAuthWm = verifyUserToken(req.headers.authorization);
    const fingerprintId = userAuthWm.valid && userAuthWm.userId ? userAuthWm.userId : 'anon';
    const watermark = crypto.createHash('sha256').update(`${fingerprintId}:${trackId}:${process.env.ADMIN_SECRET || ''}`).digest('hex').slice(0, 12);

    // Only add ID3 tags to MP3 files
    const isMP3 = fileUrl.toLowerCase().includes('.mp3');
    if (isMP3) {

      const tags: NodeID3.Tags = {
        title: sanitizeTag(title || ''),
        artist: authors ? sanitizeTag(authors) : sanitizeTag(artist || ''),
        performerInfo: sanitizeTag(artist || ''),
        album: 'MusicDrop',
        genre: sanitizeTag(genre || '', 100),
        year: new Date().getFullYear().toString(),
        // Watermark: user fingerprint hidden in comment — if leaked, we can trace who downloaded it
        comment: { language: 'spa', text: `musicdrop.es|${watermark}` },
        // Also embed in a custom TXXX frame
        userDefinedText: [{ description: 'MDID', value: watermark }],
      };

      if (bpm && /^\d{1,3}$/.test(bpm) && Number(bpm) > 0 && Number(bpm) < 999) {
        tags.bpm = bpm;
      }

      if (coverUrl && !coverUrl.startsWith('data:')) {
        try {
          if (coverUrl.includes('.vercel-storage.com') || coverUrl.includes('.public.blob.vercel-storage.com') || coverUrl.includes('.r2.dev') || coverUrl.includes('.r2.cloudflarestorage.com')) {
            const coverRes = await fetch(coverUrl);
            if (coverRes.ok) {
              const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
              const contentType = coverRes.headers.get('content-type') || 'image/jpeg';
              const mime = contentType.includes('png') ? 'image/png' : 'image/jpeg';
              tags.image = { mime, type: { id: 3, name: 'front cover' }, description: 'Cover', imageBuffer: coverBuffer };
            }
          }
        } catch {}
      } else if (coverUrl && coverUrl.startsWith('data:')) {
        try {
          const matches = coverUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (matches) {
            tags.image = { mime: matches[1] as 'image/jpeg' | 'image/png', type: { id: 3, name: 'front cover' }, description: 'Cover', imageBuffer: Buffer.from(matches[2], 'base64') };
          }
        } catch {}
      }

      const tagged = NodeID3.write(tags, buffer);
      if (tagged && Buffer.isBuffer(tagged)) {
        buffer = tagged;
      }
    }

    // Log watermark for piracy tracking
    if (isMP3 && watermark && fingerprintId !== 'anon') {
      redis.set(`watermark:${watermark}`, {
        userId: fingerprintId,
        trackId: trackId || 'unknown',
        date: new Date().toISOString(),
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown',
      }, { ex: 365 * 24 * 60 * 60 }).catch(() => {}); // expires in 1 year
    }

    const fileName = authors ? `${authors} - ${title || 'track'}` : (title || 'track');
    const rawExt = fileUrl.split('.').pop()?.split('?')[0] || 'mp3';
    const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'mp3';

    res.setHeader('Content-Type', isMP3 ? 'audio/mpeg' : 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}.${ext}"`);
    res.setHeader('Content-Length', buffer.length);
    // Prevent caching of downloaded files
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    return res.send(buffer);
  } catch (error: any) {
    console.error('Download error:', error?.message);
    return res.status(500).json({ error: 'Error al descargar archivo' });
  }
}
