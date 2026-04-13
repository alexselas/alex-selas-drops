import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { verifyAdminToken, corsHeaders } from './lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.body as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req as any,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Admin auth required — check from Authorization header or clientPayload
        let authorized = verifyAdminToken(req.headers.authorization);
        if (!authorized && clientPayload) {
          try {
            const payload = JSON.parse(clientPayload);
            authorized = verifyAdminToken(`Bearer ${payload.token}`);
          } catch {}
        }
        if (!authorized) {
          throw new Error('No autorizado');
        }

        return {
          allowedContentTypes: [
            'image/jpeg', 'image/png', 'image/webp',
            'audio/mpeg', 'audio/mp3',
            'application/zip', 'application/octet-stream',
          ],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500MB max
        };
      },
      onUploadCompleted: async () => {},
    });

    return res.status(200).json(jsonResponse);
  } catch (error: any) {
    console.error('Upload-url error:', error);
    const msg = error.message === 'No autorizado' ? 'No autorizado' : 'Error al generar token de subida';
    const status = error.message === 'No autorizado' ? 401 : 400;
    return res.status(status).json({ error: msg });
  }
}
