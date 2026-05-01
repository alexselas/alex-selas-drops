import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Edit2, Trash2, LogOut, Music, Clock, Loader2,
  ListMusic, Search, ChevronDown, Star, User, GripVertical, ExternalLink,
  DollarSign, Download,
} from 'lucide-react';
import type { Track, Category, Collaborator } from '../types';
import { CREDIT_COSTS, CATEGORY_LABELS, CATEGORY_COLORS } from '../types';
import { formatCredits, formatDuration } from '../lib/utils';
import AdminTrackForm from './AdminTrackForm';
import CollabProfileForm from './CollabProfileForm';

type CollabTab = 'tracks' | 'earnings' | 'profile';

interface CollabPanelProps {
  collaborator: Collaborator;
  tracks: Track[];
  onAddTrack: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onAddTracksBatch: (data: (Omit<Track, 'id'> & { id?: string })[]) => Promise<void> | void;
  onUpdateTrack: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onDeleteTrack: (id: string) => void;
  onReorderTracks: (tracks: Track[]) => void;
  onLogout: () => void;
  collabToken: string;
}

export default function CollabPanel({
  collaborator,
  tracks,
  onAddTrack,
  onAddTracksBatch,
  onUpdateTrack,
  onDeleteTrack,
  onReorderTracks,
  onLogout,
  collabToken,
}: CollabPanelProps) {
  const [tab, setTab] = useState<CollabTab>('tracks');
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState<Category | 'all'>('all');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const myTracks = tracks.filter(t => t.collaboratorId === collaborator.id);

  const filteredTracks = myTracks.filter(t => {
    if (trackFilter !== 'all' && t.category !== trackFilter) return false;
    if (trackSearch.trim()) {
      const q = trackSearch.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSave = (data: Omit<Track, 'id'> & { id?: string }) => {
    const enriched = {
      ...data,
      collaborator: true,
      collaboratorId: collaborator.id,
      artist: data.artist || collaborator.name,
    };
    if (editingTrack) {
      onUpdateTrack(enriched);
    } else {
      onAddTrack(enriched);
    }
    setEditingTrack(null);
    setIsAdding(false);
  };


  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {collaborator.photoUrl ? (
            <img src={collaborator.photoUrl} alt={collaborator.name} className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <p className="text-xs text-zinc-500">Panel de</p>
            <h1 className="text-xl font-bold text-zinc-50">{collaborator.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(`/collab/${collaborator.id}`, '_blank')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-400/30 transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Ver mi pagina</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400/30 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50 mb-8">
        {([
          { id: 'tracks' as CollabTab, label: 'Tracks', icon: ListMusic },
          { id: 'earnings' as CollabTab, label: 'Mis Ingresos', icon: DollarSign },
          { id: 'profile' as CollabTab, label: 'Mi Perfil', icon: User },
        ]).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setIsAdding(false); setEditingTrack(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'gradient-bg text-black shadow-lg'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ============ MIS INGRESOS ============ */}
      {tab === 'earnings' && (
        <CollabEarnings collabToken={collabToken} collaboratorId={collaborator.id} />
      )}

      {/* ============ MI PERFIL ============ */}
      {tab === 'profile' && (
        <CollabProfileForm
          collaboratorId={collaborator.id}
          collaboratorName={collaborator.name}
          collabToken={collabToken}
        />
      )}

      {/* ============ TRACKS — identical to AdminPanel ============ */}
      {tab === 'tracks' && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Form */}
        {(isAdding || editingTrack) ? (
          <AdminTrackForm
            track={editingTrack}
            adminToken={collabToken}
            defaultArtist={collaborator.name}
            hideCollaboratorCheckbox
            onSave={handleSave}
            onCancel={() => {
              setEditingTrack(null);
              setIsAdding(false);
            }}
          />
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white font-semibold shadow-lg hover:scale-[1.02] transition-transform"
                >
                  <Plus className="w-5 h-5" />
                  Subir Track
                </button>
              </div>

              <div className="flex items-center gap-3 sm:ml-auto w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={trackSearch}
                    onChange={e => setTrackSearch(e.target.value)}
                    placeholder="Buscar track..."
                    className="w-full sm:w-52 pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors"
                  />
                </div>

                <div className="relative">
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  <select
                    value={trackFilter}
                    onChange={e => setTrackFilter(e.target.value as Category | 'all')}
                    className="pl-4 pr-10 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-yellow-400/50 appearance-none cursor-pointer"
                  >
                    <option value="all">Todas</option>
                    <option value="extended">Extended</option>
                    <option value="sesiones">Sesiones</option>
                    <option value="remixes">Remixes</option>
                    <option value="mashups">Mashups</option>
                    <option value="livemashups">Live Mashups</option>
                    <option value="hypeintros">Hype Intros</option>
                    <option value="transiciones">Transiciones</option>
                    <option value="originales">Originales</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Count */}
            <p className="text-sm text-zinc-500">
              {filteredTracks.length} track{filteredTracks.length !== 1 ? 's' : ''}
            </p>

            <div className="space-y-2">
              {/* Tracks — draggable */}
              {filteredTracks.map(track => {
                const isDragging = dragId === track.id;
                const isDragOver = dragOverId === track.id;
                return (
                  <div
                    key={track.id}
                    draggable
                    onDragStart={e => { setDragId(track.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverId !== track.id) setDragOverId(track.id); }}
                    onDragLeave={() => { if (dragOverId === track.id) setDragOverId(null); }}
                    onDrop={e => {
                      e.preventDefault();
                      if (dragId && dragId !== track.id) {
                        const r = [...tracks];
                        const fromIdx = r.findIndex(t => t.id === dragId);
                        const toIdx = r.findIndex(t => t.id === track.id);
                        if (fromIdx !== -1 && toIdx !== -1) {
                          const [moved] = r.splice(fromIdx, 1);
                          r.splice(toIdx, 0, moved);
                          onReorderTracks(r);
                        }
                      }
                      setDragId(null);
                      setDragOverId(null);
                    }}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all group ${
                      isDragging ? 'opacity-40 scale-[0.98] bg-zinc-900/30 border-zinc-800/30' :
                      isDragOver ? 'bg-yellow-400/5 border-yellow-400/30 shadow-lg shadow-yellow-400/5' :
                      'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700/50'
                    }`}
                    style={{ cursor: 'grab' }}
                  >
                    <div className="flex-shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {track.coverUrl ? (
                        <img src={track.coverUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                      ) : (
                        <Music className="w-6 h-6 text-zinc-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-200 truncate">{track.title}</p>
                        {track.featured && <Star className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 fill-yellow-400" />}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${CATEGORY_COLORS[track.category]}`}>{CATEGORY_LABELS[track.category]}</span>
                        <span>{track.genre}</span>
                        {track.bpm > 0 && <span>{track.bpm} BPM</span>}
                        {track.duration > 0 && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatDuration(track.duration)}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${track.coverUrl ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>Portada {track.coverUrl ? '✓' : '—'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${track.previewUrl ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>Preview {track.previewUrl ? '✓' : '—'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${track.fileUrl ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>Archivo {track.fileUrl ? '✓' : '—'}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-yellow-400 hidden sm:block flex-shrink-0">{formatCredits(CREDIT_COSTS[track.category])}</span>
                    <div className="flex items-center gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingTrack(track); setIsAdding(false); }} className="p-2 rounded-lg text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => onDeleteTrack(track.id)} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}

              {filteredTracks.length === 0 && (
                <div className="text-center py-16">
                  <ListMusic className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500">No se encontraron tracks</p>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
      )}
    </div>
  );
}

// ============ COLLAB EARNINGS ============
function CollabEarnings({ collabToken, collaboratorId }: { collabToken: string; collaboratorId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    setLoading(true);
    fetch(`/api/revenue?month=${month}`, {
      headers: { 'Authorization': `Bearer ${collabToken}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setData({ error: 'Error de conexión' }); setLoading(false); });
  }, [month, collabToken]);

  const formatEur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Mis Ingresos</h3>
        <select value={month} onChange={e => setMonth(e.target.value)} className="px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm">
          {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-yellow-400 animate-spin" /></div>
      ) : !data || data.error ? (
        <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-8 text-center">
          <DollarSign className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm font-medium">Sin datos este mes</p>
          <p className="text-zinc-600 text-xs mt-1">Los ingresos apareceran cuando clientes reales descarguen tus tracks</p>
          {data?.error && <p className="text-red-400/50 text-[10px] mt-3">{data.error}</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-5 text-center">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Ingresos</p>
              <p className="text-2xl font-black text-green-400 mt-2">{formatEur(data.eurEarned || 0)}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-5 text-center">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Descargas</p>
              <p className="text-2xl font-black text-white mt-2">{data.downloads || 0}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-5 text-center">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Drops consumidos</p>
              <p className="text-2xl font-black gradient-text mt-2">{data.drops || 0}</p>
            </div>
          </div>

          {/* Tracks vendidos */}
          <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 overflow-hidden">
            <div className="p-5 border-b border-zinc-800/50">
              <h4 className="text-sm font-bold text-white">Tus tracks vendidos</h4>
              <p className="text-[10px] text-zinc-500 mt-0.5">Solo descargas de clientes reales (no internas). Recibes el 65%.</p>
            </div>
            {data.trackBreakdown && data.trackBreakdown.length > 0 ? (
              <div className="divide-y divide-zinc-800/50">
                {data.trackBreakdown.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-zinc-300 truncate flex-1">{t.title || t.trackId}</span>
                    <span className="text-xs text-yellow-400 font-bold ml-3">{t.drops} dr</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-zinc-600 text-sm">Sin descargas externas este mes</div>
            )}
          </div>

          {/* Descargas recientes */}
          <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 overflow-hidden">
            <div className="p-5 border-b border-zinc-800/50">
              <h4 className="text-sm font-bold text-white">Descargas recientes de tus tracks</h4>
              <p className="text-[10px] text-zinc-500 mt-0.5">Cada vez que un cliente descarga uno de tus tracks</p>
            </div>
            {data.recentDownloads && data.recentDownloads.length > 0 ? (
              <div className="divide-y divide-zinc-800/50">
                {data.recentDownloads.map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <Download className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 truncate">{d.title}</p>
                      <p className="text-[10px] text-zinc-600">{d.date ? new Date(d.date).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                    </div>
                    <span className="text-xs text-yellow-400 font-bold">{d.drops} dr</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-zinc-600 text-sm">Sin descargas recientes</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
