import { useState } from 'react';
import { 
  Plus, 
  Eye, 
  Pencil, 
  Trash2, 
  Ban,
  MapPin,
  Building2,
  Image as ImageIcon,
  ChevronRight,
  Rocket,
  ClipboardCheck
} from 'lucide-react';

const INITIAL_SITES = [
  {
    id: 1,
    nombre: "Hospital Universitario San Juan",
    foto: "https://images.unsplash.com/photo-1587350859728-117622bc73cd?auto=format&fit=crop&q=80&w=150",
    tipo: "Hospital Universitario",
    direccion: "Calle 45 #23-10, Bucaramanga",
    evaluaciones: { estudiantes: 128, coordinadores: 22, profesores: 37 },
    promedioAnual: 4.6,
    promedioSemestre: 4.4,
    estado: 'activo'
  },
  {
    id: 2,
    nombre: "IPS Salud Total Sede Norte",
    foto: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=150",
    tipo: "IPS",
    direccion: "Av. Libertador #12-40",
    evaluaciones: { estudiantes: 74, coordinadores: 10, profesores: 18 },
    promedioAnual: 4.3,
    promedioSemestre: 4.2,
    estado: 'activo'
  },
  {
    id: 3,
    nombre: "Centro de Simulación Avanzada",
    foto: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=150",
    tipo: "Centros de Simulación",
    direccion: "Carrera 27 #54-02",
    evaluaciones: { estudiantes: 196, coordinadores: 31, profesores: 45 },
    promedioAnual: 4.8,
    promedioSemestre: 4.7,
    estado: 'activo'
  }
];

