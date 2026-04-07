import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Music } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (email: string, password: string) => { success: boolean; error?: string };
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
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

    const result = onLogin(email.trim(), password);
    if (!result.success) {
      setError(result.error || 'Credenciales incorrectas');
      setPassword('');
    }
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
          <div className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-5 glow">
            <Music className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-50">Admin Panel</h2>
          <p className="text-zinc-500 text-sm mt-2">Accede para gestionar tu catálogo</p>
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
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/25 transition-colors"
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
                placeholder="••••••••"
                className="w-full pl-11 pr-12 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/25 transition-colors"
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
            className="w-full py-3.5 rounded-xl gradient-bg text-black font-semibold text-lg shadow-lg glow hover:scale-[1.02] transition-transform mt-2"
          >
            Acceder
          </button>
        </form>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Panel privado — Solo administradores
        </p>
      </motion.div>
    </div>
  );
}
