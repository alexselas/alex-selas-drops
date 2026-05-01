interface FooterProps {
  onAdmin?: () => void;
}

export default function Footer({ onAdmin }: FooterProps) {
  return (
    <footer className="border-t border-white/[0.06] bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Brand */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black uppercase tracking-wider text-white">MUSIC</span>
              <span className="text-sm font-black uppercase tracking-wider text-yellow-400">DROP</span>
              <span className="text-[9px] font-semibold text-zinc-600 tracking-wide ml-1.5">by 360DJAcademy</span>
            </div>
            <p className="text-[11px] text-zinc-600 max-w-[260px] text-center md:text-left leading-relaxed">
              Drops exclusivos para DJs profesionales. Remixes, mashups y más en MP3 320kbps.
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-sm text-zinc-500" aria-label="Footer links">
            <a href="https://www.instagram.com/alexselas" target="_blank" rel="noopener noreferrer" className="hover:text-yellow-400 transition-colors">Instagram</a>
            <span className="w-1 h-1 rounded-full bg-zinc-800 hidden sm:block" aria-hidden="true" />
            <a href="mailto:soporte@club360.es" className="hover:text-yellow-400 transition-colors">Contacto</a>
            <span className="w-1 h-1 rounded-full bg-zinc-800 hidden sm:block" aria-hidden="true" />
            <a href="/privacidad.html" className="hover:text-zinc-300 transition-colors">Privacidad</a>
            {onAdmin && <>
              <span className="w-1 h-1 rounded-full bg-zinc-800 hidden sm:block" aria-hidden="true" />
              <span onClick={onAdmin} className="cursor-pointer hover:text-zinc-300 transition-colors">Admin</span>
            </>}
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-white/[0.04] text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} MusicDrop by 360DJAcademy. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
