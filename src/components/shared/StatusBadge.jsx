const TONES = {
  Completed: 'k-pill-high',
  Completada: 'k-pill-high',
  Activo: 'k-pill-high',
  'In Process': 'k-pill-mid',
  'En proceso': 'k-pill-mid',
  Pendiente: 'k-pill-mid',
  'On Hold': 'k-pill-low',
};

export default function StatusBadge({ status }) {
  return <span className={`k-pill ${TONES[status] || 'bg-paper text-ink'}`}>{status}</span>;
}
