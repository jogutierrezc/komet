import React, { useState } from 'react';
import Sidebar from './components/shared/Sidebar';
import Topbar from './components/shared/Topbar';
import Dashboard from './components/Dashboard';
import Convenios from './components/Convenios';
import Estudiantes from './components/Estudiantes';
import Profesores from './components/Profesores';
import Evaluaciones from './components/Evaluaciones';
import Reportes from './components/Reportes';
import Estadistica from './components/Estadistica';
import KometPresenta from './components/KometPresenta';
import Sistema from './components/Sistema';

export default function App({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      case 'convenios':
        return <Convenios />;
      case 'estudiantes':
        return <Estudiantes />;
      case 'profesores':
        return <Profesores />;
      case 'evaluaciones':
        return <Evaluaciones />;
      case 'reportes':
        return <Reportes />;
      case 'estadistica':
        return <Estadistica onNavigate={setActiveTab} />;
      case 'presenta':
        return <KometPresenta onNavigate={setActiveTab} />;
      case 'sistema':
        return <Sistema />;
      default:
        return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-paper flex font-sans text-ink relative overflow-x-hidden">

      {/* SIDEBAR */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        toggleMobileMenu={toggleMobileMenu}
        onLogout={onLogout}
      />

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
        isCollapsed ? 'lg:ml-20' : 'lg:ml-[248px]'
      }`}>
        
        {/* TOPBAR */}
        <Topbar activeTab={activeTab} />

        {/* PAGE CONTENT */}
        <section className="p-4 pb-24 lg:p-10 lg:pb-10">
          <div key={activeTab} className="max-w-7xl mx-auto k-enter">
            {renderContent()}
          </div>
        </section>
      </main>
    </div>
  );
}
