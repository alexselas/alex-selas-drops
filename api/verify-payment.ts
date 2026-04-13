import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { corsHeaders } from './lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { sessionId } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Falta session_id' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      return res.status(200).json({
        paid: true,
        trackIds: session.metadata?.track_ids?.split(',') || [],
        email: session.customer_details?.email,
      });
    }

    return res.status(200).json({ paid: false });
  } catch (error: any) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: 'Error al verificar pago' });
  }
}
