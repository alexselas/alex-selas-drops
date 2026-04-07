import { Trash2, Music } from 'lucide-react';
import type { CartItem as CartItemType } from '../types';
import { formatPrice } from '../lib/utils';

interface CartItemProps {
  item: CartItemType;
  onRemove: () => void;
}

export default function CartItem({ item, onRemove }: CartItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-[14px] bg-zinc-800/30">
      {/* Cover */}
      <div className="w-12 h-12 rounded-xl bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
        {item.track.coverUrl ? (
          <img src={item.track.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Music className="w-5 h-5 text-zinc-600" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate">{item.track.title}</p>
        <p className="text-xs text-zinc-500">{item.track.genre}</p>
      </div>

      {/* Price + remove */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-yellow-400">{formatPrice(item.track.price)}</span>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
