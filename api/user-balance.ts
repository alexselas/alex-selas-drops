import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
const U_TOKEN_MAX_AGE=30*24*60*60*1000;function verifyUserToken(h:string|undefined):{valid:boolean;userId?:string}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('user.'))return{valid:false};const p=t.split('.');if(p.length!==4)return{valid:false};const[,uid,ts,hm]=p;if(!uid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>U_TOKEN_MAX_AGE||a<0)return{valid:false};const s=process.env.ADMIN_SECRET||'';const py=`user.${uid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true,userId:uid};}catch{return{valid:false};}}

const redis = new Redis({ url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '' });

function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = verifyUserToken(req.headers.authorization);
  if (!auth.valid || !auth.userId) return res.status(401).json({ error: 'No autorizado' });

  try {
    const user = await redis.get(`user:${auth.userId}`) as any;
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const downloads = await redis.get(`user-downloads:${auth.userId}`) as any[] || [];
    return res.status(200).json({ credits: user.credits || 0, email: user.email, name: user.name || '', downloads: downloads.slice(0, 50) });
  } catch (error: any) {
    console.error('Balance error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
