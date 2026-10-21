import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, User, UserCheck, GraduationCap, Building2, Calendar, AlertCircle, Fingerprint } from 'lucide-react';
import KometMark from '../components/shared/KometMark';
import EvaluacionesFormPreview from '../components/EvaluacionesFormPreview';
import { parseDescription } from '../components/evaluaciones/surveyModel';
import { getConveniosByCampus, resolveSharedSurvey, getPortalUserByCode, getPortalActiveSurveysByCode, createEvaluationWithResponses, calculateSurveyScoreSummary, getProgramsByCampus, getSurveyById, sendPublicSurveyConfirmationEmail, getRotationsByConvenio } from '../lib/data';

export default function PublicEvaluationPortal() {
  const [searchParams] = useSearchParams();
  const sharedSurveyId = (searchParams.get('survey') || searchParams.get('sid') || '').trim();
  const [view, setView] = useState('login');
  const [userId, setUserId] = useState('');
  const [userData, setUserData] = useState(null);
  const [sharedSurvey, setSharedSurvey] = useState(null);
  const [sharedPeriod, setSharedPeriod] = useState(null); // período del formulario que se está respondiendo
  const [closedPeriod, setClosedPeriod] = useState(null);
  const [publicRespondent, setPublicRespondent] = useState({
    email: '',
    program_level: 'Pregrado',
    program: ''
  });
  const [centerSearchQuery, setCenterSearchQuery] = useState('');
  const [selectedPublicRole, setSelectedPublicRole] = useState('');
  const [publicStep, setPublicStep] = useState(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [surveys, setSurveys] = useState([]);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [centers, setCenters] = useState([]);
  const [selectedCenterId, setSelectedCenterId] = useState('');
  const [siteRotations, setSiteRotations] = useState([]);
  const [rotation, setRotation] = useState({ id: null, name: '', number: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [programOptions, setProgramOptions] = useState([]);
  const [allProgramOptions, setAllProgramOptions] = useState([]);

  const stepRef = useRef(null);
  const prevStep = useRef(1);
  // El paso saliente se va y el nuevo entra desde el lado de la dirección del avance.
  useLayoutEffect(() => {
    if (view !== 'public-entry' || !stepRef.current) return;
    const dir = publicStep >= prevStep.current ? 1 : -1;
    prevStep.current = publicStep;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(stepRef.current, { x: 24 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.22, ease: 'power3.out', clearProps: 'transform' });
    });
    return () => mm.revert();
  }, [publicStep, view]);

  const selectedCampusId = sharedSurveyId ? sharedSurvey?.campus_id || null : userData?.campus_id || null;

  // El nivel que la evaluación tiene configurado (Pregrado / Posgrado) manda sobre lo que elija quien responde.
  const lockedLevel = useMemo(() => {
    const nivel = parseDescription(sharedSurvey?.description).nivel.toLowerCase();
    if (nivel === 'pregrado') return 'Pregrado';
    if (nivel === 'posgrado') return 'Posgrado';
    return '';
  }, [sharedSurvey]);

  useEffect(() => {
    if (lockedLevel && publicRespondent.program_level !== lockedLevel) {
      setPublicRespondent((prev) => ({ ...prev, program_level: lockedLevel }));
    }
  }, [lockedLevel, publicRespondent.program_level]);

  const filteredProgramOptions = programOptions.length ? programOptions : allProgramOptions;
  const filteredCenters = useMemo(() => {
    const query = norm(centerSearchQuery).toLowerCase();
    if (!query) return centers;
    return centers.filter((center) => norm(center.name).toLowerCase().includes(query));
  }, [centers, centerSearchQuery]);

  function norm(value = '') {
    return String(value || '').trim();
  }

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
    if (sharedSurveyId && sharedPeriod?.code) return sharedPeriod.code;
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
        // El enlace sirve siempre a la copia del formulario que está en el período abierto.
        const resolved = await resolveSharedSurvey(sharedSurveyId);
        if (resolved.state === 'closed') {
          if (!cancelled) {
            setClosedPeriod(resolved.period || {});
            setView('closed');
          }
          return;
        }
        const survey = resolved.survey;
        if (!survey) {
          if (!cancelled) {
            setError('El enlace público no corresponde a una evaluación válida o fue desactivado.');
            setView('login');
          }
          return;
        }

        if (!cancelled) {
          setSharedSurvey(survey);
          setSharedPeriod(resolved.period || null);
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
      setAllProgramOptions([]);
      return;
    }

    let cancelled = false;

    async function loadPrograms() {
      try {
        const [campusList, allList] = await Promise.all([
          getProgramsByCampus(selectedCampusId, publicRespondent.program_level),
          getProgramsByCampus(null, publicRespondent.program_level)
        ]);
        if (!cancelled) {
          setProgramOptions(campusList || []);
          setAllProgramOptions(allList || []);
        }
      } catch (programError) {
        console.error('Error cargando programas del campus:', programError);
        if (!cancelled) {
          setProgramOptions([]);
          setAllProgramOptions([]);
        }
      }
    }

    loadPrograms();

    return () => {
      cancelled = true;
    };
  }, [selectedCampusId, publicRespondent.program_level]);

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

  // Rotaciones del sitio seleccionado: la pregunta de rotación se arma en base al sitio de práctica.
  useEffect(() => {
    setRotation({ id: null, name: '', number: '', type: '' });

    if (!selectedCenterId) {
      setSiteRotations([]);
      return;
    }

    let cancelled = false;

    async function loadSiteRotations() {
      try {
        const data = await getRotationsByConvenio(selectedCenterId);
        if (!cancelled) setSiteRotations(data || []);
      } catch (error) {
        console.error('Error cargando rotaciones del sitio:', error);
        if (!cancelled) setSiteRotations([]);
      }
    }

    loadSiteRotations();

    return () => {
      cancelled = true;
    };
  }, [selectedCenterId]);

  const availableRotations = useMemo(() => {
    const program = sharedSurveyId ? publicRespondent.program : userData?.program;
    const normalized = String(program || '').trim().toLowerCase();
    if (!normalized) return siteRotations;
    const matching = siteRotations.filter((item) => !item.program || String(item.program).trim().toLowerCase() === normalized);
    return matching.length ? matching : siteRotations.filter((item) => !item.program);
  }, [siteRotations, sharedSurveyId, publicRespondent.program, userData]);

  const rotationSummary = (rotationState = rotation) => {
    const name = String(rotationState?.name || '').trim();
    if (!name) return '';
    const parts = [name];
    if (rotationState.number) parts.push(`No. ${rotationState.number}`);
    if (rotationState.type) parts.push(rotationState.type);
    return parts.join(' · ');
  };

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
            periodo: sharedSurveyId ? getCurrentAcademicPeriod() : userData.started || userData.status || 'N/A',
            rotacion: rotationSummary(rotation)
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
                      email: publicRespondent.email,
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
                _rotation: rotation.name
                  ? {
                      id: rotation.id && rotation.id !== '__other__' ? rotation.id : null,
                      name: rotation.name,
                      number: rotation.number ? Number(rotation.number) : null,
                      type: rotation.type || null
                    }
                  : null,
                _source: sharedSurveyId ? 'public_link' : 'authenticated_portal',
                _survey_link_id: sharedSurveyId || null
              };

              const createdEvaluation = await createEvaluationWithResponses(
                {
                  survey_id: selectedSurvey.id,
                  period_id: selectedSurvey.period_id || null,
                  campus_id: selectedSurvey.campus_id || userData?.campus_id || null,
                  center_id: selectedCenterId || userData?.practice_center_id || null,
                  rotation_id: rotation.id && rotation.id !== '__other__' ? rotation.id : null,
                  rotation_name: rotation.name || null,
                  rotation_number: rotation.number ? Number(rotation.number) : null,
                  rotation_type: rotation.type || null,
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

              const recipientEmail = sharedSurveyId ? publicRespondent.email : userData?.email;
              if (recipientEmail) {
                try {
                  await sendPublicSurveyConfirmationEmail({
                    to: recipientEmail,
                    templateKey: 'student_completed',
                    respondent: {
                      name: sharedSurveyId ? publicRespondent.email : userData?.full_name || 'Participante',
                      public_role: roleLabel(sharedSurveyId ? selectedPublicRole : userData?.role || ''),
                      program_level: sharedSurveyId ? publicRespondent.program_level : userData?.program_level || '',
                      program: sharedSurveyId ? publicRespondent.program : userData?.program || '',
                      practice_center_name: centers.find((center) => center.id === selectedCenterId)?.name || null,
                      period: getCurrentAcademicPeriod(),
                      id_type: 'Correo electrónico',
                      id_value: sharedSurveyId ? publicRespondent.email : userId,
                      survey_title: selectedSurvey.title || 'Encuesta de prácticas formativas',
                      evaluation_link: `${window.location.origin}/evaluacion-publica?survey=${selectedSurvey.id}`
                    },
                    evaluationId: createdEvaluation?.id || null,
                    surveyId: selectedSurvey?.id || null,
                    source: sharedSurveyId ? 'public_link' : 'authenticated_portal'
                  });
                } catch (emailError) {
                  console.warn('No se pudo enviar correo de confirmación:', emailError);
                }
              }

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
      <PortalShell>
        <div className="flex-1 flex flex-col justify-center gap-4 py-16">
          <h1 className="font-display text-3xl font-bold">No hay formulario disponible</h1>
          <p className="text-ink-2">No se encontró ningún formulario activo para el usuario. Regresa e intenta nuevamente.</p>
          <button type="button" onClick={() => setView('ready')} className="k-btn self-start !h-12">Volver</button>
        </div>
      </PortalShell>
    );
  }

  if (view === 'closed') {
    return (
      <PortalShell>
        <div className="flex-1 flex flex-col justify-center gap-4 py-16">
          <span className="k-pill bg-paper text-ink self-start">{closedPeriod?.code ? `Período ${closedPeriod.code}` : 'Período cerrado'}</span>
          <h1 className="font-display text-4xl font-bold leading-tight">Esta evaluación está cerrada</h1>
          <p className="text-base leading-relaxed text-ink-2">Ya no se reciben respuestas. Cuando se abra un nuevo período, este mismo enlace volverá a funcionar. Si crees que es un error, consulta con quien te lo compartió.</p>
        </div>
      </PortalShell>
    );
  }

  if (view === 'public-success') {
    const centerName = centers.find((center) => center.id === selectedCenterId)?.name;
    return (
      <PortalShell>
        <div className="flex-1 flex flex-col gap-7 pt-10 lg:pt-16">
          <div className="space-y-5">
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#E7F1EF" stroke="#0F6B68" strokeWidth="2" /><path d="M20 33l8 8 16-17" fill="none" stroke="#0F6B68" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <h1 className="font-display text-4xl font-bold leading-tight">Evaluación enviada</h1>
            <p className="text-base leading-relaxed text-ink-2">Gracias por tu tiempo. Tus respuestas ayudan a mejorar las prácticas de quienes vienen después.</p>
          </div>
          <dl className="border-t border-line">
            {[
              ['Sitio', centerName],
              ['Rotación', rotationSummary(rotation)],
              ['Rol', selectedPublicRole ? roleLabel(selectedPublicRole) : ''],
              ['Periodo', getCurrentAcademicPeriod()],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3.5 border-b border-line">
                <dt className="k-label self-center">{k}</dt>
                <dd className="text-[15px] font-semibold text-right">{v}</dd>
              </div>
            ))}
          </dl>
          {publicRespondent.email ? (
            <p className="text-sm text-ink-2">Enviamos una confirmación a <span className="font-semibold text-ink">{publicRespondent.email}</span>.</p>
          ) : null}
        </div>
        <div className="sticky bottom-0 -mx-5 px-5 pt-4 pb-7 bg-paper">
          <button
            type="button"
            onClick={() => {
              setView('public-entry');
              setSelectedSurvey(sharedSurvey || selectedSurvey);
              setSelectedPublicRole('');
              setRotation({ id: null, name: '', number: '', type: '' });
              setPublicRespondent({
                email: '',
                program_level: 'Pregrado',
                program: ''
              });
              setCenterSearchQuery('');
              setPublicStep(1);
            }}
            className="k-btn-secondary w-full !h-14 !rounded-xl !text-base"
          >
            Evaluar otro sitio
          </button>
        </div>
      </PortalShell>
    );
  }

  if (view === 'public-entry') {
    const selectedCenter = centers.find((center) => center.id === selectedCenterId);
    const showCenterList = !selectedCenter || centerSearchQuery !== selectedCenter.name;
    const goNext = () => {
      if (publicStep === 1) {
        if (!selectedPublicRole) {
          setError('Selecciona un rol para continuar.');
          return;
        }
        setError('');
        setPublicStep(2);
        return;
      }

      const hasValidEmail = /.+@.+\..+/.test(String(publicRespondent.email || '').trim());

      if (!publicRespondent.email || !publicRespondent.program || !hasValidEmail) {
        setError('Debes completar correo, nivel de formación y programa para continuar.');
        return;
      }
      if (!selectedCenterId) {
        setError('Selecciona el sitio de práctica a evaluar.');
        return;
      }

      if (!String(rotation.name || '').trim()) {
        setError('Selecciona o indica la rotación que vas a evaluar.');
        return;
      }

      setError('');
      setView('form');
    };

    return (
      <PortalShell step={publicStep} total={3}>
        <div ref={stepRef} className="flex-1 pt-7 space-y-6">
          {publicStep === 1 ? (
            <>
              <div className="space-y-2.5">
                {sharedSurvey ? <p className="k-label">{sharedSurvey.title || 'Evaluación pública'}</p> : null}
                <h1 className="font-display text-[32px] leading-[1.05] font-bold text-balance">¿Con qué rol vas a evaluar?</h1>
                <p className="text-base leading-relaxed text-ink-2">Elige el rol que mejor te describe.</p>
              </div>
              <div className="space-y-3" role="radiogroup" aria-label="Rol">
                {roleOptions.map((roleOption) => {
                  const on = selectedPublicRole === roleOption.id;
                  return (
                    <button
                      key={roleOption.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => { setSelectedPublicRole(roleOption.id); setError(''); }}
                      className={`w-full min-h-[72px] flex items-center gap-3.5 rounded-xl text-left bg-white px-4 py-3.5 transition-transform duration-150 ease-out active:scale-[0.98] ${on ? 'border-2 border-blue-600 bg-blue-50 px-[15px] py-[13px]' : 'border border-line-strong'}`}
                    >
                      <span className={`shrink-0 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center ${on ? 'border-blue-600' : 'border-line-strong'}`}>
                        {on ? <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> : null}
                      </span>
                      <span>
                        <span className="block text-[17px] font-semibold">{roleOption.label}</span>
                        {ROLE_HINTS[roleOption.id] ? <span className="block text-sm text-ink-2">{ROLE_HINTS[roleOption.id]}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h1 className="font-display text-[30px] leading-[1.05] font-bold">Cuéntanos de dónde evalúas</h1>

              <div className="space-y-2">
                <label htmlFor="pub-email" className="text-sm font-semibold">Correo electrónico</label>
                <input
                  id="pub-email"
                  type="email"
                  autoComplete="email"
                  value={publicRespondent.email}
                  onChange={(e) => setPublicRespondent((prev) => ({ ...prev, email: e.target.value }))}
                  className="k-input !h-[52px] !rounded-[10px]"
                  placeholder="correo@dominio.com"
                />
              </div>

              <div className="space-y-2">
                <span id="pub-level" className="text-sm font-semibold">Nivel de formación</span>
                {lockedLevel ? (
                  <p className="h-12 flex items-center px-4 rounded-[10px] border border-line-strong bg-paper text-[15px] font-medium">
                    {lockedLevel}
                  </p>
                ) : (
                <div className="flex" role="group" aria-labelledby="pub-level">
                  {['Pregrado', 'Posgrado'].map((level, idx) => {
                    const on = publicRespondent.program_level === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setPublicRespondent((prev) => ({ ...prev, program_level: level }))}
                        className={`flex-1 h-12 border text-[15px] font-medium transition-colors ${idx === 0 ? 'rounded-l-[10px]' : 'rounded-r-[10px] border-l-0'} ${on ? 'bg-ink border-ink text-white' : 'bg-white border-line-strong text-ink'}`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="pub-program" className="text-sm font-semibold">Programa académico</label>
                <select
                  id="pub-program"
                  value={publicRespondent.program}
                  onChange={(e) => setPublicRespondent((prev) => ({ ...prev, program: e.target.value }))}
                  className="k-input !h-[52px] !rounded-[10px]"
                >
                  <option value="">Selecciona un programa</option>
                  {filteredProgramOptions.map((program) => (
                    <option key={program.id} value={program.name}>
                      {program.name}
                      {!programOptions.length && program.campus?.name ? ` (${program.campus.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="pub-center" className="text-sm font-semibold">Sitio de práctica a evaluar</label>
                <input
                  id="pub-center"
                  type="text"
                  autoComplete="off"
                  value={centerSearchQuery}
                  onChange={(e) => { setCenterSearchQuery(e.target.value); setSelectedCenterId(''); }}
                  placeholder="Escribe para buscar"
                  className="k-input !h-[52px] !rounded-[10px]"
                />
                {showCenterList ? (
                  <ul className="bg-white border border-line-strong rounded-[10px] overflow-hidden max-h-60 overflow-y-auto">
                    {filteredCenters.length ? filteredCenters.slice(0, 30).map((center, idx) => (
                      <li key={center.id} className={idx ? 'border-t border-line' : ''}>
                        <button
                          type="button"
                          onClick={() => { setSelectedCenterId(center.id); setCenterSearchQuery(center.name); setError(''); }}
                          className="w-full min-h-[48px] px-3.5 py-2.5 text-left text-[15px] font-semibold hover:bg-blue-50 transition-colors"
                        >
                          {center.name}
                        </button>
                      </li>
                    )) : (
                      <li className="px-3.5 py-3 text-sm text-ink-2">No se encontraron sitios con ese nombre.</li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm font-medium text-score-high-fg">Sitio seleccionado</p>
                )}
                <p className="k-label">{filteredCenters.length} de {centers.length} sitios · Periodo {getCurrentAcademicPeriod()}</p>
              </div>

              <RotationPicker
                rotations={availableRotations}
                rotation={rotation}
                onChange={setRotation}
                hint={availableRotations.length ? `${availableRotations.length} rotación(es) configuradas para este sitio` : null}
              />
            </>
          )}

          {error ? (
            <div role="alert" className="rounded-lg border border-score-low/30 bg-score-low-bg p-3.5 text-sm font-medium text-score-low-fg">{error}</div>
          ) : null}
        </div>

        <div className="sticky bottom-0 -mx-5 px-5 pt-4 pb-7 bg-paper border-t border-line mt-6 flex gap-3">
          {publicStep > 1 ? (
            <button
              type="button"
              aria-label="Volver"
              onClick={() => { setPublicStep(1); setCenterSearchQuery(''); setError(''); }}
              className="shrink-0 w-14 h-14 rounded-xl border border-line-strong bg-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <ArrowLeft size={20} />
            </button>
          ) : null}
          <button type="button" onClick={goNext} className="k-btn flex-1 !h-14 !rounded-xl !text-base">
            {publicStep === 1 ? 'Continuar' : 'Empezar la evaluación'}
          </button>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <div className="flex-1 pt-10 lg:pt-16">
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-7">
            <div className="space-y-2.5">
              <p className="k-label">Acceso institucional</p>
              <h1 className="font-display text-4xl font-bold leading-tight">Bienvenido al portal de evaluación</h1>
              <p className="text-base leading-relaxed text-ink-2">Ingresa tu código para abrir el formulario que te corresponde.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="portal-code" className="text-sm font-semibold">Código de usuario</label>
              <div className="relative">
                <Fingerprint className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2" size={20} aria-hidden="true" />
                <input
                  id="portal-code"
                  type="text"
                  inputMode="numeric"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="k-input !h-14 !pl-11 !text-lg"
                  placeholder="Ej: 12345"
                  required
                />
              </div>
              {error ? (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-score-low/30 bg-score-low-bg p-3.5 text-sm font-medium text-score-low-fg">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </div>
              ) : null}
            </div>

            <button type="submit" disabled={isLoading} className="k-btn w-full !h-14 !rounded-xl !text-base">
              {isLoading ? 'Verificando…' : 'Entrar'}
              {!isLoading && <ArrowRight size={20} />}
            </button>
          </form>
        )}

        {view === 'verification' && userData && (
          <div className="space-y-7">
            <div className="space-y-2.5">
              <p className="k-label">Verificación de perfil</p>
              <h1 className="font-display text-4xl font-bold leading-tight">¿Eres tú?</h1>
            </div>

            <dl className="border-t border-line">
              {[
                { icon: User, label: 'Nombre', val: userData.full_name },
                { icon: GraduationCap, label: 'Programa', val: userData.program },
                { icon: Building2, label: 'Escenario de práctica', val: centers.find((center) => center.id === selectedCenterId)?.name || userData.practice_center_name || userData.campus_name },
                { icon: Calendar, label: 'Periodo', val: userData.started || userData.status || 'N/A' }
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3.5 py-3.5 border-b border-line">
                  <item.icon className="w-5 h-5 mt-0.5 text-ink-2 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="k-label">{item.label}</dt>
                    <dd className="text-base font-semibold leading-snug">{item.val}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <div className="space-y-2">
              <label htmlFor="verify-center" className="text-sm font-semibold">Centro de práctica a evaluar</label>
              <select
                id="verify-center"
                value={selectedCenterId}
                onChange={(e) => setSelectedCenterId(e.target.value)}
                className="k-input !h-[52px] !rounded-[10px]"
              >
                {centers.length ? (
                  centers.map((center) => (
                    <option key={center.id} value={center.id}>{center.name}</option>
                  ))
                ) : (
                  <option value="">No hay centros disponibles</option>
                )}
              </select>
            </div>

            <RotationPicker
              idPrefix="verify"
              rotations={availableRotations}
              rotation={rotation}
              onChange={setRotation}
              hint={availableRotations.length ? `${availableRotations.length} rotación(es) configuradas para este sitio` : null}
            />

            {error ? (
              <div role="alert" className="rounded-lg border border-score-low/30 bg-score-low-bg p-3.5 text-sm font-medium text-score-low-fg">{error}</div>
            ) : null}

            <p className="text-sm text-ink-2">
              {surveys.length > 0
                ? 'Encontramos una evaluación activa para tu perfil. Continúa para revisarla.'
                : 'No se detectó un formulario activo todavía. Si deberías tener uno, consulta con el administrador.'}
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button type="button" onClick={() => { setView('login'); setUserData(null); setUserId(''); }} className="k-btn-secondary sm:flex-1 !h-14 !rounded-xl !text-base">
                No soy yo
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!String(rotation.name || '').trim()) {
                    setError('Selecciona o indica la rotación que vas a evaluar.');
                    return;
                  }
                  setError('');
                  setView('ready');
                }}
                className="k-btn sm:flex-[2] !h-14 !rounded-xl !text-base"
              >
                Sí, soy yo
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}

        {view === 'ready' && (
          <div className="space-y-7">
            <div className="space-y-2.5">
              <p className="k-label">Formulario listo</p>
              <h1 className="font-display text-4xl font-bold leading-tight">Elige la evaluación</h1>
              <p className="text-base leading-relaxed text-ink-2">Selecciona la que quieres completar.</p>
            </div>

            {surveys.length > 0 ? (
              <>
                <div className="space-y-3" role="radiogroup" aria-label="Evaluaciones disponibles">
                  {surveys.map((survey) => {
                    const on = selectedSurvey?.id === survey.id;
                    return (
                      <button
                        key={survey.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setSelectedSurvey(survey)}
                        className={`w-full text-left rounded-xl bg-white p-4 transition-transform duration-150 ease-out active:scale-[0.98] ${on ? 'border-2 border-blue-600 bg-blue-50 p-[15px]' : 'border border-line-strong'}`}
                      >
                        <span className="block k-label mb-1.5">{survey.title || 'Evaluación disponible'}</span>
                        <span className="block text-base font-semibold leading-snug">{formatSurveyDescription(survey.description, centers.find((center) => center.id === selectedCenterId)?.name || userData?.practice_center_name || userData?.campus_name)}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <button type="button" onClick={() => setView('verification')} className="k-btn-secondary sm:flex-1 !h-14 !rounded-xl !text-base">
                    Volver
                  </button>
                  <button type="button" onClick={() => setView('form')} disabled={!selectedSurvey} className="k-btn sm:flex-[2] !h-14 !rounded-xl !text-base">
                    Acceder al formulario
                  </button>
                </div>
              </>
            ) : (
              <div className="k-card p-8 space-y-5">
                <p className="text-ink-2">No hay evaluaciones activas para tu perfil en este momento.</p>
                <button type="button" onClick={() => setView('login')} className="k-btn !h-12">Volver al inicio</button>
              </div>
            )}
          </div>
        )}
      </div>
    </PortalShell>
  );
}

const ROLE_HINTS = {
  student: 'Estás o estuviste en práctica en el sitio',
  professor: 'Acompañas estudiantes en el sitio',
  coordinator: 'Gestionas el convenio o la práctica',
};

// Pregunta de rotación en base al sitio de práctica seleccionado.
// Si el sitio tiene rotaciones configuradas se eligen del catálogo (y el No. y
// el Tipo se completan solos); si no, se escriben a mano.
function RotationPicker({ idPrefix = 'pub', rotations, rotation, onChange, hint }) {
  const isOther = rotation.id === '__other__';
  const selectedFromCatalog = rotations.some((item) => item.id === rotation.id);

  const handleSelect = (value) => {
    if (!value) {
      onChange({ id: null, name: '', number: '', type: '' });
      return;
    }
    if (value === '__other__') {
      onChange({ id: '__other__', name: '', number: '', type: '' });
      return;
    }
    const item = rotations.find((entry) => entry.id === value);
    if (item) {
      onChange({ id: item.id, name: item.name, number: item.number || '', type: item.type || '' });
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor={`${idPrefix}-rotation`} className="text-sm font-semibold">Rotación</label>
      {rotations.length ? (
        <select
          id={`${idPrefix}-rotation`}
          value={rotation.id || ''}
          onChange={(e) => handleSelect(e.target.value)}
          className="k-input !h-[52px] !rounded-[10px]"
        >
          <option value="">Selecciona la rotación</option>
          {rotations.map((item) => (
            <option key={item.id} value={item.id}>
              {`${item.number ? `No. ${item.number} · ` : ''}${item.name}${item.type ? ` · ${item.type}` : ''}`}
            </option>
          ))}
          <option value="__other__">Otra / no aparece en la lista</option>
        </select>
      ) : (
        <p className="text-sm text-ink-2">
          Este sitio no tiene rotaciones configuradas. Indica la rotación que realizaste en la práctica.
        </p>
      )}
      {hint ? <p className="k-label">{hint}</p> : null}
      {selectedFromCatalog ? (
        <p className="text-sm font-medium text-score-high-fg">
          Rotación seleccionada{rotation.number ? ` · No. ${rotation.number}` : ''}{rotation.type ? ` · Tipo: ${rotation.type}` : ''}
        </p>
      ) : null}
      {(isOther || !rotations.length) && (
        <div className="space-y-2">
          <input
            type="text"
            value={rotation.name}
            onChange={(e) => onChange({ ...rotation, id: '__other__', name: e.target.value })}
            placeholder="Nombre de la rotación (ej: Cirugía)"
            className="k-input !h-[52px] !rounded-[10px]"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={rotation.number}
              onChange={(e) => onChange({ ...rotation, number: e.target.value })}
              placeholder="No. de rotación"
              className="k-input !h-[52px] !rounded-[10px] w-36"
            />
            <input
              type="text"
              value={rotation.type}
              onChange={(e) => onChange({ ...rotation, type: e.target.value })}
              placeholder="Tipo de rotación (ej: Asistencial)"
              className="k-input !h-[52px] !rounded-[10px] flex-1"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Marco común del portal: marca arriba, progreso opcional y una sola columna pensada para celular.
function PortalShell({ step, total, children }) {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <header className="w-full max-w-lg mx-auto px-5 pt-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KometMark size={22} />
            <span className="font-display text-lg font-bold">Komet</span>
          </div>
          {step ? <span className="font-mono text-xs text-ink-2">PASO {step} DE {total}</span> : null}
        </div>
        {step ? (
          <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full origin-left transition-colors duration-200 ${i < step ? 'bg-blue-600' : 'bg-line'}`} />
            ))}
          </div>
        ) : null}
      </header>
      <main className="flex-1 w-full max-w-lg mx-auto px-5 flex flex-col">{children}</main>
      <footer className="w-full max-w-lg mx-auto px-5 py-4 font-mono text-[11px] text-ink-2">Universidad de Santander · Evaluación de sitios de práctica</footer>
    </div>
  );
}
