-- Script para crear configuración global del sistema y habilitar guardado de valores persistentes.
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

create table if not exists public.system_settings (
  id uuid not null default uuid_generate_v4(),
  config_key text not null,
  config_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint system_settings_pkey primary key (id),
  constraint system_settings_config_key_unique unique (config_key)
);

drop trigger if exists system_settings_updated_at on public.system_settings;
create trigger system_settings_updated_at
before update on public.system_settings
for each row
execute procedure public.set_updated_at();

create table if not exists public.api_integrations (
  id uuid not null default uuid_generate_v4(),
  name text not null,
  provider text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint api_integrations_pkey primary key (id),
  constraint api_integrations_name_key unique (name)
);

drop trigger if exists api_integrations_updated_at on public.api_integrations;
create trigger api_integrations_updated_at
before update on public.api_integrations
for each row
execute procedure public.set_updated_at();

create table if not exists public.email_templates (
  id uuid not null default uuid_generate_v4(),
  template_key text not null,
  subject text not null,
  body text not null,
  description text null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint email_templates_pkey primary key (id),
  constraint email_templates_key_unique unique (template_key)
);

drop trigger if exists email_templates_updated_at on public.email_templates;
create trigger email_templates_updated_at
before update on public.email_templates
for each row
execute procedure public.set_updated_at();
