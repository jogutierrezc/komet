import React, { useState } from 'react';
import Sidebar from './components/shared/Sidebar';
import Topbar from './components/shared/Topbar';
import Dashboard from './components/Dashboard';
import Convenios from './components/Convenios';
import Estudiantes from './components/Estudiantes';
import Profesores from './components/Profesores';
import Evaluaciones from './components/Evaluaciones';
import Reportes from './components/Reportes';
import Sistema from './components/Sistema';

export default function App({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return <Dashboard />;
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
      case 'sistema':
        return <Sistema />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex font-sans text-gray-800 relative overflow-x-hidden">
      
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
        isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      }`}>
        
        {/* TOPBAR */}
        <Topbar 
          activeTab={activeTab}
          toggleMobileMenu={toggleMobileMenu}
        />

        {/* PAGE CONTENT */}
        <section className="p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </section>
      </main>
    </div>
  );
}
