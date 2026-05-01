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
      if (password !== password2) { setError('Las contrasenas no coinciden'); return; }
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
      setError('Error de conexion. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-yellow-400/50 text-sm';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-[#141414] rounded-2xl border border-zinc-800/50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {mode === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {mode === 'login' ? 'Accede a tus drops' : 'Registrate para comprar drops'}
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Name — only on register */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Nombre</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Tu nombre"
                      required
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Contrasena</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'Minimo 6 caracteres' : 'Tu contrasena'}
                    required
                    minLength={6}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Confirm password — only on register */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Repetir contrasena</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="password"
                      value={password2}
                      onChange={e => setPassword2(e.target.value)}
                      placeholder="Repite tu contrasena"
                      required
                      minLength={6}
                      className={`${inputClass} ${password2 && password !== password2 ? 'border-red-500/50' : ''}`}
                    />
                  </div>
                  {password2 && password !== password2 && (
                    <p className="text-[11px] text-red-400 mt-1">Las contrasenas no coinciden</p>
                  )}
                </div>
              )}


              <button
                type="submit"
                disabled={loading || (mode === 'register' && password !== password2)}
                className="w-full py-3 rounded-xl gradient-bg text-black font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50"
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

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setPassword2(''); }}
                  className="text-sm text-yellow-400 hover:text-yellow-300"
                >
                  {mode === 'login' ? 'No tienes cuenta? Registrate' : 'Ya tienes cuenta? Inicia sesion'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
