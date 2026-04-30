import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Building,
  GraduationCap,
  ArrowLeftRight,
  Lightbulb,
  Download,
  TrendingUp,
  AlertCircle,
  Users,
  ChevronRight,
  MapPin
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Line,
  Cell
} from 'recharts';
import { getEvaluationReportMetrics } from '../lib/data';

function average(values = []) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function uniqueValues(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function scoreColor(score) {
  if (score >= 4.5) return 'text-emerald-600 bg-emerald-50';
  if (score >= 4) return 'text-indigo-600 bg-indigo-50';
  return 'text-amber-600 bg-amber-50';
}

function ProgressBar({ value }) {
  return (
    <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
      <div className="h-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, (value / 5) * 100))}%` }} />
    </div>
  );
}

export default function Reportes() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({
    campus: 'Todos',
    convenio: 'Todos',
    program: 'Todos',
    actor: 'Todos'
  });

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      setLoading(true);
      setError('');
      try {
        const metrics = await getEvaluationReportMetrics({});
        if (!cancelled) setRows(metrics?.rows || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'No se pudo cargar el modulo de reportes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMetrics();
    return () => {
      cancelled = true;
    };
  }, []);

  const campuses = useMemo(() => uniqueValues(rows.map((item) => item.campus)).sort(), [rows]);
  const convenios = useMemo(() => uniqueValues(rows.map((item) => item.center)).sort(), [rows]);
  const programs = useMemo(() => uniqueValues(rows.map((item) => item.program)).sort(), [rows]);
  const actors = useMemo(() => uniqueValues(rows.map((item) => item.role)).sort(), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      if (filters.campus !== 'Todos' && item.campus !== filters.campus) return false;
      if (filters.convenio !== 'Todos' && item.center !== filters.convenio) return false;
      if (filters.program !== 'Todos' && item.program !== filters.program) return false;
      if (filters.actor !== 'Todos' && item.role !== filters.actor) return false;
      return true;
    });
  }, [rows, filters]);

  const globalScore = useMemo(() => {
    const values = filteredRows
      .map((item) => item.scoreSummary?.globalScore)
      .filter((score) => typeof score === 'number');
    return average(values);
  }, [filteredRows]);

  const centerComparisonData = useMemo(() => {
    const map = {};
    filteredRows.forEach((item) => {
      const key = item.center || 'Sin convenio';
      const score = item.scoreSummary?.globalScore;
      if (!map[key]) {
        map[key] = { name: key, campus: item.campus || '-', total: 0, count: 0, scored: 0 };
      }
      map[key].count += 1;
      if (typeof score === 'number') {
        map[key].total += score;
        map[key].scored += 1;
      }
    });

    return Object.values(map)
      .map((entry) => ({
        ...entry,
        score: entry.scored ? Number((entry.total / entry.scored).toFixed(2)) : 0
      }))
      .sort((a, b) => b.score - a.score);
  }, [filteredRows]);

  const programComparisonData = useMemo(() => {
    const map = {};
    filteredRows.forEach((item) => {
      const key = item.program || 'Sin programa';
      const score = item.scoreSummary?.globalScore;
      if (!map[key]) {
        map[key] = { name: key, total: 0, scored: 0, centers: new Set() };
      }
      map[key].centers.add(item.center || 'Sin convenio');
      if (typeof score === 'number') {
        map[key].total += score;
        map[key].scored += 1;
      }
    });

    return Object.values(map)
      .map((entry) => ({
        name: entry.name,
        score: entry.scored ? Number((entry.total / entry.scored).toFixed(2)) : 0,
        convenios: entry.centers.size
      }))
      .sort((a, b) => b.score - a.score);
  }, [filteredRows]);

  const sectionLabels = useMemo(() => {
    const map = {};
    filteredRows.forEach((item) => {
      (item.scoreSummary?.sectionScores || []).forEach((section) => {
        if (typeof section.score !== 'number') return;
        map[section.title] = (map[section.title] || 0) + 1;
      });
    });

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([title]) => title);
  }, [filteredRows]);

  const actorTriangulation = useMemo(() => {
    const categories = sectionLabels;
    return categories.map((category) => {
      const item = { category };
      actors.forEach((actor) => {
        const values = filteredRows
          .filter((row) => row.role === actor)
          .map((row) => row.scoreSummary?.sectionScores?.find((section) => section.title === category)?.score)
          .filter((value) => typeof value === 'number');
        item[actor] = average(values) || 0;
      });
      return item;
    });
  }, [actors, filteredRows, sectionLabels]);

  const topProgram = programComparisonData[0] || null;
  const alertCenters = centerComparisonData.filter((item) => item.score > 0 && item.score < 3.5);

  const radarData = useMemo(() => {
    if (!topProgram) return [];
    return sectionLabels.slice(0, 8).map((label) => {
      const programValues = filteredRows
        .filter((row) => row.program === topProgram.name)
        .map((row) => row.scoreSummary?.sectionScores?.find((section) => section.title === label)?.score)
        .filter((value) => typeof value === 'number');

      const globalValues = filteredRows
        .map((row) => row.scoreSummary?.sectionScores?.find((section) => section.title === label)?.score)
        .filter((value) => typeof value === 'number');

      return {
        subject: label,
        Programa: average(programValues) || 0,
        Global: average(globalValues) || 0
      };
    });
  }, [filteredRows, sectionLabels, topProgram]);

  const insights = useMemo(() => {
    const bestCenter = centerComparisonData[0];
    const weakestCenter = centerComparisonData.find((item) => item.score > 0 && item.score < 3.5);

    const actorGap = actorTriangulation
      .map((category) => {
        const values = actors.map((actor) => category[actor] || 0);
        return {
          category: category.category,
          gap: Number((Math.max(...values) - Math.min(...values)).toFixed(2))
        };
      })
      .sort((a, b) => b.gap - a.gap)[0];

    return {
      bestCenter,
      weakestCenter,
      actorGap
    };
  }, [actorTriangulation, actors, centerComparisonData]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-slate-500">
        Cargando modulo de informes...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <p className="font-semibold">Error cargando reportes</p>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900 font-sans rounded-3xl overflow-hidden">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-100">
                <TrendingUp className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-800 tracking-tight">Analitica Docencia-Servicio</h1>
                <div className="flex items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span className="text-indigo-600">Komet</span>
                  <ChevronRight className="w-3 h-3 mx-1" />
                  <span>Modulo de Informes Integrado</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-slate-100 rounded-xl px-3 py-2 border border-slate-200">
                <MapPin className="w-4 h-4 text-slate-400 mr-2" />
                <select
                  className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer"
                  value={filters.campus}
                  onChange={(event) => setFilters((prev) => ({ ...prev, campus: event.target.value }))}
                >
                  <option value="Todos">Todos los Campus</option>
                  {campuses.map((campus) => (
                    <option key={campus} value={campus}>{campus}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center bg-slate-100 rounded-xl px-3 py-2 border border-slate-200">
                <Building className="w-4 h-4 text-slate-400 mr-2" />
                <select
                  className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer"
                  value={filters.convenio}
                  onChange={(event) => setFilters((prev) => ({ ...prev, convenio: event.target.value }))}
                >
                  <option value="Todos">Todos los Convenios</option>
                  {convenios.map((convenio) => (
                    <option key={convenio} value={convenio}>{convenio}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center bg-slate-100 rounded-xl px-3 py-2 border border-slate-200">
                <GraduationCap className="w-4 h-4 text-slate-400 mr-2" />
                <select
                  className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer"
                  value={filters.program}
                  onChange={(event) => setFilters((prev) => ({ ...prev, program: event.target.value }))}
                >
                  <option value="Todos">Todos los Programas</option>
                  {programs.map((program) => (
                    <option key={program} value={program}>{program}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center bg-slate-100 rounded-xl px-3 py-2 border border-slate-200">
                <Users className="w-4 h-4 text-slate-400 mr-2" />
                <select
                  className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer"
                  value={filters.actor}
                  onChange={(event) => setFilters((prev) => ({ ...prev, actor: event.target.value }))}
                >
                  <option value="Todos">Todos los Actores</option>
                  {actors.map((actor) => (
                    <option key={actor} value={actor}>{actor}</option>
                  ))}
                </select>
              </div>

              <button className="bg-slate-800 text-white p-2.5 rounded-xl hover:bg-slate-700 transition-all shadow-md" type="button" title="Exportar (pendiente)">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex space-x-8 mt-6 overflow-x-auto no-scrollbar">
            {[
              { id: 'overview', label: 'Dashboard General', icon: LayoutDashboard },
              { id: 'centers', label: 'Comparativa de Convenios', icon: Building },
              { id: 'programs', label: 'Benchmarking de Programas', icon: GraduationCap },
              { id: 'triangulation', label: 'Triangulacion de Actores', icon: ArrowLeftRight },
              { id: 'insights', label: 'Recomendaciones IA', icon: Lightbulb }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 pb-3 px-1 border-b-2 transition-all font-bold text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto p-6">
        {activeTab === 'overview' ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Puntaje Global</p>
                <h3 className="text-3xl font-black mt-2">{globalScore ?? '-'}</h3>
                <p className="text-xs text-slate-400 mt-2 font-medium">Promedio de evaluaciones filtradas</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total Evaluaciones</p>
                <h3 className="text-3xl font-black mt-2">{filteredRows.length}</h3>
                <p className="text-xs text-slate-400 mt-2 font-medium">Registros del filtro actual</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-amber-500">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Alertas Activas</p>
                <h3 className="text-3xl font-black mt-2">{alertCenters.length}</h3>
                <p className="text-xs text-slate-400 mt-2 font-medium">Convenios por debajo de 3.5</p>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Top Programa</p>
                <h3 className="text-xl font-bold mt-2 truncate">{topProgram?.name || 'Sin datos'}</h3>
                <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, ((topProgram?.score || 0) / 5) * 100))}%` }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Desempeno de los 10 Mejores Convenios</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={centerComparisonData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" hide />
                      <YAxis domain={[0, 5]} hide />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="score" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={38}>
                        {centerComparisonData.slice(0, 10).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.score >= 4.5 ? '#10b981' : '#4f46e5'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Triangulacion: Categorias por Actor</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={actorTriangulation} layout="vertical" margin={{ top: 20, right: 16, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" domain={[0, 5]} tick={{ fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="category" type="category" width={220} tick={{ fill: '#1f2937', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)' }} />
                      <Legend verticalAlign="top" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingBottom: '12px' }} />
                      {actors.map((actor, index) => (
                        <Bar
                          key={actor}
                          dataKey={actor}
                          fill={['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#a855f7'][index % 5]}
                          radius={[0, 8, 8, 0]}
                          barSize={18}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'centers' ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom duration-500">
            <div className="p-8 border-b border-slate-50">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Comparativa de Centros de Practica</h2>
              <p className="text-sm font-medium text-slate-500">Analisis detallado por convenio y cumplimiento de calidad</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-8 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Escenario / Convenio</th>
                    <th className="px-8 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Campus</th>
                    <th className="px-8 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Evals</th>
                    <th className="px-8 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Progreso Calidad</th>
                    <th className="px-8 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Puntaje Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {centerComparisonData.map((item) => (
                    <tr key={item.name} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Convenio Docencia-Servicio</p>
                      </td>
                      <td className="px-8 py-5 text-center text-xs font-bold text-slate-600">{item.campus}</td>
                      <td className="px-8 py-5 text-center text-xs font-bold text-slate-600">{item.count}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-center space-x-2">
                          <ProgressBar value={item.score} />
                          <span className="text-[10px] font-black text-indigo-600">{(item.score * 20).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <span className={`px-3 py-1 rounded-lg text-sm font-black ${scoreColor(item.score)}`}>
                          {item.score}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === 'programs' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in zoom-in duration-500">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-black text-slate-900 mb-8">Puntaje por Programa Academico</h3>
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={programComparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 5]} />
                    <YAxis dataKey="name" type="category" width={180} fontSize={11} tick={{ fill: '#475569', fontWeight: 'bold' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="score" name="Puntaje" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={22} />
                    <Line dataKey="convenios" name="Convenios vinculados" stroke="#10b981" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 text-center">Perfil de Competencias</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" fontSize={9} tick={{ fill: '#64748b', fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 5]} />
                      <Radar name={topProgram?.name || 'Programa'} dataKey="Programa" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
                      <Radar name="Promedio General" dataKey="Global" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-indigo-600 p-8 rounded-3xl shadow-xl text-white">
                <h4 className="font-bold text-lg mb-4 flex items-center">
                  <Lightbulb className="w-5 h-5 mr-2 text-indigo-300" /> Insight del Programa
                </h4>
                <p className="text-sm opacity-90 leading-relaxed mb-6">
                  {topProgram
                    ? `${topProgram.name} lidera con ${topProgram.score}. Tiene relacion activa con ${topProgram.convenios} convenios en el filtro actual.`
                    : 'No hay datos suficientes para generar insight de programas.'}
                </p>
                <button className="w-full py-3 bg-white text-indigo-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all" type="button">
                  Ver Plan de Replicacion
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'triangulation' ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Triangulacion de Opinion</h2>
                <p className="text-slate-500 font-medium mt-2">Medicion de brechas de percepcion entre los estamentos evaluadores.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                {actorTriangulation.map((category) => (
                  <div key={category.category} className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">{category.category}</h4>
                    <div className="space-y-6">
                      {actors.map((actor, index) => {
                        const value = category[actor] || 0;
                        return (
                          <div key={`${category.category}-${actor}`}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-slate-600">{actor}</span>
                              <span className="text-xs font-black text-indigo-600">{value}</span>
                            </div>
                            <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-slate-100">
                              <div
                                className={['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-cyan-500'][index % 4]}
                                style={{ width: `${Math.max(0, Math.min(100, (value / 5) * 100))}%`, height: '100%' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-8 pt-4 border-t border-slate-200">
                      <div className="flex items-center space-x-2 text-amber-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase">Brecha de Percepcion Detectada</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'insights' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in zoom-in duration-500">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-indigo-500">
              <div className="bg-indigo-50 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-lg mb-2">Estrategia de Convenios</h4>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                {insights.bestCenter
                  ? `${insights.bestCenter.name} lidera el desempeno con ${insights.bestCenter.score}. Puede funcionar como referencia para planes de mejora.`
                  : 'Sin datos suficientes para estrategia por convenios.'}
              </p>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-indigo-600 cursor-pointer">
                <span>Accion Recomendada</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-emerald-500">
              <div className="bg-emerald-50 w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-lg mb-2">Refuerzo por Actores</h4>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                {insights.actorGap
                  ? `La categoria con mayor brecha es ${insights.actorGap.category} (brecha ${insights.actorGap.gap}). Priorizar alineacion entre actores.`
                  : 'No hay suficientes datos para calcular brechas por actor.'}
              </p>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-emerald-600 cursor-pointer">
                <span>Plan de Capacitacion</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden group">
              <div className="relative z-10">
                <h4 className="font-bold text-lg mb-4 flex items-center">
                  <Lightbulb className="w-5 h-5 mr-2 text-indigo-400" /> Recomendaciones del Modelo
                </h4>
                <div className="space-y-4">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs">
                    <span className="text-indigo-400 font-bold">PROYECCION:</span> Seccion de recomendaciones IA pendiente de construccion.
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs">
                    <span className="text-amber-400 font-bold">ALERTA:</span> {insights.weakestCenter ? `${insights.weakestCenter.name} requiere plan de mejora por puntaje ${insights.weakestCenter.score}.` : 'No se detectaron convenios criticos en el filtro actual.'}
                  </div>
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
            </div>
          </div>
        ) : null}
      </main>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
