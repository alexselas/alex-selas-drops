import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000;

function verifyAdminToken(h: string | undefined): boolean {
  try {
    if (!h?.startsWith('Bearer ')) return false;
    const t = h.slice(7), s = process.env.ADMIN_SECRET || '';
    if (!s) return false;
    const p = t.split('.');
    if (p.length !== 2) return false;
    const [ts, hm] = p;
    if (!ts || !hm) return false;
    const a = Date.now() - Number(ts);
    if (isNaN(a) || a > TOKEN_MAX_AGE || a < 0) return false;
    const e = crypto.createHmac('sha256', s).update(ts).digest('hex');
    if (hm.length !== e.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hm, 'hex'), Buffer.from(e, 'hex'));
  } catch { return false; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = ['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!verifyAdminToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const accounts = ((await redis.get('collab-accounts')) || []) as { email: string; collaboratorId: string }[];
    const profiles = ((await redis.get('collab-profiles')) || {}) as Record<string, any>;

    const result = accounts.map(a => ({
      collaboratorId: a.collaboratorId,
      email: a.email,
      artistName: profiles[a.collaboratorId]?.artistName || '',
    }));

    return res.status(200).json({ accounts: result });
  } catch (error: any) {
    console.error('Collab accounts list error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
