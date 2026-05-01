import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}function verifyCollabToken(h:string|undefined):{valid:boolean;collaboratorId?:string}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('collab.'))return{valid:false};const s=process.env.ADMIN_SECRET||'dev-secret';const p=t.split('.');if(p.length!==4)return{valid:false};const[,cid,ts,hm]=p;if(!cid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return{valid:false};const py=`collab.${cid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true,collaboratorId:cid};}catch{return{valid:false};}}function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Filename, X-Folder'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const KV_KEY = 'tracks';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_BUCKET = 'musicdrop';

function deleteR2File(url: string) {
  if (!url || url.startsWith('/') || url.startsWith('blob:')) return;
  const r2PublicBase = process.env.R2_PUBLIC_URL || '';
  if (!r2PublicBase || !url.startsWith(r2PublicBase)) return;
  const key = url.slice(r2PublicBase.length + 1);
  if (!key) return;
  s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {});
}

function deleteTrackFiles(track: any) {
  if (track.fileUrl) deleteR2File(track.fileUrl);
  if (track.previewUrl) deleteR2File(track.previewUrl);
  // coverUrl is now always the default static image, no need to delete
}

// Credit costs per category
const CREDIT_COSTS: Record<string, number> = {
  extended: 1, mashups: 2, livemashups: 2, hypeintros: 2, transiciones: 2, remixes: 3, sesiones: 5, originales: 0,
};

const demoTracks: any[] = [];

async function getTracks() {
  const tracks = await redis.get(KV_KEY);
  if (!tracks) {
    await redis.set(KV_KEY, demoTracks);
    return demoTracks;
  }
  return tracks as any[];
}

// Strip fileUrl from tracks for public response (only admin sees it)
function stripFileUrls(tracks: any[]) {
  return tracks.map(({ fileUrl, ...rest }) => rest);
}

function validateTrackData(data: any): string | null {
  if (!data || typeof data !== 'object') return 'Datos no válidos';
  if (data.title && (typeof data.title !== 'string' || data.title.length > 200)) return 'Título demasiado largo';
  if (data.artist && (typeof data.artist !== 'string' || data.artist.length > 200)) return 'Artista demasiado largo';
  if (data.authors && (typeof data.authors !== 'string' || data.authors.length > 500)) return 'Autores demasiado largo';
  if (data.description && (typeof data.description !== 'string' || data.description.length > 1000)) return 'Descripción demasiado larga';
  if (data.genre && (typeof data.genre !== 'string' || data.genre.length > 100)) return 'Género demasiado largo';
  if (data.coverUrl && (typeof data.coverUrl !== 'string' || data.coverUrl.length > 2000)) return 'URL demasiado larga';
  if (data.fileUrl && (typeof data.fileUrl !== 'string' || data.fileUrl.length > 2000)) return 'URL demasiado larga';
  if (data.price !== undefined && (typeof data.price !== 'number' || data.price < 0 || data.price > 9999)) return 'Precio no válido';
  if (data.bpm !== undefined && (typeof data.bpm !== 'number' || data.bpm < 0 || data.bpm > 999)) return 'BPM no válido';
  if (data.tags) {
    if (!Array.isArray(data.tags) || data.tags.length > 20) return 'Tags no válidos';
    for (const tag of data.tags) {
      if (typeof tag !== 'string' || tag.length > 50 || tag.includes('<')) return 'Tag no valido';
    }
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — public (but strip fileUrl)
    if (req.method === 'GET') {
      const tracks = await getTracks();
      const isAdmin = verifyAdminToken(req.headers.authorization);
      const collab = verifyCollabToken(req.headers.authorization);
      if (isAdmin) return res.status(200).json(tracks);
      if (collab.valid && collab.collaboratorId) {
        // Collaborators only see fileUrl for their own tracks
        return res.status(200).json(tracks.map((t: any) =>
          t.collaboratorId === collab.collaboratorId ? t : { ...t, fileUrl: undefined }
        ));
      }
      return res.status(200).json(stripFileUrls(tracks));
    }

    // Check admin or collaborator auth
    const isAdmin = verifyAdminToken(req.headers.authorization);
    const collab = verifyCollabToken(req.headers.authorization);

    if (!isAdmin && !collab.valid) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Enforce max 4 featured per group (admin tracks or per collaborator)
    function enforceFeaturedLimit(tracks: any[], newTrack: any) {
      if (!newTrack.featured) return;
      const isCollab = newTrack.collaborator && newTrack.collaboratorId;
      const featured = tracks.filter((t: any) => {
        if (t.id === newTrack.id) return false; // exclude the track being saved
        if (!t.featured) return false;
        if (isCollab) return t.collaboratorId === newTrack.collaboratorId;
        return !t.collaborator;
      });
      // Sort by releaseDate ascending (oldest first)
      featured.sort((a: any, b: any) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());
      // Remove oldest until we have room for 1 more (max 4 total)
      while (featured.length >= 4) {
        const oldest = featured.shift();
        if (oldest) {
          const oi = tracks.findIndex((t: any) => t.id === oldest.id);
          if (oi !== -1) tracks[oi].featured = false;
        }
      }
    }

    if (req.method === 'POST') {
      const body = req.body;
      const tracks = await getTracks();

      // Support batch: if body is an array, add all tracks at once
      const items = Array.isArray(body) ? body : [body];
      for (const item of items) {
        const err = validateTrackData(item);
        if (err) return res.status(400).json({ error: err });
      }
      // Key to Camelot conversion
      const K2C:Record<string,string>={'Ab':'4B','Abm':'1A','A':'11B','Am':'8A','Bb':'6B','Bbm':'3A','B':'1B','Bm':'10A','C':'8B','Cm':'5A','C#':'3B','C#m':'12A','Db':'3B','Dbm':'12A','D':'10B','Dm':'7A','Eb':'5B','Ebm':'2A','E':'12B','Em':'9A','F':'7B','Fm':'4A','F#':'2B','F#m':'11A','Gb':'2B','Gbm':'11A','G':'9B','Gm':'6A','G#':'4B','G#m':'1A'};

      // Auto-assign credits, camelot, cover
      for (const item of items) {
        item.credits = CREDIT_COSTS[item.category] || 1;
        item.coverUrl = 'https://pub-cfc51dd31a2545cab8567d8d24e56ae1.r2.dev/uploads/1777578123001-covers_cover-default.png';
        if (item.key && K2C[item.key]) item.camelot = K2C[item.key];
      }

      // Legacy pack price distribution (no longer used but kept for safety)
      const packItems = items.filter((i: any) => i.packId);
      if (packItems.length > 1) {
        const totalPrice = packItems.reduce((s: number, i: any) => s + (i.price || 0), 0);
        if (totalPrice > 0) {
          const perTrack = Math.floor((totalPrice / packItems.length) * 100) / 100;
          const remainder = Math.round((totalPrice - perTrack * packItems.length) * 100) / 100;
          packItems.forEach((item: any, idx: number) => {
            item.price = idx === packItems.length - 1 ? Math.round((perTrack + remainder) * 100) / 100 : perTrack;
          });
        }
      }

      const existingIds = new Set(tracks.map((t: any) => t.id));
      const newTracks: any[] = [];
      for (const data of items) {
        if (collab.valid && collab.collaboratorId) {
          data.collaborator = true;
          data.collaboratorId = collab.collaboratorId;
        }
        const newTrack = { ...data, id: data.id || `track-${Date.now()}-${crypto.randomBytes(4).toString('hex')}` };
        // Skip if ID already exists (prevents duplicates from retries)
        if (existingIds.has(newTrack.id)) continue;
        existingIds.add(newTrack.id);
        enforceFeaturedLimit(tracks, newTrack);
        tracks.unshift(newTrack);
        newTracks.push(newTrack);
      }
      await redis.set(KV_KEY, tracks);

      // Trigger AI analysis in background for each new track (fire-and-forget)
      const MODAL_URL = 'https://alexselas--musicdrop-analysis-analyze-webhook.modal.run';
      for (const nt of newTracks) {
        if (nt.fileUrl && !nt.fileUrl.startsWith('blob:')) {
          fetch(MODAL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio_url: nt.fileUrl, track_id: nt.id }),
          }).then(async (mRes) => {
            try {
              const mData = await mRes.json();
              const r = mData?.results;
              if (r) {
                const allTracks = await redis.get(KV_KEY) as any[];
                if (allTracks) {
                  const updated = allTracks.map((t: any) => t.id === nt.id ? {
                    ...t,
                    bpm: r.bpm > 0 ? (r.bpm > 162 ? Math.round(r.bpm / 2) : r.bpm) : t.bpm,
                    key: t.key || r.key || '', // Never overwrite editor's key
                    camelot: t.key ? (K2C[t.key] || t.camelot || '') : (r.camelot || (r.key ? K2C[r.key] || '' : '') || t.camelot),
                    duration: r.duration > 0 ? r.duration : t.duration,
                    tags: r.tags && r.tags.length > 0 ? r.tags : t.tags,
                    analysis: { intensity: r.intensity || 0, loudness_lufs: r.loudness_lufs || 0, energy_curve: r.energy_curve || [], genre_detected: r.genre_detected || '', key_confidence: r.key_confidence || 0, bpm_confidence: r.bpm_confidence || 0, analyzed_at: new Date().toISOString() },
                  } : t);
                  await redis.set(KV_KEY, updated);
                }
              }
            } catch {}
          }).catch(() => {});
        }
      }

      return res.status(200).json(Array.isArray(body) ? newTracks : newTracks[0]);
    }

    if (req.method === 'PUT') {
      const data = req.body;
      if (!data.id) return res.status(400).json({ error: 'Falta id' });
      const valErr = validateTrackData(data);
      if (valErr) return res.status(400).json({ error: valErr });
      const tracks = await getTracks();
      const idx = tracks.findIndex((t: any) => t.id === data.id);
      if (idx === -1) return res.status(404).json({ error: 'Track no encontrado' });
      // Collaborators can only edit their own tracks
      if (collab.valid && !isAdmin && tracks[idx].collaboratorId !== collab.collaboratorId) {
        return res.status(403).json({ error: 'No puedes editar este track' });
      }
      const updated = { ...tracks[idx], ...data };
      enforceFeaturedLimit(tracks, updated);
      tracks[idx] = updated;
      await redis.set(KV_KEY, tracks);
      return res.status(200).json(tracks[idx]);
    }

    if (req.method === 'PATCH') {
      if (!isAdmin) return res.status(403).json({ error: 'Solo admin puede reordenar' });
      const data = req.body;
      if (!Array.isArray(data)) return res.status(400).json({ error: 'Se esperaba un array' });
      await redis.set(KV_KEY, data);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id as string;
      const packId = req.query.packId as string;

      if (!id && !packId) return res.status(400).json({ error: 'Falta id o packId' });

      const tracks = await getTracks();

      if (packId) {
        // Delete entire pack at once (atomic)
        const packTracks = tracks.filter((t: any) => t.packId === packId);
        if (packTracks.length === 0) return res.status(404).json({ error: 'Pack no encontrado' });
        if (collab.valid && !isAdmin) {
          if (packTracks.some((t: any) => t.collaboratorId !== collab.collaboratorId)) {
            return res.status(403).json({ error: 'No puedes eliminar este pack' });
          }
        }
        const filtered = tracks.filter((t: any) => t.packId !== packId);
        await redis.set(KV_KEY, filtered);
        // Delete files from R2 (fire-and-forget)
        packTracks.forEach((t: any) => deleteTrackFiles(t));
        return res.status(200).json({ success: true, deleted: packTracks.length });
      }

      // Single track delete
      const track = tracks.find((t: any) => t.id === id);
      if (!track) return res.status(404).json({ error: 'Track no encontrado' });
      if (collab.valid && !isAdmin && track.collaboratorId !== collab.collaboratorId) {
        return res.status(403).json({ error: 'No puedes eliminar este track' });
      }
      const filtered = tracks.filter((t: any) => t.id !== id);
      await redis.set(KV_KEY, filtered);
      // Delete files from R2 (fire-and-forget)
      deleteTrackFiles(track);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Tracks API error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
