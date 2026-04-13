import type { VercelRequest, VercelResponse } from '@vercel/node';
import { del } from '@vercel/blob';
import { verifyAdminToken, corsHeaders } from './lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // Admin auth required — only admin can delete files
  if (!verifyAdminToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Falta la URL del archivo' });
    }

    // Only allow deleting Vercel Blob URLs
    if (!url.includes('.vercel-storage.com') && !url.includes('.public.blob.vercel-storage.com')) {
      return res.status(400).json({ error: 'URL no válida' });
    }

    await del(url);
    return res.status(200).json({ deleted: true });
  } catch (error: any) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Error al eliminar archivo' });
  }
}
