import type { Category } from '../types';

interface CategoryFilterProps {
  selected: Category | 'all' | 'packs';
  onSelect: (cat: Category | 'all' | 'packs') => void;
  showOriginales?: boolean;
}

const categories: { value: Category | 'all' | 'packs'; label: string; dot: string; activeBg: string; onlyCollab?: boolean }[] = [
  { value: 'all', label: 'Todos', dot: 'bg-zinc-400', activeBg: 'gradient-bg text-black' },
  { value: 'remixes', label: 'Remixes', dot: 'bg-violet-400', activeBg: 'bg-violet-400/20 text-violet-400 border-violet-400/40' },
  { value: 'mashups', label: 'Mashups', dot: 'bg-yellow-400', activeBg: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/40' },
  { value: 'livemashups', label: 'Live Mashups', dot: 'bg-fuchsia-400', activeBg: 'bg-fuchsia-400/20 text-fuchsia-400 border-fuchsia-400/40' },
  { value: 'hypeintros', label: 'Hype Intros', dot: 'bg-pink-400', activeBg: 'bg-pink-400/20 text-pink-400 border-pink-400/40' },
  { value: 'transiciones', label: 'Transiciones', dot: 'bg-cyan-400', activeBg: 'bg-cyan-400/20 text-cyan-400 border-cyan-400/40' },
  { value: 'packs', label: 'Packs', dot: 'bg-blue-400', activeBg: 'bg-blue-400/20 text-blue-400 border-blue-400/40' },
  { value: 'sesiones', label: 'Sesiones', dot: 'bg-emerald-400', activeBg: 'bg-emerald-400/20 text-emerald-400 border-emerald-400/40' },
  { value: 'originales', label: 'Originales', dot: 'bg-orange-400', activeBg: 'bg-orange-400/20 text-orange-400 border-orange-400/40', onlyCollab: true },
];

export default function CategoryFilter({ selected, onSelect, showOriginales }: CategoryFilterProps) {
  return (
    <div className="relative">
      <div
        className="flex gap-1.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {categories.filter(cat => !cat.onlyCollab || showOriginales).map(cat => {
          const active = selected === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => onSelect(cat.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all whitespace-nowrap flex-shrink-0 border ${
                active
                  ? cat.value === 'all' ? 'gradient-bg text-black border-transparent shadow-lg' : `${cat.activeBg}`
                  : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? (cat.value === 'all' ? 'bg-black' : cat.dot) : cat.dot} ${active ? 'opacity-100' : 'opacity-50'}`} />
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
