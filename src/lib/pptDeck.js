// Constructor único del PPTX de Komet Presenta.
// Estructura: tema (Cambria + Calibri, que PowerPoint ya trae), layouts con título y número de página,
// secciones, gráficos y tablas nativos, y nota del orador en cada diapositiva.
import PptxGenJS from 'pptxgenjs';
import { UMBRAL_ACEPTABLE, fmtUmbral } from './threshold';

export const THEME = {
  headFont: 'Cambria',
  bodyFont: 'Calibri',
  night: '0C1F2B',
  paper: 'FFFFFF',
  tint: 'F3F5F2',
  ink: '14222B',
  muted: '4A5A63',
  teal: '0F6B68',
  comet: 'F0B13A',
  high: '0F6B68',
  mid: 'D9961A',
  low: 'B3402E',
  lowBg: 'F9DCD6',
  grid: 'D5DCD8',
};

const W = 13.33;
const MARGIN = 0.6;
const CONTENT_W = W - MARGIN * 2;
const ROWS_PER_TABLE_SLIDE = 8;

const scoreColor = (v) => (v >= UMBRAL_ACEPTABLE + 0.3 ? THEME.high : v >= UMBRAL_ACEPTABLE ? THEME.mid : THEME.low);

function defineLayouts(pptx, footerText) {
  pptx.defineSlideMaster({
    title: 'KOMET_COVER',
    background: { color: THEME.night },
    objects: [],
    slideNumber: undefined,
  });
  pptx.defineSlideMaster({
    title: 'KOMET_CONTENT',
    background: { color: THEME.paper },
    objects: [
      {
        placeholder: {
          options: { name: 'title', type: 'title', x: MARGIN, y: 0.45, w: CONTENT_W, h: 1.1, fontFace: THEME.headFont, fontSize: 28, bold: true, color: THEME.night, margin: 0, valign: 'top' },
          text: '',
        },
      },
      { text: { text: footerText, options: { x: MARGIN, y: 7.0, w: 9, h: 0.3, fontFace: THEME.bodyFont, fontSize: 10, color: THEME.muted, margin: 0, isTextBox: true } } },
    ],
    slideNumber: { x: W - MARGIN - 0.6, y: 7.0, w: 0.6, h: 0.3, fontFace: THEME.bodyFont, fontSize: 11, color: THEME.muted, align: 'right' },
    margin: [0.4, 0.4, 0.5, 0.4],
  });
}

function bulletRuns(items, fontSize = 16) {
  return items.map((text, i) => ({
    text,
    options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 10, fontFace: THEME.bodyFont, fontSize, color: THEME.ink },
  }));
}

function addChartTo(slide, pptx, spec, box) {
  const { kind, categories, series, scoreScale } = spec;
  const data = series.map((s) => ({ name: s.name, labels: categories.map((c) => String(c).slice(0, 28)), values: s.values }));
  const common = {
    ...box,
    showLegend: series.length > 1,
    legendPos: 'b',
    legendFontFace: THEME.bodyFont,
    legendFontSize: 12,
    showValue: true,
    dataLabelFontFace: THEME.bodyFont,
    dataLabelFontSize: 12,
    dataLabelColor: THEME.ink,
    catAxisLabelFontFace: THEME.bodyFont,
    catAxisLabelFontSize: 12,
    catAxisLabelColor: THEME.muted,
    valAxisLabelFontFace: THEME.bodyFont,
    valAxisLabelFontSize: 12,
    valAxisLabelColor: THEME.muted,
    valGridLine: { color: THEME.grid, size: 0.75 },
    catGridLine: { style: 'none' },
    ...(scoreScale ? { valAxisMinVal: 0, valAxisMaxVal: 5 } : {}),
  };
  if (kind === 'line') {
    slide.addChart(pptx.charts.LINE, data, { ...common, chartColors: [THEME.teal], lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 9, dataLabelPosition: 't' });
    return;
  }
  const single = series.length === 1;
  const colors = single && scoreScale
    ? series[0].values.map(scoreColor)
    : single ? [THEME.teal] : [THEME.teal, THEME.comet, THEME.mid, THEME.low];
  slide.addChart(pptx.charts.BAR, data, {
    ...common,
    barDir: categories.length > 6 ? 'bar' : 'col',
    barGapWidthPct: 40,
    chartColors: colors,
    dataLabelPosition: 'outEnd',
    ...(categories.length > 6 ? { catAxisOrientation: 'maxMin' } : {}),
  });
}

