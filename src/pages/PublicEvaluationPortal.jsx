import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, ArrowRight, UserCheck, User, GraduationCap, Building2, Calendar, AlertCircle, Layout, Fingerprint } from 'lucide-react';
import EvaluacionesFormPreview from '../components/EvaluacionesFormPreview';
import { getConveniosByCampus, getPortalUserByCode, getPortalActiveSurveysByCode, createEvaluationWithResponses, calculateSurveyScoreSummary, getProgramsByCampus, getSurveyById } from '../lib/data';

export default function PublicEvaluationPortal() {
  const [searchParams] = useSearchParams();
  const sharedSurveyId = (searchParams.get('survey') || searchParams.get('sid') || '').trim();
  const [view, setView] = useState('login');
  const [userId, setUserId] = useState('');
  const [userData, setUserData] = useState(null);
  const [sharedSurvey, setSharedSurvey] = useState(null);
  const [publicRespondent, setPublicRespondent] = useState({
    full_name: '',
    academic_code: '',
    document_number: '',
    program_level: 'Pregrado',
    program: ''
  });
  const [selectedPublicRole, setSelectedPublicRole] = useState('');
  const [publicStep, setPublicStep] = useState(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [surveys, setSurveys] = useState([]);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [centers, setCenters] = useState([]);
  const [selectedCenterId, setSelectedCenterId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [programOptions, setProgramOptions] = useState([]);

  const normalizeProgramLevel = (value = '') => {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalized.startsWith('pre')) return 'pregrado';
    if (normalized.startsWith('pos')) return 'posgrado';
    return normalized;
  };

  const selectedCampusId = sharedSurveyId ? sharedSurvey?.campus_id || null : userData?.campus_id || null;

  const filteredProgramOptions = programOptions.filter((item) => {
    const level = normalizeProgramLevel(item.level);
    const selectedLevel = normalizeProgramLevel(publicRespondent.program_level);
    return !selectedLevel || level === selectedLevel;
  });

  const capitalize = (value = '') => String(value)
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  const formatSurveyDescription = (description, scenarioName) => {
    if (!description) return '';
    if (!scenarioName) return description;
    return description.replace(/(Escenario:\s*)([^·]+)/i, `$1${scenarioName}`);
  };

  const mapTargetTypeToRole = (targetType = '') => {
    const normalized = String(targetType || '').toLowerCase();
    if (normalized.includes('profesor') || normalized.includes('docente')) return 'professor';
    if (normalized.includes('estudiante')) return 'student';
    if (normalized.includes('coordinador')) return 'coordinator';
    return 'public';
  };

  const roleOptions = [
    { id: 'student', label: 'Estudiante', icon: GraduationCap, color: 'text-blue-600' },
    { id: 'professor', label: 'Profesor', icon: User, color: 'text-emerald-600' },
    { id: 'coordinator', label: 'Coordinador', icon: UserCheck, color: 'text-indigo-600' }
  ];

  const roleLabel = (value = '') => {
    if (value === 'student') return 'Estudiante';
    if (value === 'professor') return 'Profesor';
    if (value === 'coordinator') return 'Coordinador';
    return capitalize(value || 'Publico');
  };

  const getCurrentAcademicPeriod = () => {
    const now = new Date();
    const year = now.getFullYear();
    return `${year}-${now.getMonth() < 6 ? 'A' : 'B'}`;
  };

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSharedSurvey() {
      if (!sharedSurveyId) return;

      setIsLoading(true);
      setError('');

      try {
        const survey = await getSurveyById(sharedSurveyId);
        if (!survey) {
          if (!cancelled) {
            setError('El enlace público no corresponde a una evaluación válida o fue desactivado.');
            setView('login');
          }
          return;
        }

        if (!cancelled) {
          setSharedSurvey(survey);
          setSelectedSurvey(survey);
          setSurveys([survey]);
          const availableCenters = await loadAvailableCenters(survey.campus_id || null);
          setSelectedCenterId(availableCenters?.[0]?.id || '');
          setSelectedPublicRole('');
          setPublicStep(1);
          setView('public-entry');
        }
      } catch (loadError) {
        console.error('Error cargando encuesta pública por enlace:', loadError);
        if (!cancelled) {
          setError('No se pudo cargar la evaluación pública desde el enlace.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    bootstrapSharedSurvey();

    return () => {
      cancelled = true;
    };
  }, [sharedSurveyId]);

  useEffect(() => {
    if (!selectedCampusId) {
      setProgramOptions([]);
      return;
    }

    let cancelled = false;

    async function loadPrograms() {
      try {
        const list = await getProgramsByCampus(selectedCampusId);
        if (!cancelled) setProgramOptions(list);
      } catch (programError) {
        console.error('Error cargando programas del campus:', programError);
        if (!cancelled) setProgramOptions([]);
      }
    }

    loadPrograms();

    return () => {
      cancelled = true;
    };
  }, [selectedCampusId]);

  useEffect(() => {
    const exists = filteredProgramOptions.some((item) => item.name === publicRespondent.program);
    if (!exists) {
      const nextProgram = filteredProgramOptions[0]?.name || '';
      if (nextProgram === publicRespondent.program) return;
      setPublicRespondent((prev) => ({
        ...prev,
        program: nextProgram
      }));
    }
  }, [publicRespondent.program_level, filteredProgramOptions]);

  useEffect(() => {
    if (sharedSurveyId) return;
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
  }, [sharedSurveyId, userData, userId, selectedCenterId]);

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
    if (sharedSurveyId) return;
    if (userData) {
      loadAvailableCenters(userData.campus_id || null);
    }
  }, [sharedSurveyId, userData]);

  useEffect(() => {
    if (sharedSurveyId) return;
    if (!userData || !centers.length) return;
    if (!selectedCenterId) {
      setSelectedCenterId(userData.practice_center_id || centers[0]?.id || '');
    }
  }, [sharedSurveyId, userData, centers]);

  async function loadAvailableCenters(campusId) {
    try {
      const data = await getConveniosByCampus(campusId);
      setCenters(data);
      return data;
    } catch (error) {
      console.error('Error cargando centros de práctica:', error);
      setCenters([]);
      return [];
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
            nombre: sharedSurveyId ? publicRespondent.full_name : userData.full_name,
            programaOrigen: sharedSurveyId ? publicRespondent.program : userData.program,
            role: sharedSurveyId
              ? roleLabel(selectedPublicRole || mapTargetTypeToRole(selectedSurvey?.target_type || 'public'))
              : userData.role === 'student'
              ? 'Estudiante'
              : userData.role === 'professor'
              ? 'Profesor'
              : capitalize(userData.role || ''),
            escenario: centers.find((center) => center.id === selectedCenterId)?.name || userData?.practice_center_name || userData?.campus_name,
            periodo: sharedSurveyId ? getCurrentAcademicPeriod() : userData.started || userData.status || 'N/A'
          }}
          onClose={() => setView(sharedSurveyId ? 'public-entry' : 'ready')}
          onSubmit={async (answers) => {
            if (!selectedSurvey) return;
            setIsSubmitting(true);
            try {
              const responsePayload = {
                ...(answers || {}),
                _publicRespondent: sharedSurveyId
                  ? {
                      role: selectedPublicRole,
                      full_name: publicRespondent.full_name,
                      academic_code: publicRespondent.academic_code,
                      document_number: publicRespondent.document_number,
                      program_level: publicRespondent.program_level,
                      program: publicRespondent.program
                    }
                  : null,
                _publicContext: sharedSurveyId
                  ? {
                      period: getCurrentAcademicPeriod(),
                      practice_center_id: selectedCenterId || null,
                      practice_center_name: centers.find((center) => center.id === selectedCenterId)?.name || null
                    }
                  : null,
                _source: sharedSurveyId ? 'public_link' : 'authenticated_portal',
                _survey_link_id: sharedSurveyId || null
              };

              const createdEvaluation = await createEvaluationWithResponses(
                {
                  survey_id: selectedSurvey.id,
                  campus_id: selectedSurvey.campus_id || userData?.campus_id || null,
                  center_id: selectedCenterId || userData?.practice_center_id || null,
                  student_id: sharedSurveyId ? null : userData.role === 'student' ? userData.user_id : null,
                  tutor_id: sharedSurveyId ? null : userData.role === 'professor' ? userData.user_id : null,
                  evaluator_user_id: sharedSurveyId ? null : userData.user_id || null,
                  evaluator_role: sharedSurveyId ? selectedPublicRole || mapTargetTypeToRole(selectedSurvey?.target_type || 'public') : userData.role || null,
                  status: 'Completada',
                  completed_at: new Date().toISOString(),
                  dirigidoA: selectedSurvey.target_type || 'Todos',
                  estado: sharedSurveyId ? selectedPublicRole || 'public' : userData.role || null,
                  periodoCorte: sharedSurveyId ? getCurrentAcademicPeriod() : userData.started || userData.status || null,
                  preguntas: responsePayload,
                  tipoPrograma: sharedSurveyId ? publicRespondent.program_level || null : selectedSurvey.target_type || null,
                  titulo: selectedSurvey.title || null
                },
                [{ answers: responsePayload }]
              );

              const scoreSummary = calculateSurveyScoreSummary({
                survey: selectedSurvey,
                answers: responsePayload
              });
              console.log('Puntajes calculados desde respuestas:', scoreSummary, createdEvaluation);

              if (sharedSurveyId) {
                setView('public-success');
                setError('');
                return;
              }

              const activeSurveys = await getPortalActiveSurveysByCode(userId.trim(), selectedCenterId);
              setSurveys(activeSurveys);
              setSelectedSurvey(activeSurveys?.[0] || null);
              setError('');
              setView('ready');
            } catch (error) {
              console.error('Error guardando la evaluación:', error);
              if (error?.code === 'already_evaluated_center' || error?.code === '23505') {
                setError('Ya registraste una evaluación para este sitio de práctica. Solo se permite una evaluación por sitio y por rol.');
                setView(sharedSurveyId ? 'public-entry' : 'ready');
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

  if (view === 'public-success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-2xl w-full rounded-[2rem] border border-emerald-100 bg-white p-10 shadow-xl text-center">
          <h2 className="text-3xl font-black text-emerald-700 mb-3">Evaluación enviada</h2>
          <p className="text-slate-600 mb-8">
            Gracias, tu evaluación fue registrada correctamente para el sitio de práctica seleccionado.
          </p>
          <button
            type="button"
            onClick={() => {
              setView('public-entry');
              setSelectedSurvey(sharedSurvey || selectedSurvey);
              setSelectedPublicRole('');
              setPublicRespondent({
                full_name: '',
                academic_code: '',
                document_number: '',
                program_level: 'Pregrado',
                program: ''
              });
              setPublicStep(1);
            }}
            className="rounded-[2rem] bg-blue-600 px-8 py-4 text-white font-bold uppercase tracking-[0.15em] hover:bg-blue-700 transition-all"
          >
            Nueva respuesta
          </button>
        </div>
      </div>
    );
  }

  if (view === 'public-entry') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-3xl rounded-[2rem] bg-white border border-slate-200 p-8 shadow-xl space-y-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">Enlace público</p>
            <h1 className="text-3xl font-black text-slate-900 mt-2">Registro para evaluar sitio de práctica</h1>
            <p className="text-slate-500 mt-2">Completa tus datos académicos y selecciona el sitio de práctica conforme al campus de la evaluación.</p>
          </div>

          {sharedSurvey ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] font-black text-slate-400 mb-1">Evaluación</p>
              <p className="text-lg font-black text-slate-800">{sharedSurvey.title || 'Evaluación pública'}</p>
              <p className="text-sm text-slate-500 mt-1">{sharedSurvey.description || 'Formulario de evaluación institucional.'}</p>
            </div>
          ) : null}

          {publicStep === 1 ? (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-3 duration-300">
              <p className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-500">1. Selecciona el rol con el que evalúas</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {roleOptions.map((roleOption) => (
                  <button
                    key={roleOption.id}
                    type="button"
                    onClick={() => setSelectedPublicRole(roleOption.id)}
                    className={`rounded-2xl border p-4 text-left transition-all ${selectedPublicRole === roleOption.id ? 'border-blue-600 bg-blue-50 shadow-md shadow-blue-100' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}
                  >
                    <roleOption.icon className={`w-6 h-6 mb-3 ${roleOption.color}`} />
                    <p className="text-sm font-black text-slate-900">{roleOption.label}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-left-3 duration-300">
              <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                <p><span className="font-bold">Rol seleccionado:</span> {roleLabel(selectedPublicRole)}</p>
                <p><span className="font-bold">Periodo:</span> {getCurrentAcademicPeriod()}</p>
                <p><span className="font-bold">Escenario:</span> {centers.find((center) => center.id === selectedCenterId)?.name || 'Selecciona un sitio de práctica'}</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Nombre completo</label>
                <input
                  value={publicRespondent.full_name}
                  onChange={(e) => setPublicRespondent((prev) => ({ ...prev, full_name: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                  placeholder="Nombre completo"
                />
              </div>

              {selectedPublicRole === 'student' ? (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Código Académico</label>
                  <input
                    value={publicRespondent.academic_code}
                    onChange={(e) => setPublicRespondent((prev) => ({ ...prev, academic_code: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                    placeholder="Ej: A0123456"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">No. de Documento</label>
                  <input
                    value={publicRespondent.document_number}
                    onChange={(e) => setPublicRespondent((prev) => ({ ...prev, document_number: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                    placeholder="Ej: 1098765432"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Nivel de Formación</label>
                <select
                  value={publicRespondent.program_level}
                  onChange={(e) => setPublicRespondent((prev) => ({ ...prev, program_level: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="Pregrado">Pregrado</option>
                  <option value="Posgrado">Posgrado</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Programa Académico</label>
                <select
                  value={publicRespondent.program}
                  onChange={(e) => setPublicRespondent((prev) => ({ ...prev, program: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="">Selecciona un programa</option>
                  {filteredProgramOptions.map((program) => (
                    <option key={program.id} value={program.name}>{program.name}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Sitio de práctica a evaluar</label>
                <select
                  value={selectedCenterId}
                  onChange={(e) => setSelectedCenterId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="">Selecciona un sitio</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>{center.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : null}

          <div className="flex justify-between items-center gap-3">
            {publicStep > 1 ? (
              <button
                type="button"
                onClick={() => setPublicStep(1)}
                className="rounded-[2rem] bg-slate-100 px-6 py-3 text-slate-700 font-bold uppercase tracking-[0.12em] hover:bg-slate-200 transition-all"
              >
                Volver
              </button>
            ) : <span />}

            <button
              type="button"
              onClick={() => {
                if (publicStep === 1) {
                  if (!selectedPublicRole) {
                    setError('Selecciona un rol para continuar.');
                    return;
                  }
                  setError('');
                  setPublicStep(2);
                  return;
                }

                const needsAcademicCode = selectedPublicRole === 'student';
                const idFieldOk = needsAcademicCode ? Boolean(publicRespondent.academic_code) : Boolean(publicRespondent.document_number);

                if (!publicRespondent.full_name || !publicRespondent.program || !idFieldOk) {
                  setError(needsAcademicCode
                    ? 'Debes completar nombre, código académico, nivel y programa para continuar.'
                    : 'Debes completar nombre, número de documento, nivel y programa para continuar.');
                  return;
                }
                if (!selectedCenterId) {
                  setError('Selecciona el sitio de práctica a evaluar.');
                  return;
                }

                setError('');
                setView('form');
              }}
              className="rounded-[2rem] bg-blue-600 px-8 py-4 text-white font-black uppercase tracking-[0.15em] hover:bg-blue-700 transition-all"
            >
              {publicStep === 1 ? 'Siguiente' : 'Continuar al formulario'}
            </button>
          </div>
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
