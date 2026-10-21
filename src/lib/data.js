import { supabase } from './supabaseClient';

const SYSTEM_SETTINGS_KEY = 'komet_system';

export const MISTRAL_MODELS = [
  'mistral-small-latest',
  'mistral-medium-latest',
  'mistral-large-latest',
  'ministral-8b-latest',
  'ministral-3b-latest',
  'open-mistral-nemo'
];

export const DEFAULT_SYSTEM_SETTINGS = {
  resend_api_key: '',
  resend_sender_email: '',
  email_templates: {
    student_completed_subject: 'Confirmación de recepción | {{survey_title}}',
    student_completed_body:
      '<p>Hola {{name}},</p>' +
      '<p>Hemos recibido satisfactoriamente tu encuesta de <strong>{{survey_title}}</strong>.</p>' +
      '<p><strong>Resumen de tu registro:</strong></p>' +
      '<ul>' +
      '<li>Rol de evaluación: {{public_role}}</li>' +
      '<li>Nivel de formación: {{program_level}}</li>' +
      '<li>Programa: {{program}}</li>' +
      '<li>Escenario de práctica: {{practice_center_name}}</li>' +
      '<li>Periodo académico: {{period}}</li>' +
      '<li>Identificación registrada: {{id_type}} {{id_value}}</li>' +
      '</ul>' +
      '<p>Gracias por tu participación en el proceso de mejora continua Docencia-Servicio.</p>' +
      '<p>Equipo KOMET</p>',
    student_access_subject: 'Accede a tu encuesta | {{survey_title}}',
    student_access_body:
      '<p>Hola {{name}},</p>' +
      '<p>Ya puedes diligenciar la encuesta <strong>{{survey_title}}</strong>.</p>' +
      '<p><strong>Periodo:</strong> {{period}}<br/><strong>Escenario:</strong> {{practice_center_name}}</p>' +
      '<p>Ingresa aquí: <a href="{{evaluation_link}}">{{evaluation_link}}</a></p>' +
      '<p>Equipo KOMET</p>',
    professor_access_subject: 'Nueva encuesta disponible | {{survey_title}}',
    professor_access_body:
      '<p>Hola {{name}},</p>' +
      '<p>Tienes una encuesta disponible para el escenario <strong>{{practice_center_name}}</strong>.</p>' +
      '<p><strong>Rol:</strong> {{public_role}}<br/><strong>Periodo:</strong> {{period}}</p>' +
      '<p>Completar encuesta: <a href="{{evaluation_link}}">{{evaluation_link}}</a></p>' +
      '<p>Equipo KOMET</p>',
    coordinator_access_subject: 'Acceso a encuesta de práctica | {{survey_title}}',
    coordinator_access_body:
      '<p>Hola {{name}},</p>' +
      '<p>Se habilitó el acceso a la encuesta <strong>{{survey_title}}</strong>.</p>' +
      '<p><strong>Escenario:</strong> {{practice_center_name}}<br/><strong>Periodo:</strong> {{period}}</p>' +
      '<p>Ingresar: <a href="{{evaluation_link}}">{{evaluation_link}}</a></p>' +
      '<p>Equipo KOMET</p>'
  },
  mistral_api_key: '',
  mistral_model: MISTRAL_MODELS[0],
  mistral_temperature: 0.7,
  mistral_system_prompt: 'Eres un asistente administrativo para el sistema Komet, ayudas a generar mensajes de email y notificaciones operativas.'
};

function mergeSystemSettings(config = {}) {
  const currentConfig = { ...(config || {}) };
  // OpenRouter fue retirado del sistema: se eliminan sus claves antiguas para
  // que no vuelvan a guardarse en la configuración.
  delete currentConfig.openrouter_api_key;
  delete currentConfig.openrouter_model;
  delete currentConfig.openrouter_temperature;
  delete currentConfig.openrouter_system_prompt;
  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...currentConfig,
    mistral_api_key: config?.mistral_api_key || '',
    mistral_model: config?.mistral_model || MISTRAL_MODELS[0],
    mistral_temperature: config?.mistral_temperature ?? DEFAULT_SYSTEM_SETTINGS.mistral_temperature,
    mistral_system_prompt: config?.mistral_system_prompt || DEFAULT_SYSTEM_SETTINGS.mistral_system_prompt,
    email_templates: {
      ...DEFAULT_SYSTEM_SETTINGS.email_templates,
      ...(config?.email_templates || {})
    }
  };
}

export async function getSystemSettings(configKey = SYSTEM_SETTINGS_KEY) {
  const { data, error } = await supabase
    .from('system_settings')
    .select('config_value')
    .eq('config_key', configKey)
    .maybeSingle();

  if (error) throw error;
  return mergeSystemSettings(data?.config_value || {});
}

export async function saveSystemSettings(settings, configKey = SYSTEM_SETTINGS_KEY) {
  const normalizedSettings = mergeSystemSettings(settings);
  const { data, error } = await supabase
    .from('system_settings')
    .upsert({ config_key: configKey, config_value: normalizedSettings }, { onConflict: 'config_key' })
    .select('config_value')
    .maybeSingle();

  if (error) throw error;
  return mergeSystemSettings(data?.config_value || normalizedSettings);
}

