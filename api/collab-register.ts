import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import crypto from 'crypto';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '15 m'),
  prefix: 'ratelimit:collab-register',
});

const COLLAB_ACCOUNTS_KEY = 'collab-accounts';

interface CollabAccount {
  email: string;
  passwordHash: string;
  salt: string;
  collaboratorId: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function generateToken(collaboratorId: string): string {
  const secret = process.env.ADMIN_SECRET || 'dev-secret';
  const timestamp = Date.now().toString();
  const payload = `collab.${collaboratorId}.${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `collab.${collaboratorId}.${timestamp}.${hmac}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = ['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return res.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo más tarde.' });
  }

  const { email, password, collaboratorId, profile } = req.body;

  if (!email || !password || !collaboratorId) {
    return res.status(400).json({ error: 'Email, contraseña y colaborador son obligatorios' });
  }

  if (password.length < 12) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 12 caracteres' });
  }

  if (!collaboratorId || collaboratorId.length < 2) {
    return res.status(400).json({ error: 'Nombre artístico demasiado corto' });
  }

  try {
    const accounts = ((await redis.get(COLLAB_ACCOUNTS_KEY)) || []) as CollabAccount[];

    // Check if email already taken
    if (accounts.some(a => a.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ error: 'Este email ya está registrado' });
    }

    // Check if collaborator ID already claimed
    if (accounts.some(a => a.collaboratorId === collaboratorId)) {
      return res.status(409).json({ error: 'Este colaborador ya tiene una cuenta creada' });
    }

    // Create account
    const salt = crypto.randomBytes(32).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const newAccount: CollabAccount = {
      email: email.toLowerCase(),
      passwordHash,
      salt,
      collaboratorId,
    };

    accounts.push(newAccount);
    await redis.set(COLLAB_ACCOUNTS_KEY, accounts);

    // Save initial profile if provided
    if (profile && (profile.artistName || profile.bio || profile.socialLinks)) {
      const PROFILES_KEY = 'collab-profiles';
      const profiles = ((await redis.get(PROFILES_KEY)) || {}) as Record<string, any>;
      profiles[collaboratorId] = {
        bio: (profile.bio || '').substring(0, 300),
        photoUrl: '',
        bannerUrl: '',
        artistName: (profile.artistName || '').substring(0, 50),
        socialLinks: profile.socialLinks || {},
        colorPrimary: '#FACC15',
        colorSecondary: '#EAB308',
      };
      await redis.set(PROFILES_KEY, profiles);
    }

    // Auto-login after register
    const token = generateToken(collaboratorId);
    return res.status(201).json({ token, collaboratorId });
  } catch (error: any) {
    console.error('Collab register error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
