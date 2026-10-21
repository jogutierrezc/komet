-- Rotaciones de práctica formativa por sitio de práctica.
-- Permite registrar, para cada sitio (convenio), las rotaciones que los programas
-- de salud (Medicina, Enfermería, Fisioterapia, Psicología, etc.) usan durante
-- el semestre: nombre de la rotación, número y tipo.
-- En las evaluaciones se guarda la rotación indicada por el evaluador.

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

-- 1) Catálogo de rotaciones por sitio de práctica.
--    program es opcional: si es null la rotación aplica a todos los programas.
create table if not exists public.rotations (
  id uuid not null default uuid_generate_v4(),
  convenio_id uuid not null references public.convenios(id) on delete cascade,
  name text not null,
  number int null,
  type text null,
  program text null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rotations_pkey primary key (id),
  constraint rotations_convenio_name_unique unique (convenio_id, name)
);

drop trigger if exists rotations_updated_at on public.rotations;
create trigger rotations_updated_at
before update on public.rotations
for each row
execute procedure public.set_updated_at();

create index if not exists rotations_convenio_idx on public.rotations (convenio_id);

-- 2) Rotación registrada en cada evaluación.
--    rotation_name / rotation_number / rotation_type se guardan desnormalizados
--    para conservar la información aunque la rotación del catálogo cambie o se borre.
alter table if exists public.evaluations
  add column if not exists rotation_id uuid references public.rotations(id) on delete set null,
  add column if not exists rotation_name text,
  add column if not exists rotation_number int,
  add column if not exists rotation_type text;

-- 3) Unicidad: se permite evaluar un mismo sitio en rotaciones distintas.
--    Sin rotación (rotation_id null) se mantiene la regla actual: una sola
--    evaluación por sitio y rol.
drop index if exists evaluations_student_center_unique;
create unique index evaluations_student_center_unique
  on public.evaluations (student_id, center_id, coalesce(rotation_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where student_id is not null and center_id is not null;

drop index if exists evaluations_tutor_center_unique;
create unique index evaluations_tutor_center_unique
  on public.evaluations (tutor_id, center_id, coalesce(rotation_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where tutor_id is not null and center_id is not null;

drop index if exists evaluations_evaluator_role_center_unique;
create unique index evaluations_evaluator_role_center_unique
  on public.evaluations (evaluator_user_id, lower(evaluator_role), center_id, coalesce(rotation_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where evaluator_user_id is not null and evaluator_role is not null and center_id is not null;
