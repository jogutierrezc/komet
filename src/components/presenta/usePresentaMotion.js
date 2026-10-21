// Movimiento de Komet Presenta con GSAP: solo transform y opacity, y nada si el usuario pidió menos movimiento.
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const EASE = 'power3.out';
const NO_REDUCED = '(prefers-reduced-motion: no-preference)';
const REDUCED = '(prefers-reduced-motion: reduce)';

/**
 * Entrada escalonada de los hijos marcados con `selector` (data-reveal por defecto) y crecimiento de las barras marcadas con data-bar.
 * Se vuelve a ejecutar cuando cambian `deps`. matchMedia revierte todo al desmontar o si cambia la preferencia.
 */
export function useReveal(scopeRef, deps, { selector = '[data-reveal]', y = 10, stagger = 0.04, duration = 0.26 } = {}) {
  useEffect(() => {
    const root = scopeRef.current;
    if (!root) return undefined;
    const mm = gsap.matchMedia();
    mm.add(NO_REDUCED, () => {
      const items = root.querySelectorAll(selector);
      const bars = root.querySelectorAll('[data-bar]');
      if (items.length) gsap.from(items, { opacity: 0, y, duration, stagger, ease: EASE, clearProps: 'transform,opacity' });
      if (bars.length) gsap.from(bars, { scaleX: 0, transformOrigin: 'left center', duration: 0.4, stagger: 0.03, ease: EASE, clearProps: 'transform' });
    });
    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Devuelve una función que da un pequeño "rebote" de confirmación a un elemento (p. ej. al elegir una gráfica). */
export function usePulse(scopeRef) {
  const pulseRef = useRef(null);
  useEffect(() => {
    const ctx = gsap.context(() => {}, scopeRef);
    pulseRef.current = ctx.add((el) => {
      if (!el || window.matchMedia(REDUCED).matches) return;
      gsap.fromTo(el, { scale: 0.97 }, { scale: 1, duration: 0.22, ease: EASE, clearProps: 'transform', overwrite: true });
    });
    return () => {
      pulseRef.current = null;
      ctx.revert();
    };
  }, [scopeRef]);
  return (el) => pulseRef.current?.(el);
}

/** Lleva una barra de progreso (scaleX) al valor dado, sin animar si hay preferencia de menos movimiento. */
export function useProgressBar(barRef, value) {
  useEffect(() => {
    const el = barRef.current;
    if (!el) return undefined;
    const mm = gsap.matchMedia();
    mm.add({ calm: REDUCED, live: NO_REDUCED }, (ctx) => {
      gsap.to(el, { scaleX: value, duration: ctx.conditions.live ? 0.3 : 0, ease: EASE, overwrite: true });
    });
    return () => mm.revert();
  }, [barRef, value]);
}
