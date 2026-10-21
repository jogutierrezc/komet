// Plan de diapositivas de Komet Presenta.
// El plan se arma sin IA a partir de las métricas y de las capturas de Estadística e Informe.
// La IA solo reescribe título, viñetas y nota del orador de cada diapositiva (una llamada, salida validada).
import { UMBRAL_ACEPTABLE, fmtScore, fmtUmbral } from '../lib/threshold';

export const LIMITS = { title: 90, bullet: 140, bullets: 3, notes: 400 };

const clip = (text, max) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/**
 * @param {object} args
 * @param {object} args.metrics   métricas calculadas en KometPresenta
 * @param {object} args.filters   { campus, level, center, program }
 * @param {Array}  args.captures  capturas guardadas en la canasta
 * @param {object} args.narrative narrativa heredada { resumen, hallazgos, riesgos, acciones }
 */
export function buildSlidePlan({ metrics, filters, captures = [], narrative }) {
  const { kpis, distribution, byCenter, byProgram, byRole, monthly, centerAnalysis } = metrics;
  const slides = [];
  const add = (slide) => slides.push({ include: true, notes: '', bullets: [], ...slide });

  const filtersLine = [
    filters.period && filters.period !== 'Todos' ? `Período ${filters.period}` : 'Todos los períodos',
    filters.campus !== 'Todos' ? filters.campus : 'Todas las sedes',
    filters.level !== 'Todos' ? filters.level : 'Pregrado y posgrado',
    filters.center !== 'Todos' ? filters.center : 'Todos los centros',
    filters.program !== 'Todos' ? filters.program : 'Todos los programas',
  ].join(' · ');

  add({
    id: 'portada',
    type: 'cover',
    section: 'Inicio',
    title: 'Evaluación de sitios de práctica',
    subtitle: `${filtersLine} · ${kpis.total} evaluaciones`,
  });

  const below = byCenter.filter((c) => c.score < UMBRAL_ACEPTABLE);
  add({
    id: 'resumen',
    type: 'stat',
    section: 'Resumen',
    title: kpis.globalScore >= UMBRAL_ACEPTABLE
      ? `El puntaje global es ${fmtScore(kpis.globalScore)} y supera el umbral de ${fmtUmbral()}`
      : `El puntaje global es ${fmtScore(kpis.globalScore)} y queda bajo el umbral de ${fmtUmbral()}`,
    stat: { value: fmtScore(kpis.globalScore), unit: '/ 5,0' },
    bullets: [
      `${kpis.total} evaluaciones, ${kpis.completionPct.toFixed(1).replace('.', ',')} % completadas`,
      below.length ? `${below.length} de ${byCenter.length} centros quedan bajo el umbral` : 'Ningún centro queda bajo el umbral',
      metrics.topCenter && metrics.lowCenter ? `Brecha entre el mejor y el menor centro: ${fmtScore(metrics.topCenter.score - metrics.lowCenter.score)} puntos` : '',
    ].filter(Boolean),
  });

  const scored = distribution.reduce((s, d) => s + d.count, 0);
  const high = distribution[distribution.length - 1]?.count || 0;
  add({
    id: 'distribucion',
    type: 'chart',
    section: 'Resultados',
    title: `${pct(high, scored)} % de las respuestas puntúa 4,0 o más`,
    chart: { kind: 'bar', categories: distribution.map((d) => d.label), series: [{ name: 'Respuestas', values: distribution.map((d) => d.count) }], threshold: null, scoreScale: false },
    bullets: distribution.map((d) => `${d.count} respuestas entre ${d.label.replace('-', ' y ')}`).slice(0, 3),
  });

  if (monthly.length > 1) {
    const first = monthly[0];
    const last = monthly[monthly.length - 1];
    add({
      id: 'tendencia',
      type: 'chart',
      section: 'Resultados',
      title: `El puntaje promedio va ${metrics.trendDirection}: de ${fmtScore(first.score)} a ${fmtScore(last.score)}`,
      chart: { kind: 'line', categories: monthly.map((m) => m.name), series: [{ name: 'Promedio', values: monthly.map((m) => Number(m.score.toFixed(2))) }], threshold: UMBRAL_ACEPTABLE, scoreScale: true },
      bullets: [`Periodo: ${metrics.dateRange}`],
    });
  }

  if (byCenter.length) {
    const top = byCenter.slice(0, 10);
    add({
      id: 'centros',
      type: 'chart',
      section: 'Sitios de práctica',
      title: below.length
        ? `${below.length === 1 ? 'Un centro está' : `${below.length} centros están`} por debajo del umbral`
        : 'Todos los centros superan el umbral',
      chart: { kind: 'bar', categories: top.map((c) => c.name), series: [{ name: 'Promedio', values: top.map((c) => Number(c.score.toFixed(2))) }], threshold: UMBRAL_ACEPTABLE, scoreScale: true },
      bullets: [
        metrics.topCenter ? `Mayor puntaje: ${metrics.topCenter.name} (${fmtScore(metrics.topCenter.score)})` : '',
        metrics.lowCenter ? `Menor puntaje: ${metrics.lowCenter.name} (${fmtScore(metrics.lowCenter.score)})` : '',
      ].filter(Boolean),
    });
  }

  if (centerAnalysis?.length) {
    add({
      id: 'tabla-centros',
      type: 'table',
      section: 'Sitios de práctica',
      title: 'Detalle por centro y por rol evaluador',
      table: {
        head: ['Centro', 'Respuestas', 'Promedio', 'Estudiantes', 'Docentes', 'Coordinadores'],
        rows: centerAnalysis.slice(0, 16).map((c) => [
          c.name,
          String(c.total),
          fmtScore(c.score),
          c.byRole?.Estudiantes?.score ? fmtScore(c.byRole.Estudiantes.score) : '—',
          c.byRole?.Docentes?.score ? fmtScore(c.byRole.Docentes.score) : '—',
          c.byRole?.Coordinadores?.score ? fmtScore(c.byRole.Coordinadores.score) : '—',
        ]),
        scoreCol: 2,
      },
    });
  }

  if (byProgram.length) {
    const top = byProgram.slice(0, 10);
    add({
      id: 'programas',
      type: 'chart',
      section: 'Programas',
      title: metrics.topProgram ? `${metrics.topProgram.name} lidera entre los programas` : 'Promedio por programa',
      chart: { kind: 'bar', categories: top.map((p) => p.name), series: [{ name: 'Promedio', values: top.map((p) => Number(p.score.toFixed(2))) }], threshold: UMBRAL_ACEPTABLE, scoreScale: true },
      bullets: metrics.lowProgram ? [`Menor puntaje: ${metrics.lowProgram.name} (${fmtScore(metrics.lowProgram.score)})`] : [],
    });
  }

  if (byRole.length) {
    const scores = byRole.map((r) => r.score);
    add({
      id: 'roles',
      type: 'figures',
      section: 'Percepción',
      title: `Por rol, el puntaje va de ${fmtScore(Math.min(...scores))} a ${fmtScore(Math.max(...scores))}`,
      figures: byRole.slice(0, 4).map((r) => ({ label: r.name, value: fmtScore(r.score), note: `${r.total} respuestas` })),
    });
  }

  // Capturas que el usuario eligió en Estadística o Informe (se omiten las que ya tienen diapositiva automática).
  const AUTO_COVERED = new Set(['dist-calificaciones', 'promedio-centro', 'tendencia-mensual', 'promedio-programa', 'informe-centros', 'informe-programas', 'informe-resumen']);
  captures.filter((c) => !AUTO_COVERED.has(c.id)).forEach((c) => {
    if (c.kind === 'table') {
      add({ id: `cap-${c.id}`, type: 'table', section: 'Capturas', title: c.title, table: { head: ['Elemento', ...c.series.map((s) => s.name)], rows: c.categories.map((cat, i) => [cat, ...c.series.map((s) => String(s.values[i] ?? ''))]) } });
    } else if (c.kind === 'bar' || c.kind === 'line') {
      add({ id: `cap-${c.id}`, type: 'chart', section: 'Capturas', title: c.title, chart: { kind: c.kind, categories: c.categories, series: c.series, threshold: c.threshold, scoreScale: c.threshold != null } });
    }
  });

  if (narrative?.hallazgos?.length || narrative?.riesgos?.length) {
    add({
      id: 'hallazgos',
      type: 'columns',
      section: 'Conclusiones',
      title: 'Hallazgos y riesgos principales',
      columns: [
        { heading: 'Hallazgos', items: (narrative.hallazgos || []).slice(0, 4).map((t) => clip(t, 160)) },
        { heading: 'Riesgos', items: (narrative.riesgos || []).slice(0, 4).map((t) => clip(t, 160)) },
      ],
    });
  }
  if (narrative?.acciones?.length) {
    add({
      id: 'acciones',
      type: 'bullets',
      section: 'Conclusiones',
      title: 'Acciones priorizadas',
      bullets: narrative.acciones.slice(0, 5).map((t) => clip(t, 160)),
    });
  }

  return slides;
}

