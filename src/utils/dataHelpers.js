// Funciones puras para formateo, cálculos y evaluación de datos.

export const LEVEL_WORDS = new Set(['pregrado', 'posgrado', 'postgrado']);

export function norm(value) {
  return String(value || '').trim();
}

export function avg(values = []) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, item) => sum + item, 0) / values.length).toFixed(2));
}

export function stdDev(values = []) {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Number(Math.sqrt(variance).toFixed(2));
}

export function resolveProgram(row = {}) {
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

export function resolveLevel(row = {}) {
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

export function formatPct(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function formatFilters({ campus, level, center, program }) {
  return [
    `Campus: ${campus}`,
    `Nivel: ${level}`,
    `Centro: ${center}`,
    `Programa: ${program}`
  ].join(' | ');
}

export function rankBy(rows, keyGetter, scoreGetter) {
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

export function getMonthKey(dateValue) {
  const date = dateValue ? new Date(dateValue) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Sin fecha';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shortList(items = [], max = 5) {
  return items.slice(0, max).map((item) => `• ${item}`);
}

/**
 * Calcula el análisis detallado por centro de práctica con desglose por rol.
 * Retorna un mapa: centerName → { scores, counts, roleBreakdown, programs, comparison }
 */
export function calculateCenterAnalysis(rows = []) {
  const centerMap = new Map();

  rows.forEach((row) => {
    const center = norm(row.center || 'Sin sitio');
    const role = norm(row.role || 'Sin definir');
    const program = resolveProgram(row);
    const score = row.scoreSummary?.globalScore;

    if (!centerMap.has(center)) {
      centerMap.set(center, {
        name: center,
        scores: [],
        completed: 0,
        total: 0,
        roles: {},
        programs: new Map(),
        byRole: {}
      });
    }

    const entry = centerMap.get(center);
    entry.total += 1;
    if (row.status === 'Completada') entry.completed += 1;
    if (typeof score === 'number') entry.scores.push(score);

    // Conteo por rol
    entry.roles[role] = (entry.roles[role] || 0) + 1;

    // Puntajes por rol
    if (!entry.byRole[role]) entry.byRole[role] = [];
    if (typeof score === 'number') entry.byRole[role].push(score);

    // Programas asociados
    if (program && program !== 'Sin programa') {
      const progEntry = entry.programs.get(program) || { total: 0, scores: [] };
      progEntry.total += 1;
      if (typeof score === 'number') progEntry.scores.push(score);
      entry.programs.set(program, progEntry);
    }
  });

  const result = [];
  for (const [name, entry] of centerMap) {
    const byRoleSummary = {};
    for (const [roleName, scores] of Object.entries(entry.byRole)) {
      byRoleSummary[roleName] = {
        count: scores.length,
        score: avg(scores)
      };
    }

    const programsSummary = [];
    for (const [progName, progEntry] of entry.programs) {
      programsSummary.push({
        name: progName,
        total: progEntry.total,
        score: avg(progEntry.scores)
      });
    }
    programsSummary.sort((a, b) => b.score - a.score);

    result.push({
      name,
      total: entry.total,
      completed: entry.completed,
      completionPct: entry.total ? Number(((entry.completed / entry.total) * 100).toFixed(1)) : 0,
      score: avg(entry.scores),
      roles: entry.roles,
      byRole: byRoleSummary,
      programs: programsSummary
    });
  }

  result.sort((a, b) => b.score - a.score);
  return result;
}

/**
 * Construye una matriz de puntajes por centro × rol para la tabla de template.
 * Retorna { headers, rows } donde cada fila es [centro, estudiantes, docentes, coordinadores, promedio]
 */
export function calculateRoleGrid(centerAnalysis = []) {
  const headers = ['Centro de Práctica', 'Estudiantes', 'Docentes', 'Coordinadores', 'Promedio'];

  const rows = centerAnalysis.map((center) => [
    center.name,
    center.byRole['Estudiantes']?.score?.toFixed(1)?.replace('.', ',') || '—',
    center.byRole['Docentes']?.score?.toFixed(1)?.replace('.', ',') || center.byRole['Profesores']?.score?.toFixed(1)?.replace('.', ',') || '—',
    center.byRole['Coordinadores']?.score?.toFixed(1)?.replace('.', ',') || '—',
    center.score.toFixed(1).replace('.', ',')
  ]);

  return { headers, rows };
}

/**
 * Genera un resumen textual del análisis por centros para incluirlo en el prompt de IA.
 */
export function formatCenterAnalysisForPrompt(centerAnalysis = [], selectedCenter = 'Todos', selectedProgram = 'Todos') {
  if (!centerAnalysis.length) return 'No hay datos de centros disponibles.';

  const lines = [];
  lines.push(`Centros analizados: ${centerAnalysis.length}`);

  // Si hay un centro específico seleccionado, hacer análisis profundo
  if (selectedCenter !== 'Todos') {
    const center = centerAnalysis.find(c => c.name === selectedCenter);
    if (center) {
      lines.push(`\n--- ANÁLISIS DETALLADO: ${center.name} ---`);
      lines.push(`Evaluaciones: ${center.total} (completadas: ${center.completed}, ${center.completionPct}%)`);
      lines.push(`Puntaje global: ${center.score.toFixed(2)}`);
      
      if (Object.keys(center.byRole).length) {
        lines.push('Puntaje por rol:');
        for (const [role, data] of Object.entries(center.byRole)) {
          lines.push(`  ${role}: ${data.score.toFixed(2)} (${data.count} evaluaciones)`);
        }
      }

      if (selectedProgram !== 'Todos') {
        const prog = center.programs.find(p => p.name === selectedProgram);
        if (prog) {
          lines.push(`Programa ${prog.name}: ${prog.score.toFixed(2)} (${prog.total} eval.)`);
        }
      } else if (center.programs.length) {
        lines.push('Programas asociados:');
        center.programs.slice(0, 5).forEach(p => {
          lines.push(`  ${p.name}: ${p.score.toFixed(2)} (${p.total} eval.)`);
        });
      }

      // Comparación vs otros centros
      const others = centerAnalysis.filter(c => c.name !== selectedCenter);
      if (others.length) {
        const avgOthers = avg(others.map(c => c.score));
        const diff = center.score - avgOthers;
        lines.push(`\nComparación vs otros centros (${others.length} centros):`);
        lines.push(`  Diferencia: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)} puntos`);
        lines.push(`  Promedio otros centros: ${avgOthers.toFixed(2)}`);
        lines.push(`  Posición rank: ${centerAnalysis.indexOf(center) + 1} de ${centerAnalysis.length}`);
      }
    }
  } else {
    // Vista global: ranking de centros
    lines.push('\n--- RANKING DE CENTROS ---');
    centerAnalysis.slice(0, 8).forEach((c, i) => {
      const rolesSummary = Object.entries(c.byRole)
        .map(([r, d]) => `${r}:${d.score.toFixed(1)}`)
        .join(' | ');
      lines.push(`${i + 1}. ${c.name}: ${c.score.toFixed(2)} (${c.total} eval.) — ${rolesSummary}`);
    });

    // Dispersión entre centros
    const scores = centerAnalysis.map(c => c.score);
    lines.push(`\nDispersión entre centros: desv. est. ${stdDev(scores).toFixed(2)}`);
    if (centerAnalysis.length >= 2) {
      const top = centerAnalysis[0];
      const low = centerAnalysis[centerAnalysis.length - 1];
      lines.push(`Brecha top-bottom: ${(top.score - low.score).toFixed(2)} puntos`);
    }
  }

  return lines.join('\n');
}
