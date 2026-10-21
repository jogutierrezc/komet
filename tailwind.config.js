// Tokens del rediseño: noche y papel, teal para acciones, ámbar solo para el cometa y las alertas.
// `blue` se remapea a teal para que los módulos aún sin migrar tomen la nueva paleta.
const teal = {
  50: '#EEF6F5',
  100: '#D8EBE8',
  200: '#B3D7D2',
  300: '#84BDB6',
  400: '#4F9C95',
  500: '#2B827C',
  600: '#0F6B68',
  700: '#0A5755',
  800: '#0A4543',
  900: '#0B3635',
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: teal,
        night: { DEFAULT: '#0C1F2B', 2: '#15303F', 3: '#1B3B4C' },
        paper: '#F3F5F2',
        ink: { DEFAULT: '#14222B', 2: '#4A5A63' },
        line: { DEFAULT: '#D5DCD8', strong: '#7F918B' },
        comet: '#F0B13A',
        score: {
          high: '#0F6B68',
          'high-bg': '#D8EFE8',
          'high-fg': '#0B5A47',
          mid: '#D9961A',
          'mid-bg': '#FCEBC0',
          'mid-fg': '#7A4E00',
          low: '#B3402E',
          'low-bg': '#F9DCD6',
          'low-fg': '#9A2F1F',
        },
      },
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Public Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      // Escala corta de radios: lo que antes era 24-48 px queda en 12 px.
      borderRadius: {
        xl: '10px',
        '2xl': '12px',
        '3xl': '12px',
        '4xl': '12px',
      },
      fontWeight: {
        black: '700',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
    },
  },
  plugins: [],
}
