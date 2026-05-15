import { useEffect, useMemo, useState } from 'react';
import PptxGenJS from 'pptxgenjs';
import { Loader2, Presentation, Sparkles, Download } from 'lucide-react';
import {
  getEvaluationReportMetrics,
  getSystemSettings,
  runOpenRouterPrompt,
  OPENROUTER_FREE_MODELS
} from '../lib/data';

const LEVEL_WORDS = new Set(['pregrado', 'posgrado', 'postgrado']);

function norm(value) {
  return String(value || '').trim();
}

function avg(values = []) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, item) => sum + item, 0) / values.length).toFixed(2));
}

function stdDev(values = []) {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Number(Math.sqrt(variance).toFixed(2));
}

function resolveProgram(row = {}) {
  const fromAnswers = norm(
    row.rawAnswers?._publicRespondent?.program ||
      row.rawAnswers?.program ||
      row.rawAnswers?.programa ||
      ''
  );
  if (fromAnswers && !LEVEL_WORDS.has(fromAnswers.toLowerCase())) return fromAnswers;

  const fromRow = norm(row.program || '');
  if (fromRow && !LEVEL_WORDS.has(fromRow.toLowerCase())) return fromRow;

  return 'Sin programa';
}

function resolveLevel(row = {}) {
  const raw = String(
    row.rawAnswers?._publicRespondent?.program_level ||
      row.rawAnswers?.program_level ||
      ''
  )
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (raw.startsWith('pre')) return 'pregrado';
  if (raw.startsWith('pos')) return 'posgrado';
  return '';
}

function formatPct(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatFilters({ campus, level, center, program }) {
  return [
    `Campus: ${campus}`,
    `Nivel: ${level}`,
    `Centro: ${center}`,
    `Programa: ${program}`
  ].join(' | ');
}

function parseAiPayload(rawText = '') {
  const fallback = {
    resumen: 'No fue posible construir narrativa IA en este momento. Se usaron hallazgos automáticos.',
    hallazgos: [],
    riesgos: [],
    acciones: []
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
      resumen: String(parsed?.resumen || fallback.resumen),
      hallazgos: Array.isArray(parsed?.hallazgos) ? parsed.hallazgos.map(String) : [],
      riesgos: Array.isArray(parsed?.riesgos) ? parsed.riesgos.map(String) : [],
      acciones: Array.isArray(parsed?.acciones) ? parsed.acciones.map(String) : []
    };
  } catch {
    return {
      ...fallback,
      resumen: text.slice(0, 800)
    };
  }
}

function buildNarrativeFallback(metrics) {
  const hallazgos = [
    `Promedio global del periodo: ${metrics.kpis.globalScore.toFixed(2)} sobre 5.`,
    `Cobertura de respuesta: ${formatPct(metrics.kpis.completionPct)} (${metrics.kpis.completed}/${metrics.kpis.total}).`,
    metrics.topCenter
      ? `Centro con mejor promedio: ${metrics.topCenter.name} (${metrics.topCenter.score.toFixed(2)}).`
      : 'No hay centros suficientes para ranking comparativo.',
    metrics.topProgram
      ? `Programa con mejor promedio: ${metrics.topProgram.name} (${metrics.topProgram.score.toFixed(2)}).`
      : 'No hay programas suficientes para ranking comparativo.'
  ].filter(Boolean);

  const riesgos = [
    metrics.lowCenter
      ? `Brecha de desempeno: ${metrics.lowCenter.name} presenta el promedio mas bajo (${metrics.lowCenter.score.toFixed(2)}).`
      : '',
    metrics.kpis.completionPct < 70
      ? 'La cobertura de evaluaciones es inferior al 70%, lo cual puede sesgar el analisis.'
      : '',
    metrics.variability > 0.9
      ? `Alta dispersión de calificaciones (desv. estandar ${metrics.variability.toFixed(2)}).`
      : 'Dispersión estable de resultados.'
  ].filter(Boolean);

  const acciones = [
    'Priorizar acompanamiento metodologico en los centros con promedio inferior a 3.5.',
    'Ejecutar plan de cierre de evaluaciones pendientes por programa y rol.',
    'Repetir este corte quincenalmente para monitorear mejora continua.'
  ];

  return {
    resumen: `Reporte ejecutivo para ${metrics.kpis.total} evaluaciones filtradas. El promedio general es ${metrics.kpis.globalScore.toFixed(2)} con tendencia ${metrics.trendDirection}.`,
    hallazgos,
    riesgos,
    acciones
  };
}

