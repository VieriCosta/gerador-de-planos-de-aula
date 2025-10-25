create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz default now()
);

create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tema text not null,
  etapa_ano text not null,
  componente_curricular text not null,
  tempo_estimado_minutes int,
  recursos text[],
  nivel_turma text,
  tom_estilo text,
  inputs_json jsonb not null,
  output_json jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_lesson_plans_user_id on public.lesson_plans(user_id);
create index if not exists idx_lesson_plans_created_at on public.lesson_plans(created_at desc);

alter table public.lesson_plans enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lesson_plans' and policyname='select_own_lesson_plans') then
    create policy select_own_lesson_plans on public.lesson_plans
      for select using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lesson_plans' and policyname='insert_own_lesson_plans') then
    create policy insert_own_lesson_plans on public.lesson_plans
      for insert with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lesson_plans' and policyname='update_own_lesson_plans') then
    create policy update_own_lesson_plans on public.lesson_plans
      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lesson_plans' and policyname='delete_own_lesson_plans') then
    create policy delete_own_lesson_plans on public.lesson_plans
      for delete using (user_id = auth.uid());
  end if;
end$$;
