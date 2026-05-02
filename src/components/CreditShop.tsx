import { useState } from 'react';
import { motion } from 'motion/react';
import { Coins, Loader2, Star, Zap, Crown } from 'lucide-react';
import { CREDIT_PACKS } from '../types';
import { formatPrice } from '../lib/utils';

interface CreditShopProps {
  userToken: string | null;
  userCredits: number;
  onLoginRequired: () => void;
  onCreditsUpdated: (credits: number) => void;
}

export default function CreditShop({ userToken, userCredits, onLoginRequired, onCreditsUpdated }: CreditShopProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');

  const handleBuy = async (packId: string) => {
    if (!userToken) {
      onLoginRequired();
      return;
    }

    setLoading(packId);
    try {
      const res = await fetch('/api/buy-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({ packId, promoCode: promoCode.trim() || undefined }),
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Error al procesar el pago');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setLoading(null);
    }
  };

  const packIcons = [Zap, Star, Crown];

  return (
    <section className="py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-yellow-400/25 bg-yellow-400/[0.06] mb-5">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-400 font-medium">Sistema de drops</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Consigue tus drops</h2>
          <p className="text-zinc-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Los drops son tu moneda en MusicDrop. Cuantos más compres, menor es el coste por track.
          </p>
          {userToken && (
            <div className="mt-5 inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-yellow-400/[0.08] border border-yellow-400/20">
              <Coins className="w-5 h-5 text-yellow-400" />
              <span className="text-lg font-bold gradient-text">{userCredits} drops</span>
              <span className="text-sm text-zinc-400">disponibles</span>
            </div>
          )}
        </div>

        {/* Credit packs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
          {CREDIT_PACKS.map((pack, i) => {
            const Icon = packIcons[i];
            const pricePerCredit = (pack.price / pack.credits).toFixed(2);
            const isPopular = 'popular' in pack && pack.popular;

            return (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className={`relative bg-[#141414] rounded-2xl border overflow-hidden transition-all hover:translate-y-[-2px] ${
                  isPopular ? 'border-yellow-400/30 shadow-lg shadow-yellow-400/[0.08] ring-1 ring-yellow-400/10' : 'border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {isPopular && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-[10px] font-extrabold text-center py-1.5 tracking-widest uppercase">
                    MÁS POPULAR
                  </div>
                )}

                <div className={`p-7 text-center ${isPopular ? 'pt-11' : ''}`}>
                  <div className={`w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center ${
                    isPopular ? 'gradient-bg shadow-md shadow-yellow-400/20' : 'bg-white/[0.04] border border-white/[0.06]'
                  }`}>
                    <Icon className={`w-7 h-7 ${isPopular ? 'text-black' : 'text-yellow-400'}`} />
                  </div>

                  <div className="flex items-baseline justify-center gap-1 mb-1">
                    <span className="text-4xl font-black gradient-text">{pack.credits}</span>
                    <span className="text-sm text-zinc-400 font-medium">drops</span>
                  </div>

                  <p className="text-2xl font-bold text-white mb-1">{formatPrice(pack.price)}</p>
                  <p className="text-xs text-zinc-500 mb-6">{pricePerCredit} EUR / drop</p>

                  <button
                    onClick={() => handleBuy(pack.id)}
                    disabled={loading === pack.id}
                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      isPopular
                        ? 'gradient-bg text-black hover:scale-[1.02] active:scale-95 shadow-md shadow-yellow-400/15'
                        : 'bg-white/[0.06] text-zinc-200 border border-white/[0.06] hover:bg-white/[0.1] hover:border-white/[0.1] active:scale-95'
                    } disabled:opacity-50`}
                  >
                    {loading === pack.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Coins className="w-4 h-4" />
                    )}
                    {loading === pack.id ? 'Procesando...' : 'Comprar'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Promo code */}
        {userToken && (
          <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-5 sm:p-6 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label htmlFor="promo-code" className="block text-xs text-zinc-500 mb-2 font-medium">Código promocional</label>
                <input
                  id="promo-code"
                  type="text"
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Ej: WELCOME20"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-yellow-400/40 focus:ring-1 focus:ring-yellow-400/20 text-sm uppercase tracking-wider transition-all"
                />
              </div>
              {promoCode && (
                <div className="pt-6">
                  <span className="px-3 py-2 rounded-xl bg-yellow-400/[0.08] border border-yellow-400/20 text-yellow-400 text-xs font-bold">20% extra</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-zinc-600 mt-2.5">Introduce tu código antes de comprar. Se aplicará automáticamente.</p>
          </div>
        )}

        {/* Privacy policy notice */}
        <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-5">
          <p className="text-xs text-zinc-500 leading-relaxed">
            Al realizar una compra, aceptas nuestra{' '}
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:underline">Politica de Privacidad</a>{' '}
            y consientes que tu email se guarde para recibir novedades y ofertas de MusicDrop. Puedes darte de baja en cualquier momento.
          </p>
        </div>

        {/* Not logged in CTA */}
        {!userToken && (
          <div className="mt-8 text-center">
            <button
              onClick={onLoginRequired}
              className="px-8 py-3.5 rounded-xl gradient-bg text-black font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-yellow-400/15"
            >
              Crea tu cuenta gratis para empezar
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
