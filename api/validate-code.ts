import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const USED_WELCOME_KEY = 'used-welcome20';

function corsHeaders(req: { headers: { origin?: string } }) {
  const allowedOrigins = ['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'];
  const origin = req.headers.origin || '';
  const headers: Record<string, string> = { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { code, email } = req.body;
    if (!code || !email) return res.status(400).json({ valid: false, error: 'Faltan datos' });

    const upper = code.trim().toUpperCase();

    // WELCOME20: one-time per email
    if (upper === 'WELCOME20') {
      const rawUsed = await redis.get(USED_WELCOME_KEY);
      const usedEmails: string[] = Array.isArray(rawUsed) ? rawUsed : [];
      if (usedEmails.includes(email.toLowerCase().trim())) {
        return res.status(200).json({ valid: false, error: 'Ya has usado este codigo. Solo se puede usar una vez.' });
      }
      return res.status(200).json({ valid: true });
    }

    // DROPS20: always valid (no one-time restriction)
    if (upper === 'DROPS20') {
      return res.status(200).json({ valid: true });
    }

    return res.status(200).json({ valid: false, error: 'Codigo no valido' });
  } catch {
    return res.status(500).json({ valid: false, error: 'Error del servidor' });
  }
}
