import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import Stripe from 'stripe';
import crypto from 'crypto';
const U_TOKEN_MAX_AGE=30*24*60*60*1000;function verifyUserToken(h:string|undefined):{valid:boolean;userId?:string}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('user.'))return{valid:false};const p=t.split('.');if(p.length!==4)return{valid:false};const[,uid,ts,hm]=p;if(!uid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>U_TOKEN_MAX_AGE||a<0)return{valid:false};const s=process.env.ADMIN_SECRET||'';const py=`user.${uid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true,userId:uid};}catch{return{valid:false};}}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const redis = new Redis({ url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '' });
const verifyLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '5 m'), prefix: 'rl:verify-credits' });

function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = verifyUserToken(req.headers.authorization);
  if (!auth.valid || !auth.userId) return res.status(401).json({ error: 'No autorizado' });

  // Rate limit per user
  const { success: rlOk } = await verifyLimit.limit(auth.userId);
  if (!rlOk) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });

  try {
    const { sessionId } = req.body;
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 200) return res.status(400).json({ error: 'Session ID requerido' });

    // Verify the session with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'El pago no se ha completado' });
    }

    // Check metadata matches this user
    if (session.metadata?.type !== 'credit_purchase') {
      return res.status(400).json({ error: 'Sesion no valida' });
    }
    if (session.metadata?.userId !== auth.userId) {
      return res.status(403).json({ error: 'Esta sesion no pertenece a tu cuenta' });
    }

    const creditsToAdd = parseInt(session.metadata.credits || '0', 10);
    if (creditsToAdd <= 0) return res.status(400).json({ error: 'Creditos no validos' });

    // Check if already processed (idempotency)
    const processedKey = `credit-session:${sessionId}`;
    const alreadyProcessed = await redis.get(processedKey);
    if (alreadyProcessed) {
      // Already added — just return current balance
      const user = await redis.get(`user:${auth.userId}`) as any;
      return res.status(200).json({ success: true, credits: user?.credits || 0, alreadyProcessed: true });
    }

    // Add credits
    const user = await redis.get(`user:${auth.userId}`) as any;
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Apply WELCOME20 promo: 20% extra (only once per user)
    let bonus = 0;
    const sessionPromo = session.metadata?.promoCode?.toUpperCase();
    if (sessionPromo === 'WELCOME20' && !user.promoUsed) {
      bonus = Math.ceil(creditsToAdd * 0.2);
      user.promoUsed = true;
    }

    const totalAdded = creditsToAdd + bonus;
    user.credits = (user.credits || 0) + totalAdded;
    await redis.set(`user:${auth.userId}`, user);

    // Mark session as processed
    await redis.set(processedKey, '1', { ex: 30 * 24 * 60 * 60 }); // 30 days

    // Log purchase with full buyer info
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
    const purchases = (await redis.get(`user-purchases:${auth.userId}`) as any[]) || [];
    purchases.unshift({
      packId: session.metadata.packId,
      credits: creditsToAdd,
      bonus,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency || 'eur',
      stripeSessionId: sessionId,
      stripeEmail: session.customer_details?.email || '',
      stripeName: session.customer_details?.name || '',
      stripeCountry: session.customer_details?.address?.country || '',
      stripeCity: session.customer_details?.address?.city || '',
      userId: auth.userId,
      userName: user.name || '',
      userEmail: user.email || '',
      ip,
      userAgent: (req.headers['user-agent'] || '').substring(0, 200),
      promoCode: sessionPromo || '',
      date: new Date().toISOString(),
    });
    await redis.set(`user-purchases:${auth.userId}`, purchases);

    return res.status(200).json({ success: true, credits: user.credits, added: totalAdded, bonus });
  } catch (error: any) {
    console.error('Verify credits error:', error?.message);
    return res.status(500).json({ error: 'Error al verificar el pago' });
  }
}
