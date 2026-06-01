import React, { useEffect, useMemo, useState } from 'react';
import PptxGenJS from 'pptxgenjs';
import { Loader2, Presentation, Sparkles, Download, BarChart3, FileText, PieChart, FileUp } from 'lucide-react';
import {
  getEvaluationReportMetrics,
  getSystemSettings,
  runOpenRouterPrompt,
  OPENROUTER_FREE_MODELS
} from '../lib/data';
import { PptxTemplateEngine, buildTemplateData } from '../lib/pptxTemplateEngine';

const LEVEL_WORDS = new Set(['pregrado', 'posgrado', 'postgrado']);
const PPTX_SHAPES = {
  line: 'line',
  rect: 'rect',
  roundRect: 'roundRect'
};

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
    analisis_completo: 'Sin análisis profundo disponible.',
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
      analisis_completo: String(parsed?.analisis_completo || parsed?.analisis || fallback.analisis_completo),
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
  const analisis = `Análisis Estructural de Datos:
El conjunto de datos procesa ${metrics.kpis.total} evaluaciones con un cumplimiento del ${formatPct(metrics.kpis.completionPct)}. 
El puntaje medio institucional es ${metrics.kpis.globalScore.toFixed(2)}/5.0, mostrando una varianza de ${metrics.variability.toFixed(2)}, lo que sugiere una dispersión ${metrics.variability > 0.9 ? 'significativa que requiere revisión' : 'controlada'}. 
La métrica histórica refleja una tendencia general ${metrics.trendDirection}. 
A nivel operativo, ${metrics.topCenter?.name || 'N/A'} lidera el desempeño, contrastando con ${metrics.lowCenter?.name || 'N/A'} que representa el cuartil inferior.`;

  const hallazgos = [
    `Promedio global consolidado: ${metrics.kpis.globalScore.toFixed(2)} sobre 5.`,
    `Tasa de respuesta efectiva: ${formatPct(metrics.kpis.completionPct)} (${metrics.kpis.completed}/${metrics.kpis.total}).`,
    metrics.topCenter ? `Liderazgo en centro de práctica: ${metrics.topCenter.name} destaca con ${metrics.topCenter.score.toFixed(2)}.` : '',
    metrics.topProgram ? `Liderazgo académico: ${metrics.topProgram.name} obtiene la valoración más alta (${metrics.topProgram.score.toFixed(2)}).` : ''
  ].filter(Boolean);

  const riesgos = [
    metrics.lowCenter ? `Brecha operativa: ${metrics.lowCenter.name} registra el índice más bajo (${metrics.lowCenter.score.toFixed(2)}).` : '',
    metrics.kpis.completionPct < 70 ? 'Riesgo de sesgo: La cobertura global de respuestas es inferior al 70%.' : '',
    metrics.variability > 0.9 ? `Falta de estandarización: Alta desviación en calificaciones (${metrics.variability.toFixed(2)}).` : ''
  ].filter(Boolean);

  const acciones = [
    'Establecer planes de remediación inmediatos en escenarios con promedio < 3.5.',
    'Automatizar recordatorios para incrementar la tasa de cumplimiento de evaluaciones pendientes.',
    'Socializar estos resultados con directores de programa para fomentar planes de acción a medida.'
  ];

  return {
    resumen: `Reporte gerencial basado en ${metrics.kpis.total} registros. El indicador global es ${metrics.kpis.globalScore.toFixed(2)} (Tendencia ${metrics.trendDirection}).`,
    analisis_completo: analisis,
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
  slide.addText('Komet Analytics & AI', { x: 0.5, y: 0.2, w: 4, h: 0.3, fontSize: 11, color: '2563EB', bold: true });
  slide.addShape(PPTX_SHAPES.line, { x: 0.5, y: 0.58, w: 12.2, h: 0, line: { color: 'E2E8F0', pt: 1 } });
  slide.addText(title, { x: 0.5, y: 0.7, w: 12.2, h: 0.5, fontSize: 24, bold: true, color: '0F172A' });
  if (subtitle) {
    slide.addText(subtitle, { x: 0.5, y: 1.2, w: 12.2, h: 0.45, fontSize: 12, color: '475569' });
  }
}

function addFooter(slide, footerText) {
  slide.addText(footerText, { x: 0.5, y: 6.9, w: 12.2, h: 0.3, fontSize: 9, color: '64748B', align: 'right' });
}

