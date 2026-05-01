import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = ['https://alex-selas-drops.vercel.app', 'https://musicdrop.es', 'https://www.musicdrop.es'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  // Strict URL validation — only allow our R2 domain (parse hostname, not includes)
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (!hostname.endsWith('.r2.dev') && !hostname.endsWith('.r2.cloudflarestorage.com')) {
      return res.status(403).json({ error: 'URL not allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) return res.status(resp.status).end();

    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return res.status(403).json({ error: 'Not an image' });

    const buffer = Buffer.from(await resp.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buffer);
  } catch {
    return res.status(502).json({ error: 'Failed to fetch image' });
  }
}
