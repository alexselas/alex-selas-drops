import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false, // Required for file uploads
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename, X-Folder');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const filename = req.headers['x-filename'] as string;
    const folder = (req.headers['x-folder'] as string) || 'uploads';

    if (!filename) {
      return res.status(400).json({ error: 'Falta el nombre del archivo (header X-Filename)' });
    }

    const path = `${folder}/${Date.now()}-${filename}`;

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
    return res.status(500).json({ error: error.message || 'Error al subir archivo' });
  }
}
