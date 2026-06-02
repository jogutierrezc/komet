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
 * Construye una narrativa profunda y estructurada de respaldo cuando la IA no está disponible.
 * Utiliza TODAS las métricas calculadas para generar un análisis completo con:
 * - Resumen ejecutivo
 * - Análisis de datos generales y distribución
 * - Análisis por centro con desglose por rol
 * - Análisis por programa
 * - Tendencias temporales
 * - Hallazgos, riesgos y plan de acción
 */
export function buildNarrativeFallback(metrics) {
  const { kpis, distribution, byCenter, byProgram, byRole, byCampus, monthly, variability } = metrics;
  const globalScore = kpis.globalScore.toFixed(2);
  const complPct = formatPct(kpis.completionPct);

  // ── Análisis de distribución ──
  const distAnalysis = (() => {
    const ranges = ['0-2', '2-3', '3-4', '4-5'];
    const labels = ['Crítico', 'Bajo', 'Aceptable', 'Sobresaliente'];
    return distribution
      .map((d, i) => `${d.count} eval. en rango ${ranges[i]} (${labels[i]})`)
      .join('; ');
  })();

  // ── Análisis de centros ──
  const centerAnalysisText = (() => {
    if (!byCenter?.length) return 'No hay datos de centros disponibles.';
    const lines = [];
    lines.push(`Centros evaluados: ${byCenter.length}`);
    lines.push(`Top: ${byCenter[0].name} (${byCenter[0].score.toFixed(2)}) — ${byCenter[0].total} eval.`);
    if (byCenter.length > 1) {
      const last = byCenter[byCenter.length - 1];
      const brecha = (byCenter[0].score - last.score).toFixed(2);
      lines.push(`Menor: ${last.name} (${last.score.toFixed(2)}) — ${last.total} eval.`);
      lines.push(`Brecha top-bottom: ${brecha} puntos`);

      // Análisis de clusters
      const above40 = byCenter.filter(c => c.score >= 4.0).length;
      const below35 = byCenter.filter(c => c.score < 3.5).length;
      lines.push(`${above40} centros con promedio >= 4.0 (fortaleza consolidada)`);
      if (below35 > 0) lines.push(`${below35} centros con promedio < 3.5 (requieren intervención)`);

      // Desglose por roles en centros destacados
      if (metrics.centerAnalysis?.length) {
        lines.push('');
        lines.push('--- DESGLOSE POR ROL EN CENTROS ---');
        byCenter.slice(0, 5).forEach(c => {
          const centerDetail = metrics.centerAnalysis.find(ca => ca.name === c.name);
          if (centerDetail?.byRole) {
            const rolesStr = Object.entries(centerDetail.byRole)
              .map(([role, data]) => `${role}: ${data.score.toFixed(1)} (${data.count})`)
              .join(' | ');
            lines.push(`${c.name}: ${rolesStr}`);
          }
        });
      }
    }
    return lines.join('\n');
  })();

  // ── Análisis de programas ──
  const programAnalysisText = (() => {
    if (!byProgram?.length) return 'No hay datos de programas.';
    const lines = [];
    lines.push(`Programas analizados: ${byProgram.length}`);
    lines.push(`Líder: ${byProgram[0].name} (${byProgram[0].score.toFixed(2)})`);
    if (byProgram.length > 1) {
      const last = byProgram[byProgram.length - 1];
      lines.push(`Menor puntaje: ${last.name} (${last.score.toFixed(2)})`);
    }
    return lines.join('\n');
  })();

  // ── Análisis de tendencia ──
  const trendAnalysis = (() => {
    if (!monthly?.length) return 'Sin datos mensuales para análisis de tendencia.';
    const values = monthly.map(m => m.score).filter(s => s > 0);
    if (values.length < 2) return 'Datos insuficientes para determinar tendencia.';
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const diff = (avgSecond - avgFirst).toFixed(2);
    const direction = diff > 0 ? 'AL ALZA' : diff < 0 ? 'A LA BAJA' : 'ESTABLE';
    return `Tendencia ${direction} (variación de ${diff} puntos entre primera y segunda mitad del período).`;
  })();

  // ── Análisis de roles ──
  const roleAnalysisText = (() => {
    if (!byRole?.length) return 'No hay datos por rol.';
    return byRole
      .map(r => `${r.name}: ${r.score.toFixed(2)} (${r.total} eval., ${formatPct(r.completionPct)} cumplimiento)`)
      .join(' | ');
  })();

  // ── Construcción del análisis completo ──
  const analisis = [
    '╔══════════════════════════════════════════════════╗',
    '║    INFORME ESTRUCTURAL DE AUTOEVALUACIÓN         ║',
    '║    RELACIÓN DOCENCIA-SERVICIO                    ║',
    '╚══════════════════════════════════════════════════╝',
    '',
    '1. DATOS GENERALES DEL ESTUDIO',
    `   Total evaluaciones: ${kpis.total}`,
    `   Completadas: ${kpis.completed} (${complPct})`,
    `   Puntaje global: ${globalScore} / 5,0`,
    `   Varianza (desv. estándar): ${variability.toFixed(2)}`,
    `   Variabilidad: ${variability > 0.9 ? 'ALTA — sugiere falta de estandarización en los criterios de evaluación entre centros.' : variability > 0.6 ? 'MODERADA — existen diferencias significativas entre escenarios.' : 'CONTROLADA — los criterios de evaluación son consistentes.'}`,
    `   Tendencia: ${metrics.trendDirection.toUpperCase()}`,
    '',
    '2. DISTRIBUCIÓN DE RESULTADOS',
    `   ${distAnalysis}`,
    `   Concentración en rangos altos (4-5): ${distribution[3].count} eval. (${kpis.total > 0 ? ((distribution[3].count / kpis.total) * 100).toFixed(1) : 0}%)`,
    `   Concentración en rangos críticos (0-2): ${distribution[0].count} eval. (${kpis.total > 0 ? ((distribution[0].count / kpis.total) * 100).toFixed(1) : 0}%)`,
    `   Relación señal/ruido: ${distribution[3].count > distribution[0].count * 3 ? 'predominan las evaluaciones positivas, la calidad general es aceptable.' : 'existe una proporción significativa de evaluaciones críticas que requieren atención.'}`,
    '',
    '3. ANÁLISIS POR ROL DEL EVALUADOR',
    `   ${roleAnalysisText}`,
    '',
    '4. ANÁLISIS POR CENTRO DE PRÁCTICA',
    `   ${centerAnalysisText}`,
    '',
    '5. ANÁLISIS POR PROGRAMA ACADÉMICO',
    `   ${programAnalysisText}`,
    '',
    '6. TENDENCIA TEMPORAL',
    `   Meses analizados: ${monthly.length}`,
    `   ${trendAnalysis}`,
    monthly.length > 0 ? `   Evolución mensual: ${monthly.map(m => `${m.name}: ${m.score.toFixed(2)}`).join(' → ')}` : '',
    '',
    '7. ANÁLISIS COMPARATIVO POR CAMPUS',
    byCampus?.length > 0
      ? `   ${byCampus.map(c => `${c.name}: ${c.score.toFixed(2)} (${c.total} eval.)`).join(' | ')}`
      : '   No hay datos por campus.',
    '',
    '8. CONCLUSIONES Y RECOMENDACIONES ESTRATÉGICAS',
    `   El puntaje global de ${globalScore}/5,0 indica un nivel ${
      globalScore >= 4.5 ? 'SOBRESALIENTE — las prácticas formativas cumplen con altos estándares de calidad.' :
      globalScore >= 4.0 ? 'ALTO — se evidencia una gestión eficaz de la relación docencia-servicio.' :
      globalScore >= 3.5 ? 'SATISFACTORIO — existen oportunidades de mejora puntuales que pueden elevar el desempeño.' :
      globalScore >= 3.0 ? 'ACEPTABLE — se requieren acciones correctivas en áreas específicas.' :
      'CRÍTICO — se necesita intervención inmediata para garantizar la calidad educativa.'
    }`,
    `   La tasa de respuesta de ${complPct} indica ${
      kpis.completionPct >= 80 ? 'una participación excelente que da alta confiabilidad a los resultados.' :
      kpis.completionPct >= 70 ? 'una participación adecuada con representatividad estadística aceptable.' :
      'un riesgo de sesgo por baja participación. Se recomienda implementar estrategias para aumentar la tasa de respuesta.'
    }`,
    `   Se identifican ${byCenter.filter(c => c.score < 3.5).length} centros con desempeño por debajo del umbral crítico de 3.5.`,
    `   Se recomienda priorizar intervenciones en: ${byCenter.filter(c => c.score < 3.5).slice(0, 3).map(c => c.name).join(', ') || 'ningún centro requiere intervención urgente.'}`
  ].filter(Boolean).join('\n');

  // ── Hallazgos estructurados ──
  const hallazgos = [
    `Desempeño global: ${globalScore}/5,0 con ${kpis.total} evaluaciones procesadas (${complPct} completadas).`,
    `${distribution[3].count} evaluaciones (${kpis.total > 0 ? ((distribution[3].count / kpis.total) * 100).toFixed(1) : 0}%) se concentran en el rango superior (4-5), evidenciando fortalezas consolidadas.`,
    byCenter[0] ? `Centro líder: ${byCenter[0].name} con ${byCenter[0].score.toFixed(2)} puntos (${byCenter[0].total} evaluaciones).` : '',
    byCenter.length > 1 && byCenter[byCenter.length - 1] ? `Centro con mayor oportunidad de mejora: ${byCenter[byCenter.length - 1].name} (${byCenter[byCenter.length - 1].score.toFixed(2)}).` : '',
    byRole[0] ? `Rol con mejor percepción: ${byRole[0].name} (${byRole[0].score.toFixed(2)}).` : '',
    byRole.length > 1 && byRole[byRole.length - 1] ? `Rol con percepción más crítica: ${byRole[byRole.length - 1].name} (${byRole[byRole.length - 1].score.toFixed(2)}).` : '',
    monthly.length >= 2 ? `Tendencia ${metrics.trendDirection} en el período analizado (${monthly[0]?.name || 'inicio'} a ${monthly[monthly.length - 1]?.name || 'final'}).` : '',
    variability > 0.7 ? `Alta variabilidad detectada (desv. est. ${variability.toFixed(2)}), lo que sugiere heterogeneidad en criterios de evaluación entre centros.` : ''
  ].filter(Boolean);

  // ── Riesgos estructurados ──
  const riesgos = [
    kpis.completionPct < 70 ? `Baja tasa de respuesta (${complPct}): los resultados pueden no ser representativos del universo total de evaluaciones.` : '',
    distribution[0].count > 0 ? `${distribution[0].count} evaluaciones en rango crítico (0-2) requieren análisis de causas raíz.` : '',
    byCenter.filter(c => c.score < 3.5).length > 0 ? `${byCenter.filter(c => c.score < 3.5).length} centros con promedio inferior a 3.5 necesitan planes de mejora prioritarios.` : '',
    variability > 0.9 ? `La desviación estándar de ${variability.toFixed(2)} indica falta de estandarización en los procesos de evaluación entre los diferentes escenarios de práctica.` : variability > 0.6 ? `Variabilidad moderada (${variability.toFixed(2)}) que sugiere diferencias metodológicas entre centros.` : '',
    monthly.length >= 2 && metrics.trendDirection === 'a la baja' ? 'La tendencia a la baja en los puntajes mensuales es una señal de alerta que requiere monitoreo continuo.' : '',
    byCenter.length > 1 && (byCenter[0].score - byCenter[byCenter.length - 1].score) > 1.5 
      ? `Brecha crítica entre centros: ${(byCenter[0].score - byCenter[byCenter.length - 1].score).toFixed(2)} puntos de diferencia entre el mejor y el peor escenario.` 
      : ''
  ].filter(Boolean);

  // ── Acciones estructuradas ──
  const baseAcciones = [
    'Realizar visita de supervisión a los centros con promedio inferior a 3.5 para identificar causas raíz y establecer planes de mejora con metas a 30, 60 y 90 días.',
    'Implementar un sistema de recordatorios automáticos (email y SMS) para incrementar la tasa de respuesta de evaluaciones pendientes.',
    'Socializar los resultados del presente informe con directores de programa y coordinadores de centro para fomentar planes de acción colaborativos.',
    'Establecer un comité de calidad de la relación docencia-servicio que se reúna trimestralmente para monitorear la evolución de los indicadores.',
    'Documentar y replicar las buenas prácticas identificadas en los centros con puntaje superior a 4.5 como modelo de referencia institucional.'
  ];

  const acciones = [...baseAcciones];
  if (variability > 0.7) {
    acciones.push('Estandarizar los criterios de evaluación mediante rúbricas homogenizadas y capacitación a evaluadores para reducir la variabilidad inter-centros.');
  }
  if (kpis.completionPct < 70) {
    acciones.push('Diseñar una campaña de concientización sobre la importancia de las evaluaciones formativas, dirigida a estudiantes, docentes y coordinadores.');
  }
  if (byCenter.filter(c => c.score < 3.5).length > 2) {
    acciones.push('Asignar un tutor de calidad a cada centro con desempeño crítico para acompañar el proceso de mejora continua de forma personalizada.');
  }

  return {
    resumen: [
      `INFORME ESTRUCTURAL DE AUTOEVALUACIÓN — ${kpis.total} evaluaciones procesadas.`,
      `Puntaje global: ${globalScore}/5,0 | Cumplimiento: ${complPct} | Centros: ${kpis.centers} | Programas: ${kpis.programs}.`,
      `Tendencia: ${metrics.trendDirection.toUpperCase()} | Variabilidad: ${variability > 0.7 ? 'ALTA' : variability > 0.5 ? 'MODERADA' : 'CONTROLADA'} (desv. est. ${variability.toFixed(2)}).`,
      `Mejor centro: ${byCenter[0]?.name || 'N/A'} (${byCenter[0]?.score?.toFixed(2) || '—'}) | Rol mejor calificado: ${byRole[0]?.name || 'N/A'}.`
    ].join(' '),
    analisis_completo: analisis,
    hallazgos: hallazgos.length ? hallazgos : ['No se generaron hallazgos automáticos por datos insuficientes.'],
    riesgos: riesgos.length ? riesgos : ['No se identificaron riesgos significativos en los datos analizados.'],
    acciones: acciones.length ? acciones : ['No se generaron acciones automáticas.'],
    // Campos adicionales para estructurar mejor el análisis
    resumen_ejecutivo: `El estudio abarca ${kpis.total} evaluaciones con un puntaje global de ${globalScore}/5,0 y una tasa de cumplimiento de ${complPct}. Se analizaron ${kpis.centers} centros de práctica y ${kpis.programs} programas académicos, con una variabilidad de ${variability.toFixed(2)}. La tendencia general es ${metrics.trendDirection}.`,
    analisis_centros: centerAnalysisText,
    analisis_programas: programAnalysisText,
    analisis_roles: roleAnalysisText,
    distribucion: distAnalysis,
    tendencia: trendAnalysis
  };
}
