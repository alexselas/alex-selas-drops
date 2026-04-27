import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}
function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Filename, X-Folder'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const KV_KEY = 'tracks';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { items, origin, discountCode, allTrackIds } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No hay items en el carrito' });
    }

    // Validate origin is an allowed URL
    const allowedOrigins = ['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'];
    const safeOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    // Look up real prices from Redis — never trust client-sent prices
    const tracks = (await redis.get(KV_KEY)) as any[] | null;
    if (!tracks) {
      return res.status(500).json({ error: 'No se pudieron cargar los tracks' });
    }

    const trackMap = new Map(tracks.map((t: any) => [t.id, t]));

    const line_items = items.map((item: { title: string; price: number; id: string; packName?: string }) => {
      const serverTrack = trackMap.get(item.id);
      if (!serverTrack) {
        throw new Error(`Track no encontrado: ${item.id}`);
      }

      const serverPrice = typeof serverTrack.price === 'number' ? serverTrack.price : 0;
      if (serverPrice <= 0) {
        return null; // Skip free tracks
      }

      // Use packName if available (for pack purchases), otherwise use track title
      const productName = item.packName || serverTrack.packName || serverTrack.title;

      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: productName,
            metadata: { track_id: item.id },
          },
          unit_amount: Math.round(serverPrice * 100), // Stripe uses cents
        },
        quantity: 1,
      };
    }).filter(Boolean);

    if (line_items.length === 0) {
      return res.status(400).json({ error: 'No hay items con precio válido' });
    }

    const session = await stripe.checkout.sessions.create({
      line_items: line_items as any[],
      mode: 'payment',
      payment_method_types: ['card', 'paypal'] as any,
      success_url: `${safeOrigin}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${safeOrigin}?payment=cancelled`,
      payment_intent_data: {
        statement_descriptor: 'MUSICDROP',
      },
      metadata: {
        track_ids: (Array.isArray(allTrackIds) ? allTrackIds : items.map((i: { id: string }) => i.id)).join(','),
        ...(discountCode ? { discount_code: discountCode } : {}),
      },
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('Stripe checkout error:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Error al crear sesión de pago' });
  }
}
