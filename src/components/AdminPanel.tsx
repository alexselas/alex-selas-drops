import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Edit2, Trash2, LogOut, Music, Package, Tag, Clock,
  LayoutDashboard, ListMusic, ShoppingBag, Settings,
  TrendingUp, DollarSign, Eye, Play, Radio, Layers, Library,
  Search, ChevronDown, Star, ChevronUp, GripVertical,
} from 'lucide-react';
import type { Track, Category } from '../types';
import { formatPrice, formatDuration } from '../lib/utils';
import AdminTrackForm from './AdminTrackForm';

type AdminTab = 'dashboard' | 'tracks' | 'orders' | 'settings';

interface AdminPanelProps {
  tracks: Track[];
  onAddTrack: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onUpdateTrack: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onDeleteTrack: (id: string) => void;
  onReorderTracks: (tracks: Track[]) => void;
  onLogout: () => void;
}

interface Order {
  id: string;
  tracks: string[];
  email: string;
  amount: number;
  date: string;
}

export default function AdminPanel({ tracks, onAddTrack, onUpdateTrack, onDeleteTrack, onReorderTracks, onLogout }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState<Category | 'all'>('all');

  // Orders from Stripe
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersRevenue, setOrdersRevenue] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    setOrdersLoading(true);
    fetch('/api/orders')
      .then(r => r.json())
      .then(data => {
        if (data.orders) {
          setOrders(data.orders);
          setOrdersRevenue(data.revenue || 0);
        }
      })
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, []);

  // Stats
  const stats = {
    total: tracks.length,
    sesiones: tracks.filter(t => t.category === 'sesiones').length,
    remixes: tracks.filter(t => t.category === 'remixes').length,
    mashups: tracks.filter(t => t.category === 'mashups').length,
    librerias: tracks.filter(t => t.category === 'librerias').length,
    featured: tracks.filter(t => t.featured).length,
    revenue: ordersRevenue,
    orders: orders.length,
  };

  const categoryLabels: Record<string, string> = {
    sesiones: 'Sesión',
    remixes: 'Remix',
    mashups: 'Mashup',
    librerias: 'Librería',
  };

  const categoryColors: Record<string, string> = {
    sesiones: 'text-emerald-400',
    remixes: 'text-violet-400',
    mashups: 'text-yellow-400',
    librerias: 'text-amber-400',
  };

  const categoryIcons: Record<string, typeof Music> = {
    sesiones: Radio,
    remixes: Tag,
    mashups: Layers,
    librerias: Library,
  };

  // Filter tracks for list
  const filteredTracks = tracks.filter(t => {
    if (trackFilter !== 'all' && t.category !== trackFilter) return false;
    if (trackSearch.trim()) {
      const q = trackSearch.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q);
    }
    return true;
  });

  const tabs: { id: AdminTab; label: string; icon: typeof Music }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tracks', label: 'Tracks', icon: ListMusic },
    { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-50">Admin Panel</h1>
            <p className="text-xs text-zinc-500">alex-selas92@hotmail.com</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400/30 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50 mb-8 overflow-x-auto">
        {tabs.map(t => {
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

      {/* ============ DASHBOARD ============ */}
      {tab === 'dashboard' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Tracks', value: stats.total, icon: ListMusic, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
              { label: 'Destacados', value: stats.featured, icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
              { label: 'Pedidos', value: stats.orders, icon: ShoppingBag, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Ingresos', value: formatPrice(stats.revenue), icon: DollarSign, color: 'text-violet-400', bg: 'bg-violet-500/10' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="text-2xl font-bold text-zinc-50">{s.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Por categoría</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(['sesiones', 'remixes', 'mashups', 'librerias'] as Category[]).map(cat => {
                const Icon = categoryIcons[cat];
                const count = stats[cat];
                return (
                  <div key={cat} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/30">
                    <Icon className={`w-5 h-5 ${categoryColors[cat]}`} />
                    <div>
                      <div className="text-lg font-bold text-zinc-200">{count}</div>
                      <div className="text-xs text-zinc-500">{categoryLabels[cat]}s</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent orders */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-300">Últimos pedidos</h3>
              <button
                onClick={() => setTab('orders')}
                className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                Ver todos
              </button>
            </div>
            <div className="space-y-2">
              {orders.length === 0 && !ordersLoading && (
                <p className="text-sm text-zinc-600 text-center py-4">Sin pedidos aún</p>
              )}
              {orders.slice(0, 3).map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{order.tracks.join(', ') || 'Track'}</p>
                    <p className="text-xs text-zinc-500">{order.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm font-semibold text-yellow-400">{formatPrice(order.amount)}</p>
                    <p className="text-xs text-zinc-600">{order.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => { setTab('tracks'); setIsAdding(true); }}
              className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-yellow-400/30 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">Subir nuevo track</p>
                <p className="text-xs text-zinc-500">Añade música al catálogo</p>
              </div>
            </button>
            <button
              onClick={() => setTab('tracks')}
              className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-yellow-400/30 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Edit2 className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">Gestionar catálogo</p>
                <p className="text-xs text-zinc-500">Edita o elimina tracks</p>
              </div>
            </button>
            <button
              onClick={() => setTab('orders')}
              className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-yellow-400/30 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">Ver ventas</p>
                <p className="text-xs text-zinc-500">Historial de pedidos</p>
              </div>
            </button>
          </div>
        </motion.div>
      )}

      {/* ============ TRACKS ============ */}
      {tab === 'tracks' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Form */}
          {(isAdding || editingTrack) ? (
            <AdminTrackForm
              track={editingTrack}
              onSave={(data) => {
                if (editingTrack) {
                  onUpdateTrack(data);
                } else {
                  onAddTrack(data);
                }
                setEditingTrack(null);
                setIsAdding(false);
              }}
              onCancel={() => {
                setEditingTrack(null);
                setIsAdding(false);
              }}
            />
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white font-semibold shadow-lg hover:scale-[1.02] transition-transform"
                >
                  <Plus className="w-5 h-5" />
                  Subir Track
                </button>

                <div className="flex items-center gap-3 sm:ml-auto w-full sm:w-auto">
                  {/* Search */}
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

                  {/* Category filter */}
                  <div className="relative">
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <select
                      value={trackFilter}
                      onChange={e => setTrackFilter(e.target.value as Category | 'all')}
                      className="pl-4 pr-10 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-yellow-400/50 appearance-none cursor-pointer"
                    >
                      <option value="all">Todas</option>
                      <option value="sesiones">Sesiones</option>
                      <option value="remixes">Remixes</option>
                      <option value="mashups">Mashups</option>
                      <option value="librerias">Librerías</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Count */}
              <p className="text-sm text-zinc-500">
                {filteredTracks.length} track{filteredTracks.length !== 1 ? 's' : ''}
              </p>

              {/* Track list */}
              <div className="space-y-2">
                {filteredTracks.map((track, i) => {
                  const CatIcon = categoryIcons[track.category] || Music;
                  return (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors group"
                    >
                      {/* Cover */}
                      <div className="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {track.coverUrl ? (
                          <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <CatIcon className={`w-6 h-6 ${categoryColors[track.category]}`} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-zinc-200 truncate">{track.title}</p>
                          {track.featured && (
                            <Star className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 fill-yellow-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                          <span className={`font-medium ${categoryColors[track.category]}`}>
                            {categoryLabels[track.category]}
                          </span>
                          <span>{track.genre}</span>
                          {track.bpm > 0 && <span>{track.bpm} BPM</span>}
                          {track.duration > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {formatDuration(track.duration)}
                            </span>
                          )}
                        </div>
                        {/* File status */}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${track.coverUrl ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
                            Portada {track.coverUrl ? '✓' : '—'}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${track.previewUrl ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
                            Preview {track.previewUrl ? '✓' : '—'}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${track.fileUrl ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
                            Archivo {track.fileUrl ? '✓' : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Price */}
                      <span className="text-sm font-bold text-yellow-400 hidden sm:block flex-shrink-0">
                        {formatPrice(track.price)}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                        {/* Reorder */}
                        <div className="flex flex-col">
                          <button
                            onClick={() => {
                              const idx = tracks.findIndex(t => t.id === track.id);
                              if (idx > 0) {
                                const reordered = [...tracks];
                                [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
                                onReorderTracks(reordered);
                              }
                            }}
                            disabled={tracks.findIndex(t => t.id === track.id) === 0}
                            className="p-1 rounded text-zinc-600 hover:text-yellow-400 disabled:opacity-20 transition-colors"
                            title="Subir"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const idx = tracks.findIndex(t => t.id === track.id);
                              if (idx < tracks.length - 1) {
                                const reordered = [...tracks];
                                [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
                                onReorderTracks(reordered);
                              }
                            }}
                            disabled={tracks.findIndex(t => t.id === track.id) === tracks.length - 1}
                            className="p-1 rounded text-zinc-600 hover:text-yellow-400 disabled:opacity-20 transition-colors"
                            title="Bajar"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setEditingTrack(track);
                            setIsAdding(false);
                          }}
                          className="p-2 rounded-lg text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar "${track.title}"?`)) {
                              onDeleteTrack(track.id);
                            }
                          }}
                          className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
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

      {/* ============ ORDERS ============ */}
      {tab === 'orders' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-zinc-50">{orders.length}</div>
              <div className="text-xs text-zinc-500">Total pedidos</div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center mb-2">
                <DollarSign className="w-5 h-5 text-violet-400" />
              </div>
              <div className="text-2xl font-bold text-zinc-50">{formatPrice(ordersRevenue)}</div>
              <div className="text-xs text-zinc-500">Ingresos totales</div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
              <div className="w-9 h-9 rounded-lg bg-yellow-400/10 flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-zinc-50">{orders.length > 0 ? formatPrice(ordersRevenue / orders.length) : '0,00 €'}</div>
              <div className="text-xs text-zinc-500">Promedio por pedido</div>
            </div>
          </div>

          {/* Order list */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 overflow-hidden">
            <div className="p-4 border-b border-zinc-800/50">
              <h3 className="text-sm font-semibold text-zinc-300">Historial de pedidos</h3>
            </div>

            {/* Table header */}
            <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-zinc-500 font-medium border-b border-zinc-800/30">
              <div className="col-span-1">ID</div>
              <div className="col-span-4">Tracks</div>
              <div className="col-span-3">Comprador</div>
              <div className="col-span-2 text-right">Precio</div>
              <div className="col-span-2 text-right">Fecha</div>
            </div>

            {ordersLoading ? (
              <div className="text-center py-8 text-zinc-500 text-sm">Cargando pedidos...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">Sin pedidos aún</div>
            ) : (
              <div className="divide-y divide-zinc-800/30">
                {orders.map(order => (
                  <div key={order.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-3 hover:bg-zinc-800/20 transition-colors">
                    <div className="sm:col-span-1 text-xs text-zinc-500 font-mono">{order.id}</div>
                    <div className="sm:col-span-4 text-sm text-zinc-300 truncate">{order.tracks.join(', ')}</div>
                    <div className="sm:col-span-3 text-sm text-zinc-400 truncate">{order.email}</div>
                    <div className="sm:col-span-2 text-sm font-semibold text-emerald-400 sm:text-right">{formatPrice(order.amount)}</div>
                    <div className="sm:col-span-2 text-xs text-zinc-500 sm:text-right">{order.date}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-600 text-center">
            Datos en tiempo real desde Stripe
          </p>
        </motion.div>
      )}

      {/* ============ SETTINGS ============ */}
      {tab === 'settings' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl">
          {/* Profile */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Perfil</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Nombre</label>
                <input
                  type="text"
                  defaultValue="Alex Selas"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Email</label>
                <input
                  type="email"
                  defaultValue="alex-selas92@hotmail.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-400 text-sm cursor-not-allowed"
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Payments */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Pagos</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-300 font-medium">Stripe</p>
                    <p className="text-xs text-zinc-500">Tarjetas de crédito/débito</p>
                  </div>
                </div>
                {import.meta.env.VITE_STRIPE_PUBLIC_KEY && !import.meta.env.VITE_STRIPE_PUBLIC_KEY.includes('TU_CLAVE') ? (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400">Conectado</span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400">Pendiente</span>
                )}
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-yellow-400/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-300 font-medium">PayPal</p>
                    <p className="text-xs text-zinc-500">Pago directo con PayPal</p>
                  </div>
                </div>
                {import.meta.env.VITE_PAYPAL_CLIENT_ID && import.meta.env.VITE_PAYPAL_CLIENT_ID !== 'sb' ? (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400">Conectado</span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400">Sandbox (test)</span>
                )}
              </div>
            </div>
            <p className="text-xs text-zinc-600 mt-3">Las claves se configuran en las variables de entorno de Vercel</p>
          </div>

          {/* Watermark */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Marca de agua</h3>
            <p className="text-sm text-zinc-400 mb-3">
              El archivo <code className="text-yellow-400 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">watermark.mp3</code> se
              reproduce cada 15 segundos durante los previews.
            </p>
            <div className="p-3 rounded-xl bg-zinc-800/30 text-sm text-zinc-500">
              Sube tu cuña de audio (~3 seg) como <code className="text-yellow-400">/public/watermark.mp3</code>
            </div>
          </div>

          {/* Save */}
          <button className="px-6 py-3 rounded-xl gradient-bg text-white font-semibold shadow-lg hover:scale-[1.02] transition-transform">
            Guardar cambios
          </button>
        </motion.div>
      )}
    </div>
  );
}
