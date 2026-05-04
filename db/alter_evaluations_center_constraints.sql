-- Mejora de esquema de evaluaciones: referencias y control de unicidad por centro.
create extension if not exists "uuid-ossp";

-- Asegura columnas existentes si la tabla viene de un esquema anterior.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evaluations'
      AND column_name = 'student_id'
  ) THEN
    ALTER TABLE public.evaluations ADD COLUMN student_id uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evaluations'
      AND column_name = 'tutor_id'
  ) THEN
    ALTER TABLE public.evaluations ADD COLUMN tutor_id uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evaluations'
      AND column_name = 'center_id'
  ) THEN
    ALTER TABLE public.evaluations ADD COLUMN center_id uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evaluations'
      AND column_name = 'evaluator_user_id'
  ) THEN
    ALTER TABLE public.evaluations ADD COLUMN evaluator_user_id uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evaluations'
      AND column_name = 'evaluator_role'
  ) THEN
    ALTER TABLE public.evaluations ADD COLUMN evaluator_role text NULL;
  END IF;
END
$$;

-- Agrega llaves foráneas para mantener integridad referencial.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evaluations_student_id_fkey'
      AND conrelid = 'public.evaluations'::regclass
  ) THEN
    ALTER TABLE public.evaluations
      ADD CONSTRAINT evaluations_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evaluations_tutor_id_fkey'
      AND conrelid = 'public.evaluations'::regclass
  ) THEN
    ALTER TABLE public.evaluations
      ADD CONSTRAINT evaluations_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.tutors(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evaluations_center_id_fkey'
      AND conrelid = 'public.evaluations'::regclass
  ) THEN
    ALTER TABLE public.evaluations
      ADD CONSTRAINT evaluations_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.convenios(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- Unicidad: un estudiante/profesor sólo puede evaluar un mismo centro una vez.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relname = 'evaluations_student_center_unique'
  ) THEN
    CREATE UNIQUE INDEX evaluations_student_center_unique
      ON public.evaluations (student_id, center_id)
      WHERE student_id IS NOT NULL AND center_id IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relname = 'evaluations_tutor_center_unique'
  ) THEN
    CREATE UNIQUE INDEX evaluations_tutor_center_unique
      ON public.evaluations (tutor_id, center_id)
      WHERE tutor_id IS NOT NULL AND center_id IS NOT NULL;
  END IF;

  UPDATE public.evaluations
  SET
    evaluator_user_id = COALESCE(evaluator_user_id, student_id, tutor_id),
    evaluator_role = COALESCE(
      NULLIF(lower(evaluator_role), ''),
      CASE
        WHEN student_id IS NOT NULL THEN 'student'
        WHEN tutor_id IS NOT NULL THEN 'professor'
        ELSE NULLIF(lower(coalesce(estado, dirigidoA, tipoPrograma)), '')
      END
    )
  WHERE evaluator_user_id IS NULL OR evaluator_role IS NULL OR evaluator_role = '';

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relname = 'evaluations_evaluator_role_center_unique'
  ) THEN
    CREATE UNIQUE INDEX evaluations_evaluator_role_center_unique
      ON public.evaluations (evaluator_user_id, lower(evaluator_role), center_id)
      WHERE evaluator_user_id IS NOT NULL AND evaluator_role IS NOT NULL AND center_id IS NOT NULL;
  END IF;
END
$$;

-- Ajusta las funciones del portal para considerar el centro seleccionado al consultar encuestas activas.
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
