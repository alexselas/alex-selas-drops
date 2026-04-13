import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { verifyAdminToken, corsHeaders } from './lib/auth';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — public (but strip fileUrl)
    if (req.method === 'GET') {
      const tracks = await getTracks();
      const isAdmin = verifyAdminToken(req.headers.authorization);
      return res.status(200).json(isAdmin ? tracks : stripFileUrls(tracks));
    }

    // All write operations require admin auth
    if (!verifyAdminToken(req.headers.authorization)) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (req.method === 'POST') {
      const data = req.body;
      const tracks = await getTracks();
      const newTrack = { ...data, id: data.id || `track-${Date.now()}` };
      tracks.unshift(newTrack);
      await redis.set(KV_KEY, tracks);
      return res.status(200).json(newTrack);
    }

    if (req.method === 'PUT') {
      const data = req.body;
      if (!data.id) return res.status(400).json({ error: 'Falta id' });
      const tracks = await getTracks();
      const idx = tracks.findIndex((t: any) => t.id === data.id);
      if (idx === -1) return res.status(404).json({ error: 'Track no encontrado' });
      tracks[idx] = { ...tracks[idx], ...data };
      await redis.set(KV_KEY, tracks);
      return res.status(200).json(tracks[idx]);
    }

    if (req.method === 'PATCH') {
      const data = req.body;
      if (!Array.isArray(data)) return res.status(400).json({ error: 'Se esperaba un array' });
      await redis.set(KV_KEY, data);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ error: 'Falta id' });
      const tracks = await getTracks();
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