export default function Convenios() {
  const [view, setView] = useState('list');
  const [sites, setSites] = useState(INITIAL_SITES);
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'IPS',
    direccion: '',
    foto: ''
  });

  const handleCreateSite = (e) => {
    e.preventDefault();
    const newSite = {
      ...formData,
      id: Date.now(),
      evaluaciones: { estudiantes: 0, coordinadores: 0, profesores: 0 },
      promedioAnual: 0,
      promedioSemestre: 0,
      estado: 'activo',
      foto: formData.foto || "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=150"
    };
    setSites([newSite, ...sites]);
    setView('list');
    setFormData({ nombre: '', tipo: 'IPS', direccion: '', foto: '' });
  };

  const deleteSite = (id) => {
    setSites(sites.filter(site => site.id !== id));
  };

  const toggleStatus = (id) => {
    setSites(sites.map(site => 
      site.id === id ? { ...site, estado: site.estado === 'activo' ? 'inactivo' : 'activo' } : site
    ));
  };

  if (view === 'list') {
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Sitios de Práctica</h1>
            <p className="text-gray-500 text-sm mt-1">Gestiona los convenios y lugares donde tus estudiantes realizan sus prácticas.</p>
          </div>
          <button 
            onClick={() => setView('create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl font-medium text-sm flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            Nuevo Sitio
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Total Sitios" value={sites.length} color="blue" />
          <StatCard label="Evaluaciones Presentadas" value={sites.reduce((a, b) => a + b.evaluaciones.estudiantes + b.evaluaciones.coordinadores + b.evaluaciones.profesores, 0)} color="indigo" />
          <StatCard label="Promedio Anual Global" value={(sites.reduce((a, b) => a + b.promedioAnual, 0) / Math.max(sites.length, 1)).toFixed(2)} color="emerald" />
        </div>

        {/* Sites Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Sitio de Práctica</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Tipo de Sitio</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-center">Evaluaciones</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-center">Promedios</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Dirección</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sites.map((site) => (
                <tr key={site.id} className={`hover:bg-gray-50/50 transition-colors ${site.estado === 'inactivo' ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <img 
                        src={site.foto} 
                        alt={site.nombre} 
                        className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                      <div>
                        <p className="font-bold text-gray-800 text-sm leading-tight">{site.nombre}</p>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${site.estado === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                          {site.estado}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Building2 size={14} className="text-gray-400" />
                      {site.tipo}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-4 text-center">
                      <div>
                        <p className="text-sm font-bold text-gray-800 leading-none">{site.evaluaciones.estudiantes}</p>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase">Estudiantes</p>
                      </div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <div>
                        <p className="text-sm font-bold text-gray-800 leading-none">{site.evaluaciones.coordinadores}</p>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase">Coordinadores</p>
                      </div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <div>
                        <p className="text-sm font-bold text-gray-800 leading-none">{site.evaluaciones.profesores}</p>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase">Profesores</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-4 text-center">
                      <div>
                        <p className="text-sm font-bold text-blue-700 leading-none">{site.promedioAnual.toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase">Anual</p>
                      </div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <div>
                        <p className="text-sm font-bold text-emerald-700 leading-none">{site.promedioSemestre.toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase">Semestre</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 italic">
                    {site.direccion}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <ActionButton icon={<Eye size={16} />} tooltip="Ver" color="blue" />
                      <ActionButton icon={<Pencil size={16} />} tooltip="Editar" color="slate" />
                      <ActionButton 
                        icon={site.estado === 'activo' ? <Ban size={16} /> : <ClipboardCheck size={16} />} 
                        tooltip={site.estado === 'activo' ? "Deshabilitar" : "Habilitar"} 
                        color="orange"
                        onClick={() => toggleStatus(site.id)}
                      />
                      <ActionButton 
                        icon={<Trash2 size={16} />} 
                        tooltip="Eliminar" 
                        color="red" 
                        onClick={() => deleteSite(site.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sites.length === 0 && (
            <div className="py-20 flex flex-col items-center text-gray-400">
              <Rocket size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">No hay sitios de práctica registrados</p>
              <button onClick={() => setView('create')} className="text-blue-600 text-sm font-semibold mt-2 hover:underline">
                Comienza agregando uno nuevo
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2">
      <button 
        onClick={() => setView('list')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 mb-6 transition-colors"
      >
        <ChevronRight size={16} className="rotate-180" />
        Volver al listado
      </button>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
            <Building2 size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Registrar Nuevo Sitio</h2>
            <p className="text-sm text-gray-500 italic">Completa la información básica del convenio.</p>
          </div>
        </div>

        <form onSubmit={handleCreateSite} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-gray-500 ml-1">Nombre del Sitio</label>
              <input 
                required
                type="text" 
                placeholder="Ej. Clínica Santa Cruz"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={formData.nombre}
                onChange={e => setFormData({...formData, nombre: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-gray-500 ml-1">Tipo de Sitio</label>
              <select 
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                value={formData.tipo}
                onChange={e => setFormData({...formData, tipo: e.target.value})}
              >
                <option>IPS</option>
                <option>Hospital Universitario</option>
                <option>Escenarios de Práctica no clínicos</option>
                <option>Centros de Simulación</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-500 ml-1">Dirección del Sitio</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                required
                type="text" 
                placeholder="Calle, número, ciudad..."
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={formData.direccion}
                onChange={e => setFormData({...formData, direccion: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-500 ml-1">Foto del Sitio (URL)</label>
            <div className="relative">
              <ImageIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="url" 
                placeholder="https://ejemplo.com/foto.jpg"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={formData.foto}
                onChange={e => setFormData({...formData, foto: e.target.value})}
              />
            </div>
            <p className="text-[10px] text-gray-400 italic ml-1">Si dejas este campo vacío, se asignará una imagen por defecto.</p>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
            >
              Guardar Sitio de Práctica
            </button>
            <button 
              type="button"
              onClick={() => setView('list')}
              className="px-6 py-3 border border-gray-200 rounded-2xl text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// UI Components
const StatCard = ({ label, value, color }) => {
  const colors = {
    blue: "bg-blue-50 border-blue-100",
    indigo: "bg-indigo-50 border-indigo-100",
    emerald: "bg-emerald-50 border-emerald-100"
  };
  
  return (
    <div className={`p-6 rounded-2xl border shadow-sm flex items-center justify-between ${colors[color] || colors.blue}`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
        <p className="text-3xl font-black text-gray-800">{value}</p>
      </div>
      <div className="p-3 rounded-2xl bg-white border border-gray-200">
        <Building2 size={24} className="text-gray-300" />
      </div>
    </div>
  );
};

const ActionButton = ({ icon, tooltip, color, onClick }) => {
  const colors = {
    blue: "hover:bg-blue-50 hover:text-blue-600",
    red: "hover:bg-red-50 hover:text-red-600",
    slate: "hover:bg-gray-100 hover:text-gray-800",
    orange: "hover:bg-orange-50 hover:text-orange-600"
  };

  return (
    <div className="relative group">
      <button 
        onClick={onClick}
        className={`p-2 rounded-lg transition-colors text-gray-400 ${colors[color]}`}
      >
        {icon}
      </button>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
        {tooltip}
      </span>
    </div>
  );
};
