import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';

function escapeHtml(s: string): string { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

const resend = new Resend(process.env.RESEND_API_KEY || '');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const redis = new Redis({ url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '' });

const LOGO_URL = 'https://zuct57sgk5d1hhzr.public.blob.vercel-storage.com/logo/360djacademy-logo-HHE18DFGmGmD6hSP9jtuyiSUTarGeE.png';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, sessionId, trackIds } = req.body;
    if (!email || !sessionId) return res.status(400).json({ error: 'Faltan email o sessionId' });

    // Verify Stripe session
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') return res.status(403).json({ error: 'Pago no confirmado' });
    } catch {
      return res.status(403).json({ error: 'Sesion no valida' });
    }

    // Look up tracks from Redis
    const allTracks = await redis.get('tracks') as any[] | null;
    if (!allTracks) return res.status(500).json({ error: 'Error cargando tracks' });

    const ids: string[] = Array.isArray(trackIds) ? trackIds : (session.metadata?.track_ids?.split(',').filter(Boolean) || []);
    const tracks = ids.map(id => allTracks.find((t: any) => t.id === id)).filter((t: any) => t && t.fileUrl);
    if (tracks.length === 0) return res.status(400).json({ error: 'No tracks encontrados' });

    for (const t of tracks) {
      if (!t.fileUrl.includes('.vercel-storage.com') && !t.fileUrl.includes('.public.blob.vercel-storage.com')) {
        return res.status(400).json({ error: 'URL de archivo no valida' });
      }
    }

    // Build track rows with cover art
    const trackRows = tracks.map((t: any) => {
      const cover = (t.coverUrl && t.coverUrl.includes('.vercel-storage.com'))
        ? `<img src="${t.coverUrl}" alt="" style="width: 48px; height: 48px; border-radius: 10px; object-fit: cover;" />`
        : `<div style="width: 48px; height: 48px; background: linear-gradient(135deg, #facc15, #f59e0b88); border-radius: 10px; display: flex; align-items: center; justify-content: center;"><span style="font-size: 22px;">&#9835;</span></div>`;

      return `<div style="display: flex; align-items: center; background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px;">
        ${cover}
        <div style="margin-left: 14px; flex: 1;">
          <p style="color: #e4e4e7; font-size: 14px; font-weight: 600; margin: 0 0 3px;">${escapeHtml(t.title)}</p>
          <p style="color: #71717a; font-size: 12px; margin: 0;">${escapeHtml(t.artist || '')}${t.bpm > 0 ? ` &middot; ${t.bpm} BPM` : ''} &middot; MP3 320kbps</p>
        </div>
        <div style="flex-shrink: 0; margin-left: 12px;">
          <a href="https://musicdrop.es/api/download?trackId=${t.id}&session_id=${sessionId}&title=${encodeURIComponent(t.title || '')}&artist=${encodeURIComponent(t.artist || '')}&authors=${encodeURIComponent(t.authors || '')}&genre=${encodeURIComponent(t.genre || '')}&bpm=${t.bpm || 0}&coverUrl=${encodeURIComponent(t.coverUrl || '')}" style="display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, #facc15, #f59e0b); color: #000; font-weight: 700; text-decoration: none; border-radius: 10px; font-size: 12px;">Descargar</a>
        </div>
      </div>`;
    }).join('');

    const totalAmount = (session.amount_total || 0) / 100;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="background-color: #0a0a0a; border-radius: 20px; overflow: hidden; border: 1px solid #1a1a1a;">

          <!-- HEADER -->
          <div style="background: linear-gradient(135deg, #1a1400 0%, #0a0a0a 50%, #0a0a0a 100%); padding: 40px 32px 24px; text-align: center;">
            <img src="${LOGO_URL}" alt="360 DJ Academy" style="width: 120px; height: auto; margin: 0 auto 12px; display: block;" />
            <h1 style="color: #fafafa; font-size: 22px; margin: 0 0 4px; font-weight: 700; letter-spacing: 1px;">MUSIC <span style="background: linear-gradient(135deg, #facc15, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">DROP</span></h1>
          </div>

          <!-- HERO -->
          <div style="padding: 32px 32px 24px; text-align: center;">
            <h2 style="color: #fafafa; font-size: 26px; margin: 0 0 10px; font-weight: 700;">Pago completado</h2>
            <p style="color: #a1a1aa; font-size: 15px; margin: 0; line-height: 1.5;">Gracias por tu compra. Aqui tienes tus descargas.</p>
            ${totalAmount > 0 ? `<p style="color: #facc15; font-size: 20px; font-weight: 700; margin: 12px 0 0;">${totalAmount.toFixed(2)} &euro;</p>` : ''}
          </div>

          <!-- SEPARATOR -->
          <div style="padding: 0 32px;"><div style="height: 1px; background: linear-gradient(to right, transparent, #2a2a2a, transparent);"></div></div>

          <!-- TRACKS -->
          <div style="padding: 24px 32px;">
            <p style="color: #71717a; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 16px; font-weight: 600;">Tus descargas</p>
            ${trackRows}
          </div>

          <!-- INFO -->
          <div style="padding: 0 32px 24px; text-align: center;">
            <p style="color: #71717a; font-size: 12px; margin: 0;">MP3 320kbps &middot; Los links de descarga son permanentes</p>
          </div>

          <!-- SEPARATOR -->
          <div style="padding: 0 32px;"><div style="height: 1px; background: linear-gradient(to right, transparent, #1e1e1e, transparent);"></div></div>

          <!-- CTA -->
          <div style="padding: 24px 32px; text-align: center;">
            <a href="https://musicdrop.es" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #facc15, #f59e0b); color: #000; font-weight: 800; text-decoration: none; border-radius: 14px; font-size: 14px;">Explorar mas tracks</a>
          </div>

          <!-- PROMO -->
          <div style="padding: 16px 32px 24px; text-align: center;">
            <p style="color: #71717a; font-size: 12px; margin: 0 0 8px;">Anade 3 o mas tracks y usa este codigo:</p>
            <div style="display: inline-block; background: rgba(250,204,21,0.08); border: 1px dashed rgba(250,204,21,0.3); border-radius: 8px; padding: 8px 24px;">
              <span style="color: #facc15; font-size: 18px; font-weight: 800; letter-spacing: 3px;">DROPS20</span>
            </div>
            <p style="color: #52525b; font-size: 11px; margin: 8px 0 0;">20% de descuento en pedidos de 3+ tracks</p>
          </div>

          <!-- FOOTER -->
          <div style="padding: 20px 32px 28px; text-align: center; background: #080808;">
            <p style="color: #3f3f46; font-size: 11px; margin: 0 0 6px;">Music Drop by 360DJAcademy &middot; <a href="https://musicdrop.es" style="color: #52525b; text-decoration: none;">musicdrop.es</a></p>
            <p style="color: #27272a; font-size: 10px; margin: 0;">Recibes este email porque compraste en Music Drop.</p>
          </div>

        </div>
      </div>
    </body></html>`;

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
