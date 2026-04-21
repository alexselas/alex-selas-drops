interface FooterProps {
  onAdmin?: () => void;
}

export default function Footer({ onAdmin }: FooterProps) {
  return (
    <footer className="border-t border-zinc-800/50 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black uppercase tracking-wider text-white">MUSIC</span>
            <span className="text-sm font-black uppercase tracking-wider text-yellow-400">DROP</span>
            <span className="text-[9px] font-semibold text-zinc-600 tracking-wide ml-1">by 360DJAcademy</span>
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
            {onAdmin && <>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span onClick={onAdmin} className="cursor-pointer">Admin</span>
            </>}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-800/50 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} Alex Selas. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
