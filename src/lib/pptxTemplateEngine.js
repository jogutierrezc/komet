/**
 * pptxTemplateEngine.js
 * 
 * Motor de edición de plantillas PPTX en el navegador.
 * 
 * Cómo funciona:
 * 1. Carga un archivo .pptx (que es un ZIP de XML) usando JSZip
 * 2. Descomprime y parsea los XML de cada diapositiva
 * 3. Busca shapes por nombre o tablas y reemplaza su contenido textual
 * 4. Re-comprime y descarga el PPTX modificado
 * 
 * Uso:
 *   const engine = new PptxTemplateEngine();
 *   await engine.load('/templates/mi-plantilla.pptx');
 *   engine.setText('Título 1', 'Nuevo título');
 *   engine.setTableCell('Tabla 4', 0, 1, 'Dato nuevo');
 *   await engine.download('informe-final.pptx');
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

  /**
   * Carga un archivo PPTX desde una URL (ruta pública) o desde un ArrayBuffer.
   */
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

  /**
   * Parsea todas las diapositivas del ZIP a objetos XML Document.
   */
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

    // Nota: Si en el futuro se necesitan reemplazar imágenes, las relaciones
    // están en ppt/slides/_rels/slide{N}.xml.rels
  }

  /**
   * Parsea un string XML a un Document.
   */
  _parseXml(xmlStr) {
    const parser = new DOMParser();
    return parser.parseFromString(xmlStr, 'application/xml');
  }

  /**
   * Serializa un Document XML a string.
   */
  _serializeXml(doc) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  /**
   * Busca un shape (p:sp) por su atributo name en una diapositiva.
   */
  _findShape(slideDoc, shapeName) {
    const spElements = slideDoc.getElementsByTagNameNS(NS.p, 'sp');
    for (const sp of spElements) {
      const cNvPr = sp.getElementsByTagNameNS(NS.p, 'cNvPr')[0];
      if (cNvPr && cNvPr.getAttribute('name') === shapeName) {
        return sp;
      }
    }
    return null;
  }

  /**
   * Busca una tabla (a:tbl) dentro de un shape o directamente en la diapositiva.
   */
  _findTable(slideDoc, tableShapeName) {
    const sp = this._findShape(slideDoc, tableShapeName);
    if (sp) {
      const tbl = sp.getElementsByTagNameNS(NS.a, 'tbl')[0];
      return tbl || null;
    }
    // Búsqueda directa de cualquier tabla en el slide
    const tbl = slideDoc.getElementsByTagNameNS(NS.a, 'tbl')[0];
    return tbl || null;
  }

  /**
   * Establece el texto de un shape identificado por su nombre.
   * Reemplaza TODO el contenido textual del primer párrafo.
   */
  setText(slideNum, shapeName, newText) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) throw new Error(`Slide ${slideNum} no encontrado`);

    const shape = this._findShape(slideDoc, shapeName);
    if (!shape) throw new Error(`Shape "${shapeName}" no encontrado en slide ${slideNum}`);

    // Obtener el primer txBody
    const txBody = shape.getElementsByTagNameNS(NS.p, 'txBody')[0];
    if (!txBody) return;

    // Buscar todos los elementos a:t dentro del txBody
    const tElements = txBody.getElementsByTagNameNS(NS.a, 't');

    if (tElements.length > 0) {
      // Reemplazar el primer texto
      tElements[0].textContent = newText;
      // Limpiar los demás para evitar texto residual
      for (let i = 1; i < tElements.length; i++) {
        tElements[i].textContent = '';
      }
    }
  }

  /**
   * Reemplaza texto en una tabla.
   * @param {number} slideNum - Número de diapositiva
   * @param {string} tableShapeName - Nombre del shape que contiene la tabla (ej: "Tabla 4")
   * @param {Array<Array<string>>} data - Matriz de datos [fila][columna]
   */
  setTableData(slideNum, tableShapeName, data) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) throw new Error(`Slide ${slideNum} no encontrado`);

    const tbl = this._findTable(slideDoc, tableShapeName);
    if (!tbl) throw new Error(`Tabla "${tableShapeName}" no encontrada en slide ${slideNum}`);

    const rows = tbl.getElementsByTagNameNS(NS.a, 'tr');

    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
      if (rowIdx >= rows.length) break;

      const cells = rows[rowIdx].getElementsByTagNameNS(NS.a, 'tc');

      for (let colIdx = 0; colIdx < data[rowIdx].length; colIdx++) {
        if (colIdx >= cells.length) break;

        const cell = cells[colIdx];
        const tElements = cell.getElementsByTagNameNS(NS.a, 't');
        const cellText = String(data[rowIdx][colIdx]);

        if (tElements.length > 0) {
          tElements[0].textContent = cellText;
          for (let i = 1; i < tElements.length; i++) {
            tElements[i].textContent = '';
          }
        }
      }
    }
  }

  /**
   * Reemplaza texto en las celdas de una tabla por posición (fila, columna).
   * @param {number} slideNum
   * @param {string} tableShapeName
   * @param {number} row - Índice de fila (0-based)
   * @param {number} col - Índice de columna (0-based)
   * @param {string} newText - Nuevo texto
   */
  setTableCell(slideNum, tableShapeName, row, col, newText) {
    const slideDoc = this.slides[slideNum];
    if (!slideDoc) throw new Error(`Slide ${slideNum} no encontrado`);

    const tbl = this._findTable(slideDoc, tableShapeName);
    if (!tbl) throw new Error(`Tabla "${tableShapeName}" no encontrada en slide ${slideNum}`);

    const rows = tbl.getElementsByTagNameNS(NS.a, 'tr');
    if (row >= rows.length) throw new Error(`Fila ${row} fuera de rango (máx: ${rows.length - 1})`);

    const cells = rows[row].getElementsByTagNameNS(NS.a, 'tc');
    if (col >= cells.length) throw new Error(`Columna ${col} fuera de rango (máx: ${cells.length - 1})`);

    const tElements = cells[col].getElementsByTagNameNS(NS.a, 't');
    if (tElements.length > 0) {
      tElements[0].textContent = String(newText);
      for (let i = 1; i < tElements.length; i++) {
        tElements[i].textContent = '';
      }
    }
  }

  /**
   * Guarda los cambios en el ZIP y devuelve un Blob del PPTX resultante.
   */
  async toBlob() {
    if (!this.zip) throw new Error('No hay plantilla cargada');

    // Reemplazar los XML de diapositivas modificados en el ZIP
    for (const [slideNum, doc] of Object.entries(this.slides)) {
      const filePath = `ppt/slides/slide${slideNum}.xml`;
      const xmlStr = this._serializeXml(doc);
      this.zip.file(filePath, xmlStr);
    }

    const blob = await this.zip.generateAsync({ type: 'blob' });
    return blob;
  }

  /**
   * Descarga el PPTX generado.
   */
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
 * Función helper que prepara los datos de KometPresenta para inyectar
 * en la plantilla según el mapeo de cada diapositiva.
 * 
 * @param {Object} metrics - Objeto de métricas de KometPresenta
 * @param {Object} filters - Filtros seleccionados
 * @param {Object} narrative - Narrativa generada por IA
 * @returns {Object} Configuración de reemplazos { slide: { shapeName: text, ... } }
 */
