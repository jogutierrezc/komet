// Canasta de capturas para Komet Presenta.
// Estadística e Informe guardan aquí los datos y los filtros de cada gráfico o sección,
// no una imagen, para que la presentación pueda crear gráficos nativos de PowerPoint.
//
// Forma de una captura:
// { id, source: 'estadistica' | 'informe', kind: 'bar' | 'line' | 'table' | 'text', title,
//   filters, categories, series: [{ name, values }], threshold, capturedAt }
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'komet.presentation.basket.v1';
const listeners = new Set();
let cache = null;

function read() {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento disponible: la canasta vive solo mientras la pestaña esté abierta.
  }
  listeners.forEach((fn) => fn());
}

export function getBasket() {
  return read();
}

export function hasCapture(id) {
  return read().some((c) => c.id === id);
}

export function addCapture(capture) {
  const rest = read().filter((c) => c.id !== capture.id);
  write([...rest, { ...capture, capturedAt: new Date().toISOString() }]);
}

export function removeCapture(id) {
  write(read().filter((c) => c.id !== id));
}

export function toggleCapture(capture) {
  if (hasCapture(capture.id)) removeCapture(capture.id);
  else addCapture(capture);
}

export function clearBasket() {
  write([]);
}

export function subscribeBasket(fn) {
  listeners.add(fn);
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      fn();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

export function useBasket() {
  return useSyncExternalStore(subscribeBasket, getBasket, getBasket);
}
