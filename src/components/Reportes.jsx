import { useEffect, useMemo, useState } from 'react';
import { Activity, BookOpen, LayoutDashboard, MapPin, PieChart as PieIcon, Sparkles, TrendingUp, Users } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { getEvaluationReportMetrics } from '../lib/data';

const STATUS_COLORS = {
  Completada: '#22c55e',
  Pendiente: '#f59e0b',
  Cancelada: '#ef4444',
  'En espera': '#f97316',
  default: '#64748b'
};

const VIEW_OPTIONS = [
  { key: 'global', label: 'Global' },
  { key: 'role', label: 'Por rol' },
  { key: 'program', label: 'Por programa' },
  { key: 'site', label: 'Por sitio' }
];

function StatCard({ title, value, subtitle, icon }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          {icon}
        </div>
      </div>
      {subtitle ? <p className="mt-4 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(value);
  }
}

function capitalize(value) {
  return String(value || '')
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatQuestionLabel(question) {
  if (!question) return 'Pregunta sin datos';
  if (typeof question === 'string') return question;
  return question.label || question.instrucciones || question.titulo || question.name || JSON.stringify(question).slice(0, 120);
}

export default function Reportes() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('global');
  const [roleFilter, setRoleFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [selectedEvaluationId, setSelectedEvaluationId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      setLoading(true);
      setError('');

      try {
        const data = await getEvaluationReportMetrics({
          role: roleFilter === 'all' ? null : roleFilter,
          program: programFilter === 'all' ? null : programFilter,
          center: siteFilter === 'all' ? null : siteFilter
        });
        if (!cancelled) setMetrics(data);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'No se pudo cargar el reporte central.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMetrics();
    return () => {
      cancelled = true;
    };
  }, [roleFilter, programFilter, siteFilter]);

  useEffect(() => {
    if (!metrics || !metrics.rows) {
      setSelectedEvaluationId(null);
      return;
    }

    if (metrics.rows.length === 0) {
      setSelectedEvaluationId(null);
      return;
    }

    if (!selectedEvaluationId || !metrics.rows.some((row) => row.id === selectedEvaluationId)) {
      setSelectedEvaluationId(metrics.rows[0].id);
    }
  }, [metrics, selectedEvaluationId]);

  const roleOptions = useMemo(() => {
    if (!metrics) return [{ key: 'all', label: 'Todos' }];
    return [
      { key: 'all', label: 'Todos' },
      ...metrics.roleSummary.map((item) => ({ key: item.role, label: item.role }))
    ];
  }, [metrics]);

  const programOptions = useMemo(() => {
    if (!metrics) return [{ key: 'all', label: 'Todos' }];
    return [
      { key: 'all', label: 'Todos' },
      ...metrics.programSummary.map((item) => ({ key: item.program, label: item.program }))
    ];
  }, [metrics]);

  const siteOptions = useMemo(() => {
    if (!metrics) return [{ key: 'all', label: 'Todos' }];
    return [
      { key: 'all', label: 'Todos' },
      ...metrics.siteSummary.map((item) => ({ key: item.center, label: item.center }))
    ];
  }, [metrics]);

  const roleTotal = metrics?.totals.roles || {};

  const globalTiles = useMemo(() => {
    if (!metrics) return [];
    return [
      { title: 'Total de evaluaciones', value: metrics.totals.total, icon: <Sparkles size={22} /> },
      { title: 'Completadas', value: metrics.totals.completed, icon: <Users size={22} /> },
      { title: 'Pendientes', value: metrics.totals.pending, icon: <TrendingUp size={22} /> },
      { title: 'Sitios activos', value: metrics.siteSummary.length, icon: <LayoutDashboard size={22} /> }
    ];
  }, [metrics]);

  const topSites = useMemo(() => {
    if (!metrics) return [];
    return [...metrics.siteSummary].sort((a, b) => b.total - a.total).slice(0, 6);
  }, [metrics]);

  const topPrograms = useMemo(() => {
    if (!metrics) return [];
    return [...metrics.programSummary].sort((a, b) => b.total - a.total).slice(0, 6);
  }, [metrics]);

  const rows = metrics?.rows || [];
  const selectedEvaluation = useMemo(
    () => rows.find((item) => item.id === selectedEvaluationId) || rows[0] || null,
    [rows, selectedEvaluationId]
  );

  const selectedQuestions = selectedEvaluation?.questions || selectedEvaluation?.surveyDetails?.questions || [];

  const siteProgramMatrix = metrics?.siteProgramMatrix || [];

  const roleTotals = useMemo(() => {
    return Object.entries(roleTotal).map(([role, value]) => ({ role, total: value }));
  }, [roleTotal]);

  const filteredRoles = roleTotals;

  const viewSummary = useMemo(() => {
    if (!metrics) return [];
    if (view === 'role') return metrics.roleSummary;
    if (view === 'program') return metrics.programSummary;
    if (view === 'site') return metrics.siteSummary;
    return [];
  }, [metrics, view]);

  const viewTitle = useMemo(() => {
    if (view === 'role') return 'Rol';
    if (view === 'program') return 'Programa';
    if (view === 'site') return 'Sitio';
    return 'Global';
  }, [view]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-slate-500">
        Cargando dashboard de reportes...
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
    <div className="space-y-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">Panel de reportes</p>
          <h1 className="text-3xl font-semibold text-slate-900">Visión global y por dimensión</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl">
            Revisa la salud de evaluaciones por sitio, programa y rol, o desglosa la información en detalle.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setView(option.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${view === option.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {globalTiles.map((tile) => (
          <StatCard key={tile.title} title={tile.title} value={tile.value} subtitle={tile.subtitle} icon={tile.icon} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">Sitios con más evaluaciones</p>
              <p className="text-sm text-slate-500">Comparativa de volumen por sitio.</p>
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSites} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="center" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [`${value}`, 'Evaluaciones']} />
                <Bar dataKey="total" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-700">Distribución por rol</p>
            <p className="text-sm text-slate-500">Estudiantes, Profesores y Coordinadores.</p>
          </div>
          <div className="space-y-3">
            {filteredRoles.map((item) => (
              <div key={item.role} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{item.role}</p>
                    <p className="text-xs text-slate-500">Evaluaciones</p>
                  </div>
                  <p className="text-lg font-semibold text-slate-900">{item.total}</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (item.total / (filteredRoles[0]?.total || 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Rol</span>
            <select
              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              {roleOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Programa</span>
            <select
              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              value={programFilter}
              onChange={(event) => setProgramFilter(event.target.value)}
            >
              {programOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sitio</span>
            <select
              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              value={siteFilter}
              onChange={(event) => setSiteFilter(event.target.value)}
            >
              {siteOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {view !== 'global' ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">Vista específica por {viewTitle.toLowerCase()}</p>
                <p className="text-sm text-slate-500">Desglose de evaluaciones agrupado por {viewTitle.toLowerCase()}.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">{viewSummary.length} {viewTitle}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {viewSummary.slice(0, 9).map((item) => (
                <div key={item[view === 'role' ? 'role' : view === 'program' ? 'program' : 'center']} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{item[view === 'role' ? 'role' : view === 'program' ? 'program' : 'center']}</p>
                  <p className="mt-1 text-xs text-slate-500">Evaluaciones: {item.total}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">Matriz Sitio × Programa</p>
              <p className="text-sm text-slate-500">Resumen combinado de sitio y programa.</p>
            </div>
            <span className="text-xs uppercase tracking-[0.24em] text-slate-400">{siteProgramMatrix.length} combinaciones</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sitio</th>
                  <th className="px-4 py-3 font-semibold">Programa</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Completadas</th>
                  <th className="px-4 py-3 font-semibold">Pendientes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {siteProgramMatrix.map((item) => (
                  <tr key={`${item.center}-${item.program}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{item.center}</td>
                    <td className="px-4 py-3 text-slate-700">{item.program}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.total}</td>
                    <td className="px-4 py-3 text-slate-600">{item.completadas}</td>
                    <td className="px-4 py-3 text-slate-600">{item.pendientes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-sm font-semibold text-slate-700">Top programas</p>
            <p className="text-sm text-slate-500">Los programas con mayor número de evaluaciones.</p>
          </div>
          <div className="space-y-3">
            {topPrograms.map((item) => (
              <div key={item.program} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900">{item.program}</p>
                    <p className="text-xs text-slate-500">Evaluaciones</p>
                  </div>
                  <p className="text-lg font-semibold text-slate-900">{item.total}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Vistas de detalle</h2>
            <p className="mt-2 text-sm text-slate-500">Explora los datos según la dimensión seleccionada.</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-600">
            {rows.length} evaluaciones en el conjunto actual
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Evaluación</th>
                  <th className="px-6 py-4 font-semibold">Rol</th>
                  <th className="px-6 py-4 font-semibold">Programa</th>
                  <th className="px-6 py-4 font-semibold">Sitio</th>
                  <th className="px-6 py-4 font-semibold">Preguntas</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.slice(0, 12).map((item) => {
                  const isSelected = selectedEvaluation?.id === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedEvaluationId(item.id)}
                      className={`cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-6 py-4 text-slate-900">{item.survey}</td>
                      <td className="px-6 py-4 text-slate-700">{item.role}</td>
                      <td className="px-6 py-4 text-slate-700">{item.program}</td>
                      <td className="px-6 py-4 text-slate-700">{item.center}</td>
                      <td className="px-6 py-4 text-slate-700">{item.questionCount}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{formatDate(item.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No hay evaluaciones para los filtros actuales.</div>
          ) : null}
        </div>

        {selectedEvaluation ? (
          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Detalle de la plantilla seleccionada</p>
                    <p className="text-sm text-slate-500">Selecciona una evaluación de la tabla para ver los detalles de la plantilla y sus preguntas.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                    {selectedEvaluation.questionCount} preguntas
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Plantilla</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{selectedEvaluation.surveyDetails.title}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Dirigido a</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{capitalize(selectedEvaluation.target)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Programa</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{selectedEvaluation.program}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Sitio</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{selectedEvaluation.center}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                  {selectedEvaluation.surveyDetails.description || 'No hay descripción de plantilla disponible.'}
                </div>

                {selectedEvaluation.scoreSummary ? (
                  <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 text-sm">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Puntaje calculado</p>
                        <p className="text-sm text-slate-500">Basado en las respuestas registradas para esta evaluación.</p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.24em] text-slate-400">{selectedEvaluation.scoreSummary.answeredQuestions} respuestas numéricas</span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-3xl bg-slate-50 p-4 text-slate-800">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Puntaje global</p>
                        <p className="mt-2 text-3xl font-semibold">{selectedEvaluation.scoreSummary.globalScore ?? '-'}</p>
                      </div>
                      {selectedEvaluation.scoreSummary.sectionScores.map((section) => (
                        <div key={section.sectionId} className="rounded-3xl bg-slate-50 p-4 text-slate-800">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{section.title}</p>
                          <p className="mt-2 text-2xl font-semibold">{section.score ?? '-'}</p>
                          <p className="mt-2 text-xs text-slate-500">{section.questionCount} preguntas</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Preguntas de la plantilla</p>
                      <p className="text-sm text-slate-500">Vista previa de las preguntas y secciones asociadas.</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-500">Mostrando {selectedQuestions.length} elementos</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedQuestions.length > 0 ? (
                      selectedQuestions.slice(0, 10).map((question, index) => (
                        <div key={`${selectedEvaluation.id}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Pregunta {index + 1}</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{formatQuestionLabel(question)}</p>
                          {question.tipo ? (
                            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-400">Tipo: {question.tipo}</p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                        Esta evaluación no cuenta con preguntas visibles en el registro.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-700">Información de la evaluación</p>
                <p className="text-sm text-slate-500">Detalles y contexto directo desde el registro.</p>
              </div>
              <dl className="space-y-4 text-sm text-slate-600">
                <div>
                  <dt className="font-semibold text-slate-900">Nombre</dt>
                  <dd>{selectedEvaluation.survey}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Estado</dt>
                  <dd>{selectedEvaluation.status}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Fecha de creación</dt>
                  <dd>{formatDate(selectedEvaluation.created_at)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Periodo</dt>
                  <dd>{selectedEvaluation.period || 'No definido'}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
