import type { VercelRequest, VercelResponse } from '@vercel/node';
import NodeID3 from 'node-id3';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

function sanitizeTag(s: string, max = 200): string {
  return s ? s.replace(/[\x00-\x1F\x7F]/g, '').trim().substring(0, max) : '';
}
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}
function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Filename, X-Folder'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { trackId, fileUrl: legacyFileUrl, session_id } = req.query as Record<string, string>;
    const { title, artist, authors, coverUrl, genre, bpm } = req.query as Record<string, string>;

    if (!session_id) {
      return res.status(403).json({ error: 'Falta verificación de pago' });
    }

    // Resolve fileUrl: either from trackId (normal users) or legacy fileUrl (admin)
    let fileUrl = '';

    if (trackId) {
      // Look up track in database by ID
      const tracks = await redis.get('tracks') as any[] | null;
      const track = tracks?.find((t: any) => t.id === trackId);
      if (!track || !track.fileUrl) {
        return res.status(404).json({ error: 'Track no encontrado' });
      }

      // Admin downloads: verify admin token
      if (session_id === 'admin') {
        if (!verifyAdminToken(req.headers.authorization as string | undefined)) {
          return res.status(403).json({ error: 'No autorizado' });
        }
        // Admin can download anything — skip payment verification
      }
      // For free downloads: verify track is actually free
      else if (session_id === 'free' && track.price > 0) {
        return res.status(403).json({ error: 'Este track requiere pago' });
      }
      // For paid downloads: verify Stripe session and that this track was purchased
      else if (session_id !== 'free') {
        try {
          const session = await stripe.checkout.sessions.retrieve(session_id);
          if (session.payment_status !== 'paid') {
            return res.status(403).json({ error: 'Pago no confirmado' });
          }
          const purchasedIds = session.metadata?.track_ids?.split(',') || [];
          if (!purchasedIds.includes(trackId)) {
            // Check if this track belongs to a pack where another track was purchased
            const allTracks = await redis.get('tracks') as any[] | null;
            const thisTrack = allTracks?.find((t: any) => t.id === trackId);
            const isPackMember = thisTrack?.packId && allTracks?.some((t: any) => t.packId === thisTrack.packId && purchasedIds.includes(t.id));
            if (!isPackMember) {
              return res.status(403).json({ error: 'Track no incluido en esta compra' });
            }
          }
        } catch {
          return res.status(403).json({ error: 'Sesión de pago no válida' });
        }
      }

      fileUrl = track.fileUrl;
    } else if (legacyFileUrl) {
      // Legacy: admin passes fileUrl directly
      if (!verifyAdminToken(req.headers.authorization as string | undefined)) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      fileUrl = legacyFileUrl;
    } else {
      return res.status(400).json({ error: 'Falta trackId' });
    }

    // Only serve files from Vercel Blob storage
    if (!fileUrl.includes('.vercel-storage.com') && !fileUrl.includes('.public.blob.vercel-storage.com')) {
      return res.status(400).json({ error: 'URL de archivo no válida' });
    }

    // Fetch the original file
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      return res.status(502).json({ error: 'No se pudo descargar el archivo' });
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // Only add ID3 tags to MP3 files
    const isMP3 = fileUrl.toLowerCase().includes('.mp3');
    if (isMP3) {
      const tags: NodeID3.Tags = {
        title: sanitizeTag(title || ''),
        artist: authors ? sanitizeTag(authors) : sanitizeTag(artist || ''),
        performerInfo: sanitizeTag(artist || ''),
        album: 'MusicDrop',
        genre: sanitizeTag(genre || '', 100),
        year: new Date().getFullYear().toString(),
        comment: { language: 'spa', text: 'musicdrop.es' },
      };

      if (bpm && /^\d{1,3}$/.test(bpm) && Number(bpm) > 0 && Number(bpm) < 999) {
        tags.bpm = bpm;
      }

      if (coverUrl && !coverUrl.startsWith('data:')) {
        try {
          if (coverUrl.includes('.vercel-storage.com') || coverUrl.includes('.public.blob.vercel-storage.com')) {
            const coverRes = await fetch(coverUrl);
            if (coverRes.ok) {
              const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
              const contentType = coverRes.headers.get('content-type') || 'image/jpeg';
              const mime = contentType.includes('png') ? 'image/png' : 'image/jpeg';
              tags.image = { mime, type: { id: 3, name: 'front cover' }, description: 'Cover', imageBuffer: coverBuffer };
            }
          }
        } catch {}
      } else if (coverUrl && coverUrl.startsWith('data:')) {
        try {
          const matches = coverUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (matches) {
            tags.image = { mime: matches[1] as 'image/jpeg' | 'image/png', type: { id: 3, name: 'front cover' }, description: 'Cover', imageBuffer: Buffer.from(matches[2], 'base64') };
          }
        } catch {}
      }

      const tagged = NodeID3.write(tags, buffer);
      if (tagged && Buffer.isBuffer(tagged)) {
        buffer = tagged;
      }
    }

    const fileName = authors ? `${authors} - ${title || 'track'}` : (title || 'track');
    const ext = fileUrl.split('.').pop()?.split('?')[0] || 'mp3';

    res.setHeader('Content-Type', isMP3 ? 'audio/mpeg' : 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}.${ext}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.send(buffer);
  } catch (error: any) {
    console.error('Download error:', error);
    return res.status(500).json({ error: 'Error al descargar archivo' });
  }
}
