export type Category = 'sesiones' | 'remixes' | 'mashups' | 'livemashups' | 'hypeintros' | 'transiciones' | 'originales' | 'packs' | 'librerias';

export interface Track {
  id: string;
  title: string;
  artist: string;
  authors: string; // Artistas originales (ej: "Drake, Bad Bunny")
  category: Category;
  price: number;
  bpm: number;
  key?: string;
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
  packId?: string;
  packName?: string;
}

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

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  date: string;
  status: 'pending' | 'completed' | 'failed';
  paymentMethod: 'stripe' | 'paypal';
}

export type SortOption = 'newest' | 'oldest' | 'price-asc' | 'price-desc' | 'title';

export type Section = 'home' | 'catalog' | 'colabs' | 'colab-admin' | 'colab-page' | 'admin' | 'club360';
