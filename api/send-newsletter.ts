import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { Redis } from '@upstash/redis';
import Stripe from 'stripe';
import crypto from 'crypto';

function escapeHtml(s: string): string { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

const TOKEN_MAX_AGE=24*60*60*1000;
function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}
function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

const resend = new Resend(process.env.RESEND_API_KEY || '');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const redis = new Redis({ url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '' });

const FREE_ORDERS_KEY = 'free-orders';

const LOGO_URL = 'https://zuct57sgk5d1hhzr.public.blob.vercel-storage.com/logo/360djacademy-logo-HHE18DFGmGmD6hSP9jtuyiSUTarGeE.png';
const catLabels: Record<string, string> = { remixes: 'Remix', mashups: 'Mashup', hypeintros: 'Hype Intro', transiciones: 'Transicion', sesiones: 'Sesion', originales: 'Original', packs: 'Pack' };
const catColors: Record<string, string> = { remixes: '#a855f7', mashups: '#facc15', hypeintros: '#f472b6', transiciones: '#22d3ee', sesiones: '#34d399', originales: '#fb923c', packs: '#60a5fa' };

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!verifyAdminToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { emails: clientEmails, trackIds: selectedTrackIds } = req.body || {};

    // 1. Get tracks
    const allTracks = await redis.get('tracks') as any[] | null;
    if (!allTracks) return res.status(500).json({ error: 'No tracks' });

    // Use selected tracks if provided, otherwise last 7 days
    let recentTracks: any[];
    if (Array.isArray(selectedTrackIds) && selectedTrackIds.length > 0) {
      const idSet = new Set(selectedTrackIds);
      recentTracks = allTracks.filter((t: any) => idSet.has(t.id));
    } else {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      recentTracks = allTracks.filter((t: any) => new Date(t.releaseDate).getTime() >= sevenDaysAgo);
    }

    if (recentTracks.length === 0) {
      return res.status(400).json({ error: 'No hay tracks seleccionados' });
    }

    // Group packs
    type DisplayItem = { type: 'track'; track: any } | { type: 'pack'; packName: string; tracks: any[]; price: number; category: string };
    const seen = new Set<string>();
    const items: DisplayItem[] = [];
    for (const t of recentTracks) {
      if (t.packId) {
        if (seen.has(t.packId)) continue;
        seen.add(t.packId);
        const pt = recentTracks.filter((x: any) => x.packId === t.packId);
        items.push({ type: 'pack', packName: t.packName || 'Pack', tracks: pt, price: pt.reduce((s: number, x: any) => s + x.price, 0), category: t.category });
      } else {
        items.push({ type: 'track', track: t });
      }
    }

    // 2. Build track rows HTML with real cover art
    function coverImg(url: string, color: string) {
      if (url && url.includes('.vercel-storage.com')) {
        return `<img src="${url}" alt="" style="width: 48px; height: 48px; border-radius: 10px; object-fit: cover; flex-shrink: 0;" />`;
      }
      return `<div style="width: 48px; height: 48px; background: linear-gradient(135deg, ${color}, ${color}88); border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;"><span style="font-size: 22px;">&#9835;</span></div>`;
    }

    const trackRows = items.map(item => {
      if (item.type === 'pack') {
        const color = catColors[item.category] || '#facc15';
        const priceStr = item.price > 0 ? `${item.price.toFixed(2)} &euro;` : 'FREE';
        const badge = item.price > 0 ? `<span style="background: rgba(250,204,21,0.1); color: #facc15; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">NEW</span>` : `<span style="background: rgba(34,197,94,0.1); color: #22c55e; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">FREE</span>`;
        const cover = item.tracks[0]?.coverUrl || '';
        return `<div style="display: flex; align-items: center; background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px;">
          ${coverImg(cover, color)}
          <div style="margin-left: 14px; flex: 1;">
            <p style="color: #e4e4e7; font-size: 14px; font-weight: 600; margin: 0 0 3px;">${escapeHtml(item.packName)}</p>
            <p style="color: #71717a; font-size: 12px; margin: 0;">Pack &middot; ${item.tracks.length} tracks &middot; ${priceStr}</p>
          </div>
          <div style="flex-shrink: 0; margin-left: 12px;">${badge}</div>
        </div>`;
      }
      const t = item.track;
      const color = catColors[t.category] || '#facc15';
      const label = catLabels[t.category] || t.category;
      const priceStr = t.price > 0 ? `${t.price.toFixed(2)} &euro;` : 'FREE';
      const bpmStr = t.bpm > 0 ? ` &middot; ${t.bpm} BPM` : '';
      const badge = t.price > 0 ? `<span style="background: rgba(250,204,21,0.1); color: #facc15; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">NEW</span>` : `<span style="background: rgba(34,197,94,0.1); color: #22c55e; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">FREE</span>`;
      return `<div style="display: flex; align-items: center; background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px;">
        ${coverImg(t.coverUrl || '', color)}
        <div style="margin-left: 14px; flex: 1;">
          <p style="color: #e4e4e7; font-size: 14px; font-weight: 600; margin: 0 0 3px;">${escapeHtml(t.title)}</p>
          <p style="color: #71717a; font-size: 12px; margin: 0;">${label}${bpmStr} &middot; ${priceStr}</p>
        </div>
        <div style="flex-shrink: 0; margin-left: 12px;">${badge}</div>
      </div>`;
    }).join('');

    // 3. Build full email HTML
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="background-color: #0a0a0a; border-radius: 20px; overflow: hidden; border: 1px solid #1a1a1a;">
          <div style="background: linear-gradient(135deg, #1a1400 0%, #0a0a0a 50%, #0a0a0a 100%); padding: 40px 32px 24px; text-align: center;">
            <img src="${LOGO_URL}" alt="360 DJ Academy" style="width: 120px; height: auto; margin: 0 auto 12px; display: block;" />
            <h1 style="color: #fafafa; font-size: 22px; margin: 0 0 4px; font-weight: 700; letter-spacing: 1px;">MUSIC <span style="background: linear-gradient(135deg, #facc15, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">DROP</span></h1>
          </div>
          <div style="padding: 32px 32px 24px; text-align: center;">
            <h2 style="color: #fafafa; font-size: 26px; margin: 0 0 10px; font-weight: 700; line-height: 1.2;">Nuevos Drops Disponibles</h2>
            <p style="color: #a1a1aa; font-size: 15px; margin: 0; line-height: 1.5;">Hemos subido ${items.length} ${items.length === 1 ? 'novedad' : 'novedades'} a la tienda. Echa un vistazo.</p>
          </div>
          <div style="padding: 0 32px;"><div style="height: 1px; background: linear-gradient(to right, transparent, #2a2a2a, transparent);"></div></div>
          <div style="padding: 24px 32px;">
            <p style="color: #71717a; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 16px; font-weight: 600;">Lo nuevo</p>
            ${trackRows}
          </div>
          <div style="padding: 8px 32px 32px; text-align: center;">
            <a href="https://musicdrop.es" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #facc15, #f59e0b); color: #000; font-weight: 800; text-decoration: none; border-radius: 14px; font-size: 15px; letter-spacing: 0.5px;">Ver novedades en la tienda</a>
          </div>
          <div style="padding: 0 32px;"><div style="height: 1px; background: linear-gradient(to right, transparent, #1e1e1e, transparent);"></div></div>
          <div style="padding: 24px 32px; text-align: center;">
            <p style="color: #71717a; font-size: 12px; margin: 0 0 8px;">Anade 3 o mas tracks al carrito y usa este codigo:</p>
            <div style="display: inline-block; background: rgba(250,204,21,0.08); border: 1px dashed rgba(250,204,21,0.3); border-radius: 8px; padding: 8px 24px;">
              <span style="color: #facc15; font-size: 18px; font-weight: 800; letter-spacing: 3px;">DROPS20</span>
            </div>
            <p style="color: #52525b; font-size: 11px; margin: 8px 0 0;">20% de descuento en pedidos de 3+ tracks</p>
          </div>
          <div style="padding: 20px 32px 28px; text-align: center; background: #080808;">
            <p style="color: #3f3f46; font-size: 11px; margin: 0 0 6px;">Music Drop by 360DJAcademy &middot; <a href="https://musicdrop.es" style="color: #52525b; text-decoration: none;">musicdrop.es</a></p>
            <p style="color: #27272a; font-size: 10px; margin: 0;">Recibes este email porque descargaste o compraste en Music Drop.</p>
          </div>
        </div>
      </div>
    </body></html>`;

    // 4. Collect unique emails from orders (Stripe + free)
    const emails = new Set<string>();

    // Stripe paid orders
    try {
      const sessions = await stripe.checkout.sessions.list({ limit: 100 });
      for (const s of sessions.data) {
        if (s.payment_status === 'paid' && s.customer_details?.email) {
          emails.add(s.customer_details.email.toLowerCase().trim());
        }
      }
    } catch {}

    // Free orders
    const rawFree = await redis.get(FREE_ORDERS_KEY);
    const freeOrders = Array.isArray(rawFree) ? rawFree : [];
    for (const fo of freeOrders) {
      if (fo.email && fo.email.includes('@')) {
        emails.add(fo.email.toLowerCase().trim());
      }
    }

    if (emails.size === 0) {
      return res.status(400).json({ error: 'No hay emails de suscriptores' });
    }

    // 5. Filter to only selected emails if provided
    let emailList = Array.from(emails);
    if (Array.isArray(clientEmails) && clientEmails.length > 0) {
      const selected = new Set(clientEmails.map((e: string) => e.toLowerCase().trim()));
      emailList = emailList.filter(e => selected.has(e));
    }

    if (emailList.length === 0) {
      return res.status(400).json({ error: 'Ningun email seleccionado encontrado' });
    }
    let sent = 0;
    let errors = 0;

    // Send individually to avoid Resend batch limits
    for (const to of emailList) {
      try {
        await resend.emails.send({
          from: 'MusicDrop <onboarding@resend.dev>',
          to,
          subject: `Novedades en MusicDrop — ${items.length} nuevos drops`,
          html,
        });
        sent++;
      } catch {
        errors++;
      }
    }

    return res.status(200).json({ ok: true, sent, errors, totalEmails: emailList.length, newTracks: items.length });
  } catch (error: any) {
    console.error('Newsletter error:', error);
    return res.status(500).json({ error: error.message || 'Error al enviar newsletter' });
  }
}
