-- Script Supabase para habilitar el portal público de evaluaciones.
-- Agrega campos de acceso a estudiantes y profesores y crea vistas / funciones
-- que permiten consultar usuarios y formularios activos disponibles.

create extension if not exists "uuid-ossp";

-- Campos nuevos para usuarios públicos
alter table if exists public.students
  add column if not exists academic_code text,
  add column if not exists document_number text;

alter table if exists public.tutors
  add column if not exists document_number text;

alter table if exists public.surveys
  add column if not exists estado text default 'activo';

alter table if exists public.evaluations
  add column if not exists evaluator_user_id uuid,
  add column if not exists evaluator_role text;

update public.evaluations
set
  evaluator_user_id = coalesce(evaluator_user_id, student_id, tutor_id),
  evaluator_role = coalesce(
    nullif(lower(evaluator_role), ''),
    case
      when student_id is not null then 'student'
      when tutor_id is not null then 'professor'
      else nullif(lower(coalesce(estado, dirigidoA, tipoPrograma)), '')
    end
  )
where evaluator_user_id is null or evaluator_role is null or evaluator_role = '';

create unique index if not exists evaluations_evaluator_role_center_unique
  on public.evaluations (evaluator_user_id, lower(evaluator_role), center_id)
  where evaluator_user_id is not null and evaluator_role is not null and center_id is not null;

-- Vista consolidada de usuarios habilitados para el portal público
drop view if exists public.portal_users cascade;
create view public.portal_users as
select
  s.id as user_id,
  'student' as role,
  s.academic_code,
  s.document_number,
  s.full_name,
  s.program,
  s.campus_id,
  c.name as campus_name,
  s.convenio_id as practice_center_id,
  cn.name as practice_center_name,
  s.status,
  s.started::text as started,
  s.convenio_id
from public.students s
left join public.campuses c on c.id = s.campus_id
left join public.convenios cn on cn.id = s.convenio_id
union all
select
  t.id as user_id,
  'professor' as role,
  null::text as academic_code,
  t.document_number,
  t.full_name,
  t.specialty as program,
  t.campus_id,
  c.name as campus_name,
  t.convenio_id as practice_center_id,
  cn.name as practice_center_name,
  t.status,
  null::text as started,
  t.convenio_id
from public.tutors t
left join public.campuses c on c.id = t.campus_id
left join public.convenios cn on cn.id = t.convenio_id;

-- Vista de formularios activos
create or replace view public.active_surveys as
select *
from public.surveys
where lower(coalesce(estado, 'activo')) in ('active', 'activo', 'published', 'publicado');

-- Función para buscar usuario del portal con código académico o documento.
drop function if exists public.get_portal_user_by_code(text) cascade;
create function public.get_portal_user_by_code(user_code text)
returns table(
  user_id uuid,
  role text,
  academic_code text,
  document_number text,
  full_name text,
  program text,
  campus_id uuid,
  campus_name text,
  practice_center_id uuid,
  practice_center_name text,
  status text,
  started text,
  convenio_id uuid
)
language sql stable
as $$
select *
from public.portal_users
where coalesce(academic_code, '') = user_code
   or coalesce(document_number, '') = user_code
limit 1;
$$;

-- Función que entrega los formularios disponibles para un usuario del portal.
-- Excluye formularios ya respondidos por ese usuario.
create or replace function public.portal_active_surveys_by_code(user_code text, practice_center_id uuid default null)
returns table(
  survey_id uuid,
  title text,
  description text,
  target_type text,
  questions jsonb,
  campus_id uuid,
  campus_name text
)
language sql stable
as $portal_active_surveys$
select
  s.id,
  s.title,
  s.description,
  s.target_type,
  s.questions,
  s.campus_id,
  c.name as campus_name
from public.get_portal_user_by_code(user_code) u
join public.active_surveys s on (
       lower(s.target_type) = 'todos'
    or (u.role = 'student' and lower(s.target_type) = 'estudiante')
    or (u.role = 'professor' and lower(s.target_type) in ('profesor', 'docente'))
    or (u.role not in ('student','professor') and lower(s.target_type) = lower(u.role))
)
left join public.campuses c on c.id = s.campus_id
where not exists (
  select 1
  from public.evaluations ev
  where ev.center_id = coalesce(practice_center_id, u.practice_center_id)
    and (
      ev.evaluator_user_id = u.user_id
      or (u.role = 'student' and ev.student_id = u.user_id)
      or (u.role = 'professor' and ev.tutor_id = u.user_id)
    )
);
$portal_active_surveys$;

-- Función auxiliar para verificar si el usuario ya respondió un formulario específico.
create or replace function public.portal_user_has_completed(user_code text, survey_id uuid, practice_center_id uuid default null)
returns boolean
language sql stable
as $portal_user_has_completed$
select exists(
  select 1
  from public.get_portal_user_by_code(user_code) u
  join public.evaluations ev on ev.survey_id = survey_id
  where ev.center_id = coalesce(practice_center_id, u.practice_center_id)
    and (
      ev.evaluator_user_id = u.user_id
      or (u.role = 'student' and ev.student_id = u.user_id)
      or (u.role = 'professor' and ev.tutor_id = u.user_id)
    )
);
$portal_user_has_completed$;
