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
create or replace function public.portal_active_surveys_by_code(user_code text)
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
       (u.role = 'student' and lower(s.target_type) = 'estudiante')
    or (u.role = 'professor' and lower(s.target_type) in ('profesor', 'docente'))
    or (u.role not in ('student','professor') and lower(s.target_type) = lower(u.role))
)
left join public.campuses c on c.id = s.campus_id
where not exists (
  select 1
  from public.evaluations ev
  where ev.survey_id = s.id
    and (
      (u.role = 'student' and ev.student_id = u.user_id)
      or (u.role = 'professor' and ev.tutor_id = u.user_id)
    )
);
$portal_active_surveys$;

-- Función auxiliar para verificar si el usuario ya respondió un formulario específico.
create or replace function public.portal_user_has_completed(user_code text, survey_id uuid)
returns boolean
language sql stable
as $portal_user_has_completed$
select exists(
  select 1
  from public.get_portal_user_by_code(user_code) u
  join public.evaluations ev on ev.survey_id = survey_id
  where (
    (u.role = 'student' and ev.student_id = u.user_id)
    or (u.role = 'professor' and ev.tutor_id = u.user_id)
  )
);
$portal_user_has_completed$;
