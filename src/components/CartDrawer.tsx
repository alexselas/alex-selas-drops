import { useState } from 'react';
import { X, ShoppingBag, Tag, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { CartItem as CartItemType } from '../types';
import CartItem from './CartItem';
import { formatPrice } from '../lib/utils';

const DISCOUNT_CODES: Record<string, number> = {
  'DROPS15': 0.15,
  'WELCOME15': 0.15,
};

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItemType[];
  total: number;
  onClose: () => void;
  onRemove: (trackId: string) => void;
  onCheckout: (discount: number) => void;
}

export default function CartDrawer({ isOpen, items, total, onClose, onRemove, onCheckout }: CartDrawerProps) {
  const [code, setCode] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState(false);

  const discount = appliedCode ? (DISCOUNT_CODES[appliedCode] || 0) : 0;
  const discountAmount = total * discount;
  const finalTotal = total - discountAmount;

  const handleApplyCode = () => {
    const upper = code.trim().toUpperCase();
    if (DISCOUNT_CODES[upper]) {
      setAppliedCode(upper);
      setCodeError(false);
    } else {
      setCodeError(true);
      setAppliedCode(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-[#141414] border-l border-zinc-800/50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-bold text-zinc-50">
                  Carrito ({items.length})
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingBag className="w-16 h-16 text-zinc-700 mb-4" />
                  <p className="text-zinc-500 text-lg">Tu carrito está vacío</p>
                  <p className="text-zinc-600 text-sm mt-1">Explora el catálogo y añade música</p>
                </div>
              ) : (
                items.map(item => (
                  <CartItem
                    key={item.track.id}
                    item={item}
                    onRemove={() => onRemove(item.track.id)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-4 border-t border-zinc-800/50 space-y-3">
                {/* Discount code */}
                {!appliedCode ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                        <input
                          type="text"
                          value={code}
                          onChange={e => { setCode(e.target.value); setCodeError(false); }}
                          onKeyDown={e => e.key === 'Enter' && handleApplyCode()}
                          placeholder="Código de descuento"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-600 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors"
                        />
                      </div>
                      <button
                        onClick={handleApplyCode}
                        disabled={!code.trim()}
                        className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 disabled:opacity-30 transition-all"
                      >
                        Aplicar
                      </button>
                    </div>
                    {codeError && (
                      <p className="text-red-400 text-xs mt-1.5 ml-1">Código no válido</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-400 font-medium">{appliedCode}</span>
                    </div>
                    <button
                      onClick={() => { setAppliedCode(null); setCode(''); }}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Quitar
                    </button>
                  </div>
                )}

                {/* Totals */}
                {appliedCode && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Subtotal</span>
                      <span className="text-zinc-400">{formatPrice(total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-400">Descuento</span>
                      <span className="text-green-400">-{formatPrice(discountAmount)}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Total</span>
                  <span className="text-2xl font-bold gradient-text">{formatPrice(finalTotal)}</span>
                </div>
                <button
                  onClick={() => onCheckout(discount)}
                  className="w-full py-3.5 rounded-2xl gradient-bg text-black font-bold text-lg shadow-lg glow hover:scale-[1.02] active:scale-95 transition-transform"
                >
                  Ir al Pago
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
