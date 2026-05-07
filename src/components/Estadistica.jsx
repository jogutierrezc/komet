import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, ReferenceLine,
  LabelList
} from 'recharts';
import { BarChart3, TrendingUp, Building2, GraduationCap, Users, Activity } from 'lucide-react';
import { getEvaluationReportMetrics } from '../lib/data';

// ─── helpers ────────────────────────────────────────────────────────────────
const LEVEL_WORDS = new Set(['pregrado', 'posgrado', 'postgrado']);

function avg(values = []) {
  if (!values.length) return 0;
  return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
}

function norm(v) { return String(v || '').trim(); }

function resolveProgram(row = {}) {
  const j = norm(
    row.rawAnswers?._publicRespondent?.program ||
    row.rawAnswers?.program ||
    row.rawAnswers?.programa || ''
  );
  if (j && !LEVEL_WORDS.has(j.toLowerCase())) return j;
  const r = norm(row.program || '');
  if (r && !LEVEL_WORDS.has(r.toLowerCase())) return r;
  return 'Sin programa';
}

function resolveLevel(row = {}) {
  const raw = String(
    row.rawAnswers?._publicRespondent?.program_level ||
    row.rawAnswers?.program_level || ''
  ).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (raw.startsWith('pre')) return 'pregrado';
  if (raw.startsWith('pos')) return 'posgrado';
  return '';
}

function alertColor(score) {
  if (typeof score !== 'number') return '#94a3b8';
  if (score >= 4.0) return '#22c55e';
  if (score >= 3.5) return '#eab308';
  if (score >= 2.5) return '#f97316';
  return '#ef4444';
}

// Paleta de colores para roles / programas
const PALETTE = ['#2563eb', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#f97316', '#06b6d4'];

// ─── tooltip personalizado ───────────────────────────────────────────────────
function ScoreTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-800 mb-1">{d.name}</p>
      <p className="text-slate-600">Promedio: <span className="font-bold text-blue-600">{Number(d.score || d.value || 0).toFixed(2)}</span></p>
      {d.total !== undefined && <p className="text-slate-500">Evaluaciones: {d.total}</p>}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-800">{d.name}</p>
      <p className="text-slate-600">{d.value} evaluaciones ({d.payload.pct}%)</p>
    </div>
  );
}

// ─── sección card wrapper ────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, span = 1 }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 ${span === 2 ? 'col-span-1 xl:col-span-2' : ''}`}>
      <div className="mb-4">
        <h3 className="font-bold text-slate-800 text-base">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── componente principal ────────────────────────────────────────────────────
