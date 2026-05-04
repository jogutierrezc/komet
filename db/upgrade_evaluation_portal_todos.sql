    -- Script para habilitar el uso de target_type = 'Todos' en el portal público de evaluaciones.
    -- Incluye el filtro que permite que cualquier evaluador acceda a encuestas marcadas como "Todos".
    -- Además, solo se mostrarán encuestas del mismo campus del evaluador.

        alter table if exists public.evaluations
            add column if not exists evaluator_user_id uuid,
            add column if not exists evaluator_role text;

        update public.evaluations
        set
            evaluator_user_id = coalesce(evaluator_user_id, student_id, tutor_id),
            evaluator_role = coalesce(
                nullif(lower(evaluator_role), ''),
                case
                    when student_id is not null then 'student'
                    when tutor_id is not null then 'professor'
                    else nullif(lower(coalesce(estado, dirigidoA, tipoPrograma)), '')
                end
            )
        where evaluator_user_id is null or evaluator_role is null or evaluator_role = '';

        create unique index if not exists evaluations_evaluator_role_center_unique
            on public.evaluations (evaluator_user_id, lower(evaluator_role), center_id)
            where evaluator_user_id is not null and evaluator_role is not null and center_id is not null;

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
    where s.campus_id = u.campus_id
      and not exists (
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
