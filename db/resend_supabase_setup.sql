-- Setup requerido en Supabase para envios con Resend
-- 1) Ejecutar este script en SQL Editor
-- 2) Configurar secrets y desplegar Edge Function (ver instrucciones en respuesta)

create extension if not exists "uuid-ossp";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Bitacora de envios de correo
create table if not exists public.email_delivery_log (
  id uuid not null default uuid_generate_v4(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  status text not null default 'pending',
  provider text not null default 'resend',
  template_key text null,
  recipient_email text not null,
  subject text null,
  response_id text null,
  error_message text null,
  payload jsonb not null default '{}'::jsonb,
  evaluation_id uuid null references public.evaluations(id) on delete set null,
  survey_id uuid null references public.surveys(id) on delete set null,
  constraint email_delivery_log_pkey primary key (id)
);

create index if not exists email_delivery_log_created_at_idx
  on public.email_delivery_log(created_at desc);

create index if not exists email_delivery_log_status_idx
  on public.email_delivery_log(status);

create index if not exists email_delivery_log_recipient_idx
  on public.email_delivery_log(lower(recipient_email));

drop trigger if exists email_delivery_log_updated_at on public.email_delivery_log;
create trigger email_delivery_log_updated_at
before update on public.email_delivery_log
for each row
execute procedure public.set_updated_at();

alter table public.email_delivery_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'email_delivery_log'
      and policyname = 'email_delivery_log_service_role_all'
  ) then
    create policy email_delivery_log_service_role_all
      on public.email_delivery_log
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- Incluir email en usuarios del portal para flujos autenticados
-- (si ya existe la vista, se reemplaza con columna email)
drop view if exists public.portal_users cascade;
create view public.portal_users as
select
  s.id as user_id,
  'student' as role,
  s.academic_code,
  s.document_number,
  s.full_name,
  s.email,
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
  t.email,
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

-- Funcion con email incluido
-- Mantiene compatibilidad con el frontend y habilita envio de confirmaciones
create or replace function public.get_portal_user_by_code(user_code text)
returns table(
  user_id uuid,
  role text,
  academic_code text,
  document_number text,
  full_name text,
  email text,
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
