import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, ReferenceLine,
  LineChart, Line, FunnelChart, Funnel,
  LabelList
} from 'recharts';
import { BarChart3, TrendingUp, Building2, GraduationCap, Users, Activity, Brain } from 'lucide-react';
import { getEvaluationReportMetrics, getSystemSettings, runOpenRouterPrompt } from '../lib/data';

// ─── helpers ────────────────────────────────────────────────────────────────
const LEVEL_WORDS = new Set(['pregrado', 'posgrado', 'postgrado']);
const OPEN_TEXT_KEY_HINT = /(coment|observ|recomend|suger|justific|fortalez|debilid|opinion|retro|texto|escrib|mejora)/i;
const EXCLUDED_OPEN_TEXT_KEYS = new Set([
  'program', 'programa', 'program_level', 'campus', 'center', 'centro', 'role', 'rol',
  'name', 'nombre', 'email', 'correo', 'telefono', 'phone', 'identificacion', 'documento'
]);

function avg(values = []) {
  if (!values.length) return 0;
  return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
}

function norm(v) { return String(v || '').trim(); }

function extractOpenTextResponses(row = {}) {
  const out = [];
  const seen = new Set();
  const questions = Array.isArray(row.questions) ? row.questions : [];
  const questionMap = new Map(questions.map((q) => [String(q?.id || ''), q]));

  function visit(node, path = []) {
    if (node === null || node === undefined) return;

    if (typeof node === 'string') {
      const text = norm(node);
      if (!text || text.length < 10) return;
      if (/^[0-9]+([.,][0-9]+)?$/.test(text)) return;
      if (/^(si|no|na|n\/?a)$/i.test(text)) return;

      const key = String(path[path.length - 1] || '');
      const q = questionMap.get(key);
      const qType = String(q?.type || '').toLowerCase();
      if (qType.includes('likert') || qType.includes('scale') || qType.includes('rating') || qType.includes('number')) return;

      const label = norm(q?.label || q?.question || key || 'Comentario');
      const includeByHint = OPEN_TEXT_KEY_HINT.test(label) || OPEN_TEXT_KEY_HINT.test(key);
      if (!includeByHint && text.length < 35) return;

      const sig = `${label}|${text}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      out.push({ question: label, text });
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, path.concat(String(index))));
      return;
    }

    if (typeof node === 'object') {
      Object.entries(node).forEach(([key, value]) => {
        if (key.startsWith('_')) return;
        if (EXCLUDED_OPEN_TEXT_KEYS.has(String(key).toLowerCase())) return;
        visit(value, path.concat(key));
      });
    }
  }

  visit(row.rawAnswers || {}, []);
  return out;
}

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

function parseAnaliticKometResponse(rawText = '') {
  const fallback = {
    resumenEjecutivo: 'No fue posible estructurar la respuesta IA en este momento.',
    lecturaGraficas: 'Intenta de nuevo con un rango de filtros diferente.',
    hallazgosClave: [],
    mejorasPriorizadas: [],
    alertasTempranas: [],
    conclusion: ''
  };

  const text = String(rawText || '').trim();
  if (!text) return fallback;

  const fromFence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fromFence || text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const jsonText = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;

  try {
    const parsed = JSON.parse(jsonText);
    return {
      resumenEjecutivo: String(parsed?.resumenEjecutivo || fallback.resumenEjecutivo),
      lecturaGraficas: String(parsed?.lecturaGraficas || fallback.lecturaGraficas),
      hallazgosClave: Array.isArray(parsed?.hallazgosClave) ? parsed.hallazgosClave : [],
      mejorasPriorizadas: Array.isArray(parsed?.mejorasPriorizadas) ? parsed.mejorasPriorizadas : [],
      alertasTempranas: Array.isArray(parsed?.alertasTempranas) ? parsed.alertasTempranas : [],
      conclusion: String(parsed?.conclusion || '')
    };
  } catch {
    return {
      ...fallback,
      resumenEjecutivo: text.slice(0, 1600)
    };
  }
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
  const [selectedCenter, setSelectedCenter] = useState('Todos');
  const [selectedProgram, setSelectedProgram] = useState('Todos');
  const [selectedCenterView, setSelectedCenterView] = useState('Todos');
  const [activeTab, setActiveTab] = useState('general');
  const [isGeneratingAnalitic, setIsGeneratingAnalitic] = useState(false);
  const [analiticError, setAnaliticError] = useState('');
  const [analiticOutput, setAnaliticOutput] = useState(null);
  const [analiticGeneratedAt, setAnaliticGeneratedAt] = useState('');

  useEffect(() => {
    setLoading(true);
    getEvaluationReportMetrics()
      .then((res) => setRows(res?.rows || res || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  // filtro base (campus y nivel)
  const baseFiltered = useMemo(() => {
    return rows.filter((row) => {
      if (selectedCampus !== 'Todos' && norm(row.campus) !== selectedCampus) return false;
      if (selectedLevel !== 'Todos') {
        const lvl = resolveLevel(row);
        if (lvl && lvl !== selectedLevel) return false;
      }
      return true;
    });
  }, [rows, selectedCampus, selectedLevel]);

  // filtro final (centro y programa)
  const filtered = useMemo(() => {
    return baseFiltered.filter((row) => {
      const rowCenter = norm(row.center || 'Sin sitio');
      const rowProgram = resolveProgram(row);
      if (selectedCenter !== 'Todos' && rowCenter !== selectedCenter) return false;
      if (selectedProgram !== 'Todos' && rowProgram !== selectedProgram) return false;
      return true;
    });
  }, [baseFiltered, selectedCenter, selectedProgram]);

  // opciones de campus
  const campusOptions = useMemo(() => {
    return ['Todos', ...[...new Set(rows.map((r) => norm(r.campus)).filter(Boolean))].sort()];
  }, [rows]);

  const centerOptions = useMemo(() => {
    return ['Todos', ...[...new Set(baseFiltered.map((r) => norm(r.center || 'Sin sitio')).filter(Boolean))].sort()];
  }, [baseFiltered]);

  const programOptions = useMemo(() => {
    const source = selectedCenter === 'Todos'
      ? baseFiltered
      : baseFiltered.filter((r) => norm(r.center || 'Sin sitio') === selectedCenter);
    const programs = [...new Set(source.map((r) => resolveProgram(r)).filter((p) => p && p !== 'Sin programa'))].sort();
    return ['Todos', ...programs];
  }, [baseFiltered, selectedCenter]);

  useEffect(() => {
    if (!centerOptions.includes(selectedCenter)) setSelectedCenter('Todos');
  }, [centerOptions, selectedCenter]);

  useEffect(() => {
    if (!programOptions.includes(selectedProgram)) setSelectedProgram('Todos');
  }, [programOptions, selectedProgram]);

  const centerViewOptions = useMemo(() => {
    return ['Todos', ...[...new Set(filtered.map((r) => norm(r.center || 'Sin sitio')).filter(Boolean))].sort()];
  }, [filtered]);

  useEffect(() => {
    if (!centerViewOptions.includes(selectedCenterView)) setSelectedCenterView('Todos');
  }, [centerViewOptions, selectedCenterView]);

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

  const byProgramExtended = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      const key = resolveProgram(row);
      if (key === 'Sin programa') return;
      const cur = map.get(key) || { name: key, total: 0, completed: 0, scores: [], centers: new Set() };
      cur.total += 1;
      if (row.status === 'Completada') cur.completed += 1;
      cur.centers.add(norm(row.center || 'Sin sitio'));
      const s = row.scoreSummary?.globalScore;
      if (typeof s === 'number') cur.scores.push(s);
      map.set(key, cur);
    });

    return [...map.values()]
      .map((d) => ({
        name: d.name,
        total: d.total,
        score: avg(d.scores),
        completionPct: d.total ? Number(((d.completed / d.total) * 100).toFixed(1)) : 0,
        centerCount: d.centers.size,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
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

  const topCentersByVolume = useMemo(() => {
    return [...byCenter]
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)
      .map((d, i) => ({ ...d, rank: i + 1 }));
  }, [byCenter]);

  const centerComments = useMemo(() => {
    const source = selectedCenterView === 'Todos'
      ? filtered
      : filtered.filter((r) => norm(r.center || 'Sin sitio') === selectedCenterView);

    const records = [];
    source.forEach((row) => {
      const snippets = extractOpenTextResponses(row).slice(0, 3);
      snippets.forEach((snippet) => {
        records.push({
          center: norm(row.center || 'Sin sitio'),
          program: resolveProgram(row),
          role: norm(row.role || 'Sin rol'),
          person: norm(row.person || 'Evaluador'),
          date: row.completed_at || row.created_at || '',
          question: snippet.question,
          text: snippet.text,
        });
      });
    });

    return records
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 40);
  }, [filtered, selectedCenterView]);

  const commentKeywords = useMemo(() => {
    const stop = new Set(['para', 'como', 'esta', 'este', 'desde', 'entre', 'sobre', 'donde', 'cuando', 'porque', 'tambien', 'pero', 'muy', 'que', 'con', 'sin', 'por', 'del', 'las', 'los', 'una', 'uno', 'unos', 'unas', 'han', 'hay', 'fue', 'son', 'sus', 'al', 'el', 'la', 'en', 'de', 'y', 'o']);
    const counter = new Map();

    centerComments.forEach((item) => {
      item.text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !stop.has(w))
        .forEach((w) => {
          counter.set(w, (counter.get(w) || 0) + 1);
        });
    });

    return [...counter.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [centerComments]);

  const aiComments = useMemo(() => {
    const snippets = [];
    filtered.forEach((row) => {
      extractOpenTextResponses(row).slice(0, 2).forEach((item) => {
        snippets.push({
          center: norm(row.center || 'Sin sitio'),
          program: resolveProgram(row),
          role: norm(row.role || 'Sin rol'),
          question: item.question,
          text: item.text
        });
      });
    });
    return snippets.slice(0, 50);
  }, [filtered]);

  async function generateAnaliticKomet() {
    try {
      setIsGeneratingAnalitic(true);
      setAnaliticError('');

      const settings = await getSystemSettings();
      const trimmedApiKey = String(settings?.openrouter_api_key || '').trim();
      if (!trimmedApiKey) {
        throw new Error('Configura la API Key de OpenRouter en Sistema para generar Analitic Komet.');
      }

      const payload = {
        filtros: {
          campus: selectedCampus,
          nivel: selectedLevel,
          centro: selectedCenter,
          programa: selectedProgram
        },
        kpis,
        tendenciaMensual: monthlyTrend,
        funnel: funnelData,
        programasTop: byProgramExtended.slice(0, 10),
        centrosTopVolumen: topCentersByVolume.slice(0, 10),
        centrosTopPromedio: byCenter.slice(0, 10),
        roles: byRole,
        secciones: bySectionRaw,
        paretoSecciones: paretoSections,
        comentarios: aiComments
      };

      const systemPrompt = [
        'Eres Analitic Komet, analista senior de calidad academica y relacion docencia-servicio.',
        'Debes interpretar tableros estadisticos y comentarios abiertos para generar hallazgos accionables.',
        'No inventes datos. Usa solo la evidencia del dataset recibido.',
        'Responde en espanol, tono tecnico-directivo, claro y ejecutable.',
        'Obligatorio: responde solo JSON valido sin markdown.'
      ].join(' ');

      const prompt = `
Genera un analisis institucional llamado "Analitic Komet" con base en los datos filtrados.

Devuelve exclusivamente JSON con esta estructura exacta:
{
  "resumenEjecutivo": "...",
  "lecturaGraficas": "...",
  "hallazgosClave": ["..."],
  "mejorasPriorizadas": [
    {
      "accion": "...",
      "prioridad": "Alta|Media|Baja",
      "horizonte": "30 dias|60 dias|90 dias",
      "responsableSugerido": "...",
      "justificacion": "..."
    }
  ],
  "alertasTempranas": ["..."],
  "conclusion": "..."
}

Reglas:
- Interpreta tendencias, dispersion y comparativos entre centros, programas, roles y secciones.
- Usa comentarios para construir oportunidades de mejora concretas.
- Incluye riesgos operativos y acciones priorizadas por impacto.
- Si hay pocos datos, dilo explicitamente y sugiere mejoras de captura.

Dataset filtrado:
${JSON.stringify(payload)}
      `.trim();

      const raw = await runOpenRouterPrompt({
        apiKey: trimmedApiKey,
        model: settings?.openrouter_model,
        systemPrompt: [systemPrompt, settings?.openrouter_system_prompt].filter(Boolean).join('\n\n'),
        temperature: Number(settings?.openrouter_temperature ?? 0.6),
        prompt
      });

      setAnaliticOutput(parseAnaliticKometResponse(raw));
      setAnaliticGeneratedAt(new Date().toLocaleString('es-CO'));
    } catch (err) {
      setAnaliticError(err?.message || 'No fue posible generar Analitic Komet en este momento.');
    } finally {
      setIsGeneratingAnalitic(false);
    }
  }

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

  // tendencia temporal por mes
  const monthlyTrend = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      const rawDate = row.completed_at || row.created_at;
      if (!rawDate) return;
      const dt = new Date(rawDate);
      if (Number.isNaN(dt.getTime())) return;
      const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const cur = map.get(monthKey) || { monthKey, scores: [], total: 0, completed: 0 };
      cur.total += 1;
      if (row.status === 'Completada') cur.completed += 1;
      const s = row.scoreSummary?.globalScore;
      if (typeof s === 'number') cur.scores.push(s);
      map.set(monthKey, cur);
    });

    return [...map.values()]
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map((d) => ({
        month: d.monthKey,
        score: avg(d.scores),
        total: d.total,
        completionPct: d.total ? Number(((d.completed / d.total) * 100).toFixed(1)) : 0,
      }));
  }, [filtered]);

  // funnel de proceso
  const funnelData = useMemo(() => {
    const total = filtered.length;
    const started = filtered.filter((r) => r.status !== 'Pendiente').length;
    const completed = filtered.filter((r) => r.status === 'Completada').length;
    return [
      { name: 'Asignadas', value: total, fill: '#2563eb' },
      { name: 'Iniciadas', value: started, fill: '#14b8a6' },
      { name: 'Completadas', value: completed, fill: '#22c55e' },
    ];
  }, [filtered]);

  // pareto por sección (impacto negativo vs umbral 3.7)
  const paretoSections = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      (row.scoreSummary?.sectionScores || []).forEach((sec) => {
        const key = norm(sec.title || sec.seccion || 'Sección');
        const cur = map.get(key) || { name: key, gap: 0, total: 0 };
        const val = Number(sec.score || 0);
        cur.total += 1;
        cur.gap += Math.max(0, 3.7 - val);
        map.set(key, cur);
      });
    });

    const sorted = [...map.values()]
      .map((d) => ({ ...d, impact: Number(d.gap.toFixed(2)) }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 10);

    const totalImpact = sorted.reduce((s, d) => s + d.impact, 0) || 1;
    let accum = 0;
    return sorted.map((d) => {
      accum += d.impact;
      return {
        name: d.name.length > 24 ? d.name.slice(0, 24) + '…' : d.name,
        impact: d.impact,
        cumulativePct: Number(((accum / totalImpact) * 100).toFixed(1)),
      };
    });
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
    { key: 'analitic', label: 'Analitic Komet', icon: Brain },
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
          <select
            value={selectedCenter}
            onChange={(e) => setSelectedCenter(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {centerOptions.map((c) => <option key={c} value={c}>{c === 'Todos' ? 'Todos los centros' : c}</option>)}
          </select>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {programOptions.map((p) => <option key={p} value={p}>{p === 'Todos' ? 'Todos los programas' : p}</option>)}
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

          <ChartCard
            title="Tendencia mensual de desempeño"
            subtitle="Evolución del puntaje promedio y porcentaje de completitud por mes"
            span={2}
          >
            {monthlyTrend.length === 0 ? (
              <p className="text-sm text-slate-400 text-center mt-10">Sin fechas suficientes para construir tendencia</p>
            ) : (
              <ResponsiveContainer width="100%" height={290}>
                <LineChart data={monthlyTrend} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="score" domain={[0, 5]} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="bg-white border border-slate-200 rounded-xl shadow px-4 py-2 text-sm">
                          <p className="font-semibold text-slate-800">{payload[0]?.payload?.month}</p>
                          <p>Promedio: <strong>{Number(payload[0]?.payload?.score || 0).toFixed(2)}</strong></p>
                          <p>Completitud: <strong>{payload[0]?.payload?.completionPct}%</strong></p>
                          <p>Evaluaciones: <strong>{payload[0]?.payload?.total}</strong></p>
                        </div>
                      ) : null
                    }
                  />
                  <ReferenceLine yAxisId="score" y={3.7} stroke="#f97316" strokeDasharray="4 3" />
                  <Line yAxisId="score" type="monotone" dataKey="score" name="Promedio" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
                  <Line yAxisId="pct" type="monotone" dataKey="completionPct" name="Completitud %" stroke="#14b8a6" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Embudo de avance"
            subtitle="Flujo de evaluaciones: asignadas, iniciadas y completadas"
          >
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={250}>
                <FunnelChart>
                  <Tooltip />
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    <LabelList position="right" fill="#334155" stroke="none" dataKey="name" />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-sm">
                {funnelData.map((step) => (
                  <div key={step.name} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: step.fill }} />
                    <span className="text-slate-600">{step.name}:</span>
                    <span className="font-bold text-slate-800">{step.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>

          <ChartCard
            title="Pareto de secciones críticas"
            subtitle="Impacto negativo acumulado frente al umbral 3.7 (priorización 80/20)"
          >
            {paretoSections.length === 0 ? (
              <p className="text-sm text-slate-400 text-center mt-10">Sin datos suficientes para análisis de pareto</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={paretoSections}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="impact" name="Impacto" fill="#f97316" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="cumulativePct" name="Acumulado %" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                  <ReferenceLine yAxisId="right" y={80} stroke="#dc2626" strokeDasharray="4 3" />
                </BarChart>
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

          <ChartCard title="Calidad vs volumen por programa" subtitle="Eje X = evaluaciones · Eje Y = promedio · Tamaño = cobertura en centros">
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="x" type="number" name="Evaluaciones" tick={{ fontSize: 11 }} />
                <YAxis dataKey="y" type="number" name="Promedio" domain={[0, 5]} tick={{ fontSize: 11 }} />
                <ZAxis dataKey="z" range={[40, 320]} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="bg-white border border-slate-200 rounded-xl shadow px-4 py-2 text-sm">
                        <p className="font-semibold">{payload[0]?.payload?.name}</p>
                        <p>Evaluaciones: <strong>{payload[0]?.payload?.x}</strong></p>
                        <p>Promedio: <strong>{Number(payload[0]?.payload?.y || 0).toFixed(2)}</strong></p>
                        <p>Centros: <strong>{payload[0]?.payload?.centers}</strong></p>
                      </div>
                    ) : null
                  }
                />
                <ReferenceLine y={3.7} stroke="#f97316" strokeDasharray="4 3" />
                <Scatter
                  data={byProgramExtended.map((p) => ({ name: p.name, x: p.total, y: p.score, z: p.centerCount, centers: p.centerCount }))}
                  fill="#2563eb"
                  fillOpacity={0.75}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Cumplimiento por programa" subtitle="Porcentaje de evaluaciones completadas en los programas con más volumen">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byProgramExtended.slice(0, 10)} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={65} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="completionPct" name="Cumplimiento" fill="#14b8a6" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="completionPct" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 10, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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

          <ChartCard title="Centros con más evaluaciones" subtitle="Ranking por volumen total y su desempeño asociado" span={2}>
            {topCentersByVolume.length === 0 ? (
              <p className="text-sm text-slate-400">Sin datos disponibles para ranking de centros</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={Math.max(280, topCentersByVolume.length * 30)}>
                  <BarChart data={topCentersByVolume} layout="vertical" barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11 }} />
                    <Tooltip content={<ScoreTooltip />} />
                    <Bar dataKey="total" name="Evaluaciones" fill="#2563eb" radius={[0, 6, 6, 0]}>
                      <LabelList dataKey="total" position="right" style={{ fontSize: 11, fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-200">
                        <th className="py-2 text-left">#</th>
                        <th className="py-2 text-left">Centro</th>
                        <th className="py-2 text-right">Eval.</th>
                        <th className="py-2 text-right">Prom.</th>
                        <th className="py-2 text-right">Cumpl.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCentersByVolume.slice(0, 10).map((c) => (
                        <tr key={c.name} className="border-b border-slate-100">
                          <td className="py-2 font-semibold text-slate-600">{c.rank}</td>
                          <td className="py-2 text-slate-700 max-w-[260px] truncate" title={c.name}>{c.name}</td>
                          <td className="py-2 text-right font-semibold">{c.total}</td>
                          <td className="py-2 text-right font-semibold" style={{ color: alertColor(c.score) }}>{c.score.toFixed(2)}</td>
                          <td className="py-2 text-right text-slate-600">{c.completionPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Comentarios y respuestas escritas por centro" subtitle="Extracción de texto abierto para lectura cualitativa" span={2}>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <label className="text-sm text-slate-600 font-semibold">Centro para detalle:</label>
              <select
                value={selectedCenterView}
                onChange={(e) => setSelectedCenterView(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {centerViewOptions.map((c) => <option key={c} value={c}>{c === 'Todos' ? 'Todos los centros' : c}</option>)}
              </select>
              <span className="text-xs text-slate-500">Registros encontrados: {centerComments.length}</span>
            </div>

            {centerComments.length === 0 ? (
              <p className="text-sm text-slate-400">No se encontraron comentarios escritos para el filtro seleccionado.</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2 overflow-x-auto max-h-[420px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-slate-500 border-b border-slate-200">
                        <th className="py-2 text-left">Fecha</th>
                        <th className="py-2 text-left">Centro</th>
                        <th className="py-2 text-left">Programa / Rol</th>
                        <th className="py-2 text-left">Pregunta</th>
                        <th className="py-2 text-left">Comentario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {centerComments.map((item, i) => (
                        <tr key={`${item.center}-${item.person}-${i}`} className="border-b border-slate-100 align-top">
                          <td className="py-2 text-xs text-slate-500 whitespace-nowrap">{item.date ? new Date(item.date).toLocaleDateString() : 'Sin fecha'}</td>
                          <td className="py-2 text-slate-700 max-w-[180px] truncate" title={item.center}>{item.center}</td>
                          <td className="py-2">
                            <div className="text-slate-700 max-w-[150px] truncate" title={item.program}>{item.program}</div>
                            <div className="text-xs text-slate-500">{item.role}</div>
                          </td>
                          <td className="py-2 text-xs text-slate-600 max-w-[180px] truncate" title={item.question}>{item.question}</td>
                          <td className="py-2 text-slate-700 min-w-[260px]">{item.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-700 mb-2">Palabras más frecuentes</h4>
                  {commentKeywords.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin palabras relevantes</p>
                  ) : (
                    <div className="space-y-2">
                      {commentKeywords.map((k) => (
                        <div key={k.word} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <span className="font-medium text-slate-700">{k.word}</span>
                          <span className="font-bold text-blue-700">{k.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
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

      {/* ── TAB: ANALITIC KOMET ── */}
      {activeTab === 'analitic' && (
        <div className="space-y-6">
          <ChartCard
            title="Analitic Komet"
            subtitle="Analitica IA dinamica usando los filtros superiores y modelos gratuitos en OpenRouter"
            span={2}
          >
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={generateAnaliticKomet}
                disabled={isGeneratingAnalitic}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isGeneratingAnalitic ? 'Generando analisis...' : 'Generar Analitic Komet'}
              </button>
              <span className="text-xs text-slate-500">
                Filtros activos: {selectedCampus} · {selectedLevel} · {selectedCenter} · {selectedProgram}
              </span>
              {analiticGeneratedAt && (
                <span className="text-xs text-slate-500">Ultima generacion: {analiticGeneratedAt}</span>
              )}
            </div>
            {analiticError && <p className="text-sm text-red-600 mt-3">{analiticError}</p>}
          </ChartCard>

          {analiticOutput && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ChartCard title="Resumen ejecutivo" subtitle="Lectura general del estado de calidad" span={2}>
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{analiticOutput.resumenEjecutivo}</p>
              </ChartCard>

              <ChartCard title="Lectura de graficas" subtitle="Interpretacion de tendencias y comparativos" span={2}>
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{analiticOutput.lecturaGraficas}</p>
              </ChartCard>

              <ChartCard title="Hallazgos clave" subtitle="Puntos criticos identificados por Analitic Komet">
                {analiticOutput.hallazgosClave?.length ? (
                  <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
                    {analiticOutput.hallazgosClave.map((item, idx) => (
                      <li key={idx}>{String(item)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">Sin hallazgos estructurados.</p>
                )}
              </ChartCard>

              <ChartCard title="Alertas tempranas" subtitle="Señales de riesgo operativo a monitorear">
                {analiticOutput.alertasTempranas?.length ? (
                  <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
                    {analiticOutput.alertasTempranas.map((item, idx) => (
                      <li key={idx}>{String(item)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">Sin alertas reportadas.</p>
                )}
              </ChartCard>

              <ChartCard title="Aspectos de mejora" subtitle="Plan de accion sugerido desde comentarios y metricas" span={2}>
                {analiticOutput.mejorasPriorizadas?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200">
                          <th className="py-2 text-left">Accion</th>
                          <th className="py-2 text-left">Prioridad</th>
                          <th className="py-2 text-left">Horizonte</th>
                          <th className="py-2 text-left">Responsable</th>
                          <th className="py-2 text-left">Justificacion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analiticOutput.mejorasPriorizadas.map((m, idx) => (
                          <tr key={idx} className="border-b border-slate-100 align-top">
                            <td className="py-2 font-medium text-slate-800 min-w-[220px]">{String(m?.accion || '')}</td>
                            <td className="py-2 text-slate-700">{String(m?.prioridad || '')}</td>
                            <td className="py-2 text-slate-700">{String(m?.horizonte || '')}</td>
                            <td className="py-2 text-slate-700">{String(m?.responsableSugerido || '')}</td>
                            <td className="py-2 text-slate-700 min-w-[260px]">{String(m?.justificacion || '')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Sin acciones priorizadas disponibles.</p>
                )}
              </ChartCard>

              {analiticOutput.conclusion && (
                <ChartCard title="Conclusion" subtitle="Cierre ejecutivo del analisis IA" span={2}>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{analiticOutput.conclusion}</p>
                </ChartCard>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
