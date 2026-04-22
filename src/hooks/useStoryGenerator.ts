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

    // === BACKGROUND ===
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0a0a0a');
    bgGrad.addColorStop(0.5, '#0f0f0f');
    bgGrad.addColorStop(1, '#080808');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // === TOP: MUSIC DROP branding ===
    const topY = 100;
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px Inter, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('MUSIC', W / 2 - 50, topY);
    ctx.fillStyle = '#FACC15';
    ctx.fillText('DROP', W / 2 + 50, topY);
    ctx.font = '500 14px Inter, Arial, sans-serif';
    ctx.fillStyle = '#52525b';
    ctx.fillText('by 360DJAcademy', W / 2, topY + 28);

    // Thin separator line
    ctx.fillStyle = 'rgba(250,204,21,0.15)';
    ctx.fillRect(W / 2 - 100, topY + 50, 200, 1);

    // === CATEGORY BADGE ===
    const categoryLabels: Record<string, string> = {
      sesiones: 'SESION', remixes: 'REMIX', mashups: 'MASHUP', librerias: 'LIBRERIA',
    };
    const catLabel = categoryLabels[track.category] || track.category.toUpperCase();
    const badgeY = topY + 90;

    ctx.font = 'bold 22px Inter, Arial, sans-serif';
    const badgeW = ctx.measureText(catLabel).width + 50;
    const badgeH = 40;
    const badgeX = (W - badgeW) / 2;

    ctx.fillStyle = 'rgba(250,204,21,0.10)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY - badgeH / 2, badgeW, badgeH, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(250,204,21,0.30)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#FACC15';
    ctx.textAlign = 'center';
    ctx.fillText(catLabel, W / 2, badgeY + 7);

    // === COVER ART ===
    const coverSize = 620;
    const coverX = (W - coverSize) / 2;
    const coverY = badgeY + 50;
    const coverRadius = 24;

    // Ambient glow behind cover
    const glowGrad = ctx.createRadialGradient(W / 2, coverY + coverSize / 2, 0, W / 2, coverY + coverSize / 2, coverSize * 0.7);
    glowGrad.addColorStop(0, 'rgba(250,204,21,0.06)');
    glowGrad.addColorStop(1, 'rgba(250,204,21,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, coverY - 100, W, coverSize + 200);

    // Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 15;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, coverRadius);
    ctx.fill();
    ctx.restore();

    // Draw cover
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

    // Cover border
    ctx.strokeStyle = 'rgba(250,204,21,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, coverRadius);
    ctx.stroke();

    // === TRACK INFO ===
    const infoY = coverY + coverSize + 60;

    // Title
    ctx.font = 'bold 56px Inter, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    const titleLines = wrapText(ctx, track.title, W - 160);
    titleLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, infoY + i * 68);
    });

    // Artist
    const artistY = infoY + titleLines.length * 68 + 20;
    ctx.font = '500 34px Inter, Arial, sans-serif';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(track.artist, W / 2, artistY);

    // Original artists
    let nextY = artistY + 24;
    if (track.authors) {
      nextY += 40;
      ctx.font = '400 28px Inter, Arial, sans-serif';
      ctx.fillStyle = '#71717a';
      ctx.fillText(`Original: ${track.authors}`, W / 2, nextY);
    }

    // === META: Genre · BPM ===
    const metaParts = [track.genre];
    if (track.bpm > 0) metaParts.push(`${track.bpm} BPM`);
    const metaText = metaParts.join('  ·  ');
    const pillY = nextY + 50;

    ctx.font = '500 24px Inter, Arial, sans-serif';
    const pillW = ctx.measureText(metaText).width + 48;
    const pillH = 40;
    const pillX = (W - pillW) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY - pillH / 2, pillW, pillH, 20);
    ctx.fill();
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(metaText, W / 2, pillY + 8);

    // === PRICE ===
    if (track.price > 0) {
      const priceY = pillY + 60;
      const priceText = `${track.price.toFixed(2).replace('.', ',')} €`;
      ctx.font = 'bold 42px Inter, Arial, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText(priceText, W / 2, priceY);
    }

    // === WAVEFORM ===
    const barsY = track.price > 0 ? pillY + 130 : pillY + 80;
    const barCount = 50;
    const barWidth = 8;
    const barGap = 6;
    const totalBarsWidth = barCount * (barWidth + barGap) - barGap;
    const barsStartX = (W - totalBarsWidth) / 2;
    const maxBarH = 50;

    for (let i = 0; i < barCount; i++) {
      const x = barsStartX + i * (barWidth + barGap);
      const normalizedPos = i / barCount;
      const bellCurve = Math.exp(-Math.pow((normalizedPos - 0.5) * 3, 2));
      const variation = seededRandom(titleSeed + i) * 0.6 + 0.4;
      const h = Math.max(4, bellCurve * variation * maxBarH);
      const opacity = 0.4 + bellCurve * 0.5;
      ctx.fillStyle = `rgba(250,204,21,${opacity})`;
      ctx.beginPath();
      ctx.roundRect(x, barsY - h / 2, barWidth, h, 3);
      ctx.fill();
    }

    // === BOTTOM: swipe text + accent line ===
    ctx.font = '500 22px Inter, Arial, sans-serif';
    ctx.fillStyle = '#52525b';
    ctx.textAlign = 'center';
    ctx.fillText('▲  Desliza para escuchar  ▲', W / 2, H - 90);

    ctx.fillStyle = '#FACC15';
    ctx.fillRect(W / 2 - 50, H - 50, 100, 3);

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
