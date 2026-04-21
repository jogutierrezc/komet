export default function StatusBadge({ status }) {
  const styles = {
    'Completed': 'bg-emerald-100 text-emerald-600',
    'In Process': 'bg-blue-100 text-blue-600',
    'On Hold': 'bg-orange-100 text-orange-600',
    'Activo': 'bg-emerald-100 text-emerald-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}
