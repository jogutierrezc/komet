import { Search } from 'lucide-react';
import KometMark from './KometMark';
import { PAGE_TITLES } from './navConfig';

export default function Topbar({ activeTab }) {
  const title = PAGE_TITLES[activeTab] || activeTab;

  return (
    <header className="h-16 bg-paper border-b border-line flex items-center justify-between gap-4 px-4 lg:px-10 sticky top-0 z-30">
      <div className="flex items-center gap-2.5 min-w-0">
        <KometMark size={22} className="lg:hidden shrink-0" />
        <h2 className="font-display text-xl lg:text-lg font-bold text-ink truncate">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        <label className="hidden md:flex items-center gap-2 h-10 w-64 xl:w-80 px-3 rounded-lg border border-line-strong bg-white text-sm text-ink-2 focus-within:border-blue-600">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder="Buscar en Komet" aria-label="Buscar en Komet" className="flex-1 min-w-0 bg-transparent outline-none text-ink placeholder:text-ink-2" />
        </label>

        <div className="flex items-center gap-2.5">
          <div className="text-right hidden lg:block leading-tight">
            <p className="text-[13px] font-semibold text-ink">Admin Komet</p>
            <p className="text-xs text-ink-2">Sede Bucaramanga</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-night text-white flex items-center justify-center text-xs font-semibold" aria-hidden="true">AK</div>
        </div>
      </div>
    </header>
  );
}
