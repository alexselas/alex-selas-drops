import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Edit2, Trash2, LogOut, Music, Clock, Package,
  ListMusic, Search, ChevronDown, Star, User,
} from 'lucide-react';
import type { Track, Category, Collaborator } from '../types';
import { formatPrice, formatDuration } from '../lib/utils';
import AdminTrackForm from './AdminTrackForm';
import PackUploadForm from './PackUploadForm';
import CollabProfileForm from './CollabProfileForm';

type CollabTab = 'tracks' | 'profile';

interface CollabPanelProps {
  collaborator: Collaborator;
  tracks: Track[];
  onAddTrack: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onUpdateTrack: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onDeleteTrack: (id: string) => void;
  onLogout: () => void;
  collabToken: string;
}

export default function CollabPanel({
  collaborator,
  tracks,
  onAddTrack,
  onUpdateTrack,
  onDeleteTrack,
  onLogout,
  collabToken,
}: CollabPanelProps) {
  const [tab, setTab] = useState<CollabTab>('tracks');
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingPack, setIsAddingPack] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState<Category | 'all'>('all');

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header — same as AdminPanel */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {collaborator.photoUrl ? (
            <img
              src={collaborator.photoUrl}
              alt={collaborator.name}
              className="w-10 h-10 rounded-xl object-cover"
            />
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
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400/30 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50 mb-8">
        {([
          { id: 'tracks' as CollabTab, label: 'Tracks', icon: ListMusic },
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

      {/* ============ MI PERFIL ============ */}
      {tab === 'profile' && (
        <CollabProfileForm
          collaboratorId={collaborator.id}
          collaboratorName={collaborator.name}
          collabToken={collabToken}
        />
      )}

      {/* ============ TRACKS ============ */}
      {tab === 'tracks' && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Form */}
        {isAddingPack ? (
          <PackUploadForm
            adminToken={collabToken}
            defaultArtist={collaborator.name}
            hideCollaboratorCheckbox
            onSavePack={async (packTracks) => {
              for (const t of packTracks) handleSave(t);
              setIsAddingPack(false);
            }}
            onCancel={() => setIsAddingPack(false)}
          />
        ) : (isAdding || editingTrack) ? (
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
                <button
                  onClick={() => setIsAddingPack(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold hover:border-yellow-400/30 hover:text-white transition-colors"
                >
                  <Package className="w-5 h-5" />
                  Subir Pack
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

            {/* Track list — same as AdminPanel */}
            <div className="space-y-2">
              {filteredTracks.map((track, i) => (
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
                      <Music className="w-6 h-6 text-zinc-600" />
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
                    {track.artist && (
                      <p className="text-xs text-zinc-400 mt-0.5 truncate">{track.artist}{track.authors ? ` — ${track.authors}` : ''}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                      <span className={`font-medium ${categoryColors[track.category]}`}>
                        {categoryLabels[track.category]}
                      </span>
                      <span>{track.genre}</span>
                      {track.bpm > 0 && <span>{track.bpm} BPM</span>}
                      {track.key && <span>{track.key}</span>}
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
              ))}

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
