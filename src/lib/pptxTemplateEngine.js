/**
 * pptxTemplateEngine.js — v2
 * 
 * Motor de edición de plantillas PPTX en el navegador.
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
    // 1. Buscar en shapes regulares (<p:sp>)
    const sps = slideDoc.getElementsByTagNameNS(NS.p, 'sp');
    for (const el of sps) {
      const cNvPr = el.getElementsByTagNameNS(NS.p, 'cNvPr')[0];
      if (cNvPr && cNvPr.getAttribute('name') === targetName) return el;
    }

    // 2. Buscar en graphic frames (<p:graphicFrame>) — contienen tablas
    const gfs = slideDoc.getElementsByTagNameNS(NS.p, 'graphicFrame');
    for (const el of gfs) {
      const cNvPr = el.getElementsByTagNameNS(NS.p, 'cNvPr')[0];
      if (cNvPr && cNvPr.getAttribute('name') === targetName) return el;
    }

    // 3. Buscar dentro de grupos (<p:grpSp>) — shapes anidados
    const grps = slideDoc.getElementsByTagNameNS(NS.p, 'grpSp');
    for (const grp of grps) {
      const found = this._findInGroup(grp, targetName);
      if (found) return found;
    }

    return null;
  }

  /**
   * Búsqueda recursiva dentro de un grupo de shapes.
   */
  _findInGroup(groupEl, targetName) {
    // Shapes dentro del grupo
    const sps = groupEl.getElementsByTagNameNS(NS.p, 'sp');
    for (const el of sps) {
      const cNvPr = el.getElementsByTagNameNS(NS.p, 'cNvPr')[0];
      if (cNvPr && cNvPr.getAttribute('name') === targetName) return el;
    }
    // Graphic frames dentro del grupo
    const gfs = groupEl.getElementsByTagNameNS(NS.p, 'graphicFrame');
    for (const el of gfs) {
      const cNvPr = el.getElementsByTagNameNS(NS.p, 'cNvPr')[0];
      if (cNvPr && cNvPr.getAttribute('name') === targetName) return el;
    }
    // Subgrupos
    const grps = groupEl.getElementsByTagNameNS(NS.p, 'grpSp');
    for (const subGrp of grps) {
      const found = this._findInGroup(subGrp, targetName);
      if (found) return found;
    }
    return null;
  }

  /**
   * Busca un shape y reemplaza su texto.
   * Ahora también maneja shapes SIN nombre (busca por posición/orden).
   */
  setText(slideNum, shapeName, newText) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) throw new Error(`Slide ${slideNum} no encontrado`);

    const element = this._findElementByName(slideDoc, shapeName);
    if (!element) throw new Error(`Shape "${shapeName}" no encontrado en slide ${slideNum}`);

    this._replaceTextInElement(element, String(newText));
  }

  /**
   * Reemplaza texto en un elemento XML (shape, celda de tabla, etc.).
   */
  _replaceTextInElement(element, newText) {
    // Intentar txBody (shapes de texto)
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

    // Si no hay txBody, buscar textos directamente (caso tablas)
    const tElements = element.getElementsByTagNameNS(NS.a, 't');
    if (tElements.length > 0) {
      tElements[0].textContent = newText;
      for (let i = 1; i < tElements.length; i++) {
        tElements[i].textContent = '';
      }
    }
  }

  /**
   * Busca el primer texto que contenga un substring y lo reemplaza.
   * Útil para shapes sin nombre que tienen texto conocido.
   */
  replaceTextByContent(slideNum, searchText, newText) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) throw new Error(`Slide ${slideNum} no encontrado`);

    // Buscar en shapes de texto
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

  /**
   * Reemplaza datos en una tabla.
   * Busca en shapes regulares y en graphic frames.
   */
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

  /**
   * Reemplaza texto en una celda específica de tabla.
   */
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

  /**
   * Reemplaza texto en TODOS los shapes que tengan texto IDÉNTICO al buscado.
   * Busca en toda la diapositiva, sin importar el nombre del shape.
   */
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

  /**
   * Obtiene TODOS los elementos que contengan texto en una diapositiva.
   * Incluye sp, graphicFrame, y elementos dentro de grpSp.
   */
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

  /**
   * Reemplaza texto en TODOS los shapes con nombre específico.
   */
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

  /**
   * Reemplaza TODO el texto de un shape encontrado por su contenido de texto.
   * Busca el PRIMER shape que contenga el searchText y reemplaza TODOS sus
   * elementos <a:t> con el nuevo texto.
   * Ideal para shapes SIN nombre (name="" ).
   */
  replaceShapeByContent(slideNum, searchText, newText) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) return false;

    const containers = this._getAllTextContainers(slideDoc);
    for (const container of containers) {
      const tElements = container.getElementsByTagNameNS(NS.a, 't');
      for (const t of tElements) {
        if (t.textContent && t.textContent.trim().includes(searchText)) {
          // Encontramos el shape. Reemplazar TODOS los <a:t> en este contenedor.
          this._replaceTextInElement(container, String(newText));
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Reemplaza texto en el PRIMER shape que contenga texto.
   * Útil cuando los shapes no tienen nombre pero sabemos qué slide es.
   */
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

  /**
   * Reemplazo masivo inteligente con múltiples estrategias:
   * - type='byName': llama setText(slideNum, name, value)
   * - type='byContent': llama replaceShapeByContent(slideNum, search, value) para shapes sin nombre
   * - type='replaceText': llama replaceTextByContent(slideNum, search, value) para reemplazo parcial de <a:t>
   * - type='table': llama setTableData(slideNum, name, data)
   * @param {number} slideNum 
   * @param {Array<{type: string, name?: string, search?: string, value?: string, data?: Array}>} operations
   */
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

  /**
   * Lista todos los shapes con nombre y texto en una diapositiva.
   * Útil para depuración.
   */
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

/**
 * Construye las operaciones de inyección de datos en la plantilla PPTX.
 *
 * Mapea contra la estructura REAL de la plantilla:
 *   - Slide 2: Portada → shapes sin nombre con "INFORME DE AUTOEVALUACIÓN" y año
 *   - Slide 3: Estudiantes → shape "2 Diagrama" + shape sin nombre con "ESTUDIANTES"
 *   - Slide 4: Tabla "Tabla 4" (Datos generales)
 *   - Slide 5: Tabla "Tabla 4" (Competencias / Resultados)
 *   - Slide 6: CuadroTexto 5/6 → "MODELO DE AUTOEVALUACIÓN..."
 *   - Slide 7: Tabla "Tabla 4" (Grid 6 condiciones × Coord/Doc/Est/Prom) + Título 1
 *   - Slide 8: Tabla "Marcador de contenido 4", texto "Marcador de texto 3", "Título 1"
 *   - Slide 9: Tabla "Marcador de contenido 4", texto "Marcador de texto 3"
 *   - Slide 10: Tabla "Marcador de contenido 4", texto "Marcador de texto 3"
 *   - Slide 11: Rectángulo 6 → "OPORTUNIDADES DE MEJORA"
 *
 * Tipos de operación:
 *   byContent  → replaceShapeByContent: busca shape por contenido y reemplaza TODO su texto
 *   replaceText → replaceTextByContent: busca un <a:t> específico y lo reemplaza
 *   byName     → setText: busca shape por nombre exacto y reemplaza su texto
 *   table      → setTableData: reemplaza datos de una tabla
 */
export function buildTemplateData(metrics, filters, narrative) {
  const year = new Date().getFullYear();
  const topCenter = metrics.byCenter[0];
  const topProgram = metrics.byProgram[0];
  const topCampus = metrics.byCampus[0];

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

  // Puntajes por rol para la tabla del Slide 7
  const coordRole = metrics.byRole.find(rr => rr.name.toLowerCase().includes('coord'));
  const docRole = metrics.byRole.find(rr => rr.name.toLowerCase().includes('doc'));
  const estRole = metrics.byRole.find(rr => rr.name.toLowerCase().includes('est'));
  const coordScore = coordRole?.score || globalScore;
  const docenteScore = docRole?.score || globalScore;
  const estudianteScore = estRole?.score || globalScore;

  // 6 condiciones del modelo Acuerdo 00273 de 2021
  const condiciones = [
    '1. ASPECTOS GENERALES',
    '2. CAPACIDAD INSTALADA',
    '3. SEGURIDAD, PROTECCIÓN Y BIENESTAR',
    '4. ORGANIZACIÓN ADMINISTRATIVA PARA LA DOCENCIA SERVICIO',
    '5. PRACTICAS FORMATIVAS',
    '6. CULTURA DEL MEJORAMIENTO CONTINUO'
  ];

  // ── Análisis por centro y rol (usado en slides 8-10 y datos adicionales) ──
  const centerAnalysis = metrics.centerAnalysis || [];

  // ── Distribuir hallazgos/riesgos/acciones en 6 condiciones (slides 8-10) ──
  // Usa round-robin para que cada condición reciba narrativa única disponible
  const condTableHeader = ['CONDICIONES DE CALIDAD DE LA RDS EVALUADAS', 'FORTALEZAS', 'DIFICULTADES', 'SUGERENCIAS PARA MEJORAR'];

  const buildQualTable = (itemsH, itemsR, itemsA) => [
    condTableHeader,
    ...condiciones.map((cond, i) => [
      cond,
      itemsH[i % itemsH.length] || 'Sin datos',
      itemsR[i % itemsR.length] || 'Sin datos',
      itemsA[i % itemsA.length] || 'Sin datos'
    ])
  ];

  const qualTableCoord = buildQualTable(h, r, a);
  const qualTableEst = buildQualTable(h, r, a);
  const qualTableDoc = buildQualTable(h, r, a);

  // Texto adicional con ranking de centros para slide 7
  const centerRankingText = centerAnalysis.length > 0
    ? '\n\nRANKING DE CENTROS POR PUNTAJE:\n' +
      centerAnalysis.slice(0, 6).map((c, i) =>
        `${i + 1}. ${c.name}: ${c.score.toFixed(1).replace('.', ',')} ` +
        `(Est: ${(c.byRole['Estudiantes']?.score || 0).toFixed(1).replace('.', ',')} ` +
        `Doc: ${(c.byRole['Docentes']?.score || c.byRole['Profesores']?.score || 0).toFixed(1).replace('.', ',')} ` +
        `Coord: ${(c.byRole['Coordinadores']?.score || 0).toFixed(1).replace('.', ',')})`
      ).join('\n')
    : '';

  // Texto completo para OBSERVACIONES DE LA EVALUACIÓN (slides 8-10)
  const hAll = h.join(' | ') || 'Sin datos suficientes';
  const rAll = r.join(' | ') || 'Sin datos suficientes';
  const aAll = a.join(' | ') || 'Sin datos suficientes';

  const observacionesText = (titulo, fortalezas, dificultades, sugerencias) => [
    `OBSERVACIONES DE LA EVALUACIÓN — ${titulo}`,
    '',
    'FORTALEZAS:',
    fortalezas,
    '',
    'DIFICULTADES:',
    dificultades,
    '',
    'SUGERENCIAS:',
    sugerencias
  ].join('\n');

  return [
    // ════════════════════════════════════════════════════════════════
    // SLIDE 2 — PORTADA / TÍTULO
    // ════════════════════════════════════════════════════════════════
    // replaceText ANTES que byContent para no contaminar búsquedas
    { slide: 2, type: 'replaceText', search: '2025', value: String(year) },
    { slide: 2, type: 'byContent', search: 'INFORME', value: `INFORME DE AUTOEVALUACIÓN\nPRÁCTICAS FORMATIVAS ${year}` },
    { slide: 2, type: 'byContent', search: 'CLINICA', value: `${centerName} - ${programName}\nCampus: ${filters.campus} | Nivel: ${filters.level}` },

    // ════════════════════════════════════════════════════════════════
    // SLIDE 3 — ESTUDIANTES
    // ════════════════════════════════════════════════════════════════
    // Nota: el template tiene un SmartArt "2 Diagrama" que no se puede manipular
    // desde el XML (usa namespace dgm:). Solo reemplazamos textos en shapes regulares.
    { slide: 3, type: 'byContent', search: 'ESTUDIANTES', value: [
      `ESTUDIANTES`,
      `Evaluaciones: ${metrics.kpis.total} | Completadas: ${completed} (${completionPct.toFixed(1)}%)`,
      `Centro: ${centerName} | Programa: ${programName}`
    ].join('\n') },

    // ════════════════════════════════════════════════════════════════
    // SLIDE 4 — TABLA DATOS GENERALES
    // ════════════════════════════════════════════════════════════════
    {
      slide: 4, type: 'table', name: 'Tabla 4',
      data: [
        ['Docentes a cargo', 'N° total de estudiantes', 'Total evaluaciones', 'Periodo'],
        [String(coordRole?.total || '—'), String(estRole?.total || '—'), String(metrics.kpis.total), metrics.dateRange || 'Actual'],
        ['Promedio global', `${globalScore.toFixed(2)} / 5.0`, `Cumplimiento: ${completionPct.toFixed(1)}%`, `${metrics.kpis.centers} centros`]
      ]
    },

    // ════════════════════════════════════════════════════════════════
    // SLIDE 5 — COMPETENCIAS / RESULTADOS DE APRENDIZAJE
    // ════════════════════════════════════════════════════════════════
    {
      slide: 5, type: 'table', name: 'Tabla 4',
      data: [
        ['COMPETENCIA DE LA PRÁCTICA FORMATIVA', 'RESULTADO DE APRENDIZAJE'],
        [`Integración teoría-práctica (Promedio: ${globalScore.toFixed(2)})`, `Cumplimiento: ${completionPct.toFixed(1)}%`],
        [`Desarrollo de competencias profesionales`, `Completadas: ${completed} de ${metrics.kpis.total}`],
        [`Trabajo en equipo interprofesional`, `Centros participantes: ${metrics.kpis.centers}`],
        [`Calidad y seguridad en la atención`, `Programas: ${metrics.kpis.programs}`]
      ]
    },

    // ════════════════════════════════════════════════════════════════
    // SLIDE 6 — MODELO DE AUTOEVALUACIÓN (Acuerdo 00273)
    // ════════════════════════════════════════════════════════════════
    { slide: 6, type: 'byContent', search: 'MODELO', value: [
      'MODELO DE AUTOEVALUACIÓN DE LA RELACIÓN DOCENCIA SERVICIO',
      '(ACUERDO 00273 DE 2021)',
      '(MERDS)',
      '',
      `Centro evaluado: ${centerName}`,
      `Programa: ${programName}`,
      `Evaluaciones procesadas: ${metrics.kpis.total}`,
      `Cobertura: ${completionPct.toFixed(1)}%`
    ].join('\n') },

    // ════════════════════════════════════════════════════════════════
    // SLIDE 7 — EVALUACIÓN RDS (Título 1 + Marcador de contenido 2 texto)
    // NOTA: El template NO tiene tabla en slide 7. Usa "Marcador de contenido 2"
    // que es un cuadro de texto con placeholder "Colocar tabla y grafico".
    // ════════════════════════════════════════════════════════════════
    { slide: 7, type: 'byContent', search: 'EVALUACIÓN', value: [
      'EVALUACIÓN DE LA RELACIÓN DOCENCIA SERVICIO',
      `${centerName} — ${programName}`,
      `Periodo: ${metrics.dateRange || year}`
    ].join('\n') },
    // Reemplazar el placeholder "Colocar tabla y grafico" con los datos
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
      `Distribución: 0-2: ${metrics.distribution[0].count} | 2-3: ${metrics.distribution[1].count} | 3-4: ${metrics.distribution[2].count} | 4-5: ${metrics.distribution[3].count}`,
      centerRankingText
    ].join('\n') },

    // ════════════════════════════════════════════════════════════════
    // SLIDE 8 — COORDINADOR: Observaciones
    // ════════════════════════════════════════════════════════════════
    { slide: 8, type: 'replaceText', search: 'Coordinador', value: 'Coordinador' },
    { slide: 8, type: 'byContent', search: 'OBSERVACIONES DE', value: observacionesText('COORDINADOR', hAll, rAll, aAll) },
    { slide: 8, type: 'table', name: 'Marcador de contenido 2', data: qualTableCoord },

    // ════════════════════════════════════════════════════════════════
    // SLIDE 9 — ESTUDIANTES: Observaciones
    // ════════════════════════════════════════════════════════════════
    { slide: 9, type: 'byContent', search: 'Estudiantes', value: 'Estudiantes al escenario de práctica' },
    { slide: 9, type: 'byContent', search: 'OBSERVACIONES DE LA EVALUACIÓN', value: observacionesText('ESTUDIANTES', hAll, rAll, aAll) },
    { slide: 9, type: 'table', name: 'Marcador de contenido 2', data: qualTableEst },

    // ════════════════════════════════════════════════════════════════
    // SLIDE 10 — DOCENTES: Observaciones
    // ════════════════════════════════════════════════════════════════
    { slide: 10, type: 'byContent', search: 'Docentes', value: 'Docentes al escenario de práctica' },
    { slide: 10, type: 'byContent', search: 'OBSERVACIONES DE LA EVALUACIÓN', value: observacionesText('DOCENTES', hAll, rAll, aAll) },
    { slide: 10, type: 'table', name: 'Marcador de contenido 2', data: qualTableDoc },

    // ════════════════════════════════════════════════════════════════
    // SLIDE 11 — OPORTUNIDADES DE MEJORA
    // ════════════════════════════════════════════════════════════════
    { slide: 11, type: 'byContent', search: 'OPORTUNIDADES', value: [
      'OPORTUNIDADES DE MEJORA',
      '',
      ...(a.length > 0
        ? a.map((item, i) => `${i + 1}. ${item}`)
        : ['No se generaron oportunidades de mejora automáticas.']),
      '',
      `Generado por Komet Analytics | ${new Date().toLocaleDateString('es-CO')}`
    ].join('\n') }
  ];
}
