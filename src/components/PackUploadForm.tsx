import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Image, FileAudio, Music, Plus, Trash2, Loader2, Play, Pause, Scissors, CheckCircle } from 'lucide-react';
import type { Track, Category } from '../types';
import { analyzeAudio } from '../lib/audioAnalyzer';
import { PreviewGenerator, type PreviewGeneratorHandle } from './PreviewGenerator';

interface PackUploadFormProps {
  onSavePack: (tracks: (Omit<Track, 'id'> & { id?: string })[]) => Promise<void> | void;
  onCancel: () => void;
  adminToken?: string;
  defaultArtist?: string;
  hideCollaboratorCheckbox?: boolean;
  existingTracks?: Track[];
}

interface PackTrack {
  file: File | null;
  title: string;
  artist: string;
  authors: string;
  bpm: number;
  key: string;
  duration: number;
  genre: string;
  fileUrl: string;
  previewUrl: string;
  analyzing: boolean;
}

const MAX_TRACKS = 10;

export default function PackUploadForm({ onSavePack, onCancel, adminToken, defaultArtist, hideCollaboratorCheckbox, existingTracks }: PackUploadFormProps) {
  const isEditing = !!existingTracks && existingTracks.length > 0;
  const first = existingTracks?.[0];

  const [packTitle, setPackTitle] = useState(first?.packName || '');
  const [artist, setArtist] = useState(first?.artist || defaultArtist || 'Alex Selas');
  const [authors, setAuthors] = useState(first?.authors || '');
  const [category, setCategory] = useState<Category>(first?.category || 'remixes');
  const [price, setPrice] = useState(isEditing ? existingTracks!.reduce((s, t) => s + t.price, 0) : 3.99);
  const [description, setDescription] = useState(first?.description || '');
  const [tags, setTags] = useState(first?.tags?.join(', ') || '');
  const [featured, setFeatured] = useState(first?.featured || false);
  const [releaseDate, setReleaseDate] = useState(first?.releaseDate || new Date().toISOString().split('T')[0]);

  const [coverUrl, setCoverUrl] = useState(first?.coverUrl || '');
  const [coverPreview, setCoverPreview] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);

  const [tracks, setTracks] = useState<PackTrack[]>(
    isEditing
      ? existingTracks!.map(t => ({ file: null, title: t.title, artist: t.artist || artist, authors: t.authors || authors, bpm: t.bpm, key: t.key || '', duration: t.duration, genre: t.genre, fileUrl: t.fileUrl, previewUrl: t.previewUrl, analyzing: false }))
      : []
  );
  const [submitting, setSubmitting] = useState(false);
  const tracksRef = useRef(tracks);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  const [playingIdx, setPlayingIdx] = useState(-1);
  const [previewOpenIdx, setPreviewOpenIdx] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackInputRef = useRef<HTMLInputElement>(null);
  const previewGenRefs = useRef<(PreviewGeneratorHandle | null)[]>([]);

  const getToken = () => adminToken || sessionStorage.getItem('alex-selas-drops-token') || sessionStorage.getItem('alex-selas-drops-collab-token') || '';

  const [uploadError, setUploadError] = useState('');

  // Upload a file
  const uploadFile = async (file: File | Blob, folder: string, filename: string): Promise<string> => {
    setUploadError('');
    try {
      const { uploadFile: doUpload } = await import('../lib/upload');
      const url = await doUpload(file as File, folder, `${Date.now()}-${filename}`, getToken());
      if (url) return url;
    } catch (e: any) {
      console.error('Upload error:', e);
    }
    setUploadError('Error al subir archivo. Comprueba tu conexion e intenta de nuevo.');
    return '';
  };

  // Compress image if > 1MB
  const compressImage = (file: File, maxSizeKB = 1024): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/') || file.size <= maxSizeKB * 1024) { resolve(file); return; }
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        const maxDim = 1200;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (blob && blob.size < file.size) resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
          else resolve(file);
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  // Cover upload
  const handleCoverSelect = async (rawFile: File) => {
    const file = await compressImage(rawFile);
    setCoverPreview(URL.createObjectURL(file));
    setUploadingCover(true);
    const url = await uploadFile(file, 'covers', file.name.replace(/[^a-zA-Z0-9._-]/g, '_'));
    if (url) setCoverUrl(url);
    setCoverPreview('');
    setUploadingCover(false);
  };

  // Add track files
  const handleAddTracks = (files: FileList) => {
    const remaining = MAX_TRACKS - tracks.length;
    const newFiles = Array.from(files).slice(0, remaining);

    // Create all tracks at once with unique IDs to match them later
    const newTracks: PackTrack[] = newFiles.map(file => ({
      file,
      title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      artist,
      authors,
      bpm: 0, key: '', duration: 0, genre: '',
      fileUrl: '', previewUrl: '', analyzing: true,
    }));

    // Add all to state in one call
    setTracks(prev => [...prev, ...newTracks]);

    // Launch upload + analyze for each, matching by file reference
    newFiles.forEach((file) => {
      Promise.all([
        uploadFile(file, 'tracks', file.name.replace(/[^a-zA-Z0-9._-]/g, '_')),
        analyzeAudio(file).catch(() => ({ bpm: 0, duration: 0, key: '' })),
      ]).then(([url, analysis]) => {
        setTracks(prev => prev.map(t =>
          t.file === file && t.analyzing
            ? { ...t, fileUrl: url, bpm: analysis.bpm, duration: analysis.duration, key: analysis.key, analyzing: false }
            : t
        ));
      });
    });
  };

  const removeTrack = (idx: number) => {
    setTracks(prev => prev.filter((_, i) => i !== idx));
    if (playingIdx === idx) { audioRef.current?.pause(); setPlayingIdx(-1); }
  };

  const updateTrack = (idx: number, field: string, value: any) => {
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  // Stop all audio: track playback + all preview generators
  const stopAllAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingIdx(-1);
    previewGenRefs.current.forEach(ref => ref?.stop());
  };

  const togglePlay = (idx: number) => {
    if (playingIdx === idx) {
      audioRef.current?.pause();
      setPlayingIdx(-1);
    } else {
      stopAllAudio();
      const t = tracks[idx];
      if (t.file) {
        const a = new Audio(URL.createObjectURL(t.file));
        a.play();
        audioRef.current = a;
        a.onended = () => setPlayingIdx(-1);
        setPlayingIdx(idx);
      }
    }
  };

  const handlePreviewReady = async (idx: number, blob: Blob) => {
    const url = await uploadFile(blob, 'previews', `preview-pack-${Date.now()}-${idx}.mp3`);
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, previewUrl: url } : t));
    setPreviewOpenIdx(-1);
  };

  const [generatingPreviews, setGeneratingPreviews] = useState(false);
  const [previewProgress, setPreviewProgress] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tracks.length < 5 || !packTitle) return;

    // Verify all tracks have fileUrl (upload completed)
    const uploading = tracksRef.current.filter(t => t.analyzing);
    const missingFiles = tracksRef.current.filter(t => !t.fileUrl && !t.analyzing);
    if (uploading.length > 0) {
      alert(`${uploading.length} archivo(s) se estan subiendo todavia. Espera a que terminen.`);
      return;
    }
    if (missingFiles.length > 0) {
      alert(`${missingFiles.length} archivo(s) no se subieron correctamente. Elimina esos tracks y vuelve a anadirlos.`);
      return;
    }

    stopAllAudio();
    setSubmitting(true);

    // Wait for all track uploads + analysis to finish (up to 60s)
    if (tracksRef.current.some(t => t.analyzing)) {
      setPreviewProgress('Esperando a que se suban todos los archivos...');
      setGeneratingPreviews(true);
      for (let wait = 0; wait < 120 && tracksRef.current.some(t => t.analyzing); wait++) {
        await new Promise(r => setTimeout(r, 500));
      }
      setGeneratingPreviews(false);
      setPreviewProgress('');
    }

    // Final check: all tracks must have fileUrl
    const stillMissing = tracksRef.current.filter(t => !t.fileUrl);
    if (stillMissing.length > 0) {
      alert(`Error: ${stillMissing.length} archivo(s) no se subieron correctamente. Intenta de nuevo.`);
      setSubmitting(false);
      return;
    }

    // Generate previews for tracks that don't have one yet (use ref for latest state)
    const latestTracks = tracksRef.current;
    const tracksNeedingPreview = latestTracks.map((t, i) => ({ track: t, idx: i })).filter(({ track }) => !track.previewUrl && !track.analyzing);
    if (tracksNeedingPreview.length > 0) {
      setGeneratingPreviews(true);
      for (const { idx } of tracksNeedingPreview) {
        const ref = previewGenRefs.current[idx];
        if (!ref) continue;
        // Wait for the PreviewGenerator to finish loading audio (up to 15s)
        if (!ref.isReady()) {
          setPreviewProgress(`Cargando audio ${idx + 1}/${latestTracks.length}...`);
          for (let wait = 0; wait < 30 && !ref.isReady(); wait++) {
            await new Promise(r => setTimeout(r, 500));
          }
        }
        if (ref.isReady()) {
          setPreviewProgress(`Generando preview ${idx + 1}/${latestTracks.length}...`);
          const blob = await ref.generate();
          if (blob) {
            const url = await uploadFile(blob, 'previews', `preview-pack-${Date.now()}-${idx}.mp3`);
            setTracks(prev => prev.map((t, i) => i === idx ? { ...t, previewUrl: url } : t));
          }
        }
      }
      setGeneratingPreviews(false);
      setPreviewProgress('');
      // Wait a tick for tracksRef to sync
      await new Promise(r => setTimeout(r, 100));
    }

    // Build final tracks with latest preview URLs (use ref for fresh state)
    const finalCover = coverUrl || coverPreview;
    const packId = first?.packId || `pack-${Date.now()}`;
    const currentTracks = [...tracksRef.current];
    const result: (Omit<Track, 'id'> & { id?: string })[] = currentTracks.map((t, i) => ({
      id: existingTracks?.[i]?.id,
      title: t.title || `${packTitle} - ${i + 1}`,
      artist: artist,
      authors: t.authors || '',
      category,
      price: i === 0 ? price : 0,
      bpm: t.bpm,
      key: t.key,
      genre: t.genre || category,
      duration: t.duration,
      releaseDate,
      description: i === 0 ? description : '',
      coverUrl: finalCover,
      previewUrl: t.previewUrl,
      fileUrl: t.fileUrl,
      featured: i === 0 ? featured : false,
      tags: tags.split(',').map(s => s.trim()).filter(Boolean),
      packId,
      packName: packTitle,
    }));

    await onSavePack(result);
    setSubmitting(false);
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-yellow-400/50 text-sm';

  return (
    <div className="bg-[#141414] rounded-[18px] border border-zinc-800/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <Music className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-200">{isEditing ? 'Editar Pack' : 'Nuevo Pack'}</h3>
            <p className="text-xs text-zinc-500">{isEditing ? `${tracks.length} canciones` : 'Una portada, minimo 5 canciones (max 10)'}</p>
          </div>
        </div>
        <button onClick={onCancel} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* Cover */}
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">Portada del pack</h4>
          <div className="flex items-center gap-4">
            <div
              className="relative w-24 h-24 rounded-xl border-2 border-dashed border-zinc-700 overflow-hidden cursor-pointer group flex-shrink-0 transition-colors hover:border-zinc-600"
              onClick={() => coverRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-yellow-400/50', 'bg-yellow-400/5'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('border-yellow-400/50', 'bg-yellow-400/5'); }}
              onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-yellow-400/50', 'bg-yellow-400/5'); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleCoverSelect(f); }}
            >
              {(coverPreview || coverUrl) ? (
                <img src={coverPreview || coverUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-800/50 flex items-center justify-center">
                  <Image className="w-8 h-8 text-zinc-600 group-hover:text-yellow-400 transition-colors" />
                </div>
              )}
              {uploadingCover && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="text-xs text-zinc-500">
              <p>JPG, PNG o WebP</p>
              <p>Se usará para todos los tracks del pack</p>
            </div>
            <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { if (e.target.files?.[0]) handleCoverSelect(e.target.files[0]); }} />
          </div>
        </div>

        {/* Pack info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Nombre del pack *</label>
            <input type="text" value={packTitle} onChange={e => setPackTitle(e.target.value)} placeholder="Mi Pack Vol. 1" className={inputClass} required />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Productor</label>
            <input type="text" value={artist} onChange={e => setArtist(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Categoría</label>
            <select value={category} onChange={e => {
              const cat = e.target.value as Category;
              setCategory(cat);
              const defaultPrices: Record<string, number> = { remixes: 1.99, mashups: 0.99, livemashups: 0.99, hypeintros: 0.99, transiciones: 0.99, sesiones: 4.99, packs: 3.99, originales: price };
              if (!isEditing) setPrice(defaultPrices[cat] ?? price);
            }} className={inputClass}>
              <option value="remixes">Remix (1,99 EUR/track)</option>
              <option value="mashups">Mashup (0,99 EUR/track)</option>
              <option value="livemashups">Live Mashup (0,99 EUR/track)</option>
              <option value="hypeintros">Hype Intro (0,99 EUR/track)</option>
              <option value="transiciones">Transicion (0,99 EUR/track)</option>
              <option value="sesiones">Sesion (4,99 EUR/track)</option>
              <option value="packs">Pack (3,99 EUR)</option>
              <option value="originales">Original (precio libre)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Precio pack (EUR)</label>
            <input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Fecha</label>
            <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} className={inputClass} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-yellow-400 focus:ring-yellow-400/25 cursor-pointer" />
              <span className="text-sm text-zinc-400">Destacado</span>
            </label>
          </div>
        </div>

        {/* Description + Tags */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Descripción</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción del pack..." className={`${inputClass} h-20 resize-none`} />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Tags (separados por coma)</label>
          <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="tech house, remix, pack" className={inputClass} />
        </div>

        {/* ====== TRACKS ====== */}
        <div>
          {uploadError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-3">
              {uploadError}
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-zinc-300">Canciones ({tracks.length}/{MAX_TRACKS})</h4>
            {tracks.length < MAX_TRACKS && (
              <button type="button" onClick={() => trackInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs hover:border-yellow-400/30 transition-colors">
                <Plus className="w-3.5 h-3.5" />
                Añadir
              </button>
            )}
          </div>

          <input ref={trackInputRef} type="file" accept="audio/mpeg,audio/mp3" multiple className="hidden" onChange={e => { if (e.target.files) handleAddTracks(e.target.files); if (trackInputRef.current) trackInputRef.current.value = ''; }} />

          {tracks.length === 0 ? (
            <div
              className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-yellow-400/30 transition-colors"
              onClick={() => trackInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-yellow-400/50', 'bg-yellow-400/5'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('border-yellow-400/50', 'bg-yellow-400/5'); }}
              onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-yellow-400/50', 'bg-yellow-400/5'); const files = e.dataTransfer.files; if (files.length) handleAddTracks(files); }}
            >
              <FileAudio className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">Haz clic o arrastra tus canciones aquí</p>
              <p className="text-[10px] text-zinc-600 mt-1">MP3 · Máximo 10 canciones</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tracks.map((t, i) => (
                <div key={i} className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    {/* Number */}
                    <span className="text-xs text-zinc-600 font-bold w-5 text-center flex-shrink-0">{i + 1}</span>

                    {/* Play preview */}
                    <button type="button" onClick={() => togglePlay(i)} disabled={!t.file} className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors">
                      {playingIdx === i ? <Pause className="w-3.5 h-3.5 text-yellow-400" /> : <Play className="w-3.5 h-3.5 text-zinc-400 ml-0.5" />}
                    </button>

                    {/* Info fields */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input
                        type="text"
                        value={t.title}
                        onChange={e => updateTrack(i, 'title', e.target.value)}
                        placeholder="Solo titulo, sin artistas"
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-yellow-400/50"
                      />
                      <input
                        type="text"
                        value={t.authors}
                        onChange={e => updateTrack(i, 'authors', e.target.value)}
                        placeholder="Artistas originales"
                        className="w-full px-3 py-1 rounded-lg bg-zinc-800/30 border border-zinc-800 text-zinc-300 text-xs focus:outline-none focus:border-yellow-400/50"
                      />
                    </div>

                    {/* Status */}
                    {t.analyzing ? (
                      <Loader2 className="w-4 h-4 text-yellow-400 animate-spin flex-shrink-0" />
                    ) : (
                      <span className="text-[10px] text-zinc-500 flex-shrink-0 hidden sm:block">
                        {t.bpm > 0 ? `${t.bpm} BPM` : ''}
                        {t.key ? ` · ${t.key}` : ''}
                      </span>
                    )}

                    {/* Preview status */}
                    {t.previewUrl && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 flex-shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Preview</span>
                      </span>
                    )}

                    {/* Remove */}
                    <button type="button" onClick={() => removeTrack(i)} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Preview generator — always visible once track is loaded */}
                  {t.file && !t.analyzing && !t.previewUrl && (
                    <div className="px-3 pb-3 border-t border-zinc-800/30 pt-3">
                      <PreviewGenerator
                        ref={el => { previewGenRefs.current[i] = el; }}
                        fileUrl=""
                        fileBlob={t.file}
                        onPreviewReady={(blob) => handlePreviewReady(i, blob)}
                        adminToken={adminToken || ''}
                        hideGenerateButton
                        onPlayStart={() => stopAllAudio()}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Add more — click or drag */}
              {tracks.length < MAX_TRACKS && (
                <div
                  onClick={() => trackInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-yellow-400/50', 'bg-yellow-400/5', 'text-yellow-400'); }}
                  onDragLeave={e => { e.currentTarget.classList.remove('border-yellow-400/50', 'bg-yellow-400/5', 'text-yellow-400'); }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-yellow-400/50', 'bg-yellow-400/5', 'text-yellow-400'); const files = e.dataTransfer.files; if (files.length) handleAddTracks(files); }}
                  className="w-full p-3 rounded-xl border border-dashed border-zinc-700 text-zinc-500 text-sm hover:border-yellow-400/30 hover:text-yellow-400 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Arrastra o haz clic para añadir más ({MAX_TRACKS - tracks.length} restantes)
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/50">
          <button
            type="submit"
            disabled={submitting || tracks.length < 5 || !packTitle}
            className="px-8 py-3 rounded-2xl gradient-bg text-black font-semibold shadow-lg hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {generatingPreviews ? previewProgress : isEditing ? `Guardar cambios (${tracks.length} tracks)` : `Generar previews y publicar (${tracks.length} tracks)`}
          </button>
          <button type="button" onClick={onCancel} className="px-6 py-3 rounded-2xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
