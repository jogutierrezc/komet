// Servicio de generación de presentaciones PPTX con gráficos nativos, tablas y narrativa IA.

import PptxGenJS from 'pptxgenjs';
import { formatPct, shortList } from '../utils/dataHelpers';

export const PPTX_SHAPES = {
  line: 'line',
  rect: 'rect',
  roundRect: 'roundRect'
};

export function addSlideHeader(slide, title, subtitle) {
  slide.addText('Komet Analytics & AI', { x: 0.5, y: 0.2, w: 4, h: 0.3, fontSize: 11, color: '2563EB', bold: true });
  slide.addShape(PPTX_SHAPES.line, { x: 0.5, y: 0.58, w: 12.2, h: 0, line: { color: 'E2E8F0', pt: 1 } });
  slide.addText(title, { x: 0.5, y: 0.7, w: 12.2, h: 0.5, fontSize: 24, bold: true, color: '0F172A' });
  if (subtitle) {
    slide.addText(subtitle, { x: 0.5, y: 1.2, w: 12.2, h: 0.45, fontSize: 12, color: '475569' });
  }
}

export function addFooter(slide, footerText) {
  slide.addText(footerText, { x: 0.5, y: 6.9, w: 12.2, h: 0.3, fontSize: 9, color: '64748B', align: 'right' });
}

export function addBulletBlock(slide, x, y, w, h, title, lines = []) {
  slide.addShape(PPTX_SHAPES.roundRect, {
    x, y, w, h, line: { color: 'DBEAFE', pt: 1 }, fill: { color: 'F8FAFF' }, radius: 0.08
  });
  slide.addText(title, { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.3, fontSize: 14, bold: true, color: '1D4ED8' });
  slide.addText(lines.join('\n') || '• Sin datos suficientes', {
    x: x + 0.2, y: y + 0.52, w: w - 0.4, h: h - 0.65, fontSize: 11, color: '0F172A', breakLine: true, valign: 'top'
  });
}

export function addNativeTable(slide, x, y, w, rows, headers) {
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

/**
 * Crea una presentación PPTX completa con portada, KPIs, gráficos, tablas y narrativa IA.
 */
export function createPresentationDeck({ filters, metrics, narrative }) {
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Komet Analytics';
  pptx.company = 'Komet';
  pptx.subject = 'Reporte Ejecutivo y Análisis de Datos';
  pptx.title = 'Komet Presenta';
  pptx.lang = 'es-CO';

  const stamp = new Date().toLocaleString('es-CO');
  const footer = `Generado mediante Komet Data & AI | ${stamp}`;
  const filtersText = `Campus: ${filters.campus} | Nivel: ${filters.level} | Centro: ${filters.center} | Programa: ${filters.program}`;

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

  // 6. Tendencia Mensual
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

  // 7. Comparativo Campus
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Desempeño por Campus', 'Matriz de promedios cruzados y participación');

    if (metrics.byCampus.length > 0) {
      const barData = [{
        name: 'Score Global',
        labels: metrics.byCampus.slice(0, 6).map(c => c.name.substring(0, 15)),
        values: metrics.byCampus.slice(0, 6).map(c => c.score)
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

  // 8. Centros de Práctica
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Estudio por Centros de Práctica', 'Top 10 escenarios clasificados por rendimiento');
    addNativeTable(slide, 0.7, 1.8, 11.8, metrics.byCenter, ['Centro / Institución', 'Volumen', 'Promedio', 'Cumplimiento']);
    addFooter(slide, footer);
  }

  // 9. Programas
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Estudio por Especialidad y Programa', 'Consolidado académico segmentado');
    addNativeTable(slide, 0.7, 1.8, 11.8, metrics.byProgram, ['Programa Académico', 'Evaluaciones', 'Promedio', 'Cumplimiento']);
    addFooter(slide, footer);
  }

  // 10. Roles
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
      metrics.kpis.completionPct < 70
        ? 'Advertencia: Margen de error alto por baja participación.'
        : 'Confianza: Nivel óptimo de representatividad estadística.'
    ], 4));
    addBulletBlock(slide, 6.8, 1.8, 5.9, 4.8, 'Extremos Detectados', shortList([
      metrics.lowCenter ? `Punto de Dolor (Centro): ${metrics.lowCenter.name} (${metrics.lowCenter.score.toFixed(2)}).` : 'Sin centros críticos.',
      metrics.topCenter ? `Benchmarking (Centro): ${metrics.topCenter.name} (${metrics.topCenter.score.toFixed(2)}).` : 'Sin centros líderes.',
      metrics.lowProgram ? `Punto de Dolor (Prog): ${metrics.lowProgram.name} (${metrics.lowProgram.score.toFixed(2)}).` : 'Sin programas críticos.',
      metrics.topProgram ? `Benchmarking (Prog): ${metrics.topProgram.name} (${metrics.topProgram.score.toFixed(2)}).` : 'Sin programas líderes.'
    ], 4));
    addFooter(slide, footer);
  }

  // 12. Análisis Profundo IA
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

  // 15. Plan de Acción
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, 'Sugerencias y Plan de Acción Estratégico', 'Recomendaciones Data-Driven para mejora continua');
    addBulletBlock(slide, 0.7, 1.8, 12, 3.8, 'Sugerencias Basadas en Datos', shortList(narrative.acciones, 8));
    slide.addText(
      'Conclusión Corporativa: Adoptar estas estrategias permite mitigar los riesgos identificados, mejorar el cuartil de desempeño y maximizar la experiencia global.',
      { x: 0.9, y: 5.8, w: 11.7, h: 0.9, fontSize: 13, color: '1E3A8A', bold: true, align: 'center', fill: 'DBEAFE' }
    );
    addFooter(slide, footer);
  }

  return pptx;
}
