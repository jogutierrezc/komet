// Marca de Komet: un cometa con estela.
export default function KometMark({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className={className}>
      <circle cx="19" cy="9" r="5" fill="#F0B13A" />
      <path d="M15 13C10 17 7 21 3 25" stroke="#F0B13A" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".75" />
      <path d="M12 10C8 14 6 16 2 19" stroke="#F0B13A" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".4" />
    </svg>
  );
}
