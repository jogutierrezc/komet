import { supabase } from './supabaseClient';

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

export async function getCampuses() {
  const { data, error } = await supabase.from('campuses').select('id,name').order('name');
  if (error) throw error;
  return data || [];
}

export async function getConvenios() {
  const { data, error } = await supabase.from('convenios').select('*, campus:campus_id(name)').order('name');
  if (error) throw error;
  return data || [];
}

export async function createConvenio(convenio) {
  const { data, error } = await supabase.from('convenios').insert([convenio]).select('*, campus:campus_id(name)');
  if (error) throw error;
  return data;
}

export async function updateConvenio(id, convenio) {
  const { data, error } = await supabase.from('convenios').update(convenio).eq('id', id).select('*, campus:campus_id(name)');
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

export async function getPortalUserByCode(userCode) {
  const { data, error } = await supabase.rpc('get_portal_user_by_code', { user_code: userCode });
  if (error) throw error;
  return data?.[0] || null;
}

export async function getPortalActiveSurveysByCode(userCode) {
  const { data, error } = await supabase.rpc('portal_active_surveys_by_code', { user_code: userCode });
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
    .select('*');
  if (error) throw error;
  return data;
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
  const students = await getStudentsByConvenio(convenioId);
  const professors = await getProfessorsByConvenio(convenioId);

  const studentIds = students.map((item) => item.id).filter(Boolean);
  const professorIds = professors.map((item) => item.id).filter(Boolean);

  const summary = { student: 0, professor: 0, coordinator: 0 };

  try {
    if (studentIds.length) {
      const { count, error } = await supabase
        .from('evaluations')
        .select('id', { head: true, count: 'exact' })
        .in('student_id', studentIds);
      if (!error) summary.student = count || 0;
    }

    if (professorIds.length) {
      const { count, error } = await supabase
        .from('evaluations')
        .select('id', { head: true, count: 'exact' })
        .in('professor_id', professorIds);
      if (!error) summary.professor = count || 0;
    }

    const { count: coordinatorCount, error: coordinatorError } = await supabase
      .from('evaluations')
      .select('id', { head: true, count: 'exact' })
      .not('coordinator_id', 'is', null)
      .eq('convenio_id', convenioId);

    if (!coordinatorError) summary.coordinator = coordinatorCount || 0;
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
  const { count, error } = await supabase.from('convenios').select('id', { head: true, count: 'exact' }).eq('status', 'activo');
  if (error) throw error;
  return count || 0;
}

export async function getStudentsInPracticeCount() {
  const { count, error } = await supabase.from('students').select('id', { head: true, count: 'exact' }).eq('status', 'En Práctica');
  if (error) throw error;
  return count || 0;
}

export async function getEvaluationsCount() {
  const { count, error } = await supabase.from('evaluations').select('id', { head: true, count: 'exact' });
  if (error) throw error;
  return count || 0;
}

export async function getRecentEvaluations() {
  const { data, error } = await supabase
    .from('evaluations')
    .select('id,status,created_at,student:student_id(full_name, convenio:convenio_id(name)), tutor:tutor_id(full_name, convenio:convenio_id(name)), campus:campus_id(name), center:center_id(name)')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return (data || []).map((item) => {
    const studentName = item.student?.full_name;
    const tutorName = item.tutor?.full_name;
    const personName = studentName || tutorName || 'Registro';
    const personProgram = '';
    const centerName = item.center?.name || item.student?.convenio?.name || item.tutor?.convenio?.name || item.campus?.name || '-';

    return {
      id: item.id,
      name: personName,
      program: personProgram,
      center: centerName,
      status: item.status || 'Pendiente',
      score: '-',
      date: item.created_at || ''
    };
  });
}
