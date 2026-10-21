// Catálogo de gráficas de Estadística disponibles para Komet Presenta.
// Cada entrada es una especificación de datos (categorías y series), no un componente:
// el mismo formato que usa la canasta de capturas y que pptDeck.js convierte en gráfico nativo.
// Los números salen de las mismas funciones que Estadística (aggregations.js y utils/dataHelpers), no de una copia.
import { UMBRAL_ACEPTABLE, fmtScore } from '../threshold';
import { norm, resolveProgram, normalizeRoleName, calculateCenterAnalysis, calculateCrossMatrix } from '../../utils/dataHelpers';
import {
  computeKpis, computeByProgram, computeByProgramExtended, computeByCenter, computeTopCentersByVolume,
  computeByRole, computeHistogram, computeMonthlyTrend, computeFunnel,
} from './aggregations';

export const CHART_GROUPS = [
  { id: 'participacion', label: 'Participación' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'programas', label: 'Programas' },
  { id: 'centros', label: 'Centros de práctica' },
  { id: 'roles', label: 'Roles evaluadores' },
  { id: 'cruces', label: 'Centros por programa' },
];

// Las que el usuario pidió como mínimo: participación, estudiantes, programas, promedios y centros por programa.
export const ESSENTIAL_CHART_IDS = [
  'participacion-programa',
  'estudiantes-programa',
  'programas-realizaron',
  'promedio-programa',
  'centros-por-programa',
];

const TOP = 10;
const round1 = (n) => Number(Number(n).toFixed(1));
const round2 = (n) => Number(Number(n).toFixed(2));
const isDone = (row) => row.status === 'Completada';
const programOf = (row) => resolveProgram(row);
const roleOf = (row) => normalizeRoleName(norm(row.role || 'Sin definir'));

function groupBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return [...map.entries()].map(([name, items]) => ({ name, rows: items }));
}

/** Resume una gráfica en un título-mensaje y viñetas con cifras reales (sirve de texto si la IA no responde). */
function describe(spec) {
  const { kind, categories, series } = spec;
  const fmt = (v) => (spec.scoreScale ? fmtScore(v) : spec.unit === '%' ? `${String(round1(v)).replace('.', ',')} %` : String(v));
  if (kind === 'table') return { title: spec.title, bullets: [`${spec.table.rows.length} filas en la tabla`] };
  const values = series[0]?.values || [];
  if (!values.length) return { title: spec.title, bullets: [] };
  if (kind === 'line') {
    const first = values[0];
    const last = values[values.length - 1];
    return {
      title: `${spec.title}: de ${fmt(first)} a ${fmt(last)}`,
      bullets: [`Primer corte (${categories[0]}): ${fmt(first)}`, `Último corte (${categories[categories.length - 1]}): ${fmt(last)}`],
    };
  }
  if (series.length > 1) return { title: spec.title, bullets: [`Comparativo de ${series.length} series en ${categories.length} categorías`] };
  const order = values.map((v, i) => i).sort((a, b) => values[b] - values[a]);
  const top = order[0];
  const low = order[order.length - 1];
  const bullets = [`Mayor: ${categories[top]} (${fmt(values[top])})`];
  if (order.length > 1) bullets.push(`Menor: ${categories[low]} (${fmt(values[low])})`);
  if (spec.scoreScale) {
    const below = values.filter((v) => v < UMBRAL_ACEPTABLE).length;
    bullets.push(below ? `${below} de ${values.length} quedan bajo el umbral` : 'Todas superan el umbral');
  }
  return { title: `${spec.title}: ${categories[top]} ${spec.scoreScale ? "lidera" : "destaca"} con ${fmt(values[top])}`, bullets };
}

function bar(categories, values, seriesName = 'Valor') {
  return { kind: 'bar', categories, series: [{ name: seriesName, values }], threshold: null, scoreScale: false };
}

/**
 * @param {Array} rows filas de evaluación ya filtradas por período, campus, nivel, centro y programa
 * @returns {Array} gráficas con datos; las que no tienen datos suficientes se omiten
 */
