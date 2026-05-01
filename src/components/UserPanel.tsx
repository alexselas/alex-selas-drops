import { useState, useEffect, useMemo } from 'react';
import { Coins, Download, Music, Loader2, RefreshCw, ArrowLeft, Search } from 'lucide-react';
import { CREDIT_COSTS, CATEGORY_LABELS } from '../types';
import { formatCredits } from '../lib/utils';

interface UserPanelProps {
  userToken: string;
  userName: string;
  userCredits: number;
  onBack: () => void;
  onBuyCredits: () => void;
  onRefreshBalance: () => void;
}

interface DownloadItem {
  trackId: string;
  title: string;
  artist: string;
  category: string;
  credits: number;
  date: string;
}

export default function UserPanel({ userToken, userName, userCredits, onBack, onBuyCredits, onRefreshBalance }: UserPanelProps) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDownloads();
  }, []);

  const fetchDownloads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user-balance', {
        headers: { 'Authorization': `Bearer ${userToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDownloads(data.downloads || []);
      }
    } catch {}
    setLoading(false);
  };

  const filteredDownloads = useMemo(() => {
    if (!search.trim()) return downloads;
    const q = search.toLowerCase();
    return downloads.filter(dl =>
      dl.title.toLowerCase().includes(q) ||
      dl.artist.toLowerCase().includes(q) ||
      (CATEGORY_LABELS[dl.category as keyof typeof CATEGORY_LABELS] || '').toLowerCase().includes(q)
    );
  }, [downloads, search]);

  const handleRedownload = async (dl: DownloadItem) => {
    setDownloadingId(dl.trackId);
    try {
      const params = new URLSearchParams({
        trackId: dl.trackId,
        session_id: 'credits',
        title: dl.title,
        artist: dl.artist,
      });
      const res = await fetch(`/api/download?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${userToken}` },
      });
      if (!res.ok) { alert('Error al descargar'); setDownloadingId(null); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dl.artist} - ${dl.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Error de conexión');
    }
    setDownloadingId(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">Mi cuenta</h2>
          <p className="text-sm text-zinc-500">{userName}</p>
        </div>
      </div>

      {/* Balance card */}
      <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Tu saldo</p>
            <div className="flex items-center gap-2">
              <Coins className="w-6 h-6 text-yellow-400" />
              <span className="text-4xl font-black gradient-text">{userCredits}</span>
              <span className="text-lg text-zinc-400 font-medium">drops</span>
            </div>
          </div>
          <button
            onClick={onBuyCredits}
            className="px-5 py-2.5 rounded-xl gradient-bg text-black font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform flex items-center gap-2"
          >
            <Coins className="w-4 h-4" />
            Comprar drops
          </button>
        </div>
      </div>

      {/* Downloads */}
      <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-yellow-400" />
            <h3 className="text-base font-bold text-white">Mis descargas</h3>
            <span className="text-xs text-zinc-500">({downloads.length})</span>
          </div>
          <button onClick={fetchDownloads} className="p-2 rounded-xl text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Search bar */}
        {downloads.length > 0 && (
          <div className="px-5 pt-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar en mis descargas..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-yellow-400/50 text-sm"
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
          </div>
        ) : downloads.length === 0 ? (
          <div className="text-center py-16">
            <Music className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">Aún no has descargado ningún track</p>
            <p className="text-zinc-600 text-xs mt-1">Explora el catálogo y usa tus drops</p>
          </div>
        ) : filteredDownloads.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No se encontraron resultados para "{search}"</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {filteredDownloads.map((dl, i) => (
              <div key={`${dl.trackId}-${i}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-800/20 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <Music className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-200 truncate">{dl.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-500">{dl.artist}</span>
                    <span className="text-[10px] text-zinc-600">{CATEGORY_LABELS[dl.category as keyof typeof CATEGORY_LABELS] || dl.category}</span>
                    <span className="text-[10px] text-zinc-600">{new Date(dl.date).toLocaleDateString('es-ES')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-yellow-400/60 font-medium">{dl.credits} dr</span>
                  <button
                    onClick={() => handleRedownload(dl)}
                    disabled={downloadingId === dl.trackId}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:gradient-bg hover:text-black text-xs font-medium transition-all disabled:opacity-50"
                  >
                    {downloadingId === dl.trackId ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    Descargar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