function rankBy(rows, keyGetter, scoreGetter) {
  const map = new Map();

  rows.forEach((row) => {
    const name = keyGetter(row);
    const score = scoreGetter(row);
    if (!name) return;

    const entry = map.get(name) || { name, total: 0, completed: 0, scores: [] };
    entry.total += 1;
    if (row.status === 'Completada') entry.completed += 1;
    if (typeof score === 'number') entry.scores.push(score);
    map.set(name, entry);
  });

  return [...map.values()]
    .map((item) => ({
      ...item,
      score: avg(item.scores),
      completionPct: item.total ? Number(((item.completed / item.total) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.score - a.score);
}

function getMonthKey(dateValue) {
  const date = dateValue ? new Date(dateValue) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Sin fecha';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shortList(items = [], max = 5) {
  return items.slice(0, max).map((item) => `• ${item}`);
}

function addSlideHeader(slide, title, subtitle) {
  slide.addText('Komet Presenta', { x: 0.5, y: 0.2, w: 3, h: 0.3, fontSize: 11, color: '2563EB', bold: true });
  slide.addShape(PptxGenJS.ShapeType.line, {
    x: 0.5,
    y: 0.58,
    w: 12.2,
    h: 0,
    line: { color: 'E2E8F0', pt: 1 }
  });
  slide.addText(title, { x: 0.5, y: 0.7, w: 12.2, h: 0.5, fontSize: 24, bold: true, color: '0F172A' });
  if (subtitle) {
    slide.addText(subtitle, { x: 0.5, y: 1.2, w: 12.2, h: 0.45, fontSize: 12, color: '475569' });
  }
}

function addFooter(slide, footerText) {
  slide.addText(footerText, { x: 0.5, y: 6.9, w: 12.2, h: 0.3, fontSize: 9, color: '64748B', align: 'right' });
}

function addBulletBlock(slide, x, y, w, h, title, lines = []) {
  slide.addShape(PptxGenJS.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    line: { color: 'DBEAFE', pt: 1 },
    fill: { color: 'F8FAFF' },
    radius: 0.08
  });
  slide.addText(title, { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.3, fontSize: 14, bold: true, color: '1D4ED8' });
  slide.addText(lines.join('\n') || '• Sin datos suficientes', {
    x: x + 0.2,
    y: y + 0.52,
    w: w - 0.4,
    h: h - 0.65,
    fontSize: 11,
    color: '0F172A',
    breakLine: true,
    valign: 'top'
  });
}

function addTableLikeList(slide, startY, rows, headers) {
  slide.addShape(PptxGenJS.ShapeType.rect, {
    x: 0.5,
    y: startY,
    w: 12.2,
    h: 0.4,
    line: { color: 'CBD5E1', pt: 1 },
    fill: { color: 'EFF6FF' }
  });

  const colW = [5.5, 2.2, 2.2, 2.3];
  let x = 0.6;
  headers.forEach((head, index) => {
    slide.addText(head, { x, y: startY + 0.08, w: colW[index], h: 0.25, fontSize: 11, bold: true, color: '1E3A8A' });
    x += colW[index];
  });

  rows.slice(0, 8).forEach((row, idx) => {
    const y = startY + 0.45 + idx * 0.48;
    slide.addShape(PptxGenJS.ShapeType.rect, {
      x: 0.5,
      y,
      w: 12.2,
      h: 0.44,
      line: { color: 'E2E8F0', pt: 1 },
      fill: { color: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }
    });
    let rowX = 0.6;
    [row.name, String(row.total), row.score.toFixed(2), formatPct(row.completionPct)].forEach((cell, cellIdx) => {
      slide.addText(cell, { x: rowX, y: y + 0.1, w: colW[cellIdx], h: 0.25, fontSize: 10.5, color: '0F172A' });
      rowX += colW[cellIdx];
    });
  });
}

function createPresentationDeck({ filters, metrics, narrative }) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Komet';
  pptx.company = 'Komet';
  pptx.subject = 'Reporte dinamico de evaluaciones';
  pptx.title = 'Komet Presenta';
  pptx.lang = 'es-CO';

  const stamp = new Date().toLocaleString('es-CO');
  const footer = `Generado por Komet Presenta | ${stamp}`;
  const filtersText = formatFilters(filters);

  // 1. Portada
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'EFF6FF' };
    slide.addShape(PptxGenJS.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.33,
      h: 1.7,
      fill: { color: '1D4ED8' },
      line: { color: '1D4ED8', pt: 0 }
    });
    slide.addText('Komet Presenta', { x: 0.7, y: 0.45, w: 6, h: 0.6, fontSize: 32, bold: true, color: 'FFFFFF' });
    slide.addText('Presentacion ejecutiva automatizada', { x: 0.7, y: 1.95, w: 8, h: 0.4, fontSize: 17, color: '1E293B' });
    slide.addText(filtersText, { x: 0.7, y: 2.45, w: 12, h: 0.5, fontSize: 12, color: '334155' });
    slide.addText(`Cobertura: ${metrics.kpis.total} evaluaciones`, { x: 0.7, y: 2.95, w: 6, h: 0.4, fontSize: 12, color: '334155' });
    slide.addText(narrative.resumen, { x: 0.7, y: 3.55, w: 12, h: 2.5, fontSize: 15, color: '0F172A', breakLine: true });
    addFooter(slide, footer);
  }

  // 2. Agenda
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Agenda Ejecutiva', 'Secuencia estandar de 15 diapositivas para seguimiento institucional');
    slide.addText(
      [
        '1. Contexto y filtros aplicados',
        '2. KPIs globales y distribucion de puntajes',
        '3. Comparativos por campus, centro, programa y rol',
        '4. Tendencia temporal y desempeno por encuesta',
        '5. Hallazgos, riesgos y plan de accion recomendado'
      ].join('\n'),
      { x: 0.9, y: 2.0, w: 11.8, h: 3.8, fontSize: 18, color: '0F172A', breakLine: true }
    );
    addFooter(slide, footer);
  }

  // 3. Filtros y alcance
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Alcance del Corte', 'Filtros dinamicos aplicados al dataset');
    addBulletBlock(slide, 0.7, 1.9, 12, 3.6, 'Filtros activos', shortList([
      `Campus: ${filters.campus}`,
      `Nivel: ${filters.level}`,
      `Centro: ${filters.center}`,
      `Programa: ${filters.program}`,
      `Rango observado: ${metrics.dateRange}`
    ], 5));
    addFooter(slide, footer);
  }

  // 4. KPIs principales
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'KPIs Principales', 'Indicadores de nivel directivo');

    const cards = [
      ['Evaluaciones', String(metrics.kpis.total)],
      ['Completadas', String(metrics.kpis.completed)],
      ['Cumplimiento', formatPct(metrics.kpis.completionPct)],
      ['Promedio global', metrics.kpis.globalScore.toFixed(2)],
      ['Programas', String(metrics.kpis.programs)],
      ['Centros', String(metrics.kpis.centers)]
    ];

    cards.forEach((card, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 0.7 + col * 4.1;
      const y = 1.8 + row * 2.2;
      slide.addShape(PptxGenJS.ShapeType.roundRect, {
        x,
        y,
        w: 3.8,
        h: 1.8,
        line: { color: 'DBEAFE', pt: 1 },
        fill: { color: 'F8FAFF' },
        radius: 0.08
      });
      slide.addText(card[0], { x: x + 0.2, y: y + 0.2, w: 3.4, h: 0.35, fontSize: 12, color: '475569' });
      slide.addText(card[1], { x: x + 0.2, y: y + 0.72, w: 3.4, h: 0.7, fontSize: 28, bold: true, color: '1E3A8A' });
    });

    addFooter(slide, footer);
  }

  // 5. Distribucion de puntajes
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Distribucion de Puntajes', 'Frecuencia por rangos de calificacion global');
    const distributionLines = metrics.distribution.map((item) => `• Rango ${item.label}: ${item.count} evaluaciones`);
    addBulletBlock(slide, 0.7, 1.8, 5.8, 4.8, 'Distribucion', distributionLines);
    addBulletBlock(slide, 6.8, 1.8, 5.9, 4.8, 'Lectura ejecutiva', shortList([
      `Puntaje promedio: ${metrics.kpis.globalScore.toFixed(2)}`,
      `Desviacion estandar: ${metrics.variability.toFixed(2)}`,
      metrics.variability > 0.9 ? 'Existe alta variabilidad entre evaluaciones.' : 'Variabilidad controlada en el corte.',
      `Tendencia temporal: ${metrics.trendDirection}`
    ], 4));
    addFooter(slide, footer);
  }

  // 6. Campus
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Comparativo por Campus', 'Promedio, volumen y cumplimiento');
    addTableLikeList(slide, 1.8, metrics.byCampus, ['Campus', 'Total', 'Promedio', 'Cumplimiento']);
    addFooter(slide, footer);
  }

  // 7. Centros
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Comparativo por Centros', 'Top escenarios de practica por desempeno');
    addTableLikeList(slide, 1.8, metrics.byCenter, ['Centro', 'Total', 'Promedio', 'Cumplimiento']);
    addFooter(slide, footer);
  }

  // 8. Programas
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Comparativo por Programas', 'Consolidado academico por especialidad');
    addTableLikeList(slide, 1.8, metrics.byProgram, ['Programa', 'Total', 'Promedio', 'Cumplimiento']);
    addFooter(slide, footer);
  }

  // 9. Roles
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Comparativo por Roles', 'Percepcion por tipo de evaluador');
    addTableLikeList(slide, 1.8, metrics.byRole, ['Rol', 'Total', 'Promedio', 'Cumplimiento']);
    addFooter(slide, footer);
  }

  // 10. Tendencia mensual
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Tendencia Mensual', 'Evolucion de volumen y promedio en el tiempo');
    addTableLikeList(slide, 1.8, metrics.monthly, ['Mes', 'Total', 'Promedio', 'Cumplimiento']);
    addFooter(slide, footer);
  }

  // 11. Encuestas
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Desempeno por Encuesta', 'Lectura de instrumentos con datos calificados');
    addTableLikeList(slide, 1.8, metrics.bySurvey, ['Encuesta', 'Total', 'Promedio', 'Cumplimiento']);
    addFooter(slide, footer);
  }

  // 12. Calidad de dato
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Calidad y Cobertura del Dato', 'Consistencia para toma de decisiones');
    addBulletBlock(slide, 0.7, 1.8, 5.9, 4.8, 'Estado del dato', shortList([
      `Evaluaciones con puntaje: ${metrics.kpis.scored}`,
      `Evaluaciones sin puntaje: ${metrics.kpis.total - metrics.kpis.scored}`,
      `Desviacion estandar global: ${metrics.variability.toFixed(2)}`,
      metrics.kpis.completionPct < 70 ? 'Advertencia: cobertura baja para inferencias fuertes.' : 'Cobertura aceptable para decisiones operativas.'
    ], 4));
    addBulletBlock(slide, 6.8, 1.8, 5.9, 4.8, 'Diagnostico', shortList([
      metrics.lowCenter ? `Centro critico: ${metrics.lowCenter.name} (${metrics.lowCenter.score.toFixed(2)}).` : 'Sin centro critico identificado.',
      metrics.topCenter ? `Centro referente: ${metrics.topCenter.name} (${metrics.topCenter.score.toFixed(2)}).` : 'Sin centro referente identificado.',
      metrics.lowProgram ? `Programa critico: ${metrics.lowProgram.name} (${metrics.lowProgram.score.toFixed(2)}).` : 'Sin programa critico identificado.',
      metrics.topProgram ? `Programa referente: ${metrics.topProgram.name} (${metrics.topProgram.score.toFixed(2)}).` : 'Sin programa referente identificado.'
    ], 4));
    addFooter(slide, footer);
  }

  // 13. Hallazgos IA
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Hallazgos Priorizados', 'Sintesis generada con modelo IA gratuito');
    addBulletBlock(slide, 0.7, 1.8, 12, 4.8, 'Hallazgos', shortList(narrative.hallazgos, 10));
    addFooter(slide, footer);
  }

  // 14. Riesgos IA
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Riesgos y Alertas', 'Elementos que requieren accion temprana');
    addBulletBlock(slide, 0.7, 1.8, 12, 4.8, 'Riesgos', shortList(narrative.riesgos, 10));
    addFooter(slide, footer);
  }

  // 15. Plan de accion y cierre
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Plan de Accion Sugerido', 'Proximos pasos para gestion y mejora continua');
    addBulletBlock(slide, 0.7, 1.8, 12, 3.2, 'Acciones recomendadas', shortList(narrative.acciones, 8));
    slide.addText('Cierre: mantener corte mensual y seguimiento de compromisos por centro y programa.', {
      x: 0.9,
      y: 5.3,
      w: 11.7,
      h: 0.9,
      fontSize: 14,
      color: '1E293B',
      bold: true,
      align: 'center'
    });
    addFooter(slide, footer);
  }

  return pptx;
}

