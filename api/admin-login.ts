import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.KV_REST_API_URL || '',
    token: process.env.KV_REST_API_TOKEN || '',
  }),
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'ratelimit:admin-login',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = ['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limiting
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return res.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo más tarde.' });
  }

  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || '';
  const adminPasswordHash = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SECRET || '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  if (email.toLowerCase() !== adminEmail.toLowerCase()) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Support both bcrypt hash and legacy plain text (for migration)
  let passwordMatch = false;
  if (adminPasswordHash.startsWith('$2')) {
    passwordMatch = await bcrypt.compare(password, adminPasswordHash);
  } else {
    passwordMatch = password === adminPasswordHash;
  }

  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate a token: timestamp.hmac
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac('sha256', secret).update(timestamp).digest('hex');
  const token = `${timestamp}.${hmac}`;

  return res.status(200).json({ token });
}
