// Filtro por período compartido por Estadística, Informe y Presenta.
// Cada fila de evaluación trae `period` (código, p. ej. 2026-A). "Todos" no filtra.

export const PERIOD_FILTER_KEY = 'komet.period.filter';

/** El módulo de Períodos deja aquí el período a consultar. Se lee al abrir y se borra con clearInitialPeriod(). */
export function readInitialPeriod() {
  try {
    return sessionStorage.getItem(PERIOD_FILTER_KEY) || 'Todos';
  } catch {
    return 'Todos';
  }
}

export function clearInitialPeriod() {
  try {
    sessionStorage.removeItem(PERIOD_FILTER_KEY);
  } catch {
    // sin almacenamiento
  }
}

const UNDEFINED = 'No definido';

/** Períodos presentes en los datos, del más reciente al más antiguo. */
export function periodOptionsFrom(rows = []) {
  const codes = [...new Set(rows.map((row) => row.period).filter((p) => p && p !== UNDEFINED))].sort().reverse();
  const hasUndefined = rows.some((row) => !row.period || row.period === UNDEFINED);
  return ['Todos', ...codes, ...(hasUndefined ? [UNDEFINED] : [])];
}

export const matchesPeriod = (row, selected) => selected === 'Todos' || (row.period || UNDEFINED) === selected;