export function buildChartCatalog(rows = []) {
  if (!rows.length) return [];
  const out = [];
  // El título y las viñetas automáticos se guardan aparte para no pisar el título del catálogo.
  const push = (spec) => {
    const hasData = spec.kind === 'table' ? spec.table.rows.length > 0 : spec.categories.length > 0;
    if (!hasData) return;
    const { title: autoTitle, bullets: autoBullets } = describe(spec);
    const groupLabel = CHART_GROUPS.find((g) => g.id === spec.group)?.label;
    out.push({ ...spec, groupLabel, autoTitle, autoBullets });
  };

  const kpis = computeKpis(rows);
  const byProgramExt = computeByProgramExtended(rows); // por volumen
  const byProgramScore = computeByProgram(rows).filter((g) => g.score > 0).slice(0, TOP); // por puntaje
  const byCenter = computeByCenter(rows); // por puntaje
  const topCenters = computeTopCentersByVolume(byCenter).slice(0, TOP);
  const byRole = computeByRole(rows);
  const topPrograms = byProgramExt.slice(0, TOP);
  const G = (group) => ({ group });

  // ── Participación ──
  push({ ...G('participacion'), id: 'participacion-programa', title: 'Participación por programa', subtitle: 'Porcentaje del total de evaluaciones que aporta cada programa', unit: '%',
    ...bar(topPrograms.map((g) => g.name), topPrograms.map((g) => round1((g.total / kpis.total) * 100)), '% del total') });
  const studentsByProgram = groupBy(rows.filter((r) => isDone(r) && roleOf(r) === 'Estudiantes'), programOf)
    .filter((g) => g.name !== 'Sin programa')
    .map((g) => ({ name: g.name, count: g.rows.length })).sort((a, b) => b.count - a.count).slice(0, TOP);
  push({ ...G('participacion'), id: 'estudiantes-programa', title: 'Estudiantes que realizaron la evaluación', subtitle: 'Evaluaciones completadas por estudiantes, según programa',
    ...bar(studentsByProgram.map((g) => g.name), studentsByProgram.map((g) => g.count), 'Estudiantes') });
  push({ ...G('participacion'), id: 'programas-realizaron', kind: 'table', title: 'Programas que realizaron la evaluación', subtitle: 'Evaluaciones, cumplimiento, centros y promedio por programa',
    categories: [], series: [],
    table: {
      head: ['Programa', 'Evaluaciones', 'Cumplimiento', 'Centros', 'Promedio'],
      rows: byProgramExt.map((g) => [g.name, String(g.total), `${String(g.completionPct).replace('.', ',')} %`, String(g.centerCount), g.score ? fmtScore(g.score) : '—']),
      scoreCol: 4,
    } });
  push({ ...G('participacion'), id: 'cumplimiento-programa', title: 'Cumplimiento por programa', subtitle: 'Porcentaje de evaluaciones completadas en cada programa', unit: '%',
    ...bar(topPrograms.map((g) => g.name), topPrograms.map((g) => g.completionPct), '% completadas') });

  // ── Resultados ──
  const histogram = computeHistogram(rows);
  push({ ...G('resultados'), id: 'dist-calificaciones', title: 'Distribución de calificaciones', subtitle: 'Cuántas puntuaciones por sección caen en cada nota de 1 a 5',
    ...bar(histogram.map((h) => h.score), histogram.map((h) => h.count), 'Puntuaciones') });
  const trend = computeMonthlyTrend(rows);
  if (trend.length > 1) {
    push({ ...G('resultados'), id: 'tendencia-mensual', kind: 'line', title: 'Tendencia mensual del puntaje', subtitle: 'Promedio de cada mes frente al umbral aceptable',
      categories: trend.map((m) => m.month), series: [{ name: 'Promedio', values: trend.map((m) => m.score) }], threshold: UMBRAL_ACEPTABLE, scoreScale: true });
  }
  const funnel = computeFunnel(rows);
  push({ ...G('resultados'), id: 'estado-evaluaciones', title: 'Avance de las evaluaciones', subtitle: 'Asignadas, iniciadas y completadas',
    ...bar(funnel.map((f) => f.name), funnel.map((f) => f.value), 'Evaluaciones') });

  // ── Programas ──
  push({ ...G('programas'), id: 'promedio-programa', title: 'Promedio por programa', subtitle: 'Ordenado de mayor a menor frente al umbral',
    kind: 'bar', categories: byProgramScore.map((g) => g.name), series: [{ name: 'Promedio', values: byProgramScore.map((g) => g.score) }], threshold: UMBRAL_ACEPTABLE, scoreScale: true });
  push({ ...G('programas'), id: 'volumen-programa', title: 'Volumen de evaluaciones por programa', subtitle: 'Cantidad de evaluaciones registradas',
    ...bar(topPrograms.map((g) => g.name), topPrograms.map((g) => g.total), 'Evaluaciones') });

  // ── Centros ──
  const rankedCenters = byCenter.filter((g) => g.score > 0).slice(0, TOP);
  push({ ...G('centros'), id: 'promedio-centro', title: 'Promedio por centro de práctica', subtitle: 'Ordenado de mayor a menor frente al umbral',
    kind: 'bar', categories: rankedCenters.map((g) => g.name), series: [{ name: 'Promedio', values: rankedCenters.map((g) => g.score) }], threshold: UMBRAL_ACEPTABLE, scoreScale: true });
  push({ ...G('centros'), id: 'volumen-centro', title: 'Centros con más evaluaciones', subtitle: 'Ranking por volumen de evaluaciones',
    ...bar(topCenters.map((g) => g.name), topCenters.map((g) => g.total), 'Evaluaciones') });
  push({ ...G('centros'), id: 'cumplimiento-centro', title: 'Cumplimiento por centro', subtitle: 'Porcentaje de evaluaciones completadas', unit: '%',
    ...bar(topCenters.map((g) => g.name), topCenters.map((g) => g.completionPct), '% completadas') });

  // ── Roles ──
  push({ ...G('roles'), id: 'participacion-rol', title: 'Participación por rol evaluador', subtitle: 'Evaluaciones aportadas por cada perfil',
    ...bar(byRole.map((g) => g.name), byRole.map((g) => g.total), 'Evaluaciones') });
  const rankedRoles = byRole.filter((g) => g.score > 0).sort((a, b) => b.score - a.score);
  push({ ...G('roles'), id: 'promedio-rol', title: 'Promedio por rol evaluador', subtitle: 'Puntaje promedio de cada perfil',
    kind: 'bar', categories: rankedRoles.map((g) => g.name), series: [{ name: 'Promedio', values: rankedRoles.map((g) => g.score) }], threshold: UMBRAL_ACEPTABLE, scoreScale: true });

  // ── Centros × programas (la misma matriz de Estadística) ──
  const { allCenters, matrix } = calculateCrossMatrix(calculateCenterAnalysis(rows));
  const crossPrograms = topPrograms.slice(0, 4).map((g) => g.name);
  const cellScore = (center, program) => matrix[center]?.[program]?.score || 0;
  const crossCenters = allCenters.filter((c) => crossPrograms.some((p) => cellScore(c, p) > 0)).slice(0, 8);
  if (crossPrograms.length && crossCenters.length) {
    push({ ...G('cruces'), id: 'centros-por-programa', kind: 'bar', title: 'Puntaje de los centros de práctica por programa',
      subtitle: `Promedio de cada centro desglosado por los ${crossPrograms.length} programas con más evaluaciones`,
      categories: crossCenters,
      series: crossPrograms.map((p) => ({ name: p, values: crossCenters.map((c) => round2(cellScore(c, p))) })),
      threshold: UMBRAL_ACEPTABLE, scoreScale: true });
    push({ ...G('cruces'), id: 'tabla-centros-programa', kind: 'table', title: 'Detalle de centros por programa', subtitle: 'Promedio por combinación centro y programa',
      categories: [], series: [],
      table: {
        head: ['Centro', ...crossPrograms.map((p) => (p.length > 22 ? `${p.slice(0, 21)}…` : p))],
        rows: allCenters.slice(0, 14).map((c) => [c, ...crossPrograms.map((p) => { const v = cellScore(c, p); return v ? fmtScore(v) : '—'; })]),
      } });
  }

  return out;
}

/** Lista de ids agrupada por tema, en el orden de CHART_GROUPS. */
export function groupCatalog(catalog) {
  return CHART_GROUPS.map((g) => ({ ...g, charts: catalog.filter((c) => c.group === g.id) })).filter((g) => g.charts.length);
}
