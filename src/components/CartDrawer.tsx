import { X, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { CartItem as CartItemType } from '../types';
import CartItem from './CartItem';
import { formatPrice } from '../lib/utils';

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItemType[];
  total: number;
  onClose: () => void;
  onRemove: (trackId: string) => void;
  onCheckout: () => void;
}

export default function CartDrawer({ isOpen, items, total, onClose, onRemove, onCheckout }: CartDrawerProps) {
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
              <div className="p-4 border-t border-zinc-800/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Total</span>
                  <span className="text-2xl font-bold gradient-text">{formatPrice(total)}</span>
                </div>
                <button
                  onClick={onCheckout}
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
