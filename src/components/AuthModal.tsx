import { useState } from 'react';
import { X, Loader2, Mail, Lock, UserPlus, LogIn, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuth: (token: string, user: { id: string; email: string; name: string; credits: number }) => void;
}

export default function AuthModal({ open, onClose, onAuth }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (!name.trim()) { setError('Escribe tu nombre'); return; }
      if (password !== password2) { setError('Las contrase\u00f1as no coinciden'); return; }
    }

    setLoading(true);

    try {
      const res = await fetch('/api/user-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, email, password, name: name.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error desconocido');
        return;
      }

      if (data.success && data.token && data.user) {
        localStorage.setItem('musicdrop-token', data.token);
        localStorage.setItem('musicdrop-user', JSON.stringify(data.user));
        localStorage.setItem('musicdrop-login-ts', String(Date.now()));
        onAuth(data.token, data.user);
        onClose();
      }
    } catch {
      setError('Error de conexi\u00f3n. Int\u00e9ntalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-yellow-400/40 focus:ring-1 focus:ring-yellow-400/20 text-sm transition-all';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-[#111111] rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/60"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/[0.06]">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {mode === 'login' ? 'Iniciar sesi\u00f3n' : 'Crear cuenta'}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {mode === 'login' ? 'Accede a tu cuenta de MusicDrop' : 'Reg\u00edstrate gratis y empieza a descargar'}
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-sm text-red-400 font-medium" role="alert">
                  {error}
                </div>
              )}

              {/* Name -- only on register */}
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-name" className="block text-xs text-zinc-500 mb-1.5 font-medium">Nombre</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Tu nombre"
                      required
                      className={inputClass}
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs text-zinc-500 mb-1.5 font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className={inputClass}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs text-zinc-500 mb-1.5 font-medium">Contrase\u00f1a</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'M\u00ednimo 6 caracteres' : 'Tu contrase\u00f1a'}
                    required
                    minLength={6}
                    className={inputClass}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </div>
              </div>

              {/* Confirm password -- only on register */}
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-password2" className="block text-xs text-zinc-500 mb-1.5 font-medium">Repetir contrase\u00f1a</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="auth-password2"
                      type="password"
                      value={password2}
                      onChange={e => setPassword2(e.target.value)}
                      placeholder="Repite tu contrase\u00f1a"
                      required
                      minLength={6}
                      className={`${inputClass} ${password2 && password !== password2 ? 'border-red-500/50 focus:border-red-500/50' : ''}`}
                      autoComplete="new-password"
                    />
                  </div>
                  {password2 && password !== password2 && (
                    <p className="text-[11px] text-red-400 mt-1.5">Las contrase\u00f1as no coinciden</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (mode === 'register' && password !== password2)}
                className="w-full py-3 rounded-xl gradient-bg text-black font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-yellow-400/15 mt-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mode === 'login' ? (
                  <LogIn className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setPassword2(''); }}
                  className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  {mode === 'login' ? '\u00bfNo tienes cuenta? Reg\u00edstrate gratis' : '\u00bfYa tienes cuenta? Inicia sesi\u00f3n'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
