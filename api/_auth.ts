import crypto from 'crypto';

const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

export function verifyAdminToken(authHeader: string | undefined): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const secret = process.env.ADMIN_SECRET || '';

  const [timestamp, hmac] = token.split('.');
  if (!timestamp || !hmac) return false;

  // Check token age
  const age = Date.now() - Number(timestamp);
  if (isNaN(age) || age > TOKEN_MAX_AGE || age < 0) return false;

  // Verify HMAC
  const expected = crypto.createHmac('sha256', secret).update(timestamp).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'));
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
