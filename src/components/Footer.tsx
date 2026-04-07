import { Instagram, Youtube, Headphones } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800/50 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Alex Selas" className="h-8 w-auto" />
            <span className="text-[10px] font-extrabold gradient-bg text-black px-2 py-0.5 rounded-lg tracking-wide">DROPS</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <span>Sesiones</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>Remixes</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>Mashups</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>Librerías</span>
          </div>

          {/* Socials */}
          <div className="flex items-center gap-3">
            {[Instagram, Youtube, Headphones].map((Icon, i) => (
              <button
                key={i}
                className="p-2.5 rounded-xl text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
              >
                <Icon className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-800/50 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} Alex Selas. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
