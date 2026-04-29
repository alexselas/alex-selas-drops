import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { verifyAdminToken, corsHeaders } from './_auth.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const KV_KEY = 'tracks';
const MODAL_URL = 'https://alexselas--musicdrop-analysis-analyze-webhook.modal.run';

export const config = { api: { bodyParser: true } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Admin only
  if (!verifyAdminToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'Solo admin' });
  }

  try {
    const tracks = await redis.get(KV_KEY) as any[];
    if (!tracks) return res.status(404).json({ error: 'No tracks' });

    // Find tracks with fileUrl that haven't been analyzed yet
    const toAnalyze = tracks.filter((t: any) => t.fileUrl && !t.fileUrl.startsWith('blob:') && !t.analysis?.analyzed_at);

    // Fire-and-forget: analyze each track in background
    let launched = 0;
    for (const track of toAnalyze) {
      fetch(MODAL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: track.fileUrl, track_id: track.id }),
      }).then(async (mRes) => {
        try {
          const mData = await mRes.json();
          const r = mData?.results;
          if (r) {
            const allTracks = await redis.get(KV_KEY) as any[];
            if (allTracks) {
              const updated = allTracks.map((t: any) => t.id === track.id ? {
                ...t,
                bpm: r.bpm > 0 ? r.bpm : t.bpm,
                key: r.key || t.key,
                duration: r.duration > 0 ? r.duration : t.duration,
                tags: r.tags && r.tags.length > 0 ? r.tags : t.tags,
                analysis: {
                  intensity: r.intensity || 0,
                  loudness_lufs: r.loudness_lufs || 0,
                  energy_curve: r.energy_curve || [],
                  genre_detected: r.genre_detected || '',
                  key_confidence: r.key_confidence || 0,
                  bpm_confidence: r.bpm_confidence || 0,
                  analyzed_at: new Date().toISOString(),
                },
              } : t);
              await redis.set(KV_KEY, updated);
            }
          }
        } catch {}
      }).catch(() => {});
      launched++;
    }

    return res.status(200).json({
      success: true,
      total: tracks.length,
      launched,
      alreadyAnalyzed: tracks.length - toAnalyze.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
