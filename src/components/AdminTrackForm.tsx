import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image, FileAudio, Music, Trash2, CheckCircle, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import type { Track, Category } from '../types';

interface AdminTrackFormProps {
  track: Track | null;
  onSave: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onCancel: () => void;
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
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<UploadStatus>(currentUrl ? 'done' : 'idle');
  const [fileName, setFileName] = useState('');
  const [localPreview, setLocalPreview] = useState('');

  useEffect(() => {
    if (currentUrl) setStatus('done');
  }, [currentUrl]);

  const uploadFile = async (file: File) => {
    setFileName(file.name);
    setStatus('uploading');

    // Show local preview for images
    if (isImage) {
      setLocalPreview(URL.createObjectURL(file));
    }

    // Try client-side upload to Vercel Blob
    try {
      const { upload } = await import('@vercel/blob/client');
      const blob = await upload(
        `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        file,
        { access: 'public', handleUploadUrl: '/api/upload-url' },
      );
      if (blob.url) {
        onUploaded(blob.url);
        setStatus('done');
        return;
      }
    } catch (e) {
      console.log('Blob client upload failed, trying server:', e);
    }

    // Fallback: server-side upload (local dev)
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'X-Filename': file.name,
          'X-Folder': folder,
          'Content-Type': file.type,
        },
        body: file,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          onUploaded(data.url);
          setStatus('done');
          return;
        }
      }
    } catch (e) {
      console.log('Server upload failed:', e);
    }

    // Last fallback: convert to persistent data URL (base64) for images,
    // or temporary blob URL for non-images
    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => {
        onUploaded(reader.result as string);
        setStatus('done');
      };
      reader.onerror = () => {
        onUploaded(URL.createObjectURL(file));
        setStatus('done');
      };
      reader.readAsDataURL(file);
      return;
    }
    onUploaded(URL.createObjectURL(file));
    setStatus('done');
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

export default function AdminTrackForm({ track, onSave, onCancel }: AdminTrackFormProps) {
  const [form, setForm] = useState({
    title: '',
    artist: 'Alex Selas',
    authors: '',
    category: 'sesiones' as Category,
    price: 9.99,
    bpm: 128,
    genre: '',
    duration: 0,
    releaseDate: new Date().toISOString().split('T')[0],
    description: '',
    coverUrl: '',
    previewUrl: '',
    fileUrl: '',
    featured: false,
    tags: '',
  });

  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (track) {
      setForm({
        title: track.title,
        artist: track.artist,
        authors: track.authors || '',
        category: track.category,
        price: track.price,
        bpm: track.bpm,
        genre: track.genre,
        duration: track.duration,
        releaseDate: track.releaseDate,
        description: track.description,
        coverUrl: track.coverUrl,
        previewUrl: track.previewUrl,
        fileUrl: track.fileUrl,
        featured: track.featured,
        tags: track.tags.join(', '),
      });
    }
  }, [track]);

  const generateDescription = async () => {
    if (!form.title) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...(track ? { id: track.id } : {}),
      title: form.title,
      artist: form.artist,
      authors: form.authors,
      category: form.category,
      price: Number(form.price),
      bpm: Number(form.bpm),
      genre: form.genre,
      duration: Number(form.duration),
      releaseDate: form.releaseDate,
      description: form.description,
      coverUrl: form.coverUrl,
      previewUrl: form.previewUrl,
      fileUrl: form.fileUrl,
      featured: form.featured,
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <FileDropZone
              label="Preview (60s, 128kbps)"
              accept="audio/mpeg,audio/mp3"
              hint="MP3 - máx 60 seg"
              icon={FileAudio}
              currentUrl={form.previewUrl}
              folder="previews"
              onUploaded={url => setForm(prev => ({ ...prev, previewUrl: url }))}
              onClear={() => setForm(prev => ({ ...prev, previewUrl: '' }))}
            />
            <FileDropZone
              label="Archivo completo (320kbps)"
              accept="audio/mpeg,audio/mp3,application/zip"
              hint="MP3 o ZIP"
              icon={FileAudio}
              currentUrl={form.fileUrl}
              folder="tracks"
              onUploaded={url => setForm(prev => ({ ...prev, fileUrl: url }))}
              onClear={() => setForm(prev => ({ ...prev, fileUrl: '' }))}
            />
          </div>
        </div>

        {/* === INFO BÁSICA === */}
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">Información básica</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Título *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Nombre del track"
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
                onChange={e => setForm({ ...form, category: e.target.value as Category })}
                className={inputClass}
              >
                <option value="sesiones">Sesión</option>
                <option value="remixes">Remix</option>
                <option value="mashups">Mashup</option>
                <option value="librerias">Librería</option>
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
              />
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Duración (seg)</label>
              <input
                type="number"
                min="0"
                value={form.duration}
                onChange={e => setForm({ ...form, duration: Number(e.target.value) })}
                className={inputClass}
              />
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
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={e => setForm({ ...form, featured: e.target.checked })}
                  className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-yellow-400 focus:ring-yellow-400/25 cursor-pointer"
                />
                <span className="text-sm text-zinc-400">Destacado en portada</span>
              </label>
            </div>
          </div>
        </div>

        {/* === DESCRIPCIÓN === */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-zinc-500">Descripción</label>
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
          </div>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Escribe unas notas y la IA creará una descripción profesional, o escríbela tú directamente..."
            className={`${inputClass} h-28 resize-none`}
          />
          <p className="text-[10px] text-zinc-600 mt-1">Puedes escribir notas básicas y darle a "Generar con IA" para obtener una descripción profesional</p>
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
            className="px-8 py-3 rounded-2xl gradient-bg text-black font-semibold shadow-lg hover:scale-[1.02] active:scale-95 transition-transform"
          >
            {track ? 'Guardar Cambios' : 'Publicar Track'}
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
