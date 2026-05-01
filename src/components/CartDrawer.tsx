import { useState, useCallback } from 'react';
import { X, Trash2, Coins, Download, Loader2, ShoppingCart, AlertCircle, CheckCircle, FileArchive } from 'lucide-react';
import JSZip from 'jszip';
import { motion, AnimatePresence } from 'motion/react';
import type { CartItem } from '../types';
import { CREDIT_COSTS, CATEGORY_LABELS } from '../types';
import { formatCredits } from '../lib/utils';

interface CartDrawerProps {
  items: CartItem[];
  isOpen: boolean;
  onClose: () => void;
  onRemoveItem: (trackId: string) => void;
  onClearCart: () => void;
  userToken: string | null;
  userCredits: number;
  onLoginRequired: () => void;
  onBuyCredits: () => void;
  onCreditsUpdated: (credits: number) => void;
}

interface PurchasedTrack {
  trackId: string;
  title: string;
  artist: string;
  authors: string;
  coverUrl: string;
  genre: string;
  bpm: number;
  success: boolean;
  error?: string;
}

export default function CartDrawer({
  items, isOpen, onClose, onRemoveItem, onClearCart,
  userToken, userCredits, onLoginRequired, onBuyCredits, onCreditsUpdated,
}: CartDrawerProps) {
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState<PurchasedTrack[]>([]);
  const [done, setDone] = useState(false);

  const totalCredits = items.reduce((sum, item) => sum + (CREDIT_COSTS[item.track.category] || 0), 0);
  const remaining = userCredits - totalCredits;
  const canAfford = remaining >= 0;

  const handlePurchase = async () => {
    if (!userToken) { onLoginRequired(); return; }
    if (!canAfford) { onBuyCredits(); return; }

    setPurchasing(true);
    setPurchased([]);
    const results: PurchasedTrack[] = [];
    let latestCredits = userCredits;

    for (const item of items) {
      try {
        const res = await fetch('/api/download-credit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
          body: JSON.stringify({ trackId: item.track.id }),
        });
        const data = await res.json();
        if (data.success) {
          results.push({
            trackId: item.track.id,
            title: item.track.title,
            artist: item.track.artist,
            authors: item.track.authors,
            coverUrl: item.track.coverUrl,
            genre: item.track.genre,
            bpm: item.track.bpm,
            success: true,
          });
          if (data.creditsRemaining !== undefined) latestCredits = data.creditsRemaining;
        } else {
          results.push({ trackId: item.track.id, title: item.track.title, artist: item.track.artist, authors: '', coverUrl: '', genre: '', bpm: 0, success: false, error: data.error });
        }
      } catch {
        results.push({ trackId: item.track.id, title: item.track.title, artist: item.track.artist, authors: '', coverUrl: '', genre: '', bpm: 0, success: false, error: 'Error de conexion' });
      }
    }

    setPurchased(results);
    onCreditsUpdated(latestCredits);
    setDone(true);
    setPurchasing(false);
  };

  const buildDownloadUrl = (t: PurchasedTrack) => {
    const params = new URLSearchParams({
      trackId: t.trackId,
      session_id: 'credits',
      title: t.title,
      artist: t.artist,
      authors: t.authors || '',
      coverUrl: t.coverUrl || '',
      genre: t.genre || '',
      bpm: String(t.bpm || 0),
    });
    return `/api/download?${params.toString()}`;
  };

  const handleDownloadOne = (t: PurchasedTrack) => {
    const url = buildDownloadUrl(t);
    // Open in new tab -- the API sends Content-Disposition: attachment so it downloads
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    // Add auth header via fetch + blob for proper auth
    fetch(url, { headers: { 'Authorization': `Bearer ${userToken}` } })
      .then(r => {
        if (!r.ok) throw new Error('Download failed');
        return r.blob();
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        const fileName = t.authors ? `${t.authors} - ${t.title}` : t.title;
        link.download = `${fileName}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => { window.open(url, '_blank'); });
  };

  const [zipping, setZipping] = useState(false);

  const handleDownloadAll = async () => {
    const successful = purchased.filter(t => t.success);
    if (successful.length === 0) return;
    if (successful.length === 1) { handleDownloadOne(successful[0]); return; }

    setZipping(true);
    try {
      const zip = new JSZip();
      for (const t of successful) {
        const url = buildDownloadUrl(t);
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${userToken}` } });
        if (res.ok) {
          const blob = await res.blob();
          const fileName = t.authors ? `${t.authors} - ${t.title}.mp3` : `${t.title}.mp3`;
          zip.file(fileName, blob);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MusicDrop-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: download one by one
      successful.forEach((t, i) => { setTimeout(() => handleDownloadOne(t), i * 1000); });
    }
    setZipping(false);
  };

  const handleClose = () => {
    if (done) {
      onClearCart();
      setPurchased([]);
      setDone(false);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#0e0e0e] border-l border-white/[0.06] flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                {done ? <CheckCircle className="w-5 h-5 text-green-400" /> : <ShoppingCart className="w-5 h-5 text-yellow-400" />}
                <h3 className="text-lg font-bold text-white">{done ? 'Compra completada' : 'Tu carrito'}</h3>
                {!done && items.length > 0 && <span className="text-xs text-zinc-500 bg-white/[0.04] px-2 py-0.5 rounded-md font-medium">{items.length}</span>}
              </div>
              <button onClick={handleClose} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all" aria-label="Cerrar carrito">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {done ? (
                /* Purchase results -- download links */
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-green-500/[0.08] border border-green-500/20 mb-4">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-green-400 font-semibold">Tracks comprados correctamente</p>
                      <p className="text-xs text-green-400/60 mt-0.5">Puedes descargarlos ahora o desde tu perfil</p>
                    </div>
                  </div>

                  {purchased.map(t => (
                    <div key={t.trackId} className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.05] transition-colors">
                      {t.success ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span className="text-sm text-zinc-200 flex-1 truncate font-medium">{t.title}</span>
                          <button
                            onClick={() => handleDownloadOne(t)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg gradient-bg text-black text-xs font-bold hover:scale-105 active:scale-95 transition-transform shadow-sm shadow-yellow-400/10"
                          >
                            <Download className="w-3 h-3" />
                            MP3
                          </button>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          <span className="text-sm text-zinc-400 flex-1 truncate">{t.title}</span>
                          <span className="text-xs text-red-400">{t.error}</span>
                        </>
                      )}
                    </div>
                  ))}

                  {purchased.filter(t => t.success).length > 1 && (
                    <button
                      onClick={handleDownloadAll}
                      disabled={zipping}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl gradient-bg text-black font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform mt-4 disabled:opacity-60 shadow-md shadow-yellow-400/10"
                    >
                      {zipping ? <><Loader2 className="w-4 h-4 animate-spin" />Creando ZIP...</> : <><FileArchive className="w-4 h-4" />Descargar todos en ZIP ({purchased.filter(t => t.success).length} tracks)</>}
                    </button>
                  )}

                  <p className="text-xs text-zinc-500 text-center mt-4">
                    Estos tracks estan guardados en tu perfil. Puedes volver a descargarlos cuando quieras.
                  </p>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
                    <ShoppingCart className="w-9 h-9 text-zinc-700" />
                  </div>
                  <p className="text-zinc-400 font-semibold">Tu carrito esta vacio</p>
                  <p className="text-xs text-zinc-600 mt-1.5 max-w-[200px]">Explora el catalogo y anade tracks para empezar</p>
                </div>
              ) : (
                /* Cart items */
                <div className="p-4 space-y-2">
                  {items.map(item => {
                    const credits = CREDIT_COSTS[item.track.category] || 0;
                    return (
                      <div key={item.track.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.05] transition-colors group">
                        <img src={item.track.coverUrl || '/cover-default.png'} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0 shadow-sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-200 truncate">{item.track.title}</p>
                          <p className="text-xs text-zinc-500 truncate">{item.track.artist} · {CATEGORY_LABELS[item.track.category]}</p>
                        </div>
                        <span className="text-sm font-bold gradient-text flex-shrink-0 tabular-nums">{formatCredits(credits)}</span>
                        <button
                          onClick={() => onRemoveItem(item.track.id)}
                          className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                          aria-label={`Eliminar ${item.track.title} del carrito`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer -- purchase summary */}
            {!done && items.length > 0 && (
              <div className="border-t border-white/[0.06] p-5 space-y-4 bg-[#0e0e0e]">
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Tu saldo</span>
                    <span className="text-zinc-200 font-medium tabular-nums">{formatCredits(userCredits)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Total carrito</span>
                    <span className="text-yellow-400 font-bold tabular-nums">- {formatCredits(totalCredits)}</span>
                  </div>
                  <div className="h-px bg-white/[0.06]" />
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Saldo restante</span>
                    <span className={`font-bold tabular-nums ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCredits(Math.max(0, remaining))}
                    </span>
                  </div>
                </div>

                {!canAfford && (
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-500/[0.08] border border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-400 font-medium">Te faltan {formatCredits(Math.abs(remaining))} drops</p>
                  </div>
                )}

                <button
                  onClick={!userToken ? onLoginRequired : !canAfford ? onBuyCredits : handlePurchase}
                  disabled={purchasing}
                  className="w-full py-3.5 rounded-2xl gradient-bg text-black font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-yellow-400/15"
                >
                  {purchasing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Procesando...</>
                  ) : !userToken ? (
                    <>Inicia sesion para comprar</>
                  ) : !canAfford ? (
                    <><Coins className="w-4 h-4" />Comprar drops</>
                  ) : (
                    <><Coins className="w-4 h-4" />Comprar — {formatCredits(totalCredits)}</>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
