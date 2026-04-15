import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Scissors, Play, Pause, Loader2, Volume2, VolumeX } from 'lucide-react';

export interface PreviewGeneratorHandle {
  generate: () => Promise<Blob | null>;
  isReady: () => boolean;
  stop: () => void;
}

interface PreviewGeneratorProps {
  fileUrl: string;
  fileBlob?: Blob | null;
  onPreviewReady: (blob: Blob, filename: string) => void;
  adminToken: string;
  hideGenerateButton?: boolean;
  onPlayStart?: () => void;
}

// Convert AudioBuffer to MP3 using lamejs loaded from local file in a web worker
function audioBufferToMp3(buffer: AudioBuffer, kbps: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const numChannels = Math.min(buffer.numberOfChannels, 2);
    const sampleRate = buffer.sampleRate;

    // Convert float32 to int16
    const samples: Int16Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      const float = buffer.getChannelData(ch);
      const int16 = new Int16Array(float.length);
      for (let i = 0; i < float.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, Math.round(float[i] * 32767)));
      }
      samples.push(int16);
    }

    // Use local lame.min.js (in public/ folder)
    const lameUrl = new URL('/lame.min.js', window.location.origin).href;
    const workerCode = `
      importScripts('${lameUrl}');
      self.onmessage = function(e) {
        try {
          var ch = e.data.channels;
          var sr = e.data.sampleRate;
          var kbps = e.data.kbps;
          var samples = e.data.samples;
          var enc = new lamejs.Mp3Encoder(ch, sr, kbps);
          var mp3 = [];
          var bs = 1152;
          for (var i = 0; i < samples[0].length; i += bs) {
            var left = samples[0].subarray(i, i + bs);
            var buf = ch > 1 ? enc.encodeBuffer(left, samples[1].subarray(i, i + bs)) : enc.encodeBuffer(left);
            if (buf.length > 0) mp3.push(new Int8Array(buf));
          }
          var end = enc.flush();
          if (end.length > 0) mp3.push(new Int8Array(end));
          self.postMessage({ ok: true, mp3: mp3 });
        } catch(err) {
          self.postMessage({ ok: false, error: err.message || 'Encoding failed' });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.postMessage({ channels: numChannels, sampleRate, kbps, samples });

    worker.onmessage = (e) => {
      worker.terminate();
      if (e.data.ok) {
        resolve(new Blob(e.data.mp3, { type: 'audio/mpeg' }));
      } else {
        reject(new Error(e.data.error));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error('Worker error: ' + e.message));
    };

    // Timeout after 60 seconds
    setTimeout(() => { worker.terminate(); reject(new Error('Timeout')); }, 60000);
  });
}

export const PreviewGenerator = forwardRef<PreviewGeneratorHandle, PreviewGeneratorProps>(function PreviewGenerator({ fileUrl, fileBlob, onPreviewReady, adminToken, hideGenerateButton, onPlayStart }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [duration, setDuration] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number>(0);
  const startedAtRef = useRef(0);

  const loadAudio = useCallback(async () => {
    if (!fileUrl && !fileBlob) return;
    setLoading(true);
    try {
      let arrayBuffer: ArrayBuffer;
      if (fileBlob) {
        arrayBuffer = await fileBlob.arrayBuffer();
      } else {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error('Fetch failed');
        arrayBuffer = await res.arrayBuffer();
      }
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      setAudioBuffer(buffer);
      ctxRef.current = ctx;
      const defaultStart = Math.floor(buffer.duration * 0.25);
      setStartTime(Math.min(defaultStart, Math.max(0, buffer.duration - 60)));
      setDuration(Math.min(60, Math.floor(buffer.duration)));
    } catch (e) {
      console.error('Error loading audio:', e);
    }
    setLoading(false);
  }, [fileUrl, fileBlob]);

  // Auto-load audio when fileBlob is available
  useEffect(() => {
    if (fileBlob && !audioBuffer && !loading) {
      loadAudio();
    }
  }, [fileBlob, audioBuffer, loading, loadAudio]);

  // Expose generate(), isReady() and stop() to parent via ref
  useImperativeHandle(ref, () => ({
    isReady: () => !!audioBuffer && !generating,
    stop: () => stopPlayback(),
    generate: async () => {
      if (!audioBuffer) return null;
      setGenerating(true);
      try {
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
        const offline = new OfflineAudioContext(numChannels, Math.floor(duration * sampleRate), sampleRate);
        const source = offline.createBufferSource();
        source.buffer = audioBuffer;
        const gainNode = offline.createGain();
        const gain = gainNode.gain;
        gain.setValueAtTime(1.0, 0);
        for (let t = 7; t < duration; t += 7) {
          gain.setValueAtTime(1.0, t - 0.1);
          gain.linearRampToValueAtTime(0.15, t + 0.5);
          gain.linearRampToValueAtTime(1.0, t + 2.0);
        }
        const fadeStart = Math.max(0, duration - 3);
        gain.setValueAtTime(1.0, fadeStart);
        gain.linearRampToValueAtTime(0.0, duration);
        source.connect(gainNode);
        gainNode.connect(offline.destination);
        source.start(0, startTime, duration);
        const renderedBuffer = await offline.startRendering();
        const mp3Blob = await audioBufferToMp3(renderedBuffer, 128);
        setGenerating(false);
        return mp3Blob;
      } catch (e) {
        console.error('Error generating preview:', e);
        setGenerating(false);
        return null;
      }
    },
  }), [audioBuffer, startTime, duration, generating]);

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
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    const selStart = (startTime / audioBuffer.duration) * W;
    const selWidth = (duration / audioBuffer.duration) * W;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
    ctx.fillRect(selStart, 0, selWidth, H);

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(selStart, 0); ctx.lineTo(selStart, H);
    ctx.moveTo(selStart + selWidth, 0); ctx.lineTo(selStart + selWidth, H);
    ctx.stroke();

    for (let i = 0; i < W; i++) {
      let min = 1, max = -1;
      const start = i * step;
      for (let j = 0; j < step && start + j < data.length; j++) {
        const val = data[start + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const isInSelection = i >= selStart && i <= selStart + selWidth;
      ctx.fillStyle = isInSelection ? '#facc15' : '#3f3f46';
      const barH = ((max - min) / 2) * H;
      ctx.fillRect(i, (H - barH) / 2, 1, Math.max(1, barH));
    }

    if (isPlaying || playbackTime > 0) {
      const playX = ((startTime + playbackTime) / audioBuffer.duration) * W;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0); ctx.lineTo(playX, H);
      ctx.stroke();
    }

    for (let t = 7; t < duration; t += 7) {
      const markerX = ((startTime + t) / audioBuffer.duration) * W;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      const duckW = (2 / audioBuffer.duration) * W;
      ctx.fillRect(markerX, 0, duckW, H);
    }

    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#71717a';
    ctx.fillText(formatTime(startTime), selStart + 4, H - 4);
    ctx.fillText(formatTime(startTime + duration), selStart + selWidth - 40, H - 4);
    ctx.fillText(formatTime(audioBuffer.duration), W - 40, 12);
  }, [audioBuffer, startTime, duration, isPlaying, playbackTime]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioBuffer || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const newStart = Math.max(0, Math.min(ratio * audioBuffer.duration, audioBuffer.duration - duration));
    setStartTime(Math.round(newStart));
    stopPlayback();
  };

  const togglePlayback = () => isPlaying ? stopPlayback() : startPlayback();

  const startPlayback = () => {
    if (!audioBuffer || !ctxRef.current) return;
    onPlayStart?.();
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
        setIsPlaying(false); setPlaybackTime(0);
      }
    };
    animRef.current = requestAnimationFrame(updateTime);
    source.onended = () => { setIsPlaying(false); setPlaybackTime(0); cancelAnimationFrame(animRef.current); };
  };

  const stopPlayback = () => {
    sourceRef.current?.stop();
    setIsPlaying(false); setPlaybackTime(0);
    cancelAnimationFrame(animRef.current);
  };

  const generatePreview = async () => {
    if (!audioBuffer) return;
    setGenerating(true);

    try {
      setGeneratingStep('Procesando audio...');
      const sampleRate = audioBuffer.sampleRate;
      const numChannels = Math.min(audioBuffer.numberOfChannels, 2);

      // Render with ducking + fade using OfflineAudioContext
      const offline = new OfflineAudioContext(numChannels, Math.floor(duration * sampleRate), sampleRate);
      const source = offline.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = offline.createGain();
      const gain = gainNode.gain;
      gain.setValueAtTime(1.0, 0);

      // Ducking every 7s
      for (let t = 7; t < duration; t += 7) {
        gain.setValueAtTime(1.0, t - 0.1);
        gain.linearRampToValueAtTime(0.15, t + 0.5);
        gain.linearRampToValueAtTime(1.0, t + 2.0);
      }

      // Fade out last 3s
      const fadeStart = Math.max(0, duration - 3);
      gain.setValueAtTime(1.0, fadeStart);
      gain.linearRampToValueAtTime(0.0, duration);

      source.connect(gainNode);
      gainNode.connect(offline.destination);
      source.start(0, startTime, duration);

      const renderedBuffer = await offline.startRendering();

      // Encode to MP3 128kbps via web worker
      setGeneratingStep('Codificando MP3 a 128kbps...');
      const mp3Blob = await audioBufferToMp3(renderedBuffer, 128);

      onPreviewReady(mp3Blob, `preview-${Date.now()}.mp3`);
    } catch (e) {
      console.error('Error generating preview:', e);
      alert('Error al generar la preview: ' + (e as Error).message);
    }
    setGenerating(false);
    setGeneratingStep('');
  };

  if (!fileUrl && !fileBlob) {
    return (
      <div className="p-4 border border-zinc-800 rounded-xl text-center text-sm text-zinc-500">
        Sube primero la canción para generar la preview
      </div>
    );
  }

  if (!audioBuffer) {
    return (
      <div className="p-4 border border-zinc-800 rounded-xl text-center text-sm text-zinc-500 flex items-center justify-center gap-2">
        <Loader2 size={16} className="animate-spin text-yellow-400" />
        Cargando audio...
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Generador de preview</span>
        <span className="text-[10px] text-zinc-500">{formatTime(audioBuffer.duration)} total</span>
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={80}
        onClick={handleCanvasClick}
        className="w-full h-20 rounded-lg cursor-crosshair border border-zinc-800"
      />

      <div className="flex items-center gap-2 text-[9px] text-zinc-600">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400 rounded-sm inline-block" /> Seleccion</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500/50 rounded-sm inline-block" /> Ducking cada 7s</span>
        <span>Haz clic en la onda para mover el inicio</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1">Inicio (seg)</label>
          <input type="number" value={startTime} min={0} max={Math.floor(audioBuffer.duration - duration)}
            onChange={e => { setStartTime(Math.max(0, Number(e.target.value))); stopPlayback(); }}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-yellow-400"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1">Duracion (seg)</label>
          <input type="number" value={duration} min={15} max={Math.min(120, Math.floor(audioBuffer.duration - startTime))}
            onChange={e => { setDuration(Math.max(15, Number(e.target.value))); stopPlayback(); }}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-yellow-400"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase font-bold text-zinc-500 block mb-1">Calidad</label>
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-400">128 kbps</div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1"><Volume2 size={10} /> Fundido final 3s</span>
        <span className="flex items-center gap-1"><VolumeX size={10} /> Ducking anti-copia cada 7s</span>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={togglePlayback}
          className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:border-zinc-500 transition-colors flex items-center gap-2">
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? 'Parar' : 'Escuchar'}
        </button>
        {!hideGenerateButton && (
          <button type="button" onClick={generatePreview} disabled={generating}
            className="flex-1 py-2 bg-yellow-400 text-black font-black text-xs uppercase tracking-widest rounded-lg hover:bg-yellow-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
            {generating ? generatingStep : 'Generar preview MP3'}
          </button>
        )}
      </div>
    </div>
  );
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
