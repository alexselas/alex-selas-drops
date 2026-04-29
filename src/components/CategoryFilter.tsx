import { Disc3, Radio, Repeat, Layers, Package, Zap, ArrowLeftRight, Mic, Combine } from 'lucide-react';
import type { Category } from '../types';

interface CategoryFilterProps {
  selected: Category | 'all' | 'packs';
  onSelect: (cat: Category | 'all' | 'packs') => void;
  showOriginales?: boolean;
}

const categories: { value: Category | 'all' | 'packs'; label: string; icon: typeof Disc3; onlyCollab?: boolean }[] = [
  { value: 'all', label: 'Todos', icon: Disc3 },
  { value: 'remixes', label: 'Remixes', icon: Repeat },
  { value: 'mashups', label: 'Mashups', icon: Layers },
  { value: 'livemashups', label: 'Live Mashups', icon: Combine },
  { value: 'hypeintros', label: 'Hype Intros', icon: Zap },
  { value: 'transiciones', label: 'Transiciones', icon: ArrowLeftRight },
  { value: 'packs', label: 'Packs', icon: Package },
  { value: 'sesiones', label: 'Sesiones', icon: Radio },
  { value: 'originales', label: 'Originales', icon: Mic, onlyCollab: true },
];

export default function CategoryFilter({ selected, onSelect, showOriginales }: CategoryFilterProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
      {categories.filter(cat => !cat.onlyCollab || showOriginales).map(cat => {
        const Icon = cat.icon;
        const active = selected === cat.value;
        return (
          <button
            key={cat.value}
            onClick={() => onSelect(cat.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              active
                ? 'gradient-bg text-black shadow-lg glow'
                : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
