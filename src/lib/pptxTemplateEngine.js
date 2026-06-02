/**
 * pptxTemplateEngine.js — v2
 * 
 * Motor de edicion de plantillas PPTX en el navegador.
 * Soporta: shapes de texto (<p:sp>), tablas (<p:graphicFrame> con a:tbl),
 * shapes agrupados (<p:grpSp>), y reemplazo masivo de texto.
 */

import JSZip from 'jszip';

const NS = {
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
};

export class PptxTemplateEngine {
  constructor() {
    this.zip = null;
    this.slides = {}; // { slideNum: xmlDoc }
  }

  async load(source) {
    let data;
    if (typeof source === 'string') {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`No se pudo cargar la plantilla: ${response.statusText}`);
      data = await response.arrayBuffer();
    } else if (source instanceof ArrayBuffer) {
      data = source;
    } else {
      throw new Error('La fuente debe ser una URL o un ArrayBuffer');
    }
    this.zip = await JSZip.loadAsync(data);
    await this._parseAllSlides();
    return this;
  }

  async _parseAllSlides() {
    const slideFiles = Object.keys(this.zip.files).filter(
      (name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    );
    for (const filePath of slideFiles) {
      const match = filePath.match(/slide(\d+)\.xml$/);
      if (!match) continue;
      const slideNum = parseInt(match[1], 10);
      const xmlStr = await this.zip.files[filePath].async('string');
      this.slides[slideNum] = this._parseXml(xmlStr);
    }
  }

  _parseXml(xmlStr) {
    const parser = new DOMParser();
    return parser.parseFromString(xmlStr, 'application/xml');
  }

  _serializeXml(doc) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  /**
   * Busca un elemento por su nombre 'name' en el XML de una diapositiva.
   * Busca en TODOS los tipos de elementos: p:sp, p:graphicFrame, y dentro de p:grpSp.
   */
  _findElementByName(slideDoc, targetName) {
    const sps = slideDoc.getElementsByTagNameNS(NS.p, 'sp');
    for (const el of sps) {
      const cNvPr = el.getElementsByTagNameNS(NS.p, 'cNvPr')[0];
      if (cNvPr && cNvPr.getAttribute('name') === targetName) return el;
    }

    const gfs = slideDoc.getElementsByTagNameNS(NS.p, 'graphicFrame');
    for (const el of gfs) {
      const cNvPr = el.getElementsByTagNameNS(NS.p, 'cNvPr')[0];
      if (cNvPr && cNvPr.getAttribute('name') === targetName) return el;
    }

    const grps = slideDoc.getElementsByTagNameNS(NS.p, 'grpSp');
    for (const grp of grps) {
      const found = this._findInGroup(grp, targetName);
      if (found) return found;
    }

    return null;
  }

  _findInGroup(groupEl, targetName) {
    const sps = groupEl.getElementsByTagNameNS(NS.p, 'sp');
    for (const el of sps) {
      const cNvPr = el.getElementsByTagNameNS(NS.p, 'cNvPr')[0];
      if (cNvPr && cNvPr.getAttribute('name') === targetName) return el;
    }
    const gfs = groupEl.getElementsByTagNameNS(NS.p, 'graphicFrame');
    for (const el of gfs) {
      const cNvPr = el.getElementsByTagNameNS(NS.p, 'cNvPr')[0];
      if (cNvPr && cNvPr.getAttribute('name') === targetName) return el;
    }
    const grps = groupEl.getElementsByTagNameNS(NS.p, 'grpSp');
    for (const subGrp of grps) {
      const found = this._findInGroup(subGrp, targetName);
      if (found) return found;
    }
    return null;
  }

  setText(slideNum, shapeName, newText) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) throw new Error(`Slide ${slideNum} no encontrado`);

    const element = this._findElementByName(slideDoc, shapeName);
    if (!element) throw new Error(`Shape "${shapeName}" no encontrado en slide ${slideNum}`);

    this._replaceTextInElement(element, String(newText));
  }

  _replaceTextInElement(element, newText) {
    const txBody = element.getElementsByTagNameNS(NS.p, 'txBody')[0]
      || element.getElementsByTagNameNS(NS.a, 'txBody')[0];
    
    if (txBody) {
      const tElements = txBody.getElementsByTagNameNS(NS.a, 't');
      if (tElements.length > 0) {
        tElements[0].textContent = newText;
        for (let i = 1; i < tElements.length; i++) {
          tElements[i].textContent = '';
        }
        return;
      }
    }

    const tElements = element.getElementsByTagNameNS(NS.a, 't');
    if (tElements.length > 0) {
      tElements[0].textContent = newText;
      for (let i = 1; i < tElements.length; i++) {
        tElements[i].textContent = '';
      }
    }
  }

  replaceTextByContent(slideNum, searchText, newText) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) throw new Error(`Slide ${slideNum} no encontrado`);

    const sps = slideDoc.getElementsByTagNameNS(NS.p, 'sp');
    for (const sp of sps) {
      const tElements = sp.getElementsByTagNameNS(NS.a, 't');
      for (const t of tElements) {
        if (t.textContent && t.textContent.trim().includes(searchText)) {
          t.textContent = newText;
          return true;
        }
      }
    }
    return false;
  }

  setTableData(slideNum, tableShapeName, data) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) throw new Error(`Slide ${slideNum} no encontrado`);

    const element = this._findElementByName(slideDoc, tableShapeName);
    if (!element) throw new Error(`Tabla "${tableShapeName}" no encontrada en slide ${slideNum}`);

    const tbl = element.getElementsByTagNameNS(NS.a, 'tbl')[0];
    if (!tbl) throw new Error(`Elemento "${tableShapeName}" no contiene una tabla (a:tbl)`);

    const rows = tbl.getElementsByTagNameNS(NS.a, 'tr');
    for (let rowIdx = 0; rowIdx < data.length && rowIdx < rows.length; rowIdx++) {
      const cells = rows[rowIdx].getElementsByTagNameNS(NS.a, 'tc');
      for (let colIdx = 0; colIdx < data[rowIdx].length && colIdx < cells.length; colIdx++) {
        this._replaceTextInElement(cells[colIdx], String(data[rowIdx][colIdx]));
      }
    }
  }

  setTableCell(slideNum, tableShapeName, row, col, newText) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) throw new Error(`Slide ${slideNum} no encontrado`);

    const element = this._findElementByName(slideDoc, tableShapeName);
    if (!element) throw new Error(`Shape "${tableShapeName}" no encontrada en slide ${slideNum}`);

    const tbl = element.getElementsByTagNameNS(NS.a, 'tbl')[0];
    if (!tbl) throw new Error(`Elemento "${tableShapeName}" no contiene tabla`);

    const rows = tbl.getElementsByTagNameNS(NS.a, 'tr');
    if (row >= rows.length) throw new Error(`Fila ${row} fuera de rango`);
    const cells = rows[row].getElementsByTagNameNS(NS.a, 'tc');
    if (col >= cells.length) throw new Error(`Columna ${col} fuera de rango`);

    this._replaceTextInElement(cells[col], String(newText));
  }

  replaceAllExactText(slideNum, oldText, newText) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) return 0;

    const allElements = this._getAllTextContainers(slideDoc);
    let count = 0;

    for (const container of allElements) {
      const tElements = container.getElementsByTagNameNS(NS.a, 't');
      for (const t of tElements) {
        if (t.textContent && t.textContent.trim() === oldText.trim()) {
          t.textContent = newText;
          count++;
        }
      }
    }
    return count;
  }

  _getAllTextContainers(slideDoc) {
    const containers = [];

    const sps = slideDoc.getElementsByTagNameNS(NS.p, 'sp');
    for (const sp of sps) containers.push(sp);

    const gfs = slideDoc.getElementsByTagNameNS(NS.p, 'graphicFrame');
    for (const gf of gfs) containers.push(gf);

    const grps = slideDoc.getElementsByTagNameNS(NS.p, 'grpSp');
    for (const grp of grps) {
      const nestedSps = grp.getElementsByTagNameNS(NS.p, 'sp');
      for (const sp of nestedSps) containers.push(sp);
      const nestedGfs = grp.getElementsByTagNameNS(NS.p, 'graphicFrame');
      for (const gf of nestedGfs) containers.push(gf);
    }

    return containers;
  }

  replaceAllNamed(slideNum, shapeName, newText) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) return 0;

    const allElements = this._getAllTextContainers(slideDoc);
    let count = 0;

    for (const el of allElements) {
      const cNvPr = el.getElementsByTagNameNS(NS.p, 'cNvPr')[0];
      if (cNvPr && cNvPr.getAttribute('name') === shapeName) {
        this._replaceTextInElement(el, String(newText));
        count++;
      }
    }
    return count;
  }

  replaceShapeByContent(slideNum, searchText, newText) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) return false;

    const containers = this._getAllTextContainers(slideDoc);
    for (const container of containers) {
      const tElements = container.getElementsByTagNameNS(NS.a, 't');
      for (const t of tElements) {
        if (t.textContent && t.textContent.trim().includes(searchText)) {
          this._replaceTextInElement(container, String(newText));
          return true;
        }
      }
    }
    return false;
  }

  setFirstShapeText(slideNum, newText) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) return;

    const containers = this._getAllTextContainers(slideDoc);
    for (const container of containers) {
      const tElements = container.getElementsByTagNameNS(NS.a, 't');
      if (tElements.length > 0 && tElements[0].textContent.trim()) {
        tElements[0].textContent = String(newText);
        for (let i = 1; i < tElements.length; i++) tElements[i].textContent = '';
        return;
      }
    }
  }

  applyOperations(slideNum, operations) {
    let successCount = 0;
    for (const op of operations) {
      try {
        switch (op.type) {
          case 'byName':
            this.setText(slideNum, op.name, op.value);
            successCount++;
            break;
          case 'byContent':
            if (this.replaceShapeByContent(slideNum, op.search, op.value)) successCount++;
            break;
          case 'replaceText':
            if (this.replaceTextByContent(slideNum, op.search, op.value)) successCount++;
            break;
          case 'table':
            this.setTableData(slideNum, op.name, op.data);
            successCount++;
            break;
        }
      } catch (e) {
        console.warn(`Op ${op.type} slide ${slideNum}: ${e.message}`);
      }
    }
    return successCount;
  }

  listShapes(slideNum) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) return [];

    const containers = this._getAllTextContainers(slideDoc);
    const result = [];

    for (const container of containers) {
      const cNvPr = container.getElementsByTagNameNS(NS.p, 'cNvPr')[0];
      const name = cNvPr ? cNvPr.getAttribute('name') || '(sin nombre)' : '(sin nombre)';
      const tElements = container.getElementsByTagNameNS(NS.a, 't');
      const texts = [];
      for (const t of tElements) {
        if (t.textContent && t.textContent.trim()) texts.push(t.textContent.trim());
      }
      if (texts.length > 0) {
        result.push({ name, texts });
      }
    }
    return result;
  }

  async toBlob() {
    if (!this.zip) throw new Error('No hay plantilla cargada');
    for (const [slideNum, doc] of Object.entries(this.slides)) {
      this.zip.file(`ppt/slides/slide${slideNum}.xml`, this._serializeXml(doc));
    }
    return await this.zip.generateAsync({ type: 'blob' });
  }

  async download(fileName = 'informe-autoevaluacion.pptx') {
    const blob = await this.toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

// ─── Ayudantes para análisis de datos reales ───

function avg(values) {
  const valid = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  return valid.length ? Number((valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(2)) : null;
}

/**
 * Agrupa los sectionScores de todas las filas y promedia por título de sección.
 * Retorna [{ titulo, score, count, interpretacion }]
 */
function aggregateSectionScores(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    const sections = row?.scoreSummary?.sectionScores;
    if (!Array.isArray(sections)) return;
    sections.forEach((sec) => {
      const title = sec?.title || 'General';
      if (!map.has(title)) map.set(title, []);
      if (typeof sec?.score === 'number') map.get(title).push(sec.score);
    });
  });

  const result = [];
  for (const [titulo, scores] of map) {
    const score = avg(scores);
    result.push({
      titulo: titulo.toUpperCase(),
      score,
      count: scores.length,
      interpretacion: score >= 4.5 ? 'Fortaleza consolidada'
        : score >= 4.0 ? 'Cumple ampliamente'
        : score >= 3.5 ? 'Requiere mejoras puntuales'
        : score >= 3.0 ? 'Oportunidades de mejora significativas'
        : score >= 2.0 ? 'Acciones correctivas requeridas'
        : 'Intervencion inmediata'
    });
  }

  if (!result.length) {
    return [
      { titulo: 'ASPECTOS GENERALES', score: null, count: 0, interpretacion: 'Sin datos' },
      { titulo: 'CAPACIDAD INSTALADA', score: null, count: 0, interpretacion: 'Sin datos' },
      { titulo: 'SEGURIDAD, PROTECCION Y BIENESTAR', score: null, count: 0, interpretacion: 'Sin datos' },
      { titulo: 'ORGANIZACION ADMINISTRATIVA', score: null, count: 0, interpretacion: 'Sin datos' },
      { titulo: 'PRACTICAS FORMATIVAS', score: null, count: 0, interpretacion: 'Sin datos' },
      { titulo: 'CULTURA DE MEJORAMIENTO CONTINUO', score: null, count: 0, interpretacion: 'Sin datos' }
    ];
  }

  return result;
}

