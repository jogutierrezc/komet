import {
  calcularMetricasGlobales,
  calcularResumenPorCampus,
  calcularResumenPorEscenario,
  calcularResumenPorPrograma,
  detectarPreguntasCriticas
} from './metricasEngine';
import { PREGUNTAS_INSTRUMENTO } from './instrumento';

function normalizeText(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function mapRole(role) {
  const r = String(role || '').toLowerCase();
  if (r.includes('est')) return 'Estudiante';
  if (r.includes('prof') || r.includes('doc')) return 'Docente';
  if (r.includes('coord')) return 'Coordinador';
  return 'Estudiante';
}

function mapTipoPrograma(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('pos')) return 'Posgrado';
  return 'Pregrado';
}

function normalizeComparableText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractInstrumentCode(value) {
  const match = String(value || '').toUpperCase().match(/\b(AG|CI|SPB|OA|PF|CMC)\s*-?\s*(\d{1,2})\b/);
  if (!match) return null;
  return `${match[1]}${match[2]}`;
}

function toLikertScore(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 1 && value <= 5) return value;
    return null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 5) return parsed;
    return null;
  }
  if (typeof value === 'object') {
    const nested = toLikertScore(value.value ?? value.score ?? value.valor ?? value.answer);
    return nested;
  }
  return null;
}

function wordSet(normalizedText) {
  return new Set(normalizedText.split(' ').filter((w) => w.length > 3));
}

function jaccardSimilarity(textA, textB) {
  const setA = wordSet(textA);
  const setB = wordSet(textB);
  if (!setA.size || !setB.size) return 0;
  let intersectionCount = 0;
  setA.forEach((w) => { if (setB.has(w)) intersectionCount++; });
  const unionSize = setA.size + setB.size - intersectionCount;
  return unionSize > 0 ? intersectionCount / unionSize : 0;
}

function buildQuestionMappings(questions = []) {
  const byQuestionId = new Map();
  const instrumentNormalized = PREGUNTAS_INSTRUMENTO.map((item) => ({
    id: item.id,
    text: normalizeComparableText(item.texto)
  }));
  const byExactText = new Map(instrumentNormalized.map((item) => [item.text, item.id]));

  questions.forEach((question) => {
    const questionId = String(question?.id || '').trim();
    if (!questionId) return;

    // 1. Direct instrument code in any field
    const fromCode =
      extractInstrumentCode(question?.id) ||
      extractInstrumentCode(question?.codigo) ||
      extractInstrumentCode(question?.code) ||
      extractInstrumentCode(question?.label) ||
      extractInstrumentCode(question?.texto) ||
      extractInstrumentCode(question?.name) ||
      null;

    if (fromCode) {
      byQuestionId.set(questionId, fromCode);
      return;
    }

    const questionText = normalizeComparableText(
      question?.label || question?.texto || question?.name || question?.title || ''
    );
    if (!questionText) return;

    // 2. Exact normalized text match
    if (byExactText.has(questionText)) {
      byQuestionId.set(questionId, byExactText.get(questionText));
      return;
    }

    // 3. Fuzzy word-overlap match (Jaccard >= 0.65)
    let bestScore = 0;
    let bestId = null;
    for (const inst of instrumentNormalized) {
      const score = jaccardSimilarity(questionText, inst.text);
      if (score > bestScore) {
        bestScore = score;
        bestId = inst.id;
      }
    }
    if (bestScore >= 0.65 && bestId) {
      byQuestionId.set(questionId, bestId);
    }
  });

  return byQuestionId;
}

function mapAnswers(rawAnswers = {}, surveyDetails = {}) {
  const questions = Array.isArray(surveyDetails.questions) ? surveyDetails.questions : [];
  const instrumentIds = new Set(PREGUNTAS_INSTRUMENTO.map((item) => item.id));
  const byQuestionId = buildQuestionMappings(questions);
  const merged = new Map();

  Object.entries(rawAnswers).forEach(([key, val]) => {
    if (String(key).startsWith('_')) return;

    const score = toLikertScore(val);
    if (score === null) return;

    const directCode = extractInstrumentCode(key);
    const mappedCode = directCode || byQuestionId.get(key) || null;
    if (!mappedCode || !instrumentIds.has(mappedCode)) return;

    // Keep the first value per instrument code to avoid duplicate counting.
    if (!merged.has(mappedCode)) {
      merged.set(mappedCode, score);
    }
  });

  return [...merged.entries()].map(([preguntaId, valor]) => ({ preguntaId, valor }));
}

function collectInsights(evaluaciones) {
  const fortalezas = new Map();
  const mejoras = new Map();

  evaluaciones.forEach((ev) => {
    const add = (store, text) => {
      const key = normalizeText(text);
      if (!key || key.length < 8) return;
      store.set(key, (store.get(key) || 0) + 1);
    };

    add(fortalezas, ev.fortalezas);
    add(mejoras, ev.aspectosMejora);
    add(mejoras, ev.observaciones);
  });

  return {
    fortalezasIdentificadas: [...fortalezas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([text]) => text),
    oportunidadesMejora: [...mejoras.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([text]) => text)
  };
}

