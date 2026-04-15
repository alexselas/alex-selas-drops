import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Users, ChevronDown, CheckCircle, User, Link, Music } from 'lucide-react';
import type { Collaborator } from '../types';

interface CollabLoginProps {
  collaborators: Collaborator[];
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: (email: string, password: string, collaboratorId: string, profile?: {
    artistName: string;
    bio: string;
    socialLinks: { instagram?: string; tiktok?: string; spotify?: string; youtube?: string; soundcloud?: string };
  }) => Promise<{ success: boolean; error?: string }>;
}

export default function CollabLogin({ collaborators, onLogin, onRegister }: CollabLoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedCollab, setSelectedCollab] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [artistName, setArtistName] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [spotify, setSpotify] = useState('');
  const [youtube, setYoutube] = useState('');
  const [soundcloud, setSoundcloud] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Introduce tu email');
      return;
    }
    if (!password) {
      setError('Introduce tu contraseña');
      return;
    }

    if (mode === 'register') {
      if (password.length < 12) {
        setError('La contraseña debe tener al menos 12 caracteres');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden');
        return;
      }
      if (!artistName.trim()) {
        setError('Introduce tu nombre artístico');
        return;
      }
    }

    const collabId = artistName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    setLoading(true);
    const result = mode === 'login'
      ? await onLogin(email.trim(), password)
      : await onRegister(email.trim(), password, collabId, {
          artistName: artistName.trim(),
          bio: bio.trim(),
          socialLinks: {
            ...(instagram.trim() && { instagram: instagram.trim() }),
            ...(tiktok.trim() && { tiktok: tiktok.trim() }),
            ...(spotify.trim() && { spotify: spotify.trim() }),
            ...(youtube.trim() && { youtube: youtube.trim() }),
            ...(soundcloud.trim() && { soundcloud: soundcloud.trim() }),
          },
        });
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Error');
      setPassword('');
      setConfirmPassword('');
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setPassword('');
    setConfirmPassword('');
    setSelectedCollab('');
    setArtistName('');
    setBio('');
    setInstagram('');
    setTiktok('');
    setSpotify('');
    setYoutube('');
    setSoundcloud('');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-violet-500/20 flex items-center justify-center mx-auto mb-5">
            <Users className="w-10 h-10 text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-50">
            {mode === 'login' ? 'Panel Colaborador' : 'Crear cuenta'}
          </h2>
          <p className="text-zinc-500 text-sm mt-2">
            {mode === 'login'
              ? 'Accede con tu email y contraseña'
              : 'Regístrate para subir tus tracks'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25 transition-colors"
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Mínimo 12 caracteres' : '••••••••'}
                className="w-full pl-11 pr-12 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password (register only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25 transition-colors"
                />
                {confirmPassword && password === confirmPassword && (
                  <CheckCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                )}
              </div>
            </div>
          )}

          {/* Profile fields (register only) */}
          {mode === 'register' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 pt-2"
            >
              <div className="border-t border-zinc-800 pt-4">
                <p className="text-xs text-zinc-400 font-medium mb-3 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-violet-400" />
                  Tu perfil de artista
                </p>
                <p className="text-[10px] text-zinc-600 mb-4">Podrás editarlo después en tu panel, en la pestaña "Mi Perfil".</p>
              </div>

              {/* Artist name */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Nombre artístico</label>
                <div className="relative">
                  <Music className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={artistName}
                    onChange={e => setArtistName(e.target.value)}
                    placeholder="Ej: Martin Garrix, DJ Snake..."
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25 transition-colors"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Biografía corta</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value.substring(0, 300))}
                  placeholder="Cuéntale al mundo quién eres..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25 transition-colors text-sm resize-none"
                />
                <p className="text-[10px] text-zinc-600 mt-1 text-right">{bio.length}/300</p>
              </div>

              {/* Social links */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium flex items-center gap-2">
                  <Link className="w-3.5 h-3.5" />
                  Redes sociales <span className="text-zinc-600">(opcional)</span>
                </label>
                <div className="space-y-2.5">
                  <input
                    type="url"
                    value={instagram}
                    onChange={e => setInstagram(e.target.value)}
                    placeholder="Instagram — https://instagram.com/tu_usuario"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25 transition-colors text-sm"
                  />
                  <input
                    type="url"
                    value={tiktok}
                    onChange={e => setTiktok(e.target.value)}
                    placeholder="TikTok — https://tiktok.com/@tu_usuario"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25 transition-colors text-sm"
                  />
                  <input
                    type="url"
                    value={spotify}
                    onChange={e => setSpotify(e.target.value)}
                    placeholder="Spotify — https://open.spotify.com/artist/..."
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25 transition-colors text-sm"
                  />
                  <input
                    type="url"
                    value={youtube}
                    onChange={e => setYoutube(e.target.value)}
                    placeholder="YouTube — https://youtube.com/@tu_canal"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25 transition-colors text-sm"
                  />
                  <input
                    type="url"
                    value={soundcloud}
                    onChange={e => setSoundcloud(e.target.value)}
                    placeholder="SoundCloud — https://soundcloud.com/tu_usuario"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25 transition-colors text-sm"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-semibold text-lg shadow-lg hover:scale-[1.02] transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? (mode === 'login' ? 'Entrando...' : 'Creando cuenta...')
              : (mode === 'login' ? 'Acceder' : 'Crear cuenta')}
          </button>
        </form>

        {/* Switch mode */}
        <p className="text-center text-sm text-zinc-500 mt-6">
          {mode === 'login' ? (
            <>
              ¿Primera vez?{' '}
              <button onClick={switchMode} className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                Crear cuenta
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{' '}
              <button onClick={switchMode} className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                Iniciar sesión
              </button>
            </>
          )}
        </p>

        <p className="text-center text-xs text-zinc-600 mt-4">
          Acceso exclusivo para colaboradores de Alex Selas Drops
        </p>
      </motion.div>
    </div>
  );
}