/**
 * Construye las operaciones de inyeccion de datos en la plantilla PPTX.
 *
 * @param {Object} metrics - Metricas computadas desde KometPresenta
 * @param {Object} filters - Filtros aplicados (campus, level, center, program)
 * @param {Object} narrative - Narrativa IA o fallback { hallazgos, riesgos, acciones }
 * @param {Array} [rows] - Filas de datos filtradas (para datos cualitativos y secciones reales)
 */
export function buildTemplateData(metrics, filters, narrative, rows = []) {
  const year = new Date().getFullYear();
  const topCenter = metrics.byCenter[0];
  const topProgram = metrics.byProgram[0];

  const h = narrative?.hallazgos || [];
  const r = narrative?.riesgos || [];
  const a = narrative?.acciones || [];

  const centerName = filters.center === 'Todos'
    ? (topCenter?.name || 'GENERAL')
    : filters.center;
  const programName = filters.program === 'Todos'
    ? (topProgram?.name || 'TODOS LOS PROGRAMAS')
    : filters.program;

  const globalScore = metrics.kpis.globalScore;
  const completed = metrics.kpis.completed;
  const completionPct = metrics.kpis.completionPct;

  // Roles: conteos y puntajes reales desde metrics.byRole
  const coordRole = metrics.byRole.find(rr => rr.name.toLowerCase().includes('coord'));
  const docRole = metrics.byRole.find(rr => rr.name.toLowerCase().includes('doc'));
  const estRole = metrics.byRole.find(rr => rr.name.toLowerCase().includes('est'));
  const coordScore = coordRole?.score || globalScore;
  const docenteScore = docRole?.score || globalScore;
  const estudianteScore = estRole?.score || globalScore;

  // ── Analisis por centro y rol ──
  const centerAnalysis = metrics.centerAnalysis || [];

  // Promedio general de centros para calcular desviacion vs promedio
  const avgCenterScore = centerAnalysis.length
    ? centerAnalysis.reduce((s, c) => s + c.score, 0) / centerAnalysis.length
    : 0;

  // Texto de ranking de centros con desglose completo por rol y desviacion vs promedio
  const centerRankingText = centerAnalysis.length > 0
    ? '\n\n═══ ANALISIS DETALLADO POR CENTRO DE PRACTICA ═══\n' +
      'Centro                 | Total | Prom. | Estud. | Docentes | Coord. | Vs Prom.\n' +
      '───────────────────────|───────|───────|────────|──────────|────────|─────────\n' +
      centerAnalysis.slice(0, 8).map((c) => {
        const diff = c.score - avgCenterScore;
        const diffStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(2).replace('.', ',')}`;
        const name = c.name.padEnd(22).substring(0, 22);
        const total = String(c.total).padStart(5);
        const score = c.score.toFixed(2).replace('.', ',').padStart(5);
        const est = (c.byRole['Estudiantes']?.score || 0).toFixed(1).replace('.', ',').padStart(4);
        const doc = (c.byRole['Docentes']?.score || 0).toFixed(1).replace('.', ',').padStart(6);
        const coord = (c.byRole['Coordinadores']?.score || 0).toFixed(1).replace('.', ',').padStart(6);
        return `${name} | ${total} | ${score} | ${est} | ${doc} | ${coord} | ${diffStr}`;
      }).join('\n') +
      '\n──────────────────────────────────────────────────────────────────────' +
      `\nPromedio general centros: ${avgCenterScore.toFixed(2).replace('.', ',')}` +
      ` | Mejor: ${centerAnalysis[0].name} (${centerAnalysis[0].score.toFixed(2).replace('.', ',')})` +
      ` | Menor: ${centerAnalysis[centerAnalysis.length - 1].name} (${centerAnalysis[centerAnalysis.length - 1].score.toFixed(2).replace('.', ',')})` +
      ` | Brecha: ${(centerAnalysis[0].score - centerAnalysis[centerAnalysis.length - 1].score).toFixed(2).replace('.', ',')} pts`
    : '';

  // Secciones del instrumento (para slide 7: PUNTAJES POR SECCION)
  const sections = aggregateSectionScores(rows);

  const analisisCompleto = narrative?.analisis_completo || '';
  const resumen = narrative?.resumen || '';

  return [
    // ═══ SLIDE 2 — PORTADA ═══
    { slide: 2, type: 'replaceText', search: '2025', value: String(year) },
    { slide: 2, type: 'byContent', search: 'INFORME', value: `INFORME DE AUTOEVALUACION\nPRACTICAS FORMATIVAS ${year}` },
    { slide: 2, type: 'byContent', search: 'CLINICA', value: `${centerName}` },
    { slide: 2, type: 'byContent', search: 'ESPECIALIDAD', value: `${programName}` },
    { slide: 2, type: 'byContent', search: 'SEDE', value: `Campus: ${filters.campus} | Nivel: ${filters.level}` },
    { slide: 2, type: 'byContent', search: 'FECHA', value: `${year}` },

    // ═══ SLIDE 3 — ESTUDIANTES ═══
    { slide: 3, type: 'byContent', search: 'ESTUDIANTES', value: [
      'DATOS GENERALES DE LA EVALUACION',
      '',
      `Centro evaluado: ${centerName}`,
      `Programa: ${programName}`,
      `Campus: ${filters.campus} | Nivel: ${filters.level}`,
      '',
      `Total evaluaciones: ${metrics.kpis.total}`,
      `Completadas: ${completed} (${completionPct.toFixed(1)}%)`,
      '',
      '--- EVALUADORES POR ROL ---',
      `Estudiantes que evaluaron: ${estRole?.total || 0}`,
      `Docentes que evaluaron: ${docRole?.total || 0}`,
      `Coordinadores que evaluaron: ${coordRole?.total || 0}`,
      '',
      `Puntaje promedio estudiantes: ${estudianteScore.toFixed(1).replace('.', ',')} / 5,0`,
      `Puntaje promedio docentes: ${docenteScore.toFixed(1).replace('.', ',')} / 5,0`,
      `Puntaje promedio coordinadores: ${coordScore.toFixed(1).replace('.', ',')} / 5,0`
    ].join('\n') },

    // ═══ SLIDE 4 — TABLA DATOS GENERALES ═══
    {
      slide: 4, type: 'table', name: 'Tabla 4',
      data: [
        ['Docentes a cargo', 'N total de estudiantes', 'Coordinadores', 'Total evaluaciones'],
        [
          String(docRole?.total || estRole?.total || '—'),
          String(estRole?.total || '—'),
          String(coordRole?.total || '—'),
          String(metrics.kpis.total)
        ],
        [
          `Prom: ${docenteScore.toFixed(1).replace('.', ',')}`,
          `Prom: ${estudianteScore.toFixed(1).replace('.', ',')}`,
          `Prom: ${coordScore.toFixed(1).replace('.', ',')}`,
          `${metrics.dateRange || 'Actual'}`
        ]
      ]
    },

    // ═══ SLIDE 5 — COMPETENCIAS / RESULTADOS DE APRENDIZAJE (contenido IA) ═══
    {
      slide: 5, type: 'byContent', search: 'COMPETENCIA', value: [
        'RESULTADOS DE APRENDIZAJE — ANALISIS IA',
        '',
        ...(h.length > 0
          ? h.map((item, i) => `${i + 1}. ${item}`)
          : ['No se generaron hallazgos automaticos.']
        ),
        '',
        '--- SUGERENCIAS PRIORIZADAS ---',
        ...(a.slice(0, 5).map((item, i) => `  ${String.fromCharCode(65 + i)}. ${item}`))
      ].join('\n')
    },

    // ═══ SLIDE 6 — MODELO DE AUTOEVALUACION ═══
    { slide: 6, type: 'byContent', search: 'MODELO', value: [
      'MODELO DE AUTOEVALUACION DE LA RELACION DOCENCIA SERVICIO',
      '(ACUERDO 00273 DE 2021)',
      '(MERDS)',
      '',
      `Centro evaluado: ${centerName}`,
      `Programa: ${programName}`,
      `Evaluaciones procesadas: ${metrics.kpis.total}`,
      `Cobertura: ${completionPct.toFixed(1)}%`
    ].join('\n') },

    // ═══ SLIDE 7 — EVALUACION RDS ═══
    { slide: 7, type: 'byContent', search: 'EVALUACI'+'ÓN', value: [
      'EVALUACION DE LA RELACION DOCENCIA SERVICIO',
      `${centerName} — ${programName}`,
      `Periodo: ${metrics.dateRange || year}`
    ].join('\n') },
    { slide: 7, type: 'byContent', search: 'Colocar tabla', value: [
      `RESULTADOS GLOBALES — ${centerName}`,
      `Promedio General: ${globalScore.toFixed(1).replace('.', ',')} / 5,0`,
      `Evaluaciones: ${metrics.kpis.total} (Completadas: ${completed})`,
      `Tasa de Respuesta: ${completionPct.toFixed(1)}%`,
      `Centros: ${metrics.kpis.centers} | Programas: ${metrics.kpis.programs}`,
      '',
      `Desglose por rol — Est.: ${estudianteScore.toFixed(1).replace('.', ',')} | Doc.: ${docenteScore.toFixed(1).replace('.', ',')} | Coord.: ${coordScore.toFixed(1).replace('.', ',')}`,
      `Mejor centro: ${topCenter?.name || 'N/A'} (${topCenter?.score.toFixed(1).replace('.', ',') || '—'})`,
      `Menor centro: ${metrics.lowCenter?.name || 'N/A'} (${metrics.lowCenter?.score.toFixed(1).replace('.', ',') || '—'})`,
      `Brecha: ${(topCenter && metrics.lowCenter) ? (topCenter.score - metrics.lowCenter.score).toFixed(1).replace('.', ',') : '—'}`,
      '',
      `Distribucion: 0-2: ${metrics.distribution[0].count} | 2-3: ${metrics.distribution[1].count} | 3-4: ${metrics.distribution[2].count} | 4-5: ${metrics.distribution[3].count}`,
      centerRankingText,
      '',
      '--- PUNTAJES POR SECCION DEL INSTRUMENTO ---',
      ...sections.filter(s => s.score !== null).map(s =>
        `${s.titulo}: ${s.score.toFixed(1).replace('.', ',')} (${s.interpretacion})`
      )
    ].join('\n') },

    // ═══ SLIDE 8 — COORDINADOR (contenido IA) ═══
    { slide: 8, type: 'byContent', search: 'OBSERVACIONES DE', value: [
      'ANALISIS IA — VISION ESTRATEGICA',
      '',
      resumen || 'Sin resumen ejecutivo disponible.',
      '',
      '--- ANALISIS COMPLETO ---',
      analisisCompleto || 'No se genero analisis profundo.'
    ].join('\n') },

    // ═══ SLIDE 9 — ESTUDIANTES (contenido IA) ═══
    { slide: 9, type: 'byContent', search: 'OBSERVACIONES DE LA EVALUACI'+'ÓN', value: [
      'HALLAZGOS PRINCIPALES — PERCEPCION ESTUDIANTIL',
      '',
      ...(h.length > 0
        ? h.map((item, i) => `${i + 1}. ${item}`)
        : ['No se generaron hallazgos automaticos.']
      ),
      '',
      '--- RIESGOS IDENTIFICADOS ---',
      ...(r.length > 0
        ? r.map((item, i) => `  ${String.fromCharCode(65 + i)}. ${item}`)
        : ['No se identificaron riesgos significativos.']
      )
    ].join('\n') },

    // ═══ SLIDE 10 — DOCENTES (contenido IA) ═══
    { slide: 10, type: 'byContent', search: 'OBSERVACIONES DE LA EVALUACI'+'ÓN', value: [
      'PLAN DE ACCION Y SUGERENCIAS ESTRATEGICAS',
      '',
      ...(a.length > 0
        ? a.map((item, i) => `${i + 1}. ${item}`)
        : ['No se generaron sugerencias automaticas.']
      ),
      '',
      '--- ACCIONES PRIORITARIAS ---',
      ...(h.slice(0, 3).length > 0
        ? h.slice(0, 3).map((item, i) => `  ${i + 1}. ${item}`)
        : ['Sin informacion adicional.']
      )
    ].join('\n') },

    // ═══ SLIDE 11 — OPORTUNIDADES DE MEJORA ═══
    { slide: 11, type: 'byContent', search: 'OPORTUNIDADES', value: [
      'OPORTUNIDADES DE MEJORA',
      '',
      ...(a.length > 0
        ? a.map((item, i) => `${i + 1}. ${item}`)
        : ['No se generaron oportunidades de mejora automaticas.']),
      '',
      `Generado por Komet Analytics | ${new Date().toLocaleDateString('es-CO')}`
    ].join('\n') }
  ];
}