function buildRecommendations(metricasGlobales, preguntasCriticas = []) {
  const recomendaciones = [];
  const peoresSecciones = [...(metricasGlobales.promediosPorSeccion || [])]
    .filter((s) => s.promedio !== null)
    .sort((a, b) => (a.promedio || 0) - (b.promedio || 0))
    .slice(0, 3);

  peoresSecciones.forEach((sec) => {
    recomendaciones.push(`Priorizar plan de mejora para ${sec.seccion} con metas trimestrales y seguimiento quincenal.`);
  });

  preguntasCriticas.slice(0, 3).forEach((q) => {
    recomendaciones.push(`Intervenir la pregunta ${q.preguntaId} en ${q.escenarios.join(', ') || 'escenarios priorizados'} mediante capacitacion y control de cumplimiento.`);
  });

  if (!recomendaciones.length) {
    recomendaciones.push('Mantener seguimiento institucional y ciclos de autoevaluacion con enfoque preventivo.');
  }

  return recomendaciones;
}

function buildPlanesAccion(preguntasCriticas = []) {
  return preguntasCriticas.slice(0, 6).map((q) => ({
    seccion: q.seccion,
    problema: `${q.preguntaId}: ${q.texto}`,
    accionPropuesta: `Diseñar e implementar accion correctiva focalizada para elevar el promedio por encima de 3.5.`,
    responsable: 'Coordinacion Docencia-Servicio',
    plazo: q.promedio < 2.5 ? 'inmediato' : q.promedio < 3 ? 'corto_plazo' : 'mediano_plazo',
    indicador: `Promedio de ${q.preguntaId} >= 3.5 en siguiente corte`,
    escenario: q.escenarios[0] || undefined
  }));
}

function filterEvaluaciones(evaluaciones = [], filtros = {}) {
  const actores = Array.isArray(filtros.actores) ? filtros.actores.map((item) => mapRole(item)) : [];

  return evaluaciones.filter((ev) => {
    if (filtros.campus?.length && !filtros.campus.includes(ev.campus)) return false;
    if (filtros.programas?.length && !filtros.programas.includes(ev.programaAcademico)) return false;
    if (filtros.escenarios?.length && !filtros.escenarios.includes(ev.escenarioPractica)) return false;
    if (filtros.periodos?.length && !filtros.periodos.includes(ev.periodoAcademico)) return false;
    if (actores.length && !actores.includes(ev.actor)) return false;
    return true;
  });
}

export function rowsToEvaluacionesData(rows = []) {
  return rows.map((row) => {
    const raw = row.rawAnswers || {};
    const periodFromContext = raw?._publicContext?.period;

    return {
      id: String(row.id || ''),
      campus: normalizeText(row.campus, 'Sin campus'),
      actor: mapRole(row.role),
      tipoPrograma: mapTipoPrograma(row.target || row.program),
      programaAcademico: normalizeText(row.program || raw?._publicRespondent?.program, 'Sin programa'),
      escenarioPractica: normalizeText(row.center, 'Sin sitio'),
      periodoAcademico: normalizeText(row.period || periodFromContext, 'No definido'),
      respuestas: mapAnswers(raw, row.surveyDetails),
      fortalezas: normalizeText(raw.fortalezas || raw.strengths),
      aspectosMejora: normalizeText(raw.aspectosMejora || raw.mejoras),
      observaciones: normalizeText(raw.observaciones || raw.comments),
      completadaEn: row.completed_at || row.created_at || null
    };
  });
}

export function generarInformeDesdeRows(rows = [], input = {}) {
  const allEvals = rowsToEvaluacionesData(rows);
  const evaluaciones = filterEvaluaciones(allEvals, input.filtros || {});

  const metricasGlobales = calcularMetricasGlobales(evaluaciones);
  const resumenPorCampus = calcularResumenPorCampus(evaluaciones);
  const resumenPorEscenario = calcularResumenPorEscenario(evaluaciones);
  const resumenPorPrograma = calcularResumenPorPrograma(evaluaciones);
  const preguntasCriticas = detectarPreguntasCriticas(evaluaciones, 3.0);

  const insights = collectInsights(evaluaciones);
  const recomendaciones = buildRecommendations(metricasGlobales, preguntasCriticas);
  const planesAccion = buildPlanesAccion(preguntasCriticas);

  const periodo = metricasGlobales.periodos.length
    ? metricasGlobales.periodos.join(', ')
    : 'Periodo no definido';

  const promedioGlobal = metricasGlobales.promedioGlobalUdes;

  return {
    generadoEn: new Date().toISOString(),
    periodo,
    metricasGlobales,
    resumenPorCampus,
    resumenPorEscenario,
    resumenPorPrograma,
    preguntasCriticas,
    introduccion:
      'El informe consolida resultados de la relacion docencia-servicio por campus, escenario y programa academico para orientar decisiones de calidad.',
    analisisGeneral:
      promedioGlobal === null
        ? 'No existen respuestas numericas suficientes para un analisis cuantitativo robusto en el corte seleccionado.'
        : `El promedio global del corte es ${promedioGlobal.toFixed(2)} sobre 5. Se identifican variaciones por escenario y actor que requieren gestion diferenciada.`,
    fortalezasIdentificadas: insights.fortalezasIdentificadas,
    oportunidadesMejora: insights.oportunidadesMejora,
    recomendaciones,
    conclusiones:
      'Se recomienda mantener ciclos de medicion periodica y seguimiento de indicadores por seccion del instrumento para cerrar brechas de calidad.',
    planesAccion: input.configuracion?.incluirPlanesMejora === false ? [] : planesAccion
  };
}
