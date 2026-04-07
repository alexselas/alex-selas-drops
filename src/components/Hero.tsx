import { motion } from 'motion/react';
import { Headphones, ShoppingBag } from 'lucide-react';
import type { Section } from '../types';

interface HeroProps {
  onNavigate: (section: Section) => void;
}

export default function Hero({ onNavigate }: HeroProps) {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-yellow-400/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a0a_70%)]" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'linear-gradient(rgba(250,204,21,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(250,204,21,.15) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/5 mb-8">
            <Headphones className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-400 font-medium">Música exclusiva en alta calidad</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="flex flex-col items-center mb-10"
        >
          <img src="/logo.png" alt="Alex Selas" className="h-28 sm:h-40 md:h-52 w-auto" />
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[0.25em] gradient-text -mt-1">
            DROPS
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 font-medium tracking-[0.3em] uppercase mt-3">
            Sesiones &middot; Remixes &middot; Mashups &middot; Librerías
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={() => onNavigate('catalog')}
            className="group relative px-8 py-3.5 rounded-2xl gradient-bg text-black font-bold text-lg shadow-lg glow hover:scale-105 active:scale-95 transition-transform"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Explorar Catálogo
            </span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('featured');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-8 py-3.5 rounded-2xl border border-zinc-700 text-zinc-300 font-semibold text-lg hover:border-yellow-400/40 hover:text-white transition-all"
          >
            Ver Destacados
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="flex items-center justify-center gap-8 sm:gap-16 mt-20"
        >
          {[
            { value: '320', label: 'kbps' },
            { value: '12+', label: 'Tracks' },
            { value: '100%', label: 'Exclusivo' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold gradient-text">{stat.value}</div>
              <div className="text-xs sm:text-sm text-zinc-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
