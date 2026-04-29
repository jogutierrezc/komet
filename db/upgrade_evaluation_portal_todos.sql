    -- Script para habilitar el uso de target_type = 'Todos' en el portal público de evaluaciones.
    -- Incluye el filtro que permite que cualquier evaluador acceda a encuestas marcadas como "Todos".
    -- Además, solo se mostrarán encuestas del mismo campus del evaluador.

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
        (u.role = 'student' and ev.student_id = u.user_id)
        or (u.role = 'professor' and ev.tutor_id = u.user_id)
        )
    );
    $portal_active_surveys$;
