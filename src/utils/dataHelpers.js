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
