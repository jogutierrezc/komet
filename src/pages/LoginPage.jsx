import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { login } from '../auth/auth';
import KometMark from '../components/shared/KometMark';
import OrbitScale from '../components/shared/OrbitScale';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const root = useRef(null);

  // Entrada: el cometa dibuja su trayectoria, el titular entra por líneas y el formulario escalonado.
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tail = root.current.querySelector('.orbit-tail');
        const length = tail.getTotalLength();
        gsap.set(tail, { strokeDasharray: length, strokeDashoffset: length });
        gsap.set('.orbit-head', { opacity: 0 });

        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from('.lg-line', { y: 16, opacity: 0, duration: 0.5, stagger: 0.07 })
          .from('.lg-form > *', { y: 12, opacity: 0, duration: 0.4, stagger: 0.04 }, 0.15)
          .to(tail, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.out' }, 0.1)
          .to('.orbit-head', { opacity: 1, duration: 0.2 }, 0.85);
      });
    }, root);
    return () => {
      ctx.revert();
      mm.revert();
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    login();
    navigate('/', { replace: true });
  };

  return (
    <div ref={root} className="min-h-screen flex flex-col lg:flex-row bg-paper">
      <div className="relative overflow-hidden bg-night text-white px-6 py-8 sm:px-10 lg:px-16 lg:py-14 lg:flex-1 flex flex-col justify-between gap-10 lg:gap-24">
        <OrbitScale className="pointer-events-none absolute max-w-none w-[360px] -right-32 -top-16 lg:w-[560px] lg:-right-24 lg:top-auto lg:-bottom-16" strokeScale={1} />

        <div className="relative flex items-center gap-3 lg-line">
          <KometMark size={30} />
          <span className="font-display text-2xl font-bold tracking-tight">Komet</span>
        </div>

        <div className="relative max-w-md space-y-4 lg:space-y-5">
          <h1 className="font-display text-[32px] leading-[1.05] lg:text-[54px] lg:leading-[1.02] font-bold tracking-tight text-balance">
            <span className="block lg-line">Cada sitio de práctica,</span>
            <span className="block lg-line">evaluado con el mismo criterio.</span>
          </h1>
          <p className="hidden lg:block text-[17px] leading-relaxed text-[#A9BCC6] lg-line">
            Convenios, encuestas y análisis de docencia-servicio de la Universidad de Santander, en un solo lugar.
          </p>
        </div>

        <p className="hidden lg:block relative font-mono text-xs tracking-[0.08em] text-[#8FA8B3]">
          ESCALA 1,0 – 5,0 · UMBRAL 3,5
        </p>
      </div>

      <div className="flex flex-col px-6 py-8 sm:px-10 lg:flex-1 lg:px-16 lg:py-10">
        <p className="hidden lg:block text-right text-sm text-ink-2">
          ¿Vas a evaluar un sitio de práctica?{' '}
          <button type="button" onClick={() => navigate('/evaluacion-publica')} className="font-semibold text-blue-600 hover:text-blue-700">
            Entra con tu código
          </button>
        </p>

        <div className="flex-1 flex items-center justify-center py-8">
          <form onSubmit={handleSubmit} className="lg-form w-full max-w-[400px] space-y-7">
            <div className="space-y-2">
              <h2 className="font-display text-[26px] lg:text-4xl font-bold leading-tight">Iniciar sesión</h2>
              <p className="text-base text-ink-2">Usa tu correo institucional.</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="login-user" className="text-sm font-semibold">Correo institucional</label>
                <input
                  id="login-user"
                  required
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="nombre@udes.edu.co"
                  className="k-input"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label htmlFor="login-pass" className="text-sm font-semibold">Contraseña</label>
                  <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-700">¿La olvidaste?</button>
                </div>
                <input
                  id="login-pass"
                  required
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="k-input"
                />
              </div>

              <label htmlFor="login-remember" className="flex items-center gap-2.5 min-h-[44px] text-sm cursor-pointer">
                <input id="login-remember" type="checkbox" className="w-5 h-5 accent-blue-600" />
                Mantener la sesión en este equipo
              </label>
            </div>

            <button type="submit" className="k-btn w-full !h-[52px] !rounded-[10px] !text-base">
              Ingresar
            </button>

            <p className="lg:hidden pt-4 border-t border-line text-center text-sm text-ink-2">
              ¿Vas a evaluar un sitio?{' '}
              <button type="button" onClick={() => navigate('/evaluacion-publica')} className="font-semibold text-blue-600">
                Entra con tu código
              </button>
            </p>
          </form>
        </div>

        <p className="hidden lg:flex justify-between font-mono text-xs text-ink-2">
          <span>Universidad de Santander</span>
          <span>v2.5</span>
        </p>
      </div>
    </div>
  );
}
