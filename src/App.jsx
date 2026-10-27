import React, { Suspense, useEffect, useState } from 'react';
import Sidebar from './components/shared/Sidebar';
import Topbar from './components/shared/Topbar';
import { views, preload, preloadWhenIdle } from './moduleRegistry';

export default function App({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // Con el primer módulo ya visible, el resto se descarga en segundo plano.
  useEffect(() => { preloadWhenIdle([activeTab]); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const renderContent = () => {
    const View = views[activeTab] || views.dashboard;
    return (
      <Suspense fallback={<PageSkeleton />}>
        <View onNavigate={setActiveTab} />
      </Suspense>
    );
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
        onPreload={preload}
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

// Marcador mientras llega el código del módulo (normalmente menos de un segundo).
function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Cargando">
      <div className="h-4 w-32 rounded bg-line" />
      <div className="h-10 w-72 rounded bg-line" />
      <div className="h-40 rounded-xl bg-white border border-line" />
      <div className="h-64 rounded-xl bg-white border border-line" />
    </div>
  );
}
