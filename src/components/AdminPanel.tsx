import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Edit2, Trash2, LogOut, Music, Tag, Clock,
  LayoutDashboard, ListMusic, Users, Mail,
  DollarSign, Eye, Radio, Layers,
  Search, ChevronDown, Star, GripVertical, Copy,
  Save, Loader2, User, Upload, Image, CheckCircle, Download,
} from 'lucide-react';
import type { Track, Category, CollaboratorProfile } from '../types';
import { CREDIT_COSTS, CATEGORY_LABELS, CATEGORY_COLORS } from '../types';
import { formatPrice, formatDuration, formatCredits } from '../lib/utils';
import { collaborators } from '../data/collaborators';
import AdminTrackForm from './AdminTrackForm';
import ImageCropper from './ImageCropper';
import CollabProfileForm from './CollabProfileForm';

type AdminTab = 'dashboard' | 'tracks' | 'newsletter' | 'settings' | 'collabs' | 'economia' | 'pirateria';

interface AdminPanelProps {
  tracks: Track[];
  onAddTrack: (data: Omit<Track, 'id'> & { id?: string }) => Promise<void> | void;
  onUpdateTrack: (data: Omit<Track, 'id'> & { id?: string }) => Promise<void> | void;
  onDeleteTrack: (id: string) => Promise<void> | void;
  onReorderTracks: (tracks: Track[]) => void;
  onLogout: () => void;
  adminToken?: string;
}

