import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const PROFILES_KEY = 'collab-profiles';
const SITE_URL = 'https://www.musicdrop.es';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id as string;
  if (!id) return res.status(400).send('Missing id');

  let artistName = id;
  let description = 'DJ Sets, Remixes & Sample Packs exclusivos en alta calidad';
  let imageUrl = `${SITE_URL}/og-image.png`;

  try {
    const profiles = ((await redis.get(PROFILES_KEY)) || {}) as Record<string, any>;
    const profile = profiles[id];
    if (profile) {
      artistName = profile.artistName || id;
      if (profile.bio) description = profile.bio;
      if (profile.photoUrl) imageUrl = profile.photoUrl;
    }
  } catch {}

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const title = esc(`${artistName} — Music Drops`);
  const desc = esc(description);
  const img = esc(imageUrl);
  const url = `${SITE_URL}/collab/${esc(id)}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.status(200).send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${desc}" />
  <meta name="twitter:image" content="${img}" />
  <meta http-equiv="refresh" content="0;url=${url}" />
</head>
<body></body>
</html>`);
}
