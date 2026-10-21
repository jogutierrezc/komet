-- Períodos de evaluación: abrir, cerrar y conservar el histórico.
--
-- Modelo
--   evaluation_periods   un período (código tipo 2026-A). Solo uno puede estar abierto a la vez.
--   surveys.period_id    cada formulario pertenece a UN período. Al abrir un período nuevo, los formularios
--                        elegidos se COPIAN: los del período anterior quedan congelados con sus respuestas.
--   surveys.family_id    enlaza las copias de un mismo formulario entre períodos; el enlace público sigue
--                        siendo el mismo porque el portal lo resuelve a la copia del período abierto.
--   evaluations.period_id período de cada respuesta.
--
-- Idempotente: se puede ejecutar más de una vez. Ejecutar completo en el SQL Editor de Supabase.

create extension if not exists "uuid-ossp";

-- 1) Tabla de períodos --------------------------------------------------------------------------
create table if not exists public.evaluation_periods (
  id uuid not null default uuid_generate_v4(),
  code text not null,
  name text null,
  starts_on date not null default current_date,
  ends_on date null,
  status text not null default 'abierto',
  notes text null,
  summary jsonb null,
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint evaluation_periods_pkey primary key (id),
  constraint evaluation_periods_code_key unique (code),
  constraint evaluation_periods_status_check check (status in ('abierto', 'cerrado')),
  constraint evaluation_periods_dates_check check (ends_on is null or ends_on >= starts_on)
);

-- Solo un período abierto a la vez.
create unique index if not exists evaluation_periods_single_open
  on public.evaluation_periods ((true)) where status = 'abierto';

drop trigger if exists evaluation_periods_updated_at on public.evaluation_periods;
create trigger evaluation_periods_updated_at
before update on public.evaluation_periods
for each row execute procedure public.set_updated_at();

-- 2) Columnas nuevas ----------------------------------------------------------------------------
alter table public.surveys
  add column if not exists period_id uuid references public.evaluation_periods(id) on delete restrict,
  add column if not exists family_id uuid;

alter table public.evaluations
  add column if not exists period_id uuid references public.evaluation_periods(id) on delete restrict;

create index if not exists surveys_period_id_idx on public.surveys (period_id);
create index if not exists surveys_family_id_idx on public.surveys (family_id);
create index if not exists evaluations_period_id_idx on public.evaluations (period_id);

-- 3) Datos existentes: el período actual queda abierto y los anteriores cerrados -------------------
do $$
declare
  period_col text;
  current_code text := to_char(current_date, 'YYYY') || '-' || case when extract(month from current_date) <= 6 then 'A' else 'B' end;
  current_id uuid;
begin
  -- La columna puede llamarse periodoCorte o periodocorte según cómo se creó la tabla.
  select column_name into period_col
  from information_schema.columns
  where table_schema = 'public' and table_name = 'evaluations' and lower(column_name) = 'periodocorte'
  limit 1;

  if period_col is not null then
    execute format($f$
      insert into public.evaluation_periods (code, starts_on, ends_on, status, opened_at, closed_at)
      select distinct
        %1$I,
        make_date(substr(%1$I, 1, 4)::int, case right(%1$I, 1) when 'A' then 1 else 7 end, 1),
        make_date(substr(%1$I, 1, 4)::int, case right(%1$I, 1) when 'A' then 6 else 12 end, case right(%1$I, 1) when 'A' then 30 else 31 end),
        'cerrado', now(), now()
      from public.evaluations
      where %1$I ~ '^[0-9]{4}-[AB]$' and %1$I <> %2$L
      on conflict (code) do nothing
    $f$, period_col, current_code);
  end if;

  insert into public.evaluation_periods (code, starts_on, ends_on, status)
  values (
    current_code,
    make_date(extract(year from current_date)::int, case when extract(month from current_date) <= 6 then 1 else 7 end, 1),
    make_date(extract(year from current_date)::int, case when extract(month from current_date) <= 6 then 6 else 12 end, case when extract(month from current_date) <= 6 then 30 else 31 end),
    'abierto'
  )
  on conflict (code) do nothing;

  -- Si no hay ninguno abierto (p. ej. el actual ya existía cerrado), se abre el actual.
  if not exists (select 1 from public.evaluation_periods where status = 'abierto') then
    update public.evaluation_periods set status = 'abierto', closed_at = null where code = current_code;
  end if;

  select id into current_id from public.evaluation_periods where status = 'abierto' limit 1;

  update public.surveys set family_id = id where family_id is null;
  update public.surveys set period_id = current_id where period_id is null;

  if period_col is not null then
    execute format($f$
      update public.evaluations ev set period_id = p.id
      from public.evaluation_periods p
      where ev.period_id is null and p.code = ev.%I
    $f$, period_col);
  end if;
  -- Respuestas sin código de período válido: se asignan al período de su formulario.
  update public.evaluations ev set period_id = s.period_id
  from public.surveys s
  where ev.period_id is null and ev.survey_id = s.id;
