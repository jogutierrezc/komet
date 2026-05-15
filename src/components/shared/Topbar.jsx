import { Search, Bell, Mail, Menu } from 'lucide-react';

export default function Topbar({ activeTab, toggleMobileMenu }) {
  const getPageTitle = () => {
    const titles = {
      'dashboard': 'Panel de Gestión',
      'convenios': 'Convenios',
      'evaluaciones': 'Evaluaciones',
      'reportes': 'Reportes',
      'presenta': 'Komet Presenta',
      'sistema': 'Sistema'
    };
    return titles[activeTab] || activeTab;
  };

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center space-x-4">
        <button onClick={toggleMobileMenu} className="lg:hidden text-gray-600"><Menu size={24} /></button>
        <h2 className="text-base lg:text-lg font-bold text-gray-700 capitalize flex items-center space-x-2">
          <span className="text-blue-600 hidden sm:inline font-black tracking-tight">KOMET</span>
          <span className="hidden sm:inline text-gray-300">/</span>
          <span className="truncate max-w-[150px]">{getPageTitle()}</span>
        </h2>
      </div>

      <div className="flex items-center space-x-3 lg:space-x-6">
        <div className="relative group hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Buscar en Komet..." 
            className="pl-10 pr-4 py-2 bg-gray-50 border border-transparent rounded-full text-sm focus:bg-white focus:border-blue-200 transition-all outline-none w-48 xl:w-64"
          />
        </div>
        
        <div className="flex items-center space-x-2 border-r pr-3 lg:pr-6 border-gray-100">
          <button className="text-gray-400 hover:text-blue-600 relative p-1"><Bell size={18} /><span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span></button>
          <button className="text-gray-400 hover:text-blue-600 p-1 hidden sm:block"><Mail size={18} /></button>
        </div>

        <div className="flex items-center space-x-2 cursor-pointer group">
          <div className="text-right hidden lg:block">
            <p className="text-[11px] font-bold text-gray-800 leading-none">Admin Komet</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-tighter mt-1">Sede Bucaramanga</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
            KO
          </div>
        </div>
      </div>
    </header>
  );
}
