-- Script para actualizar una tabla surveys existente a la estructura esperada
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

alter table public.surveys
  add column if not exists description text,
  add column if not exists target_type text default 'Estudiante',
  add column if not exists questions jsonb not null default '[]'::jsonb,
  add column if not exists campus_id uuid,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.surveys
set questions = '[]'::jsonb
where questions is null;

alter table public.surveys
  alter column target_type set not null,
  alter column questions set default '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'surveys_campus_id_fkey'
      AND conrelid = 'public.surveys'::regclass
  ) THEN
    alter table public.surveys
      add constraint surveys_campus_id_fkey foreign key (campus_id) references public.campuses(id) on delete cascade;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS surveys_updated_at ON public.surveys;
CREATE TRIGGER surveys_updated_at
BEFORE UPDATE ON public.surveys
FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'evaluations') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'evaluations_student_id_fkey'
        AND conrelid = 'public.evaluations'::regclass
    ) THEN
      alter table public.evaluations
        add constraint evaluations_student_id_fkey foreign key (student_id) references public.students(id) on delete set null;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'evaluations_tutor_id_fkey'
        AND conrelid = 'public.evaluations'::regclass
    ) THEN
      alter table public.evaluations
        add constraint evaluations_tutor_id_fkey foreign key (tutor_id) references public.tutors(id) on delete set null;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'evaluations_center_id_fkey'
        AND conrelid = 'public.evaluations'::regclass
    ) THEN
      alter table public.evaluations
        add constraint evaluations_center_id_fkey foreign key (center_id) references public.convenios(id) on delete set null;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_class
      WHERE relname = 'evaluations_student_center_unique'
    ) THEN
      CREATE UNIQUE INDEX evaluations_student_center_unique ON public.evaluations (student_id, center_id) WHERE student_id IS NOT NULL AND center_id IS NOT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_class
      WHERE relname = 'evaluations_tutor_center_unique'
    ) THEN
      CREATE UNIQUE INDEX evaluations_tutor_center_unique ON public.evaluations (tutor_id, center_id) WHERE tutor_id IS NOT NULL AND center_id IS NOT NULL;
    END IF;
  END IF;
END
$$;
