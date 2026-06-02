import { supabase } from './supabaseClient';

const SYSTEM_SETTINGS_KEY = 'komet_system';

export const OPENROUTER_FREE_MODELS = [
  // Modelos gratuitos activos en OpenRouter (Junio 2026)
  // La disponibilidad cambia frecuentemente — el fallback a modelo pago más barato
  // (findCheapestPaidModel) se activa si todos estos fallan.
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-coder:free',
  'qwen/qwen-2.5-7b-instruct:free',
  'deepseek/deepseek-r1-distill-qwen-7b:free',
  'meta-llama/llama-3.2-3b-instruct:free'
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
  openrouter_api_key: '',
  openrouter_model: OPENROUTER_FREE_MODELS[0],
  openrouter_temperature: 0.7,
  openrouter_system_prompt: 'Eres un asistente administrativo para el sistema Komet, ayudas a generar mensajes de email y notificaciones operativas.'
};

function mergeSystemSettings(config = {}) {
  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...config,
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

export async function runOpenRouterPrompt({
  apiKey,
  model,
  systemPrompt,
  prompt,
  temperature = 0.7
}) {
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  async function extractErrorBody(response) {
    try {
      const payload = await response.json();
      if (payload?.error?.message) return payload.error.message;
      return JSON.stringify(payload || {});
    } catch {
      return await response.text();
    }
  }

  async function fetchDynamicFreeModels(trimmedKey) {
    if (!trimmedKey) return [];
    try {
      const modelsResponse = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${trimmedKey}` }
      });
      if (!modelsResponse.ok) return [];
      const payload = await modelsResponse.json();
      const ids = Array.isArray(payload?.data) ? payload.data.map((item) => item?.id).filter(Boolean) : [];
      return ids.filter((id) => String(id).includes(':free'));
    } catch {
      return [];
    }
  }

  /**
   * Llama a OpenRouter directamente desde el browser.
   * Solo se usa en entorno de desarrollo (Vite) con VITE_OPENROUTER_API_KEY.
   */
  async function callDirectOpenRouter({ trimmedKey, model, requestTemperature, messages, freeModels }) {
    if (!trimmedKey) {
      const error = new Error(
        isDev
          ? 'No hay API key de OpenRouter. Crea un archivo .env con VITE_OPENROUTER_API_KEY=sk-or-v1-...'
          : 'No hay API key de OpenRouter configurada. Ve a Sistema > Configuración e ingresa la llave.'
      );
      error.code = 'openrouter_missing_api_key';
      throw error;
    }

    const browserOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://komet.local';
    const body = { model, temperature: requestTemperature, messages };
    if (model === 'openrouter/auto' && freeModels?.length) {
      body.models = freeModels;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${trimmedKey}`,
        'HTTP-Referer': browserOrigin,
        'X-Title': 'Komet'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await extractErrorBody(response);
      const error = new Error(`OpenRouter respondió con ${response.status}: ${errorBody}`);
      error.code = 'openrouter_direct_call_failed';
      error.status = response.status;
      throw error;
    }

    return response;
  }

  /**
   * Intenta la llamada primero via el proxy de Vercel /api/openrouter-chat.
   * En dev (Vite) salta directo a llamada directa.
   * En produccion, si el proxy falla con 404, lanza error claro.
   */
  async function callViaProxy({ trimmedKey, candidateModel, requestTemperature, messages, freeModels, isAuto }) {
    if (isDev) {
      // En dev no existe el proxy de Vercel, llamamos directo
      return callDirectOpenRouter({ trimmedKey, model: candidateModel, requestTemperature, messages, freeModels });
    }

    const body = isAuto
      ? { apiKey: trimmedKey || undefined, model: 'openrouter/auto', models: freeModels, temperature: requestTemperature, messages }
      : { apiKey: trimmedKey, model: candidateModel, temperature: requestTemperature, messages };

    const response = await fetch('/api/openrouter-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (response.status === 404) {
      // Si el proxy no está disponible pero tenemos VITE_OPENROUTER_API_KEY
      // (bakeada en el bundle por Vite), podemos caer a llamada directa
      if (trimmedKey) {
        console.warn('[OpenRouter] Proxy 404, fallback a llamada directa desde el browser');
        return callDirectOpenRouter({ trimmedKey, model: candidateModel, requestTemperature, messages, freeModels });
      }

      const error = new Error(
        'El endpoint /api/openrouter-chat no está disponible en Vercel. ' +
        'Haz redeploy del proyecto para que la API Serverless Function se active. ' +
        'Si el problema persiste, configura VITE_OPENROUTER_API_KEY en las variables de entorno de Vercel.'
      );
      error.code = 'openrouter_proxy_not_found';
      error.status = 404;
      throw error;
    }

    return response;
  }

  const envKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY;
  const trimmedKey = (apiKey || envKey || '').trim();
  const dynamicFreeModels = await fetchDynamicFreeModels(trimmedKey);
  const candidateModels = [...new Set([model, ...dynamicFreeModels, ...OPENROUTER_FREE_MODELS].filter(Boolean))];

  let lastErrorMessage = 'openrouter_request_failed';
  const requestTemperature = Number.isFinite(Number(temperature)) ? Number(temperature) : 0.7;
  const messages = [
    { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_SETTINGS.openrouter_system_prompt },
    { role: 'user', content: prompt || 'Responde: conexión OpenRouter verificada para Komet.' }
  ];

  if (!candidateModels.length) {
    const authError = new Error('No hay modelos gratuitos configurados para OpenRouter.');
    authError.code = 'openrouter_free_models_not_configured';
    throw authError;
  }

  if (!trimmedKey) {
    const error = new Error(
      isDev
        ? 'OpenRouter deshabilitado: crea un archivo .env con VITE_OPENROUTER_API_KEY=sk-or-v1-...'
        : 'OpenRouter deshabilitado: configura la API key en Sistema > Configuración o agrega VITE_OPENROUTER_API_KEY en las variables de entorno de Vercel.'
    );
    error.code = 'openrouter_missing_api_key';
    throw error;
  }

  // Helper: intenta un modelo y captura excepciones para seguir al siguiente
  async function tryModel(modelToTry, isAuto = false) {
    try {
      const response = await callViaProxy({
        trimmedKey,
        candidateModel: modelToTry,
        freeModels: candidateModels,
        requestTemperature,
        messages,
        isAuto
      });

      if (response.ok) {
        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content || '';
        if (content) return { ok: true, content };
        return { ok: false, error: 'respuesta_vacia_del_modelo', skip: true };
      }

      const errorMessage = await extractErrorBody(response).catch(() => 'unknown_error');
      const isNoEndpoint = response.status === 404 && String(errorMessage).toLowerCase().includes('no endpoints found');
      return { ok: false, error: errorMessage, skip: isNoEndpoint };
    } catch (err) {
      const isNoEndpoint = String(err?.message || '').toLowerCase().includes('no endpoints found');
      return { ok: false, error: err?.message || 'error', skip: isNoEndpoint };
    }
  }

  // 1. Intentar auto-routing con todos los modelos gratuitos como restricción
  {
    const result = await tryModel('openrouter/auto', true);
    if (result.ok) return result.content;
    if (result.error) lastErrorMessage = result.error;
    console.warn('[OpenRouter] auto-routing falló:', result.error);
  }

  // 2. Probar cada modelo candidato individualmente
  for (const candidateModel of candidateModels) {
    const result = await tryModel(candidateModel, false);
    if (result.ok) return result.content;
    if (result.error) lastErrorMessage = result.error;
    console.warn(`[OpenRouter] ${candidateModel} falló:`, result.error?.slice(0, 120));
    // Si NO es un error de "no endpoints", no seguimos probando
    if (!result.skip) break;
  }

  // 3. Fallback: buscar el modelo NO gratuito más barato disponible
  async function findCheapestPaidModel(apiKey) {
    if (!apiKey) return null;
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!resp.ok) return null;
      const payload = await resp.json();
      const models = Array.isArray(payload?.data) ? payload.data : [];
      // Filtrar solo modelos que NO son free, ordenar por precio (completion más barato primero)
      const paid = models
        .filter(m => !String(m.id || '').includes(':free') && m.pricing?.completion)
        .map(m => ({
          id: m.id,
          cost: parseFloat(m.pricing.completion)
        }))
        .filter(m => m.cost > 0 && m.cost < 1) // menos de $1 por token (razonable)
        .sort((a, b) => a.cost - b.cost);
      return paid[0]?.id || null;
    } catch {
      return null;
    }
  }

  const cheapestModel = await findCheapestPaidModel(trimmedKey);
  if (cheapestModel) {
    console.warn(`[OpenRouter] Probando modelo económico: ${cheapestModel}`);
    const result = await tryModel(cheapestModel, false);
    if (result.ok) return result.content;
    if (result.error) lastErrorMessage = result.error;
  }

  const requestError = new Error(
    'Todos los modelos de OpenRouter fallaron (gratuitos y pagos mínimos). Último error: ' + (lastErrorMessage?.slice(0, 200) || 'desconocido')
  );
  requestError.code = 'openrouter_all_models_failed';
  throw requestError;
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

