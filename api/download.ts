import type { VercelRequest, VercelResponse } from '@vercel/node';
import NodeID3 from 'node-id3';

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileUrl, title, artist, authors, coverUrl, genre, bpm } = req.query as Record<string, string>;

    if (!fileUrl) {
      return res.status(400).json({ error: 'Falta fileUrl' });
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
        album: 'Alex Selas Drops',
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
    return res.status(500).json({ error: error.message });
  }
}
