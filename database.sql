create schema if not exists patientdz_db;
set search_path to patientdz_db;

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique not null,
  password_hash text not null,
  role text not null check (role in ('patient', 'doctor', 'admin')),
  verified boolean default false,
  created_at timestamp with time zone default now()
);
