export type Category = 'extended' | 'mashups' | 'livemashups' | 'hypeintros' | 'transiciones' | 'remixes' | 'sesiones' | 'originales';

export interface Track {
  id: string;
  title: string;
  artist: string;
  authors: string; // Artistas originales (ej: "Drake, Bad Bunny")
  category: Category;
  price: number;
  credits?: number; // Coste en creditos (auto-calculado desde categoria)
  bpm: number;
  key?: string;
  camelot?: string;
  genre: string;
  duration: number; // seconds
  releaseDate: string; // ISO date
  description: string;
  coverUrl: string;
  previewUrl: string;
  fileUrl: string; // full quality — protected in production
  featured: boolean;
  tags: string[];
  collaborator?: boolean;
  collaboratorId?: string;
  analysis?: {
    intensity?: number;
    loudness_lufs?: number;
    energy_curve?: number[];
    genre_detected?: string;
    analyzed_at?: string;
  };
}

// Creditos por categoria
export const CREDIT_COSTS: Record<Category, number> = {
  extended: 1,
  mashups: 2,
  livemashups: 2,
  hypeintros: 2,
  transiciones: 2,
  remixes: 3,
  sesiones: 5,
  originales: 0,
};

export const CATEGORY_LABELS: Record<Category, string> = {
  extended: 'Extended',
  mashups: 'Mashup',
  livemashups: 'Live Mashup',
  hypeintros: 'Hype Intro',
  transiciones: 'Transición',
  remixes: 'Remix',
  sesiones: 'Sesión',
  originales: 'Original',
};

export const CATEGORY_COLORS: Record<Category, string> = {
  extended: 'bg-amber-500 text-black',
  mashups: 'bg-yellow-500 text-black',
  livemashups: 'bg-fuchsia-600 text-white',
  hypeintros: 'bg-pink-600 text-white',
  transiciones: 'bg-cyan-600 text-white',
  remixes: 'bg-violet-600 text-white',
  sesiones: 'bg-emerald-600 text-white',
  originales: 'bg-orange-500 text-white',
};

// Paquetes de drops
export const CREDIT_PACKS = [
  { id: 'pack-5', credits: 5, price: 3.99, label: '5 drops' },
  { id: 'pack-10', credits: 10, price: 6.99, label: '10 drops', popular: true },
  { id: 'pack-20', credits: 20, price: 11.99, label: '20 drops' },
];

export interface CollaboratorProfile {
  bio: string;
  photoUrl: string;
  bannerUrl: string;
  artistName: string;
  socialLinks: {
    instagram?: string;
    tiktok?: string;
    spotify?: string;
    youtube?: string;
    soundcloud?: string;
  };
  colorPrimary: string;
  colorSecondary: string;
}

export interface Collaborator {
  id: string;
  name: string;
  photoUrl: string;
  profile?: CollaboratorProfile;
}

export interface CartItem {
  track: Track;
  quantity: number;
}

export type SortOption = 'newest' | 'oldest' | 'credits-asc' | 'credits-desc' | 'title';

export type Section = 'colabs' | 'colab-admin' | 'colab-page' | 'admin' | 'club360';
