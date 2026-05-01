import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const WEBHOOK_SECRET = process.env.STRIPE_CREDITS_WEBHOOK_SECRET || '';

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    let event: Stripe.Event;

    if (!WEBHOOK_SECRET) {
      // Fallback: verify the session exists in Stripe directly
      const body = req.body;
      if (body?.type === 'checkout.session.completed' && body?.data?.object?.id) {
        const session = await stripe.checkout.sessions.retrieve(body.data.object.id);
        event = { type: 'checkout.session.completed', data: { object: session } } as any;
      } else {
        return res.status(400).json({ error: 'Webhook secret not configured' });
      }
    } else {
      const rawBody = await getRawBody(req);
      const sig = req.headers['stripe-signature'] as string;
      event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;

      if (metadata?.type === 'credit_purchase' && metadata.userId && metadata.credits) {
        const userId = metadata.userId;
        const creditsToAdd = parseInt(metadata.credits, 10);

        if (creditsToAdd > 0) {
          // Idempotency: shared key with verify-credits — prevents double granting
          const processedKey = `credit-session:${session.id}`;
          const alreadyProcessed = await redis.get(processedKey);
          if (!alreadyProcessed) {
            const user = await redis.get(`user:${userId}`) as any;
            if (user) {
              // Apply WELCOME20 promo: 20% extra (only once per user)
              let bonus = 0;
              const sessionPromo = metadata.promoCode?.toUpperCase();
              if (sessionPromo === 'WELCOME20' && !user.promoUsed) {
                bonus = Math.ceil(creditsToAdd * 0.2);
                user.promoUsed = true;
              }
              user.credits = (user.credits || 0) + creditsToAdd + bonus;
              await redis.set(`user:${userId}`, user);
              await redis.set(processedKey, '1', { ex: 30 * 24 * 60 * 60 }); // 30 days

              const purchases = (await redis.get(`user-purchases:${userId}`) as any[]) || [];
              purchases.unshift({
                packId: metadata.packId,
                credits: creditsToAdd,
                amount: session.amount_total ? session.amount_total / 100 : 0,
                stripeSessionId: session.id,
                date: new Date().toISOString(),
              });
              await redis.set(`user-purchases:${userId}`, purchases);
            }
          }
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error?.message);
    return res.status(400).json({ error: 'Webhook error' });
  }
}
