-- Funciones, RLS y políticas extraídas del proyecto original (brzcoaaekyzcuavysgdz).
-- Funciones

CREATE OR REPLACE FUNCTION public.get_evaluation_by_token(p_token uuid)
 RETURNS TABLE(evaluation_id uuid, status text, survey_title text, survey_description text, survey_questions jsonb, campus_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        e.id AS evaluation_id,
        e.status,
        s.title AS survey_title,
        s.description AS survey_description,
        s.questions AS survey_questions,
        c.name AS campus_name
    FROM public.evaluations e
    JOIN public.surveys s ON e.survey_id = s.id
    JOIN public.campuses c ON e.campus_id = c.id
    WHERE e.share_token = p_token AND (e.expires_at IS NULL OR e.expires_at > now());
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_user_campus()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  SELECT campus_id FROM public.profiles WHERE id = auth.uid();
$function$
;
CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$function$
;
CREATE OR REPLACE FUNCTION public.submit_evaluation_response(p_token uuid, p_answers jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_eval_id UUID;
    v_status TEXT;
BEGIN
    -- 1. Buscar la evaluación por el token
    SELECT id, status INTO v_eval_id, v_status
    FROM public.evaluations
    WHERE share_token = p_token AND (expires_at IS NULL OR expires_at > now());

    -- 2. Verificar si existe y está pendiente
    IF v_eval_id IS NULL THEN
        RAISE EXCEPTION 'Evaluación no encontrada o expirada.';
    END IF;

    IF v_status != 'pending' THEN
        RAISE EXCEPTION 'Esta evaluación ya ha sido completada.';
    END IF;

    -- 3. Insertar la respuesta
    INSERT INTO public.evaluation_responses (evaluation_id, answers)
    VALUES (v_eval_id, p_answers);

    -- 4. Actualizar el estado de la evaluación a 'completed'
    UPDATE public.evaluations
    SET status = 'completed', completed_at = now()
    WHERE id = v_eval_id;

    RETURN TRUE;
END;
$function$
;
-- Row Level Security
alter table public.campuses enable row level security;
alter table public.convenios enable row level security;
alter table public.email_delivery_log enable row level security;
alter table public.evaluation_responses enable row level security;
alter table public.evaluations enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.surveys enable row level security;
alter table public.tutors enable row level security;
-- Políticas
drop policy if exists "Acceso total campuses" on public.campuses;
create policy "Acceso total campuses" on public.campuses as PERMISSIVE for ALL to public using (true);
drop policy if exists "Admin puede modificar campus" on public.campuses;
create policy "Admin puede modificar campus" on public.campuses as PERMISSIVE for ALL to authenticated using ((get_user_role() = 'admin'::text));
drop policy if exists "Acceso total convenios" on public.convenios;
create policy "Acceso total convenios" on public.convenios as PERMISSIVE for ALL to public using (true);
drop policy if exists email_delivery_log_service_role_all on public.email_delivery_log;
create policy email_delivery_log_service_role_all on public.email_delivery_log as PERMISSIVE for ALL to service_role using (true) with check (true);
drop policy if exists "Acceso total responses" on public.evaluation_responses;
create policy "Acceso total responses" on public.evaluation_responses as PERMISSIVE for ALL to public using (true);
drop policy if exists "Acceso total evaluations" on public.evaluations;
create policy "Acceso total evaluations" on public.evaluations as PERMISSIVE for ALL to public using (true);
drop policy if exists "Admin gestiona perfiles" on public.profiles;
create policy "Admin gestiona perfiles" on public.profiles as PERMISSIVE for ALL to authenticated using ((get_user_role() = 'admin'::text));
drop policy if exists "Usuario ve su perfil" on public.profiles;
create policy "Usuario ve su perfil" on public.profiles as PERMISSIVE for SELECT to public using ((id = auth.uid()));
drop policy if exists "Acceso total estudiantes" on public.students;
create policy "Acceso total estudiantes" on public.students as PERMISSIVE for ALL to public using (true);
drop policy if exists "Acceso total surveys" on public.surveys;
create policy "Acceso total surveys" on public.surveys as PERMISSIVE for ALL to public using (true);
drop policy if exists "Acceso total tutores" on public.tutors;
create policy "Acceso total tutores" on public.tutors as PERMISSIVE for ALL to public using (true);
