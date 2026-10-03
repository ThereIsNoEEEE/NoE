-- KMU Pick AI — Supabase 스키마 (데모용)
-- 회원가입/로그인은 구현하지 않으며 demo user 고정 id를 사용한다.

create table if not exists user_profiles (
  id text primary key,
  student_type text,
  school text,
  major text,
  grade text,
  keywords text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists user_interests (
  id bigint generated always as identity primary key,
  user_id text not null,
  interest_name text not null,
  is_custom boolean default true,
  created_at timestamptz default now(),
  unique (user_id, interest_name)
);

-- (선택, P1) 검색 기록
create table if not exists search_history (
  id bigint generated always as identity primary key,
  user_id text not null,
  query text,
  parsed_intent jsonb,
  created_at timestamptz default now()
);

-- 데모 편의를 위한 RLS 비활성 (실서비스에서는 반드시 정책 설정)
alter table user_profiles disable row level security;
alter table user_interests disable row level security;
alter table search_history disable row level security;
