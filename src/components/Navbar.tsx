import { ShoppingCart, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Section } from '../types';

interface NavbarProps {
  currentSection: Section;
  onNavigate: (section: Section) => void;
  cartCount: number;
  onCartOpen: () => void;
  collabArtistName?: string;
}

export default function Navbar({ currentSection, onNavigate, cartCount, onCartOpen, collabArtistName }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: { label: string; section: Section }[] = [
    { label: 'Home', section: 'home' },
    { label: 'Colaboradores', section: 'colabs' },
  ];

  const isActive = (s: Section) => currentSection === s || (s === 'colabs' && currentSection === 'colab-page');

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Collab name */}
          {collabArtistName ? (
            <button onClick={() => onNavigate('colabs')} className="flex items-center gap-3 group">
              <span className="text-lg font-black text-white uppercase tracking-wide">{collabArtistName}</span>
              <span className="text-[11px] font-extrabold gradient-bg text-black px-2 py-0.5 rounded-lg tracking-wide">DROPS</span>
            </button>
          ) : (
            <button onClick={() => onNavigate('home')} className="flex items-center gap-3 group">
              <img src="/logo.png" alt="Alex Selas" className="h-9 w-auto" />
              <span className="text-[11px] font-extrabold gradient-bg text-black px-2 py-0.5 rounded-lg tracking-wide">DROPS</span>
            </button>
          )}

          {/* Desktop nav — centered */}
          <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {navItems.map(item => (
              <button
                key={item.section}
                onClick={() => onNavigate(item.section)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive(item.section)
                    ? 'text-yellow-400 bg-yellow-400/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Cart + mobile menu */}
          <div className="flex items-center gap-2">
            <button
              onClick={onCartOpen}
              className="relative p-2.5 rounded-xl text-zinc-400 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 gradient-bg rounded-full text-[10px] font-bold flex items-center justify-center text-black"
                >
                  {cartCount}
                </motion.span>
              )}
            </button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-yellow-400"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden border-t border-zinc-800/50"
          >
            <div className="px-4 py-3 space-y-1 bg-[#0a0a0a]/95">
              {navItems.map(item => (
                <button
                  key={item.section}
                  onClick={() => {
                    onNavigate(item.section);
                    setMobileOpen(false);
                  }}
                  className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive(item.section)
                      ? 'text-yellow-400 bg-yellow-400/10'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
