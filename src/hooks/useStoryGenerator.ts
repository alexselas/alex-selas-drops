import { useState, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { Track } from '../types';

type StoryStatus = 'idle' | 'drawing' | 'loading-ffmpeg' | 'processing' | 'done' | 'error';

export function useStoryGenerator() {
  const [status, setStatus] = useState<StoryStatus>('idle');
  const [progress, setProgress] = useState(0);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  // Seeded pseudo-random number generator for consistent results
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const drawStory = useCallback(async (track: Track): Promise<Blob> => {
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Generate a seed from track title for consistent randomness
    let titleSeed = 0;
    for (let i = 0; i < track.title.length; i++) {
      titleSeed += track.title.charCodeAt(i) * (i + 1);
    }

    // === BACKGROUND IMAGE ===
    try {
      const bg = await loadImage('/story-bg.png');
      ctx.drawImage(bg, 0, 0, W, H);
    } catch {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);
    }

    // === COVER ART (positioned over the square placeholder in the bg) ===
    // The bg has: banner ~12%, then square centered ~55% width
    const coverSize = 600;
    const coverX = (W - coverSize) / 2;
    const coverY = 385;
    const coverRadius = 22;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, coverRadius);
    ctx.clip();
    if (track.coverUrl) {
      try {
        const coverImg = await loadImage(track.coverUrl);
        ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
      } catch {
        drawCoverPlaceholder(ctx, coverX, coverY, coverSize, track, titleSeed);
      }
    } else {
      drawCoverPlaceholder(ctx, coverX, coverY, coverSize, track, titleSeed);
    }
    ctx.restore();

    // === TRACK INFO — fill space below cover ===
    const infoTop = coverY + coverSize + 50;
    const infoBottom = H - 120;

    ctx.textAlign = 'center';

    // Category badge
    const categoryLabels: Record<string, string> = {
      sesiones: 'SESIÓN', remixes: 'REMIX', mashups: 'MASHUP', librerias: 'LIBRERÍA',
    };
    const catLabel = categoryLabels[track.category] || track.category.toUpperCase();
    let y = infoTop;

    ctx.font = 'bold 22px Inter, Arial, sans-serif';
    const badgeW = ctx.measureText(catLabel).width + 44;
    const badgeH = 38;
    ctx.fillStyle = 'rgba(250,204,21,0.10)';
    ctx.beginPath();
    ctx.roundRect((W - badgeW) / 2, y - badgeH / 2, badgeW, badgeH, 19);
    ctx.fill();
    ctx.strokeStyle = 'rgba(250,204,21,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#FACC15';
    ctx.fillText(catLabel, W / 2, y + 7);
    y += 55;

    // Title
    ctx.font = 'bold 54px Inter, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    const titleLines = wrapText(ctx, track.title, W - 140);
    titleLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, y + i * 66);
    });
    y += titleLines.length * 66 + 20;

    // Artist
    ctx.font = '500 36px Inter, Arial, sans-serif';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(track.artist, W / 2, y);
    y += 48;

    // Original artists
    if (track.authors) {
      ctx.font = '400 26px Inter, Arial, sans-serif';
      ctx.fillStyle = '#71717a';
      ctx.fillText(`Original: ${track.authors}`, W / 2, y);
      y += 44;
    }

    // Genre · BPM pill
    y += 15;
    const metaParts = [track.genre];
    if (track.bpm > 0) metaParts.push(`${track.bpm} BPM`);
    const metaText = metaParts.join('  ·  ');
    ctx.font = '500 22px Inter, Arial, sans-serif';
    const pillW = ctx.measureText(metaText).width + 44;
    const pillH = 36;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.roundRect((W - pillW) / 2, y - pillH / 2, pillW, pillH, 18);
    ctx.fill();
    ctx.fillStyle = '#71717a';
    ctx.fillText(metaText, W / 2, y + 7);

    // === WAVEFORM — centered in remaining space ===
    const waveY = y + (infoBottom - y) / 2 + 20;
    const barCount = 55;
    const barWidth = 9;
    const barGap = 5;
    const totalBarsWidth = barCount * (barWidth + barGap) - barGap;
    const barsStartX = (W - totalBarsWidth) / 2;
    const maxBarH = 50;

    for (let i = 0; i < barCount; i++) {
      const x = barsStartX + i * (barWidth + barGap);
      const normalizedPos = i / barCount;
      const bellCurve = Math.exp(-Math.pow((normalizedPos - 0.5) * 3, 2));
      const variation = seededRandom(titleSeed + i) * 0.6 + 0.4;
      const h = Math.max(4, bellCurve * variation * maxBarH);
      const opacity = 0.35 + bellCurve * 0.5;
      ctx.fillStyle = `rgba(250,204,21,${opacity})`;
      ctx.beginPath();
      ctx.roundRect(x, waveY - h / 2, barWidth, h, 3);
      ctx.fill();
    }

    // Convert to blob
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/png');
    });
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sanitizeFilename = (title: string) =>
    title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim();

  const generate = useCallback(async (track: Track) => {
    try {
      setStatus('drawing');
      setProgress(10);

      // 1. Draw the story image
      const imageBlob = await drawStory(track);
      setProgress(20);

      // 2. Try to create video with FFmpeg
      try {
        setStatus('loading-ffmpeg');
        if (!ffmpegRef.current) {
          const ffmpeg = new FFmpeg();
          ffmpeg.on('progress', ({ progress: p }) => {
            setProgress(40 + Math.round(p * 50));
          });
          const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
          await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          });
          ffmpegRef.current = ffmpeg;
        }
        setProgress(40);

        const ffmpeg = ffmpegRef.current;

        // 3. Write files and encode video
        setStatus('processing');
        const imageData = await fetchFile(imageBlob);
        await ffmpeg.writeFile('story.png', imageData);

        const audioData = await fetchFile(track.previewUrl);
        await ffmpeg.writeFile('preview.mp3', audioData);

        await ffmpeg.exec([
          '-loop', '1',
          '-i', 'story.png',
          '-i', 'preview.mp3',
          '-c:v', 'libx264',
          '-tune', 'stillimage',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-pix_fmt', 'yuv420p',
          '-vf', 'scale=1080:1920',
          '-shortest',
          '-movflags', '+faststart',
          'output.mp4',
        ]);

        setProgress(95);

        const output = await ffmpeg.readFile('output.mp4');
        const videoBlob = new Blob([output], { type: 'video/mp4' });
        downloadBlob(videoBlob, `${sanitizeFilename(track.title)} - Story.mp4`);

        // Cleanup
        await ffmpeg.deleteFile('story.png');
        await ffmpeg.deleteFile('preview.mp3');
        await ffmpeg.deleteFile('output.mp4');

      } catch (ffmpegErr) {
        // FFmpeg failed — fallback: download image only
        console.warn('FFmpeg failed, downloading image instead:', ffmpegErr);
        downloadBlob(imageBlob, `${sanitizeFilename(track.title)} - Story.png`);
      }

      setProgress(100);
      setStatus('done');
      setTimeout(() => { setStatus('idle'); setProgress(0); }, 3000);

    } catch (err) {
      console.error('Story generation error:', err);
      setStatus('error');
      setTimeout(() => { setStatus('idle'); setProgress(0); }, 4000);
    }
  }, [drawStory]);

  return { generate, status, progress };
}

