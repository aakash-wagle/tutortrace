-- StudyHub Supabase Schema
-- Run in Supabase SQL Editor: https://app.supabase.com/project/_/editor
-- All tables use user_id for RLS. Server routes use SUPABASE_SERVICE_ROLE_KEY.

-- ── Users ────────────────────────────────────────────────────────────────────

create table if not exists public.users (
  id text primary key,              -- canvas user id
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Gamification (singleton per user) ────────────────────────────────────────

create table if not exists public.gamification (
  user_id text primary key references public.users(id) on delete cascade,
  xp integer not null default 0,
  level integer not null default 1,
  coins integer not null default 100,
  streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date,
  updated_at timestamptz default now()
);

-- ── Badges ────────────────────────────────────────────────────────────────────

create table if not exists public.badges (
  id text not null,                  -- badge type slug (e.g. 'streak_7')
  user_id text not null references public.users(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (id, user_id)
);

-- ── Activity Log ──────────────────────────────────────────────────────────────

create table if not exists public.activity_log (
  id bigserial primary key,
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  activity_type text not null,       -- 'flashcard_review' | 'assignment_view' | 'login' | etc.
  bloom_level text,                  -- 'knowledge' | 'comprehension' | ... (nullable)
  xp_earned integer not null default 0,
  created_at timestamptz default now()
);
create index if not exists activity_log_user_date on public.activity_log (user_id, date);

-- ── XP Events ────────────────────────────────────────────────────────────────

create table if not exists public.xp_events (
  id bigserial primary key,
  user_id text not null references public.users(id) on delete cascade,
  source text not null,              -- 'FLASHCARD_REVIEW' | 'STREAK_DAILY' | etc.
  amount integer not null,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists xp_events_user_created on public.xp_events (user_id, created_at);

-- ── Flashcard Decks ───────────────────────────────────────────────────────────

create table if not exists public.flashcard_decks (
  id text primary key,               -- cuid from Prisma
  user_id text not null references public.users(id) on delete cascade,
  title text not null,
  course_id bigint,
  card_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Flashcards ────────────────────────────────────────────────────────────────

create table if not exists public.flashcards (
  id text primary key,
  deck_id text not null references public.flashcard_decks(id) on delete cascade,
  front text not null,
  back text not null,
  hint text,
  difficulty text not null default 'medium',
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  last_reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- ── Commitments (accountability monitors) ────────────────────────────────────

create table if not exists public.commitments (
  user_id text primary key references public.users(id) on delete cascade,
  monitor_name text not null,
  monitor_email text not null,
  pledge text not null,
  created_at timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Note: For hackathon, use service_role key server-side (bypasses RLS).
-- These policies allow future client-side access.

alter table public.users enable row level security;
alter table public.gamification enable row level security;
alter table public.badges enable row level security;
alter table public.activity_log enable row level security;
alter table public.xp_events enable row level security;
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.commitments enable row level security;

-- Placeholder policies (replace 'your-auth-uid' with actual auth logic for prod)
-- For hackathon: use service_role key on server — no client-side Supabase auth needed.
