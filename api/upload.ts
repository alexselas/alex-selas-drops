import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}function verifyCollabToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7);if(!t.startsWith('collab.'))return false;const s=process.env.ADMIN_SECRET||'';const p=t.split('.');if(p.length!==4)return false;const[,cid,ts,hm]=p;if(!cid||!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const py=`collab.${cid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}function verifyAnyToken(h:string|undefined):boolean{return verifyAdminToken(h)||verifyCollabToken(h);}function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Filename, X-Folder'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

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

export const config = {
  api: {
    bodyParser: false, // Required for file uploads
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // Admin or collaborator auth required
  if (!verifyAnyToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const filename = req.headers['x-filename'] as string;
    const folder = (req.headers['x-folder'] as string) || 'uploads';

    if (!filename) {
      return res.status(400).json({ error: 'Falta el nombre del archivo (header X-Filename)' });
    }

    // Validate content-type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/x-m4a', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/x-flac', 'application/zip', 'application/octet-stream'];
    const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (contentType && !allowedMimes.includes(contentType)) {
      return res.status(400).json({ error: 'Tipo de archivo no permitido' });
    }

    // Sanitize folder name to prevent path traversal
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const key = `${safeFolder}/${Date.now()}-${safeFilename}`;

    // Collect request body into buffer (max 100MB)
    const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;
    const chunks: Buffer[] = [];
    let totalSize = 0;
    for await (const chunk of req) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      totalSize += buf.length;
      if (totalSize > MAX_UPLOAD_SIZE) {
        return res.status(413).json({ error: 'Archivo demasiado grande (max 100MB)' });
      }
      chunks.push(buf);
    }
    const body = Buffer.concat(chunks);

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    }));

    const url = `${R2_PUBLIC_BASE}/${key}`;

    return res.status(200).json({
      url,
      pathname: key,
    });
  } catch (error: any) {
    console.error('Upload error:', error?.message);
    return res.status(500).json({ error: 'Error al subir archivo' });
  }
}