end
$$;

-- 4) Reglas automáticas (valen también para clientes que no conocen los períodos) ----------------
create or replace function public.surveys_before_insert()
returns trigger language plpgsql as $$
begin
  new.family_id := coalesce(new.family_id, new.id);
  if new.period_id is null then
    select id into new.period_id from public.evaluation_periods where status = 'abierto' limit 1;
  end if;
  return new;
end
$$;

drop trigger if exists surveys_before_insert on public.surveys;
create trigger surveys_before_insert
before insert on public.surveys
for each row execute procedure public.surveys_before_insert();

-- Un formulario de un período cerrado es histórico: no se edita ni se borra.
create or replace function public.surveys_guard_closed()
returns trigger language plpgsql as $$
declare
  closed boolean;
begin
  select (status = 'cerrado') into closed from public.evaluation_periods where id = old.period_id;
  if coalesce(closed, false) then
    raise exception 'El formulario pertenece a un período cerrado y no se puede modificar.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

drop trigger if exists surveys_guard_closed on public.surveys;
create trigger surveys_guard_closed
before update or delete on public.surveys
for each row execute procedure public.surveys_guard_closed();

-- Cada respuesta se guarda en el período de su formulario, y un período cerrado no recibe respuestas.
create or replace function public.evaluations_before_insert()
returns trigger language plpgsql as $$
declare
  period_status text;
begin
  if new.period_id is null and new.survey_id is not null then
    select period_id into new.period_id from public.surveys where id = new.survey_id;
  end if;
  if new.period_id is null then
    select id into new.period_id from public.evaluation_periods where status = 'abierto' limit 1;
  end if;
  select status into period_status from public.evaluation_periods where id = new.period_id;
  if period_status = 'cerrado' then
    raise exception 'El período de evaluación está cerrado.' using errcode = 'P0001';
  end if;
  return new;
end
$$;

drop trigger if exists evaluations_before_insert on public.evaluations;
create trigger evaluations_before_insert
before insert on public.evaluations
for each row execute procedure public.evaluations_before_insert();

-- 5) Una evaluación por rol y sitio, pero POR PERÍODO (antes un período nuevo chocaba con estas reglas) -----
drop index if exists public.evaluations_student_center_unique;
drop index if exists public.evaluations_tutor_center_unique;
drop index if exists public.evaluations_evaluator_role_center_unique;

create unique index if not exists evaluations_student_center_period_unique
  on public.evaluations (period_id, student_id, center_id)
  where student_id is not null and center_id is not null;

create unique index if not exists evaluations_tutor_center_period_unique
  on public.evaluations (period_id, tutor_id, center_id)
  where tutor_id is not null and center_id is not null;

create unique index if not exists evaluations_evaluator_role_center_period_unique
  on public.evaluations (period_id, evaluator_user_id, lower(evaluator_role), center_id)
  where evaluator_user_id is not null and evaluator_role is not null and center_id is not null;

