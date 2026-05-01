import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}
function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

const redis = new Redis({ url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '' });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyAdminToken(req.headers.authorization)) return res.status(401).json({ error: 'Solo admin' });

  try {
    const { watermark } = req.query as { watermark: string };
    if (!watermark || typeof watermark !== 'string') return res.status(400).json({ error: 'Pega el codigo de 12 caracteres del campo Comentario del MP3' });
    // Validate watermark format: exactly 12 hex characters
    if (!/^[a-f0-9]{12}$/.test(watermark)) return res.status(400).json({ error: 'Formato de watermark invalido (12 caracteres hex)' });

    const wmData = await redis.get(`watermark:${watermark}`) as any;
    if (!wmData) return res.status(404).json({ error: 'Watermark no encontrado. Puede haber expirado (1 ano) o el codigo es incorrecto.' });

    const userId = wmData.userId;

    // Get user account info
    const user = await redis.get(`user:${userId}`) as any;

    // Get track title from tracks list
    let trackTitle = wmData.trackId || 'desconocido';
    try {
      const tracks = await redis.get('tracks') as any[];
      const track = tracks?.find((t: any) => t.id === wmData.trackId);
      if (track) trackTitle = `${track.title} (${track.artist})`;
    } catch {}

    // Get purchase history (to find Stripe payment data: real name, country, etc.)
    let stripeInfo: any = {};
    try {
      const purchases = (await redis.get(`user-purchases:${userId}`) as any[]) || [];
      // Find the most recent purchase with Stripe data
      const withStripe = purchases.find((p: any) => p.stripeName || p.stripeEmail);
      if (withStripe) {
        stripeInfo = {
          stripeName: withStripe.stripeName || '',
          stripeEmail: withStripe.stripeEmail || '',
          stripeCountry: withStripe.stripeCountry || '',
          stripeCity: withStripe.stripeCity || '',
          purchaseIp: withStripe.ip || '',
          purchaseDate: withStripe.date || '',
        };
      }
    } catch {}

    // Get download history for this user
    let downloadCount = 0;
    try {
      const downloads = (await redis.get(`user-downloads:${userId}`) as any[]) || [];
      downloadCount = downloads.length;
    } catch {}

    return res.status(200).json({
      watermark,
      // Account info
      userId,
      name: user?.name || 'desconocido',
      email: user?.email || 'desconocido',
      accountCreated: user?.createdAt || '',
      currentCredits: user?.credits ?? 0,
      totalDownloads: downloadCount,
      isInternal: !!user?.internal,
      // Download info
      trackTitle,
      trackId: wmData.trackId,
      downloadDate: wmData.date || '',
      downloadIp: wmData.ip || '',
      // Stripe payment info (from their purchases)
      ...stripeInfo,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Error interno' });
  }
}
