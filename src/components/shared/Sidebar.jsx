import { 
  LayoutDashboard,
  School, 
  Users,
  UserCheck,
  ClipboardCheck, 
  BarChart3, 
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Rocket,
  LogOut
} from 'lucide-react';
import SidebarItem from './SidebarItem';

export default function Sidebar({ activeTab, setActiveTab, isCollapsed, setIsCollapsed, isMobileMenuOpen, toggleMobileMenu, onLogout }) {
  return (
    <>
      {/* SIDEBAR (Desktop) */}
      <aside 
        className={`bg-[#1a1c23] text-white flex flex-col fixed h-full z-40 transition-all duration-300 hidden lg:flex ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className={`p-6 flex items-center border-b border-gray-800/50 ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
          <div className="bg-gradient-to-tr from-blue-700 to-blue-400 p-1.5 rounded-lg shrink-0 shadow-lg shadow-blue-900/20">
            <Rocket size={20} className="text-white" />
          </div>
          {!isCollapsed && (
            <span className="font-black text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              KOMET
            </span>
          )}
        </div>

        <div className="p-4 flex-1 space-y-8 mt-4 overflow-y-auto custom-scrollbar">
          <div>
            {!isCollapsed && <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4 ml-4">Navegación</p>}
            <nav className="space-y-1">
              <SidebarItem collapsed={isCollapsed} icon={LayoutDashboard} label="Panel Control" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              <SidebarItem collapsed={isCollapsed} icon={School} label="Convenios" active={activeTab === 'convenios'} onClick={() => setActiveTab('convenios')} />
              <SidebarItem collapsed={isCollapsed} icon={Users} label="Estudiantes" active={activeTab === 'estudiantes'} onClick={() => setActiveTab('estudiantes')} />
              <SidebarItem collapsed={isCollapsed} icon={UserCheck} label="Profesores" active={activeTab === 'profesores'} onClick={() => setActiveTab('profesores')} />
            </nav>
          </div>

          <div>
            {!isCollapsed && <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4 ml-4">Herramientas</p>}
            <nav className="space-y-1">
              <SidebarItem collapsed={isCollapsed} icon={ClipboardCheck} label="Evaluaciones" active={activeTab === 'evaluaciones'} onClick={() => setActiveTab('evaluaciones')} badge="!" />
              <SidebarItem collapsed={isCollapsed} icon={BarChart3} label="Informe" active={activeTab === 'reportes'} onClick={() => setActiveTab('reportes')} />
              <SidebarItem collapsed={isCollapsed} icon={Settings} label="Sistema" active={activeTab === 'sistema'} onClick={() => setActiveTab('sistema')} />
            </nav>
          </div>
        </div>

        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 bg-blue-600 text-white rounded-full p-1 shadow-lg border-2 border-[#1a1c23] z-50 hover:bg-blue-500 transition-colors"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="p-6 border-t border-gray-800/50">
          <button onClick={onLogout} className={`flex items-center text-gray-400 hover:text-red-400 transition-colors w-full group ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
            <LogOut size={18} />
            {!isCollapsed && <span className="text-sm font-medium">Salir</span>}
          </button>
        </div>
      </aside>

      {/* SIDEBAR (Mobile Drawer) */}
      <div className={`fixed inset-0 bg-black/50 z-50 transition-opacity lg:hidden ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={toggleMobileMenu}>
        <aside 
          className={`w-64 bg-[#1a1c23] h-full transition-transform duration-300 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6 flex items-center justify-between border-b border-gray-800/50">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-1.5 rounded-lg"><Rocket size={20} className="text-white" /></div>
              <span className="font-black text-2xl text-white">KOMET</span>
            </div>
            <button onClick={toggleMobileMenu} className="text-gray-400 hover:text-white"><X size={24} /></button>
          </div>
          <div className="p-4 space-y-6 overflow-y-auto">
            <nav className="space-y-1">
              <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => {setActiveTab('dashboard'); toggleMobileMenu();}} />
              <SidebarItem icon={School} label="Convenios" active={activeTab === 'convenios'} onClick={() => {setActiveTab('convenios'); toggleMobileMenu();}} />
              <SidebarItem icon={Users} label="Estudiantes" active={activeTab === 'estudiantes'} onClick={() => {setActiveTab('estudiantes'); toggleMobileMenu();}} />
              <SidebarItem icon={UserCheck} label="Profesores" active={activeTab === 'profesores'} onClick={() => {setActiveTab('profesores'); toggleMobileMenu();}} />
              <SidebarItem icon={ClipboardCheck} label="Evaluaciones" active={activeTab === 'evaluaciones'} onClick={() => {setActiveTab('evaluaciones'); toggleMobileMenu();}} />
              <SidebarItem icon={BarChart3} label="Informe" active={activeTab === 'reportes'} onClick={() => {setActiveTab('reportes'); toggleMobileMenu();}} />
              <SidebarItem icon={Settings} label="Sistema" active={activeTab === 'sistema'} onClick={() => {setActiveTab('sistema'); toggleMobileMenu();}} />
              <button onClick={onLogout} className="w-full text-left text-gray-400 hover:text-red-400 px-4 py-3 text-sm font-medium">Salir</button>
            </nav>
          </div>
        </aside>
      </div>
    </>
  );
}