/** Prompt compacto: pide solo lo que cabe en una diapositiva. */
export function buildSlideNarrativePrompt(plan, { metrics, filters }) {
  const slides = plan.filter((s) => s.include && s.type !== 'cover').map((s) => ({
    id: s.id,
    tipo: s.type,
    titulo_actual: s.title,
    datos: s.chart
      ? s.chart.categories.slice(0, 10).map((c, i) => `${c}: ${s.chart.series[0].values[i]}`)
      : s.table ? s.table.rows.slice(0, 8).map((r) => r.join(' | '))
      : s.figures ? s.figures.map((f) => `${f.label}: ${f.value} (${f.note})`)
      : s.bullets,
  }));
  return [
    'Redacta el texto de una presentación ejecutiva sobre evaluación de sitios de práctica (relación docencia-servicio).',
    `Escala de 1,0 a 5,0. Umbral mínimo aceptable: ${fmtUmbral()}. Filtros: ${JSON.stringify(filters)}.`,
    `Puntaje global ${fmtScore(metrics.kpis.globalScore)}, ${metrics.kpis.total} evaluaciones.`,
    `Para cada diapositiva devuelve: "title" que diga la conclusión (máx. ${LIMITS.title} caracteres, sin punto final), "bullets" (máx. ${LIMITS.bullets}, cada una de máx. ${LIMITS.bullet} caracteres, con cifras de los datos) y "notes" (nota del orador, máx. ${LIMITS.notes} caracteres).`,
    'No inventes cifras: usa solo las que aparecen en los datos.',
    'Además devuelve "resumen" (3 líneas), "hallazgos", "riesgos" y "acciones" (hasta 5 frases cortas cada una).',
    'Responde ÚNICAMENTE con JSON: {"slides":[{"id":"","title":"","bullets":[""],"notes":""}],"resumen":"","hallazgos":[""],"riesgos":[""],"acciones":[""]}',
    '',
    'DIAPOSITIVAS:',
    JSON.stringify(slides),
  ].join('\n');
}

