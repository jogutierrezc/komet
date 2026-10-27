-- Rendimiento: índices para las consultas de los módulos y conteo de evaluaciones por sitio en la base de datos.
-- Idempotente. Ejecutar en el SQL Editor de Supabase. Es seguro hacerlo con la aplicación en uso.

-- 1) Índices -------------------------------------------------------------------------------------
-- Las respuestas se buscan siempre por evaluación (reportes, estadística, presentaciones).
create index if not exists evaluation_responses_evaluation_id_idx on public.evaluation_responses (evaluation_id);

-- Filtros y uniones frecuentes sobre evaluaciones.
create index if not exists evaluations_center_id_idx on public.evaluations (center_id);
create index if not exists evaluations_campus_id_idx on public.evaluations (campus_id);
create index if not exists evaluations_survey_id_idx on public.evaluations (survey_id);

-- Paginación ordenada por fecha (ya existía; se conserva por si falta).
create index if not exists evaluations_paginate_idx on public.evaluations (created_at desc, id desc);

-- Listas de estudiantes y profesores por sitio.
create index if not exists students_convenio_id_idx on public.students (convenio_id);
create index if not exists tutors_convenio_id_idx on public.tutors (convenio_id);
create index if not exists convenios_campus_id_idx on public.convenios (campus_id);

-- 2) Conteo de evaluaciones por sitio y rol ---------------------------------------------------------
-- La lista de Sitios de práctica lo usa en una sola consulta (antes eran decenas, una por sitio).
-- La columna dirigidoA puede estar en mayúsculas o minúsculas según cómo se creó la tabla: se lee de ambas formas.
create or replace view public.evaluation_center_summary as
select
  ev.center_id,
  count(*) filter (where ev.student_id is not null) as student,
  count(*) filter (where ev.student_id is null and ev.tutor_id is not null) as professor,
  count(*) filter (
    where ev.student_id is null and ev.tutor_id is null
      and lower(coalesce(to_jsonb(ev)->>'dirigidoA', to_jsonb(ev)->>'dirigidoa', ev.estado, '')) like '%coordinador%'
  ) as coordinator
from public.evaluations ev
where ev.center_id is not null
group by ev.center_id;
