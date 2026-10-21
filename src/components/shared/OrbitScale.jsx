// Escala 1,0 a 5,0 como anillos concéntricos; el anillo punteado es el umbral 3,5 y el cometa cruza la escala.
// Las clases `orbit-*` son los puntos de enganche de las animaciones GSAP.
const RINGS = [82, 124, 166, 208, 250];

export default function OrbitScale({ className = '', showLabels = true, strokeScale = 1 }) {
  return (
    <svg viewBox="0 0 520 520" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="orbit-tail" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#F0B13A" stopOpacity="0" />
          <stop offset="1" stopColor="#F0B13A" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#2B4A5A" strokeWidth={1 * strokeScale}>
        {RINGS.map((r) => (
          <circle key={r} className="orbit-ring" cx="260" cy="260" r={r} />
        ))}
      </g>
      <circle className="orbit-threshold" cx="260" cy="260" r="187" fill="none" stroke="#F0B13A" strokeWidth={1.25 * strokeScale} strokeDasharray="4 5" />
      <path className="orbit-tail" d="M20 500C150 470 290 380 372 214" fill="none" stroke="url(#orbit-tail)" strokeWidth={3 * strokeScale} strokeLinecap="round" />
      <circle className="orbit-head" cx="372" cy="214" r="8" fill="#F0B13A" />
      {showLabels && (
        <g fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="#7F9BAA">
          <text x="266" y="176">1</text>
          <text x="266" y="134">2</text>
          <text x="266" y="92">3</text>
          <text x="266" y="48">4</text>
          <text x="266" y="18">5</text>
          <text x="268" y="73" fontSize="10" fill="#F0B13A" letterSpacing="1">UMBRAL 3,5</text>
        </g>
      )}
    </svg>
  );
}
