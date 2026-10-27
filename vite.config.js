import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    rolldownOptions: {
      output: {
        // Las librerías se agrupan por tamaño y frecuencia de uso: lo común va en archivos que el navegador
        // guarda en caché entre despliegues, y lo pesado (gráficas) solo se baja al abrir su módulo.
        advancedChunks: {
          groups: [
            { name: 'icons', test: /node_modules[\\/]lucide-react/ },
            { name: 'charts', test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|recharts-scale|decimal\.js-light|internmap)/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