/** Valida y recorta la salida del modelo; ignora cualquier id que no esté en el plan. */
export function parseSlideNarrative(raw, plan) {
  const text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || text;
  const a = candidate.indexOf('{');
  const b = candidate.lastIndexOf('}');
  let parsed;
  try {
    parsed = JSON.parse(a >= 0 && b > a ? candidate.slice(a, b + 1) : candidate);
  } catch {
    return { slides: {}, legacy: null };
  }
  const ids = new Set(plan.map((s) => s.id));
  const slides = {};
  (Array.isArray(parsed?.slides) ? parsed.slides : []).forEach((s) => {
    if (!s || !ids.has(s.id)) return;
    slides[s.id] = {
      title: s.title ? clip(String(s.title).replace(/[.\s]+$/, ''), LIMITS.title) : undefined,
      bullets: Array.isArray(s.bullets) ? s.bullets.map((b) => clip(b, LIMITS.bullet)).filter(Boolean).slice(0, LIMITS.bullets) : undefined,
      notes: s.notes ? clip(s.notes, LIMITS.notes) : undefined,
    };
  });
  const list = (v) => (Array.isArray(v) ? v.map((x) => clip(x, 220)).filter(Boolean).slice(0, 5) : []);
  const legacy = {
    resumen: clip(parsed?.resumen || '', 600),
    analisis_completo: '',
    hallazgos: list(parsed?.hallazgos),
    riesgos: list(parsed?.riesgos),
    acciones: list(parsed?.acciones),
  };
  return { slides, legacy };
}

/** Aplica la narrativa al plan sin pisar lo que el usuario ya editó a mano. */
export function applySlideNarrative(plan, slideTexts) {
  return plan.map((s) => {
    const t = slideTexts[s.id];
    if (!t || s.edited) return s;
    return {
      ...s,
      title: t.title || s.title,
      bullets: t.bullets && t.bullets.length && s.type !== 'columns' ? t.bullets : s.bullets,
      notes: t.notes ?? s.notes,
    };
  });
}

export function planFingerprint(plan, filters, kpis) {
  const base = JSON.stringify({ filters, total: kpis.total, score: Number(kpis.globalScore.toFixed(3)), ids: plan.filter((s) => s.include).map((s) => s.id) });
  let h = 5381;
  for (let i = 0; i < base.length; i += 1) h = ((h << 5) + h + base.charCodeAt(i)) | 0;
  return String(h);
}
