import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const COLLAB_MONTHLY_DROPS = 200;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  // Verify Vercel cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const accounts = ((await redis.get('collab-accounts')) || []) as any[];
    let updated = 0;

    for (const a of accounts) {
      if (!a.linkedUserId) continue;
      const user = await redis.get(`user:${a.linkedUserId}`) as any;
      if (!user) continue;

      const before = user.credits || 0;
      if (before < COLLAB_MONTHLY_DROPS) {
        user.credits = COLLAB_MONTHLY_DROPS;
        await redis.set(`user:${a.linkedUserId}`, user);
        updated++;
      }
    }

    return res.status(200).json({ ok: true, updated, total: accounts.length, month: new Date().toISOString().slice(0, 7) });
  } catch (error: any) {
    console.error('Cron collab drops error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
