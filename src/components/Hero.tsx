import { motion } from 'motion/react';
import { Headphones, ShoppingBag } from 'lucide-react';
import type { Section } from '../types';

interface HeroProps {
  onNavigate: (section: Section) => void;
}

export default function Hero({ onNavigate }: HeroProps) {
  return (
    <section className="relative min-h-[50vh] sm:min-h-[60vh] flex items-center justify-center overflow-hidden py-10">
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
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/5 mb-4 sm:mb-6">
            <Headphones className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-400 font-medium">Música exclusiva en alta calidad</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="flex flex-col items-center mb-6"
        >
          <img src="/logo.png" alt="Alex Selas" className="h-20 sm:h-32 md:h-44 w-auto" />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[0.25em] gradient-text -mt-1">
            DROPS
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 font-medium tracking-[0.3em] uppercase mt-3">
            Sesiones &middot; Remixes &middot; Mashups &middot; Librerías
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />

      </div>
    </section>
  );
}
