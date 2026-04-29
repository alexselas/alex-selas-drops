import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyAnyToken, corsHeaders } from './_auth';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_BUCKET = 'musicdrop';
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_URL || '';

const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/x-m4a', 'audio/mp4', 'audio/aac', 'audio/ogg',
  'audio/flac', 'audio/x-flac',
  'application/zip', 'application/octet-stream',
];

// Ensure CORS on R2 bucket (idempotent, runs once per cold start)
let corsReady = false;
async function ensureR2Cors() {
  if (corsReady) return;
  try {
    await s3.send(new PutBucketCorsCommand({
      Bucket: R2_BUCKET,
      CORSConfiguration: {
        CORSRules: [{
          AllowedOrigins: [
            'https://musicdrop.es',
            'https://www.musicdrop.es',
            'https://alex-selas-drops.vercel.app',
          ],
          AllowedMethods: ['PUT', 'GET', 'HEAD'],
          AllowedHeaders: ['Content-Type', 'Content-Length'],
          MaxAgeSeconds: 86400,
        }],
      },
    }));
  } catch (e) {
    console.warn('R2 CORS setup skipped (may need manual config):', e);
  }
  corsReady = true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  if (!verifyAnyToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { filename, folder, contentType } = req.body || {};

    if (!filename) {
      return res.status(400).json({ error: 'Falta el nombre del archivo' });
    }

    const ct = (contentType || 'application/octet-stream').toLowerCase();
    if (!ALLOWED_MIMES.includes(ct)) {
      return res.status(400).json({ error: 'Tipo de archivo no permitido' });
    }

    await ensureR2Cors();

    const safeFolder = (folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${safeFolder}/${Date.now()}-${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: ct,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

    return res.status(200).json({ uploadUrl, publicUrl: `${R2_PUBLIC_BASE}/${key}` });
  } catch (error: any) {
    console.error('Presign error:', error);
    return res.status(500).json({ error: 'Error generando URL de subida' });
  }
}