function addBulletBlock(slide, x, y, w, h, title, lines = []) {
  slide.addShape(PPTX_SHAPES.roundRect, {
    x, y, w, h, line: { color: 'DBEAFE', pt: 1 }, fill: { color: 'F8FAFF' }, radius: 0.08
  });
  slide.addText(title, { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.3, fontSize: 14, bold: true, color: '1D4ED8' });
  slide.addText(lines.join('\n') || '• Sin datos suficientes', {
    x: x + 0.2, y: y + 0.52, w: w - 0.4, h: h - 0.65, fontSize: 11, color: '0F172A', breakLine: true, valign: 'top'
  });
}

function addNativeTable(slide, x, y, w, rows, headers) {
  const colWs = [w * 0.45, w * 0.18, w * 0.18, w * 0.19]; 
  const tableData = [
    headers.map(h => ({ text: h, options: { fill: '1E3A8A', color: 'FFFFFF', bold: true, fontSize: 11, align: 'center', valign: 'middle' } })),
    ...rows.slice(0, 10).map((row, idx) => [
      { text: row.name, options: { fill: idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF', fontSize: 10, align: 'left', valign: 'middle' } },
      { text: String(row.total), options: { fill: idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF', fontSize: 10, align: 'center', valign: 'middle' } },
      { text: row.score.toFixed(2), options: { fill: idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF', fontSize: 10, align: 'center', valign: 'middle' } },
      { text: formatPct(row.completionPct), options: { fill: idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF', fontSize: 10, align: 'center', valign: 'middle' } }
    ])
  ];

  if (slide.addTable) {
    slide.addTable(tableData, {
      x, y, w, rowH: 0.4,
      border: { pt: 1, color: 'E2E8F0' },
      colW: colWs
    });
  }
}

function createPresentationDeck({ filters, metrics, narrative }) {
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Komet Analytics';
  pptx.company = 'Komet';
  pptx.subject = 'Reporte Ejecutivo y Análisis de Datos';
  pptx.title = 'Komet Presenta';
  pptx.lang = 'es-CO';

  const stamp = new Date().toLocaleString('es-CO');
  const footer = `Generado mediante Komet Data & AI | ${stamp}`;
  const filtersText = formatFilters(filters);

  // 1. Portada
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'EFF6FF' };
    slide.addShape(PPTX_SHAPES.rect, { x: 0, y: 0, w: 13.33, h: 1.7, fill: { color: '1D4ED8' }, line: { color: '1D4ED8', pt: 0 } });
    slide.addText('Komet Data Analytics', { x: 0.7, y: 0.45, w: 8, h: 0.6, fontSize: 32, bold: true, color: 'FFFFFF' });
    slide.addText('Reporte Integral de Evaluaciones y Calidad', { x: 0.7, y: 1.95, w: 10, h: 0.4, fontSize: 18, bold: true, color: '1E293B' });
    slide.addText(filtersText, { x: 0.7, y: 2.55, w: 12, h: 0.5, fontSize: 12, color: '334155' });
    slide.addText(`Volumen de la muestra: ${metrics.kpis.total} evaluaciones analizadas`, { x: 0.7, y: 3.05, w: 8, h: 0.4, fontSize: 12, color: '334155', italic: true });
    slide.addText(narrative.resumen, { x: 0.7, y: 3.8, w: 11.5, h: 2.0, fontSize: 16, color: '0F172A', breakLine: true });
    addFooter(slide, footer);
  }

  // 2. Agenda
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Estructura del Estudio de Datos', 'Secuencia metodológica del reporte');
    slide.addText(
      [
        '1. Metodología y alcance del dataset',
        '2. Cuadro de Mando Integral (KPIs)',
        '3. Análisis de Distribución de Resultados (Gráficos)',
        '4. Estudio de Tendencias Temporales',
        '5. Matrices Comparativas (Campus, Centros, Programas)',
        '6. Diagnóstico de Calidad del Dato',
        '7. Deep Data Analysis: Estudio Integral por IA',
        '8. Plan de Acción y Sugerencias Estratégicas'
      ].join('\n\n'),
      { x: 0.9, y: 1.8, w: 11.8, h: 4.5, fontSize: 16, color: '0F172A', breakLine: true, bullet: { code: '2022', color: '1D4ED8' } }
    );
    addFooter(slide, footer);
  }

  // 3. Filtros y alcance
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Contexto del Estudio', 'Filtros aplicados a la base de datos');
    addBulletBlock(slide, 0.7, 1.9, 12, 3.6, 'Parámetros de Inclusión', shortList([
      `Sede / Campus: ${filters.campus}`,
      `Nivel Académico: ${filters.level}`,
      `Centro de Práctica: ${filters.center}`,
      `Especialidad / Programa: ${filters.program}`,
      `Periodo de Observación: ${metrics.dateRange}`
    ], 5));
    addFooter(slide, footer);
  }

  // 4. KPIs principales
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Cuadro de Mando Integral', 'Métricas de alto nivel institucionales');
    const cards = [
      ['Total Evaluaciones', String(metrics.kpis.total)],
      ['Respuestas Efectivas', String(metrics.kpis.completed)],
      ['Tasa de Cumplimiento', formatPct(metrics.kpis.completionPct)],
      ['Score Promedio Global', metrics.kpis.globalScore.toFixed(2)],
      ['Programas Cubiertos', String(metrics.kpis.programs)],
      ['Centros Monitoreados', String(metrics.kpis.centers)]
    ];

    cards.forEach((card, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 0.7 + col * 4.1;
      const y = 1.8 + row * 2.2;
      slide.addShape(PPTX_SHAPES.roundRect, { x, y, w: 3.8, h: 1.8, line: { color: 'DBEAFE', pt: 1 }, fill: { color: 'F8FAFF' }, radius: 0.08 });
      slide.addText(card[0], { x: x + 0.2, y: y + 0.2, w: 3.4, h: 0.35, fontSize: 13, color: '475569', bold: true });
      slide.addText(card[1], { x: x + 0.2, y: y + 0.72, w: 3.4, h: 0.7, fontSize: 32, bold: true, color: '1E3A8A' });
    });
    addFooter(slide, footer);
  }

  // 5. Gráfico Distribución de Puntajes
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Distribución de Calificaciones', 'Análisis de concentración de puntajes globales');
    
    // Gráfico de pastel / Doughnut nativo
    const distChartData = [{
      name: 'Volumen',
      labels: metrics.distribution.map(d => d.label),
      values: metrics.distribution.map(d => d.count)
    }];
    
    slide.addChart(pptx.charts.DOUGHNUT, distChartData, {
      x: 0.7, y: 1.8, w: 5.5, h: 4.5,
      showLegend: true, legendPos: 'b',
      showValue: false, showPercent: true,
      dataLabelColor: 'FFFFFF', dataLabelFontSize: 12,
      chartColors: ['EF4444', 'F59E0B', '3B82F6', '10B981'],
      holeSize: 50
    });

    addBulletBlock(slide, 6.8, 1.8, 5.9, 4.5, 'Insights Estadísticos', shortList([
      `Mediana del periodo: ${metrics.kpis.globalScore.toFixed(2)}`,
      `Índice de Varianza (Desv. Estándar): ${metrics.variability.toFixed(2)}`,
      metrics.variability > 0.9 ? '⚠️ Se detecta una alta variabilidad. Revisar metodologías.' : '✅ La variabilidad está controlada y estable.',
      `Categoría dominante: Rango ${[...metrics.distribution].sort((a,b) => b.count - a.count)[0]?.label}`
    ], 4));
    addFooter(slide, footer);
  }

  // 6. Tendencia Mensual (Líneas)
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Evolución y Tendencia Temporal', 'Comportamiento del puntaje promedio mes a mes');
    
    if (metrics.monthly.length > 0) {
      const lineData = [{
        name: 'Promedio Mensual',
        labels: metrics.monthly.map(m => m.name),
        values: metrics.monthly.map(m => m.score)
      }];
      slide.addChart(pptx.charts.LINE, lineData, {
        x: 0.5, y: 1.8, w: 12.2, h: 4.5,
        showLegend: false, showValue: true,
        valAxisMinVal: 0, valAxisMaxVal: 5.5,
        lineSize: 3, lineDataSymbol: 'circle', chartColors: ['2563EB']
      });
    } else {
      slide.addText('Datos insuficientes para generar línea de tendencia.', { x: 0.5, y: 3, w: 12, align: 'center', color: '64748B' });
    }
    addFooter(slide, footer);
  }

  // 7. Comparativo Campus (Barras + Tabla)
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Desempeño por Campus', 'Matriz de promedios cruzados y participación');
    
    if(metrics.byCampus.length > 0) {
      const barData = [{
        name: 'Score Global',
        labels: metrics.byCampus.slice(0,6).map(c => c.name.substring(0,15)),
        values: metrics.byCampus.slice(0,6).map(c => c.score)
      }];
      slide.addChart(pptx.charts.BAR, barData, {
        x: 0.5, y: 1.8, w: 5.5, h: 4.5, barDir: 'col',
        showLegend: false, showValue: true,
        valAxisMinVal: 0, valAxisMaxVal: 5, chartColors: ['3B82F6']
      });
      addNativeTable(slide, 6.4, 1.8, 6.3, metrics.byCampus, ['Campus', 'Total', 'Prom.', 'Cump.']);
    }
    addFooter(slide, footer);
  }

  // 8. Centros (Tabla Nativa)
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Estudio por Centros de Práctica', 'Top 10 escenarios clasificados por rendimiento');
    addNativeTable(slide, 0.7, 1.8, 11.8, metrics.byCenter, ['Centro / Institución', 'Volumen', 'Promedio', 'Cumplimiento']);
    addFooter(slide, footer);
  }

  // 9. Programas (Tabla Nativa)
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Estudio por Especialidad y Programa', 'Consolidado académico segmentado');
    addNativeTable(slide, 0.7, 1.8, 11.8, metrics.byProgram, ['Programa Académico', 'Evaluaciones', 'Promedio', 'Cumplimiento']);
    addFooter(slide, footer);
  }

  // 10. Roles (Tabla Nativa)
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Análisis por Perfil del Evaluador', 'Percepción y participación según rol');
    addNativeTable(slide, 0.7, 1.8, 11.8, metrics.byRole, ['Rol de Usuario', 'Registros', 'Promedio', 'Cumplimiento']);
    addFooter(slide, footer);
  }

  // 11. Calidad de dato
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Diagnóstico de Calidad de Datos', 'Nivel de confianza de la muestra analizada');
    addBulletBlock(slide, 0.7, 1.8, 5.9, 4.8, 'Métricas de Confianza', shortList([
      `Registros con calificación válida: ${metrics.kpis.scored}`,
      `Registros vacíos/pendientes: ${metrics.kpis.total - metrics.kpis.scored}`,
      `Desviación Estándar Muestral: ${metrics.variability.toFixed(2)}`,
      metrics.kpis.completionPct < 70 ? 'Advertencia: Margen de error alto por baja participación.' : 'Confianza: Nivel óptimo de representatividad estadística.'
    ], 4));
    addBulletBlock(slide, 6.8, 1.8, 5.9, 4.8, 'Extremos Detectados', shortList([
      metrics.lowCenter ? `Punto de Dolor (Centro): ${metrics.lowCenter.name} (${metrics.lowCenter.score.toFixed(2)}).` : 'Sin centros críticos.',
      metrics.topCenter ? `Benchmarking (Centro): ${metrics.topCenter.name} (${metrics.topCenter.score.toFixed(2)}).` : 'Sin centros líderes.',
      metrics.lowProgram ? `Punto de Dolor (Prog): ${metrics.lowProgram.name} (${metrics.lowProgram.score.toFixed(2)}).` : 'Sin programas críticos.',
      metrics.topProgram ? `Benchmarking (Prog): ${metrics.topProgram.name} (${metrics.topProgram.score.toFixed(2)}).` : 'Sin programas líderes.'
    ], 4));
    addFooter(slide, footer);
  }

  // 12. Análisis Profundo de Datos (NUEVO)
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Deep Data Analysis (IA)', 'Estudio completo e integral del ecosistema de datos');
    slide.addShape(PPTX_SHAPES.roundRect, { x: 0.7, y: 1.8, w: 12, h: 4.8, fill: 'F4F4F5', line: { color: 'D4D4D8', pt: 1 }, radius: 0.1 });
    slide.addText(narrative.analisis_completo, { 
      x: 1.0, y: 2.1, w: 11.4, h: 4.2, 
      fontSize: 16, color: '27272A', align: 'justify', breakLine: true, valign: 'top'
    });
    addFooter(slide, footer);
  }

  // 13. Hallazgos IA
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Descubrimientos y Hallazgos', 'Insights extraídos mediante modelado estratégico');
    addBulletBlock(slide, 0.7, 1.8, 12, 4.8, 'Hallazgos Clave', shortList(narrative.hallazgos, 8));
    addFooter(slide, footer);
  }

  // 14. Riesgos IA
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Mapa de Riesgos Operativos', 'Focos de atención y posibles desviaciones institucionales');
    addBulletBlock(slide, 0.7, 1.8, 12, 4.8, 'Alertas Identificadas', shortList(narrative.riesgos, 8));
    addFooter(slide, footer);
  }

  // 15. Plan de accion y sugerencias (NUEVO FOCO EN SUGERENCIAS)
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Sugerencias y Plan de Acción Estratégico', 'Recomendaciones Data-Driven para mejora continua');
    addBulletBlock(slide, 0.7, 1.8, 12, 3.8, 'Sugerencias Basadas en Datos', shortList(narrative.acciones, 8));
    slide.addText('Conclusión Corporativa: Adoptar estas estrategias permite mitigar los riesgos identificados, mejorar el cuartil de desempeño y maximizar la experiencia global.', {
      x: 0.9, y: 5.8, w: 11.7, h: 0.9, fontSize: 13, color: '1E3A8A', bold: true, align: 'center', fill: 'DBEAFE'
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
  const [exportingTemplate, setExportingTemplate] = useState(false);
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
        setError('No se pudo cargar información de evaluaciones.');
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
        'Eres un analista de datos avanzado especialista en calidad de educación y salud.',
        'Analiza las siguientes métricas y entrega SOLO un JSON válido con esta estructura exacta:',
        '{"resumen":"texto de 2 lineas","analisis_completo":"Un estudio detallado interpretando los datos, tendencias temporales, correlaciones y conclusiones fuertes basadas en las desviaciones.","hallazgos":["..."],"riesgos":["..."],"acciones":["Sugerencia accionable 1..."]}',
        'Máximo 5 hallazgos, 5 riesgos y 5 acciones (sugerencias estratégicas de mejora).',
        `Filtros aplicados: ${formatFilters(filters)}`,
        `Data: Total evaluaciones=${metrics.kpis.total}, Cumplimiento=${metrics.kpis.completionPct}%, Promedio=${metrics.kpis.globalScore}`,
        `Distribución de notas: 0-2(${metrics.distribution[0].count}), 2-3(${metrics.distribution[1].count}), 3-4(${metrics.distribution[2].count}), 4-5(${metrics.distribution[3].count})`,
        `Top 3 Centros: ${metrics.byCenter.slice(0, 3).map((item) => `${item.name}:${item.score.toFixed(2)}`).join(', ') || 'N/A'}`,
        `Top 3 Programas: ${metrics.byProgram.slice(0, 3).map((item) => `${item.name}:${item.score.toFixed(2)}`).join(', ') || 'N/A'}`,
        `Tendencia Mensual: ${metrics.monthly.map((item) => `${item.name}:${item.score.toFixed(2)}`).join(', ') || 'N/A'}`,
        `Desviación Estándar Global: ${metrics.variability}`
      ].join('\n');

      const raw = await runOpenRouterPrompt({
        apiKey: settings?.openrouter_api_key || '',
        model: selectedModel,
        systemPrompt: settings?.openrouter_system_prompt || 'Eres un Chief Data Officer experto en generar insights a partir de data cruda.',
        prompt,
        temperature: 0.6
      });

      const parsed = parseAiPayload(raw);
      setAiNarrative(parsed);
    } catch (aiError) {
      setAiNarrative(fallbackNarrative);
      setError(`No se pudo generar análisis profundo IA: ${aiError?.message || 'error no identificado'}`);
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
      await deck.writeFile({ fileName: `Komet-Data-Report-${timeTag}.pptx` });
    } catch (exportError) {
      setError(`Error al exportar la presentación con gráficos: ${exportError?.message || 'error no identificado'}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportWithTemplate() {
    if (!metrics.kpis.total) {
      setError('No hay datos para exportar con la plantilla.');
      return;
    }

    setExportingTemplate(true);
    setError('');

    try {
      const templateUrl = '/templates/INFORME AUTOEVALUACIÓN PRACTICAS.pptx';
      const engine = new PptxTemplateEngine();
      await engine.load(templateUrl);

      const operations = buildTemplateData(metrics, filters, aiNarrative || fallbackNarrative);

      console.log(`[Komet Presenta] Aplicando ${operations.length} operaciones a la plantilla...`);

      // Agrupar operaciones por slide para aplicar en lote
      const bySlide = new Map();
      for (const op of operations) {
        if (!bySlide.has(op.slide)) bySlide.set(op.slide, []);
        bySlide.get(op.slide).push(op);
      }

      let totalSuccess = 0;
      for (const [slideNum, ops] of bySlide) {
        const success = engine.applyOperations(slideNum, ops);
        totalSuccess += success;
        console.log(`  Slide ${slideNum}: ${success}/${ops.length} operaciones exitosas`);
      }

      console.log(`[Komet Presenta] Total: ${totalSuccess}/${operations.length} operaciones completadas`);

      const timeTag = new Date().toISOString().slice(0, 10);
      await engine.download(`Informe-Autoevaluacion-${timeTag}.pptx`);
    } catch (templateError) {
      setError(`Error al generar con plantilla: ${templateError?.message || 'error no identificado'}`);
    } finally {
      setExportingTemplate(false);
    }
  }

  const activeNarrative = aiNarrative || fallbackNarrative;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Presentation className="w-7 h-7 text-blue-600" />
              Komet Data & Analytics
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-xl">
              Generador de presentaciones ejecutivas. Incluye gráficos nativos interactivos, tablas formateadas y un modelo de estudio de datos profundo.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGenerateAiNarrative}
              disabled={loading || generatingAi || !metrics.kpis.total}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2 transition-all"
            >
              {generatingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-yellow-400" />}
              Analizar Dataset (IA)
            </button>
            <button
              type="button"
              onClick={handleExportPptx}
              disabled={loading || exporting || !metrics.kpis.total}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 inline-flex items-center gap-2 transition-all shadow-sm shadow-blue-200"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Generar PPTX con Gráficas
            </button>
            <button
              type="button"
              onClick={handleExportWithTemplate}
              disabled={loading || exportingTemplate || !metrics.kpis.total}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 inline-flex items-center gap-2 transition-all shadow-sm shadow-emerald-200"
            >
              {exportingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              Exportar con Plantilla
            </button>
          </div>
        </div>
        {error && <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Segmentación de la Muestra</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <select className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={selectedCampus} onChange={(e) => setSelectedCampus(e.target.value)}>
            {campusOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
          </select>
          <select className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
            <option value="Todos">Todos los niveles</option>
            <option value="pregrado">Pregrado</option>
            <option value="posgrado">Posgrado</option>
          </select>
          <select className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)}>
            {centerOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
          </select>
          <select className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)}>
            {programOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Evaluaciones</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{loading ? '-' : metrics.kpis.total}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completadas</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{loading ? '-' : metrics.kpis.completed}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cumplimiento</p>
          <p className="text-3xl font-black text-blue-600 mt-1">{loading ? '-' : `${metrics.kpis.completionPct}%`}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Promedio Global</p>
          <p className="text-3xl font-black text-blue-600 mt-1">{loading ? '-' : metrics.kpis.globalScore.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3">
            <PieChart className="w-5 h-5 text-indigo-500" />
            Resumen Ejecutivo
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed bg-indigo-50 p-4 rounded-xl border border-indigo-100">
            {activeNarrative.resumen}
          </p>
        </div>
        
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[16rem]">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
            Estudio Profundo de Datos (Slide 12)
          </h3>
          {generatingAi ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm">Analizando correlaciones y varianzas...</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed text-justify">
              {activeNarrative.analisis_completo}
            </p>
          )}
        </div>

        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-orange-500" />
            Sugerencias y Plan de Acción (Slide 15)
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeNarrative.acciones.slice(0, 6).map((accion, idx) => (
              <li key={idx} className="text-sm text-slate-700 bg-orange-50/50 p-4 rounded-xl border border-orange-100 flex items-start gap-2">
                <span className="text-orange-600 font-black mt-0.5">•</span>
                <span>{accion}</span>
              </li>
            ))}
            {activeNarrative.acciones.length === 0 && (
              <p className="text-sm text-slate-400">No hay sugerencias generadas aún.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
