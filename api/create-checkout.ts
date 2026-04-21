import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}
function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Filename, X-Folder'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

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
    const { items, origin } = req.body;

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

    const line_items = items.map((item: { title: string; price: number; id: string }) => {
      const serverTrack = trackMap.get(item.id);
      if (!serverTrack) {
        throw new Error(`Track no encontrado: ${item.id}`);
      }

      const serverPrice = serverTrack.price;
      if (typeof serverPrice !== 'number' || serverPrice <= 0) {
        throw new Error(`Precio no válido para track: ${item.id}`);
      }

      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: serverTrack.title,
            metadata: { track_id: item.id },
          },
          unit_amount: Math.round(serverPrice * 100), // Stripe uses cents
        },
        quantity: 1,
      };
    });

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: 'payment',
      success_url: `${safeOrigin}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${safeOrigin}?payment=cancelled`,
      metadata: {
        track_ids: items.map((i: { id: string }) => i.id).join(','),
      },
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({ error: 'Error al crear sesión de pago' });
  }
}
