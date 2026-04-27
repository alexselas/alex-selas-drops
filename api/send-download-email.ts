import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import Stripe from 'stripe';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}
function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Filename, X-Folder'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}


const resend = new Resend(process.env.RESEND_API_KEY || '');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');


interface TrackInfo {
  title: string;
  fileUrl: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, tracks, sessionId } = req.body as {
      email: string;
      tracks: TrackInfo[];
      sessionId?: string;
    };

    if (!email || !tracks?.length) {
      return res.status(400).json({ error: 'Faltan email o tracks' });
    }

    // Verify Stripe payment session — only send download emails after confirmed payment
    if (!sessionId) {
      return res.status(400).json({ error: 'Falta session_id de pago' });
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        return res.status(403).json({ error: 'Pago no confirmado' });
      }
      // Verify the email matches the payment session
      if (session.customer_details?.email && session.customer_details.email !== email) {
        return res.status(403).json({ error: 'Email no coincide con el pago' });
      }
    } catch {
      return res.status(403).json({ error: 'Sesión de pago no válida' });
    }

    // Validate that all file URLs point to Vercel Blob storage
    for (const t of tracks) {
      if (!t.fileUrl.includes('.vercel-storage.com') && !t.fileUrl.includes('.public.blob.vercel-storage.com')) {
        return res.status(400).json({ error: 'URL de archivo no válida' });
      }
    }

    const trackRows = tracks
      .map(
        (t) => `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #2a2a2a;">
            <span style="color: #e4e4e7; font-weight: 600;">${t.title}</span>
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #2a2a2a; text-align: right;">
            <a href="${t.fileUrl}" style="display: inline-block; padding: 8px 20px; background: linear-gradient(135deg, #facc15, #f59e0b); color: #000; font-weight: 700; text-decoration: none; border-radius: 10px; font-size: 13px;">Descargar MP3</a>
          </td>
        </tr>`
      )
      .join('');

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
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">Gracias por tu compra. Aquí tienes tus descargas.</p>
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

    const { data, error } = await resend.emails.send({
      from: 'MusicDrop <onboarding@resend.dev>',
      to: email,
      subject: `Tu compra en MusicDrop — ${tracks.length} track${tracks.length > 1 ? 's' : ''}`,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Error al enviar email' });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (error: any) {
    console.error('Email error:', error);
    return res.status(500).json({ error: 'Error al enviar email' });
  }
}
