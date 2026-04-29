import { useState, useRef, useCallback } from 'react';
import { X, Play, Pause, ShoppingCart, Check, Clock, Tag, Calendar, Music, Share2, CheckCircle, Instagram, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { Track } from '../types';
import { formatPrice, formatDuration } from '../lib/utils';
import StoryEditor from './StoryEditor';

interface TrackDetailProps {
  track: Track | null;
  packTotalPrice?: number;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  isInCart: boolean;
  onClose: () => void;
  onPlay: () => void;
  onAddToCart: () => void;
}

export default function TrackDetail({
  track, packTotalPrice, isPlaying, isCurrentTrack, isInCart, onClose, onPlay, onAddToCart,
}: TrackDetailProps) {
  const [copied, setCopied] = useState(false);
  const [showStoryEditor, setShowStoryEditor] = useState(false);

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
      a.download = `${track.title.replace(/[^a-zA-Z0-9\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1 ]/g, '').trim()} - Story.mp4`;
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
      a.download = `${track.title.replace(/[^a-zA-Z0-9\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1 ]/g, '').trim()} - Story.png`;
      a.click();
      URL.revokeObjectURL(url);
      setStoryProgress(100);
      setStoryDone(true);
    }
  };

  const categoryLabels: Record<string, string> = {
    sesiones: 'Sesion', remixes: 'Remix', mashups: 'Mashup', livemashups: 'Live Mashup', librerias: 'Libreria',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-[#1a1a1a] rounded-[22px] border border-zinc-800/50 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
        >
          <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors">
            <X className="w-5 h-5" />
          </button>

          <div className="relative aspect-video bg-zinc-800 flex items-center justify-center overflow-hidden">
            {track.coverUrl ? (
              <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1e1e1e] to-[#0f0f0f]">
                <Music className="w-24 h-24 text-zinc-800" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent" />
            <button onClick={onPlay}
              className="absolute bottom-6 left-6 w-14 h-14 rounded-full gradient-bg flex items-center justify-center shadow-lg glow hover:scale-110 active:scale-95 transition-transform">
              {isCurrentTrack && isPlaying ? <Pause className="w-6 h-6 text-black" /> : <Play className="w-6 h-6 text-black ml-0.5" />}
            </button>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">{track.packId ? 'Pack' : categoryLabels[track.category]}</span>
                <h2 className="text-2xl font-bold text-zinc-50 mt-1">{track.packId && track.packName ? track.packName : track.title}</h2>
                <p className="text-zinc-400 mt-1">
                  {track.artist}
                  {track.authors && <span className="text-zinc-500"> &middot; Original: {track.authors}</span>}
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold gradient-text">{formatPrice(packTotalPrice ?? track.price)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-6 text-sm text-zinc-400">
              {track.bpm > 0 && (<span className="flex items-center gap-1.5"><Tag className="w-4 h-4 text-yellow-400" />{track.bpm} BPM</span>)}
              {track.duration > 0 && (<span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-yellow-400" />{formatDuration(track.duration)}</span>)}
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-yellow-400" />{new Date(track.releaseDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="flex items-center gap-1.5"><Music className="w-4 h-4 text-yellow-400" />{track.genre}</span>
            </div>

            <p className="mt-6 text-zinc-400 leading-relaxed">{track.description}</p>

            <div className="flex flex-wrap gap-2 mt-4">
              {track.tags.map(tag => (<span key={tag} className="px-2.5 py-1 rounded-xl bg-zinc-800/50 text-xs text-zinc-500">#{tag}</span>))}
            </div>

            <div className="flex flex-col gap-3 mt-8">
              <div className="flex items-center gap-3">
                <button onClick={onAddToCart} disabled={isInCart}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold transition-all ${
                    isInCart ? 'bg-green-500/20 text-green-400 cursor-default' : 'gradient-bg text-black shadow-lg glow hover:scale-[1.02] active:scale-95'}`}>
                  {isInCart ? (<><Check className="w-5 h-5" />En el carrito</>) : (<><ShoppingCart className="w-5 h-5" />Comprar — {formatPrice(packTotalPrice ?? track.price)}</>)}
                </button>
                <button onClick={handleShare}
                  className={`flex items-center justify-center w-12 h-12 rounded-2xl border transition-all flex-shrink-0 ${
                    copied ? 'border-green-500/40 text-green-400 bg-green-500/10' : 'border-zinc-700 text-zinc-400 hover:border-yellow-400/40 hover:text-white'}`}>
                  {copied ? <CheckCircle className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                </button>
              </div>

              <button onClick={() => setShowStoryEditor(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-zinc-700 text-zinc-300 font-medium hover:border-yellow-400/40 hover:text-white transition-all">
                <Instagram className="w-5 h-5" /> Crea tu Historia para Instagram
              </button>

              <button onClick={onPlay}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-zinc-700 text-zinc-300 font-medium hover:border-yellow-400/40 hover:text-white transition-all">
                {isCurrentTrack && isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isCurrentTrack && isPlaying ? 'Pausar Preview' : 'Escuchar Preview'}
              </button>
            </div>

            {/* AI Analysis Data */}
            {track.analysis && (
              <div className="mt-5 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl space-y-3">
                <div className="flex items-center gap-4">
                  {/* Intensity */}
                  {track.analysis.intensity != null && track.analysis.intensity > 0 && (
                    <div className="flex-1 space-y-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Intensidad</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-red-500" style={{ width: `${track.analysis.intensity}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-zinc-300">{track.analysis.intensity}</span>
                      </div>
                    </div>
                  )}
                  {/* Loudness */}
                  {track.analysis.loudness_lufs != null && track.analysis.loudness_lufs !== 0 && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Loudness</p>
                      <span className="text-[10px] font-black text-zinc-300">{track.analysis.loudness_lufs} LUFS</span>
                    </div>
                  )}
                </div>
                {/* Energy curve */}
                {track.analysis.energy_curve && track.analysis.energy_curve.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Energía</p>
                    <div className="flex items-end gap-[2px] h-8">
                      {track.analysis.energy_curve.map((v: number, i: number) => (
                        <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-yellow-400/50 to-yellow-400" style={{ height: `${v}%` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="mt-4 text-xs text-zinc-600 text-center">
              MP3 320kbps &middot; Descarga inmediata tras el pago &middot; Preview con marca de agua
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
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={(e) => { if (storyDone) { setGeneratingStory(false); } }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-6 shadow-2xl">

            {/* Close button (only when done) */}
            {storyDone && (
              <button onClick={() => setGeneratingStory(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors">
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
                    {storyProgress < 25 ? 'Cargando motor de video...' : storyProgress < 90 ? 'Codificando video...' : 'Finalizando...'}
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-zinc-100">Historia generada</h3>
                  <p className="text-sm text-zinc-500 mt-1">El video se ha descargado automaticamente</p>
                </>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-1">
              <div className={`h-full rounded-full transition-all duration-300 ${storyDone ? 'bg-green-500' : 'gradient-bg'}`}
                style={{ width: `${storyProgress}%` }} />
            </div>
            <p className="text-xs text-zinc-500 text-right mb-5">{storyProgress}%</p>

            {/* Track link */}
            <div className="border-t border-zinc-800/60 pt-4">
              <p className="text-xs text-zinc-500 mb-2">Enlace del tema para tu historia:</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-xs text-zinc-300 truncate select-all">
                  {shareUrl}
                </div>
                <button onClick={handleCopyLink}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all flex-shrink-0 ${
                    linkCopied ? 'border-green-500/40 text-green-400 bg-green-500/10' : 'border-zinc-700 text-zinc-400 hover:border-yellow-400/40 hover:text-white'
                  }`}>
                  {linkCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {linkCopied && <p className="text-[11px] text-green-400 mt-1.5">Enlace copiado</p>}
            </div>

            {/* Close button when done */}
            {storyDone && (
              <button onClick={() => setGeneratingStory(false)}
                className="w-full mt-4 px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
                Cerrar
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
