// Caché en memoria para consultas pesadas.
//  - Si el dato es reciente, se devuelve al instante (cambiar de módulo ya no vuelve a descargar todo).
//  - Si dos módulos piden lo mismo a la vez, comparten una sola petición.
//  - Si la petición falla, no se guarda: el siguiente intento vuelve a consultar.
// Las escrituras (nueva evaluación, abrir o cerrar período) llaman a invalidate() para no mostrar datos viejos.

const store = new Map(); // key -> { data, at, promise }

export function cached(key, loader, { ttl = 120000, force = false } = {}) {
  const entry = store.get(key);
  const now = Date.now();
  if (!force && entry) {
    if (entry.promise) return entry.promise;
    if (now - entry.at < ttl) return Promise.resolve(entry.data);
  }
  const promise = loader()
    .then((data) => {
      store.set(key, { data, at: Date.now(), promise: null });
      return data;
    })
    .catch((error) => {
      store.delete(key);
      throw error;
    });
  store.set(key, { data: entry?.data, at: entry?.at || 0, promise });
  return promise;
}

export function invalidate(prefix = '') {
  [...store.keys()].forEach((key) => { if (key.startsWith(prefix)) store.delete(key); });
}

/** Mide una carga y la escribe en consola si se activa con localStorage.setItem('komet.perf', '1'). */
export async function timed(label, fn) {
  const t0 = performance.now();
  const result = await fn();
  try {
    if (localStorage.getItem('komet.perf')) {
      console.info(`[perf] ${label}: ${Math.round(performance.now() - t0)} ms`);
    }
  } catch {
    // sin almacenamiento
  }
  return result;
}
