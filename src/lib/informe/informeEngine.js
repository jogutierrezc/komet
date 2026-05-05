import {
  calcularMetricasGlobales,
  calcularResumenPorCampus,
  calcularResumenPorEscenario,
  calcularResumenPorPrograma,
  detectarPreguntasCriticas
} from './metricasEngine';

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

function mapAnswers(rawAnswers = {}, surveyDetails = {}) {
  const questions = Array.isArray(surveyDetails.questions) ? surveyDetails.questions : [];
  const knownIds = new Set(questions.map((q) => q.id).filter(Boolean));

  const numericEntries = Object.entries(rawAnswers)
    .filter(([key, val]) => {
      if (String(key).startsWith('_')) return false;
      const num = Number(val);
      if (!Number.isFinite(num) || num < 1 || num > 5) return false;
      return knownIds.size ? knownIds.has(key) : true;
    })
    .map(([preguntaId, valor]) => ({ preguntaId, valor: Number(valor) }));

  return numericEntries;
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
