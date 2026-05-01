import { Menu, X, Coins, User, LogOut, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Section } from '../types';

interface NavbarProps {
  currentSection: Section;
  onNavigate: (section: Section) => void;
  collabArtistName?: string;
  userName?: string;
  userCredits?: number;
  onLoginClick: () => void;
  onLogout: () => void;
  onBuyCredits: () => void;
  onMyAccount: () => void;
  cartCount: number;
  onCartOpen: () => void;
}

export default function Navbar({ currentSection, onNavigate, collabArtistName, userName, userCredits, onLoginClick, onLogout, onBuyCredits, onMyAccount, cartCount, onCartOpen }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLoggedIn = !!userName;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-2xl border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          {collabArtistName ? (
            <button onClick={() => onNavigate('colabs')} className="flex items-center gap-3 group">
              <span className="text-lg font-black text-white uppercase tracking-wide group-hover:text-yellow-400 transition-colors">{collabArtistName}</span>
              <span className="text-[11px] font-extrabold gradient-bg text-black px-2.5 py-0.5 rounded-md tracking-wide">DROP</span>
            </button>
          ) : (
            <button onClick={() => onNavigate('colabs')} className="flex items-center gap-1.5 group">
              <span className="text-lg font-black uppercase tracking-wider text-white group-hover:opacity-80 transition-opacity">MUSIC</span>
              <span className="text-lg font-black uppercase tracking-wider text-yellow-400">DROP</span>
              <span className="text-[9px] font-semibold text-zinc-500 tracking-wide ml-1.5 hidden sm:inline">by 360DJAcademy</span>
            </button>
          )}

          {/* Right side */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Credits balance or login */}
            {isLoggedIn ? (
              <div className="flex items-center gap-1.5">
                {/* User name + account */}
                <button
                  onClick={onMyAccount}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] transition-all"
                >
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-sm text-zinc-300 font-medium max-w-[100px] truncate">{userName}</span>
                </button>
                {/* Credits + buy */}
                <button
                  onClick={onBuyCredits}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-400/[0.08] border border-yellow-400/20 hover:bg-yellow-400/[0.14] hover:border-yellow-400/30 transition-all"
                >
                  <Coins className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-bold gradient-text">{userCredits ?? 0}</span>
                  <span className="text-[10px] text-yellow-400/60 font-semibold">drops</span>
                </button>
                <button
                  onClick={onLogout}
                  className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/[0.06] text-zinc-300 hover:gradient-bg hover:text-black border border-white/[0.06] hover:border-transparent transition-all text-sm font-medium"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Entrar</span>
              </button>
            )}

            {/* Cart */}
            <button
              onClick={onCartOpen}
              className="relative p-2.5 rounded-xl text-zinc-400 hover:text-yellow-400 hover:bg-yellow-400/[0.08] transition-all"
              aria-label={`Carrito${cartCount > 0 ? `, ${cartCount} items` : ''}`}
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-0.5 -right-0.5 w-5 h-5 gradient-bg rounded-full text-[10px] font-bold flex items-center justify-center text-black shadow-lg shadow-yellow-400/20"
                >
                  {cartCount}
                </motion.span>
              )}
            </button>

            {/* Mobile menu */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-yellow-400 hover:bg-white/[0.06] transition-all"
              aria-label="Menu"
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
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden border-t border-white/[0.06]"
          >
            <div className="px-4 py-3 space-y-1 bg-[#0a0a0a]/95 backdrop-blur-xl">
              {isLoggedIn && (
                <>
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-zinc-400" />
                      <span className="text-sm text-zinc-300 font-medium">{userName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="text-sm font-bold gradient-text">{userCredits ?? 0}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { onBuyCredits(); setMobileOpen(false); }}
                    className="block w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-yellow-400 hover:bg-yellow-400/[0.08] transition-colors"
                  >
                    Comprar drops
                  </button>
                  <button
                    onClick={() => { onMyAccount(); setMobileOpen(false); }}
                    className="block w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:bg-white/[0.04] transition-colors"
                  >
                    Mis descargas
                  </button>
                </>
              )}
              <button
                onClick={() => { onNavigate('colabs'); setMobileOpen(false); }}
                className="block w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:bg-white/[0.04] transition-colors"
              >
                Catálogo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
