import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import crypto from 'crypto';
const U_TOKEN_MAX_AGE=30*24*60*60*1000;function verifyUserToken(h:string|undefined):{valid:boolean;userId?:string}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('user.'))return{valid:false};const p=t.split('.');if(p.length!==4)return{valid:false};const[,uid,ts,hm]=p;if(!uid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>U_TOKEN_MAX_AGE||a<0)return{valid:false};const s=process.env.ADMIN_SECRET||'';const py=`user.${uid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true,userId:uid};}catch{return{valid:false};}}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const CREDIT_PACKS: Record<string, { credits: number; priceEur: number; name: string }> = {
  'pack-5': { credits: 5, priceEur: 3.99, name: '5 Creditos MusicDrop' },
  'pack-10': { credits: 10, priceEur: 6.99, name: '10 Creditos MusicDrop' },
  'pack-20': { credits: 20, priceEur: 11.99, name: '20 Creditos MusicDrop' },
};

function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = verifyUserToken(req.headers.authorization);
  if (!auth.valid || !auth.userId) return res.status(401).json({ error: 'Inicia sesion para comprar creditos' });

  try {
    const { packId, promoCode } = req.body;
    const pack = CREDIT_PACKS[packId];
    if (!pack) return res.status(400).json({ error: 'Paquete no valido' });

    const origin = req.headers.origin || 'https://musicdrop.es';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'eur', product_data: { name: pack.name, description: `${pack.credits} drops para descargar tracks en MusicDrop` }, unit_amount: Math.round(pack.priceEur * 100) }, quantity: 1 }],
      mode: 'payment',
      success_url: `${origin}?credits_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}?credits_cancel=true`,
      metadata: { userId: auth.userId, packId, credits: pack.credits.toString(), type: 'credit_purchase', promoCode: (promoCode && typeof promoCode === 'string') ? promoCode.trim().toUpperCase() : '' },
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Buy credits error:', error?.message);
    return res.status(500).json({ error: 'Error al crear la sesion de pago' });
  }
}
