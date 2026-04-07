import type { VercelRequest, VercelResponse } from '@vercel/node';
import { del } from '@vercel/blob';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Falta la URL del archivo' });
    }

    await del(url);
    return res.status(200).json({ deleted: true });
  } catch (error: any) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: error.message || 'Error al eliminar archivo' });
  }
}
