// Módulos de la aplicación, cargados bajo demanda: el navegador solo descarga el código de lo que se abre.
// preload() adelanta la descarga (al pasar el cursor por el menú o cuando el navegador está libre).
import { lazy } from 'react';

const loaders = {
  dashboard: () => import('./components/Dashboard'),
  convenios: () => import('./components/Convenios'),
  estudiantes: () => import('./components/Estudiantes'),
  profesores: () => import('./components/Profesores'),
  evaluaciones: () => import('./components/Evaluaciones'),
  periodos: () => import('./components/Periodos'),
  reportes: () => import('./components/Reportes'),
  estadistica: () => import('./components/Estadistica'),
  presenta: () => import('./components/KometPresenta'),
  sistema: () => import('./components/Sistema'),
};

export const views = Object.fromEntries(Object.entries(loaders).map(([id, load]) => [id, lazy(load)]));

export const preload = (id) => {
  loaders[id]?.().catch(() => {});
};

/** Con la aplicación ya abierta y el navegador libre, trae el resto de módulos de uno en uno. */
export function preloadWhenIdle(skip = []) {
  const ids = Object.keys(loaders).filter((id) => !skip.includes(id));
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  ids.forEach((id, i) => idle(() => setTimeout(() => preload(id), i * 400), { timeout: 8000 }));
}
