create schema if not exists patientdz_db;
set search_path to patientdz_db;

create extension if not exists "pgcrypto";

-- Profiles: mirrors Supabase auth.users
create table if not exists profiles (
  id uuid primary key,
  name text not null,
  phone text unique not null,
  role text not null check (role in ('patient','doctor','admin')),
  verified boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists doctors (
  id uuid primary key references profiles(id),
  specialty text,
  clinic text,
  bio text,
  rating numeric,
  pricing_da integer default 0
);

create table if not exists patients (
  id uuid primary key references profiles(id),
  patient_code text,
  location text
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  doctor_id uuid references doctors(id),
  starts_at timestamp with time zone,
  status text check (status in ('pending','confirmed','rejected','cancelled')) default 'pending',
  message text,
  created_at timestamp with time zone default now()
);

create table if not exists records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id),
  doctor_id uuid references doctors(id),
  diagnosis text,
  prescription text,
  notes text,
  created_at timestamp with time zone default now()
);

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references records(id),
  file_url text,
  file_type text,
  uploaded_at timestamp with time zone default now()
);

create table if not exists doctor_questions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references doctors(id),
  question text not null,
  active boolean default true,
  created_at timestamp with time zone default now()
);
