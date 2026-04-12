-- 조직
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- 사용자 프로필 (Supabase Auth 확장)
create table profiles (
  id uuid primary key references auth.users(id),
  email text not null,
  name text not null,
  role text not null check (role in ('agent', 'admin')),
  organization_id uuid references organizations(id),
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz default now()
);

-- 시험 결과
create table exam_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  exam_type text not null,
  score integer not null,
  total integer not null,
  correct integer not null,
  wrong_question_ids integer[],
  elapsed_seconds integer not null,
  results jsonb,
  created_at timestamptz default now()
);

-- 인덱스
create index idx_exam_results_user_id on exam_results(user_id);
create index idx_exam_results_created_at on exam_results(created_at desc);
create index idx_profiles_org_id on profiles(organization_id);

-- RLS 활성화
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table exam_results enable row level security;

-- === profiles 테이블 RLS ===

create policy "profiles_select" on profiles
  for select using (
    id = auth.uid() or
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = profiles.organization_id
    )
  );

create policy "profiles_update" on profiles
  for update using (
    id = auth.uid() or
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = profiles.organization_id
    )
  );

-- === organizations 테이블 RLS ===

create policy "org_select" on organizations
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.organization_id = organizations.id
    )
  );

create policy "org_update_admin" on organizations
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = organizations.id
    )
  );

-- === exam_results 테이블 RLS ===

create policy "agents_own_results" on exam_results
  for all using (auth.uid() = user_id);

create policy "admins_read_org_results" on exam_results
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = (
          select organization_id from profiles where id = exam_results.user_id
        )
    )
  );

-- === Auth Trigger: 가입 시 자동 프로필 생성 ===

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, name, role, organization_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'agent'),
    (new.raw_user_meta_data->>'organization_id')::uuid
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
