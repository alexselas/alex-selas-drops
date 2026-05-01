import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import crypto from 'crypto';
const U_TOKEN_MAX_AGE=30*24*60*60*1000;function verifyUserToken(h:string|undefined):{valid:boolean;userId?:string}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('user.'))return{valid:false};const p=t.split('.');if(p.length!==4)return{valid:false};const[,uid,ts,hm]=p;if(!uid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>U_TOKEN_MAX_AGE||a<0)return{valid:false};const s=process.env.ADMIN_SECRET||'';const py=`user.${uid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true,userId:uid};}catch{return{valid:false};}}function generateUserToken(uid:string):string{const s=process.env.ADMIN_SECRET||'';const ts=Date.now().toString();const py=`user.${uid}.${ts}`;const hm=crypto.createHmac('sha256',s).update(py).digest('hex');return`${py}.${hm}`;}function hashPw(pw:string,salt:string):string{return crypto.scryptSync(pw,salt,64).toString('hex');}

const redis = new Redis({ url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '' });
const loginLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'rl:user-login' });
const registerLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'), prefix: 'rl:user-register' });

function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, email, password, name, promoCode } = req.body;

    // Promo codes: stored on user, applied on first drop purchase (20% extra)
    const VALID_PROMO_CODES = ['WELCOME20'];
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Email y contrasena requeridos' });
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return res.status(400).json({ error: 'Email no valido' });
    if (password.length < 6) return res.status(400).json({ error: 'Minimo 6 caracteres' });

    // Rate limiting by IP
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';

    if (action === 'register') {
      const { success: rlOk } = await registerLimit.limit(ip);
      if (!rlOk) return res.status(429).json({ error: 'Demasiados intentos. Intenta mas tarde.' });
      if (await redis.get(`user-email:${em}`)) return res.status(409).json({ error: 'Ya existe una cuenta con este email' });
      const userName = (name && typeof name === 'string') ? name.trim().slice(0, 50) : '';
      if (!userName) return res.status(400).json({ error: 'Nombre requerido' });
      const userId = crypto.randomBytes(8).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      // Save promo code (applied on first drop purchase — 20% extra)
      let savedPromo: string | undefined;
      if (promoCode && typeof promoCode === 'string') {
        const code = promoCode.trim().toUpperCase();
        if (VALID_PROMO_CODES.includes(code)) savedPromo = code;
      }
      const user = { id: userId, email: em, name: userName, passwordHash: hashPw(password, salt), salt, credits: 0, promoCode: savedPromo, promoUsed: false, createdAt: new Date().toISOString() };
      await redis.set(`user:${userId}`, user);
      await redis.set(`user-email:${em}`, userId);
      return res.status(200).json({ success: true, token: generateUserToken(userId), user: { id: userId, email: em, name: userName, credits: 0 }, promoCode: savedPromo });
    }

    if (action === 'login') {
      const { success: rlOk2 } = await loginLimit.limit(ip);
      if (!rlOk2) return res.status(429).json({ error: 'Demasiados intentos. Intenta en 15 minutos.' });
      const userId = await redis.get(`user-email:${em}`) as string | null;
      if (!userId) return res.status(401).json({ error: 'Email o contrasena incorrectos' });
      const user = await redis.get(`user:${userId}`) as any;
      if (!user) return res.status(401).json({ error: 'Email o contrasena incorrectos' });
      const h1 = Buffer.from(hashPw(password, user.salt), 'hex');
      const h2 = Buffer.from(user.passwordHash, 'hex');
      if (h1.length !== h2.length || !crypto.timingSafeEqual(h1, h2)) return res.status(401).json({ error: 'Email o contrasena incorrectos' });
      return res.status(200).json({ success: true, token: generateUserToken(userId), user: { id: userId, email: user.email, name: user.name || '', credits: user.credits || 0 } });
    }

    return res.status(400).json({ error: 'Accion no valida' });
  } catch (error: any) {
    console.error('Auth error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
