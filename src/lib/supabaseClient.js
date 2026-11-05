import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// El dominio planeacion.udes.edu.co lo comparten otras aplicaciones con su propio Supabase, y supabase-js
// guarda la sesión en localStorage bajo "sb-<primer-segmento-del-host>-auth-token" (compartido por todo el origen).
// Komet no usa el login de Supabase (solo la clave anon), así que no persiste sesión y usa su propia clave:
// evita enviar el token de otra app (PGRST301) y evita pisar sus sesiones.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'komet-auth-token'
  }
});