export async function runMistralPrompt({
  apiKey,
  model,
  systemPrompt,
  prompt,
  temperature = 0.7
}) {
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
  const devKey = isDev && typeof import.meta !== 'undefined' ? import.meta.env?.VITE_MISTRAL_API_KEY : '';
  const trimmedKey = String(apiKey || devKey || '').trim();
  if (!trimmedKey) {
    const error = new Error('Configura la API key de Mistral en Sistema > Configuración.');
    error.code = 'mistral_missing_api_key';
    throw error;
  }
  const requestTemperature = Number.isFinite(Number(temperature)) ? Number(temperature) : 0.7;
  const messages = [
    { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_SETTINGS.mistral_system_prompt },
    { role: 'user', content: prompt || 'Responde: conexión Mistral verificada para Komet.' }
  ];
  const request = {
    model: model || MISTRAL_MODELS[0],
    temperature: requestTemperature,
    messages
  };
  let response;
  if (isDev) {
    response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trimmedKey}` },
      body: JSON.stringify(request)
    });
  } else {
    response = await fetch('/api/mistral-chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: trimmedKey, ...request })
    });
  }
  if (!response.ok) {
    let detail = '';
    try { const payload = await response.json(); detail = payload?.error?.message || JSON.stringify(payload); }
    catch { detail = await response.text(); }
    const error = new Error(`Mistral respondió con ${response.status}: ${detail}`);
    error.code = 'mistral_request_failed';
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('Mistral devolvió una respuesta vacía.');
  return content;
}

export async function getDbStatus() {
  const { data, error } = await supabase
    .from('system_settings')
    .select('id')
    .limit(1);
  if (error) throw error;
  return data;
}

export async function getEmailTemplates() {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('template_key');
  if (error) throw error;
  return data || [];
}

export async function saveEmailTemplate(template) {
  const { data, error } = await supabase
    .from('email_templates')
    .upsert(template, { onConflict: 'template_key' })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getApiIntegrations() {
  const { data, error } = await supabase
    .from('api_integrations')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function saveApiIntegration(integration) {
  const { data, error } = await supabase
    .from('api_integrations')
    .upsert(integration, { onConflict: 'name' })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('*, campus:campus_id(name), convenio:convenio_id(name)')
    .order('full_name');
  if (error) throw error;
  return data || [];
}

export async function createStudent(student) {
  const { data, error } = await supabase
    .from('students')
    .insert([student])
    .select('*, campus:campus_id(name), convenio:convenio_id(name)');
  if (error) throw error;
  return data;
}

export async function updateStudent(id, student) {
  const { data, error } = await supabase
    .from('students')
    .update(student)
    .eq('id', id)
    .select('*, campus:campus_id(name), convenio:convenio_id(name)');
  if (error) throw error;
  return data;
}

export async function deleteStudent(id) {
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function importStudents(students) {
  const { data, error } = await supabase
    .from('students')
    .insert(students)
    .select('*, campus:campus_id(name), convenio:convenio_id(name)');
  if (error) throw error;
  return data;
}

export async function getProfessors() {
  const { data, error } = await supabase
    .from('tutors')
    .select('*, campus:campus_id(name), convenio:convenio_id(name)')
    .order('full_name');
  if (error) throw error;
  return data || [];
}

export async function createProfessor(professor) {
  const { data, error } = await supabase
    .from('tutors')
    .insert([professor])
    .select('*, campus:campus_id(name), convenio:convenio_id(name)');
  if (error) throw error;
  return data;
}

export async function updateProfessor(id, professor) {
  const { data, error } = await supabase
    .from('tutors')
    .update(professor)
    .eq('id', id)
    .select('*, campus:campus_id(name), convenio:convenio_id(name)');
  if (error) throw error;
  return data;
}

export async function deleteProfessor(id) {
  const { error } = await supabase.from('tutors').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function importProfessors(professors) {
  const { data, error } = await supabase
    .from('tutors')
    .insert(professors)
    .select('*, campus:campus_id(name), convenio:convenio_id(name)');
  if (error) throw error;
  return data;
}

export async function getSystemUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name');
  if (error) throw error;
  return data || [];
}

export async function createSystemUser(user) {
  const { data, error } = await supabase
    .from('profiles')
    .insert([user])
    .select('*');
  if (error) throw error;
  return data;
}

export async function updateSystemUser(id, user) {
  const { data, error } = await supabase
    .from('profiles')
    .update(user)
    .eq('id', id)
    .select('*');
  if (error) throw error;
  return data;
}

export async function deleteSystemUser(id) {
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function getCampuses() {
  const { data, error } = await supabase.from('campuses').select('id,name').order('name');
  if (error) throw error;
  return data || [];
}

export async function getProgramsByCampus(campusId = null, level = null) {
  let query = supabase
    .from('programs')
    .select('id,name,level,campus_id,campus:campus_id(name),is_active')
    .eq('is_active', true)
    .order('name');

  if (campusId) {
    query = query.eq('campus_id', campusId);
  }

  if (level) {
    query = query.filter('level', 'ilike', String(level).trim());
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getConvenios() {
  const { data, error } = await supabase.from('convenios').select('*, campus:campus_id(name)').order('name');
  if (error) throw error;
  return data || [];
}

export async function getConveniosByCampus(campusId) {
  if (!campusId) return getConvenios();
  const { data, error } = await supabase
    .from('convenios')
    .select('*, campus:campus_id(name)')
    .eq('campus_id', campusId)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createConvenio(convenio) {
  const payload = {
    ...convenio,
    photo_url: convenio.photo || convenio.photo_url || null,
    campus_id: convenio.campus_id || null
  };
  delete payload.photo;

  const { data, error } = await supabase.from('convenios').insert([payload]).select('*');
  if (error) throw error;
  return data;
}

export async function importConvenios(convenios = []) {
  if (!Array.isArray(convenios) || !convenios.length) return [];

  const payload = convenios.map((convenio) => ({
    ...convenio,
    photo_url: convenio.photo || convenio.photo_url || null,
    campus_id: convenio.campus_id || null
  }));

  payload.forEach((item) => {
    delete item.photo;
  });

  const { data, error } = await supabase
    .from('convenios')
    .insert(payload)
    .select('*, campus:campus_id(name)');

  if (error) throw error;
  return data || [];
}

export async function updateConvenio(id, convenio) {
  const payload = {
    ...convenio,
    photo_url: convenio.photo || convenio.photo_url || null,
    campus_id: convenio.campus_id || null
  };
  delete payload.photo;

  const { data, error } = await supabase.from('convenios').update(payload).eq('id', id).select('*');
  if (error) throw error;
  return data;
}

export async function deleteConvenio(id) {
  const { error } = await supabase.from('convenios').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function getRotationsByConvenio(convenioId, { onlyActive = true } = {}) {
  if (!convenioId) return [];
  let query = supabase
    .from('rotations')
    .select('*')
    .eq('convenio_id', convenioId);
  if (onlyActive) {
    query = query.eq('is_active', true);
  }
  const { data, error } = await query
    .order('number', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createRotation(rotation) {
  const payload = {
    convenio_id: rotation.convenio_id,
    name: rotation.name,
    number: rotation.number ? Number(rotation.number) : null,
    type: rotation.type || null,
    program: rotation.program || null,
    is_active: rotation.is_active !== false
  };
  const { data, error } = await supabase.from('rotations').insert([payload]).select('*');
  if (error) throw error;
  return data;
}

export async function updateRotation(id, rotation) {
  const { data, error } = await supabase
    .from('rotations')
    .update(rotation)
    .eq('id', id)
    .select('*');
  if (error) throw error;
  return data;
}

export async function deleteRotation(id) {
  const { error } = await supabase.from('rotations').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function getSurveys() {
  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── Períodos de evaluación ───────────────────────────────────────────────────
// Requieren la migración db/evaluation_periods.sql. Si aún no se aplicó, `available` es false y el resto
// de la app sigue funcionando como antes (sin períodos).

const isMissingPeriodsTable = (error) =>
  error && (error.code === '42P01' || error.code === 'PGRST205' || /evaluation_period/i.test(error.message || ''));

export async function getPeriods() {
  const { data, error } = await supabase
    .from('evaluation_periods')
    .select('*')
    .order('starts_on', { ascending: false });
  if (error) {
    if (isMissingPeriodsTable(error)) return { available: false, periods: [], stats: {} };
    throw error;
  }

  const { data: statsRows } = await supabase.from('evaluation_period_stats').select('*');
  const stats = Object.fromEntries((statsRows || []).map((row) => [row.period_id, row]));
  return { available: true, periods: data || [], stats };
}

export async function openPeriod({ code, startsOn, endsOn, surveyIds, name, notes }) {
  const { data, error } = await supabase.rpc('open_evaluation_period', {
    p_code: code,
    p_starts_on: startsOn || null,
    p_ends_on: endsOn || null,
    p_survey_ids: surveyIds || [],
    p_name: name || null,
    p_notes: notes || null
  });
  if (error) throw error;
  return data;
}

export async function closePeriod(periodId) {
  const { data, error } = await supabase.rpc('close_evaluation_period', { p_id: periodId });
  if (error) throw error;
  return data;
}

/**
 * Resuelve el formulario de un enlace público al del período abierto.
 * El enlace de un formulario sigue sirviendo en los períodos siguientes porque las copias comparten `family_id`.
 * @returns {{ state: 'open' | 'closed' | 'missing', survey: object|null, period: object|null }}
 */
export async function resolveSharedSurvey(surveyId) {
  const survey = await getSurveyById(surveyId);
  if (!survey) return { state: 'missing', survey: null, period: null };
  if (!survey.period_id) return { state: 'open', survey, period: null }; // migración sin aplicar

  const { data: period, error } = await supabase.from('evaluation_periods').select('*').eq('id', survey.period_id).maybeSingle();
  if (error) throw error;
  if (period?.status === 'abierto') return { state: 'open', survey, period };

  const { data: sibling, error: siblingError } = await supabase
    .from('surveys')
    .select('*, period:period_id!inner(*)')
    .eq('family_id', survey.family_id || survey.id)
    .eq('period.status', 'abierto')
    .maybeSingle();
  if (siblingError) throw siblingError;
  if (sibling) {
    const { period: openPeriodRow, ...rest } = sibling;
    return { state: 'open', survey: rest, period: openPeriodRow };
  }
  return { state: 'closed', survey, period };
}

export async function getSurveyById(surveyId) {
  if (!surveyId) return null;
  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', surveyId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function getPortalUserByCode(userCode) {
  const { data, error } = await supabase.rpc('get_portal_user_by_code', { user_code: userCode });
  if (error) throw error;
  return data?.[0] || null;
}

export async function getPortalActiveSurveysByCode(userCode, practiceCenterId = null) {
  const { data, error } = await supabase.rpc('portal_active_surveys_by_code', {
    user_code: userCode,
    practice_center_id: practiceCenterId || null
  });
  if (error) throw error;
  return (data || []).map((survey) => ({
    ...survey,
    id: survey.survey_id
  }));
}

export async function createSurvey(survey) {
  const { data, error } = await supabase
    .from('surveys')
    .insert([survey])
    .select('*');
  if (error) throw error;
  return data;
}

export async function updateSurvey(id, survey) {
  const { data, error } = await supabase
    .from('surveys')
    .update(survey)
    .eq('id', id)
    .select('*');
  if (error) throw error;
  return data;
}

export async function deleteSurvey(id) {
  const { error } = await supabase.from('surveys').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function getEvaluations() {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createEvaluation(evaluation) {
  const { data, error } = await supabase
    .from('evaluations')
    .insert([evaluation])
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') {
      const duplicateError = new Error('already_evaluated_center');
      duplicateError.code = 'already_evaluated_center';
      duplicateError.cause = error;
      throw duplicateError;
    }
    throw error;
  }
  return data;
}

export async function createEvaluationWithResponses(evaluation, responses = []) {
  const createdEvaluation = await createEvaluation(evaluation);
  if (!createdEvaluation?.id || !Array.isArray(responses) || responses.length === 0) {
    return createdEvaluation;
  }

  const responseRows = responses.map((response) => ({
    evaluation_id: createdEvaluation.id,
    answers: response.answers ?? response,
    submitted_at: response.submitted_at || new Date().toISOString(),
    ip_address: response.ip_address || null
  }));

  const { error: responseError } = await supabase
    .from('evaluation_responses')
    .insert(responseRows);

  if (responseError) throw responseError;

  return createdEvaluation;
}

export async function sendPublicSurveyConfirmationEmail(payload = {}) {
  const { data, error } = await supabase.functions.invoke('send-public-survey-confirmation', {
    body: payload
  });

  if (error) throw error;
  return data;
}

function normalizeSurveySections(items = []) {
  const sections = [];
  let currentSection = null;

  const mapQuestion = (question) => {
    const base = {
      id: question.id || String(Math.random()).slice(2),
      label: question.label || question.instrucciones || question.titulo || question.name || '',
      tipo: question.tipo || question.type || 'text',
      sectionId: question.sectionId || question.section_id || null
    };

    if (question.tipo === 'section' || question.type === 'section') {
      return null;
    }

    return base;
  };

  items.forEach((item) => {
    if (item.tipo === 'section' || item.type === 'section') {
      currentSection = {
        id: item.id || String(Math.random()).slice(2),
        title: item.label || item.name || 'Sección',
        type: 'section',
        questions: []
      };
      sections.push(currentSection);
      return;
    }

    const question = mapQuestion(item);
    if (!question) return;

    if (!currentSection) {
      currentSection = {
        id: 'default-section',
        title: 'General',
        type: 'section',
        questions: []
      };
      sections.push(currentSection);
    }

    currentSection.questions.push(question);
  });

  return sections;
}

function parseNumericAnswer(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number(value);
  if (typeof value === 'string') {
    const numeric = Number(value.trim());
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

// Solo las preguntas de escala 1-5 puntúan; un campo numérico o de fecha no debe contaminar el promedio.
const isScoredQuestion = (q) => q.tipo === 'rating' || q.tipo === 'likert';

function getSectionScore(section, answers) {
  const numericValues = section.questions
    .filter(isScoredQuestion)
    .map((q) => parseNumericAnswer(answers[q.id]))
    .filter((value) => value !== null && !Number.isNaN(value));

  if (!numericValues.length) return null;
  const total = numericValues.reduce((sum, value) => sum + value, 0);
  return Number((total / numericValues.length).toFixed(2));
}

export function calculateSurveyScoreSummary({ survey = {}, answers = {} }) {
  const questions = Array.isArray(survey.questions)
    ? survey.questions
    : Array.isArray(survey.preguntas)
    ? survey.preguntas
    : [];

  const sections = normalizeSurveySections(questions);
  const sectionScores = sections.map((section) => ({
    sectionId: section.id,
    title: section.title,
    score: getSectionScore(section, answers),
    questionCount: section.questions.length
  }));

  const allNumericAnswers = sections
    .flatMap((section) => section.questions.filter(isScoredQuestion).map((q) => parseNumericAnswer(answers[q.id])))
    .filter((value) => value !== null && !Number.isNaN(value));

  const globalScore = allNumericAnswers.length
    ? Number((allNumericAnswers.reduce((sum, value) => sum + value, 0) / allNumericAnswers.length).toFixed(2))
    : null;

  return {
    sectionScores,
    globalScore,
    answeredQuestions: allNumericAnswers.length
  };
}

export async function updateEvaluation(id, evaluation) {
  const { data, error } = await supabase
    .from('evaluations')
    .update(evaluation)
    .eq('id', id)
    .select('*');
  if (error) throw error;
  return data;
}

export async function getEvaluationSummaryByConvenio(convenioId) {
  const summary = { student: 0, professor: 0, coordinator: 0 };

  try {
    const { data, error } = await supabase
      .from('evaluations')
      .select('id, student_id, tutor_id, center_id, dirigidoA, estado, tipoPrograma')
      .eq('center_id', convenioId);

    if (error) throw error;
    if (!Array.isArray(data)) return summary;

    data.forEach((item) => {
      if (item.student_id) {
        summary.student += 1;
        return;
      }
      if (item.tutor_id) {
        summary.professor += 1;
        return;
      }

      const role = normalizeRole(item.dirigidoA || item.estado || item.tipoPrograma);
      if (role === 'Coordinadores') summary.coordinator += 1;
    });
  } catch (error) {
    console.warn('No se pudo generar resumen de evaluaciones para convenio', error);
  }

  return summary;
}

export async function getStudentsByConvenio(convenioId) {
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, program, status, started, campus:campus_id(name)')
    .eq('convenio_id', convenioId)
    .order('full_name');
  if (error) throw error;
  return data || [];
}

export async function getProfessorsByConvenio(convenioId) {
  const { data, error } = await supabase
    .from('tutors')
    .select('id, full_name, specialty, status, campus:campus_id(name)')
    .eq('convenio_id', convenioId)
    .order('full_name');
  if (error) throw error;
  return data || [];
}

export async function getActiveConveniosCount() {
  const { count, error } = await supabase.from('convenios').select('id', { head: true, count: 'estimated' }).eq('status', 'activo');
  if (error) {
    console.warn('Error contando convenios activos, usando 0 como fallback:', error);
    return 0;
  }
  return count || 0;
}

export async function getStudentsInPracticeCount() {
  const { count, error } = await supabase.from('students').select('id', { head: true, count: 'estimated' }).eq('status', 'En Práctica');
  if (error) {
    console.warn('Error contando estudiantes en práctica, usando 0 como fallback:', error);
    return 0;
  }
  return count || 0;
}

export async function getEvaluationsCount() {
  const { count, error } = await supabase.from('evaluations').select('id', { head: true, count: 'estimated' });
  if (error) {
    console.warn('Error contando evaluaciones, usando 0 como fallback:', error);
    return 0;
  }
  return count || 0;
}

export async function getRecentEvaluations() {
  const { data, error } = await supabase
    .from('evaluations')
    .select(`id,status,created_at,student_id,tutor_id,campus_id,center_id, student:student_id(full_name,program), tutor:tutor_id(full_name,specialty), center:center_id(name), campus:campus_id(name)`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!error && data) {
    return data.map((item) => {
      const studentName = item.student?.full_name;
      const tutorName = item.tutor?.full_name;
      const personName = studentName || tutorName || (item.student_id ? 'Estudiante' : item.tutor_id ? 'Profesor' : 'Evaluación');
      const programName = item.student?.program || item.tutor?.specialty || '';
      const centerName = item.center?.name || item.center_id || item.campus?.name || item.campus_id || '-';

      return {
        id: item.id,
        name: personName,
        program: programName,
        center: centerName,
        status: item.status || 'Pendiente',
        score: '-',
        date: item.created_at || ''
      };
    });
  }

  if (error) {
    console.warn('Could not join evaluation relations, falling back to simple fetch:', error.message || error);
  }

  const fallback = await supabase
    .from('evaluations')
    .select('id,status,created_at,student_id,tutor_id,campus_id,center_id')
    .order('created_at', { ascending: false })
    .limit(10);

  if (fallback.error) {
    throw fallback.error;
  }

  return (fallback.data || []).map((item) => {
    const personName = item.student_id ? 'Estudiante' : item.tutor_id ? 'Profesor' : 'Evaluación';
    const centerName = item.center_id || item.campus_id || '-';

    return {
      id: item.id,
      name: personName,
      program: '',
      center: centerName,
      status: item.status || 'Pendiente',
      score: '-',
      date: item.created_at || ''
    };
  });
}

function normalizeRole(value) {
  if (!value) return 'Sin definir';
  const normalized = String(value).trim().toLowerCase();
  if (normalized.includes('todos') || normalized.includes('all')) return 'Todos';
  // Estudiantes: español e inglés
  if (normalized.includes('estudiante') || normalized.includes('alumno')
    || normalized.includes('est') || normalized.includes('student')) {
    return 'Estudiantes';
  }
  // Docentes: español e inglés (consistente con dataHelpers.js normalizeRoleName)
  if (normalized.includes('profesor') || normalized.includes('tutor')
    || normalized.includes('docente') || normalized.includes('maestro')
    || normalized.includes('teache') || normalized.includes('professor')
    || normalized.includes('docent')) {
    return 'Docentes';
  }
  // Coordinadores: español e inglés
  if (normalized.includes('coordinador') || normalized.includes('coordinator')
    || normalized.includes('admin') || normalized.includes('director')) {
    return 'Coordinadores';
  }
  return String(value).trim();
}

function normalizeProgram(value) {
  return String(value || 'Sin programa').trim();
}

function normalizeCenter(item) {
  return (
    item.center?.name ||
    item.center_id ||
    item.campus?.name ||
    item.campus_id ||
    'Sin sitio'
  ).toString();
}

function normalizeStatus(value) {
  const status = String(value || 'Pendiente').trim().toLowerCase();
  if (status.includes('pend')) return 'Pendiente';
  if (status.includes('complete') || status.includes('complet')) return 'Completada';
  if (status.includes('cancel')) return 'Cancelada';
  if (status.includes('hold')) return 'En espera';
  return String(value || 'Pendiente').trim();
}

function getLatestResponseAnswers(item) {
  const responses = Array.isArray(item?.evaluation_responses) ? item.evaluation_responses : [];
  const withAnswers = responses.filter((response) => response && typeof response.answers === 'object' && response.answers !== null);

  if (!withAnswers.length) return null;

  const sorted = [...withAnswers].sort((a, b) => {
    const aTime = new Date(a?.submitted_at || 0).getTime();
    const bTime = new Date(b?.submitted_at || 0).getTime();
    return bTime - aTime;
  });

  return sorted[0]?.answers || null;
}

// Ejecuta `fn` sobre cada elemento con un máximo de `limit` peticiones simultáneas, conservando el orden.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchSurveysById(surveyIds = []) {
  if (!surveyIds.length) return {};
  const { data, error } = await supabase
    .from('surveys')
    .select('id,title,questions,description,target_type')
    .in('id', surveyIds);
  if (error) throw error;
  return (data || []).reduce((acc, item) => { acc[item.id] = item; return acc; }, {});
}

async function fetchEvaluationResponsesByEvaluationIds(evaluationIds = []) {
  const uniqueEvaluationIds = Array.from(new Set(evaluationIds.filter(Boolean)));
  if (!uniqueEvaluationIds.length) return {};

  const fetchChunk = async (chunk, chunkSize = 50) => {
    const { data, error } = await supabase
      .from('evaluation_responses')
      .select('evaluation_id,answers,submitted_at')
      .in('evaluation_id', chunk);

    if (!error) return data || [];

    if ((error?.status === 400 || error?.status === 414) && chunkSize > 1) {
      const smallerChunkSize = Math.max(1, Math.floor(chunkSize / 2));
      const rows = [];
      for (let j = 0; j < chunk.length; j += smallerChunkSize) {
        rows.push(...(await fetchChunk(chunk.slice(j, j + smallerChunkSize), smallerChunkSize)));
      }
      return rows;
    }

    throw error;
  };

  const chunkSize = 50;
  const chunks = [];
  for (let i = 0; i < uniqueEvaluationIds.length; i += chunkSize) {
    chunks.push(uniqueEvaluationIds.slice(i, i + chunkSize));
  }
  const responseRows = (await mapWithConcurrency(chunks, 6, (chunk) => fetchChunk(chunk, chunkSize))).flat();

  return responseRows.reduce((acc, item) => {
    if (!item?.evaluation_id) return acc;
    acc[item.evaluation_id] = acc[item.evaluation_id] || [];
    acc[item.evaluation_id].push(item);
    return acc;
  }, {});
}

function mapEvaluationItem(item) {
  const persistedAnswers = getLatestResponseAnswers(item);
  const effectiveAnswers = persistedAnswers || item?.preguntas || {};

  const respondentRole =
    effectiveAnswers?._publicRespondent?.role ||
    effectiveAnswers?.role ||
    null;

  const respondentProgram =
    effectiveAnswers?._publicRespondent?.program ||
    effectiveAnswers?.program ||
    effectiveAnswers?.programa ||
    null;

  const role = normalizeRole(item.evaluator_role || respondentRole || item.estado || item.dirigidoA || item.tipoPrograma);
  const program = normalizeProgram(item.tipoPrograma || item.student?.program || item.tutor?.specialty || respondentProgram);
  const center = normalizeCenter(item);
  const status = normalizeStatus(item.status || 'Pendiente');
  const person = item.student?.full_name || item.tutor?.full_name || item.titulo || 'Evaluación';
  const surveyTitle = item.survey?.title || item.titulo || 'Evaluación';
  const questions = Array.isArray(item.preguntas)
    ? item.preguntas
    : Array.isArray(item.survey?.questions)
    ? item.survey.questions
    : [];

  const scoreSummary = calculateSurveyScoreSummary({
    survey: item.survey || {},
    answers: effectiveAnswers
  });

  return {
    id: item.id,
    role,
    program,
    center,
    campus: item.campus?.name || item.campus_id || 'Sin campus',
    survey: surveyTitle,
    status,
    created_at: item.created_at,
    completed_at: item.completed_at,
    period: item.period?.code || item.periodoCorte || 'No definido',
    target: item.dirigidoA || item.tipoPrograma || item.estado || 'Sin definir',
    person,
    questions,
    rawAnswers: effectiveAnswers,
    answersSource: persistedAnswers ? 'evaluation_responses' : 'evaluations.preguntas',
    questionCount: questions.length,
    scoreSummary,
    surveyDetails: {
      title: item.survey?.title || item.titulo || 'Evaluación',
      description: item.survey?.description || '',
      target_type: item.survey?.target_type || item.dirigidoA || '',
      questions: Array.isArray(item.survey?.questions) && item.survey.questions.length
        ? item.survey.questions
        : Array.isArray(item.preguntas)
        ? item.preguntas
        : []
    }
  };
}

function average(values) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function aggregateAverageScores(items, key, labelKey) {
  const aggregated = items.reduce((acc, item) => {
    const label = item[key] || 'Sin definir';
    const score = item.scoreSummary?.globalScore;
    const entry = acc[label] || { [labelKey]: label, total: 0, scoreTotal: 0, scoredCount: 0 };

    entry.total += 1;
    if (typeof score === 'number') {
      entry.scoreTotal += score;
      entry.scoredCount += 1;
    }

    acc[label] = entry;
    return acc;
  }, {});

  return Object.values(aggregated).map((entry) => ({
    [labelKey]: entry[labelKey],
    total: entry.total,
    averageScore: entry.scoredCount ? Number((entry.scoreTotal / entry.scoredCount).toFixed(2)) : null,
    scoredCount: entry.scoredCount
  }));
}

function buildScoreDistribution(rows) {
  const buckets = [
    { label: '0-2', min: 0, max: 2 },
    { label: '2-3', min: 2, max: 3 },
    { label: '3-4', min: 3, max: 4 },
    { label: '4-5', min: 4, max: 5 }
  ];

  const distribution = buckets.map((bucket) => ({ label: bucket.label, count: 0 }));

  rows.forEach((item) => {
    const score = item.scoreSummary?.globalScore;
    if (typeof score !== 'number') return;
    const bucket = distribution.find((bucketItem, index) => {
      const range = buckets[index];
      return score >= range.min && (score < range.max || (range.max === 5 && score <= range.max));
    });
    if (bucket) bucket.count += 1;
  });

  return distribution;
}

function aggregateSurveyScores(rows) {
  const aggregated = rows.reduce((acc, item) => {
    const surveyKey = item.survey || 'Sin encuesta';
    const score = item.scoreSummary?.globalScore;
    const entry = acc[surveyKey] || { survey: surveyKey, total: 0, scoreTotal: 0, scoredCount: 0 };

    entry.total += 1;
    if (typeof score === 'number') {
      entry.scoreTotal += score;
      entry.scoredCount += 1;
    }

    acc[surveyKey] = entry;
    return acc;
  }, {});

  return Object.values(aggregated).map((entry) => ({
    survey: entry.survey,
    total: entry.total,
    averageScore: entry.scoredCount ? Number((entry.scoreTotal / entry.scoredCount).toFixed(2)) : null,
    scoredCount: entry.scoredCount
  }));
}

function aggregateByKey(items, key, countKey = 'total') {
  return items.reduce((acc, item) => {
    const value = item[key] || 'Sin definir';
    const entry = acc[value] || { [key]: value, total: 0, completadas: 0, pendientes: 0, roles: {}, programs: {}, sites: {} };
    entry.total += 1;
    if (item.status === 'Completada') entry.completadas += 1;
    if (item.status === 'Pendiente') entry.pendientes += 1;
    if (item.role) entry.roles[item.role] = (entry.roles[item.role] || 0) + 1;
    if (item.program) entry.programs[item.program] = (entry.programs[item.program] || 0) + 1;
    if (item.center) entry.sites[item.center] = (entry.sites[item.center] || 0) + 1;
    acc[value] = entry;
    return acc;
  }, {});
}

// Varios módulos (Estadística, Informe, Presenta) piden lo mismo al abrirse: se comparte la petición en vuelo y se
// reutiliza el resultado unos segundos. `force: true` lo ignora.
const REPORT_CACHE_TTL_MS = 60 * 1000;
const reportMetricsCache = new Map();

export function getEvaluationReportMetrics(filters = {}) {
  const key = JSON.stringify([filters.campusId || null, filters.centerId || null]);
  const hit = reportMetricsCache.get(key);
  if (!filters.force && hit && Date.now() - hit.at < REPORT_CACHE_TTL_MS) {
    return hit.promise.then((base) => applyReportFilters(base, filters));
  }
  const promise = loadEvaluationReportRows(filters);
  reportMetricsCache.set(key, { at: Date.now(), promise });
  promise.catch(() => { if (reportMetricsCache.get(key)?.promise === promise) reportMetricsCache.delete(key); });
  return promise.then((base) => applyReportFilters(base, filters));
}

async function loadEvaluationReportRows({ campusId, centerId } = {}) {
  const pageSize = 500;
  let allRows = [];
  let cursor = null; // { created_at, id } de la última fila leída
  // El período sale de la relación evaluation_periods si la migración ya se aplicó; si no, del texto periodoCorte.
  let usePeriodRelation = true;

  // Paginación por cursor: un OFFSET grande obliga a Postgres a recorrer y descartar todas las filas anteriores,
  // y con columnas jsonb pesadas terminaba en timeout (500). Con cursor cada página cuesta lo mismo.
  while (true) {
    let query = supabase
      .from('evaluations')
      .select(`
        id,
        status,
        created_at,
        completed_at,
        dirigidoA,
        estado,
        periodoCorte,
        ${usePeriodRelation ? 'period:period_id(code),' : ''}
        tipoPrograma,
        titulo,
        preguntas,
        survey_id,
        campus:campus_id(name),
        center:center_id(name),
        student:student_id(full_name,program),
        tutor:tutor_id(full_name,specialty)
      `);

    // Filtros server-side — evitan traer datos innecesarios
    if (campusId) {
      query = query.eq('campus_id', campusId);
    }
    if (centerId) {
      query = query.eq('center_id', centerId);
    }
    if (cursor) {
      query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize);

    if (error && usePeriodRelation && /period/i.test(`${error.message || ''} ${error.details || ''}`)) {
      usePeriodRelation = false;
      continue;
    }
    if (error) throw error;
    if (!data?.length) break;

    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    const last = data[data.length - 1];
    cursor = { created_at: last.created_at, id: last.id };
  }

  // Las encuestas (con todas sus preguntas) se piden una sola vez en lugar de repetirlas en cada fila.
  const surveyIds = Array.from(new Set(allRows.map((item) => item.survey_id).filter(Boolean)));
  const [surveyMap, responseMap] = await Promise.all([
    fetchSurveysById(surveyIds),
    fetchEvaluationResponsesByEvaluationIds(allRows.map((item) => item.id).filter(Boolean))
  ]);
  allRows = allRows.map((item) => ({
    ...item,
    survey: surveyMap[item.survey_id] || null,
    evaluation_responses: responseMap[item.id] || []
  }));

  // El cálculo de puntajes se hace una vez y queda en caché junto con las filas.
  return { rows: allRows.map(mapEvaluationItem) };
}

function applyReportFilters({ rows }, { role, program, center } = {}) {
  const filteredRows = rows.filter((item) => {
    if (role && role !== 'all' && item.role !== role) return false;
    if (program && program !== 'all' && item.program !== program) return false;
    if (center && center !== 'all' && item.center !== center) return false;
    return true;
  });

  const totals = filteredRows.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.completed += item.status === 'Completada' ? 1 : 0;
      acc.pending += item.status === 'Pendiente' ? 1 : 0;
      acc.roles[item.role] = (acc.roles[item.role] || 0) + 1;
      acc.programs[item.program] = (acc.programs[item.program] || 0) + 1;
      acc.centers[item.center] = (acc.centers[item.center] || 0) + 1;
      return acc;
    },
    { total: 0, completed: 0, pending: 0, roles: {}, programs: {}, centers: {} }
  );

  const siteSummary = Object.values(aggregateByKey(filteredRows, 'center'));
  const programSummary = Object.values(aggregateByKey(filteredRows, 'program'));
  const roleSummary = Object.values(aggregateByKey(filteredRows, 'role'));

  const matrix = filteredRows.reduce((acc, item) => {
    const key = `${item.center}||${item.program}`;
    const entry = acc[key] || {
      center: item.center,
      program: item.program,
      total: 0,
      completadas: 0,
      pendientes: 0,
      roles: {}
    };
    entry.total += 1;
    if (item.status === 'Completada') entry.completadas += 1;
    if (item.status === 'Pendiente') entry.pendientes += 1;
    entry.roles[item.role] = (entry.roles[item.role] || 0) + 1;
    acc[key] = entry;
    return acc;
  }, {});

  const scoredRows = filteredRows.filter((item) => typeof item.scoreSummary?.globalScore === 'number');
  const averageScore = average(scoredRows.map((item) => item.scoreSummary.globalScore));
  const scoreDistribution = buildScoreDistribution(filteredRows);
  const averageByRole = aggregateAverageScores(filteredRows, 'role', 'role');
  const averageByProgram = aggregateAverageScores(filteredRows, 'program', 'program');
  const averageBySite = aggregateAverageScores(filteredRows, 'center', 'center');
  const surveySummary = aggregateSurveyScores(filteredRows);

  return {
    totals,
    siteSummary,
    programSummary,
    roleSummary,
    siteProgramMatrix: Object.values(matrix),
    rows: filteredRows,
    averageScore,
    scoreDistribution,
    averageByRole,
    averageByProgram,
    averageBySite,
    surveySummary,
    filters: {
      role: role || 'all',
      program: program || 'all',
      center: center || 'all'
    }
  };
}

export async function getEvaluationReports() {
  const { data, error } = await supabase
    .from('evaluations')
    .select(`
      id,
      status,
      created_at,
      completed_at,
      dirigidoA,
      estado,
      periodoCorte,
      tipoPrograma,
      titulo,
      preguntas,
      survey:survey_id(title,questions,description,target_type),
      campus:campus_id(name),
      center:center_id(name),
      student:student_id(full_name,program),
      tutor:tutor_id(full_name,specialty)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const evaluations = data || [];
  const evaluationIds = evaluations.map((item) => item.id).filter(Boolean);
  let evaluationResponsesMap = {};
  if (evaluationIds.length) {
    evaluationResponsesMap = await fetchEvaluationResponsesByEvaluationIds(evaluationIds);
  }

  return evaluations.map((item) => {
    const evaluation = {
      ...item,
      evaluation_responses: evaluationResponsesMap[item.id] || []
    };

    const target = evaluation.dirigidoA || evaluation.tipoPrograma || evaluation.estado || 'Sin definir';
    const program = evaluation.student?.program || evaluation.tutor?.specialty || evaluation.tipoPrograma || '-';
    const person = evaluation.student?.full_name || evaluation.tutor?.full_name || evaluation.titulo || 'Evaluación';
    const centerName = evaluation.center?.name || evaluation.center_id || 'Sin centro';
    const campusName = evaluation.campus?.name || evaluation.campus_id || 'Sin campus';
    const surveyTitle = evaluation.survey?.title || evaluation.titulo || 'Evaluación';

    return {
      id: evaluation.id,
      status: evaluation.status || 'Pendiente',
      created_at: evaluation.created_at,
      completed_at: evaluation.completed_at,
      target,
      period: evaluation.periodoCorte || 'No definido',
      program,
      person,
      center: centerName,
      campus: campusName,
      survey: surveyTitle,
      evaluation_responses: evaluation.evaluation_responses
    };
  });
}
