import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Upload, FileAudio, Music, Trash2, CheckCircle, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import type { Track, Category } from '../types';
import { CREDIT_COSTS } from '../types';

const KEY_TO_CAMELOT: Record<string, string> = {
  'Ab': '4B', 'Abm': '1A', 'A': '11B', 'Am': '8A',
  'Bb': '6B', 'Bbm': '3A', 'B': '1B', 'Bm': '10A',
  'C': '8B', 'Cm': '5A', 'C#': '3B', 'C#m': '12A',
  'Db': '3B', 'Dbm': '12A', 'D': '10B', 'Dm': '7A',
  'Eb': '5B', 'Ebm': '2A', 'E': '12B', 'Em': '9A',
  'F': '7B', 'Fm': '4A', 'F#': '2B', 'F#m': '11A',
  'Gb': '2B', 'Gbm': '11A', 'G': '9B', 'Gm': '6A',
  'G#': '4B', 'G#m': '1A',
};
import { analyzeAudio } from '../lib/audioAnalyzer';
import { PreviewGenerator, type PreviewGeneratorHandle } from './PreviewGenerator';

interface AdminTrackFormProps {
  track: Track | null;
  onSave: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onCancel: () => void;
  adminToken?: string;
  defaultArtist?: string;
  hideCollaboratorCheckbox?: boolean;
}

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

