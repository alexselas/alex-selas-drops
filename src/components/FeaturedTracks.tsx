import { Sparkles } from 'lucide-react';
import type { Track } from '../types';
import TrackCard from './TrackCard';

interface FeaturedTracksProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isInCart: (id: string) => boolean;
  onPlay: (track: Track) => void;
  onAddToCart: (track: Track) => void;
  onDetail: (track: Track) => void;
}

export default function FeaturedTracks({
  tracks,
  currentTrackId,
  isPlaying,
  isInCart,
  onPlay,
  onAddToCart,
  onDetail,
}: FeaturedTracksProps) {
  const featured = tracks.filter(t => t.featured && !t.collaborator);

  return (
    <section id="featured" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-10">
          <Sparkles className="w-6 h-6 text-yellow-400" />
          <h2 className="text-3xl font-bold text-zinc-50">Destacados</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {featured.map(track => (
            <TrackCard
              key={track.id}
              track={track}
              isPlaying={isPlaying}
              isCurrentTrack={currentTrackId === track.id}
              isInCart={isInCart(track.id)}
              onPlay={() => onPlay(track)}
              onAddToCart={() => onAddToCart(track)}
              onDetail={() => onDetail(track)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
