import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { CreditCard, ArrowLeft, Download, CheckCircle, Music, AlertCircle, Shield, Loader2 } from 'lucide-react';
import type { CartItem } from '../types';
import { formatPrice } from '../lib/utils';

interface CheckoutPanelProps {
  items: CartItem[];
  total: number;
  onBack: () => void;
  onComplete: () => void;
}

type CheckoutStep = 'review' | 'processing' | 'success' | 'error';

const PURCHASED_KEY = 'alex-selas-drops-purchased';

function savePurchasedItems(items: CartItem[]) {
  localStorage.setItem(PURCHASED_KEY, JSON.stringify(items));
}

function loadPurchasedItems(): CartItem[] {
  try {
    const raw = localStorage.getItem(PURCHASED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function CheckoutPanel({ items, total, onBack, onComplete }: CheckoutPanelProps) {
  const [step, setStep] = useState<CheckoutStep>('review');
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Use purchased items from localStorage if current items are empty (after redirect)
  const [purchasedItems, setPurchasedItems] = useState<CartItem[]>([]);
  const displayItems = step === 'success' && purchasedItems.length > 0 ? purchasedItems : items;

  // Check if returning from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');

    if (payment === 'success') {
      const saved = loadPurchasedItems();
      setPurchasedItems(saved);

      if (sessionId) {
        setStep('processing');
        fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.paid) {
              setStep('success');
              // Send download email in background
              if (data.email && saved.length > 0) {
                fetch('/api/send-download-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: data.email,
                    tracks: saved.map(i => ({ title: i.track.title, fileUrl: i.track.fileUrl })),
                  }),
                }).catch(() => {}); // silent — email is a bonus, not critical
              }
            } else {
              setStep('error');
              setErrorMsg('El pago no se ha completado');
            }
          })
          .catch(() => {
            setStep('success');
          })
          .finally(() => {
            window.history.replaceState({}, '', window.location.pathname);
          });
      } else {
        setStep('success');
        window.history.replaceState({}, '', window.location.pathname);
      }
    } else if (payment === 'cancelled') {
      setErrorMsg('Pago cancelado');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Stripe checkout
  const handleStripeCheckout = async () => {
    setStep('processing');
    setErrorMsg('');

    savePurchasedItems(items);

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({
            id: i.track.id,
            title: i.track.title,
            price: i.track.price,
          })),
          origin: window.location.origin,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'No se pudo crear la sesión de pago');
      }
    } catch (err: any) {
      setStep('error');
      setErrorMsg(err.message || 'Error al conectar con Stripe');
    }
  };

  // Download file (works with cross-origin Vercel Blob URLs)
  const handleDownload = useCallback(async (fileUrl: string, title: string) => {
    setDownloadingId(title);
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = fileUrl.split('.').pop()?.split('?')[0] || 'mp3';
      a.download = `${title}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(fileUrl, '_blank');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  // ============ SUCCESS ============
  if (step === 'success') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto px-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15, delay: 0.2 }}
            className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-10 h-10 text-green-400" />
          </motion.div>
          <h2 className="text-3xl font-bold text-zinc-50 mb-3">Pago completado</h2>
          <p className="text-zinc-400 mb-8">
            Tus descargas están listas. Gracias por tu compra.
          </p>
          <div className="space-y-3 mb-8">
            {displayItems.map(item => (
              <div
                key={item.track.id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30"
              >
                <div className="flex items-center gap-3">
                  {item.track.coverUrl ? (
                    <img src={item.track.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                      <Music className="w-5 h-5 text-zinc-600" />
                    </div>
                  )}
                  <span className="text-sm text-zinc-300 text-left">{item.track.title}</span>
                </div>
                <button
                  onClick={() => handleDownload(item.track.fileUrl, item.track.title)}
                  disabled={downloadingId === item.track.title}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-400/20 text-yellow-400 text-sm font-medium hover:bg-yellow-400/30 transition-colors disabled:opacity-50"
                >
                  {downloadingId === item.track.title ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  MP3
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={onComplete}
            className="px-6 py-3 rounded-xl gradient-bg text-white font-semibold shadow-lg glow hover:scale-105 transition-transform"
          >
            Volver a la Tienda
          </button>
        </motion.div>
      </div>
    );
  }

  // ============ PROCESSING ============
  if (step === 'processing') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-full border-4 border-zinc-700 border-t-yellow-400 mx-auto mb-6"
          />
          <h2 className="text-xl font-bold text-zinc-50 mb-2">Procesando pago...</h2>
          <p className="text-zinc-500 text-sm">Conectando con Stripe</p>
        </motion.div>
      </div>
    );
  }

  // ============ ERROR ============
  if (step === 'error') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-sm mx-auto px-4">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-50 mb-2">Error en el pago</h2>
          <p className="text-zinc-400 text-sm mb-6">{errorMsg}</p>
          <div className="flex items-center gap-3 justify-center">
            <button
              onClick={() => { setStep('review'); setErrorMsg(''); }}
              className="px-6 py-3 rounded-xl gradient-bg text-white font-semibold shadow-lg hover:scale-105 transition-transform"
            >
              Reintentar
            </button>
            <button
              onClick={onBack}
              className="px-6 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              Volver
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ============ REVIEW ============
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <h1 className="text-3xl font-bold text-zinc-50 mb-8">Checkout</h1>

      {/* Error banner */}
      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errorMsg}
        </motion.div>
      )}

      {/* Order summary */}
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-6 mb-6">
        <h3 className="text-lg font-semibold text-zinc-200 mb-4">Resumen del pedido</h3>
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.track.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                {item.track.coverUrl ? (
                  <img src={item.track.coverUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <Music className="w-4 h-4 text-zinc-600" />
                  </div>
                )}
                <span className="text-zinc-400">{item.track.title}</span>
              </div>
              <span className="text-zinc-300 font-medium">{formatPrice(item.track.price)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center justify-between">
          <span className="text-zinc-300 font-semibold">Total</span>
          <span className="text-2xl font-bold gradient-text">{formatPrice(total)}</span>
        </div>
      </div>

      {/* Payment */}
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-6 mb-6">
        <h3 className="text-lg font-semibold text-zinc-200 mb-4">Método de pago</h3>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-400/50 bg-yellow-400/5 text-yellow-400">
          <CreditCard className="w-7 h-7" />
          <div>
            <span className="text-sm font-semibold block">Tarjeta de crédito / débito</span>
            <span className="text-xs text-zinc-500">Visa, Mastercard, American Express...</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleStripeCheckout}
        className="w-full py-4 rounded-xl gradient-bg text-black font-bold text-lg shadow-lg glow hover:scale-[1.02] transition-transform mb-4"
      >
        Pagar {formatPrice(total)}
      </button>

      {/* Security note */}
      <div className="flex items-center gap-2 justify-center text-xs text-zinc-600">
        <Shield className="w-3.5 h-3.5" />
        <span>Pago seguro cifrado · Descarga inmediata · MP3 320kbps</span>
      </div>
    </div>
  );
}
