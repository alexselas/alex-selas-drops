import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { CreditCard, ArrowLeft, Download, CheckCircle, Music, AlertCircle, Shield, Loader2, Mail } from 'lucide-react';
import type { CartItem } from '../types';
import { formatPrice } from '../lib/utils';

interface CheckoutPanelProps {
  items: CartItem[];
  total: number;
  discount?: number; // 0-1 (e.g. 0.15 = 15%)
  discountCode?: string;
  onBack: () => void;
  onComplete: () => void;
  onClearCart: () => void;
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

export default function CheckoutPanel({ items, total, discount = 0, discountCode, onBack, onComplete, onClearCart }: CheckoutPanelProps) {
  const discountAmount = total * discount;
  const finalTotal = total - discountAmount;
  const [step, setStep] = useState<CheckoutStep>('review');
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [freeEmail, setFreeEmail] = useState('');

  // Use purchased items from localStorage if current items are empty (after redirect)
  const [purchasedItems, setPurchasedItems] = useState<CartItem[]>([]);
  const displayItems = step === 'success' && purchasedItems.length > 0 ? purchasedItems : items;

  // Store verified session ID for download auth
  const [verifiedSessionId, setVerifiedSessionId] = useState<string | null>(null);

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
              setVerifiedSessionId(sessionId);
              onClearCart();
              // Send download email in background
              if (data.email && saved.length > 0) {
                fetch('/api/send-download-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: data.email,
                    sessionId,
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
            onClearCart();
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

  // Stripe checkout (or free download if total is 0)
  const handleStripeCheckout = async () => {
    setStep('processing');
    setErrorMsg('');

    savePurchasedItems(items);

    // If all items are free, skip payment and register free order
    const effectiveTotal = Math.round(total * (1 - discount) * 100) / 100;
    if (effectiveTotal <= 0) {
      if (!freeEmail.trim() || !freeEmail.includes('@')) {
        setStep('review');
        setErrorMsg('Introduce tu email para descargar');
        return;
      }
      try {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tracks: items.map(i => i.track.title),
            trackIds: items.map(i => i.track.id),
            email: freeEmail.trim(),
          }),
        });
      } catch {}
      setPurchasedItems([...items]);
      onClearCart();
      setVerifiedSessionId('free');
      setStep('success');
      return;
    }

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.filter(i => i.track.price > 0).map(i => ({
            id: i.track.id,
            title: i.track.title,
            price: Math.round((i.track.price * (1 - discount)) * 100) / 100,
          })),
          origin: window.location.origin,
          discountCode: discountCode || undefined,
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

  // Download file via trackId (server resolves fileUrl securely)
  const handleDownload = useCallback(async (track: CartItem['track']) => {
    const fileName = track.authors
      ? `${track.authors} - ${track.title}`
      : track.title;
    setDownloadingId(track.title);
    try {
      const params = new URLSearchParams({
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        authors: track.authors || '',
        coverUrl: track.coverUrl || '',
        genre: track.genre || '',
        bpm: String(track.bpm || 0),
      });
      if (verifiedSessionId) {
        params.set('session_id', verifiedSessionId);
      }
      const response = await fetch(`/api/download?${params}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Download failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadingId(null);
    }
  }, [verifiedSessionId]);

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
          <h2 className="text-3xl font-bold text-zinc-50 mb-3">{verifiedSessionId === 'free' ? 'Descarga lista' : 'Pago completado'}</h2>
          <p className="text-zinc-400 mb-8">
            {verifiedSessionId === 'free' ? 'Tus tracks gratuitos están listos para descargar.' : 'Tus descargas están listas. Gracias por tu compra.'}
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
                  onClick={() => handleDownload(item.track)}
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
        <div className="mt-4 pt-4 border-t border-zinc-800/50 space-y-1">
          {discount > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Subtotal</span>
                <span className="text-zinc-400">{formatPrice(total)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-400">Descuento</span>
                <span className="text-green-400">-{formatPrice(discountAmount)}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="text-zinc-300 font-semibold">Total</span>
            <span className="text-2xl font-bold gradient-text">{formatPrice(finalTotal)}</span>
          </div>
        </div>
      </div>

      {/* Payment or Free email */}
      {finalTotal > 0 ? (
        <>
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
            Pagar {formatPrice(finalTotal)}
          </button>
        </>
      ) : (
        <>
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-6 mb-6">
            <h3 className="text-lg font-semibold text-zinc-200 mb-4">Tu email</h3>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="email"
                value={freeEmail}
                onChange={e => setFreeEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors"
              />
            </div>
            <p className="text-xs text-zinc-600 mt-2">Solo para confirmar la descarga. No spam.</p>
          </div>
          <button
            onClick={handleStripeCheckout}
            className="w-full py-4 rounded-xl gradient-bg text-black font-bold text-lg shadow-lg glow hover:scale-[1.02] transition-transform mb-4"
          >
            Descargar gratis
          </button>
        </>
      )}

      {/* Security note */}
      <div className="flex items-center gap-2 justify-center text-xs text-zinc-600">
        <Shield className="w-3.5 h-3.5" />
        <span>Pago seguro cifrado · Descarga inmediata · MP3 320kbps</span>
      </div>
    </div>
  );
}
