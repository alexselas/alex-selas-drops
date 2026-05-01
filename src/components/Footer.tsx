interface FooterProps {
  onAdmin?: () => void;
}

export default function Footer({ onAdmin }: FooterProps) {
  return (
    <footer className="border-t border-white/[0.06] bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Brand */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black uppercase tracking-wider text-white">MUSIC</span>
            <span className="text-sm font-black uppercase tracking-wider text-yellow-400">DROP</span>
            <span className="text-[9px] font-semibold text-zinc-600 tracking-wide ml-1.5">by 360DJAcademy</span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm text-zinc-500" aria-label="Footer links">
            <span className="hover:text-zinc-300 transition-colors cursor-pointer">Sesiones</span>
            <span className="w-1 h-1 rounded-full bg-zinc-800" aria-hidden="true" />
            <span className="hover:text-zinc-300 transition-colors cursor-pointer">Remixes</span>
            <span className="w-1 h-1 rounded-full bg-zinc-800" aria-hidden="true" />
            <span className="hover:text-zinc-300 transition-colors cursor-pointer">Mashups</span>
            <span className="w-1 h-1 rounded-full bg-zinc-800" aria-hidden="true" />
            <span className="hover:text-zinc-300 transition-colors cursor-pointer">Librerias</span>
            {onAdmin && <>
              <span className="w-1 h-1 rounded-full bg-zinc-800" aria-hidden="true" />
              <span onClick={onAdmin} className="cursor-pointer hover:text-zinc-300 transition-colors">Admin</span>
            </>}
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-white/[0.04] text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} Alex Selas. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