export default function AdminPanel({ tracks, onAddTrack, onUpdateTrack, onDeleteTrack, onReorderTracks, onLogout, adminToken }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [adminArtist, setAdminArtist] = useState<'alex-selas' | 'music-drop'>('alex-selas');
  const [trackSearch, setTrackSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState<Category | 'all'>('all');
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const getAdminToken = () => sessionStorage.getItem('alex-selas-drops-token') || '';

  // Stats (only own tracks, not collaborator uploads)
  const myTracks = tracks.filter(t => !t.collaboratorId);
  const stats: Record<string, any> = {
    total: myTracks.length,
    extended: myTracks.filter(t => t.category === 'extended').length,
    sesiones: myTracks.filter(t => t.category === 'sesiones').length,
    remixes: myTracks.filter(t => t.category === 'remixes').length,
    mashups: myTracks.filter(t => t.category === 'mashups').length,
    livemashups: myTracks.filter(t => t.category === 'livemashups').length,
    hypeintros: myTracks.filter(t => t.category === 'hypeintros').length,
    transiciones: myTracks.filter(t => t.category === 'transiciones').length,
    originales: myTracks.filter(t => t.category === 'originales').length,
    featured: myTracks.filter(t => t.featured).length,
  };

  const categoryIcons: Record<string, typeof Music> = {
    extended: Music,
    sesiones: Radio,
    remixes: Tag,
    mashups: Layers,
    livemashups: Layers,
  };

  // Filter tracks for list
  const filteredTracks = tracks.filter(t => {
    if (!showAllTracks && t.collaboratorId) return false;
    if (trackFilter !== 'all') {
      if (t.category !== trackFilter) return false;
    }
    if (trackSearch.trim()) {
      const q = trackSearch.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q);
    }
    return true;
  });

  // Newsletter state
  const newsletterEmails: { email: string; lastOrder: string; type: string }[] = [];
  const [emailsCopied, setEmailsCopied] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [sendingNewsletter, setSendingNewsletter] = useState(false);
  const [newsletterResult, setNewsletterResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [showNewsletterPreview, setShowNewsletterPreview] = useState(false);

  const tabs: { id: AdminTab; label: string; icon: typeof Music }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tracks', label: 'Tracks', icon: ListMusic },
    { id: 'newsletter', label: 'Newsletter', icon: Mail },
    { id: 'settings', label: 'Perfil', icon: User },
    { id: 'collabs', label: 'Colaboradores', icon: Users },
    { id: 'economia', label: 'Economia', icon: DollarSign },
    { id: 'pirateria', label: 'Pirateria', icon: Eye },
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
            <p className="text-xs text-zinc-500">Admin</p>
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
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Tracks', value: stats.total, icon: ListMusic, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
              { label: 'Destacados', value: stats.featured, icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
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
              {(['extended', 'mashups', 'remixes', 'sesiones', 'livemashups', 'hypeintros', 'transiciones', 'originales'] as Category[]).map(cat => {
                const Icon = categoryIcons[cat] || Music;
                const count = stats[cat] || 0;
                return (
                  <div key={cat} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/30">
                    <Icon className="w-5 h-5 text-yellow-400" />
                    <div>
                      <div className="text-lg font-bold text-zinc-200">{count}</div>
                      <div className="text-xs text-zinc-500">{CATEGORY_LABELS[cat]}s</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>
        </motion.div>
      )}

      {/* ============ TRACKS ============ */}
      {tab === 'tracks' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Form */}
          {(isAdding || editingTrack) ? (
            <>
              {/* Artist selector — only for new tracks */}
              {isAdding && !editingTrack && (
                <div className="mb-4 flex items-center gap-3">
                  <label className="text-xs text-zinc-500 font-medium">Publicar como:</label>
                  <select value={adminArtist} onChange={e => setAdminArtist(e.target.value as any)} className="px-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 text-sm">
                    <option value="alex-selas">Alex Selas</option>
                    <option value="music-drop">MusicDrop</option>
                  </select>
                </div>
              )}
              <AdminTrackForm
                track={editingTrack}
                adminToken={adminToken}
                defaultArtist={adminArtist === 'music-drop' ? 'MusicDrop' : 'Alex Selas'}
                onSave={(data) => {
                  // If publishing as Music Drop, mark as collaborator
                  if (adminArtist === 'music-drop' && !editingTrack) {
                    data.collaborator = true;
                    data.collaboratorId = 'music-drop';
                    data.artist = 'MusicDrop';
                  }
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
            </>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white font-semibold shadow-lg hover:scale-[1.02] transition-transform"
                  >
                    <Plus className="w-5 h-5" />
                    Subir Track
                  </button>
                  <button
                    onClick={() => setShowAllTracks(!showAllTracks)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-semibold transition-colors ${showAllTracks ? 'gradient-bg text-black border-yellow-400/50 shadow-lg' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-yellow-400/30 hover:text-white'}`}
                  >
                    <Eye className="w-5 h-5" />
                    {showAllTracks ? 'Solo mis tracks' : 'Mostrar todos'}
                  </button>
                </div>

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
                      <option value="extended">Extended</option>
                      <option value="mashups">Mashups</option>
                      <option value="livemashups">Live Mashups</option>
                      <option value="hypeintros">Hype Intros</option>
                      <option value="transiciones">Transiciones</option>
                      <option value="remixes">Remixes</option>
                      <option value="sesiones">Sesiones</option>
                      <option value="originales">Originales</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Count & list */}
              <p className="text-sm text-zinc-500">
                {filteredTracks.length} track{filteredTracks.length !== 1 ? 's' : ''}
              </p>

              <div className="space-y-2">
                {/* Tracks — draggable */}
                {filteredTracks.map((track, i) => {
                        const CatIcon = categoryIcons[track.category] || Music;
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
                            {/* Drag handle */}
                            <div className="flex-shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                              {track.coverUrl ? (
                                <img src={track.coverUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                              ) : (
                                <CatIcon className="w-6 h-6 text-zinc-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-zinc-200 truncate">{track.title}</p>
                                {track.featured && <Star className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 fill-yellow-400" />}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                                <span className="font-medium text-yellow-400">{CATEGORY_LABELS[track.category]}</span>
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
                            <span className="text-sm font-bold text-yellow-400 hidden sm:block flex-shrink-0">{formatCredits(CREDIT_COSTS[track.category] || 1)}</span>
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

      {/* ============ NEWSLETTER ============ */}
      {tab === 'newsletter' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-200">Emails de compradores</h3>
              <p className="text-sm text-zinc-500 mt-1">{newsletterEmails.length} emails unicos de todos tus pedidos</p>
            </div>
            <button
              onClick={() => {
                const all = newsletterEmails.map(e => e.email).join(', ');
                navigator.clipboard.writeText(all).then(() => {
                  setEmailsCopied(true);
                  setTimeout(() => setEmailsCopied(false), 2500);
                });
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-black font-semibold shadow-lg hover:scale-[1.02] transition-transform"
            >
              {emailsCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {emailsCopied ? 'Copiados!' : 'Copiar todos'}
            </button>
          </div>

          {newsletterEmails.length === 0 ? (
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-8 text-center">
              <Mail className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">No hay emails aun. Los emails apareceran cuando haya pedidos.</p>
              <p className="text-xs text-zinc-600 mt-2">Cambia el filtro de periodo en Pedidos a "Todo" para ver todos los emails.</p>
            </div>
          ) : (
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 overflow-hidden">
              {/* Select all header */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/30">
                <input
                  type="checkbox"
                  checked={selectedEmails.size === newsletterEmails.length && newsletterEmails.length > 0}
                  onChange={e => {
                    if (e.target.checked) setSelectedEmails(new Set(newsletterEmails.map(x => x.email)));
                    else setSelectedEmails(new Set());
                  }}
                  className="w-4 h-4 rounded accent-yellow-400 cursor-pointer"
                />
                <span className="text-xs text-zinc-400 font-medium">Seleccionar todos ({selectedEmails.size}/{newsletterEmails.length})</span>
              </div>
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-zinc-500 font-medium border-b border-zinc-800/30">
                <div className="col-span-1"></div>
                <div className="col-span-4">Email</div>
                <div className="col-span-3">Tipo</div>
                <div className="col-span-4 text-right">Ultimo pedido</div>
              </div>
              <div className="divide-y divide-zinc-800/30 max-h-[500px] overflow-y-auto">
                {newsletterEmails.map(entry => (
                  <div key={entry.email} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-3 hover:bg-zinc-800/20 transition-colors items-center">
                    <div className="sm:col-span-1">
                      <input
                        type="checkbox"
                        checked={selectedEmails.has(entry.email)}
                        onChange={e => {
                          const next = new Set(selectedEmails);
                          if (e.target.checked) next.add(entry.email);
                          else next.delete(entry.email);
                          setSelectedEmails(next);
                        }}
                        className="w-4 h-4 rounded accent-yellow-400 cursor-pointer"
                      />
                    </div>
                    <div className="sm:col-span-4 text-sm text-zinc-300 truncate">{entry.email}</div>
                    <div className="sm:col-span-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        entry.type === 'Pago' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700/30 text-zinc-400'
                      }`}>{entry.type}</span>
                    </div>
                    <div className="sm:col-span-4 text-xs text-zinc-500 sm:text-right">{entry.lastOrder}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-zinc-600 text-center">
            Gestiona los emails de suscriptores para enviar newsletters
          </p>

          {/* Track selection for newsletter */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Selecciona los tracks para la newsletter</h3>
            <p className="text-xs text-zinc-500 mb-4">Elige que tracks aparecen en el email.</p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto mb-4">
              {tracks.map(t => (
                <label key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/30 cursor-pointer">
                  <input type="checkbox" checked={selectedTracks.has(t.id)} onChange={e => { const n = new Set(selectedTracks); if (e.target.checked) n.add(t.id); else n.delete(t.id); setSelectedTracks(n); }} className="w-4 h-4 accent-yellow-400 cursor-pointer" />
                  {t.coverUrl ? <img src={t.coverUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded bg-zinc-800 flex-shrink-0" />}
                  <span className="text-sm text-zinc-300 truncate flex-1">{t.title}</span>
                  <span className="text-xs text-zinc-500">{formatCredits(CREDIT_COSTS[t.category] || 1)}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mb-4">{selectedTracks.size} tracks seleccionados</p>

            {newsletterResult && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4 ${newsletterResult.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                {newsletterResult.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <Mail className="w-4 h-4 flex-shrink-0" />}
                {newsletterResult.msg}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { if (selectedTracks.size === 0 && selectedEmails.size === 0) { alert('Selecciona tracks y emails primero'); return; } setShowNewsletterPreview(true); }}
                disabled={selectedTracks.size === 0 || selectedEmails.size === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold hover:border-yellow-400/30 hover:text-white transition-colors disabled:opacity-30"
              >
                <Eye className="w-4 h-4" />
                Crear Newsletter
              </button>
              <button
                onClick={async () => {
                  if (selectedEmails.size === 0) { alert('Selecciona al menos un email'); return; }
                  if (selectedTracks.size === 0) { alert('Selecciona al menos un track'); return; }
                  if (!confirm(`Enviar newsletter con ${selectedTracks.size} tracks a ${selectedEmails.size} suscriptores?`)) return;
                  setSendingNewsletter(true);
                  setNewsletterResult(null);
                  try {
                    const r = await fetch('/api/send-newsletter', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
                      body: JSON.stringify({ emails: Array.from(selectedEmails), trackIds: Array.from(selectedTracks) }),
                    });
                    const data = await r.json();
                    if (data.ok) {
                      setNewsletterResult({ ok: true, msg: `Enviado a ${data.sent} suscriptores (${data.newTracks} novedades)${data.errors > 0 ? ` · ${data.errors} errores` : ''}` });
                    } else {
                      setNewsletterResult({ ok: false, msg: data.error || 'Error al enviar' });
                  }
                } catch {
                  setNewsletterResult({ ok: false, msg: 'Error de conexion' });
                } finally {
                  setSendingNewsletter(false);
                }
              }}
              disabled={sendingNewsletter || selectedEmails.size === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-bg text-black font-semibold shadow-lg hover:scale-[1.02] transition-transform disabled:opacity-50"
            >
              {sendingNewsletter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {sendingNewsletter ? 'Enviando...' : `Enviar Newsletter (${selectedEmails.size})`}
            </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Newsletter Preview Modal */}
      {showNewsletterPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4 overflow-y-auto py-8" onClick={() => setShowNewsletterPreview(false)}>
          <div className="w-full max-w-xl bg-[#0a0a0a] rounded-2xl border border-zinc-800 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-300">Preview Newsletter</h3>
              <button onClick={() => setShowNewsletterPreview(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4" style={{ background: 'linear-gradient(135deg, #1a1400 0%, #0a0a0a 30%)' }}>
              <div className="text-center">
                <img src="https://zuct57sgk5d1hhzr.public.blob.vercel-storage.com/logo/360djacademy-logo-HHE18DFGmGmD6hSP9jtuyiSUTarGeE.png" alt="" className="w-24 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-white">MUSIC <span className="gradient-text">DROP</span></h2>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-white mb-1">Nuevos Drops Disponibles</h3>
                <p className="text-sm text-zinc-400">{selectedTracks.size} novedades en la tienda</p>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
              <div className="space-y-2">
                {tracks.filter(t => selectedTracks.has(t.id)).map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
                    {t.coverUrl ? <img src={t.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-lg bg-zinc-800 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-200 truncate">{t.title}</p>
                      <p className="text-xs text-zinc-500">{t.genre}{t.bpm > 0 ? ` · ${t.bpm} BPM` : ''} · {formatCredits(CREDIT_COSTS[t.category] || 1)}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${(CREDIT_COSTS[t.category] || 1) > 0 ? 'bg-yellow-400/10 text-yellow-400' : 'bg-emerald-400/10 text-emerald-400'}`}>{(CREDIT_COSTS[t.category] || 1) > 0 ? 'NEW' : 'FREE'}</span>
                  </div>
                ))}
              </div>
              <div className="text-center pt-2">
                <span className="inline-block px-8 py-3 rounded-xl gradient-bg text-black font-bold text-sm">Ver novedades en la tienda</span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
              <div className="text-center">
                <p className="text-xs text-zinc-500 mb-1">Codigo de bienvenida:</p>
                <span className="text-yellow-400 font-bold text-lg tracking-widest">WELCOME20</span>
                <p className="text-[10px] text-zinc-600 mt-1">20% extra en primera compra de drops</p>
              </div>
            </div>
            <div className="p-4 border-t border-zinc-800 text-center text-xs text-zinc-600">
              Se enviara a {selectedEmails.size} suscriptores
            </div>
          </div>
        </div>
      )}

      {/* ============ PERFIL ============ */}
      {tab === 'settings' && (
        <AdminProfilesPanel adminToken={getAdminToken()} />
      )}

      {/* ============ COLABORADORES ============ */}
      {tab === 'collabs' && (
        <CollabManager adminToken={adminToken} tracks={tracks} onAddTrack={onAddTrack} onUpdateTrack={onUpdateTrack} onDeleteTrack={onDeleteTrack} />
      )}

      {/* ============ ECONOMIA ============ */}
      {tab === 'economia' && (
        <EconomiaPanel adminToken={adminToken} />
      )}

      {/* ============ PIRATERIA ============ */}
      {tab === 'pirateria' && (
        <PirateriaPanel adminToken={adminToken} />
      )}
    </div>
  );
}

/* ====== COLLAB MANAGER SUB-COMPONENT ====== */
interface CollabManagerProps {
  adminToken?: string;
  tracks: Track[];
  onAddTrack: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onUpdateTrack: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onDeleteTrack: (id: string) => void;
}

interface CollabEntry { id: string; name: string; }

function CollabManager({ adminToken, tracks, onAddTrack, onUpdateTrack, onDeleteTrack }: CollabManagerProps) {
  const [allCollabs, setAllCollabs] = useState<CollabEntry[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [collabSubTab, setCollabSubTab] = useState<'profile' | 'tracks' | 'billing'>('tracks');
  const [collabOrders, setCollabOrders] = useState<any[]>([]);
  const [collabOrdersRevenue, setCollabOrdersRevenue] = useState(0);
  const [collabOrdersLoading, setCollabOrdersLoading] = useState(false);
  const [collabOrdersPeriod, setCollabOrdersPeriod] = useState('month');
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<CollaboratorProfile>({
    bio: '', photoUrl: '', bannerUrl: '', artistName: '',
    socialLinks: {}, colorPrimary: '#FACC15', colorSecondary: '#EAB308',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (track: Track) => {
    if (!track.id) return;
    setDownloadingId(track.id);
    try {
      const params = new URLSearchParams({
        trackId: track.id,
        title: track.title || '',
        artist: track.artist || '',
        authors: track.authors || '',
        coverUrl: track.coverUrl || '',
        genre: track.genre || '',
        bpm: String(track.bpm || 0),
        session_id: 'admin',
      });
      const res = await fetch(`/api/download?${params}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = track.authors ? `${track.authors} - ${track.title}` : track.title;
      a.download = `${fileName}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download error:', e);
    } finally {
      setDownloadingId(null);
    }
  };

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [localPhotoPreview, setLocalPhotoPreview] = useState('');
  const [localBannerPreview, setLocalBannerPreview] = useState('');
  const [cropperImage, setCropperImage] = useState('');
  const [cropperMode, setCropperMode] = useState<'photo' | 'banner'>('photo');
  const [originalPhoto, setOriginalPhoto] = useState('');
  const [originalBanner, setOriginalBanner] = useState('');
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const [bannerDragOver, setBannerDragOver] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const handlePhotoFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setOriginalPhoto(url);
    setCropperMode('photo');
    setCropperImage(url);
  };

  const handleBannerFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setOriginalBanner(url);
    setCropperMode('banner');
    setCropperImage(url);
  };

  const handleCroppedImage = async (blob: Blob) => {
    const mode = cropperMode;
    setCropperImage('');
    const previewUrl = URL.createObjectURL(blob);
    const isBanner = mode === 'banner';

    if (isBanner) { setLocalBannerPreview(previewUrl); setUploadingBanner(true); }
    else { setLocalPhotoPreview(previewUrl); setUploadingPhoto(true); }

    const field = isBanner ? 'bannerUrl' : 'photoUrl';
    const folder = isBanner ? 'collab-banners' : 'collab-photos';
    const filename = isBanner ? 'banner' : 'profile';
    const clearPreview = () => { if (isBanner) setLocalBannerPreview(''); else setLocalPhotoPreview(''); };
    const stopLoading = () => { if (isBanner) setUploadingBanner(false); else setUploadingPhoto(false); };
    const setUrl = (url: string) => setProfile(prev => ({ ...prev, [field]: url }));

    try {
      const { uploadFile } = await import('../lib/upload');
      const url = await uploadFile(blob as any, folder, `${Date.now()}-${filename}.jpg`, adminToken);
      if (url) { setUrl(url); clearPreview(); stopLoading(); return; }
    } catch (e) { console.log('Upload failed, using base64:', e); }

    const reader = new FileReader();
    reader.onload = () => { setUrl(reader.result as string); clearPreview(); stopLoading(); };
    reader.onerror = () => stopLoading();
    reader.readAsDataURL(blob);
  };

  // Load registered collaborators from API only
  useEffect(() => {
    fetch('/api/collab-accounts-list', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.accounts && data.accounts.length > 0) {
          const list: CollabEntry[] = data.accounts.map((a: any) => ({
            id: a.collaboratorId,
            name: a.artistName || a.collaboratorId,
          }));
          setAllCollabs(list);
          setSelectedId(list[0].id);
        }
      })
      .catch(() => {});
  }, [adminToken]);

  const loadProfile = (id: string) => {
    setLoading(true);
    setSaved(false);
    fetch(`/api/collab-profile?id=${id}`)
      .then(r => r.json())
      .then(data => { if (data) setProfile(prev => ({ ...prev, ...data })); else setProfile({ bio: '', photoUrl: '', bannerUrl: '', artistName: '', socialLinks: {}, colorPrimary: '#FACC15', colorSecondary: '#EAB308' }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (selectedId) { loadProfile(selectedId); setEditingTrack(null); setIsAdding(false); } }, [selectedId]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/collab-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'X-Admin-Edit-Collab': selectedId,
        },
        body: JSON.stringify(profile),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  const handleTrackSave = (data: Omit<Track, 'id'> & { id?: string }) => {
    const enriched = {
      ...data,
      collaborator: true,
      collaboratorId: selectedId,
      artist: data.artist || profile.artistName || collabEntry?.name || selectedId,
    };
    if (editingTrack) {
      onUpdateTrack(enriched);
    } else {
      onAddTrack(enriched);
    }
    setEditingTrack(null);
    setIsAdding(false);
  };

  const handleDeleteCollab = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/collab-delete?id=${selectedId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        setAllCollabs(prev => prev.filter(c => c.id !== selectedId));
        const remaining = allCollabs.filter(c => c.id !== selectedId);
        setSelectedId(remaining[0]?.id || '');
      }
    } catch {}
    setDeleting(false);
  };

  const collabTracks = selectedId === '__all__' ? tracks.filter(t => !!t.collaboratorId) : tracks.filter(t => t.collaboratorId === selectedId);
  const filteredCollabTracks = collabTracks.filter(t => {
    if (!trackSearch.trim()) return true;
    const q = trackSearch.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q);
  });

  const fetchCollabOrders = (period: string) => {
    if (!selectedId || selectedId === '__all__') return;
    setCollabOrdersLoading(true);
    setCollabOrdersPeriod(period);
    // Use admin token but the API will return all orders — we filter client-side by collab tracks
    fetch(`/api/orders?period=${period}&limit=100`, { headers: { Authorization: `Bearer ${adminToken}` } })
      .then(r => r.ok ? r.json() : { orders: [] })
      .then(data => {
        if (data.orders) {
          const ct = tracks.filter(t => t.collaboratorId === selectedId);
          const ctTitles = ct.map(t => t.title.toLowerCase());
          const ctIds = ct.map(t => t.id);
          const filtered = data.orders.filter((o: any) =>
            (o.trackIds || []).some((id: string) => ctIds.includes(id)) ||
            (o.tracks || []).some((t: string) => ctTitles.includes((t || '').toLowerCase()))
          );
          const rev = filtered.reduce((s: number, o: any) => s + (o.amount || 0), 0);
          setCollabOrders(filtered);
          setCollabOrdersRevenue(rev);
        }
      })
      .catch(() => {})
      .finally(() => setCollabOrdersLoading(false));
  };

  useEffect(() => { if (collabSubTab === 'billing') fetchCollabOrders(collabOrdersPeriod); }, [collabSubTab, selectedId]);

  const inputClass = 'w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-yellow-400/50 text-sm';
  const collabEntry = allCollabs.find(c => c.id === selectedId);


  if (allCollabs.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
        <Users className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
        <p className="text-zinc-500">No hay colaboradores registrados</p>
        <p className="text-zinc-600 text-sm mt-1">Los colaboradores aparecerán aquí cuando se registren en /colab-admin</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Selector */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Selecciona colaborador</h3>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className={`${inputClass} appearance-none cursor-pointer pr-10`}
            >
              <option value="__all__">Todos</option>
              {allCollabs.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {selectedId && selectedId !== '__all__' && (
            <button
              onClick={handleDeleteCollab}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs: Tracks / Billing / Profile */}
      <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
        <button
          onClick={() => { setCollabSubTab('tracks'); setEditingTrack(null); setIsAdding(false); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${collabSubTab === 'tracks' ? 'gradient-bg text-black shadow-lg' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
        >
          <ListMusic className="w-4 h-4" />
          Tracks ({collabTracks.length})
        </button>
        <button
          onClick={() => { setCollabSubTab('billing'); setEditingTrack(null); setIsAdding(false); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${collabSubTab === 'billing' ? 'gradient-bg text-black shadow-lg' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
        >
          <DollarSign className="w-4 h-4" />
          Facturacion
        </button>
        <button
          onClick={() => { setCollabSubTab('profile'); setEditingTrack(null); setIsAdding(false); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${collabSubTab === 'profile' ? 'gradient-bg text-black shadow-lg' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
        >
          <User className="w-4 h-4" />
          Perfil
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
        </div>
      ) : collabSubTab === 'billing' ? (
        /* ===== BILLING TAB — DROPS SYSTEM ===== */
        <CollabBillingPanel adminToken={adminToken} collaboratorId={selectedId} collaboratorName={collabEntry?.name || selectedId} />
      ) : collabSubTab === 'tracks' ? (
        /* ===== TRACKS TAB ===== */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {(isAdding || editingTrack) ? (
            <AdminTrackForm
              track={editingTrack}
              adminToken={adminToken || ''}
              defaultArtist={profile.artistName || collabEntry?.name || ''}
              hideCollaboratorCheckbox
              onSave={handleTrackSave}
              onCancel={() => { setEditingTrack(null); setIsAdding(false); }}
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
                <div className="relative flex-1 sm:flex-initial sm:ml-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={trackSearch}
                    onChange={e => setTrackSearch(e.target.value)}
                    placeholder="Buscar track..."
                    className="w-full sm:w-52 pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors"
                  />
                </div>
              </div>

              <p className="text-sm text-zinc-500">
                {filteredCollabTracks.length} track{filteredCollabTracks.length !== 1 ? 's' : ''}
              </p>

              {/* Track list */}
              <div className="space-y-2">
                {filteredCollabTracks.map((track, i) => (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors group"
                  >
                    <div className="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {track.coverUrl ? <img src={track.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music className="w-6 h-6 text-zinc-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-200 truncate">{track.title}</p>
                        {track.featured && <Star className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 fill-yellow-400" />}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                        <span className="font-medium text-yellow-400">{CATEGORY_LABELS[track.category]}</span>
                        <span>{track.genre}</span>
                        {track.bpm > 0 && <span>{track.bpm} BPM</span>}
                        {track.duration > 0 && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatDuration(track.duration)}</span>}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-yellow-400 hidden sm:block flex-shrink-0">{formatCredits(CREDIT_COSTS[track.category] || 1)}</span>
                    <div className="flex items-center gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                      {track.fileUrl && (
                        <button onClick={() => handleDownload(track)} disabled={downloadingId === track.id} className="p-2 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors" title="Descargar">
                          {downloadingId === track.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                      )}
                      <button onClick={() => { setEditingTrack(track); setIsAdding(false); }} className="p-2 rounded-lg text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => { if (confirm(`Eliminar "${track.title}"?`)) onDeleteTrack(track.id); }} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </motion.div>
                ))}
                {filteredCollabTracks.length === 0 && (
                  <div className="text-center py-16">
                    <ListMusic className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500">Este colaborador no tiene tracks</p>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      ) : (
        /* ===== PROFILE TAB ===== */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
          {/* Artist name */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <label className="block text-xs text-zinc-500 mb-1">Nombre artístico</label>
            <input
              type="text"
              value={profile.artistName}
              onChange={e => setProfile(prev => ({ ...prev, artistName: e.target.value }))}
              placeholder={collabEntry?.name}
              className={inputClass}
            />
          </div>

          {/* Bio */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <label className="block text-xs text-zinc-500 mb-1">Biografía</label>
            <textarea
              value={profile.bio}
              onChange={e => setProfile(prev => ({ ...prev, bio: e.target.value.substring(0, 300) }))}
              placeholder="Bio del colaborador..."
              className={`${inputClass} h-24 resize-none`}
            />
            <p className="text-[10px] text-zinc-600 mt-1 text-right">{profile.bio.length}/300</p>
          </div>

          {/* Imágenes — visual upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Foto de perfil */}
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
              <h3 className="text-xs font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-yellow-400" />
                Foto de perfil
              </h3>
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`relative w-28 h-28 rounded-full border-3 overflow-hidden cursor-pointer group transition-colors ${photoDragOver ? 'border-yellow-400/50 bg-yellow-400/5' : 'border-zinc-700'}`}
                  onClick={() => photoRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setPhotoDragOver(true); }}
                  onDragLeave={() => setPhotoDragOver(false)}
                  onDrop={e => { e.preventDefault(); setPhotoDragOver(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handlePhotoFile(f); }}
                >
                  {(localPhotoPreview || profile.photoUrl) ? (
                    <img src={localPhotoPreview || profile.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                      <User className="w-10 h-10 text-zinc-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {uploadingPhoto ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Upload className="w-5 h-5 text-white" />}
                  </div>
                </div>
                {(profile.photoUrl || localPhotoPreview) && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setCropperMode('photo'); setCropperImage(originalPhoto || profile.photoUrl); }} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-yellow-400/30 transition-colors">
                      Editar recorte
                    </button>
                    <button type="button" onClick={() => { setProfile(prev => ({ ...prev, photoUrl: '' })); setLocalPhotoPreview(''); setOriginalPhoto(''); }} className="text-[10px] px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors">
                      Eliminar
                    </button>
                  </div>
                )}
                <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); if (photoRef.current) photoRef.current.value = ''; }} />
              </div>
            </div>

            {/* Fondo de página */}
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
              <h3 className="text-xs font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <Image className="w-3.5 h-3.5 text-yellow-400" />
                Fondo de página
              </h3>
              <div
                className={`relative w-full rounded-lg overflow-hidden cursor-pointer group border mb-2 transition-colors ${bannerDragOver ? 'border-yellow-400/50 bg-yellow-400/5' : 'border-zinc-700'}`}
                style={{ aspectRatio: '1920/720' }}
                onClick={() => bannerRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setBannerDragOver(true); }}
                onDragLeave={() => setBannerDragOver(false)}
                onDrop={e => { e.preventDefault(); setBannerDragOver(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleBannerFile(f); }}
              >
                {(localBannerPreview || profile.bannerUrl) ? (
                  <>
                    <img src={localBannerPreview || profile.bannerUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white font-black text-xs uppercase tracking-wider drop-shadow">{profile.artistName || selectedId}</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full bg-zinc-800/50 flex flex-col items-center justify-center gap-1">
                    <Upload className="w-5 h-5 text-zinc-600 group-hover:text-yellow-400 transition-colors" />
                    <span className="text-[9px] text-zinc-600">Subir foto</span>
                    <span className="text-[9px] text-zinc-600">1920 × 720 px</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingBanner ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Upload className="w-4 h-4 text-white" />}
                </div>
              </div>
              {(profile.bannerUrl || localBannerPreview) && (
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => { setCropperMode('banner'); setCropperImage(originalBanner || profile.bannerUrl); }} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-yellow-400/30 transition-colors">Editar recorte</button>
                  <button type="button" onClick={() => bannerRef.current?.click()} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-yellow-400/30 transition-colors">Cambiar</button>
                  <button type="button" onClick={() => { setProfile(prev => ({ ...prev, bannerUrl: '' })); setLocalBannerPreview(''); setOriginalBanner(''); }} className="text-[10px] px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors">Eliminar</button>
                </div>
              )}
              <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; handleBannerFile(f); if (bannerRef.current) bannerRef.current.value = ''; }} />
            </div>
          </div>

          {/* Image Cropper Modal */}
          {cropperImage && (
            <ImageCropper
              imageUrl={cropperImage}
              shape={cropperMode === 'banner' ? 'banner' : 'circle'}
              onCrop={handleCroppedImage}
              onCancel={() => setCropperImage('')}
            />
          )}

          {/* Social links */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Redes sociales</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['instagram', 'tiktok', 'spotify', 'youtube', 'soundcloud'].map(key => (
                <div key={key}>
                  <label className="block text-xs text-zinc-500 mb-1 capitalize">{key}</label>
                  <input
                    type="url"
                    value={(profile.socialLinks as any)[key] || ''}
                    onChange={e => setProfile(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, [key]: e.target.value } }))}
                    placeholder={`https://${key}.com/...`}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl gradient-bg text-black font-semibold shadow-lg hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

// ============ ECONOMIA PANEL ============
function EconomiaPanel({ adminToken }: { adminToken?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    setLoading(true);
    fetch(`/api/revenue?month=${month}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [month, adminToken]);

  const formatEur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

  // Generate last 6 months for selector
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-yellow-400" />
          Economia
        </h3>
        <select value={month} onChange={e => setMonth(e.target.value)} className="px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm">
          {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-yellow-400 animate-spin" /></div>
      ) : !data || data.error ? (
        <div className="text-center py-16 text-zinc-500">No hay datos para este mes</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-5">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Ingresos Stripe</p>
              <p className="text-2xl font-black gradient-text mt-2">{formatEur(data.totalStripeRevenue || 0)}</p>
              <p className="text-[10px] text-zinc-600 mt-1">{data.dropPurchaseCount || 0} compras de drops</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-5">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Pago colaboradores</p>
              <p className="text-2xl font-black text-red-400 mt-2">{formatEur(data.totalCollabPayments || 0)}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-5">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Beneficio plataforma</p>
              <p className="text-2xl font-black text-green-400 mt-2">{formatEur(data.totalPlatformRevenue || 0)}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-5">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Descargas externas</p>
              <p className="text-2xl font-black text-white mt-2">{data.transactionCount || 0}</p>
              <p className="text-xs text-zinc-500 mt-1">{data.totalDropsConsumed || 0} drops</p>
            </div>
          </div>

          {/* Collaborator breakdown */}
          <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 overflow-hidden">
            <div className="p-5 border-b border-zinc-800/50">
              <h4 className="text-sm font-bold text-white">Desglose por colaborador</h4>
              <p className="text-[10px] text-zinc-500 mt-0.5">65% colaborador / 35% plataforma (solo descargas de clientes reales)</p>
            </div>
            {(!data.collaborators || data.collaborators.length === 0) ? (
              <div className="text-center py-12 text-zinc-500 text-sm">Sin descargas externas este mes</div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {data.collaborators.map((c: any) => (
                  <div key={c.collaboratorId} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                      <User className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-200">{c.collaboratorId}</p>
                      <p className="text-xs text-zinc-500">{c.downloads} descargas · {c.drops} drops</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-400">{formatEur(c.eurEarned)}</p>
                      <p className="text-[10px] text-zinc-600">a pagar</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drop purchases (Stripe payments) */}
          <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 overflow-hidden">
            <div className="p-5 border-b border-zinc-800/50">
              <h4 className="text-sm font-bold text-white">Compras de drops (Stripe)</h4>
              <p className="text-[10px] text-zinc-500 mt-0.5">Pagos reales con datos completos del comprador</p>
            </div>
            {(!data.dropPurchases || data.dropPurchases.length === 0) ? (
              <div className="text-center py-12 text-zinc-500 text-sm">Sin compras de drops este mes</div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {data.dropPurchases.map((p: any, i: number) => (
                  <div key={i} className="px-5 py-4 hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-green-400">{formatEur(p.amount || 0)}</p>
                          <p className="text-[10px] text-zinc-500">{p.packId} · {p.credits}{p.bonus ? ` +${p.bonus} bonus` : ''} drops</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-400">{p.date ? new Date(p.date).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                        {p.promoCode && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 font-bold">{p.promoCode}</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div><span className="text-zinc-600">Nombre:</span> <span className="text-zinc-300">{p.stripeName || p.userName || '-'}</span></div>
                      <div><span className="text-zinc-600">Email:</span> <span className="text-zinc-300">{p.stripeEmail || p.userEmail || '-'}</span></div>
                      <div><span className="text-zinc-600">Pais:</span> <span className="text-zinc-300">{p.stripeCountry || '-'}{p.stripeCity ? `, ${p.stripeCity}` : ''}</span></div>
                      <div><span className="text-zinc-600">IP:</span> <span className="text-zinc-300 font-mono text-[10px]">{p.ip || '-'}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============ PIRATERIA PANEL ============
function PirateriaPanel({ adminToken }: { adminToken?: string }) {
  const [watermark, setWatermark] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrace = async () => {
    if (!watermark.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`/api/trace-watermark?watermark=${encodeURIComponent(watermark.trim())}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setError(data.error || 'No encontrado');
    } catch { setError('Error de conexion'); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Eye className="w-5 h-5 text-red-400" />
          Rastreo de pirateria
        </h3>
        <p className="text-sm text-zinc-500 mt-1">Identifica quien ha filtrado un track a partir del codigo de marca de agua</p>
      </div>

      <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-6">
        <h4 className="text-sm font-bold text-white mb-3">Como rastrear un MP3 pirata</h4>
        <div className="space-y-3 text-sm text-zinc-400">
          <div className="flex gap-3"><span className="w-6 h-6 rounded-full bg-yellow-400/10 text-yellow-400 text-xs font-bold flex items-center justify-center flex-shrink-0">1</span><p>Descarga el MP3 pirata que hayas encontrado</p></div>
          <div className="flex gap-3"><span className="w-6 h-6 rounded-full bg-yellow-400/10 text-yellow-400 text-xs font-bold flex items-center justify-center flex-shrink-0">2</span><p>Clic derecho sobre el archivo &gt; Propiedades &gt; Detalles (o usa Mp3tag / Kid3)</p></div>
          <div className="flex gap-3"><span className="w-6 h-6 rounded-full bg-yellow-400/10 text-yellow-400 text-xs font-bold flex items-center justify-center flex-shrink-0">3</span><p>Busca el campo <span className="text-yellow-400 font-mono">Comentario</span>: <span className="font-mono text-zinc-300">musicdrop.es|a1b2c3d4e5f6</span></p></div>
          <div className="flex gap-3"><span className="w-6 h-6 rounded-full bg-yellow-400/10 text-yellow-400 text-xs font-bold flex items-center justify-center flex-shrink-0">4</span><p>Copia los 12 caracteres despues del <span className="font-mono text-zinc-300">|</span> y pegalos aqui abajo</p></div>
        </div>
      </div>

      <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-6">
        <h4 className="text-sm font-bold text-white mb-3">Buscar por marca de agua</h4>
        <div className="flex gap-3">
          <input type="text" value={watermark} onChange={e => setWatermark(e.target.value.replace(/[^a-fA-F0-9]/g, ''))} placeholder="Pega el codigo (ej: a1b2c3d4e5f6)" className="flex-1 px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-red-400/50 text-sm font-mono tracking-wider" maxLength={12} />
          <button onClick={handleTrace} disabled={loading || watermark.length < 6} className="px-6 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Rastrear
          </button>
        </div>
        {error && <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>}
        {result && (
          <div className="mt-4 bg-red-500/5 border border-red-500/20 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
              <p className="text-sm font-bold text-red-400">Filtrador identificado</p>
              {result.isInternal && <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">CUENTA INTERNA</span>}
            </div>
            <div className="p-5 space-y-4">
              {/* Cuenta MusicDrop */}
              <div>
                <p className="text-[9px] text-red-400/60 font-bold uppercase tracking-widest mb-2">Cuenta MusicDrop</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">Nombre</p><p className="text-sm font-semibold text-white">{result.name || '-'}</p></div>
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">Email</p><p className="text-sm font-semibold text-white">{result.email || '-'}</p></div>
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">Cuenta creada</p><p className="text-sm text-zinc-300">{result.accountCreated ? new Date(result.accountCreated).toLocaleDateString('es-ES') : '-'}</p></div>
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">Drops actuales</p><p className="text-sm text-zinc-300">{result.currentCredits ?? '-'} dr</p></div>
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">Total descargas</p><p className="text-sm text-zinc-300">{result.totalDownloads ?? '-'}</p></div>
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">User ID</p><p className="text-[11px] text-zinc-500 font-mono">{result.userId || '-'}</p></div>
                </div>
              </div>
              {/* Descarga rastreada */}
              <div className="pt-3 border-t border-red-500/10">
                <p className="text-[9px] text-red-400/60 font-bold uppercase tracking-widest mb-2">Descarga rastreada</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2"><p className="text-[10px] text-zinc-600 mb-0.5">Track</p><p className="text-sm text-white font-medium">{result.trackTitle || result.trackId || '-'}</p></div>
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">Fecha y hora</p><p className="text-sm text-zinc-300">{result.downloadDate ? new Date(result.downloadDate).toLocaleString('es-ES') : '-'}</p></div>
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">IP descarga</p><p className="text-sm text-zinc-300 font-mono">{result.downloadIp || '-'}</p></div>
                  <div><p className="text-[10px] text-zinc-600 mb-0.5">Watermark</p><p className="text-sm text-red-400 font-mono font-bold">{result.watermark}</p></div>
                </div>
              </div>
              {/* Datos de pago Stripe */}
              {(result.stripeName || result.stripeEmail || result.stripeCountry) && (
                <div className="pt-3 border-t border-red-500/10">
                  <p className="text-[9px] text-red-400/60 font-bold uppercase tracking-widest mb-2">Datos de pago (Stripe)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div><p className="text-[10px] text-zinc-600 mb-0.5">Nombre tarjeta</p><p className="text-sm text-white font-medium">{result.stripeName || '-'}</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-0.5">Email pago</p><p className="text-sm text-zinc-300">{result.stripeEmail || '-'}</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-0.5">Pais / Ciudad</p><p className="text-sm text-zinc-300">{result.stripeCountry || '-'}{result.stripeCity ? `, ${result.stripeCity}` : ''}</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-0.5">IP compra</p><p className="text-sm text-zinc-300 font-mono">{result.purchaseIp || '-'}</p></div>
                    <div><p className="text-[10px] text-zinc-600 mb-0.5">Fecha compra</p><p className="text-sm text-zinc-300">{result.purchaseDate ? new Date(result.purchaseDate).toLocaleString('es-ES') : '-'}</p></div>
                  </div>
                </div>
              )}
              {!result.stripeName && !result.stripeEmail && !result.stripeCountry && (
                <div className="pt-3 border-t border-red-500/10">
                  <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">Datos de pago (Stripe)</p>
                  <p className="text-xs text-zinc-600">Este usuario no ha comprado drops con tarjeta (sus drops fueron a\u00f1adidos manualmente)</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 p-6">
        <h4 className="text-sm font-bold text-white mb-3">Proteccion activa</h4>
        <div className="space-y-2 text-sm text-zinc-400">
          <p>Cada MP3 descargado lleva una <span className="text-yellow-400">marca de agua unica</span> del usuario en los metadatos ID3.</p>
          <p>La marca se aplica <span className="text-white">automaticamente</span> en cada descarga. No necesitas hacer nada.</p>
          <p>Si alguien sube un track a internet, extrae el codigo y rastrealo aqui para obtener nombre, email e IP.</p>
          <p className="text-zinc-600 text-xs mt-2">Las marcas se almacenan 1 ano. Todos los tracks descargados desde la web ya llevan marca.</p>
        </div>
      </div>
    </div>
  );
}

// ============ COLLAB BILLING (DROPS SYSTEM) ============
function CollabBillingPanel({ adminToken, collaboratorId, collaboratorName }: { adminToken?: string; collaboratorId: string; collaboratorName: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!collaboratorId) return;
    setLoading(true);
    fetch(`/api/revenue?month=${month}`, { headers: { 'Authorization': `Bearer ${adminToken}` } })
      .then(r => r.json())
      .then(d => {
        const collab = d.collaborators?.find((c: any) => c.collaboratorId === collaboratorId);
        setData({ ...d, collab });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [month, collaboratorId, adminToken]);

  const formatEur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
  const months: string[] = [];
  for (let i = 0; i < 6; i++) { const d = new Date(); d.setMonth(d.getMonth() - i); months.push(d.toISOString().slice(0, 7)); }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white">Facturacion — {collaboratorName}</h4>
        <select value={month} onChange={e => setMonth(e.target.value)} className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs">
          {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-yellow-400 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
              <div className="text-2xl font-bold text-zinc-50">{data?.collab?.downloads || 0}</div>
              <div className="text-xs text-zinc-500">Descargas</div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
              <div className="text-2xl font-bold gradient-text">{data?.collab?.drops || 0} dr</div>
              <div className="text-xs text-zinc-500">Drops consumidos</div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
              <div className="text-2xl font-bold text-green-400">{formatEur(data?.collab?.eurEarned || 0)}</div>
              <div className="text-xs text-zinc-500">Editor (65%)</div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
              <div className="text-2xl font-bold text-yellow-400">{formatEur(data?.collab?.eurPlatform || 0)}</div>
              <div className="text-xs text-zinc-500">Plataforma (35%)</div>
            </div>
          </div>
          <p className="text-xs text-zinc-600">Solo descargas de clientes reales (no internas). Reparto: 65% editor / 35% plataforma.</p>
          {(!data?.collab || data.collab.downloads === 0) && (
            <div className="text-center py-8 text-zinc-600 text-sm">Sin descargas externas en {new Date(month + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ============ ADMIN PROFILES (Alex Selas + Music Drop) ============
function AdminProfilesPanel({ adminToken }: { adminToken: string }) {
  const [activeProfile, setActiveProfile] = useState<'alex-selas' | 'music-drop'>('alex-selas');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
        <button
          onClick={() => setActiveProfile('alex-selas')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeProfile === 'alex-selas' ? 'gradient-bg text-black shadow-lg' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
        >
          <User className="w-4 h-4" />
          Alex Selas
        </button>
        <button
          onClick={() => setActiveProfile('music-drop')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeProfile === 'music-drop' ? 'gradient-bg text-black shadow-lg' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
        >
          <Music className="w-4 h-4" />
          MusicDrop
        </button>
      </div>

      <CollabProfileForm
        key={activeProfile}
        collaboratorId={activeProfile}
        collaboratorName={activeProfile === 'alex-selas' ? 'Alex Selas' : 'MusicDrop'}
        collabToken={adminToken}
        adminEditCollabId={activeProfile}
      />
    </div>
  );
}
