import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    return res.status(200).end();
  }

  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  // Only allow our R2 domain
  if (!url.includes('r2.dev') && !url.includes('r2.cloudflarestorage.com')) {
    return res.status(403).json({ error: 'URL not allowed' });
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) return res.status(resp.status).end();

    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await resp.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buffer);
  } catch {
    return res.status(502).json({ error: 'Failed to fetch image' });
  }
}