export default function KometPresenta() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [aiNarrative, setAiNarrative] = useState(null);

  const [selectedCampus, setSelectedCampus] = useState('Todos');
  const [selectedLevel, setSelectedLevel] = useState('Todos');
  const [selectedCenter, setSelectedCenter] = useState('Todos');
  const [selectedProgram, setSelectedProgram] = useState('Todos');

  useEffect(() => {
    setLoading(true);
    getEvaluationReportMetrics()
      .then((result) => setRows(result?.rows || []))
      .catch(() => {
        setRows([]);
        setError('No se pudo cargar informacion de evaluaciones.');
      })
      .finally(() => setLoading(false));
  }, []);

  const campusOptions = useMemo(() => {
    return ['Todos', ...new Set(rows.map((row) => norm(row.campus)).filter(Boolean))];
  }, [rows]);

  const baseFiltered = useMemo(() => {
    return rows.filter((row) => {
      if (selectedCampus !== 'Todos' && norm(row.campus) !== selectedCampus) return false;
      if (selectedLevel !== 'Todos') {
        const level = resolveLevel(row);
        if (level && level !== selectedLevel) return false;
      }
      return true;
    });
  }, [rows, selectedCampus, selectedLevel]);

  const centerOptions = useMemo(() => {
    return ['Todos', ...new Set(baseFiltered.map((row) => norm(row.center || 'Sin sitio')).filter(Boolean))];
  }, [baseFiltered]);

  const programOptions = useMemo(() => {
    const source = selectedCenter === 'Todos'
      ? baseFiltered
      : baseFiltered.filter((row) => norm(row.center || 'Sin sitio') === selectedCenter);
    const programs = [...new Set(source.map((row) => resolveProgram(row)).filter((value) => value && value !== 'Sin programa'))];
    return ['Todos', ...programs];
  }, [baseFiltered, selectedCenter]);

  useEffect(() => {
    if (!centerOptions.includes(selectedCenter)) setSelectedCenter('Todos');
  }, [centerOptions, selectedCenter]);

  useEffect(() => {
    if (!programOptions.includes(selectedProgram)) setSelectedProgram('Todos');
  }, [programOptions, selectedProgram]);

  const filteredRows = useMemo(() => {
    return baseFiltered.filter((row) => {
      const center = norm(row.center || 'Sin sitio');
      const program = resolveProgram(row);
      if (selectedCenter !== 'Todos' && center !== selectedCenter) return false;
      if (selectedProgram !== 'Todos' && program !== selectedProgram) return false;
      return true;
    });
  }, [baseFiltered, selectedCenter, selectedProgram]);

  const metrics = useMemo(() => {
    const scoreRows = filteredRows
      .map((row) => row.scoreSummary?.globalScore)
      .filter((value) => typeof value === 'number');

    const completed = filteredRows.filter((row) => row.status === 'Completada').length;

    const byCampus = rankBy(filteredRows, (row) => norm(row.campus || 'Sin campus'), (row) => row.scoreSummary?.globalScore);
    const byCenter = rankBy(filteredRows, (row) => norm(row.center || 'Sin sitio'), (row) => row.scoreSummary?.globalScore);
    const byProgram = rankBy(filteredRows, (row) => resolveProgram(row), (row) => row.scoreSummary?.globalScore)
      .filter((item) => item.name !== 'Sin programa');
    const byRole = rankBy(filteredRows, (row) => norm(row.role || 'Sin definir'), (row) => row.scoreSummary?.globalScore);
    const bySurvey = rankBy(filteredRows, (row) => norm(row.survey || 'Sin encuesta'), (row) => row.scoreSummary?.globalScore);

    const monthMap = new Map();
    filteredRows.forEach((row) => {
      const key = getMonthKey(row.completed_at || row.created_at);
      const entry = monthMap.get(key) || { name: key, total: 0, completed: 0, scores: [] };
      entry.total += 1;
      if (row.status === 'Completada') entry.completed += 1;
      const score = row.scoreSummary?.globalScore;
      if (typeof score === 'number') entry.scores.push(score);
      monthMap.set(key, entry);
    });

    const monthly = [...monthMap.values()]
      .map((item) => ({
        ...item,
        score: avg(item.scores),
        completionPct: item.total ? Number(((item.completed / item.total) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const distribution = [
      { label: '0-2', count: 0 },
      { label: '2-3', count: 0 },
      { label: '3-4', count: 0 },
      { label: '4-5', count: 0 }
    ];

    scoreRows.forEach((score) => {
      if (score < 2) distribution[0].count += 1;
      else if (score < 3) distribution[1].count += 1;
      else if (score < 4) distribution[2].count += 1;
      else distribution[3].count += 1;
    });

    const sortedDates = filteredRows
      .map((row) => new Date(row.completed_at || row.created_at))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const dateRange = sortedDates.length
      ? `${sortedDates[0].toLocaleDateString('es-CO')} a ${sortedDates[sortedDates.length - 1].toLocaleDateString('es-CO')}`
      : 'Sin fechas registradas';

    const firstHalf = monthly.slice(0, Math.floor(monthly.length / 2));
    const secondHalf = monthly.slice(Math.floor(monthly.length / 2));
    const trendDirection = avg(secondHalf.map((row) => row.score)) >= avg(firstHalf.map((row) => row.score)) ? 'al alza' : 'a la baja';

    return {
      kpis: {
        total: filteredRows.length,
        completed,
        completionPct: filteredRows.length ? Number(((completed / filteredRows.length) * 100).toFixed(1)) : 0,
        globalScore: avg(scoreRows),
        programs: new Set(filteredRows.map((row) => resolveProgram(row)).filter((value) => value !== 'Sin programa')).size,
        centers: new Set(filteredRows.map((row) => norm(row.center || 'Sin sitio'))).size,
        scored: scoreRows.length
      },
      distribution,
      byCampus,
      byCenter,
      byProgram,
      byRole,
      bySurvey,
      monthly,
      variability: stdDev(scoreRows),
      topCenter: byCenter[0] || null,
      lowCenter: byCenter.length ? byCenter[byCenter.length - 1] : null,
      topProgram: byProgram[0] || null,
      lowProgram: byProgram.length ? byProgram[byProgram.length - 1] : null,
      dateRange,
      trendDirection
    };
  }, [filteredRows]);

  const filters = {
    campus: selectedCampus,
    level: selectedLevel,
    center: selectedCenter,
    program: selectedProgram
  };

  const fallbackNarrative = useMemo(() => buildNarrativeFallback(metrics), [metrics]);

  async function handleGenerateAiNarrative() {
    setGeneratingAi(true);
    setError('');

    try {
      const settings = await getSystemSettings();
      const selectedModel = String(settings?.openrouter_model || '').includes(':free')
        ? settings.openrouter_model
        : OPENROUTER_FREE_MODELS[0];

      const prompt = [
        'Eres analista senior en educacion superior y calidad docencia-servicio.',
        'Entrega SOLO JSON valido con esta forma:',
        '{"resumen":"texto","hallazgos":["..."],"riesgos":["..."],"acciones":["..."]}',
        'Maximo 5 hallazgos, 5 riesgos, 5 acciones. Sin markdown.',
        `Filtros: ${formatFilters(filters)}`,
        `KPIs: total=${metrics.kpis.total}, completadas=${metrics.kpis.completed}, cumplimiento=${metrics.kpis.completionPct}, promedio=${metrics.kpis.globalScore}`,
        `Top centros: ${metrics.byCenter.slice(0, 3).map((item) => `${item.name}:${item.score.toFixed(2)}`).join(', ') || 'N/A'}`,
        `Top programas: ${metrics.byProgram.slice(0, 3).map((item) => `${item.name}:${item.score.toFixed(2)}`).join(', ') || 'N/A'}`,
        `Tendencia mensual: ${metrics.monthly.map((item) => `${item.name}:${item.score.toFixed(2)}`).join(', ') || 'N/A'}`
      ].join('\n');

      const raw = await runOpenRouterPrompt({
        apiKey: settings?.openrouter_api_key || '',
        model: selectedModel,
        systemPrompt:
          settings?.openrouter_system_prompt ||
          'Eres un asistente estrategico que sintetiza resultados en lenguaje ejecutivo claro.',
        prompt,
        temperature: Number.isFinite(Number(settings?.openrouter_temperature))
          ? Number(settings.openrouter_temperature)
          : 0.6
      });

      const parsed = parseAiPayload(raw);
      const safeNarrative = {
        resumen: parsed.resumen || fallbackNarrative.resumen,
        hallazgos: parsed.hallazgos.length ? parsed.hallazgos : fallbackNarrative.hallazgos,
        riesgos: parsed.riesgos.length ? parsed.riesgos : fallbackNarrative.riesgos,
        acciones: parsed.acciones.length ? parsed.acciones : fallbackNarrative.acciones
      };

      setAiNarrative(safeNarrative);
    } catch (aiError) {
      setAiNarrative(fallbackNarrative);
      setError(`No se pudo generar narrativa IA gratuita: ${aiError?.message || 'error no identificado'}`);
    } finally {
      setGeneratingAi(false);
    }
  }

  async function handleExportPptx() {
    setExporting(true);
    setError('');

    try {
      const deck = createPresentationDeck({
        filters,
        metrics,
        narrative: aiNarrative || fallbackNarrative
      });

      const timeTag = new Date().toISOString().slice(0, 10);
      await deck.writeFile({ fileName: `komet-presenta-${timeTag}.pptx` });
    } catch (exportError) {
      setError(`No se pudo exportar la presentacion: ${exportError?.message || 'error no identificado'}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Presentation className="w-6 h-6 text-blue-600" />
              Komet Presenta
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Modulo independiente para generar presentaciones PowerPoint dinamicas (minimo 15 diapositivas).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerateAiNarrative}
              disabled={loading || generatingAi || !metrics.kpis.total}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {generatingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Enriquecer con IA Free
            </button>
            <button
              type="button"
              onClick={handleExportPptx}
              disabled={loading || exporting || !metrics.kpis.total}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Exportar .pptx (15 slides)
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Filtros dinamicos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={selectedCampus} onChange={(event) => setSelectedCampus(event.target.value)}>
            {campusOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>

          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)}>
            <option value="Todos">Todos los niveles</option>
            <option value="pregrado">Pregrado</option>
            <option value="posgrado">Posgrado</option>
          </select>

          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={selectedCenter} onChange={(event) => setSelectedCenter(event.target.value)}>
            {centerOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>

          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={selectedProgram} onChange={(event) => setSelectedProgram(event.target.value)}>
            {programOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Evaluaciones</p>
          <p className="text-3xl font-black text-slate-900">{loading ? '-' : metrics.kpis.total}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Completadas</p>
          <p className="text-3xl font-black text-slate-900">{loading ? '-' : metrics.kpis.completed}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Cumplimiento</p>
          <p className="text-3xl font-black text-slate-900">{loading ? '-' : `${metrics.kpis.completionPct}%`}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Promedio global</p>
          <p className="text-3xl font-black text-slate-900">{loading ? '-' : metrics.kpis.globalScore.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-slate-900">Narrativa para diapositivas 13-15</h3>
        <p className="text-sm text-slate-500 mt-1">{(aiNarrative || fallbackNarrative).resumen}</p>
      </div>
    </div>
  );
}