export function buildTemplateData(metrics, filters, narrative) {
  const year = new Date().getFullYear();
  const topCenter = metrics.byCenter[0];
  const topProgram = metrics.byProgram[0];
  const byRole = metrics.byRole || [];

  const coordinatorObs = narrative?.hallazgos?.slice(0, 3).join('. ') || '';
  const studentObs = narrative?.hallazgos?.slice(3, 6).join('. ') || '';
  const professorObs = narrative?.hallazgos?.slice(0, 3).join('. ') || '';

  return {
    // Slide 2: Portada
    2: {
      'Título 1': 'INFORME DE AUTOEVALUACIÓN\nPRACTICAS FORMATIVAS',
      'Marcador de contenido 2': [
        `ESCENARIO: ${filters.center === 'Todos' ? (topCenter?.name || 'GENERAL') : filters.center}`,
        `PROGRAMA: ${filters.program === 'Todos' ? (topProgram?.name || 'GENERAL') : filters.program}`,
        `CAMPUS: ${filters.campus}`,
        `${String(year)}`
      ].join('\n')
    },

    // Slide 7: Resultados globales - Reemplazar placeholder con resumen
    7: {
      'Título 1': 'EVALUACIÓN DE LA RELACIÓN DOCENCIA SERVICIO\n(RESULTADOS GLOBALES DEL PROGRAMA EN EL ESCENARIO)',
      'Marcador de contenido 2': [
        `Evaluaciones analizadas: ${metrics.kpis.total}`,
        `Completadas: ${metrics.kpis.completed} (${metrics.kpis.completionPct.toFixed(1)}%)`,
        `Promedio global: ${metrics.kpis.globalScore.toFixed(2)} / 5.0`,
        `Centros evaluados: ${metrics.kpis.centers}`,
        `Programas cubiertos: ${metrics.kpis.programs}`,
        ``,
        `Distribución de calificaciones:`,
        `  0-2: ${metrics.distribution[0].count} | 2-3: ${metrics.distribution[1].count}`,
        `  3-4: ${metrics.distribution[2].count} | 4-5: ${metrics.distribution[3].count}`,
        ``,
        topCenter ? `Mejor centro: ${topCenter.name} (${topCenter.score.toFixed(2)})` : '',
        topProgram ? `Mejor programa: ${topProgram.name} (${topProgram.score.toFixed(2)})` : ''
      ].filter(Boolean).join('\n')
    },

    // Slide 8: Observaciones del Coordinador (Fortalezas, Dificultades, Sugerencias)
    8: {
      'Marcador de contenido 2': [
        'FORTALEZAS:',
        (narrative?.hallazgos?.[0] || 'Sin datos suficientes'),
        '',
        'DIFICULTADES:',
        (narrative?.riesgos?.[0] || 'Sin datos suficientes'),
        '',
        'SUGERENCIAS PARA MEJORAR:',
        (narrative?.acciones?.[0] || 'Sin datos suficientes')
      ].join('\n')
    },

    // Slide 9: Observaciones de Estudiantes
    9: {
      'Marcador de contenido 2': [
        'FORTALEZAS:',
        (narrative?.hallazgos?.[1] || narrative?.hallazgos?.[0] || 'Sin datos suficientes'),
        '',
        'DIFICULTADES:',
        (narrative?.riesgos?.[1] || narrative?.riesgos?.[0] || 'Sin datos suficientes'),
        '',
        'SUGERENCIAS PARA MEJORAR:',
        (narrative?.acciones?.[1] || narrative?.acciones?.[0] || 'Sin datos suficientes')
      ].join('\n')
    },

    // Slide 10: Observaciones de Docentes
    10: {
      'Marcador de contenido 2': [
        'FORTALEZAS:',
        (narrative?.hallazgos?.[2] || narrative?.hallazgos?.[0] || 'Sin datos suficientes'),
        '',
        'DIFICULTADES:',
        (narrative?.riesgos?.[2] || narrative?.riesgos?.[0] || 'Sin datos suficientes'),
        '',
        'SUGERENCIAS PARA MEJORAR:',
        (narrative?.acciones?.[2] || narrative?.acciones?.[0] || 'Sin datos suficientes')
      ].join('\n')
    },

    // Slide 11: Oportunidades de mejora
    11: {
      'Título 1': 'OPORTUNIDADES DE MEJORA',
    },

    // Datos para tablas (se asignan por setTableData, no por setText)
    _tables: {
      // Slide 3: Estudiantes - el shape "Title 1" tiene el texto "ESTUDIANTES"
      3: {
        shapes: {
          'Content Placeholder 2': `Total estudiantes evaluados: ${metrics.kpis.scored}\nProgramas: ${metrics.kpis.programs}\nCentros: ${metrics.kpis.centers}`
        }
      },
      // Slide 4: Tabla de datos generales
      4: {
        table: 'Tabla 4',
        data: [
          ['Docentes', `${byRole.find(r => r.name === 'Docente')?.total || 0}`, `${byRole.find(r => r.name === 'Estudiante')?.total || 0}`],
          ['N° de horas/semanal', `${metrics.kpis.total} evaluaciones`, `${metrics.kpis.globalScore.toFixed(2)} promedio`],
          [`TOTAL DE SEMANAS AL SEMESTRE: 16`, '', '']
        ]
      },
      // Slide 5: Competencias y resultados
      5: {
        table: 'Tabla 4',
        data: [
          ['COMPETENCIA DE LA PRÁCTICA FORMATIVA', 'RESULTADO DE APRENDIZAJE'],
          ['Integración teoría-práctica', `Promedio: ${metrics.kpis.globalScore.toFixed(2)}`],
          ['Desarrollo de competencias profesionales', `Completitud: ${metrics.kpis.completionPct.toFixed(1)}%`]
        ]
      }
    }
  };
}