-- 6) Cerrar y abrir períodos (atómico) ------------------------------------------------------------
create or replace function public.close_evaluation_period(p_id uuid)
returns jsonb language plpgsql as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'evaluaciones', count(*),
    'completadas', count(*) filter (where lower(coalesce(status, '')) in ('completada', 'completed')),
    'sitios', count(distinct center_id),
    'formularios', (select count(*) from public.surveys where period_id = p_id)
  ) into result
  from public.evaluations where period_id = p_id;

  update public.evaluation_periods
  set status = 'cerrado', closed_at = now(), ends_on = coalesce(ends_on, current_date), summary = result
  where id = p_id and status = 'abierto';

  return result;
end
$$;

-- Cierra el período abierto (si hay), crea el nuevo y copia los formularios elegidos.
create or replace function public.open_evaluation_period(
  p_code text,
  p_starts_on date,
  p_ends_on date,
  p_survey_ids uuid[],
  p_name text default null,
  p_notes text default null
)
returns uuid language plpgsql as $$
declare
  open_id uuid;
  new_id uuid;
  letter text;
begin
  if coalesce(trim(p_code), '') = '' then
    raise exception 'Falta el código del período.';
  end if;
  if exists (select 1 from public.evaluation_periods where code = trim(p_code)) then
    raise exception 'Ya existe un período con el código %.', trim(p_code);
  end if;

  select id into open_id from public.evaluation_periods where status = 'abierto' for update;
  if open_id is not null then
    perform public.close_evaluation_period(open_id);
  end if;

  insert into public.evaluation_periods (code, name, starts_on, ends_on, notes, status)
  values (trim(p_code), p_name, coalesce(p_starts_on, current_date), p_ends_on, p_notes, 'abierto')
  returning id into new_id;

  -- Para códigos 2026-A / 2026-B, la copia actualiza el "Período: A" que lleva su descripción.
  letter := case when trim(p_code) ~ '^[0-9]{4}-[AB]$' then right(trim(p_code), 1) else null end;

  insert into public.surveys (title, description, target_type, questions, campus_id, estado, period_id, family_id)
  select
    s.title,
    case when letter is not null and s.description ~* 'Per[ií]odo:' then regexp_replace(s.description, 'Per[ií]odo:\s*.+$', 'Período: ' || letter, 'i') else s.description end,
    s.target_type,
    s.questions,
    s.campus_id,
    coalesce(s.estado, 'activo'),
    new_id,
    coalesce(s.family_id, s.id)
  from public.surveys s
  where s.id = any(coalesce(p_survey_ids, '{}'::uuid[]));

  return new_id;
end
$$;

-- Conteos por período para la pantalla de históricos.
create or replace view public.evaluation_period_stats as
select
  p.id as period_id,
  count(ev.id) as evaluaciones,
  count(ev.id) filter (where lower(coalesce(ev.status, '')) in ('completada', 'completed')) as completadas,
  count(distinct ev.center_id) as sitios,
  (select count(*) from public.surveys s where s.period_id = p.id) as formularios
from public.evaluation_periods p
left join public.evaluations ev on ev.period_id = p.id
group by p.id;

-- 7) Portal: solo formularios del período abierto, y "ya respondió" se mide dentro del período ----------
create or replace view public.active_surveys as
select *
from public.surveys
where lower(coalesce(estado, 'activo')) in ('active', 'activo', 'published', 'publicado');

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
      or (u.role not in ('student', 'professor') and lower(s.target_type) = lower(u.role))
  )
  join public.evaluation_periods p on p.id = s.period_id and p.status = 'abierto'
  left join public.campuses c on c.id = s.campus_id
  where
    (s.campus_id = u.campus_id or s.campus_id is null)
    and not exists (
      select 1
      from public.evaluations ev
      where ev.period_id = s.period_id
        and ev.center_id = coalesce(practice_center_id, u.practice_center_id)
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
    join public.surveys sv on sv.id = portal_user_has_completed.survey_id
    join public.evaluations ev on ev.period_id = sv.period_id
    where ev.center_id = coalesce(practice_center_id, u.practice_center_id)
      and (
        ev.evaluator_user_id = u.user_id
        or (u.role = 'student' and ev.student_id = u.user_id)
        or (u.role = 'professor' and ev.tutor_id = u.user_id)
      )
  );
$portal_user_has_completed$;
