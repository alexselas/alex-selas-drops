import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
const TOKEN_MAX_AGE=24*60*60*1000;function verifyAdminToken(h:string|undefined):boolean{try{if(!h?.startsWith('Bearer '))return false;const t=h.slice(7),s=process.env.ADMIN_SECRET||'';if(!s)return false;const p=t.split('.');if(p.length!==2)return false;const[ts,hm]=p;if(!ts||!hm)return false;const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return false;const e=crypto.createHmac('sha256',s).update(ts).digest('hex');if(hm.length!==e.length)return false;return crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex'));}catch{return false;}}function verifyCollabToken(h:string|undefined):{valid:boolean;collaboratorId?:string}{try{if(!h?.startsWith('Bearer '))return{valid:false};const t=h.slice(7);if(!t.startsWith('collab.'))return{valid:false};const s=process.env.ADMIN_SECRET||'dev-secret';const p=t.split('.');if(p.length!==4)return{valid:false};const[,cid,ts,hm]=p;if(!cid||!ts||!hm)return{valid:false};const a=Date.now()-Number(ts);if(isNaN(a)||a>TOKEN_MAX_AGE||a<0)return{valid:false};const py=`collab.${cid}.${ts}`;const e=crypto.createHmac('sha256',s).update(py).digest('hex');if(hm.length!==e.length)return{valid:false};if(!crypto.timingSafeEqual(Buffer.from(hm,'hex'),Buffer.from(e,'hex')))return{valid:false};return{valid:true,collaboratorId:cid};}catch{return{valid:false};}}function corsHeaders(r:{headers:{origin?:string}}){const o=['https://alex-selas-drops.vercel.app','https://musicdrop.es','https://www.musicdrop.es'],g=r.headers.origin||'',h:Record<string,string>={'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Filename, X-Folder'};if(o.includes(g))h['Access-Control-Allow-Origin']=g;return h;}

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const KV_KEY = 'tracks';

const demoTracks = [
  { id: 'track-010', title: 'Midnight Circuit Live', artist: 'Alex Selas', authors: '', category: 'sesiones', price: 9.99, bpm: 128, genre: 'Tech House', duration: 3720, releaseDate: '2026-03-15', description: 'Sesión grabada en vivo en Midnight Circuit. Tech house oscuro con líneas de bajo profundas y percusiones hipnóticas.', coverUrl: '', previewUrl: '/previews/midnight-circuit-preview.mp3', fileUrl: '/tracks/midnight-circuit.mp3', featured: true, tags: ['sesión', 'tech house', 'live', 'dark'] },
  { id: 'track-011', title: 'Warehouse Sessions', artist: 'Alex Selas', authors: '', category: 'sesiones', price: 9.99, bpm: 132, genre: 'Techno', duration: 4200, releaseDate: '2026-04-01', description: 'Sesión de techno grabada en un warehouse. Sonidos raw, oscuros y contundentes.', coverUrl: '', previewUrl: '/previews/warehouse-sessions-preview.mp3', fileUrl: '/tracks/warehouse-sessions.mp3', featured: true, tags: ['sesión', 'techno', 'warehouse', 'underground'] },
  { id: 'track-012', title: 'Sunset Terrace Set', artist: 'Alex Selas', authors: '', category: 'sesiones', price: 9.99, bpm: 122, genre: 'Melodic House', duration: 3600, releaseDate: '2026-02-14', description: 'Sesión melódica grabada al atardecer. Progresiones emotivas y un viaje sonoro de una hora.', coverUrl: '', previewUrl: '/previews/sunset-terrace-preview.mp3', fileUrl: '/tracks/sunset-terrace.mp3', featured: false, tags: ['sesión', 'melodic house', 'sunset', 'emotional'] },
  { id: 'track-001', title: 'Frequency Shift (Alex Selas Remix)', artist: 'Alex Selas', authors: 'Rebūke', category: 'remixes', price: 4.99, bpm: 130, genre: 'Techno', duration: 420, releaseDate: '2026-03-01', description: 'Remix potente con carácter techno. Bajos distorsionados y atmósferas industriales.', coverUrl: '', previewUrl: '/previews/frequency-shift-preview.mp3', fileUrl: '/tracks/frequency-shift-remix.mp3', featured: true, tags: ['techno', 'remix', 'peak time', 'industrial'] },
  { id: 'track-002', title: 'Solar Flare (Alex Selas Edit)', artist: 'Alex Selas', authors: 'Black Coffee, Keinemusik', category: 'remixes', price: 4.99, bpm: 124, genre: 'Afro House', duration: 390, releaseDate: '2026-01-10', description: 'Edit con influencias afro house. Percusiones orgánicas y groove irresistible.', coverUrl: '', previewUrl: '/previews/solar-flare-preview.mp3', fileUrl: '/tracks/solar-flare-edit.mp3', featured: false, tags: ['afro house', 'edit', 'tribal', 'groovy'] },
  { id: 'track-003', title: 'Velvet Underground (Alex Selas Remix)', artist: 'Alex Selas', authors: 'Solomun', category: 'remixes', price: 4.99, bpm: 122, genre: 'Deep House', duration: 450, releaseDate: '2026-03-28', description: 'Remix deep y elegante con pads aterciopelados y progresión magistral.', coverUrl: '', previewUrl: '/previews/velvet-underground-preview.mp3', fileUrl: '/tracks/velvet-underground-remix.mp3', featured: true, tags: ['deep house', 'remix', 'elegant', 'smooth'] },
  { id: 'track-004', title: 'Neon Pulse vs. Midnight', artist: 'Alex Selas', authors: 'Anyma, CamelPhat', category: 'mashups', price: 3.99, bpm: 126, genre: 'House', duration: 330, releaseDate: '2026-02-20', description: 'Mashup vibrante que fusiona dos clásicos del house melódico.', coverUrl: '', previewUrl: '/previews/neon-pulse-preview.mp3', fileUrl: '/tracks/neon-pulse-mashup.mp3', featured: true, tags: ['house', 'mashup', 'melodic', 'sunset'] },
  { id: 'track-005', title: 'Groove Theory x Disco Fever', artist: 'Alex Selas', authors: 'Purple Disco Machine, Daft Punk', category: 'mashups', price: 3.99, bpm: 125, genre: 'Funky House', duration: 310, releaseDate: '2026-03-20', description: 'Mashup funky y lleno de energía. Guitarras disco y groove adictivo.', coverUrl: '', previewUrl: '/previews/groove-theory-preview.mp3', fileUrl: '/tracks/groove-theory-mashup.mp3', featured: false, tags: ['funky house', 'mashup', 'disco', 'festival'] },
  { id: 'track-006', title: 'Warehouse Anthem Clash', artist: 'Alex Selas', authors: 'ANNA, Charlotte de Witte', category: 'mashups', price: 3.99, bpm: 132, genre: 'Techno', duration: 345, releaseDate: '2026-04-01', description: 'Mashup techno con dos himnos underground fusionados.', coverUrl: '', previewUrl: '/previews/warehouse-anthem-preview.mp3', fileUrl: '/tracks/warehouse-anthem-mashup.mp3', featured: true, tags: ['techno', 'mashup', 'warehouse', 'underground'] },
  { id: 'track-007', title: 'Drums & Textures Vol.1', artist: 'Alex Selas', authors: '', category: 'librerias', price: 14.99, bpm: 0, genre: 'Multi-género', duration: 0, releaseDate: '2026-02-01', description: 'Pack de 120+ samples exclusivos. Royalty-free para tus producciones.', coverUrl: '', previewUrl: '/previews/drums-textures-preview.mp3', fileUrl: '/tracks/drums-textures-v1.zip', featured: true, tags: ['librería', 'drums', 'textures', 'fx', 'royalty-free'] },
  { id: 'track-008', title: 'Synth Essentials Vol.1', artist: 'Alex Selas', authors: '', category: 'librerias', price: 12.99, bpm: 0, genre: 'Multi-género', duration: 0, releaseDate: '2026-03-10', description: 'Colección de 80+ loops y one-shots de sintetizadores.', coverUrl: '', previewUrl: '/previews/synth-essentials-preview.mp3', fileUrl: '/tracks/synth-essentials-v1.zip', featured: false, tags: ['librería', 'synths', 'loops', 'one-shots'] },
  { id: 'track-009', title: 'Vocal Chops & FX Vol.1', artist: 'Alex Selas', authors: '', category: 'librerias', price: 11.99, bpm: 0, genre: 'Multi-género', duration: 0, releaseDate: '2026-03-25', description: 'Librería de vocales procesadas y chops rítmicos. 60+ samples.', coverUrl: '', previewUrl: '/previews/vocal-chops-preview.mp3', fileUrl: '/tracks/vocal-chops-v1.zip', featured: false, tags: ['librería', 'vocals', 'chops', 'fx'] },
];

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
      if (collab.valid) return res.status(200).json(tracks);
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
      // For packs: distribute price evenly if some tracks have price 0
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
      if (!id) return res.status(400).json({ error: 'Falta id' });
      const tracks = await getTracks();
      // Collaborators can only delete their own tracks
      if (collab.valid && !isAdmin) {
        const track = tracks.find((t: any) => t.id === id);
        if (!track || track.collaboratorId !== collab.collaboratorId) {
          return res.status(403).json({ error: 'No puedes eliminar este track' });
        }
      }
      const filtered = tracks.filter((t: any) => t.id !== id);
      await redis.set(KV_KEY, filtered);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Tracks API error:', error?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}
