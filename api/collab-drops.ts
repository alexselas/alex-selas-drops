import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000;
const COLLAB_ACCOUNTS_KEY = 'collab-accounts';
const COLLAB_MONTHLY_DROPS = 200;

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

function corsHeaders(r: { headers: { origin?: string } }) {
  const o = ['https://alex-selas-drops.vercel.app', 'https://musicdrop.es', 'https://www.musicdrop.es'];
  const g = r.headers.origin || '';
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (o.includes(g)) h['Access-Control-Allow-Origin'] = g;
  return h;
}

interface CollabAccount {
  email: string;
  passwordHash: string;
  salt: string;
  collaboratorId: string;
  linkedUserId?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyAdminToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    // === GET: List all collaborators with their drops ===
    if (req.method === 'GET') {
      const accounts = ((await redis.get(COLLAB_ACCOUNTS_KEY)) || []) as CollabAccount[];
      const profiles = ((await redis.get('collab-profiles')) || {}) as Record<string, any>;

      const result = [];
      for (const a of accounts) {
        let drops = 0;
        let hasUserAccount = false;

        if (a.linkedUserId) {
          const user = await redis.get(`user:${a.linkedUserId}`) as any;
          if (user) {
            drops = user.credits || 0;
            hasUserAccount = true;
          }
        }

        result.push({
          collaboratorId: a.collaboratorId,
          email: a.email,
          artistName: profiles[a.collaboratorId]?.artistName || a.collaboratorId,
          drops,
          hasUserAccount,
          linkedUserId: a.linkedUserId || null,
        });
      }

      return res.status(200).json({ collaborators: result, monthlyDrops: COLLAB_MONTHLY_DROPS });
    }

    // === POST ===
    if (req.method === 'POST') {
      const { action, password } = req.body;

      // --- PROVISION: Create user accounts for existing collabs without one ---
      if (action === 'provision') {
        if (!password || typeof password !== 'string' || password.length < 6) {
          return res.status(400).json({ error: 'Contrasena requerida (min 6 caracteres)' });
        }

        const accounts = ((await redis.get(COLLAB_ACCOUNTS_KEY)) || []) as CollabAccount[];
        const profiles = ((await redis.get('collab-profiles')) || {}) as Record<string, any>;
        const provisioned = [];

        for (let i = 0; i < accounts.length; i++) {
          const a = accounts[i];
          if (a.linkedUserId) {
            // Already linked — just ensure internal flag and top up drops
            const user = await redis.get(`user:${a.linkedUserId}`) as any;
            if (user) {
              let changed = false;
              if (!user.internal) { user.internal = true; changed = true; }
              if (!user.collaboratorId) { user.collaboratorId = a.collaboratorId; changed = true; }
              if ((user.credits || 0) < COLLAB_MONTHLY_DROPS) { user.credits = COLLAB_MONTHLY_DROPS; changed = true; }
              if (changed) await redis.set(`user:${a.linkedUserId}`, user);
              provisioned.push({ collaboratorId: a.collaboratorId, email: a.email, action: 'updated', drops: user.credits });
            }
            continue;
          }

          // Check if email already exists as user
          const existingUserId = await redis.get(`user-email:${a.email}`) as string | null;

          if (existingUserId) {
            a.linkedUserId = existingUserId;
            const user = await redis.get(`user:${existingUserId}`) as any;
            if (user) {
              user.internal = true;
              user.collaboratorId = a.collaboratorId;
              if ((user.credits || 0) < COLLAB_MONTHLY_DROPS) user.credits = COLLAB_MONTHLY_DROPS;
              await redis.set(`user:${existingUserId}`, user);
            }
            provisioned.push({ collaboratorId: a.collaboratorId, email: a.email, action: 'linked', drops: COLLAB_MONTHLY_DROPS });
          } else {
            // Create new user account
            const userId = crypto.randomBytes(8).toString('hex');
            const salt = crypto.randomBytes(16).toString('hex');
            const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');

            const user = {
              id: userId,
              email: a.email,
              name: profiles[a.collaboratorId]?.artistName || a.collaboratorId,
              passwordHash,
              salt,
              credits: COLLAB_MONTHLY_DROPS,
              internal: true,
              collaboratorId: a.collaboratorId,
              createdAt: new Date().toISOString(),
            };

            await redis.set(`user:${userId}`, user);
            await redis.set(`user-email:${a.email}`, userId);
            a.linkedUserId = userId;
            provisioned.push({ collaboratorId: a.collaboratorId, email: a.email, action: 'created', drops: COLLAB_MONTHLY_DROPS });
          }
        }

        await redis.set(COLLAB_ACCOUNTS_KEY, accounts);
        return res.status(200).json({ provisioned });
      }

      // --- RESET: Monthly top-up to 200 drops ---
      if (action === 'reset') {
        const accounts = ((await redis.get(COLLAB_ACCOUNTS_KEY)) || []) as CollabAccount[];
        const results = [];

        for (const a of accounts) {
          if (!a.linkedUserId) continue;
          const user = await redis.get(`user:${a.linkedUserId}`) as any;
          if (!user) continue;

          const before = user.credits || 0;
          if (before < COLLAB_MONTHLY_DROPS) {
            user.credits = COLLAB_MONTHLY_DROPS;
            await redis.set(`user:${a.linkedUserId}`, user);
          }

          results.push({
            collaboratorId: a.collaboratorId,
            before,
            after: user.credits,
            added: Math.max(0, COLLAB_MONTHLY_DROPS - before),
          });
        }

        return res.status(200).json({ reset: results, month: new Date().toISOString().slice(0, 7) });
      }

      return res.status(400).json({ error: 'Accion no valida (provision, reset)' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Collab drops error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
