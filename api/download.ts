import type { VercelRequest, VercelResponse } from '@vercel/node';
import NodeID3 from 'node-id3';
import Stripe from 'stripe';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}
function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','http://localhost:3000'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Filename, X-Folder'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
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
    const { fileUrl, title, artist, authors, coverUrl, genre, bpm, session_id } = req.query as Record<string, string>;

    if (!fileUrl) {
      return res.status(400).json({ error: 'Falta fileUrl' });
    }

    // Only serve files from Vercel Blob storage
    if (!fileUrl.includes('.vercel-storage.com') && !fileUrl.includes('.public.blob.vercel-storage.com')) {
      return res.status(400).json({ error: 'URL de archivo no válida' });
    }

    // Verify Stripe payment — session_id is required
    if (!session_id) {
      return res.status(403).json({ error: 'Falta verificación de pago' });
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== 'paid') {
        return res.status(403).json({ error: 'Pago no confirmado' });
      }
    } catch {
      return res.status(403).json({ error: 'Sesión de pago no válida' });
    }

    // Fetch the original MP3 file
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      return res.status(502).json({ error: 'No se pudo descargar el archivo' });
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // Only add ID3 tags to MP3 files
    const isMP3 = fileUrl.toLowerCase().includes('.mp3');
    if (isMP3) {
      // Build ID3 tags
      const tags: NodeID3.Tags = {
        title: title || '',
        artist: authors ? `${authors}` : (artist || ''),
        performerInfo: artist || '',
        album: artist ? `${artist} Drops` : 'Alex Selas Drops',
        genre: genre || '',
        year: new Date().getFullYear().toString(),
        comment: { language: 'spa', text: 'alexselasdrops.com' },
      };

      // Add BPM if available
      if (bpm && Number(bpm) > 0) {
        tags.bpm = bpm;
      }

      // Fetch and embed cover art
      if (coverUrl && !coverUrl.startsWith('data:')) {
        try {
          // Only fetch covers from Vercel Blob storage
          if (coverUrl.includes('.vercel-storage.com') || coverUrl.includes('.public.blob.vercel-storage.com')) {
            const coverRes = await fetch(coverUrl);
            if (coverRes.ok) {
              const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
              const contentType = coverRes.headers.get('content-type') || 'image/jpeg';
              const mime = contentType.includes('png') ? 'image/png' : 'image/jpeg';
              tags.image = {
                mime,
                type: { id: 3, name: 'front cover' },
                description: 'Cover',
                imageBuffer: coverBuffer,
              };
            }
          }
        } catch {
          // Skip cover if fetch fails
        }
      } else if (coverUrl && coverUrl.startsWith('data:')) {
        // Handle base64 cover
        try {
          const matches = coverUrl.match(/^data:(image\/\w+);base64,(.+)$/);
          if (matches) {
            tags.image = {
              mime: matches[1] as 'image/jpeg' | 'image/png',
              type: { id: 3, name: 'front cover' },
              description: 'Cover',
              imageBuffer: Buffer.from(matches[2], 'base64'),
            };
          }
        } catch {
          // Skip
        }
      }

      // Write ID3 tags to buffer
      const tagged = NodeID3.write(tags, buffer);
      if (tagged && Buffer.isBuffer(tagged)) {
        buffer = tagged;
      }
    }

    // Build filename
    const fileName = authors
      ? `${authors} - ${title || 'track'}`
      : (title || 'track');
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
