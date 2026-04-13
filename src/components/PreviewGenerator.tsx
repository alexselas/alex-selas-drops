import { useState, useRef, useCallback, useEffect } from 'react';
import { Scissors, Play, Pause, Upload, Loader2, Volume2, VolumeX } from 'lucide-react';
// @ts-ignore
import lamejs from 'lamejs';

interface PreviewGeneratorProps {
  fileUrl: string; // URL of the full track
  onPreviewReady: (blob: Blob, filename: string) => void;
  adminToken: string;
}

export function PreviewGenerator({ fileUrl, onPreviewReady, adminToken }: PreviewGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [duration, setDuration] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number>(0);
  const startedAtRef = useRef(0);

  // Load and decode audio
  const loadAudio = useCallback(async () => {
    if (!fileUrl) return;
    setLoading(true);
    try {
      const res = await fetch(fileUrl);
      const arrayBuffer = await res.arrayBuffer();
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      setAudioBuffer(buffer);
      ctxRef.current = ctx;
      // Default: start at 25% of track, 60s duration
      const defaultStart = Math.floor(buffer.duration * 0.25);
      setStartTime(Math.min(defaultStart, Math.max(0, buffer.duration - 60)));
      setDuration(Math.min(60, Math.floor(buffer.duration)));
    } catch (e) {
      console.error('Error loading audio:', e);
      alert('Error al cargar el audio');
    }
    setLoading(false);
  }, [fileUrl]);

  // Draw waveform
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / W);

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Selection area
    const selStart = (startTime / audioBuffer.duration) * W;
    const selWidth = (duration / audioBuffer.duration) * W;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
    ctx.fillRect(selStart, 0, selWidth, H);

    // Selection borders
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(selStart, 0); ctx.lineTo(selStart, H);
    ctx.moveTo(selStart + selWidth, 0); ctx.lineTo(selStart + selWidth, H);
    ctx.stroke();

    // Waveform
    for (let i = 0; i < W; i++) {
      let min = 1, max = -1;
      const start = i * step;
      for (let j = 0; j < step && start + j < data.length; j++) {
        const val = data[start + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const x = i;
      const isInSelection = x >= selStart && x <= selStart + selWidth;
      ctx.fillStyle = isInSelection ? '#facc15' : '#3f3f46';
      const barH = ((max - min) / 2) * H;
      ctx.fillRect(x, (H - barH) / 2, 1, Math.max(1, barH));
    }

    // Playback position
    if (isPlaying || playbackTime > 0) {
      const playX = ((startTime + playbackTime) / audioBuffer.duration) * W;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, H);
      ctx.stroke();
    }

    // Ducking markers every 15s
    for (let t = 15; t < duration; t += 15) {
      const markerX = ((startTime + t) / audioBuffer.duration) * W;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      const duckW = (2 / audioBuffer.duration) * W; // 2s duck width
      ctx.fillRect(markerX, 0, duckW, H);
    }

    // Time labels
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#71717a';
    ctx.fillText(formatTime(startTime), selStart + 4, H - 4);
    ctx.fillText(formatTime(startTime + duration), selStart + selWidth - 40, H - 4);
    ctx.fillText(formatTime(audioBuffer.duration), W - 40, 12);
  }, [audioBuffer, startTime, duration, isPlaying, playbackTime]);

  // Click on canvas to set start
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioBuffer || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / canvasRef.current.width;
    const newStart = Math.max(0, Math.min(ratio * audioBuffer.duration, audioBuffer.duration - duration));
    setStartTime(Math.round(newStart));
    stopPlayback();
  };

  // Preview playback
  const togglePlayback = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const startPlayback = () => {
    if (!audioBuffer || !ctxRef.current) return;
    const ctx = ctxRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0, startTime, duration);
    sourceRef.current = source;
    startedAtRef.current = ctx.currentTime;
    setIsPlaying(true);

    const updateTime = () => {
      if (!ctxRef.current) return;
      const elapsed = ctxRef.current.currentTime - startedAtRef.current;
      setPlaybackTime(elapsed);
      if (elapsed < duration) {
        animRef.current = requestAnimationFrame(updateTime);
      } else {
        setIsPlaying(false);
        setPlaybackTime(0);
      }
    };
    animRef.current = requestAnimationFrame(updateTime);

    source.onended = () => {
      setIsPlaying(false);
      setPlaybackTime(0);
      cancelAnimationFrame(animRef.current);
    };
  };

  const stopPlayback = () => {
    sourceRef.current?.stop();
    setIsPlaying(false);
    setPlaybackTime(0);
    cancelAnimationFrame(animRef.current);
  };

  // Generate preview with watermark
  const generatePreview = async () => {
    if (!audioBuffer) return;
    setGenerating(true);

    try {
      const sampleRate = 44100;
      const numChannels = audioBuffer.numberOfChannels;
      const startSample = Math.floor(startTime * audioBuffer.sampleRate);
      const numSamples = Math.floor(duration * audioBuffer.sampleRate);

      // Extract selected portion
      const offline = new OfflineAudioContext(numChannels, Math.floor(duration * sampleRate), sampleRate);
      const source = offline.createBufferSource();
      source.buffer = audioBuffer;

      // Gain node for volume ducking + fade
      const gainNode = offline.createGain();
      const gain = gainNode.gain;

      // Base volume
      gain.setValueAtTime(1.0, 0);

      // Volume ducking every 15 seconds (quick dip down and up over 2s)
      for (let t = 15; t < duration; t += 15) {
        gain.setValueAtTime(1.0, t - 0.1);
        gain.linearRampToValueAtTime(0.15, t + 0.5);
        gain.linearRampToValueAtTime(1.0, t + 2.0);
      }

      // Fade out last 3 seconds
      const fadeStart = Math.max(0, duration - 3);
      gain.setValueAtTime(1.0, fadeStart);
      gain.linearRampToValueAtTime(0.0, duration);

      source.connect(gainNode);
      gainNode.connect(offline.destination);
      source.start(0, startTime, duration);

      const renderedBuffer = await offline.startRendering();

      // Encode to MP3 at 128kbps using lamejs
      const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);

      const left = renderedBuffer.getChannelData(0);
      const right = numChannels > 1 ? renderedBuffer.getChannelData(1) : left;

      const sampleBlockSize = 1152;
      const mp3Data: Int8Array[] = [];

      // Convert float32 to int16
      const leftInt = new Int16Array(left.length);
      const rightInt = new Int16Array(right.length);
      for (let i = 0; i < left.length; i++) {
        leftInt[i] = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)));
        rightInt[i] = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)));
      }

      for (let i = 0; i < leftInt.length; i += sampleBlockSize) {
        const leftChunk = leftInt.subarray(i, i + sampleBlockSize);
        const rightChunk = rightInt.subarray(i, i + sampleBlockSize);
        const mp3buf = numChannels > 1
          ? mp3encoder.encodeBuffer(leftChunk, rightChunk)
          : mp3encoder.encodeBuffer(leftChunk);
        if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));
      }

      const end = mp3encoder.flush();
      if (end.length > 0) mp3Data.push(new Int8Array(end));

      const blob = new Blob(mp3Data, { type: 'audio/mpeg' });
      onPreviewReady(blob, `preview-${Date.now()}.mp3`);
    } catch (e) {
      console.error('Error generating preview:', e);
      alert('Error al generar la preview');
    }
    setGenerating(false);
  };

  if (!fileUrl) {
    return (
      <div className="p-4 border border-zinc-800 rounded-xl text-center text-sm text-zinc-500">
        Sube primero el archivo completo para generar la preview
      </div>
    );
  }

  if (!audioBuffer) {
    return (
      <button
        onClick={loadAudio}
        disabled={loading}
        className="w-full p-4 border border-dashed border-yellow-400/30 rounded-xl text-sm text-yellow-400 hover:bg-yellow-400/5 transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Scissors size={16} />}
        {loading ? 'Cargando audio...' : 'Generar preview desde el track completo'}
      </button>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Generador de preview</span>
        <span className="text-[10px] text-zinc-500">{formatTime(audioBuffer.duration)} total</span>
      </div>

      {/* Waveform */}
      <canvas
        ref={canvasRef}
        width={600}
        height={80}
        onClick={handleCanvasClick}
        className="w-full h-20 rounded-lg cursor-crosshair border border-zinc-800"
      />

      <div className="flex items-center gap-2 text-[9px] text-zinc-600">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400 rounded-sm inline-block" /> Selección</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500/50 rounded-sm inline-block" /> Ducking cada 15s</span>
        <span>Haz clic en la onda para mover el inicio</span>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1">Inicio (seg)</label>
          <input
            type="number"
            value={startTime}
            min={0}
            max={Math.floor(audioBuffer.duration - duration)}
            onChange={e => { setStartTime(Math.max(0, Number(e.target.value))); stopPlayback(); }}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-yellow-400"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1">Duración (seg)</label>
          <input
            type="number"
            value={duration}
            min={15}
            max={Math.min(120, Math.floor(audioBuffer.duration - startTime))}
            onChange={e => { setDuration(Math.max(15, Number(e.target.value))); stopPlayback(); }}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-yellow-400"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1">Calidad</label>
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-400">128 kbps</div>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-center gap-3 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1"><Volume2 size={10} /> Fundido final 3s</span>
        <span className="flex items-center gap-1"><VolumeX size={10} /> Ducking anti-copia cada 15s</span>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={togglePlayback}
          className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:border-zinc-500 transition-colors flex items-center gap-2"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? 'Parar' : 'Escuchar selección'}
        </button>
        <button
          onClick={generatePreview}
          disabled={generating}
          className="flex-1 py-2 bg-yellow-400 text-black font-black text-xs uppercase tracking-widest rounded-lg hover:bg-yellow-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
          {generating ? 'Generando...' : 'Generar preview MP3'}
        </button>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
