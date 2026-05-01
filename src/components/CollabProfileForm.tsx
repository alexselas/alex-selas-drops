import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Save, Loader2, CheckCircle, Upload, Trash2, Image,
  User, Link, Instagram,
} from 'lucide-react';
import type { CollaboratorProfile } from '../types';
import ImageCropper from './ImageCropper';

interface CollabProfileFormProps {
  collaboratorId: string;
  collaboratorName: string;
  collabToken: string;
  adminEditCollabId?: string;
}

export default function CollabProfileForm({ collaboratorId, collaboratorName, collabToken, adminEditCollabId }: CollabProfileFormProps) {
  const profileId = adminEditCollabId || collaboratorId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [localPreview, setLocalPreview] = useState('');
  const [cropperImage, setCropperImage] = useState('');
  const [cropperMode, setCropperMode] = useState<'photo' | 'banner'>('photo');
  const [originalImage, setOriginalImage] = useState('');
  const [localBannerPreview, setLocalBannerPreview] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [originalBanner, setOriginalBanner] = useState('');
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const [bannerDragOver, setBannerDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CollaboratorProfile>({
    bio: '',
    photoUrl: '',
    bannerUrl: '',
    artistName: '',
    socialLinks: {},
    colorPrimary: '#8b5cf6',
    colorSecondary: '#f59e0b',
  });

  useEffect(() => {
    fetch(`/api/collab-profile?id=${profileId}`)
      .then(r => r.json())
      .then(data => {
        if (data) setForm(prev => ({ ...prev, ...data }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId]);

  // When file is selected, open the cropper
  const handleFileSelected = (file: File) => {
    const url = URL.createObjectURL(file);
    setOriginalImage(url);
    setCropperImage(url);
  };

  // Re-edit: reopen cropper with original image
  const handleReEdit = () => {
    if (originalImage) setCropperImage(originalImage);
  };

  // After cropping, upload the result
  const handleCroppedImage = async (blob: Blob) => {
    const mode = cropperMode;
    setCropperImage('');
    const previewUrl = URL.createObjectURL(blob);
    const isBanner = mode === 'banner';

    if (isBanner) { setLocalBannerPreview(previewUrl); setUploadingBanner(true); }
    else { setLocalPreview(previewUrl); setUploadingPhoto(true); }

    const field = isBanner ? 'bannerUrl' : 'photoUrl';
    const folder = isBanner ? 'collab-banners' : 'collab-photos';
    const filename = isBanner ? 'banner' : 'profile';
    const clearPreview = () => { if (isBanner) setLocalBannerPreview(''); else setLocalPreview(''); };
    const stopLoading = () => { if (isBanner) setUploadingBanner(false); else setUploadingPhoto(false); };
    const setUrl = (url: string) => setForm(prev => ({ ...prev, [field]: url }));

    // Upload to R2 via server
    try {
      const { uploadFile } = await import('../lib/upload');
      const url = await uploadFile(blob as any, folder, `${Date.now()}-${filename}.jpg`, collabToken);
      if (url) { setUrl(url); clearPreview(); stopLoading(); return; }
    } catch (e) {
      console.log('Upload failed, using base64:', e);
    }

    // Last fallback: base64 data URL
    const reader = new FileReader();
    reader.onload = () => { setUrl(reader.result as string); clearPreview(); stopLoading(); };
    reader.onerror = () => stopLoading();
    reader.readAsDataURL(blob);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${collabToken}`,
      };
      if (adminEditCollabId) {
        headers['X-Admin-Edit-Collab'] = adminEditCollabId;
      }
      await fetch('/api/collab-profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/25 transition-colors text-sm';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Photo + Logo side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Photo */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
          <h3 className="text-xs font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-yellow-400" />
            Foto de perfil
          </h3>
          <div className="flex flex-col items-center gap-3">
            <div
              className={`relative w-28 h-28 rounded-full border-3 overflow-hidden cursor-pointer group transition-colors ${photoDragOver ? 'border-yellow-400/50 bg-yellow-400/5' : 'border-zinc-700'}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setPhotoDragOver(true); }}
              onDragLeave={() => setPhotoDragOver(false)}
              onDrop={e => { e.preventDefault(); setPhotoDragOver(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleFileSelected(f); }}
            >
              {(localPreview || form.photoUrl) ? (
                <img src={localPreview || form.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                  <User className="w-10 h-10 text-zinc-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploadingPhoto ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-white" />
                )}
              </div>
            </div>
            {(form.photoUrl || localPreview) && (
              <div className="flex gap-2">
                {originalImage && (
                  <button type="button" onClick={() => handleReEdit()} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-yellow-400/30 transition-colors">
                    Editar
                  </button>
                )}
                <button type="button" onClick={() => { setForm(prev => ({ ...prev, photoUrl: '' })); setLocalPreview(''); setOriginalImage(''); }} className="text-[10px] px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors">
                  Eliminar
                </button>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); if (fileRef.current) fileRef.current.value = ''; }} />
          </div>
        </div>

        {/* Artist name */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
          <h3 className="text-xs font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-yellow-400" />
            Nombre artístico
          </h3>
          <input
            type="text"
            value={form.artistName}
            onChange={e => setForm(prev => ({ ...prev, artistName: e.target.value }))}
            placeholder={collaboratorName}
            className={inputClass}
          />
          <p className="text-[10px] text-zinc-500 mt-1.5">Aparecerá en mayúsculas en tu página</p>
        </div>
      </div>

      {/* Background photo + Bio side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Background photo */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
          <h3 className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-2">
            <Image className="w-3.5 h-3.5 text-yellow-400" />
            Fondo de tu página
          </h3>
          <div
            className={`relative w-full rounded-lg overflow-hidden cursor-pointer group border mb-2 transition-colors ${bannerDragOver ? 'border-yellow-400/50 bg-yellow-400/5' : 'border-zinc-700'}`}
            style={{ aspectRatio: '1920/720' }}
            onClick={() => bannerFileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setBannerDragOver(true); }}
            onDragLeave={() => setBannerDragOver(false)}
            onDrop={e => { e.preventDefault(); setBannerDragOver(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) { const url = URL.createObjectURL(f); setOriginalBanner(url); setCropperMode('banner'); setCropperImage(url); } }}
          >
            {(localBannerPreview || form.bannerUrl) ? (
              <>
                <img src={localBannerPreview || form.bannerUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-black text-xs uppercase tracking-wider drop-shadow">{form.artistName || collaboratorName}</span>
                </div>
              </>
            ) : (
              <div className="w-full h-full bg-zinc-800/50 flex flex-col items-center justify-center gap-1">
                <Upload className="w-5 h-5 text-zinc-600 group-hover:text-yellow-400 transition-colors" />
                <span className="text-[9px] text-zinc-600">Subir foto</span>
                <span className="text-[9px] text-zinc-600">1920 × 720 px</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploadingBanner ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Upload className="w-4 h-4 text-white" />}
            </div>
          </div>
          <p className="text-[10px] text-zinc-600 mb-1">Resolucion minima recomendada: 1920 x 720 px. Imagenes mas pequenas se veran borrosas.</p>
          {(form.bannerUrl || localBannerPreview) && (
            <div className="flex flex-wrap gap-1.5">
              {originalBanner && (
                <button type="button" onClick={() => { setCropperMode('banner'); setCropperImage(originalBanner); }} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-yellow-400/30 transition-colors">Editar recorte</button>
              )}
              <button type="button" onClick={() => bannerFileRef.current?.click()} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-yellow-400/30 transition-colors">Cambiar</button>
              <button type="button" onClick={() => { setForm(prev => ({ ...prev, bannerUrl: '' })); setLocalBannerPreview(''); setOriginalBanner(''); }} className="text-[10px] px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors">Eliminar</button>
            </div>
          )}
          <input ref={bannerFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); setOriginalBanner(url); setCropperMode('banner'); setCropperImage(url); if (bannerFileRef.current) bannerFileRef.current.value = ''; }} />
        </div>

        {/* Bio */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
          <h3 className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-yellow-400" />
            Biografía
          </h3>
          <textarea
            value={form.bio}
            onChange={e => setForm(prev => ({ ...prev, bio: e.target.value.substring(0, 300) }))}
            placeholder="Cuéntale al mundo quién eres..."
            className={`${inputClass} h-32 resize-none`}
          />
          <p className="text-[10px] text-zinc-600 mt-1 text-right">{form.bio.length}/300</p>
        </div>
      </div>

      {/* Image Cropper Modal */}
      {cropperImage && (
        <ImageCropper
          imageUrl={cropperImage}
          shape={cropperMode === 'banner' ? 'banner' : 'circle'}
          onCrop={handleCroppedImage}
          onCancel={() => setCropperImage('')}
        />
      )}

      {/* Social links */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
          <Link className="w-4 h-4 text-yellow-400" />
          Redes sociales
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/tu_usuario' },
            { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@tu_usuario' },
            { key: 'spotify', label: 'Spotify', placeholder: 'https://open.spotify.com/artist/...' },
            { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@tu_canal' },
            { key: 'soundcloud', label: 'SoundCloud', placeholder: 'https://soundcloud.com/tu_usuario' },
          ].map(s => (
            <div key={s.key}>
              <label className="block text-xs text-zinc-500 mb-1">{s.label}</label>
              <input
                type="url"
                value={(form.socialLinks as any)[s.key] || ''}
                onChange={e => setForm(prev => ({
                  ...prev,
                  socialLinks: { ...prev.socialLinks, [s.key]: e.target.value },
                }))}
                placeholder={s.placeholder}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-8 py-3 rounded-2xl gradient-bg text-black font-semibold shadow-lg hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar perfil'}
      </button>
    </motion.div>
  );
}
