import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image, FileAudio, Music, Trash2, CheckCircle, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import type { Track, Category } from '../types';
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

export default function AdminTrackForm({ track, onSave, onCancel, adminToken, defaultArtist, hideCollaboratorCheckbox }: AdminTrackFormProps) {
  const previewGenRef = useRef<PreviewGeneratorHandle>(null);
  const [trackFileBlob, setTrackFileBlob] = useState<Blob | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewLocalUrl, setPreviewLocalUrl] = useState('');
  const [uploadingPreview, setUploadingPreview] = useState(false);
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
    coverUrl: '',
    previewUrl: '',
    fileUrl: '',
    featured: false,
    collaborator: false,
    tags: '',
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{ danceability: number; loudness_lufs: number; energy_curve: number[] } | null>(null);

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
          danceability: a.danceability || 0,
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
        coverUrl: track.coverUrl,
        previewUrl: track.previewUrl,
        fileUrl: track.fileUrl,
        featured: track.featured,
        collaborator: track.collaborator || false,
        tags: track.tags.join(', '),
      });
    }
  }, [track]);

  const generateDescription = async () => {
    if (!form.title) return;
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
          title: form.title,
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

    onSave({
      ...(track ? { id: track.id } : {}),
      title: form.title,
      artist: form.artist,
      authors: form.authors,
      category: form.category,
      price: Number(form.price),
      bpm: Number(form.bpm),
      key: form.key,
      genre: form.genre,
      duration: Number(form.duration),
      releaseDate: form.releaseDate,
      description: form.description,
      coverUrl: form.coverUrl,
      previewUrl: finalPreviewUrl,
      fileUrl: form.fileUrl,
      featured: form.featured,
      collaborator: form.collaborator,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/25 transition-colors text-sm';

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
          onClick={onCancel}
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
          {/* 1. Canción */}
          <FileDropZone
            label="Canción (archivo completo 320kbps)"
            accept="audio/mpeg,audio/mp3,application/zip"
            hint="MP3 o ZIP"
            icon={FileAudio}
            currentUrl={form.fileUrl}
            folder="tracks"
            onUploaded={url => { setForm(prev => ({ ...prev, fileUrl: url })); handleModalAnalysis(url); }}
            onClear={() => { setForm(prev => ({ ...prev, fileUrl: '' })); setTrackFileBlob(null); }}
            onFileSelected={(file) => { setTrackFileBlob(file); handleAudioAnalysis(file); }}
          />

          {/* 2. Portada */}
          <FileDropZone
            label="Portada (imagen)"
            accept="image/jpeg,image/png,image/webp"
            hint="JPG, PNG o WebP"
            icon={Image}
            currentUrl={form.coverUrl}
            isImage
            folder="covers"
            onUploaded={url => setForm(prev => ({ ...prev, coverUrl: url }))}
            onClear={() => setForm(prev => ({ ...prev, coverUrl: '' }))}
          />

          {/* 3. Preview — auto-generada al publicar */}
          {(form.previewUrl || previewLocalUrl) ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Preview {previewLocalUrl && !form.previewUrl ? '(se subirá al publicar)' : ''}
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
              <p className="text-xs text-zinc-500">Detectando BPM, tonalidad y duración</p>
            </div>
          </div>
        )}

        {/* AI Analysis Results — read only */}
        {aiAnalysis && (
          <div className="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-2xl space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Análisis IA</h4>
            <div className="grid grid-cols-2 gap-4">
              {/* Danceability */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Bailabilidad</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-green-400 transition-all" style={{ width: `${aiAnalysis.danceability}%` }} />
                  </div>
                  <span className="text-sm font-black text-zinc-200 w-10 text-right">{aiAnalysis.danceability}</span>
                </div>
              </div>
              {/* Loudness */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Loudness</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-zinc-200">{aiAnalysis.loudness_lufs} LUFS</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${aiAnalysis.loudness_lufs === 0 ? 'bg-zinc-800 text-zinc-500' : aiAnalysis.loudness_lufs > -8 ? 'bg-red-400/15 text-red-400' : aiAnalysis.loudness_lufs > -14 ? 'bg-green-400/15 text-green-400' : 'bg-yellow-400/15 text-yellow-400'}`}>
                    {aiAnalysis.loudness_lufs === 0 ? 'N/A' : aiAnalysis.loudness_lufs > -8 ? 'MUY ALTO' : aiAnalysis.loudness_lufs > -14 ? 'OK' : 'DINÁMICO'}
                  </span>
                </div>
              </div>
            </div>
            {/* Energy curve */}
            {aiAnalysis.energy_curve.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Curva de energía</p>
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

        {/* === INFO BÁSICA === */}
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">Información básica</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Titulo * (solo el nombre de la cancion, no pongas artistas)</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Ej: La Bicicleta Remix 125Bpm"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Productor</label>
              <input
                type="text"
                value={form.artist}
                onChange={e => setForm({ ...form, artist: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Autores originales</label>
              <input
                type="text"
                value={form.authors}
                onChange={e => setForm({ ...form, authors: e.target.value })}
                placeholder="Drake, Bad Bunny..."
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* === DETALLES === */}
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">Detalles</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Categoría</label>
              <select
                value={form.category}
                onChange={e => {
                  const cat = e.target.value as Category;
                  const defaultPrices: Record<string, number> = { remixes: 1.99, mashups: 0.99, livemashups: 0.99, hypeintros: 0.99, transiciones: 0.99, sesiones: 4.99, originales: form.price };
                  setForm({ ...form, category: cat, price: defaultPrices[cat] ?? form.price });
                }}
                className={inputClass}
              >
                <option value="remixes">Remix (1,99 EUR)</option>
                <option value="mashups">Mashup (0,99 EUR)</option>
                <option value="livemashups">Live Mashup (0,99 EUR)</option>
                <option value="hypeintros">Hype Intro (0,99 EUR)</option>
                <option value="transiciones">Transicion (0,99 EUR)</option>
                <option value="sesiones">Sesion (4,99 EUR)</option>
                <option value="originales">Original (precio libre)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Precio (EUR) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                className={inputClass}
                required
                disabled={form.category !== 'librerias' && form.category !== 'originales'}
              />
              {form.category !== 'librerias' && form.category !== 'originales' && (
                <p className="text-[10px] text-zinc-600 mt-1">Precio fijo para esta categoria</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Género</label>
              <input
                type="text"
                value={form.genre}
                onChange={e => setForm({ ...form, genre: e.target.value })}
                placeholder="Tech House"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">BPM</label>
              <input
                type="number"
                min="0"
                value={form.bpm}
                onChange={e => setForm({ ...form, bpm: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Tonalidad</label>
              <input
                type="text"
                value={form.key}
                onChange={e => setForm({ ...form, key: e.target.value })}
                placeholder="Am, C, F#m..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Duración (seg)</label>
              <input
                type="number"
                min="0"
                value={form.duration}
                onChange={e => setForm({ ...form, duration: Number(e.target.value) })}
                className={inputClass}
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

        {/* === DESCRIPCIÓN === */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-zinc-500">Descripción</label>
            {!hideCollaboratorCheckbox && (
              <button
                type="button"
                onClick={generateDescription}
                disabled={aiLoading || !form.title}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                  aiLoading
                    ? 'bg-yellow-400/10 text-yellow-400/50 cursor-wait'
                    : !form.title
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
            placeholder={hideCollaboratorCheckbox ? 'Describe tu track...' : 'Escribe unas notas y la IA creará una descripción profesional, o escríbela tú directamente...'}
            className={`${inputClass} h-28 resize-none`}
          />
          {!hideCollaboratorCheckbox && (
            <p className="text-[10px] text-zinc-600 mt-1">Puedes escribir notas básicas y darle a "Generar con IA" para obtener una descripción profesional</p>
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
            onClick={onCancel}
            className="px-6 py-3 rounded-2xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
