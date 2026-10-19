-- Shareable SM64 Web saves. Run this migration in the Supabase SQL editor.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.sm64web_saves (
  code text primary key check (code ~ '^[0-9]{10}$'),
  data text not null check (length(data) = 1024 and data ~ '^[0-9a-fA-F]{1024}$'),
  active_slot integer not null default 1 check (active_slot between 1 and 4),
  created_at timestamptz not null default now()
);

alter table public.sm64web_saves enable row level security;
revoke all on table public.sm64web_saves from anon, authenticated, public;

create or replace function public.sm64web_save_create(p_data text, p_active_slot integer default 1)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_bytes bytea;
  v_number numeric;
  v_code text;
  v_inserted integer;
begin
  if p_data is null or length(p_data) <> 1024 or p_data !~ '^[0-9a-fA-F]{1024}$' then
    raise exception 'Invalid save data';
  end if;
  if p_active_slot is null or p_active_slot < 1 or p_active_slot > 4 then
    raise exception 'Invalid save slot';
  end if;

  loop
    v_bytes := gen_random_bytes(5);
    v_number := mod(
      get_byte(v_bytes, 0)::numeric * 4294967296 +
      get_byte(v_bytes, 1)::numeric * 16777216 +
      get_byte(v_bytes, 2)::numeric * 65536 +
      get_byte(v_bytes, 3)::numeric * 256 +
      get_byte(v_bytes, 4)::numeric,
      10000000000
    );
    v_code := lpad(v_number::bigint::text, 10, '0');
    insert into public.sm64web_saves(code, data, active_slot)
      values (v_code, lower(p_data), p_active_slot)
      on conflict (code) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then
      return v_code;
    end if;
  end loop;
end;
$$;

create or replace function public.sm64web_save_load(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_save public.sm64web_saves%rowtype;
begin
  if p_code is null or p_code !~ '^[0-9]{10}$' then
    return null;
  end if;

  select * into v_save
    from public.sm64web_saves
    where code = p_code;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'format', 'sm64web-save-v1',
    'data', v_save.data,
    'activeSlot', v_save.active_slot,
    'createdAt', v_save.created_at
  );
end;
$$;

revoke all on function public.sm64web_save_create(text, integer) from public;
revoke all on function public.sm64web_save_load(text) from public;
grant execute on function public.sm64web_save_create(text, integer) to anon, authenticated;
grant execute on function public.sm64web_save_load(text) to anon, authenticated;
