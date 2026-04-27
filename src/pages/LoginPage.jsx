import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightCircle, Globe, Lock, Rocket, ShieldCheck, User } from 'lucide-react';
import { login } from '../auth/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    login();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=2000"
          alt="Modern Hospital Background"
          className="w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"></div>
      </div>

      <div className="max-w-md w-full relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>

        <div className="bg-white/80 backdrop-blur-xl rounded-[48px] shadow-2xl overflow-hidden border border-white/40">
          <div className="p-12">
            <div className="flex flex-col items-center mb-12">
              <div className="bg-blue-600 p-5 rounded-[24px] shadow-2xl shadow-blue-500/40 mb-6 group cursor-pointer hover:scale-110 hover:rotate-6 transition-all duration-500">
                <Rocket className="text-white w-12 h-12" />
              </div>
              <h1 className="text-5xl font-black text-slate-800 tracking-tighter">KOMET</h1>
              <div className="h-1.5 w-12 bg-blue-600 rounded-full mt-4"></div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.2em] mt-6">Gestión Educativa</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6">Acceso Usuario</label>
                <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                  <input
                    required
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                    placeholder="usuario@komet.com"
                    className="w-full bg-slate-100/50 border border-transparent rounded-[24px] py-4 pl-14 pr-6 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6">Contraseña</label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                  <input
                    required
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full bg-slate-100/50 border border-transparent rounded-[24px] py-4 pl-14 pr-6 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all font-bold text-slate-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between px-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 transition-all" />
                  <span className="text-xs font-bold text-slate-500 group-hover:text-slate-800 transition-colors tracking-tight">Recordarme</span>
                </label>
                <button type="button" className="text-xs font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest">Recuperar clave</button>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[24px] shadow-2xl shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-3 mt-10 text-base uppercase tracking-widest"
              >
                Ingresar
                <ArrowRightCircle size={22} />
              </button>
            </form>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate('/evaluacion-publica')}
                className="text-xs font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest"
              >
                ¿Eres estudiante o docente? Accede al portal de evaluación pública
              </button>
            </div>
          </div>

          <div className="bg-slate-50/50 backdrop-blur-sm border-t border-slate-100/50 p-8 flex items-center justify-center gap-8">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seguridad</span>
              <ShieldCheck className="text-emerald-500 mt-1" size={18} />
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Versión</span>
              <span className="text-slate-600 font-bold text-xs mt-1">2.5.0</span>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Soporte</span>
              <Globe className="text-blue-400 mt-1" size={18} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
