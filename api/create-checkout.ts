import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import { corsHeaders } from './lib/auth';

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
    const allowedOrigins = ['https://alex-selas-drops.vercel.app', 'http://localhost:3000'];
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
      payment_method_types: ['card'],
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
    console.error('Stripe error:', error);
    // Only show safe messages — don't expose internal track IDs in production
    const message = error.message?.startsWith('Track no encontrado') || error.message?.startsWith('Precio no válido')
      ? error.message
      : 'Error al crear sesión de pago';
    return res.status(500).json({ error: message });
  }
}