function addTableTo(slide, spec, y, scoreCol) {
  const head = spec.head.map((h, i) => ({
    text: h,
    options: { bold: true, color: 'FFFFFF', fill: { color: THEME.night }, fontFace: THEME.bodyFont, fontSize: 13, align: i === 0 ? 'left' : 'right', valign: 'middle' },
  }));
  const body = spec.rows.map((row, r) => row.map((cell, i) => {
    const numeric = Number(String(cell).replace(',', '.'));
    const flagged = i === scoreCol && !Number.isNaN(numeric) && numeric < UMBRAL_ACEPTABLE;
    return {
      text: String(cell),
      options: {
        fontFace: THEME.bodyFont,
        fontSize: 13,
        color: flagged ? '9A2F1F' : THEME.ink,
        bold: flagged || i === 0,
        fill: { color: flagged ? THEME.lowBg : r % 2 ? THEME.tint : 'FFFFFF' },
        align: i === 0 ? 'left' : 'right',
        valign: 'middle',
      },
    };
  }));
  const firstW = CONTENT_W * 0.34;
  const restW = (CONTENT_W - firstW) / Math.max(1, spec.head.length - 1);
  slide.addTable([head, ...body], {
    x: MARGIN, y, w: CONTENT_W,
    colW: [firstW, ...Array(spec.head.length - 1).fill(restW)],
    rowH: 0.42,
    border: { type: 'solid', pt: 0.5, color: THEME.grid },
    margin: [0.04, 0.12, 0.04, 0.12],
  });
}

/**
 * @param {Array} plan diapositivas con include=true (ver slidePlan.js)
 * @param {object} meta { filtersLine, template }
 */
