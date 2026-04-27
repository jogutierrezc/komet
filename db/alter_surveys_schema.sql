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
