-- Schema for survey templates and evaluation responses
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

create table if not exists public.surveys (
  id uuid not null default uuid_generate_v4(),
  title text not null,
  description text null,
  target_type text not null,
  questions jsonb not null default '[]'::jsonb,
  campus_id uuid null references public.campuses(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint surveys_pkey primary key (id)
);

drop trigger if exists surveys_updated_at on public.surveys;
create trigger surveys_updated_at
before update on public.surveys
for each row
execute procedure public.set_updated_at();

create table if not exists public.evaluations (
  id uuid not null default uuid_generate_v4(),
  survey_id uuid null references public.surveys(id) on delete cascade,
  campus_id uuid null references public.campuses(id) on delete cascade,
  student_id uuid null references public.students(id) on delete set null,
  tutor_id uuid null references public.tutors(id) on delete set null,
  center_id uuid null references public.convenios(id) on delete set null,
  status text not null default 'pending',
  share_token uuid not null default uuid_generate_v4(),
  expires_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  dirigidoA text null,
  estado text null,
  periodoCorte text null,
  preguntas jsonb null,
  tipoPrograma text null,
  titulo text null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint evaluations_pkey primary key (id),
  constraint evaluations_share_token_key unique (share_token)
);
create unique index if not exists evaluations_student_center_unique on public.evaluations (student_id, center_id) where student_id is not null and center_id is not null;
create unique index if not exists evaluations_tutor_center_unique on public.evaluations (tutor_id, center_id) where tutor_id is not null and center_id is not null;

drop trigger if exists evaluations_updated_at on public.evaluations;
create trigger evaluations_updated_at
before update on public.evaluations
for each row
execute procedure public.set_updated_at();

create table if not exists public.evaluation_responses (
  id uuid not null default uuid_generate_v4(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  question_id text null,
  response jsonb null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint evaluation_responses_pkey primary key (id)
);

drop trigger if exists evaluation_responses_updated_at on public.evaluation_responses;
create trigger evaluation_responses_updated_at
before update on public.evaluation_responses
for each row
execute procedure public.set_updated_at();
