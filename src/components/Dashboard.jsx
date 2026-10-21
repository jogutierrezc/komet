import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ArrowRight, ClipboardCheck, LineChart, BarChart3, Presentation } from 'lucide-react';
import StatusBadge from './shared/StatusBadge';
import { getRecentEvaluations, getActiveConveniosCount, getStudentsInPracticeCount, getEvaluationsCount } from '../lib/data';

const SHORTCUTS = [
  { id: 'evaluaciones', label: 'Formularios de evaluación', hint: 'Crear y compartir enlaces públicos', icon: ClipboardCheck },
  { id: 'estadistica', label: 'Estadística', hint: 'Puntajes por programa, centro y rol', icon: LineChart },
  { id: 'reportes', label: 'Informe', hint: 'Documento listo para imprimir', icon: BarChart3 },
  { id: 'presenta', label: 'Komet Presenta', hint: 'Presentación en PowerPoint', icon: Presentation },
];

const fmt = (n) => Number(n || 0).toLocaleString('es-CO');

export default function Dashboard({ onNavigate }) {
  const [recentEvals, setRecentEvals] = useState([]);
  const [stats, setStats] = useState({ conveniosActive: 0, studentsInPractice: 0, totalEvaluations: 0 });
  const [loading, setLoading] = useState(false);
  const figuresRef = useRef(null);
  const counted = useRef(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getRecentEvaluations(),
        getActiveConveniosCount(),
        getStudentsInPracticeCount(),
        getEvaluationsCount()
      ]);

      const [evaluationsResult, conveniosResult, studentsResult, totalResult] = results;

      if (evaluationsResult.status === 'fulfilled') {
        setRecentEvals(evaluationsResult.value);
      } else {
        console.warn('Error cargando evaluaciones recientes:', evaluationsResult.reason);
        setRecentEvals([]);
      }

      setStats({
        conveniosActive: conveniosResult.status === 'fulfilled' ? conveniosResult.value : 0,
        studentsInPractice: studentsResult.status === 'fulfilled' ? studentsResult.value : 0,
        totalEvaluations: totalResult.status === 'fulfilled' ? totalResult.value : 0
      });
    } catch (error) {
      console.error('Error cargando métricas del dashboard:', error);
      setRecentEvals([]);
      setStats({ conveniosActive: 0, studentsInPractice: 0, totalEvaluations: 0 });
    } finally {
      setLoading(false);
    }
  }

  // Las cifras cuentan hasta su valor solo en la primera carga.
  useLayoutEffect(() => {
    if (loading || counted.current || !figuresRef.current) return;
    if (!stats.totalEvaluations && !stats.conveniosActive && !stats.studentsInPractice) return;
    counted.current = true;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      figuresRef.current.querySelectorAll('[data-count]').forEach((el) => {
        const end = Number(el.dataset.count) || 0;
        const state = { v: 0 };
        gsap.to(state, {
          v: end,
          duration: 0.7,
          ease: 'power3.out',
          onUpdate: () => { el.textContent = fmt(Math.round(state.v)); },
          onComplete: () => { el.textContent = fmt(end); },
        });
      });
    });
    return () => mm.revert();
  }, [loading, stats]);

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <p className="k-label">Hoy</p>
        <h1 className="font-display text-4xl font-bold leading-tight">Panel</h1>
        <p className="text-[15px] text-ink-2">Cómo van las evaluaciones de sitios de práctica.</p>
      </header>

      <section ref={figuresRef} aria-label="Resumen" className="k-card flex flex-col md:flex-row">
        <div className="flex-[2] p-6 md:p-8 space-y-2">
          <p className="k-label">Evaluaciones registradas</p>
          <p className="font-display text-6xl md:text-7xl font-bold tracking-tight leading-none" data-count={stats.totalEvaluations}>{loading ? '–' : fmt(stats.totalEvaluations)}</p>
        </div>
        <div className="flex-1 flex flex-row md:flex-col border-t md:border-t-0 md:border-l border-line">
          <div className="flex-1 p-5 flex items-baseline justify-between gap-3">
            <span className="k-label">Sitios activos</span>
            <span className="font-display text-3xl font-bold" data-count={stats.conveniosActive}>{loading ? '–' : fmt(stats.conveniosActive)}</span>
          </div>
          <div className="flex-1 p-5 flex items-baseline justify-between gap-3 border-l md:border-l-0 md:border-t border-line">
            <span className="k-label">En práctica</span>
            <span className="font-display text-3xl font-bold" data-count={stats.studentsInPractice}>{loading ? '–' : fmt(stats.studentsInPractice)}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-8 k-card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Evaluaciones recientes</h2>
            <button type="button" onClick={() => onNavigate?.('reportes')} className="text-sm font-semibold text-blue-600 hover:text-blue-700">Ver informe</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[480px]">
              <thead>
                <tr className="bg-paper/60">
                  <th className="k-label px-5 py-2.5">Evaluado</th>
                  <th className="k-label px-5 py-2.5 hidden md:table-cell">Sitio</th>
                  <th className="k-label px-5 py-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading ? (
                  <tr><td colSpan="3" className="px-5 py-8 text-center text-ink-2">Cargando evaluaciones…</td></tr>
                ) : recentEvals.length ? (
                  recentEvals.map((item) => (
                    <tr key={item.id} className="border-t border-line hover:bg-paper/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-ink-2">{item.program}</p>
                      </td>
                      <td className="px-5 py-3.5 text-ink-2 hidden md:table-cell">{item.center}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={item.status} /></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="3" className="px-5 py-8 text-center text-ink-2">Todavía no hay evaluaciones recientes.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-4 k-card p-5 space-y-1">
          <h2 className="font-display text-xl font-bold mb-2">Ir a</h2>
          {SHORTCUTS.map(({ id, label, hint, icon: Icon }) => (
            <button key={id} type="button" onClick={() => onNavigate?.(id)} className="group w-full min-h-[56px] flex items-center gap-3 px-2 -mx-2 rounded-lg text-left hover:bg-paper transition-colors">
              <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Icon size={18} strokeWidth={1.8} /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-ink-2 truncate">{hint}</span>
              </span>
              <ArrowRight size={16} className="text-ink-2 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
