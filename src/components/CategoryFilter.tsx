import { Disc3, Radio, Repeat, Layers, Library, Package } from 'lucide-react';
import type { Category } from '../types';

interface CategoryFilterProps {
  selected: Category | 'all' | 'packs';
  onSelect: (cat: Category | 'all' | 'packs') => void;
}

const categories: { value: Category | 'all' | 'packs'; label: string; icon: typeof Disc3 }[] = [
  { value: 'all', label: 'Todos', icon: Disc3 },
  { value: 'remixes', label: 'Remixes', icon: Repeat },
  { value: 'mashups', label: 'Mashups', icon: Layers },
  { value: 'packs', label: 'Packs', icon: Package },
  { value: 'sesiones', label: 'Sesiones', icon: Radio },
  { value: 'librerias', label: 'Librerías', icon: Library },
];

export default function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map(cat => {
        const Icon = cat.icon;
        const active = selected === cat.value;
        return (
          <button
            key={cat.value}
            onClick={() => onSelect(cat.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
              active
                ? 'gradient-bg text-black shadow-lg glow'
                : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
