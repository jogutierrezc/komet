// Catálogo de gráficas de Estadística disponibles para Komet Presenta.
// Cada entrada es una especificación de datos (categorías y series), no un componente:
// el mismo formato que usa la canasta de capturas y que pptDeck.js convierte en gráfico nativo.
// Los cálculos usan los mismos ayudantes que Estadística (utils/dataHelpers) y el mismo umbral.
import { UMBRAL_ACEPTABLE, fmtScore } from '../threshold';
import { norm, avg, resolveProgram, normalizeRoleName, getMonthKey } from '../../utils/dataHelpers';

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
const scoreOf = (row) => row.scoreSummary?.globalScore;
const isDone = (row) => row.status === 'Completada';
const programOf = (row) => resolveProgram(row);
const centerOf = (row) => norm(row.center || 'Sin sitio');
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

const scoresOf = (rows) => rows.map(scoreOf).filter((v) => typeof v === 'number');
const meanScore = (rows) => avg(scoresOf(rows));

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

  const total = rows.length;
  const byProgram = groupBy(rows, programOf).filter((g) => g.name !== 'Sin programa').sort((a, b) => b.rows.length - a.rows.length);
  const byCenter = groupBy(rows, centerOf).sort((a, b) => b.rows.length - a.rows.length);
  const byRole = groupBy(rows, roleOf).sort((a, b) => b.rows.length - a.rows.length);
  const topPrograms = byProgram.slice(0, TOP);
  const topCenters = byCenter.slice(0, TOP);
  const rankedPrograms = byProgram.map((g) => ({ ...g, score: meanScore(g.rows) })).filter((g) => g.score > 0).sort((a, b) => b.score - a.score).slice(0, TOP);
  const rankedCenters = byCenter.map((g) => ({ ...g, score: meanScore(g.rows) })).filter((g) => g.score > 0).sort((a, b) => b.score - a.score).slice(0, TOP);

  // ── Participación ──
  const G = (group) => ({ group });
  push({ ...G('participacion'), id: 'participacion-programa', title: 'Participación por programa', subtitle: 'Porcentaje del total de evaluaciones que aporta cada programa', unit: '%',
    ...bar(topPrograms.map((g) => g.name), topPrograms.map((g) => round1((g.rows.length / total) * 100)), '% del total') });
  const studentsByProgram = byProgram
    .map((g) => ({ name: g.name, count: g.rows.filter((r) => isDone(r) && roleOf(r) === 'Estudiantes').length }))
    .filter((g) => g.count > 0).sort((a, b) => b.count - a.count).slice(0, TOP);
  push({ ...G('participacion'), id: 'estudiantes-programa', title: 'Estudiantes que realizaron la evaluación', subtitle: 'Evaluaciones completadas por estudiantes, según programa',
    ...bar(studentsByProgram.map((g) => g.name), studentsByProgram.map((g) => g.count), 'Estudiantes') });
  push({ ...G('participacion'), id: 'programas-realizaron', kind: 'table', title: 'Programas que realizaron la evaluación', subtitle: 'Evaluaciones, completadas, estudiantes y promedio por programa',
    categories: [], series: [],
    table: {
      head: ['Programa', 'Evaluaciones', 'Completadas', 'Estudiantes', 'Promedio'],
      rows: byProgram.slice(0, 20).map((g) => [
        g.name, String(g.rows.length), String(g.rows.filter(isDone).length),
        String(g.rows.filter((r) => isDone(r) && roleOf(r) === 'Estudiantes').length),
        meanScore(g.rows) ? fmtScore(meanScore(g.rows)) : '—',
      ]),
      scoreCol: 4,
    } });
  push({ ...G('participacion'), id: 'cumplimiento-programa', title: 'Cumplimiento por programa', subtitle: 'Porcentaje de evaluaciones completadas en cada programa', unit: '%',
    ...bar(topPrograms.map((g) => g.name), topPrograms.map((g) => round1((g.rows.filter(isDone).length / g.rows.length) * 100)), '% completadas') });

  // ── Resultados ──
  const bins = [['0-2', 0, 2], ['2-3', 2, 3], ['3-4', 3, 4], ['4-5', 4, 6]];
  const scores = scoresOf(rows);
  push({ ...G('resultados'), id: 'dist-calificaciones', title: 'Distribución de calificaciones', subtitle: 'Cuántas respuestas caen en cada rango de puntaje',
    ...bar(bins.map((b) => b[0]), bins.map(([, lo, hi]) => scores.filter((s) => s >= lo && s < hi).length), 'Respuestas') });
  const months = groupBy(rows, (r) => getMonthKey(r.completed_at || r.created_at)).filter((g) => g.name !== 'Sin fecha').sort((a, b) => a.name.localeCompare(b.name));
  if (months.length > 1) {
    push({ ...G('resultados'), id: 'tendencia-mensual', kind: 'line', title: 'Tendencia mensual del puntaje', subtitle: 'Promedio de cada mes frente al umbral aceptable',
      categories: months.map((m) => m.name), series: [{ name: 'Promedio', values: months.map((m) => round2(meanScore(m.rows))) }], threshold: UMBRAL_ACEPTABLE, scoreScale: true });
  }
  const done = rows.filter(isDone).length;
  push({ ...G('resultados'), id: 'estado-evaluaciones', title: 'Estado de las evaluaciones', subtitle: 'Completadas frente a pendientes',
    ...bar(['Completadas', 'Pendientes'], [done, total - done], 'Evaluaciones') });

  // ── Programas ──
  push({ ...G('programas'), id: 'promedio-programa', title: 'Promedio por programa', subtitle: 'Ordenado de mayor a menor frente al umbral',
    kind: 'bar', categories: rankedPrograms.map((g) => g.name), series: [{ name: 'Promedio', values: rankedPrograms.map((g) => round2(g.score)) }], threshold: UMBRAL_ACEPTABLE, scoreScale: true });
  push({ ...G('programas'), id: 'volumen-programa', title: 'Volumen de evaluaciones por programa', subtitle: 'Cantidad de evaluaciones registradas',
    ...bar(topPrograms.map((g) => g.name), topPrograms.map((g) => g.rows.length), 'Evaluaciones') });

  // ── Centros ──
  push({ ...G('centros'), id: 'promedio-centro', title: 'Promedio por centro de práctica', subtitle: 'Ordenado de mayor a menor frente al umbral',
    kind: 'bar', categories: rankedCenters.map((g) => g.name), series: [{ name: 'Promedio', values: rankedCenters.map((g) => round2(g.score)) }], threshold: UMBRAL_ACEPTABLE, scoreScale: true });
  push({ ...G('centros'), id: 'volumen-centro', title: 'Centros con más evaluaciones', subtitle: 'Ranking por volumen de evaluaciones',
    ...bar(topCenters.map((g) => g.name), topCenters.map((g) => g.rows.length), 'Evaluaciones') });
  push({ ...G('centros'), id: 'cumplimiento-centro', title: 'Cumplimiento por centro', subtitle: 'Porcentaje de evaluaciones completadas', unit: '%',
    ...bar(topCenters.map((g) => g.name), topCenters.map((g) => round1((g.rows.filter(isDone).length / g.rows.length) * 100)), '% completadas') });

  // ── Roles ──
  push({ ...G('roles'), id: 'participacion-rol', title: 'Participación por rol evaluador', subtitle: 'Evaluaciones aportadas por cada perfil',
    ...bar(byRole.map((g) => g.name), byRole.map((g) => g.rows.length), 'Evaluaciones') });
  const rankedRoles = byRole.map((g) => ({ ...g, score: meanScore(g.rows) })).filter((g) => g.score > 0).sort((a, b) => b.score - a.score);
  push({ ...G('roles'), id: 'promedio-rol', title: 'Promedio por rol evaluador', subtitle: 'Puntaje promedio de cada perfil',
    kind: 'bar', categories: rankedRoles.map((g) => g.name), series: [{ name: 'Promedio', values: rankedRoles.map((g) => round2(g.score)) }], threshold: UMBRAL_ACEPTABLE, scoreScale: true });

  // ── Centros × programas ──
  const crossPrograms = byProgram.slice(0, 4);
  const crossCenters = byCenter
    .filter((c) => crossPrograms.some((p) => c.rows.some((r) => programOf(r) === p.name && typeof scoreOf(r) === 'number')))
    .slice(0, 8);
  const cell = (center, program) => meanScore(center.rows.filter((r) => programOf(r) === program.name));
  if (crossPrograms.length && crossCenters.length) {
    push({ ...G('cruces'), id: 'centros-por-programa', kind: 'bar', title: 'Puntaje de los centros de práctica por programa',
      subtitle: `Promedio de cada centro desglosado por los ${crossPrograms.length} programas con más evaluaciones`,
      categories: crossCenters.map((c) => c.name),
      series: crossPrograms.map((p) => ({ name: p.name, values: crossCenters.map((c) => round2(cell(c, p))) })),
      threshold: UMBRAL_ACEPTABLE, scoreScale: true });
    push({ ...G('cruces'), id: 'tabla-centros-programa', kind: 'table', title: 'Detalle de centros por programa', subtitle: 'Promedio por combinación centro y programa',
      categories: [], series: [],
      table: {
        head: ['Centro', ...crossPrograms.map((p) => (p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name))],
        rows: byCenter.slice(0, 14).map((c) => [c.name, ...crossPrograms.map((p) => { const v = cell(c, p); return v ? fmtScore(v) : '—'; })]),
      } });
  }

  return out;
}

/** Lista de ids agrupada por tema, en el orden de CHART_GROUPS. */
export function groupCatalog(catalog) {
  return CHART_GROUPS.map((g) => ({ ...g, charts: catalog.filter((c) => c.group === g.id) })).filter((g) => g.charts.length);
}