// === Helpers ===

function drawCoverPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  track: { title: string; category: string },
  seed: number,
) {
  // Dynamic gradient based on category
  const categoryColors: Record<string, [string, string]> = {
    sesiones: ['#1a1a2e', '#16213e'],
    remixes: ['#1a1a1a', '#2d1b36'],
    mashups: ['#1a1a1a', '#1b2d28'],
    librerias: ['#1a1a1a', '#2d2a1b'],
  };
  const [c1, c2] = categoryColors[track.category] || ['#1e1e1e', '#0f0f0f'];

  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, size, size);

  // Decorative circles pattern
  const seededRandom = (s: number) => {
    const v = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let i = 0; i < 5; i++) {
    const cx = x + seededRandom(seed + i * 7) * size;
    const cy = y + seededRandom(seed + i * 13) * size;
    const r = 60 + seededRandom(seed + i * 23) * 140;
    const circleGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    circleGrad.addColorStop(0, 'rgba(250,204,21,0.06)');
    circleGrad.addColorStop(1, 'rgba(250,204,21,0)');
    ctx.fillStyle = circleGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Large initial letter of the track title
  const initial = track.title.charAt(0).toUpperCase();
  ctx.font = 'bold 280px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(250,204,21,0.08)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, x + size / 2, y + size / 2);
  ctx.textBaseline = 'alphabetic';

  // Music note icon overlay
  ctx.font = '120px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(250,204,21,0.15)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♫', x + size / 2, y + size / 2 + 30);
  ctx.textBaseline = 'alphabetic';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}
