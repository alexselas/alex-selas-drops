import type { VercelRequest, VercelResponse } from '@vercel/node';
import NodeID3 from 'node-id3';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import archiver from 'archiver';
import crypto from 'crypto';

function sanitizeTag(s: string, max = 200): string {
  return s ? s.replace(/[\x00-\x1F\x7F]/g, '').trim().substring(0, max) : '';
}

const TOKEN_MAX_AGE=24*60*60*1000;
function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}

function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const redis = new Redis({ url: process.env.KV_REST_API_URL || '', token: process.env.KV_REST_API_TOKEN || '' });

export const config = { api: { responseLimit: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { trackIds, sessionId } = req.body;
    if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0 || !sessionId) {
      return res.status(400).json({ error: 'Missing trackIds or sessionId' });
    }

    // Auth check
    const isAdmin = sessionId === 'admin' && verifyAdminToken(req.headers.authorization as string | undefined);
    const isFree = sessionId === 'free';

    // Get all tracks from Redis
    const allTracks = await redis.get('tracks') as any[] | null;
    if (!allTracks) return res.status(500).json({ error: 'No tracks found' });

    // Verify purchase if not admin
    let purchasedIds: string[] = [];
    if (!isAdmin && !isFree) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
          return res.status(403).json({ error: 'Pago no confirmado' });
        }
        purchasedIds = session.metadata?.track_ids?.split(',') || [];
      } catch {
        return res.status(403).json({ error: 'Sesion no valida' });
      }
    }

    // Resolve tracks
    const tracksToDownload = trackIds.map((id: string) => allTracks.find((t: any) => t.id === id)).filter(Boolean);
    if (tracksToDownload.length === 0) return res.status(404).json({ error: 'No tracks found' });

    // Verify each track is authorized
    for (const track of tracksToDownload) {
      if (isAdmin) continue;
      if (isFree && track.price > 0) return res.status(403).json({ error: `Track ${track.title} requiere pago` });
      if (!isFree && !purchasedIds.includes(track.id)) {
        // Check pack membership
        const isPackMember = track.packId && allTracks.some((t: any) => t.packId === track.packId && purchasedIds.includes(t.id));
        if (!isPackMember) return res.status(403).json({ error: `Track ${track.title} no incluido en esta compra` });
      }
    }

    // Determine ZIP filename
    const firstTrack = tracksToDownload[0];
    const zipName = firstTrack.packName || 'MusicDrop';

    // Set response headers for ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}.zip"`);

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 1 } }); // level 1 = fast (MP3s are already compressed)
    archive.pipe(res as any);

    // Download each track, add ID3 tags, add to ZIP
    for (const track of tracksToDownload) {
      if (!track.fileUrl) continue;

      try {
        const fileRes = await fetch(track.fileUrl);
        if (!fileRes.ok) continue;

        let buffer = Buffer.from(await fileRes.arrayBuffer());

        // Add ID3 tags
        if (track.fileUrl.toLowerCase().includes('.mp3')) {
          const tags: NodeID3.Tags = {
            title: sanitizeTag(track.title || ''),
            artist: track.authors ? sanitizeTag(track.authors) : sanitizeTag(track.artist || ''),
            performerInfo: sanitizeTag(track.artist || ''),
            album: 'MusicDrop',
            genre: sanitizeTag(track.genre || '', 100),
            year: new Date().getFullYear().toString(),
            comment: { language: 'spa', text: 'musicdrop.es' },
          };
          if (track.bpm && Number(track.bpm) > 0 && Number(track.bpm) < 999) {
            tags.bpm = String(track.bpm);
          }
          // Cover art
          if (track.coverUrl && !track.coverUrl.startsWith('data:') && (track.coverUrl.includes('.vercel-storage.com') || track.coverUrl.includes('.public.blob.vercel-storage.com'))) {
            try {
              const coverRes = await fetch(track.coverUrl);
              if (coverRes.ok) {
                const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
                const ct = coverRes.headers.get('content-type') || 'image/jpeg';
                tags.image = { mime: ct.includes('png') ? 'image/png' : 'image/jpeg', type: { id: 3, name: 'front cover' }, description: 'Cover', imageBuffer: coverBuffer };
              }
            } catch {}
          }
          const tagged = NodeID3.write(tags, buffer);
          if (tagged && Buffer.isBuffer(tagged)) buffer = tagged;
        }

        const fileName = track.authors ? `${track.authors} - ${track.title}.mp3` : `${track.title}.mp3`;
        archive.append(buffer, { name: fileName });
      } catch (e) {
        console.error(`Error processing track ${track.id}:`, e);
      }
    }

    await archive.finalize();
  } catch (error: any) {
    console.error('ZIP download error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error al crear ZIP' });
    }
  }
}
