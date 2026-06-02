// Servicio dedicado al manejo de la IA, prompts y parseo seguro.

import { formatPct } from '../utils/dataHelpers';

/**
 * Parsea la respuesta cruda de la IA (JSON embebido en markdown o texto plano)
 * y devuelve un objeto estructurado con resumen, análisis, hallazgos, riesgos y acciones.
 */
export function parseAiPayload(rawText = '') {
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

/**
 * Construye una narrativa de respaldo cuando la IA no está disponible.
 * Utiliza las métricas calculadas para generar un análisis descriptivo.
 */
export function buildNarrativeFallback(metrics) {
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
