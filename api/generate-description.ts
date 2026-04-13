import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminToken, corsHeaders } from './lib/auth';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // Admin auth required — only admin generates descriptions
  if (!verifyAdminToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { title, artist, authors, category, genre, bpm, userDescription } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Falta el título del track' });
    }

    const prompt = `Eres un copywriter experto en música electrónica y DJ culture. Genera una descripción comercial atractiva en español para vender este track en una tienda online de música.

Datos del track:
- Título: ${title}
- Productor: ${artist}
${authors ? `- Artistas originales: ${authors}` : ''}
- Categoría: ${category}
- Género: ${genre}
${bpm ? `- BPM: ${bpm}` : ''}
${userDescription ? `- Notas del productor: ${userDescription}` : ''}

Reglas:
- Máximo 2-3 frases
- Tono profesional pero cercano, estilo tienda de música para DJs
- Menciona el estilo musical y para qué momentos es ideal (warm-up, peak time, afterhours, etc.)
- Si hay artistas originales, menciónalos
- No uses emojis
- Responde SOLO con la descripción, sin comillas ni explicaciones`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 200,
          },
        }),
      }
    );

    if (!response.ok) throw new Error('Gemini API error');

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({ description: text.trim() });
  } catch (error: any) {
    console.error('Generate error:', error);
    return res.status(500).json({ error: 'Error al generar descripción' });
  }
}
