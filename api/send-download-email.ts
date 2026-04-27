import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';

function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

const resend = new Resend(process.env.RESEND_API_KEY || '');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const redis = new Redis({ url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '' });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, sessionId, trackIds } = req.body;

    if (!email || !sessionId) {
      return res.status(400).json({ error: 'Faltan email o sessionId' });
    }

    // Verify Stripe session
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        return res.status(403).json({ error: 'Pago no confirmado' });
      }
    } catch {
      return res.status(403).json({ error: 'Sesion no valida' });
    }

    // Look up tracks from Redis
    const allTracks = await redis.get('tracks') as any[] | null;
    if (!allTracks) return res.status(500).json({ error: 'Error cargando tracks' });

    // Get the track IDs to include — from request or from session metadata
    const ids: string[] = Array.isArray(trackIds) ? trackIds : (session.metadata?.track_ids?.split(',').filter(Boolean) || []);

    const tracks = ids.map(id => allTracks.find((t: any) => t.id === id)).filter((t: any) => t && t.fileUrl);
    if (tracks.length === 0) return res.status(400).json({ error: 'No tracks encontrados' });

    // Validate fileUrls
    for (const t of tracks) {
      if (!t.fileUrl.includes('.vercel-storage.com') && !t.fileUrl.includes('.public.blob.vercel-storage.com')) {
        return res.status(400).json({ error: 'URL de archivo no valida' });
      }
    }

    const trackRows = tracks.map((t: any) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #2a2a2a;">
          <span style="color: #e4e4e7; font-weight: 600;">${t.title}</span>
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #2a2a2a; text-align: right;">
          <a href="${t.fileUrl}" style="display: inline-block; padding: 8px 20px; background: linear-gradient(135deg, #facc15, #f59e0b); color: #000; font-weight: 700; text-decoration: none; border-radius: 10px; font-size: 13px;">Descargar MP3</a>
        </td>
      </tr>`).join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 520px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #fafafa; font-size: 24px; margin: 0; letter-spacing: -0.5px;">
            MUSIC <span style="background: linear-gradient(135deg, #facc15, #f59e0b); color: #000; padding: 2px 10px; border-radius: 6px; font-size: 14px; vertical-align: middle; margin-left: 6px;">DROP</span>
          </h1>
          <p style="color: #52525b; font-size: 11px; margin: 6px 0 0; letter-spacing: 2px;">by 360DJAcademy</p>
        </div>
        <div style="background-color: #141414; border: 1px solid #262626; border-radius: 16px; overflow: hidden;">
          <div style="padding: 28px 24px; text-align: center; border-bottom: 1px solid #262626;">
            <div style="width: 56px; height: 56px; background: rgba(34,197,94,0.15); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 28px;">&#10003;</span>
            </div>
            <h2 style="color: #fafafa; font-size: 20px; margin: 0 0 8px;">Pago completado</h2>
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">Gracias por tu compra. Aqui tienes tus descargas.</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            ${trackRows}
          </table>
          <div style="padding: 20px 24px; text-align: center;">
            <p style="color: #71717a; font-size: 12px; margin: 0;">MP3 320kbps · Los links de descarga son permanentes</p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <p style="color: #52525b; font-size: 12px; margin: 0;">MusicDrop by 360DJAcademy · musicdrop.es</p>
        </div>
      </div>
    </body>
    </html>`;

    const { error } = await resend.emails.send({
      from: 'MusicDrop <onboarding@resend.dev>',
      to: email,
      subject: `Tu compra en MusicDrop — ${tracks.length} track${tracks.length > 1 ? 's' : ''}`,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Error al enviar email' });
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('Email error:', error);
    return res.status(500).json({ error: error.message || 'Error interno' });
  }
}
