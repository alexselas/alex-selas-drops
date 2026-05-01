import type { Category } from '../types';

interface CategoryFilterProps {
  selected: Category | 'all';
  onSelect: (cat: Category | 'all') => void;
  showOriginales?: boolean;
}

const categories: { value: Category | 'all'; label: string; dot: string; activeBg: string; onlyCollab?: boolean }[] = [
  { value: 'all', label: 'Todo', dot: 'bg-zinc-400', activeBg: 'gradient-bg text-black' },
  { value: 'extended', label: 'Extended', dot: 'bg-amber-400', activeBg: 'bg-amber-400/20 text-amber-400 border-amber-400/40' },
  { value: 'remixes', label: 'Remixes', dot: 'bg-violet-400', activeBg: 'bg-violet-400/20 text-violet-400 border-violet-400/40' },
  { value: 'mashups', label: 'Mashups', dot: 'bg-yellow-400', activeBg: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/40' },
  { value: 'livemashups', label: 'Live Mashups', dot: 'bg-fuchsia-400', activeBg: 'bg-fuchsia-400/20 text-fuchsia-400 border-fuchsia-400/40' },
  { value: 'hypeintros', label: 'Hype Intros', dot: 'bg-pink-400', activeBg: 'bg-pink-400/20 text-pink-400 border-pink-400/40' },
  { value: 'transiciones', label: 'Transiciones', dot: 'bg-cyan-400', activeBg: 'bg-cyan-400/20 text-cyan-400 border-cyan-400/40' },
  { value: 'sesiones', label: 'Sesiones', dot: 'bg-emerald-400', activeBg: 'bg-emerald-400/20 text-emerald-400 border-emerald-400/40' },
  { value: 'originales', label: 'Originales', dot: 'bg-orange-400', activeBg: 'bg-orange-400/20 text-orange-400 border-orange-400/40', onlyCollab: true },
];

export default function CategoryFilter({ selected, onSelect, showOriginales }: CategoryFilterProps) {
  return (
    <div className="relative" role="group" aria-label="Filtrar por categoría">
      <div
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {categories.filter(cat => !cat.onlyCollab || showOriginales).map(cat => {
          const active = selected === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => onSelect(cat.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold tracking-wide transition-all whitespace-nowrap flex-shrink-0 border ${
                active
                  ? cat.value === 'all' ? 'gradient-bg text-black border-transparent shadow-md shadow-yellow-400/15' : `${cat.activeBg}`
                  : 'bg-transparent text-zinc-500 border-white/[0.06] hover:text-zinc-300 hover:border-white/[0.12] hover:bg-white/[0.03]'
              }`}
              aria-pressed={active}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? (cat.value === 'all' ? 'bg-black' : cat.dot) : cat.dot} ${active ? 'opacity-100' : 'opacity-40'}`} />
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
