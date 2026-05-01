import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import crypto from 'crypto';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'ratelimit:collab-login',
});

const COLLAB_ACCOUNTS_KEY = 'collab-accounts';

interface CollabAccount {
  email: string;
  passwordHash: string;
  salt: string;
  collaboratorId: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function generateToken(collaboratorId: string): string {
  const secret = process.env.ADMIN_SECRET || '';
  if (!secret) throw new Error('ADMIN_SECRET not configured');
  const timestamp = Date.now().toString();
  const payload = `collab.${collaboratorId}.${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `collab.${collaboratorId}.${timestamp}.${hmac}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = ['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return res.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo más tarde.' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    const accounts = ((await redis.get(COLLAB_ACCOUNTS_KEY)) || []) as CollabAccount[];
    const account = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());

    if (!account) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    const hash = hashPassword(password, account.salt);
    const h1 = Buffer.from(hash, 'hex');
    const h2 = Buffer.from(account.passwordHash, 'hex');
    if (h1.length !== h2.length || !crypto.timingSafeEqual(h1, h2)) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    const token = generateToken(account.collaboratorId);
    return res.status(200).json({ token, collaboratorId: account.collaboratorId });
  } catch (error: any) {
    console.error('Collab login error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
