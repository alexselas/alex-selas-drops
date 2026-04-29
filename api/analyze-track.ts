import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { verifyAnyToken, corsHeaders } from './_auth.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

const KV_KEY = 'tracks';
const MODAL_URL = 'https://alexselas--musicdrop-analysis-analyze-webhook.modal.run';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!verifyAnyToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { trackId, audioUrl } = req.body;

    if (!trackId || !audioUrl) {
      return res.status(400).json({ error: 'Falta trackId o audioUrl' });
    }

    // Call Modal analysis pipeline
    const modalRes = await fetch(MODAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: audioUrl, track_id: trackId }),
    });

    if (!modalRes.ok) {
      const err = await modalRes.text();
      console.error('Modal error:', err);
      return res.status(502).json({ error: 'Error en análisis de audio' });
    }

    const modalData = await modalRes.json();
    const results = modalData.results;

    if (!results) {
      return res.status(502).json({ error: 'Sin resultados del análisis' });
    }

    // Update track in Redis with analysis results
    const tracks = await redis.get(KV_KEY) as any[];
    if (tracks) {
      const updated = tracks.map((t: any) => {
        if (t.id === trackId) {
          return {
            ...t,
            // Only overwrite if analysis found a value
            bpm: results.bpm > 0 ? results.bpm : t.bpm,
            key: results.key || t.key,
            duration: results.duration > 0 ? results.duration : t.duration,
            // New fields from analysis
            analysis: {
              danceability: results.danceability || 0,
              loudness_lufs: results.loudness_lufs || 0,
              loudness_range: results.loudness_range || 0,
              energy_curve: results.energy_curve || [],
              bpm_confidence: results.bpm_confidence || 0,
              key_confidence: results.key_confidence || 0,
              replay_gain: results.replay_gain || 0,
              analyzed_at: new Date().toISOString(),
            },
          };
        }
        return t;
      });
      await redis.set(KV_KEY, updated);
    }

    return res.status(200).json({
      success: true,
      trackId,
      analysis: results,
    });
  } catch (error: any) {
    console.error('Analyze track error:', error?.message);
    return res.status(500).json({ error: 'Error interno al analizar' });
  }
}
