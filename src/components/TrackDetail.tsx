import { useState, useRef, useCallback } from 'react';
import { X, Play, Pause, Check, Clock, Tag, Calendar, Music, Share2, CheckCircle, Instagram, Loader2, Copy, CheckCircle2, Coins, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { Track } from '../types';
import { CREDIT_COSTS, CATEGORY_LABELS } from '../types';
import { formatCredits, formatDuration } from '../lib/utils';
import StoryEditor from './StoryEditor';

interface TrackDetailProps {
  track: Track | null;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  isInCart?: boolean;
  onClose: () => void;
  onPlay: () => void;
  onAddToCart?: () => void;
  onRemoveFromCart?: () => void;
  userToken?: string | null;
  userCredits?: number;
  onLoginRequired?: () => void;
  onBuyCredits?: () => void;
  onCreditsUpdated?: (credits: number) => void;
}

export default function TrackDetail({
  track, isPlaying, isCurrentTrack, isInCart, onClose, onPlay, onAddToCart, onRemoveFromCart,
  userToken, userCredits = 0, onLoginRequired, onBuyCredits, onCreditsUpdated,
}: TrackDetailProps) {
  const [copied, setCopied] = useState(false);
  const [showStoryEditor, setShowStoryEditor] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  // Story generation state
  const [generatingStory, setGeneratingStory] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyDone, setStoryDone] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  if (!track) return null;

  const shareUrl = `${window.location.origin}/track/${track.id}`;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const handleStoryGenerate = async (imageBlob: Blob) => {
    // Close editor, show generation popup
    setShowStoryEditor(false);
    setGeneratingStory(true);
    setStoryProgress(0);
    setStoryDone(false);

    try {
      setStoryProgress(10);

      // Load FFmpeg
      if (!ffmpegRef.current) {
        const ffmpeg = new FFmpeg();
        ffmpeg.on('progress', ({ progress: p }) => {
          setStoryProgress(25 + Math.round(p * 65));
        });
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegRef.current = ffmpeg;
      }
      setStoryProgress(25);

      const ffmpeg = ffmpegRef.current;

      // Write files
      await ffmpeg.writeFile('story.png', await fetchFile(imageBlob));
      await ffmpeg.writeFile('preview.mp3', await fetchFile(track.previewUrl));

      // Encode
      await ffmpeg.exec([
        '-loop', '1', '-i', 'story.png', '-i', 'preview.mp3',
        '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac',
        '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', 'scale=1080:1920',
        '-shortest', '-movflags', '+faststart', 'output.mp4',
      ]);
      setStoryProgress(95);

      // Download
      const output = await ffmpeg.readFile('output.mp4');
      const videoBlob = new Blob([output], { type: 'video/mp4' });
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.title.replace(/[^a-zA-Z0-9áéíóúñ ]/g, '').trim()} - Story.mp4`;
      a.click();
      URL.revokeObjectURL(url);

      // Cleanup
      await ffmpeg.deleteFile('story.png');
      await ffmpeg.deleteFile('preview.mp3');
      await ffmpeg.deleteFile('output.mp4');

      setStoryProgress(100);
      setStoryDone(true);

    } catch (err) {
      console.error('Video generation error:', err);
      // Fallback: download image
      const url = URL.createObjectURL(imageBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.title.replace(/[^a-zA-Z0-9áéíóúñ ]/g, '').trim()} - Story.png`;
      a.click();
      URL.revokeObjectURL(url);
      setStoryProgress(100);
      setStoryDone(true);
    }
  };

  const trackCredits = CREDIT_COSTS[track.category];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-[#141414] rounded-[22px] border border-white/[0.08] overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl shadow-black/60"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-black/50 backdrop-blur-sm text-zinc-400 hover:text-white hover:bg-black/70 transition-all"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative aspect-video bg-[#0e0e0e] flex items-center justify-center overflow-hidden">
            {track.coverUrl ? (
              <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]">
                <Music className="w-24 h-24 text-zinc-800" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/20 to-transparent" />
            <button
              onClick={onPlay}
              className="absolute bottom-6 left-6 w-14 h-14 rounded-full gradient-bg flex items-center justify-center shadow-lg shadow-yellow-400/25 hover:scale-110 active:scale-90 transition-transform"
              aria-label={isCurrentTrack && isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isCurrentTrack && isPlaying ? <Pause className="w-6 h-6 text-black" /> : <Play className="w-6 h-6 text-black ml-0.5" />}
            </button>
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-yellow-400 uppercase tracking-widest">{CATEGORY_LABELS[track.category]}</span>
                <h2 className="text-2xl sm:text-3xl font-bold text-zinc-50 mt-1.5 leading-tight">{track.title}</h2>
                <p className="text-zinc-400 mt-1.5 text-sm sm:text-base">
                  {track.artist}
                  {track.authors && <span className="text-zinc-500"> &middot; Original: {track.authors}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 bg-yellow-400/[0.08] border border-yellow-400/20 rounded-xl px-3 py-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="text-2xl font-black text-yellow-400">{trackCredits}</span>
                <span className="text-sm font-bold text-yellow-400/60">dr</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-6">
              {track.bpm > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-lg">
                  <Tag className="w-3.5 h-3.5 text-yellow-400" />{track.bpm} BPM
                </span>
              )}
              {(track.camelot || track.key) && (
                <span className="flex items-center gap-1.5 text-sm text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-lg">
                  <Tag className="w-3.5 h-3.5 text-yellow-400" />{track.camelot || track.key}
                </span>
              )}
              {track.duration > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-lg">
                  <Clock className="w-3.5 h-3.5 text-yellow-400" />{formatDuration(track.duration)}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-yellow-400" />{new Date(track.releaseDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-lg">
                <Music className="w-3.5 h-3.5 text-yellow-400" />{track.genre}
              </span>
            </div>

            {track.description && (
              <p className="mt-6 text-zinc-400 leading-relaxed text-sm sm:text-base">{track.description}</p>
            )}

            <div className="flex flex-wrap gap-2 mt-5">
              {track.tags.map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.04] text-xs text-zinc-500 hover:text-zinc-400 hover:border-white/[0.08] transition-colors">
                  #{tag}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-3 mt-8">
              <div className="flex items-center gap-3">
                <button
                  onClick={isInCart ? onRemoveFromCart : onAddToCart}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold transition-all ${
                    isInCart
                      ? 'bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20'
                      : 'gradient-bg text-black shadow-lg shadow-yellow-400/20 hover:shadow-yellow-400/30 hover:scale-[1.02] active:scale-95'
                  }`}
                >
                  {isInCart ? (
                    <><Check className="w-5 h-5" />En el carrito</>
                  ) : (
                    <><ShoppingCart className="w-5 h-5" />Añadir al carrito — {formatCredits(trackCredits)}</>
                  )}
                </button>
                <button onClick={handleShare}
                  className={`flex items-center justify-center w-12 h-12 rounded-2xl border transition-all flex-shrink-0 ${
                    copied ? 'border-green-500/40 text-green-400 bg-green-500/10' : 'border-white/[0.08] text-zinc-400 hover:border-yellow-400/30 hover:text-white hover:bg-white/[0.04]'}`}
                  aria-label="Compartir"
                >
                  {copied ? <CheckCircle className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                </button>
              </div>

              <button onClick={() => setShowStoryEditor(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-white/[0.08] text-zinc-300 font-medium hover:border-yellow-400/30 hover:text-white hover:bg-white/[0.03] transition-all">
                <Instagram className="w-5 h-5" /> Crear historia para Instagram
              </button>

              <button onClick={onPlay}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-white/[0.08] text-zinc-300 font-medium hover:border-yellow-400/30 hover:text-white hover:bg-white/[0.03] transition-all">
                {isCurrentTrack && isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isCurrentTrack && isPlaying ? 'Pausar Preview' : 'Escuchar Preview'}
              </button>
            </div>

            {/* AI Analysis Data */}
            {track.analysis && (
              <div className="mt-6 p-5 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-4">
                <div className="flex items-center gap-4">
                  {/* Intensity */}
                  {track.analysis.intensity != null && track.analysis.intensity > 0 && (
                    <div className="flex-1 space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Intensidad</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-red-500 transition-all duration-700" style={{ width: `${track.analysis.intensity}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-zinc-300 tabular-nums">{track.analysis.intensity}</span>
                      </div>
                    </div>
                  )}
                  {/* Loudness */}
                  {track.analysis.loudness_lufs != null && track.analysis.loudness_lufs !== 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Loudness</p>
                      <span className="text-[10px] font-black text-zinc-300 tabular-nums">{track.analysis.loudness_lufs} LUFS</span>
                    </div>
                  )}
                </div>
                {/* Energy curve */}
                {track.analysis.energy_curve && track.analysis.energy_curve.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Energía</p>
                    <div className="flex items-end gap-[2px] h-10">
                      {track.analysis.energy_curve.map((v: number, i: number) => (
                        <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-yellow-400/40 to-yellow-400 transition-all duration-300" style={{ height: `${v}%` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="mt-5 text-xs text-zinc-600 text-center">
              MP3 320kbps &middot; Descarga instantánea &middot; Calidad profesional
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Story Editor */}
      {showStoryEditor && track && (
        <StoryEditor track={track} onClose={() => setShowStoryEditor(false)} onGenerate={handleStoryGenerate} />
      )}

      {/* Story Generation Popup */}
      {generatingStory && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg"
          onClick={(e) => { if (storyDone) { setGeneratingStory(false); } }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#141414] rounded-2xl border border-white/[0.08] p-6 shadow-2xl shadow-black/60">

            {/* Close button (only when done) */}
            {storyDone && (
              <button onClick={() => setGeneratingStory(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Progress */}
            <div className="text-center mb-5">
              {!storyDone ? (
                <>
                  <Loader2 className="w-10 h-10 text-yellow-400 animate-spin mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-zinc-100">Generando tu historia</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    {storyProgress < 25 ? 'Cargando motor de vídeo...' : storyProgress < 90 ? 'Codificando vídeo...' : 'Finalizando...'}
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-zinc-100">Historia generada</h3>
                  <p className="text-sm text-zinc-500 mt-1">El vídeo se ha descargado automáticamente</p>
                </>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-1">
              <div className={`h-full rounded-full transition-all duration-500 ease-out ${storyDone ? 'bg-green-500' : 'gradient-bg'}`}
                style={{ width: `${storyProgress}%` }} />
            </div>
            <p className="text-xs text-zinc-500 text-right mb-5 tabular-nums">{storyProgress}%</p>

            {/* Track link */}
            <div className="border-t border-white/[0.06] pt-4">
              <p className="text-xs text-zinc-500 mb-2">Enlace del tema para tu historia:</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-zinc-300 truncate select-all">
                  {shareUrl}
                </div>
                <button onClick={handleCopyLink}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all flex-shrink-0 ${
                    linkCopied ? 'border-green-500/40 text-green-400 bg-green-500/10' : 'border-white/[0.08] text-zinc-400 hover:border-yellow-400/30 hover:text-white'
                  }`}
                  aria-label="Copiar enlace"
                >
                  {linkCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {linkCopied && <p className="text-[11px] text-green-400 mt-1.5">Enlace copiado</p>}
            </div>

            {/* Close button when done */}
            {storyDone && (
              <button onClick={() => setGeneratingStory(false)}
                className="w-full mt-4 px-4 py-2.5 rounded-xl bg-white/[0.06] text-zinc-300 text-sm font-medium hover:bg-white/[0.1] transition-colors">
                Cerrar
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
