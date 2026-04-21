import { Rocket } from 'lucide-react';

export default function Sistema() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400 text-center p-8">
      <Rocket size={48} className="mb-4 opacity-10 animate-bounce" />
      <p className="italic font-medium text-sm">El módulo de "Sistema" está siendo preparado para el despegue.</p>
      <p className="text-[10px] text-gray-300 mt-2">Aquí podrás configurar los parámetros generales del sistema Komet.</p>
    </div>
  );
}
