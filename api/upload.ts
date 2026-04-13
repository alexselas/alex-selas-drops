import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { verifyAdminToken, corsHeaders } from './lib/auth';

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

  // Admin auth required — only admin can upload files
  if (!verifyAdminToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const filename = req.headers['x-filename'] as string;
    const folder = (req.headers['x-folder'] as string) || 'uploads';

    if (!filename) {
      return res.status(400).json({ error: 'Falta el nombre del archivo (header X-Filename)' });
    }

    // Sanitize folder name to prevent path traversal
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const path = `${safeFolder}/${Date.now()}-${safeFilename}`;

    const blob = await put(path, req, {
      access: 'public',
      addRandomSuffix: false,
    });

    return res.status(200).json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Error al subir archivo' });
  }
}
