import crypto from 'crypto';

const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

export function verifyAdminToken(authHeader: string | undefined): boolean {
  try {
    if (!authHeader?.startsWith('Bearer ')) return false;
    const token = authHeader.slice(7);
    const secret = process.env.ADMIN_SECRET || '';
    if (!secret) return false;

    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [timestamp, hmac] = parts;
    if (!timestamp || !hmac) return false;

    const age = Date.now() - Number(timestamp);
    if (isNaN(age) || age > TOKEN_MAX_AGE || age < 0) return false;

    const expected = crypto.createHmac('sha256', secret).update(timestamp).digest('hex');
    if (hmac.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function corsHeaders(req: { headers: { origin?: string } }) {
  const allowedOrigins = ['https://alex-selas-drops.vercel.app', 'http://localhost:3000'];
  const origin = req.headers.origin || '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Filename, X-Folder',
  };
  if (allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}
