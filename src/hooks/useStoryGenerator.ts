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

  const drawStory = useCallback(async (track: Track): Promise<Blob> => {
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // === BACKGROUND ===
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0f0f0f');
    bgGrad.addColorStop(0.5, '#0a0a0a');
    bgGrad.addColorStop(1, '#0f0f0f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(250,204,21,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Top & bottom accent bars
    const barGrad = ctx.createLinearGradient(0, 0, W, 0);
    barGrad.addColorStop(0, '#FACC15');
    barGrad.addColorStop(1, '#F59E0B');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, W, 6);
    ctx.fillRect(0, H - 6, W, 6);

    // === COVER ART ===
    const coverSize = 600;
    const coverX = (W - coverSize) / 2;
    const coverY = 260;
    const coverRadius = 32;

    // Rounded rect clip for cover
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, coverRadius);
    ctx.clip();

    if (track.coverUrl) {
      try {
        const coverImg = await loadImage(track.coverUrl);
        ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
      } catch {
        drawCoverPlaceholder(ctx, coverX, coverY, coverSize);
      }
    } else {
      drawCoverPlaceholder(ctx, coverX, coverY, coverSize);
    }
    ctx.restore();

    // Cover border
    ctx.strokeStyle = 'rgba(250,204,21,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, coverRadius);
    ctx.stroke();

    // Glow behind cover
    ctx.save();
    ctx.shadowColor = 'rgba(250,204,21,0.12)';
    ctx.shadowBlur = 60;
    ctx.strokeStyle = 'rgba(250,204,21,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(coverX, coverY, coverSize, coverSize, coverRadius);
    ctx.stroke();
    ctx.restore();

    // === TEXT ===
    const textY = coverY + coverSize + 70;

    // Category badge
    const categoryLabels: Record<string, string> = {
      sesiones: 'SESION', remixes: 'REMIX', mashups: 'MASHUP', librerias: 'LIBRERIA',
    };
    const catLabel = categoryLabels[track.category] || track.category.toUpperCase();
    ctx.font = 'bold 24px Inter, Arial, sans-serif';
    ctx.fillStyle = '#FACC15';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '4px';
    ctx.fillText(catLabel, W / 2, textY);
    ctx.letterSpacing = '0px';

    // Track title
    ctx.font = 'bold 64px Inter, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    const titleLines = wrapText(ctx, track.title, W - 120);
    titleLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, textY + 70 + i * 76);
    });

    // Artist
    const artistY = textY + 70 + titleLines.length * 76 + 20;
    ctx.font = '500 36px Inter, Arial, sans-serif';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(track.artist, W / 2, artistY);

    // Genre · BPM
    const metaY = artistY + 56;
    ctx.font = '500 30px Inter, Arial, sans-serif';
    ctx.fillStyle = '#71717a';
    const meta = [track.genre, track.bpm > 0 ? `${track.bpm} BPM` : ''].filter(Boolean).join('  ·  ');
    ctx.fillText(meta, W / 2, metaY);

    // === WAVEFORM BARS (decorative) ===
    const barsY = metaY + 80;
    const barCount = 48;
    const barWidth = 12;
    const barGap = 6;
    const totalBarsWidth = barCount * (barWidth + barGap) - barGap;
    const barsStartX = (W - totalBarsWidth) / 2;
    const maxBarH = 80;

    for (let i = 0; i < barCount; i++) {
      const x = barsStartX + i * (barWidth + barGap);
      // Generate pseudo-random bar heights based on track title hash
      const seed = (track.title.charCodeAt(i % track.title.length) * 31 + i * 17) % 100;
      const h = Math.max(8, (seed / 100) * maxBarH);
      const barColor = ctx.createLinearGradient(0, barsY - h, 0, barsY);
      barColor.addColorStop(0, '#FACC15');
      barColor.addColorStop(1, '#F59E0B');
      ctx.fillStyle = barColor;
      ctx.beginPath();
      ctx.roundRect(x, barsY - h / 2, barWidth, h, 4);
      ctx.fill();
    }

    // === LOGO ===
    try {
      const logo = await loadImage('/logo-white.png');
      const logoH = 80;
      const logoW = (logo.width / logo.height) * logoH;
      ctx.drawImage(logo, (W - logoW) / 2, H - 200, logoW, logoH);
    } catch {
      // Fallback text
      ctx.font = 'bold 36px Inter, Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('ALEX SELAS DROPS', W / 2, H - 160);
    }

    // URL under logo
    ctx.font = '500 22px Inter, Arial, sans-serif';
    ctx.fillStyle = '#52525b';
    ctx.textAlign = 'center';
    ctx.fillText('alex-selas-drops.vercel.app', W / 2, H - 100);

    // Convert to blob
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/png');
    });
  }, []);

  const generate = useCallback(async (track: Track) => {
    try {
      setStatus('drawing');
      setProgress(10);

      // 1. Draw the story image
      const imageBlob = await drawStory(track);
      setProgress(20);

      // 2. Load FFmpeg
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

      // 3. Write image to FFmpeg filesystem
      setStatus('processing');
      const imageData = await fetchFile(imageBlob);
      await ffmpeg.writeFile('story.png', imageData);

      // 4. Fetch and write audio preview
      const audioData = await fetchFile(track.previewUrl);
      await ffmpeg.writeFile('preview.mp3', audioData);

      // 5. Combine image + audio → MP4 video
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

      // 6. Read output and download
      const output = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([output], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim()} - Story.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Cleanup FFmpeg files
      await ffmpeg.deleteFile('story.png');
      await ffmpeg.deleteFile('preview.mp3');
      await ffmpeg.deleteFile('output.mp4');

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

function drawCoverPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, '#1e1e1e');
  grad.addColorStop(1, '#0f0f0f');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, size, size);

  // Music note icon
  ctx.font = '200px Inter, Arial, sans-serif';
  ctx.fillStyle = '#27272a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♫', x + size / 2, y + size / 2);
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