function FileDropZone({
  label,
  accept,
  hint,
  icon: Icon,
  currentUrl,
  isImage,
  folder,
  onUploaded,
  onClear,
  onFileSelected,
}: {
  label: string;
  accept: string;
  hint: string;
  icon: typeof Upload;
  currentUrl: string;
  isImage?: boolean;
  folder: string;
  onUploaded: (url: string) => void;
  onClear: () => void;
  onFileSelected?: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<UploadStatus>(currentUrl ? 'done' : 'idle');
  const [fileName, setFileName] = useState('');
  const [localPreview, setLocalPreview] = useState('');

  useEffect(() => {
    if (currentUrl) setStatus('done');
  }, [currentUrl]);

  const getAdminToken = () => sessionStorage.getItem('alex-selas-drops-token') || sessionStorage.getItem('alex-selas-drops-collab-token') || '';

  // Compress image if > 1MB
  const compressImage = (file: File, maxSizeKB = 1024): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/') || file.size <= maxSizeKB * 1024) {
        resolve(file);
        return;
      }
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Max 1200px on longest side
        let w = img.width, h = img.height;
        const maxDim = 1200;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (blob && blob.size < file.size) {
            resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadFile = async (rawFile: File) => {
    // Compress images > 1MB
    const file = isImage ? await compressImage(rawFile) : rawFile;

    setFileName(file.name);
    setStatus('uploading');

    // Notify parent for audio analysis
    onFileSelected?.(rawFile);

    // Show local preview for images
    if (isImage) {
      setLocalPreview(URL.createObjectURL(file));
    }

    // Upload to R2 (uses presigned URL for large files)
    try {
      const { uploadFile: doUpload } = await import('../lib/upload');
      const url = await doUpload(file, folder, `${Date.now()}-${file.name}`, getAdminToken());
      if (url) {
        onUploaded(url);
        setStatus('done');
        return;
      }
    } catch (e) {
      console.error('Upload failed:', e);
    }

    setStatus('error');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) uploadFile(f);
  };

  const handleClear = () => {
    setStatus('idle');
    setFileName('');
    setLocalPreview('');
    onClear();
  };

  // Show uploaded state
  if (status === 'done' && (currentUrl || localPreview)) {
    return (
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{label}</label>
        <div className="flex items-center gap-3 p-3 rounded-[14px] bg-zinc-800/50 border border-emerald-500/20">
          {isImage && (localPreview || currentUrl) ? (
            <img src={localPreview || currentUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-emerald-400 font-medium truncate">{fileName || 'Subido'}</p>
            <p className="text-[10px] text-zinc-500 truncate">{currentUrl?.substring(0, 50)}...</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Uploading state
  if (status === 'uploading') {
    return (
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{label}</label>
        <div className="flex items-center gap-3 p-5 rounded-[14px] bg-zinc-800/30 border border-yellow-400/20">
          <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
          <div>
            <p className="text-sm text-yellow-400 font-medium">Subiendo...</p>
            <p className="text-xs text-zinc-500">{fileName}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{label}</label>
        <div
          onClick={() => { setStatus('idle'); inputRef.current?.click(); }}
          className="flex items-center gap-3 p-5 rounded-[14px] bg-red-500/5 border border-red-500/20 cursor-pointer"
        >
          <AlertCircle className="w-6 h-6 text-red-400" />
          <div>
            <p className="text-sm text-red-400 font-medium">Error al subir</p>
            <p className="text-xs text-zinc-500">Haz clic para reintentar</p>
          </div>
        </div>
      </div>
    );
  }

  // Idle / drop zone
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 p-6 rounded-[14px] border-2 border-dashed cursor-pointer transition-all ${
          dragOver
            ? 'border-yellow-400/50 bg-yellow-400/5'
            : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/20'
        }`}
      >
        <Icon className={`w-8 h-8 ${dragOver ? 'text-yellow-400' : 'text-zinc-600'}`} />
        <p className="text-sm text-zinc-500 text-center">
          Arrastra o <span className="text-yellow-400 font-medium">haz clic</span>
        </p>
        <p className="text-[10px] text-zinc-600">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />
      </div>
    </div>
  );
}

// --- Helper: parse existing title back into songName/songNameB ---
function parseExistingTitle(title: string, category: Category, artist: string): { songName: string; songNameB: string } {
  const esc = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (category === 'livemashups') {
    // Pattern: {Camelot} {Cancion} ({Artist} Live Mashup {BPM}Bpm)
    const m = title.match(/^(?:\w+\s+)?(.+?)\s*\(.*Live Mashup.*\)$/i);
    if (m) return { songName: m[1].trim(), songNameB: '' };
  }
  if (category === 'extended') {
    const m = title.match(/^(.+?)\s*\(.*Extended.*\)$/i);
    if (m) return { songName: m[1].trim(), songNameB: '' };
  }
  if (category === 'hypeintros') {
    const m = title.match(/^(.+?)\s*\(.*Hype Intro.*\)$/i);
    if (m) return { songName: m[1].trim(), songNameB: '' };
  }
  if (category === 'mashups') {
    // Pattern: {A} X {B} ({Artist} Mashup)
    const m = title.match(/^(.+?)\s+[Xx]\s+(.+?)\s*\(.*Mashup.*\)$/i);
    if (m) return { songName: m[1].trim(), songNameB: m[2].trim() };
  }
  if (category === 'remixes') {
    const m = title.match(/^(.+?)\s*\(.*Remix.*\)$/i);
    if (m) return { songName: m[1].trim(), songNameB: '' };
  }
  if (category === 'transiciones') {
    // Pattern: {A} x {B} ({Artist} Transition {BPMstart}-{BPMend}BPM)
    const m = title.match(/^(.+?)\s+[Xx]\s+(.+?)\s*\(.*Transition.*\)$/i);
    if (m) return { songName: m[1].trim(), songNameB: m[2].trim() };
  }
  if (category === 'sesiones') {
    return { songName: title, songNameB: '' };
  }
  if (category === 'originales') {
    return { songName: title, songNameB: '' };
  }
  // Fallback
  return { songName: title, songNameB: '' };
}

export default function AdminTrackForm({ track, onSave, onCancel, adminToken, defaultArtist, hideCollaboratorCheckbox }: AdminTrackFormProps) {
  const previewGenRef = useRef<PreviewGeneratorHandle>(null);
  const [trackFileBlob, setTrackFileBlob] = useState<Blob | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewLocalUrl, setPreviewLocalUrl] = useState('');
  const [uploadingPreview, setUploadingPreview] = useState(false);

  // Smart title fields
  const [songName, setSongName] = useState('');
  const [songNameB, setSongNameB] = useState('');
  const [bpmStart, setBpmStart] = useState(0);
  const [bpmEnd, setBpmEnd] = useState(0);

  const [form, setForm] = useState({
    title: '',
    artist: defaultArtist || 'Alex Selas',
    authors: '',
    category: 'remixes' as Category,
    price: 1.99,
    bpm: 128,
    key: '',
    genre: '',
    duration: 0,
    releaseDate: new Date().toISOString().split('T')[0],
    description: '',
    coverUrl: 'https://pub-cfc51dd31a2545cab8567d8d24e56ae1.r2.dev/uploads/1777578123001-covers_cover-default.png',
    previewUrl: '',
    fileUrl: '',
    featured: false,
    collaborator: false,
    tags: '',
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{ intensity: number; loudness_lufs: number; energy_curve: number[] } | null>(null);

  // Track which R2 URLs were uploaded in this session (for cleanup on cancel)
  const uploadedUrls = useRef<string[]>([]);

  const isCollaborator = !!hideCollaboratorCheckbox;

  // Auto-generate title based on category
  const autoTitle = useMemo(() => {
    const camelot = form.key ? KEY_TO_CAMELOT[form.key] || '' : '';
    const bpm = form.bpm;
    const artist = form.artist;

    switch (form.category) {
      case 'livemashups':
        return songName
          ? `${camelot ? camelot + ' ' : ''}${songName} (${artist} Live Mashup ${bpm}Bpm)`
          : '';
      case 'extended':
        return songName
          ? `${songName} (${artist} Extended ${bpm}Bpm)`
          : '';
      case 'hypeintros':
        return songName
          ? `${songName} (${artist} Hype Intro ${bpm}Bpm)`
          : '';
      case 'mashups':
        return songName && songNameB
          ? `${songName} X ${songNameB} (${artist} Mashup ${bpm}Bpm)`
          : songName
            ? `${songName} (${artist} Mashup ${bpm}Bpm)`
            : '';
      case 'remixes':
        return songName
          ? `${songName} (${artist} Remix ${bpm}Bpm)`
          : '';
      case 'transiciones':
        return songName && songNameB
          ? `${songName} x ${songNameB} (${artist} Transition ${bpmStart}-${bpmEnd}BPM)`
          : songName
            ? `${songName} (${artist} Transition ${bpmStart}-${bpmEnd}BPM)`
            : '';
      case 'sesiones':
        return songName || '';
      case 'originales':
        return songName || '';
      default:
        return songName || '';
    }
  }, [form.category, form.key, form.bpm, form.artist, songName, songNameB, bpmStart, bpmEnd]);

  const cleanupUploadedFiles = () => {
    const token = sessionStorage.getItem('alex-selas-drops-token') || sessionStorage.getItem('alex-selas-drops-collab-token') || '';
    for (const url of uploadedUrls.current) {
      if (url && !url.startsWith('/') && !url.startsWith('blob:')) {
        fetch('/api/delete-blob', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ url }),
        }).catch(() => {});
      }
    }
    uploadedUrls.current = [];
  };

  const handleCancel = () => {
    // If this is a new track (not editing), clean up any files uploaded to R2
    if (!track) cleanupUploadedFiles();
    onCancel();
  };

  const handleAudioAnalysis = async (file: File) => {
    if (!file.type.startsWith('audio/')) return;
    setAnalyzing(true);
    try {
      // Quick browser analysis first (instant feedback)
      const result = await analyzeAudio(file);
      setForm(prev => ({
        ...prev,
        bpm: result.bpm,
        duration: result.duration,
        key: result.key,
      }));
    } catch (e) {
      console.error('Audio analysis failed:', e);
    } finally {
      setAnalyzing(false);
    }
  };

  // Server-side Modal analysis (more accurate, runs after upload completes)
  const handleModalAnalysis = async (fileUrl: string) => {
    if (!fileUrl || fileUrl.startsWith('blob:')) return;
    setAnalyzing(true);
    try {
      const token = sessionStorage.getItem('alex-selas-drops-token') || sessionStorage.getItem('alex-selas-drops-collab-token') || '';
      const res = await fetch('/api/analyze-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ trackId: 'preview', audioUrl: fileUrl }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        const a = data.analysis;
        setForm(prev => ({
          ...prev,
          bpm: a.bpm > 0 ? a.bpm : prev.bpm,
          key: a.key || prev.key,
          duration: a.duration > 0 ? a.duration : prev.duration,
          // genre: leave for collaborator to fill manually
          tags: a.tags && a.tags.length > 0 ? a.tags.join(', ') : prev.tags,
        }));
        setAiAnalysis({
          intensity: a.intensity || 0,
          loudness_lufs: a.loudness_lufs || 0,
          energy_curve: a.energy_curve || [],
        });
      }
    } catch (e) {
      console.error('Modal analysis failed:', e);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (track) {
      setForm({
        title: track.title,
        artist: track.artist,
        authors: track.authors || '',
        category: track.category,
        price: track.price,
        bpm: track.bpm,
        key: track.key || '',
        genre: track.genre,
        duration: track.duration,
        releaseDate: track.releaseDate,
        description: track.description,
        coverUrl: 'https://pub-cfc51dd31a2545cab8567d8d24e56ae1.r2.dev/uploads/1777578123001-covers_cover-default.png',
        previewUrl: track.previewUrl,
        fileUrl: track.fileUrl,
        featured: track.featured,
        collaborator: track.collaborator || false,
        tags: track.tags.join(', '),
      });

      // Parse existing title back into songName/songNameB
      const parsed = parseExistingTitle(track.title, track.category, track.artist);
      setSongName(parsed.songName);
      setSongNameB(parsed.songNameB);

      // Try to parse bpmStart/bpmEnd for transiciones
      if (track.category === 'transiciones') {
        const bpmMatch = track.title.match(/(\d+)-(\d+)BPM/i);
        if (bpmMatch) {
          setBpmStart(Number(bpmMatch[1]));
          setBpmEnd(Number(bpmMatch[2]));
        } else {
          setBpmStart(track.bpm || 0);
          setBpmEnd(track.bpm || 0);
        }
      }
    }
  }, [track]);

  const generateDescription = async () => {
    const titleForDesc = autoTitle || songName;
    if (!titleForDesc) return;
    setAiLoading(true);
    try {
      const adminToken = sessionStorage.getItem('alex-selas-drops-token') || sessionStorage.getItem('alex-selas-drops-collab-token') || '';
      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title: autoTitle || songName,
          artist: form.artist,
          authors: form.authors,
          category: form.category,
          genre: form.genre,
          bpm: form.bpm,
          userDescription: form.description,
        }),
      });
      const data = await res.json();
      if (data.description) {
        setForm(prev => ({ ...prev, description: data.description }));
      }
    } catch {
      // silently fail
    } finally {
      setAiLoading(false);
    }
  };

  const uploadPreviewBlob = async (blob: Blob): Promise<string> => {
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'X-Filename': `preview-${Date.now()}.mp3`,
          'X-Folder': 'previews',
          'Authorization': `Bearer ${adminToken || ''}`,
        },
        body: blob,
      });
      if (res.ok) {
        const data = await res.json();
        return data.url || '';
      }
    } catch {}
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Stop any audio playing
    previewGenRef.current?.stop();
    setSubmitting(true);

    let finalPreviewUrl = form.previewUrl;

    // If preview blob exists but not uploaded yet, upload it
    if (previewBlob && !form.previewUrl) {
      finalPreviewUrl = await uploadPreviewBlob(previewBlob);
    }

    // If still no preview, auto-generate from PreviewGenerator
    if (!finalPreviewUrl && previewGenRef.current?.isReady()) {
      const blob = await previewGenRef.current.generate();
      if (blob) {
        finalPreviewUrl = await uploadPreviewBlob(blob);
      }
    }

    setSubmitting(false);

    // Validate fileUrl is a real server URL, not a browser blob
    if (form.fileUrl && form.fileUrl.startsWith('blob:')) {
      alert('El archivo MP3 no se subio correctamente. Vuelve a subir el archivo.');
      return;
    }

    // Use auto-generated title
    const finalTitle = autoTitle || songName || form.title;
    const camelot = form.key ? KEY_TO_CAMELOT[form.key] || '' : '';

    // For transiciones, store bpmStart as the bpm
    const finalBpm = form.category === 'transiciones' ? bpmStart : Number(form.bpm);

    onSave({
      ...(track ? { id: track.id } : {}),
      title: finalTitle,
      artist: form.artist,
      authors: form.authors,
      category: form.category,
      price: Number(form.price),
      bpm: finalBpm,
      key: form.key,
      camelot,
      genre: form.genre,
      duration: Number(form.duration),
      releaseDate: form.releaseDate,
      description: form.description,
      coverUrl: 'https://pub-cfc51dd31a2545cab8567d8d24e56ae1.r2.dev/uploads/1777578123001-covers_cover-default.png',
      previewUrl: finalPreviewUrl,
      fileUrl: form.fileUrl,
      featured: form.featured,
      collaborator: form.collaborator,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/25 transition-colors text-sm';

  const readOnlyClass =
    'w-full px-4 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-700/50 text-zinc-400 text-sm cursor-not-allowed';

  // Determine which smart fields to show based on category
  const needsSongNameB = form.category === 'mashups' || form.category === 'transiciones';
  const needsAuthors = form.category !== 'sesiones';
  const needsTransitionBpm = form.category === 'transiciones';
  const isFreeTitle = form.category === 'sesiones' || form.category === 'originales';

  return (
    <div className="bg-[#141414] rounded-[18px] border border-zinc-800/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <Music className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-200">
              {track ? 'Editar Track' : 'Nuevo Track'}
            </h3>
            <p className="text-xs text-zinc-500">
              {track ? 'Modifica los datos y archivos' : 'Rellena la info y sube los archivos'}
            </p>
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-6">
        {/* === ARCHIVOS === */}
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4 text-yellow-400" />
            Archivos
          </h4>
          {/* 1. Cancion */}
          <FileDropZone
            label="Cancion (archivo completo 320kbps)"
            accept="audio/mpeg,audio/mp3,application/zip"
            hint="MP3 o ZIP"
            icon={FileAudio}
            currentUrl={form.fileUrl}
            folder="tracks"
            onUploaded={url => { uploadedUrls.current.push(url); setForm(prev => ({ ...prev, fileUrl: url })); handleModalAnalysis(url); }}
            onClear={() => { setForm(prev => ({ ...prev, fileUrl: '' })); setTrackFileBlob(null); }}
            onFileSelected={(file) => { setTrackFileBlob(file); handleAudioAnalysis(file); }}
          />

          {/* Portada fija */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Portada</label>
            <div className="flex items-center gap-3 p-3 rounded-[14px] bg-zinc-800/50 border border-yellow-400/20">
              <img src="/cover-default.png" alt="Portada MusicDrop" className="w-12 h-12 rounded-xl object-cover" />
              <p className="text-sm text-yellow-400 font-medium">Portada generica MusicDrop</p>
            </div>
          </div>

          {/* 3. Preview — auto-generada al publicar */}
          {(form.previewUrl || previewLocalUrl) ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Preview {previewLocalUrl && !form.previewUrl ? '(se subira al publicar)' : ''}
                </span>
                <button onClick={() => { setForm(prev => ({ ...prev, previewUrl: '' })); setPreviewBlob(null); setPreviewLocalUrl(''); }} className="text-[10px] text-red-400 hover:text-red-300">Eliminar</button>
              </div>
              <audio src={previewLocalUrl || form.previewUrl} controls className="w-full h-8" />
            </div>
          ) : (
            <PreviewGenerator
              ref={previewGenRef}
              fileUrl={form.fileUrl}
              fileBlob={trackFileBlob}
              adminToken={adminToken || ''}
              hideGenerateButton
              onPreviewReady={(blob, _filename) => {
                const localUrl = URL.createObjectURL(blob);
                setPreviewBlob(blob);
                setPreviewLocalUrl(localUrl);
              }}
            />
          )}
        </div>

        {/* Analyzing indicator */}
        {analyzing && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-yellow-400/5 border border-yellow-400/20">
            <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
            <div>
              <p className="text-sm text-yellow-400 font-medium">Analizando audio...</p>
              <p className="text-xs text-zinc-500">Detectando BPM, tonalidad y duracion</p>
            </div>
          </div>
        )}

        {/* AI Analysis Results — read only */}
        {aiAnalysis && (
          <div className="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-2xl space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Analisis IA</h4>
            <div className="grid grid-cols-2 gap-4">
              {/* Intensity */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Intensidad</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-red-500 transition-all" style={{ width: `${aiAnalysis.intensity}%` }} />
                  </div>
                  <span className="text-sm font-black text-zinc-200 w-10 text-right">{aiAnalysis.intensity}</span>
                </div>
              </div>
              {/* Loudness */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Loudness</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-zinc-200">{aiAnalysis.loudness_lufs} LUFS</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${aiAnalysis.loudness_lufs === 0 ? 'bg-zinc-800 text-zinc-500' : aiAnalysis.loudness_lufs > -8 ? 'bg-red-400/15 text-red-400' : aiAnalysis.loudness_lufs > -14 ? 'bg-green-400/15 text-green-400' : 'bg-yellow-400/15 text-yellow-400'}`}>
                    {aiAnalysis.loudness_lufs === 0 ? 'N/A' : aiAnalysis.loudness_lufs > -8 ? 'MUY ALTO' : aiAnalysis.loudness_lufs > -14 ? 'OK' : 'DINAMICO'}
                  </span>
                </div>
              </div>
            </div>
            {/* Energy curve */}
            {aiAnalysis.energy_curve.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Curva de energia</p>
                <div className="flex items-end gap-[3px] h-12">
                  {aiAnalysis.energy_curve.map((v, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-yellow-400/60 to-yellow-400 transition-all" style={{ height: `${v}%` }} />
                  ))}
                </div>
                <div className="flex justify-between text-[8px] text-zinc-600">
                  <span>Inicio</span>
                  <span>Medio</span>
                  <span>Final</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === INFO BASICA === */}
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">Informacion basica</h4>

          {/* Category selector — FIRST, everything depends on this */}
          <div className="mb-4">
            <label className="block text-xs text-zinc-500 mb-1">Categoria</label>
            <select
              value={form.category}
              onChange={e => {
                const cat = e.target.value as Category;
                setForm({ ...form, category: cat });
                // Reset songNameB when switching away from mashup/transicion
                if (cat !== 'mashups' && cat !== 'transiciones') {
                  setSongNameB('');
                }
                if (cat !== 'transiciones') {
                  setBpmStart(0);
                  setBpmEnd(0);
                }
              }}
              className={inputClass}
            >
              <option value="extended">Extended ({CREDIT_COSTS.extended} dr)</option>
              <option value="mashups">Mashup ({CREDIT_COSTS.mashups} dr)</option>
              <option value="livemashups">Live Mashup ({CREDIT_COSTS.livemashups} dr)</option>
              <option value="hypeintros">Hype Intro ({CREDIT_COSTS.hypeintros} dr)</option>
              <option value="transiciones">Transici\u00f3n ({CREDIT_COSTS.transiciones} dr)</option>
              <option value="remixes">Remix ({CREDIT_COSTS.remixes} dr)</option>
              <option value="sesiones">Sesi\u00f3n ({CREDIT_COSTS.sesiones} dr)</option>
              <option value="originales">Original ({CREDIT_COSTS.originales} dr)</option>
            </select>
          </div>

          {/* Smart title fields — change based on category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Song name A (always shown) */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                {form.category === 'mashups' || form.category === 'transiciones'
                  ? 'Canci\u00f3n A *'
                  : form.category === 'sesiones'
                    ? 'Nombre sesi\u00f3n *'
                    : form.category === 'originales'
                      ? 'T\u00edtulo *'
                      : 'Nombre canci\u00f3n *'}
              </label>
              <input
                type="text"
                value={songName}
                onChange={e => setSongName(e.target.value)}
                placeholder={
                  form.category === 'mashups' ? 'Ej: La Conoci Bailando'
                    : form.category === 'transiciones' ? 'Ej: Fantasias'
                    : form.category === 'sesiones' ? 'Ej: WARM UP 1'
                    : form.category === 'originales' ? 'Ej: Midnight Groove'
                    : 'Ej: Adictiva'
                }
                className={inputClass}
                required
              />
            </div>

            {/* Song name B (only for mashup / transicion) */}
            {needsSongNameB && (
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Cancion B *</label>
                <input
                  type="text"
                  value={songNameB}
                  onChange={e => setSongNameB(e.target.value)}
                  placeholder={
                    form.category === 'mashups' ? 'Ej: La Vida Es Un Carnaval'
                      : 'Ej: Aprietala'
                  }
                  className={inputClass}
                  required
                />
              </div>
            )}

            {/* Artistas originales (all except sesiones) */}
            {needsAuthors && (
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Artistas originales</label>
                <input
                  type="text"
                  value={form.authors}
                  onChange={e => setForm({ ...form, authors: e.target.value })}
                  placeholder={
                    form.category === 'mashups' ? 'Ej: Dr.Bellido, Celia Cruz'
                      : 'Ej: Anuel AA, Daddy Yankee'
                  }
                  className={inputClass}
                />
              </div>
            )}

            {/* Productor */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Productor</label>
              <input
                type="text"
                value={form.artist}
                onChange={e => !isCollaborator && setForm({ ...form, artist: e.target.value })}
                className={isCollaborator ? readOnlyClass : inputClass}
                readOnly={isCollaborator}
              />
            </div>
          </div>

          {/* Title preview — auto-generated, read-only highlighted box */}
          {autoTitle && (
            <div className="mb-4">
              <label className="block text-xs text-zinc-500 mb-1">T\u00edtulo final (auto-generado)</label>
              <div
                className="w-full px-4 py-3 rounded-xl border-2 border-yellow-400/60 bg-zinc-900/80"
                style={{ minHeight: '44px' }}
              >
                <span
                  className="text-sm font-bold"
                  style={{
                    background: 'linear-gradient(90deg, #facc15, #f59e0b, #eab308)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {autoTitle}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* === DETALLES === */}
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">Detalles</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Creditos</label>
              <input
                type="number"
                min="0"
                value={CREDIT_COSTS[form.category]}
                className={inputClass}
                disabled
              />
              <p className="text-[10px] text-zinc-600 mt-1">Creditos fijos segun categoria</p>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Genero</label>
              <input
                type="text"
                value={form.genre}
                onChange={e => setForm({ ...form, genre: e.target.value })}
                placeholder="Tech House"
                className={inputClass}
              />
            </div>

            {/* BPM — hidden for transiciones (they have bpmStart/bpmEnd), read-only for collaborators */}
            {!needsTransitionBpm && (
              <div>
                <label className="block text-xs text-zinc-500 mb-1">BPM {isCollaborator ? '(auto)' : ''}</label>
                <input
                  type="number"
                  min="0"
                  value={form.bpm}
                  onChange={e => !isCollaborator && setForm({ ...form, bpm: Number(e.target.value) })}
                  className={isCollaborator ? readOnlyClass : inputClass}
                  readOnly={isCollaborator}
                />
              </div>
            )}

            {/* BPM inicio / fin for transiciones */}
            {needsTransitionBpm && (
              <>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">BPM inicio</label>
                  <input
                    type="number"
                    min="0"
                    value={bpmStart}
                    onChange={e => setBpmStart(Number(e.target.value))}
                    placeholder="128"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">BPM fin</label>
                  <input
                    type="number"
                    min="0"
                    value={bpmEnd}
                    onChange={e => setBpmEnd(Number(e.target.value))}
                    placeholder="130"
                    className={inputClass}
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Tonalidad {isCollaborator ? '(auto)' : ''}</label>
              <input
                type="text"
                value={form.key}
                onChange={e => !isCollaborator && setForm({ ...form, key: e.target.value })}
                placeholder={isCollaborator ? 'Se detecta autom\u00e1ticamente' : 'Am, C, F#m...'}
                className={isCollaborator ? readOnlyClass : inputClass}
                readOnly={isCollaborator}
              />
              {form.key && KEY_TO_CAMELOT[form.key] && (
                <p className="text-[10px] text-yellow-400 mt-1 font-bold">Camelot: {KEY_TO_CAMELOT[form.key]}</p>
              )}
              {isCollaborator && !form.key && (
                <p className="text-[10px] text-zinc-600 mt-1">Se detectara al subir el archivo</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Duraci\u00f3n (seg)</label>
              <input
                type="number"
                min="0"
                value={form.duration}
                className={readOnlyClass}
                readOnly
              />
              {form.duration > 0 && (
                <p className="text-[10px] text-yellow-400/60 mt-1">
                  {Math.floor(form.duration / 60)} min {String(form.duration % 60).padStart(2, '0')} seg
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Fecha lanzamiento</label>
              <input
                type="date"
                value={form.releaseDate}
                onChange={e => setForm({ ...form, releaseDate: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="flex items-end pb-1 gap-6">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={e => setForm({ ...form, featured: e.target.checked })}
                  className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-yellow-400 focus:ring-yellow-400/25 cursor-pointer"
                />
                <span className="text-sm text-zinc-400">Destacado</span>
              </label>
              {!hideCollaboratorCheckbox && (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.collaborator}
                    onChange={e => setForm({ ...form, collaborator: e.target.checked })}
                    className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-violet-400 focus:ring-violet-400/25 cursor-pointer"
                  />
                  <span className="text-sm text-zinc-400">Colaborador</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* === DESCRIPCION === */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-zinc-500">Descripcion</label>
            {!hideCollaboratorCheckbox && (
              <button
                type="button"
                onClick={generateDescription}
                disabled={aiLoading || (!songName && !autoTitle)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                  aiLoading
                    ? 'bg-yellow-400/10 text-yellow-400/50 cursor-wait'
                    : (!songName && !autoTitle)
                      ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                      : 'bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 active:scale-95'
                }`}
              >
                {aiLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {aiLoading ? 'Generando...' : 'Generar con IA'}
              </button>
            )}
          </div>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder={hideCollaboratorCheckbox ? 'Describe tu track...' : 'Escribe unas notas y la IA crear\u00e1 una descripci\u00f3n profesional, o escr\u00edbela t\u00fa directamente...'}
            className={`${inputClass} h-28 resize-none`}
          />
          {!hideCollaboratorCheckbox && (
            <p className="text-[10px] text-zinc-600 mt-1">Puedes escribir notas b\u00e1sicas y darle a "Generar con IA" para obtener una descripci\u00f3n profesional</p>
          )}
        </div>

        {/* === TAGS === */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Tags (separados por coma)</label>
          <input
            type="text"
            value={form.tags}
            onChange={e => setForm({ ...form, tags: e.target.value })}
            placeholder="tech house, dark, deep, live"
            className={inputClass}
          />
        </div>

        {/* === ACCIONES === */}
        <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/50">
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 rounded-2xl gradient-bg text-black font-semibold shadow-lg hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-wait flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Generando preview...' : (track ? 'Guardar Cambios' : 'Generar preview y publicar')}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-3 rounded-2xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
