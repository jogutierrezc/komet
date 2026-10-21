// Agregaciones de las gráficas de Estadística. Estadística y el catálogo de Komet Presenta llaman a estas mismas
// funciones, así que una cifra nunca puede diferir entre las dos pantallas.
// `rows` son las filas ya filtradas (período, campus, nivel, centro, programa).
import { norm, avg, resolveProgram, getRowCenter } from '../../utils/dataHelpers';
import { UMBRAL_ACEPTABLE } from '../threshold';

const scoreOf = (row) => row.scoreSummary?.globalScore;
const pct = (part, whole) => (whole ? Number(((part / whole) * 100).toFixed(1)) : 0);

export function computeKpis(rows, combine = false) {
  const scores = rows.map(scoreOf).filter((v) => typeof v === 'number');
  const completed = rows.filter((r) => r.status === 'Completada').length;
  return {
    total: rows.length,
    globalScore: avg(scores),
    completionPct: pct(completed, rows.length),
    centers: new Set(rows.map((r) => getRowCenter(r, combine))).size,
    programs: new Set(rows.map((r) => resolveProgram(r)).filter((p) => p !== 'Sin programa')).size,
  };
}

export function computeByProgram(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = resolveProgram(row);
    if (key === 'Sin programa') return;
    const cur = map.get(key) || { name: key, scores: [], total: 0 };
    cur.total += 1;
    const s = scoreOf(row);
    if (typeof s === 'number') cur.scores.push(s);
    map.set(key, cur);
  });
  return [...map.values()]
    .map((d) => ({ name: d.name, score: avg(d.scores), total: d.total }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

export function computeByProgramExtended(rows, combine = false) {
  const map = new Map();
  rows.forEach((row) => {
    const key = resolveProgram(row);
    if (key === 'Sin programa') return;
    const cur = map.get(key) || { name: key, total: 0, completed: 0, scores: [], centers: new Set() };
    cur.total += 1;
    if (row.status === 'Completada') cur.completed += 1;
    cur.centers.add(getRowCenter(row, combine));
    const s = scoreOf(row);
    if (typeof s === 'number') cur.scores.push(s);
    map.set(key, cur);
  });
  return [...map.values()]
    .map((d) => ({
      name: d.name,
      total: d.total,
      score: avg(d.scores),
      completionPct: pct(d.completed, d.total),
      centerCount: d.centers.size,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);
}

export function computeByCenter(rows, combine = false) {
  const map = new Map();
  rows.forEach((row) => {
    const key = getRowCenter(row, combine);
    const cur = map.get(key) || { name: key, scores: [], total: 0, completed: 0 };
    cur.total += 1;
    if (row.status === 'Completada') cur.completed += 1;
    const s = scoreOf(row);
    if (typeof s === 'number') cur.scores.push(s);
    map.set(key, cur);
  });
  return [...map.values()]
    .map((d) => ({ name: d.name, score: avg(d.scores), total: d.total, completionPct: pct(d.completed, d.total) }))
    .sort((a, b) => b.score - a.score);
}

export function computeTopCentersByVolume(byCenter) {
  return [...byCenter].sort((a, b) => b.total - a.total).slice(0, 12).map((d, i) => ({ ...d, rank: i + 1 }));
}

const estado0273 = (score) => (score >= 4.0 ? 'Fortaleza' : score >= 3.7 ? 'Cumple' : score >= 3.2 ? 'Vigilancia' : 'Intervencion');

function rankAgainst(items, globalScore) {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const total = sorted.length || 1;
  return sorted.map((row, idx) => ({
    ...row,
    rank: idx + 1,
    percentile: Number((((total - idx) / total) * 100).toFixed(1)),
    gapToThreshold: Number((row.score - UMBRAL_ACEPTABLE).toFixed(2)),
    gapToGlobal: Number((row.score - globalScore).toFixed(2)),
    estado0273: estado0273(row.score),
  }));
}

export const computeProgramComparison = (byProgramExtended, globalScore) => rankAgainst(byProgramExtended, globalScore);
export const computeCenterComparison = (byCenter, globalScore) => rankAgainst(byCenter, globalScore);

export function computeByRole(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = norm(row.role || 'Sin rol');
    const cur = map.get(key) || { name: key, scores: [], total: 0, completed: 0 };
    cur.total += 1;
    if (row.status === 'Completada') cur.completed += 1;
    const s = scoreOf(row);
    if (typeof s === 'number') cur.scores.push(s);
    map.set(key, cur);
  });
  return [...map.values()]
    .map((d) => ({ name: d.name, score: avg(d.scores), total: d.total, pct: pct(d.total, rows.length) }))
    .sort((a, b) => b.total - a.total);
}

/** Distribución de las puntuaciones por sección, redondeadas a 1–5. */
export function computeHistogram(rows) {
  const counts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  rows.forEach((row) => {
    (row.scoreSummary?.sectionScores || []).forEach((sec) => {
      const r = Math.round(sec.score || 0);
      if (r >= 1 && r <= 5) counts[String(r)] += 1;
    });
  });
  return Object.entries(counts).map(([score, count]) => ({ score, count }));
}

export function computeMonthlyTrend(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const rawDate = row.completed_at || row.created_at;
    if (!rawDate) return;
    const dt = new Date(rawDate);
    if (Number.isNaN(dt.getTime())) return;
    const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const cur = map.get(monthKey) || { monthKey, scores: [], total: 0, completed: 0 };
    cur.total += 1;
    if (row.status === 'Completada') cur.completed += 1;
    const s = scoreOf(row);
    if (typeof s === 'number') cur.scores.push(s);
    map.set(monthKey, cur);
  });
  return [...map.values()]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((d) => ({ month: d.monthKey, score: avg(d.scores), total: d.total, completionPct: pct(d.completed, d.total) }));
}

export function computeFunnel(rows) {
  const total = rows.length;
  const started = rows.filter((r) => r.status !== 'Pendiente').length;
  const completed = rows.filter((r) => r.status === 'Completada').length;
  return [
    { name: 'Asignadas', value: total, fill: '#0F6B68' },
    { name: 'Iniciadas', value: started, fill: '#14b8a6' },
    { name: 'Completadas', value: completed, fill: '#2B827C' },
  ];
}
