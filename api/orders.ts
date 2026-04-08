import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const limit = Number(req.query.limit) || 50;

    const sessions = await stripe.checkout.sessions.list({
      limit,
      expand: ['data.line_items'],
    });

    const orders = sessions.data
      .filter(s => s.payment_status === 'paid')
      .map(s => ({
        id: s.id.slice(-8).toUpperCase(),
        sessionId: s.id,
        tracks: s.line_items?.data.map(item => item.description || item.price?.product) || [],
        email: s.customer_details?.email || 'Sin email',
        amount: (s.amount_total || 0) / 100,
        currency: s.currency || 'eur',
        date: new Date((s.created || 0) * 1000).toISOString().split('T')[0],
        status: s.payment_status,
      }));

    const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);

    return res.status(200).json({
      orders,
      total: orders.length,
      revenue: totalRevenue,
    });
  } catch (error: any) {
    console.error('Orders API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
