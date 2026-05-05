-- Catalogo de programas academicos por campus
-- Ejecutar en Supabase SQL editor

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

create table if not exists public.programs (
  id uuid not null default uuid_generate_v4(),
  campus_id uuid not null references public.campuses(id) on delete cascade,
  name text not null,
  level text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint programs_pkey primary key (id),
  constraint programs_level_check check (lower(level) in ('pregrado', 'posgrado'))
);

create unique index if not exists programs_unique_campus_name_level
  on public.programs (campus_id, lower(name), lower(level));

create index if not exists programs_campus_idx
  on public.programs (campus_id);

create index if not exists programs_level_idx
  on public.programs (lower(level));

drop trigger if exists programs_updated_at on public.programs;
create trigger programs_updated_at
before update on public.programs
for each row
execute procedure public.set_updated_at();

-- Carga inicial sugerida desde datos existentes
-- 1) Programas de estudiantes como pregrado
insert into public.programs (campus_id, name, level)
select distinct
  s.campus_id,
  trim(s.program) as name,
  'Pregrado' as level
from public.students s
where s.campus_id is not null
  and trim(coalesce(s.program, '')) <> ''
on conflict (campus_id, lower(name), lower(level)) do nothing;

-- 2) Especialidades de tutores como posgrado (ajustable segun reglas internas)
insert into public.programs (campus_id, name, level)
select distinct
  t.campus_id,
  trim(t.specialty) as name,
  'Posgrado' as level
from public.tutors t
where t.campus_id is not null
  and trim(coalesce(t.specialty, '')) <> ''
on conflict (campus_id, lower(name), lower(level)) do nothing;

-- Opcional: ejemplo de insercion manual
-- insert into public.programs (campus_id, name, level) values
-- ('<uuid-campus>', 'Enfermeria', 'Pregrado'),
-- ('<uuid-campus>', 'Gerencia en Salud', 'Posgrado');
