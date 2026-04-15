import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

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

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = ['https://alex-selas-drops.vercel.app', 'http://localhost:3000'];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  if (!verifyAdminToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const collaboratorId = req.query.id as string;
  if (!collaboratorId) return res.status(400).json({ error: 'Falta id' });

  try {
    // Remove profile
    const profiles = ((await redis.get('collab-profiles')) || {}) as Record<string, any>;
    delete profiles[collaboratorId];
    await redis.set('collab-profiles', profiles);

    // Remove account
    const accounts = ((await redis.get('collab-accounts')) || []) as any[];
    const filtered = accounts.filter((a: any) => a.collaboratorId !== collaboratorId);
    await redis.set('collab-accounts', filtered);

    // Remove all tracks from this collaborator
    const tracks = ((await redis.get('tracks')) || []) as any[];
    const cleanTracks = tracks.filter((t: any) => t.collaboratorId !== collaboratorId);
    await redis.set('tracks', cleanTracks);

    const removedTracks = tracks.length - cleanTracks.length;

    return res.status(200).json({ ok: true, removedTracks });
  } catch (error: any) {
    console.error('Collab delete error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
