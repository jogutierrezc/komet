import { useEffect, useState } from 'react';
import { ShieldCheck, ArrowRight, UserCheck, User, GraduationCap, Building2, Calendar, AlertCircle, Layout, Fingerprint } from 'lucide-react';
import EvaluacionesFormPreview from '../components/EvaluacionesFormPreview';
import { getConveniosByCampus, getPortalUserByCode, getPortalActiveSurveysByCode, createEvaluationWithResponses, calculateSurveyScoreSummary } from '../lib/data';

export default function PublicEvaluationPortal() {
  const [view, setView] = useState('login');
  const [userId, setUserId] = useState('');
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [surveys, setSurveys] = useState([]);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [centers, setCenters] = useState([]);
  const [selectedCenterId, setSelectedCenterId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const capitalize = (value = '') => String(value)
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  const formatSurveyDescription = (description, scenarioName) => {
    if (!description) return '';
    if (!scenarioName) return description;
    return description.replace(/(Escenario:\s*)([^·]+)/i, `$1${scenarioName}`);
  };

  useEffect(() => {
    if (!userData) return;

    async function loadActiveSurveys() {
      if (!selectedCenterId) {
        setError('Selecciona un centro de práctica para cargar los formularios.');
        return;
      }

      try {
        setError('');
        setSurveys([]);
        setSelectedSurvey(null);

        const activeSurveys = await getPortalActiveSurveysByCode(userId.trim(), selectedCenterId);
        setSurveys(activeSurveys);
        setSelectedSurvey(activeSurveys?.[0] || null);

        if (!activeSurveys?.length) {
          setError('No hay formularios activos disponibles para este centro.');
        }
      } catch (error) {
        console.error('Error al cargar encuestas activas:', error);
        setError('Error al consultar formularios activos. Intente nuevamente.');
      }
    }

    loadActiveSurveys();
  }, [userData, userId, selectedCenterId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSurveys([]);
    setSelectedSurvey(null);
    setSelectedCenterId('');

    try {
      const portalUser = await getPortalUserByCode(userId.trim());
      if (!portalUser) {
        setError('Código no encontrado en la base de datos. Verifique e intente nuevamente.');
        setView('login');
        setUserData(null);
      } else {
        setUserData(portalUser);
        setSelectedCenterId(portalUser.practice_center_id || '');
        setView('verification');
      }
    } catch (error) {
      console.error('Error verificando usuario del portal:', error);
      setError('Error al verificar usuario. Intente nuevamente.');
    }

    setIsLoading(false);
  };

  // Carga centros solo cuando ya conocemos el campus del usuario
  useEffect(() => {
    if (userData) {
      loadAvailableCenters(userData.campus_id || null);
    }
  }, [userData]);

  useEffect(() => {
    if (!userData || !centers.length) return;
    if (!selectedCenterId) {
      setSelectedCenterId(userData.practice_center_id || centers[0]?.id || '');
    }
  }, [userData, centers]);

  async function loadAvailableCenters(campusId) {
    try {
      const data = await getConveniosByCampus(campusId);
      setCenters(data);
    } catch (error) {
      console.error('Error cargando centros de práctica:', error);
      setCenters([]);
    }
  }

  const portalStyles = `
    @keyframes moveLava {
      0% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(5%, -5%) scale(1.1); }
      100% { transform: translate(0, 0) scale(1); }
    }
    .lava-panel {
      position: relative;
      overflow: hidden;
      background: #0f172a;
    }
    .lava-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      animation: moveLava 15s infinite alternate ease-in-out;
      opacity: 0.6;
    }
  `;

  if (view === 'form') {
    return selectedSurvey ? (
      <div className="min-h-screen bg-slate-50">
        <EvaluacionesFormPreview
          survey={selectedSurvey}
          studentInfo={{
            nombre: userData.full_name,
            programaOrigen: userData.program,
            role: userData.role === 'student' ? 'Estudiante' : userData.role === 'professor' ? 'Profesor' : capitalize(userData.role || ''),
            escenario: centers.find((center) => center.id === selectedCenterId)?.name || userData.practice_center_name || userData.campus_name,
            periodo: userData.started || userData.status || 'N/A'
          }}
          onClose={() => setView('ready')}
          onSubmit={async (answers) => {
            if (!selectedSurvey) return;
            setIsSubmitting(true);
            try {
              const createdEvaluation = await createEvaluationWithResponses(
                {
                  survey_id: selectedSurvey.id,
                  campus_id: selectedSurvey.campus_id || userData.campus_id || null,
                  center_id: selectedCenterId || userData.practice_center_id || null,
                  student_id: userData.role === 'student' ? userData.user_id : null,
                  tutor_id: userData.role === 'professor' ? userData.user_id : null,
                  evaluator_user_id: userData.user_id || null,
                  evaluator_role: userData.role || null,
                  status: 'Completada',
                  completed_at: new Date().toISOString(),
                  dirigidoA: selectedSurvey.target_type || 'Todos',
                  estado: userData.role || null,
                  periodoCorte: userData.started || userData.status || null,
                  preguntas: answers || {},
                  tipoPrograma: selectedSurvey.target_type || null,
                  titulo: selectedSurvey.title || null
                },
                [{ answers: answers || {} }]
              );

              const scoreSummary = calculateSurveyScoreSummary({
                survey: selectedSurvey,
                answers: answers || {}
              });
              console.log('Puntajes calculados desde respuestas:', scoreSummary, createdEvaluation);

              const activeSurveys = await getPortalActiveSurveysByCode(userId.trim(), selectedCenterId);
              setSurveys(activeSurveys);
              setSelectedSurvey(activeSurveys?.[0] || null);
              setError('');
              setView('ready');
            } catch (error) {
              console.error('Error guardando la evaluación:', error);
              if (error?.code === 'already_evaluated_center' || error?.code === '23505') {
                setError('Ya registraste una evaluación para este sitio de práctica. Solo se permite una evaluación por sitio y por rol.');
                setView('ready');
              } else {
                setError('No fue posible registrar la evaluación. Intenta nuevamente.');
              }
            } finally {
              setIsSubmitting(false);
            }
          }}
          isSubmitting={isSubmitting}
        />
      </div>
    ) : (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-xl w-full text-center rounded-[2rem] bg-white shadow-2xl p-10">
          <h2 className="text-2xl font-black text-slate-900 mb-4">No hay formulario disponible</h2>
          <p className="text-slate-500 mb-6">No se encontró ningún formulario activo para el usuario. Regresa e intenta nuevamente.</p>
          <button
            type="button"
            onClick={() => setView('ready')}
            className="bg-blue-600 text-white px-8 py-4 rounded-[2rem] font-bold uppercase tracking-[0.15em] shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex font-sans bg-white">
      <style>{portalStyles}</style>

      <div className="hidden lg:flex lg:w-5/12 lava-panel flex-col justify-center items-center p-12 relative">
        <div className="lava-blob bg-blue-600 w-[120%] h-[80%] -top-1/4 -left-1/4" />
        <div className="lava-blob bg-orange-500 w-[100%] h-[70%] -bottom-1/4 -right-1/4" style={{ animationDelay: '-5s' }} />
        <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]" />
        <div className="relative z-10 text-center space-y-8">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-10 rounded-[4rem] shadow-2xl inline-block group transition-transform hover:scale-105 duration-500">
            <ShieldCheck className="w-32 h-32 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
          </div>
          <div className="space-y-4">
            <h2 className="text-white text-5xl font-black tracking-tighter leading-none">
              SISTEMA DE <br />
              <span className="text-blue-400">CALIDAD</span>
            </h2>
            <p className="text-slate-300 text-lg font-medium max-w-xs mx-auto opacity-80">
              Evaluación de prácticas formativas y relación docencia-servicio.
            </p>
          </div>
        </div>
        <div className="absolute bottom-12 left-12 right-12 flex justify-between items-center text-white/30 text-[10px] font-black tracking-[0.3em] uppercase">
          <span>Gestión 2026</span>
          <div className="h-[1px] flex-grow mx-4 bg-white/10"></div>
          <span>v2.0</span>
        </div>
      </div>

      <div className="w-full lg:w-7/12 flex items-center justify-center p-6 md:p-12 lg:p-24 bg-white relative">
        <div className="w-full max-w-lg">
          {view === 'login' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-700">
              <div className="mb-12">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-[2px] bg-blue-600"></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Acceso Institucional</span>
                </div>
                <h1 className="text-4xl font-black text-slate-900 mb-4">Bienvenido al Portal</h1>
                <p className="text-slate-500 text-lg leading-relaxed">
                  Por favor ingrese su identificación para acceder al formulario de evaluación correspondiente.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-8">
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Código de Usuario</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-600 transition-colors">
                      <Fingerprint className="w-6 h-6" />
                    </div>
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="block w-full pl-16 pr-6 py-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none focus:border-blue-600 focus:bg-white transition-all text-xl font-bold text-slate-800 placeholder:text-slate-300"
                      placeholder="Ej: 12345"
                      required
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-3 text-red-500 text-sm font-bold p-4 bg-red-50 rounded-2xl animate-in slide-in-from-top-2">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      {error}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-6 rounded-[2rem] font-black text-lg transition-all flex items-center justify-center gap-4 uppercase tracking-[0.2em] ${isLoading ? 'bg-slate-100 text-slate-400 cursor-wait' : 'bg-slate-900 text-white hover:bg-blue-600 shadow-xl shadow-blue-100 hover:shadow-blue-200 active:scale-95'}`}
                >
                  {isLoading ? 'Verificando...' : 'Entrar al Sistema'}
                  {!isLoading && <ArrowRight className="w-6 h-6" />}
                </button>
              </form>

              <div className="mt-16 grid grid-cols-3 gap-8 border-t border-slate-100 pt-8">
                <div>
                  <p className="text-[10px] font-black text-slate-300 uppercase mb-1">Protección</p>
                  <p className="text-xs font-bold text-slate-500 italic leading-tight">Datos Encriptados</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-300 uppercase mb-1">Soporte</p>
                  <p className="text-xs font-bold text-slate-500 italic leading-tight">Ayuda Directa</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-300 uppercase mb-1">Entorno</p>
                  <p className="text-xs font-bold text-slate-500 italic leading-tight">Seguro / HTTPS</p>
                </div>
              </div>
            </div>
          )}

          {view === 'verification' && userData && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="mb-10 flex items-center gap-6">
                <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center shadow-inner">
                  <UserCheck className="w-10 h-10 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">¿Eres tú?</h2>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Verificación de perfil</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { icon: User, label: 'Nombre', val: userData.full_name },
                  { icon: GraduationCap, label: 'Programa', val: userData.program },
                  { icon: Building2, label: 'Escenario de Práctica', val: centers.find((center) => center.id === selectedCenterId)?.name || userData.practice_center_name || userData.campus_name },
                  { icon: Calendar, label: 'Periodo', val: userData.started || userData.status || 'N/A' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-6 p-6 rounded-[2rem] border-2 border-slate-50 bg-slate-50/50 hover:bg-white hover:border-blue-100 hover:shadow-lg hover:shadow-slate-100 transition-all group">
                    <div className="p-4 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform">
                      <item.icon className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                      <p className="text-lg font-extrabold text-slate-800 leading-tight">{item.val}</p>
                    </div>
                  </div>
                ))}
              <div className="col-span-full">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Centro de práctica a evaluar</label>
                <div className="relative">
                  <select
                    value={selectedCenterId}
                    onChange={(e) => setSelectedCenterId(e.target.value)}
                    className="w-full border border-slate-200 rounded-[2rem] bg-white px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                  >
                    {centers.length ? (
                      centers.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No hay centros disponibles</option>
                    )}
                  </select>
                </div>
              </div>
              </div>

              <div className="mt-6 p-6 rounded-[2rem] border border-slate-100 bg-slate-50/70 text-left">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Encuesta activa</p>
                {surveys.length > 0 ? (
                  <p className="text-slate-700">Se cargó la evaluación activa disponible para tu perfil. Continúa para revisarla.</p>
                ) : (
                  <p className="text-slate-500">No se detectó un formulario activo todavía. Si deberías tener uno, consulta con el administrador.</p>
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-4 mt-10">
                <button
                  type="button"
                  onClick={() => { setView('login'); setUserData(null); setUserId(''); }}
                  className="flex-1 py-6 rounded-[2rem] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all text-xs uppercase tracking-widest"
                >
                  No soy yo, volver
                </button>
                <button
                  type="button"
                  onClick={() => setView('ready')}
                  className="flex-[2] bg-blue-600 text-white py-6 rounded-[2rem] font-black text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-4 uppercase tracking-widest"
                >
                  Sí, soy yo
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}

          {view === 'ready' && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="mb-8 text-center">
                <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Formulario listo</h2>
                <p className="text-slate-500 mt-3">Selecciona la evaluación que deseas completar y continúa.</p>
              </div>

              {surveys.length > 0 ? (
                <div className="space-y-6">
                  <div className="grid gap-4">
                    {surveys.map((survey) => (
                      <button
                        key={survey.id}
                        type="button"
                        onClick={() => setSelectedSurvey(survey)}
                        className={`w-full text-left p-6 rounded-[2rem] border transition-all ${selectedSurvey?.id === survey.id ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-100' : 'border-slate-100 bg-slate-50 hover:border-blue-100 hover:bg-white'}`}
                      >
                        <p className="text-sm uppercase tracking-[0.2em] font-bold text-slate-400 mb-2">{survey.title || 'Evaluación disponible'}</p>
                        <p className="text-lg font-black text-slate-900">{formatSurveyDescription(survey.description, centers.find((center) => center.id === selectedCenterId)?.name || userData.practice_center_name || userData.campus_name) || 'Completa esta evaluación institucional'}</p>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                    <button
                      type="button"
                      onClick={() => setView('form')}
                      disabled={!selectedSurvey}
                      className={`flex-1 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all ${selectedSurvey ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                      Acceder al formulario
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('verification')}
                      className="flex-1 py-5 rounded-[2rem] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 uppercase tracking-[0.2em]"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-10 text-center">
                  <p className="text-slate-600">No hay evaluaciones activas para tu perfil en este momento.</p>
                  <button
                    type="button"
                    onClick={() => setView('login')}
                    className="mt-8 bg-blue-600 text-white py-4 px-8 rounded-[2rem] font-bold uppercase tracking-[0.15em] shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                  >
                    Volver al inicio
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="absolute bottom-8 right-12 text-slate-300 font-bold text-[9px] uppercase tracking-widest">
          S.C.I &copy; 2026
        </div>
      </div>
    </div>
  );
}
