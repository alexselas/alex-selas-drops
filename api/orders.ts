import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

function getStartTimestamp(period: string): number {
  const now = new Date();
  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo.getTime() / 1000;
    case 'month':
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return monthAgo.getTime() / 1000;
    case 'year':
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return yearAgo.getTime() / 1000;
    default:
      return 0; // all time
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const limit = Number(req.query.limit) || 100;
    const period = (req.query.period as string) || 'all';
    const created = getStartTimestamp(period);

    const params: Stripe.Checkout.SessionListParams = {
      limit,
      expand: ['data.line_items'],
    };

    if (created > 0) {
      params.created = { gte: Math.floor(created) };
    }

    const sessions = await stripe.checkout.sessions.list(params);

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
