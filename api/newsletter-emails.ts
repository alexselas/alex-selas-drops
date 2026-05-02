import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import Stripe from 'stripe';
import crypto from 'crypto';

const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000;
function verifyAdminToken(authHeader: string | undefined): boolean {
  try {
    if (!authHeader?.startsWith('Bearer ')) return false;
    const token = authHeader.slice(7);
    const secret = process.env.ADMIN_SECRET || '';
    if (!secret) return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [timestamp, hmac] = parts;
    if (!timestamp || !hmac) return false;
    const age = Date.now() - Number(timestamp);
    if (isNaN(age) || age > TOKEN_MAX_AGE || age < 0) return false;
    const expected = crypto.createHmac('sha256', secret).update(timestamp).digest('hex');
    if (hmac.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }
}

function corsHeaders(req: { headers: { origin?: string } }) {
  const allowedOrigins = ['https://alex-selas-drops.vercel.app', 'https://musicdrop.es', 'https://www.musicdrop.es'];
  const origin = req.headers.origin || '';
  const headers: Record<string, string> = { 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
  if (allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const redis = new Redis({ url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '' });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyAdminToken(req.headers.authorization)) return res.status(401).json({ error: 'No autorizado' });

  try {
    const emailMap: Record<string, { email: string; source: string; date: string }> = {};

    // 1. Emails from newsletter list (saved on purchase with privacy acceptance)
    const newsletterList = (await redis.get('newsletter-emails') || []) as any[];
    for (const entry of newsletterList) {
      const em = (entry.email || '').toLowerCase().trim();
      if (em && em !== 'sin email') {
        emailMap[em] = { email: em, source: 'Newsletter', date: entry.date || '' };
      }
    }

    // 2. Emails from registered users (scan user-email:* keys)
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(Number(cursor), { match: 'user-email:*', count: 200 });
      cursor = String(nextCursor);
      for (const key of keys) {
        const em = key.replace('user-email:', '');
        if (em && em !== 'sin email' && !emailMap[em]) {
          emailMap[em] = { email: em, source: 'Registro', date: '' };
        }
      }
    } while (cursor !== '0');

    // 3. Emails from Stripe purchases
    try {
      const sessions = await stripe.checkout.sessions.list({ limit: 100 });
      for (const s of sessions.data) {
        if (s.payment_status === 'paid' && s.customer_details?.email) {
          const em = s.customer_details.email.toLowerCase().trim();
          if (em && !emailMap[em]) {
            emailMap[em] = { email: em, source: 'Compra', date: new Date((s.created || 0) * 1000).toISOString().split('T')[0] };
          }
        }
      }
    } catch {}

    // 4. Emails from collaborator accounts
    try {
      const collabAccounts = (await redis.get('collab-accounts') || []) as any[];
      for (const acc of collabAccounts) {
        const em = (acc.email || '').toLowerCase().trim();
        if (em && !emailMap[em]) {
          emailMap[em] = { email: em, source: 'Editor', date: acc.createdAt ? acc.createdAt.split('T')[0] : '' };
        }
      }
    } catch {}

    const emails = Object.values(emailMap).sort((a, b) => a.email.localeCompare(b.email));
    return res.status(200).json({ emails, total: emails.length });
  } catch (error: any) {
    console.error('Newsletter emails error:', error?.message);
    return res.status(500).json({ error: 'Error al obtener emails' });
  }
}