export async function getSurveys() {
  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
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

function getSectionScore(section, answers) {
  const numericValues = section.questions
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
    .flatMap((section) => section.questions.map((q) => parseNumericAnswer(answers[q.id])))
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

async function fetchEvaluationResponsesByEvaluationIds(evaluationIds = []) {
  const uniqueEvaluationIds = Array.from(new Set(evaluationIds.filter(Boolean)));
  if (!uniqueEvaluationIds.length) return {};

  const fetchChunk = async (chunk, chunkSize = 10) => {
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

  const chunkSize = 10;
  const responseRows = [];

  for (let i = 0; i < uniqueEvaluationIds.length; i += chunkSize) {
    const chunk = uniqueEvaluationIds.slice(i, i + chunkSize);
    responseRows.push(...(await fetchChunk(chunk, chunkSize)));
  }

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
    period: item.periodoCorte || 'No definido',
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

export async function getEvaluationReportMetrics(filters = {}) {
  const { role, program, center, campusId, centerId } = filters;
  const pageSize = 200;
  let allRows = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
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
        tipoPrograma,
        titulo,
        preguntas,
        survey:survey_id(title,questions,description,target_type),
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

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!data?.length) break;

    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    page += 1;
  }

  const evaluationIds = allRows.map((item) => item.id).filter(Boolean);
  if (evaluationIds.length) {
    const responseMap = await fetchEvaluationResponsesByEvaluationIds(evaluationIds);
    allRows = allRows.map((item) => ({
      ...item,
      evaluation_responses: responseMap[item.id] || []
    }));
  }

  const rows = (allRows || []).map(mapEvaluationItem);
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
