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

    // === TOP BANNER: MUSIC DROP ===
    const bannerH = 160;
    const bannerGrad = ctx.createLinearGradient(0, 0, W, 0);
    bannerGrad.addColorStop(0, '#FACC15');
    bannerGrad.addColorStop(0.5, '#FDE047');
    bannerGrad.addColorStop(1, '#F59E0B');
    ctx.fillStyle = bannerGrad;
    ctx.fillRect(0, 0, W, bannerH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 58px Inter, Arial, sans-serif';
    ctx.fillStyle = '#000000';
    ctx.fillText('MUSIC', W / 2 - 95, bannerH / 2);
    ctx.fillText('DROP', W / 2 + 95, bannerH / 2);
    // Dot separator
    ctx.beginPath();
    ctx.arc(W / 2, bannerH / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.textBaseline = 'alphabetic';

    // === CATEGORY BADGE ===
    const categoryLabels: Record<string, string> = {
      sesiones: 'SESIÓN', remixes: 'REMIX', mashups: 'MASHUP', librerias: 'LIBRERÍA',
    };
    const catLabel = categoryLabels[track.category] || track.category.toUpperCase();
    const badgeY = bannerH + 45;

    ctx.font = 'bold 24px Inter, Arial, sans-serif';
    const badgeW = ctx.measureText(catLabel).width + 50;
    const badgeH2 = 42;
    ctx.fillStyle = 'rgba(250,204,21,0.10)';
    ctx.beginPath();
    ctx.roundRect((W - badgeW) / 2, badgeY - badgeH2 / 2, badgeW, badgeH2, 21);
    ctx.fill();
    ctx.strokeStyle = 'rgba(250,204,21,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#FACC15';
    ctx.textAlign = 'center';
    ctx.fillText(catLabel, W / 2, badgeY + 8);

    // === COVER ART ===
    const coverSize = 660;
    const coverX = (W - coverSize) / 2;
    const coverY = badgeY + 40;
    const coverRadius = 24;

    // Glow
    const glowGrad = ctx.createRadialGradient(W / 2, coverY + coverSize / 2, 0, W / 2, coverY + coverSize / 2, coverSize * 0.65);
    glowGrad.addColorStop(0, 'rgba(250,204,21,0.05)');
    glowGrad.addColorStop(1, 'rgba(250,204,21,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, coverY - 60, W, coverSize + 120);

    // Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 12;
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
    ctx.strokeStyle = 'rgba(250,204,21,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, coverRadius);
    ctx.stroke();

    // === TRACK INFO — distributed in remaining space ===
    const infoTop = coverY + coverSize + 40;
    const infoBottom = H - 80;
    const infoSpace = infoBottom - infoTop;

    // Pre-calc
    ctx.font = 'bold 56px Inter, Arial, sans-serif';
    const titleLines = wrapText(ctx, track.title, W - 140);

    // Title at top of info zone
    let y = infoTop;
    ctx.font = 'bold 56px Inter, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    titleLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, y + i * 68);
    });
    y += titleLines.length * 68 + 24;

    // Artist
    ctx.font = '500 36px Inter, Arial, sans-serif';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(track.artist, W / 2, y);
    y += 50;

    // Original artists
    if (track.authors) {
      ctx.font = '400 28px Inter, Arial, sans-serif';
      ctx.fillStyle = '#71717a';
      ctx.fillText(`Original: ${track.authors}`, W / 2, y);
      y += 46;
    }

    // === WAVEFORM — centered in remaining space ===
    const waveY = y + (infoBottom - y) / 2;
    const barCount = 60;
    const barWidth = 9;
    const barGap = 5;
    const totalBarsWidth = barCount * (barWidth + barGap) - barGap;
    const barsStartX = (W - totalBarsWidth) / 2;
    const maxBarH = 55;

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

    // Genre · BPM below waveform
    const metaParts = [track.genre];
    if (track.bpm > 0) metaParts.push(`${track.bpm} BPM`);
    const metaText = metaParts.join('  ·  ');
    ctx.font = '500 22px Inter, Arial, sans-serif';
    ctx.fillStyle = '#52525b';
    ctx.fillText(metaText, W / 2, waveY + maxBarH / 2 + 30);

    // === BOTTOM: musicdrop.es ===
    ctx.font = '500 20px Inter, Arial, sans-serif';
    ctx.fillStyle = '#3f3f46';
    ctx.fillText('musicdrop.es', W / 2, H - 50);

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
