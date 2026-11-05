-- Alinea el esquema con el proyecto original: columnas camelCase en evaluations
-- y estructura real de evaluation_responses (answers/submitted_at/ip_address).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='evaluations' and column_name='dirigidoa') then
    alter table public.evaluations rename column dirigidoa to "dirigidoA"; end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='evaluations' and column_name='periodocorte') then
    alter table public.evaluations rename column periodocorte to "periodoCorte"; end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='evaluations' and column_name='tipoprograma') then
    alter table public.evaluations rename column tipoprograma to "tipoPrograma"; end if;
end $$;

alter table public.evaluation_responses
  add column if not exists answers jsonb,
  add column if not exists submitted_at timestamptz,
  add column if not exists ip_address text;

-- En producción evaluation_responses solo tiene: id, evaluation_id, answers, submitted_at, ip_address
drop trigger if exists evaluation_responses_updated_at on public.evaluation_responses;
alter table public.evaluation_responses
  drop column if exists question_id,
  drop column if exists response,
  drop column if exists created_at,
  drop column if exists updated_at;
