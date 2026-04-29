import { Disc3, Radio, Repeat, Layers, Package, Zap, ArrowLeftRight, Mic, Combine } from 'lucide-react';
import type { Category } from '../types';

interface CategoryFilterProps {
  selected: Category | 'all' | 'packs';
  onSelect: (cat: Category | 'all' | 'packs') => void;
  showOriginales?: boolean;
}

const categories: { value: Category | 'all' | 'packs'; label: string; icon: typeof Disc3; color: string; onlyCollab?: boolean }[] = [
  { value: 'all', label: 'Todos', icon: Disc3, color: 'text-zinc-300 border-zinc-600' },
  { value: 'remixes', label: 'Remixes', icon: Repeat, color: 'text-violet-400 border-violet-400/40' },
  { value: 'mashups', label: 'Mashups', icon: Layers, color: 'text-yellow-400 border-yellow-400/40' },
  { value: 'livemashups', label: 'Live Mashups', icon: Combine, color: 'text-fuchsia-400 border-fuchsia-400/40' },
  { value: 'hypeintros', label: 'Hype Intros', icon: Zap, color: 'text-pink-400 border-pink-400/40' },
  { value: 'transiciones', label: 'Transiciones', icon: ArrowLeftRight, color: 'text-cyan-400 border-cyan-400/40' },
  { value: 'packs', label: 'Packs', icon: Package, color: 'text-blue-400 border-blue-400/40' },
  { value: 'sesiones', label: 'Sesiones', icon: Radio, color: 'text-emerald-400 border-emerald-400/40' },
  { value: 'originales', label: 'Originales', icon: Mic, color: 'text-orange-400 border-orange-400/40', onlyCollab: true },
];

export default function CategoryFilter({ selected, onSelect, showOriginales }: CategoryFilterProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {categories.filter(cat => !cat.onlyCollab || showOriginales).map(cat => {
        const Icon = cat.icon;
        const active = selected === cat.value;
        return (
          <button
            key={cat.value}
            onClick={() => onSelect(cat.value)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap border ${
              active
                ? 'gradient-bg text-black border-yellow-400 shadow-lg glow'
                : `bg-zinc-900/50 ${cat.color} hover:bg-zinc-800/80`
            }`}
          >
            <Icon className="w-3 h-3" />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