export function buildDeck(plan, meta = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Komet';
  pptx.company = 'Universidad de Santander';
  pptx.title = 'Evaluación de sitios de práctica';
  pptx.lang = 'es-CO';
  pptx.theme = { headFontFace: THEME.headFont, bodyFontFace: THEME.bodyFont };

  const stamp = new Date().toLocaleDateString('es-CO');
  defineLayouts(pptx, `Komet · ${stamp}`);

  const slides = plan.filter((s) => s.include);
  let lastSection = null;

  slides.forEach((s) => {
    if (s.section && s.section !== lastSection) {
      pptx.addSection({ title: s.section });
      lastSection = s.section;
    }
    const sectionTitle = s.section || 'Inicio';

    if (s.type === 'cover') {
      const slide = pptx.addSlide({ masterName: 'KOMET_COVER', sectionTitle });
      slide.addText('Universidad de Santander', { x: 0.8, y: 0.7, w: 8, h: 0.4, fontFace: THEME.bodyFont, fontSize: 16, color: 'A9BCC6', margin: 0, isTextBox: true });
      slide.addText(s.title, { x: 0.8, y: 2.2, w: 8.2, h: 2.2, fontFace: THEME.headFont, fontSize: 44, bold: true, color: 'FFFFFF', margin: 0, valign: 'top', isTextBox: true });
      slide.addText(s.subtitle || '', { x: 0.8, y: 5.6, w: 8, h: 0.9, fontFace: THEME.bodyFont, fontSize: 18, color: 'A9BCC6', margin: 0, valign: 'top', isTextBox: true });
      // Cometa y anillos de la escala, en la esquina derecha
      [1.1, 1.8, 2.5, 3.2, 3.9].forEach((r) => {
        slide.addShape(pptx.ShapeType.ellipse, { x: 11.0 - r, y: 5.0 - r, w: r * 2, h: r * 2, fill: { type: 'none' }, line: { color: '2B4A5A', width: 1 } });
      });
      slide.addShape(pptx.ShapeType.ellipse, { x: 10.55, y: 3.15, w: 0.3, h: 0.3, fill: { color: THEME.comet }, line: { color: THEME.comet, width: 0 } });
      if (s.notes) slide.addNotes(s.notes);
      return;
    }

    const makeContent = (title) => {
      const slide = pptx.addSlide({ masterName: 'KOMET_CONTENT', sectionTitle });
      slide.addText(title, { placeholder: 'title' });
      if (s.notes) slide.addNotes(s.notes);
      return slide;
    };

    if (s.type === 'stat') {
      const slide = makeContent(s.title);
      slide.addText(s.stat.value, { x: MARGIN, y: 2.3, w: 5.6, h: 1.9, fontFace: THEME.headFont, fontSize: 96, bold: true, color: THEME.teal, margin: 0, valign: 'middle', isTextBox: true });
      slide.addText(s.stat.unit, { x: MARGIN, y: 4.2, w: 5.6, h: 0.5, fontFace: THEME.bodyFont, fontSize: 20, color: THEME.muted, margin: 0, isTextBox: true });
      slide.addText(bulletRuns(s.bullets, 18), { x: 6.8, y: 2.4, w: 5.9, h: 3.6, margin: 0, valign: 'top', isTextBox: true });
      return;
    }

    if (s.type === 'chart') {
      const slide = makeContent(s.title);
      const hasText = s.bullets && s.bullets.length;
      addChartTo(slide, pptx, s.chart, { x: MARGIN, y: 1.7, w: hasText ? 8.0 : CONTENT_W, h: 5.1 });
      if (hasText) slide.addText(bulletRuns(s.bullets, 16), { x: 9.0, y: 2.0, w: 3.7, h: 4.4, margin: 0, valign: 'top', isTextBox: true });
      if (s.chart.threshold != null) {
        slide.addText(`Umbral aceptable: ${fmtUmbral()}`, { x: 9.0, y: 6.45, w: 3.7, h: 0.35, fontFace: THEME.bodyFont, fontSize: 12, color: THEME.muted, margin: 0, isTextBox: true });
      }
      return;
    }

    if (s.type === 'table') {
      const rows = s.table.rows;
      for (let i = 0; i < Math.max(1, rows.length); i += ROWS_PER_TABLE_SLIDE) {
        const part = { ...s.table, rows: rows.slice(i, i + ROWS_PER_TABLE_SLIDE) };
        const slide = i === 0 ? makeContent(s.title) : (() => {
          const next = pptx.addSlide({ masterName: 'KOMET_CONTENT', sectionTitle });
          next.addText(`${s.title} (continuación)`, { placeholder: 'title' });
          return next;
        })();
        addTableTo(slide, part, 1.8, s.table.scoreCol);
      }
      return;
    }

    if (s.type === 'figures') {
      const slide = makeContent(s.title);
      const n = s.figures.length;
      const gap = 0.3;
      const cardW = (CONTENT_W - gap * (n - 1)) / n;
      s.figures.forEach((f, i) => {
        const x = MARGIN + i * (cardW + gap);
        slide.addShape(pptx.ShapeType.rect, { x, y: 2.3, w: cardW, h: 3.2, fill: { color: THEME.tint }, line: { color: THEME.tint, width: 0 } });
        slide.addText(f.value, { x: x + 0.3, y: 2.7, w: cardW - 0.6, h: 1.3, fontFace: THEME.headFont, fontSize: 54, bold: true, color: THEME.teal, margin: 0, isTextBox: true });
        slide.addText(f.label, { x: x + 0.3, y: 4.1, w: cardW - 0.6, h: 0.5, fontFace: THEME.bodyFont, fontSize: 18, bold: true, color: THEME.ink, margin: 0, isTextBox: true });
        slide.addText(f.note, { x: x + 0.3, y: 4.65, w: cardW - 0.6, h: 0.4, fontFace: THEME.bodyFont, fontSize: 14, color: THEME.muted, margin: 0, isTextBox: true });
      });
      return;
    }

    if (s.type === 'columns') {
      const slide = makeContent(s.title);
      const gap = 0.4;
      const colW = (CONTENT_W - gap) / 2;
      s.columns.forEach((col, i) => {
        const x = MARGIN + i * (colW + gap);
        slide.addShape(pptx.ShapeType.rect, { x, y: 1.9, w: colW, h: 4.7, fill: { color: THEME.tint }, line: { color: THEME.tint, width: 0 } });
        slide.addText(col.heading, { x: x + 0.3, y: 2.1, w: colW - 0.6, h: 0.5, fontFace: THEME.headFont, fontSize: 22, bold: true, color: THEME.teal, margin: 0, isTextBox: true });
        slide.addText(bulletRuns(col.items.length ? col.items : ['Sin datos suficientes'], 15), { x: x + 0.3, y: 2.8, w: colW - 0.6, h: 3.6, margin: 0, valign: 'top', isTextBox: true });
      });
      return;
    }

    // 'bullets'
    const slide = makeContent(s.title);
    slide.addText(bulletRuns(s.bullets.length ? s.bullets : ['Sin datos suficientes'], 20), { x: MARGIN, y: 1.9, w: CONTENT_W, h: 4.7, margin: 0, valign: 'top', isTextBox: true });
  });

  return pptx;
}

export async function downloadDeck(plan, meta = {}) {
  const pptx = buildDeck(plan, meta);
  const tag = new Date().toISOString().slice(0, 10);
  await pptx.writeFile({ fileName: `Komet-Presentacion-${tag}.pptx` });
}