export default function Estadistica() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampus, setSelectedCampus] = useState('Todos');
  const [selectedLevel, setSelectedLevel] = useState('Todos');
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    setLoading(true);
    getEvaluationReportMetrics()
      .then((res) => setRows(res?.rows || res || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  // filtro base
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (selectedCampus !== 'Todos' && norm(row.campus) !== selectedCampus) return false;
      if (selectedLevel !== 'Todos') {
        const lvl = resolveLevel(row);
        if (lvl && lvl !== selectedLevel) return false;
      }
      return true;
    });
  }, [rows, selectedCampus, selectedLevel]);

  // opciones de campus
  const campusOptions = useMemo(() => {
    return ['Todos', ...[...new Set(rows.map((r) => norm(r.campus)).filter(Boolean))].sort()];
  }, [rows]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const scores = filtered.map((r) => r.scoreSummary?.globalScore).filter((v) => typeof v === 'number');
    const completed = filtered.filter((r) => r.status === 'Completada').length;
    const centers = new Set(filtered.map((r) => norm(r.center || 'Sin sitio'))).size;
    const programs = new Set(filtered.map((r) => resolveProgram(r)).filter((p) => p !== 'Sin programa')).size;
    return {
      total: filtered.length,
      globalScore: avg(scores),
      completionPct: filtered.length ? Number(((completed / filtered.length) * 100).toFixed(1)) : 0,
      centers,
      programs,
    };
  }, [filtered]);

  // ── por programa ──────────────────────────────────────────────────────────
  const byProgram = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      const key = resolveProgram(row);
      if (key === 'Sin programa') return;
      const cur = map.get(key) || { name: key, scores: [], total: 0 };
      cur.total += 1;
      const s = row.scoreSummary?.globalScore;
      if (typeof s === 'number') cur.scores.push(s);
      map.set(key, cur);
    });
    return [...map.values()]
      .map((d) => ({ name: d.name, score: avg(d.scores), total: d.total }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [filtered]);

  // ── por centro ────────────────────────────────────────────────────────────
  const byCenter = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      const key = norm(row.center || 'Sin sitio');
      const cur = map.get(key) || { name: key, scores: [], total: 0, completed: 0 };
      cur.total += 1;
      if (row.status === 'Completada') cur.completed += 1;
      const s = row.scoreSummary?.globalScore;
      if (typeof s === 'number') cur.scores.push(s);
      map.set(key, cur);
    });
    return [...map.values()]
      .map((d) => ({
        name: d.name,
        score: avg(d.scores),
        total: d.total,
        completionPct: d.total ? Number(((d.completed / d.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }, [filtered]);

  // scatter: total vs score por centro
  const scatterData = useMemo(() => byCenter.map((d) => ({ name: d.name, x: d.total, y: d.score, z: d.total })), [byCenter]);

  // ── por rol ───────────────────────────────────────────────────────────────
  const byRole = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      const key = norm(row.role || 'Sin rol');
      const cur = map.get(key) || { name: key, scores: [], total: 0, completed: 0 };
      cur.total += 1;
      if (row.status === 'Completada') cur.completed += 1;
      const s = row.scoreSummary?.globalScore;
      if (typeof s === 'number') cur.scores.push(s);
      map.set(key, cur);
    });
    return [...map.values()]
      .map((d) => ({
        name: d.name,
        score: avg(d.scores),
        total: d.total,
        pct: filtered.length ? Number(((d.total / filtered.length) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  // donut por rol
  const roleDonut = useMemo(() => byRole.map((d) => ({ ...d, pct: d.pct })), [byRole]);

  // ── secciones del instrumento ─────────────────────────────────────────────
  const bySectionRaw = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      (row.scoreSummary?.sectionScores || []).forEach((sec) => {
        const key = norm(sec.title || sec.seccion || 'Sección');
        const cur = map.get(key) || { name: key, scores: [] };
        if (typeof sec.score === 'number') cur.scores.push(sec.score);
        map.set(key, cur);
      });
    });
    return [...map.values()]
      .map((d) => ({ name: d.name, score: avg(d.scores) }))
      .sort((a, b) => b.score - a.score);
  }, [filtered]);

  // secciones por rol (para gráfico agrupado)
  const sectionByRole = useMemo(() => {
    const roles = [...new Set(filtered.map((r) => norm(r.role || 'Sin rol')))].slice(0, 4);
    const sectionMap = new Map();

    filtered.forEach((row) => {
      const role = norm(row.role || 'Sin rol');
      if (!roles.includes(role)) return;
      (row.scoreSummary?.sectionScores || []).forEach((sec) => {
        const key = norm(sec.title || sec.seccion || 'Sección');
        const cur = sectionMap.get(key) || { name: key };
        if (!cur[role]) cur[role] = [];
        if (typeof sec.score === 'number') cur[role].push(sec.score);
        sectionMap.set(key, cur);
      });
    });

    const result = [...sectionMap.values()].map((d) => {
      const out = { name: d.name.length > 22 ? d.name.slice(0, 22) + '…' : d.name };
      roles.forEach((r) => { out[r] = avg(d[r] || []); });
      return out;
    });

    return { data: result, roles };
  }, [filtered]);

  // radar (secciones por rol) — top 3 roles
  const radarData = useMemo(() => {
    const topRoles = byRole.slice(0, 3).map((r) => r.name);
    const sectionMap = new Map();
    filtered.forEach((row) => {
      const role = norm(row.role || 'Sin rol');
      if (!topRoles.includes(role)) return;
      (row.scoreSummary?.sectionScores || []).forEach((sec) => {
        const key = norm(sec.title || sec.seccion || 'Sección');
        const cur = sectionMap.get(key) || { subject: key.length > 20 ? key.slice(0, 20) + '…' : key };
        if (!cur[role]) cur[role] = [];
        if (typeof sec.score === 'number') cur[role].push(sec.score);
        sectionMap.set(key, cur);
      });
    });
    return {
      data: [...sectionMap.values()].map((d) => {
        const out = { subject: d.subject };
        topRoles.forEach((r) => { out[r] = avg(d[r] || []); });
        return out;
      }),
      roles: topRoles,
    };
  }, [filtered, byRole]);

  // histograma distribución de puntajes 1–5
  const histogram = useMemo(() => {
    const counts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    filtered.forEach((row) => {
      (row.scoreSummary?.sectionScores || []).forEach((sec) => {
        const r = Math.round(sec.score || 0);
        if (r >= 1 && r <= 5) counts[String(r)] += 1;
      });
    });
    return Object.entries(counts).map(([score, count]) => ({ score, count }));
  }, [filtered]);

  // heatmap centros × secciones (top 8 centros, top 6 secciones)
  const heatmap = useMemo(() => {
    const centerMap = new Map();
    filtered.forEach((row) => {
      const center = norm(row.center || 'Sin sitio');
      const cur = centerMap.get(center) || { center, sections: new Map(), total: 0 };
      cur.total += 1;
      (row.scoreSummary?.sectionScores || []).forEach((sec) => {
        const key = norm(sec.title || sec.seccion || 'Sección');
        const s = cur.sections.get(key) || [];
        if (typeof sec.score === 'number') s.push(sec.score);
        cur.sections.set(key, s);
      });
      centerMap.set(center, cur);
    });

    const topCenters = [...centerMap.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // recopilar todas las secciones
    const allSections = new Set();
    topCenters.forEach((c) => c.sections.forEach((_, k) => allSections.add(k)));
    const sections = [...allSections].slice(0, 6);

    return {
      centers: topCenters.map((c) => ({
        center: c.center.length > 24 ? c.center.slice(0, 24) + '…' : c.center,
        sections: Object.fromEntries(sections.map((s) => [s, avg(c.sections.get(s) || [])])),
      })),
      sections,
    };
  }, [filtered]);

  // ── tab nav ───────────────────────────────────────────────────────────────
  const TABS = [
    { key: 'general', label: 'General', icon: Activity },
    { key: 'programas', label: 'Programas', icon: GraduationCap },
    { key: 'centros', label: 'Centros', icon: Building2 },
    { key: 'roles', label: 'Por Rol', icon: Users },
    { key: 'secciones', label: 'Secciones', icon: BarChart3 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp size={24} className="text-blue-600" />
            Estadística
          </h1>
          <p className="text-sm text-slate-500 mt-1">Visualización analítica de evaluaciones por programa, centro y rol</p>
        </div>

        {/* Filtros globales */}
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedCampus}
            onChange={(e) => setSelectedCampus(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {campusOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Todos">Todos los niveles</option>
            <option value="pregrado">Pregrado</option>
            <option value="posgrado">Posgrado</option>
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { label: 'Total evaluaciones', value: kpis.total, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'Puntaje global', value: kpis.globalScore.toFixed(2), color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: '% Completadas', value: `${kpis.completionPct}%`, color: 'bg-violet-50 text-violet-700 border-violet-200' },
          { label: 'Centros activos', value: kpis.centers, color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'Programas', value: kpis.programs, color: 'bg-pink-50 text-pink-700 border-pink-200' },
        ].map((k) => (
          <div key={k.label} className={`rounded-2xl border p-4 ${k.color}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{k.label}</p>
            <p className="text-3xl font-black mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: GENERAL ── */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Histograma distribución de puntajes */}
          <ChartCard
            title="Distribución de calificaciones"
            subtitle="Frecuencia de respuestas por valor (1 a 5) en todas las secciones"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={histogram} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="score" tick={{ fontSize: 13, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="bg-white border border-slate-200 rounded-xl shadow px-4 py-2 text-sm">
                        <p>Calificación <strong>{payload[0].payload.score}</strong></p>
                        <p>Respuestas: <strong>{payload[0].value}</strong></p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="count" name="Respuestas" radius={[6, 6, 0, 0]}>
                  {histogram.map((entry, i) => (
                    <Cell key={i} fill={['#ef4444', '#f97316', '#eab308', '#22c55e', '#2563eb'][i]} />
                  ))}
                  <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Promedio global por campus */}
          <ChartCard
            title="Promedio por campus"
            subtitle="Puntaje promedio de evaluaciones agrupadas por sede"
          >
            {(() => {
              const campusData = (() => {
                const m = new Map();
                filtered.forEach((r) => {
                  const k = norm(r.campus || 'Sin campus');
                  const c = m.get(k) || { name: k, scores: [], total: 0 };
                  c.total += 1;
                  const s = r.scoreSummary?.globalScore;
                  if (typeof s === 'number') c.scores.push(s);
                  m.set(k, c);
                });
                return [...m.values()].map((d) => ({ name: d.name, score: avg(d.scores), total: d.total }));
              })();
              return (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={campusData} layout="vertical" barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip content={<ScoreTooltip />} />
                    <ReferenceLine x={3.7} stroke="#f97316" strokeDasharray="4 3" label={{ value: '3.7', position: 'top', fontSize: 11, fill: '#f97316' }} />
                    <Bar dataKey="score" name="Promedio" radius={[0, 6, 6, 0]}>
                      {campusData.map((d, i) => <Cell key={i} fill={alertColor(d.score)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </ChartCard>

          {/* Donut estado completadas / pendientes */}
          <ChartCard title="Estado de evaluaciones" subtitle="Completadas vs pendientes en el corte actual">
            {(() => {
              const completed = filtered.filter((r) => r.status === 'Completada').length;
              const pending = filtered.length - completed;
              const data = [
                { name: 'Completadas', value: completed, pct: filtered.length ? ((completed / filtered.length) * 100).toFixed(1) : '0' },
                { name: 'Pendientes', value: pending, pct: filtered.length ? ((pending / filtered.length) * 100).toFixed(1) : '0' },
              ];
              return (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={220}>
                    <PieChart>
                      <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                        {data.map((_, i) => <Cell key={i} fill={['#22c55e', '#e2e8f0'][i]} />)}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 text-sm">
                    {data.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: ['#22c55e', '#e2e8f0'][i] }} />
                        <span className="text-slate-600">{d.name}</span>
                        <span className="font-bold text-slate-800">{d.value} ({d.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </ChartCard>

          {/* Radar secciones × rol (top 3 roles) */}
          <ChartCard title="Radar por sección y rol" subtitle="Comparativa de los 3 roles con más evaluaciones en cada sección del instrumento">
            {radarData.data.length === 0 ? (
              <p className="text-sm text-slate-400 text-center mt-10">Sin datos de secciones</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData.data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  {radarData.roles.map((role, i) => (
                    <Radar key={role} name={role} dataKey={role} stroke={PALETTE[i]} fill={PALETTE[i]} fillOpacity={0.15} dot={{ r: 3 }} />
                  ))}
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => Number(v).toFixed(2)} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {/* ── TAB: PROGRAMAS ── */}
      {activeTab === 'programas' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard title="Promedio por programa" subtitle="Ordenado de mayor a menor — línea naranja = umbral 3.7" span={2}>
            <ResponsiveContainer width="100%" height={Math.max(280, byProgram.length * 38)}>
              <BarChart data={byProgram} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                <Tooltip content={<ScoreTooltip />} />
                <ReferenceLine x={3.7} stroke="#f97316" strokeDasharray="4 3" label={{ value: 'Umbral 3.7', position: 'insideTopRight', fontSize: 11, fill: '#f97316' }} />
                <Bar dataKey="score" name="Promedio" radius={[0, 6, 6, 0]}>
                  {byProgram.map((d, i) => <Cell key={i} fill={alertColor(d.score)} />)}
                  <LabelList dataKey="score" position="right" formatter={(v) => Number(v).toFixed(2)} style={{ fontSize: 12, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Volumen de evaluaciones por programa */}
          <ChartCard title="Volumen de evaluaciones" subtitle="Cantidad de evaluaciones registradas por programa">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[...byProgram].sort((a, b) => b.total - a.total).slice(0, 10)} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <div className="bg-white border border-slate-200 rounded-xl shadow px-4 py-2 text-sm">
                    <p className="font-semibold">{payload[0].payload.name}</p>
                    <p>Evaluaciones: <strong>{payload[0].value}</strong></p>
                  </div>
                ) : null} />
                <Bar dataKey="total" name="Evaluaciones" fill="#2563eb" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="total" position="top" style={{ fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Donut participación programas */}
          <ChartCard title="Participación por programa" subtitle="Distribución porcentual del total de evaluaciones">
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="45%" height={220}>
                <PieChart>
                  <Pie data={byProgram.slice(0, 8).map((d) => ({ ...d, name: d.name, value: d.total, pct: filtered.length ? ((d.total / filtered.length) * 100).toFixed(1) : '0' }))} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                    {byProgram.slice(0, 8).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-xs flex-1">
                {byProgram.slice(0, 8).map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="text-slate-600 truncate flex-1">{d.name}</span>
                    <span className="font-bold text-slate-700 shrink-0">{d.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>
      )}

      {/* ── TAB: CENTROS ── */}
      {activeTab === 'centros' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Promedio por centro — barras horizontales con semáforo */}
          <ChartCard title="Promedio por centro de convenio" subtitle="Línea naranja = umbral 3.7 (MEN 00273)" span={2}>
            <ResponsiveContainer width="100%" height={Math.max(300, byCenter.length * 42)}>
              <BarChart data={byCenter} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
                <Tooltip content={<ScoreTooltip />} />
                <ReferenceLine x={3.7} stroke="#f97316" strokeDasharray="4 3" label={{ value: 'Umbral', position: 'top', fontSize: 10, fill: '#f97316' }} />
                <Bar dataKey="score" name="Promedio" radius={[0, 6, 6, 0]}>
                  {byCenter.map((d, i) => <Cell key={i} fill={alertColor(d.score)} />)}
                  <LabelList dataKey="score" position="right" formatter={(v) => Number(v).toFixed(2)} style={{ fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Scatter: volumen vs promedio */}
          <ChartCard title="Volumen vs Calidad por centro" subtitle="Eje X = cantidad de evaluaciones · Eje Y = promedio · Tamaño = volumen">
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="x" name="Evaluaciones" type="number" tick={{ fontSize: 11 }} label={{ value: 'N° Evaluaciones', position: 'insideBottomRight', offset: -10, fontSize: 11 }} />
                <YAxis dataKey="y" name="Promedio" type="number" domain={[0, 5]} tick={{ fontSize: 11 }} label={{ value: 'Promedio', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <ZAxis dataKey="z" range={[40, 300]} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="bg-white border border-slate-200 rounded-xl shadow px-4 py-2 text-sm">
                        <p className="font-semibold">{payload[0]?.payload?.name}</p>
                        <p>Evaluaciones: <strong>{payload[0]?.payload?.x}</strong></p>
                        <p>Promedio: <strong>{Number(payload[0]?.payload?.y || 0).toFixed(2)}</strong></p>
                      </div>
                    ) : null
                  }
                />
                <ReferenceLine y={3.7} stroke="#f97316" strokeDasharray="4 3" />
                <Scatter data={scatterData} fill="#2563eb" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* % Cumplimiento por centro */}
          <ChartCard title="% Cumplimiento por centro" subtitle="Porcentaje de evaluaciones completadas por cada centro">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={[...byCenter].sort((a, b) => b.completionPct - a.completionPct).slice(0, 10)} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={70} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="completionPct" name="Cumplimiento" fill="#14b8a6" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="completionPct" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 10, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Heatmap centros × secciones */}
          <ChartCard title="Mapa de calor: Centros × Secciones" subtitle="Color indica puntaje promedio por sección en cada centro" span={2}>
            {heatmap.centers.length === 0 ? (
              <p className="text-sm text-slate-400">Sin datos suficientes</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-slate-500 font-semibold min-w-[150px]">Centro</th>
                      {heatmap.sections.map((s) => (
                        <th key={s} className="p-2 text-slate-500 font-semibold text-center max-w-[90px]">
                          <span className="block truncate max-w-[88px]" title={s}>{s.length > 14 ? s.slice(0, 14) + '…' : s}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.centers.map((row) => (
                      <tr key={row.center} className="border-t border-slate-100">
                        <td className="p-2 text-slate-700 font-medium truncate max-w-[150px]" title={row.center}>{row.center}</td>
                        {heatmap.sections.map((s) => {
                          const val = row.sections[s] || 0;
                          const color = alertColor(val || null);
                          return (
                            <td key={s} className="p-1 text-center">
                              <div
                                className="rounded-lg py-1.5 px-2 font-bold text-white text-xs"
                                style={{ background: val > 0 ? color : '#e2e8f0', color: val > 0 ? '#fff' : '#94a3b8' }}
                              >
                                {val > 0 ? val.toFixed(1) : '–'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-4 mt-4 text-xs text-slate-500">
                  {[['≥4.0', '#22c55e', 'Verde'], ['≥3.5', '#eab308', 'Amarillo'], ['≥2.5', '#f97316', 'Naranja'], ['<2.5', '#ef4444', 'Rojo']].map(([range, color, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded" style={{ background: color }} />
                      <span>{range} — {label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>
        </div>
      )}

      {/* ── TAB: ROLES ── */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Donut distribución por rol */}
          <ChartCard title="Distribución por rol evaluador" subtitle="Participación porcentual de cada perfil en las evaluaciones">
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={240}>
                <PieChart>
                  <Pie
                    data={roleDonut.map((d) => ({ ...d, value: d.total, pct: d.pct }))}
                    cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                    dataKey="value" paddingAngle={3}
                  >
                    {roleDonut.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 text-sm flex-1">
                {roleDonut.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="text-slate-600 flex-1">{d.name}</span>
                    <span className="font-bold text-slate-800">{d.total} ({d.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>

          {/* Promedio por rol */}
          <ChartCard title="Promedio por rol evaluador" subtitle="Puntaje promedio de las evaluaciones completadas por cada perfil">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byRole} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                <Tooltip content={<ScoreTooltip />} />
                <ReferenceLine y={3.7} stroke="#f97316" strokeDasharray="4 3" />
                <Bar dataKey="score" name="Promedio" radius={[6, 6, 0, 0]}>
                  {byRole.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  <LabelList dataKey="score" position="top" formatter={(v) => Number(v).toFixed(2)} style={{ fontSize: 12, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Barras agrupadas secciones × rol */}
          <ChartCard title="Puntaje por sección y rol" subtitle="Comparativa de cada sección del instrumento entre los distintos roles evaluadores" span={2}>
            {sectionByRole.data.length === 0 ? (
              <p className="text-sm text-slate-400 text-center mt-8">Sin datos de secciones</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={sectionByRole.data} barGap={2} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={55} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => Number(v).toFixed(2)} />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={3.7} stroke="#f97316" strokeDasharray="4 3" />
                  {sectionByRole.roles.map((role, i) => (
                    <Bar key={role} dataKey={role} name={role} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} barSize={16} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {/* ── TAB: SECCIONES ── */}
      {activeTab === 'secciones' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Semáforo por sección */}
          <ChartCard title="Semáforo normativo por sección" subtitle="Verde ≥4.0 · Amarillo ≥3.5 · Naranja ≥2.5 · Rojo <2.5">
            <div className="space-y-3">
              {bySectionRaw.map((sec) => {
                const color = alertColor(sec.score);
                const pct = Math.max(0, Math.min(100, (sec.score / 5) * 100));
                return (
                  <div key={sec.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-700 font-medium truncate max-w-[70%]">{sec.name}</span>
                      <span className="font-bold" style={{ color }}>{sec.score.toFixed(2)}</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>

          {/* Barras secciones con colores */}
          <ChartCard title="Promedio global por sección" subtitle="Línea = umbral mínimo aceptable (3.7)">
            <ResponsiveContainer width="100%" height={Math.max(280, bySectionRaw.length * 38)}>
              <BarChart data={bySectionRaw} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} />
                <Tooltip content={<ScoreTooltip />} />
                <ReferenceLine x={3.7} stroke="#f97316" strokeDasharray="4 3" />
                <Bar dataKey="score" name="Promedio" radius={[0, 6, 6, 0]}>
                  {bySectionRaw.map((d, i) => <Cell key={i} fill={alertColor(d.score)} />)}
                  <LabelList dataKey="score" position="right" formatter={(v) => Number(v).toFixed(2)} style={{ fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Distribución 1–5 apilada por sección */}
          <ChartCard title="Distribución de respuestas por sección" subtitle="Barras apiladas: proporción de calificaciones 1 a 5 por sección" span={2}>
            {(() => {
              const distData = (() => {
                const m = new Map();
                filtered.forEach((row) => {
                  (row.scoreSummary?.sectionScores || []).forEach((sec) => {
                    const key = norm(sec.title || sec.seccion || 'Sección');
                    const cur = m.get(key) || { name: key.length > 20 ? key.slice(0, 20) + '…' : key, r1: 0, r2: 0, r3: 0, r4: 0, r5: 0 };
                    const r = Math.round(sec.score || 0);
                    if (r >= 1 && r <= 5) cur[`r${r}`] += 1;
                    m.set(key, cur);
                  });
                });
                return [...m.values()];
              })();
              return (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={distData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={65} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="r1" name="1" stackId="a" fill="#ef4444" />
                    <Bar dataKey="r2" name="2" stackId="a" fill="#f97316" />
                    <Bar dataKey="r3" name="3" stackId="a" fill="#eab308" />
                    <Bar dataKey="r4" name="4" stackId="a" fill="#22c55e" />
                    <Bar dataKey="r5" name="5" stackId="a" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
