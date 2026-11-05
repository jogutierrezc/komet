-- Tablas base RECONSTRUIDAS a partir del uso en db/*.sql y src/ (no es un dump del original).
-- Ejecutar antes que el resto de los scripts de db/.
create extension if not exists "uuid-ossp";

create table if not exists public.campuses (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.convenios (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text,
  address text,
  photo_url text,
  status text not null default 'activo',
  campus_id uuid references public.campuses(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  email text,
  program text,
  status text default 'En Práctica',
  started text,
  academic_code text,
  document_number text,
  campus_id uuid references public.campuses(id) on delete set null,
  convenio_id uuid references public.convenios(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tutors (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  email text,
  specialty text,
  status text default 'activo',
  document_number text,
  campus_id uuid references public.campuses(id) on delete set null,
  convenio_id uuid references public.convenios(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  email text,
  role text,
  status text default 'activo',
  created_at timestamptz not null default timezone('utc', now())
);
