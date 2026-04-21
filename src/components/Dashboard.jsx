import { Clock, MoreVertical, TrendingUp, AlertCircle, School, GraduationCap, Rocket, FileText } from 'lucide-react';
import StatusBadge from './shared/StatusBadge';
import { MOCK_RECENT_EVALS } from '../constants/mockData';

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Responsive Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Metric 1: Convenios Activos */}
        <div className="lg:col-span-3 bg-gradient-to-br from-blue-700 to-blue-500 rounded-3xl p-6 text-white shadow-lg shadow-blue-100 flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <School size={20} className="opacity-60" />
            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full uppercase">Komet Insight</span>
          </div>
          <div>
            <h3 className="text-3xl font-black">42</h3>
            <p className="text-xs font-medium opacity-80 uppercase tracking-widest mt-1">Convenios Activos</p>
          </div>
        </div>

        {/* Metric 2: Estudiantes en Práctica */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><GraduationCap size={20}/></div>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="text-3xl font-black text-gray-800">512</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Estudiantes en Práctica</p>
          </div>
        </div>

        {/* Metric 3: Calificación Promedio */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center space-x-8 overflow-hidden">
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Satisfacción Global</p>
            <h3 className="text-4xl font-black text-blue-600">4.7 <span className="text-sm font-medium text-gray-400">/ 5.0</span></h3>
            <div className="mt-3 flex space-x-1 items-end h-8">
              {[30, 50, 40, 70, 60, 90, 85].map((v, i) => (
                <div key={i} className="flex-1 bg-blue-100 rounded-t-sm" style={{height: `${v}%`}}></div>
              ))}
            </div>
          </div>
          <div className="hidden xl:flex flex-col space-y-2 border-l pl-8 border-gray-50">
            <div className="flex items-center space-x-2 text-[10px] font-bold text-gray-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Salud (4.9)</span>
            </div>
            <div className="flex items-center space-x-2 text-[10px] font-bold text-gray-500">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Admin (4.2)</span>
            </div>
            <div className="flex items-center space-x-2 text-[10px] font-bold text-gray-500">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span>Derecho (4.5)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table & Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Activity Table */}
        <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/20">
            <h3 className="font-bold text-gray-800 flex items-center space-x-2 text-sm uppercase tracking-tight">
              <Clock size={16} className="text-blue-500" />
              <span>Flujo de Evaluaciones</span>
            </h3>
            <button className="text-blue-600 text-[10px] font-black uppercase tracking-widest hover:underline">Ver Reporte Full</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                <tr>
                  <th className="px-6 py-4">Estudiante</th>
                  <th className="px-6 py-4 hidden md:table-cell">Centro</th>
                  <th className="px-6 py-4">Puntaje</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-center">...</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {MOCK_RECENT_EVALS.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {item.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-800">{item.name}</p>
                          <p className="text-[10px] text-gray-400">{item.program}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[11px] text-gray-500 font-medium hidden md:table-cell">{item.center}</td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-700">{item.score}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-gray-300 hover:text-blue-600"><MoreVertical size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Alertas / Info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center space-x-2">
              <AlertCircle size={18} className="text-amber-500" />
              <span>Alertas de Komet</span>
            </h3>
            <div className="space-y-3">
              {[
                { title: 'Convenio Vencido', detail: 'Hospital San Juan', type: 'danger' },
                { title: 'Evaluación Tutor', detail: 'Psicología - 12 pend.', type: 'warning' },
                { title: 'Nueva Solicitud', detail: 'Clínica Portoazul', type: 'info' }
              ].map((alert, i) => (
                <div key={i} className={`p-3 rounded-2xl border flex items-start space-x-3 transition-transform hover:translate-x-1 cursor-pointer ${
                  alert.type === 'danger' ? 'bg-red-50 border-red-100' : 
                  alert.type === 'warning' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'
                }`}>
                  <div className={`mt-1 w-1.5 h-1.5 rounded-full ${
                    alert.type === 'danger' ? 'bg-red-500' : alert.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                  }`}></div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-800">{alert.title}</p>
                    <p className="text-[10px] text-gray-500 uppercase">{alert.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1a1c23] rounded-3xl p-6 text-white shadow-xl shadow-blue-900/10">
            <div className="flex items-center space-x-2 mb-2">
              <Rocket size={16} className="text-blue-500" />
              <h4 className="font-bold text-sm tracking-tight">Centro de Ayuda Komet</h4>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed mb-4">Optimiza tu gestión académica con nuestra documentación oficial.</p>
            <button className="w-full bg-blue-600 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2">
              <FileText size={14} />
              <span>Guía de Usuario</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
