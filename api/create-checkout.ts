import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

    const line_items = items.map((item: { title: string; price: number; id: string }) => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.title,
          metadata: { track_id: item.id },
        },
        unit_amount: Math.round(item.price * 100), // Stripe usa céntimos
      },
      quantity: 1,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${origin}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}?payment=cancelled`,
      metadata: {
        track_ids: items.map((i: { id: string }) => i.id).join(','),
      },
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('Stripe error:', error);
    return res.status(500).json({ error: error.message || 'Error al crear sesión de pago' });
  }
}
