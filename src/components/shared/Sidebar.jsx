import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ChevronLeft, ChevronRight, X, LogOut, MoreHorizontal } from 'lucide-react';
import SidebarItem from './SidebarItem';
import KometMark from './KometMark';
import { NAV_GROUPS, SYSTEM_ITEM, MOBILE_TABS } from './navConfig';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Sidebar({ activeTab, setActiveTab, isCollapsed, setIsCollapsed, isMobileMenuOpen, toggleMobileMenu, onLogout, onPreload }) {
  const navRef = useRef(null);
  const highlightRef = useRef(null);
  const placedOnce = useRef(false);

  // El fondo del ítem activo se desliza al siguiente en lugar de aparecer y desaparecer.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const hl = highlightRef.current;
    if (!nav || !hl) return;
    const target = nav.querySelector(`[data-nav-id="${activeTab}"]`);
    if (!target) {
      gsap.to(hl, { opacity: 0, duration: 0.15, overwrite: true });
      return;
    }
    const props = { y: target.offsetTop, height: target.offsetHeight, opacity: 1 };
    if (!placedOnce.current || prefersReducedMotion()) {
      gsap.set(hl, props);
      placedOnce.current = true;
    } else {
      gsap.to(hl, { ...props, duration: 0.22, ease: 'power3.out', overwrite: true });
    }
  }, [activeTab, isCollapsed]);

  const select = (id) => () => setActiveTab(id);
  const selectMobile = (id) => () => { setActiveTab(id); if (isMobileMenuOpen) toggleMobileMenu(); };
  const moreActive = !MOBILE_TABS.some((t) => t.id === activeTab);

  return (
    <>
      {/* Menú de escritorio */}
      <aside
        className={`bg-night text-white fixed inset-y-0 left-0 z-40 hidden lg:flex flex-col transition-[width] duration-300 ease-out ${
          isCollapsed ? 'w-20' : 'w-[248px]'
        }`}
      >
        <div className={`h-16 flex items-center shrink-0 ${isCollapsed ? 'justify-center' : 'gap-2.5 px-7'}`}>
          <KometMark size={26} />
          {!isCollapsed && <span className="font-display text-[22px] font-bold tracking-tight">Komet</span>}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
          <nav ref={navRef} aria-label="Principal" className="relative space-y-5">
            <div ref={highlightRef} aria-hidden="true" className="absolute left-0 right-0 top-0 rounded-lg bg-night-3 opacity-0" />
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="space-y-1">
                {!isCollapsed && <p className="px-3 mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[#7F9BAA]">{group.label}</p>}
                {group.items.map((item) => (
                  <SidebarItem key={item.id} itemId={item.id} collapsed={isCollapsed} icon={item.icon} label={item.label} active={activeTab === item.id} onClick={select(item.id)} onPreload={() => onPreload?.(item.id)} />
                ))}
              </div>
            ))}
          </nav>
        </div>

        <button
          type="button"
          aria-label={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 bg-night-3 text-white rounded-full p-1 border-2 border-paper z-50 hover:bg-blue-600 transition-colors"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="shrink-0 px-4 pb-4 space-y-2">
          <div className="relative">
            <SidebarItem itemId={SYSTEM_ITEM.id} collapsed={isCollapsed} icon={SYSTEM_ITEM.icon} label={SYSTEM_ITEM.label} active={activeTab === SYSTEM_ITEM.id} onClick={select(SYSTEM_ITEM.id)} onPreload={() => onPreload?.(SYSTEM_ITEM.id)} solid />
          </div>
          <button type="button" onClick={onLogout} title={isCollapsed ? 'Salir' : undefined} className={`w-full h-10 flex items-center rounded-lg text-sm text-[#B9CAD2] hover:text-white hover:bg-night-2 transition-colors ${isCollapsed ? 'justify-center' : 'gap-3 px-3'}`}>
            <LogOut size={18} strokeWidth={1.8} />
            {!isCollapsed && <span>Salir</span>}
          </button>
        </div>
      </aside>

      {/* Barra inferior (móvil) */}
      <nav aria-label="Principal" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line flex pb-[env(safe-area-inset-bottom)]">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const on = activeTab === tab.id;
          return (
            <button key={tab.id} type="button" onClick={selectMobile(tab.id)} aria-current={on ? 'page' : undefined} className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${on ? 'text-blue-600' : 'text-ink-2'}`}>
              <Icon size={22} strokeWidth={1.8} />
              {tab.label}
            </button>
          );
        })}
        <button type="button" onClick={toggleMobileMenu} className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${moreActive ? 'text-blue-600' : 'text-ink-2'}`}>
          <MoreHorizontal size={22} strokeWidth={1.8} />
          Más
        </button>
      </nav>

      {/* Hoja "Más" (móvil) */}
      <div
        className={`lg:hidden fixed inset-0 z-50 bg-night/60 transition-opacity duration-200 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleMobileMenu}
      >
        <aside
          role="dialog"
          aria-label="Menú"
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-0 inset-x-0 bg-night rounded-t-2xl max-h-[85vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-y-0' : 'translate-y-full'}`}
        >
          <div className="flex items-center justify-between px-6 h-16 sticky top-0 bg-night">
            <div className="flex items-center gap-2.5"><KometMark size={24} /><span className="font-display text-xl font-bold text-white">Komet</span></div>
            <button type="button" aria-label="Cerrar menú" onClick={toggleMobileMenu} className="w-11 h-11 flex items-center justify-center text-[#B9CAD2]"><X size={22} /></button>
          </div>
          <div className="px-4 pb-6 space-y-5">
            {[...NAV_GROUPS, { label: 'Administración', items: [SYSTEM_ITEM] }].map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="px-3 mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[#7F9BAA]">{group.label}</p>
                {group.items.map((item) => (
                  <SidebarItem key={item.id} icon={item.icon} label={item.label} active={activeTab === item.id} onClick={selectMobile(item.id)} solid />
                ))}
              </div>
            ))}
            <button type="button" onClick={onLogout} className="w-full h-11 flex items-center gap-3 px-3 rounded-lg text-sm text-[#B9CAD2] hover:text-white hover:bg-night-2"><LogOut size={18} strokeWidth={1.8} />Salir</button>
          </div>
        </aside>
      </div>
    </>
  );
}
