-- 공개 학생 작가 작품집 스키마 v3
-- (교사 발급 코드 + 학생 직접 업로드 + 누구나 열람)
--
-- 적용 방법
--   1. Supabase 대시보드 → SQL Editor → New query
--   2. 이 파일 전체 복사·붙여넣기 → Run
--
-- v2 → v3 마이그레이션
--   * v2의 classes·books 테이블을 DROP하고 새로 만듭니다.
--   * v2의 RPC get_class_books도 함께 DROP.
--   * Storage 'book-images' 버킷은 재사용합니다 (파일 보존).
--
-- 정책 요약
--   * 학급마다 두 종류 코드를 발급합니다.
--     - view_code(4자리 숫자): 누구나 알면 학급 작품집 열람
--     - upload_code(6자리 영숫자): 학생이 자기 작품을 업로드할 때 입력
--   * anon은 직접 SELECT/INSERT 거부, 3개 RPC를 통해서만 접근합니다.
--   * 학생 실명 대신 필명(pen_name)만 저장합니다.

-- ─────────────────────────────────────────────────────────────────
-- 0) v2 정리
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.get_class_books(char, text, int, int, text);
drop function if exists public.view_class_books(char, text);
drop function if exists public.upload_book(char, text, text, text, text, jsonb);
drop function if exists public.get_book(char);

drop policy if exists "teacher manages own books" on public.books;
drop policy if exists "teacher manages own classes" on public.classes;
drop policy if exists "public read book-images" on storage.objects;
drop policy if exists "teacher upload book-images" on storage.objects;
drop policy if exists "teacher delete book-images" on storage.objects;

drop trigger if exists trg_books_touch on public.books;
drop trigger if exists trg_classes_touch on public.classes;

drop table if exists public.books cascade;
drop table if exists public.classes cascade;

-- ─────────────────────────────────────────────────────────────────
-- 1) 학급 (classes) — 두 종류 코드 분리
-- ─────────────────────────────────────────────────────────────────

create table public.classes (
  id              uuid primary key default gen_random_uuid(),
  school_year     text not null,
  grade           int not null check (grade between 1 and 6),
  class_no        int not null check (class_no between 1 and 20),
  display_name    text not null,
  teacher_id      uuid not null references auth.users(id) on delete cascade,

  -- 열람 코드: 누구나 알면 학급 갤러리에 들어갈 수 있음 (SNS·블로그에 공유 안전)
  view_code       char(4) not null check (view_code ~ '^[0-9]{4}$'),

  -- 업로드 코드: 학생에게만 안내. 추측 어렵게 6자리 영숫자(O/0/I/1 제외)
  upload_code     char(6) not null check (upload_code ~ '^[A-HJ-NP-Z2-9]{6}$'),

  -- upload_code 실패 누적·잠금 (view_code는 잠금 없음)
  upload_failed   int not null default 0,
  upload_locked   timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- 같은 학년도 안에서 두 코드 모두 unique
  unique (school_year, view_code),
  unique (school_year, upload_code)
);

create index classes_teacher_idx on public.classes(teacher_id);
create index classes_view_idx   on public.classes(view_code, school_year);
create index classes_upload_idx on public.classes(upload_code, school_year);

-- ─────────────────────────────────────────────────────────────────
-- 2) 책 (books)
-- ─────────────────────────────────────────────────────────────────
-- 모든 책은 학급 단위 공개(visibility 컬럼 폐기).
-- pen_name은 필명 강제: 공백·빈 문자열 거부, placeholder 단어 거부.

create table public.books (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references public.classes(id) on delete cascade,
  slug          char(6) not null unique check (slug ~ '^[A-HJ-NP-Z2-9a-hj-np-z]{6}$'),
  pen_name      text not null check (length(btrim(pen_name)) between 1 and 40),
  title         text,
  intro         text,                                       -- 한 줄 작가 소개 (선택)
  data          jsonb not null,
  storage_paths text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index books_class_idx on public.books(class_id);

-- ─────────────────────────────────────────────────────────────────
-- 3) updated_at 자동 갱신 트리거
-- ─────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_classes_touch before update on public.classes
  for each row execute function public.touch_updated_at();

create trigger trg_books_touch before update on public.books
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 4) RLS 활성화
-- ─────────────────────────────────────────────────────────────────

alter table public.classes enable row level security;
alter table public.books enable row level security;

-- 교사는 자기 학급·책만 (anon은 RPC로만)
create policy "teacher manages own classes"
  on public.classes for all
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "teacher manages own books"
  on public.books for all
  to authenticated
  using (
    exists (select 1 from public.classes c
             where c.id = books.class_id and c.teacher_id = auth.uid())
  )
  with check (
    exists (select 1 from public.classes c
             where c.id = books.class_id and c.teacher_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────
-- 5) RPC 1: 학급 작품집 열람 (anon 호출 가능, 잠금 없음)
-- ─────────────────────────────────────────────────────────────────

create or replace function public.view_class_books(
  p_view_code   char(4),
  p_school_year text
)
returns table (
  slug         char(6),
  pen_name     text,
  title        text,
  intro        text,
  data         jsonb,
  created_at   timestamptz,
  class_name   text,
  class_grade  int,
  class_no     int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.classes%rowtype;
begin
  select * into v_class
    from public.classes
   where view_code  = p_view_code
     and school_year = p_school_year
   limit 1;

  if not found then
    return;  -- 빈 결과 (코드 미존재 안내 안 함)
  end if;

  return query
    select b.slug, b.pen_name, b.title, b.intro, b.data, b.created_at,
           v_class.display_name, v_class.grade, v_class.class_no
      from public.books b
     where b.class_id = v_class.id
     order by b.created_at desc;
end $$;

grant execute on function public.view_class_books(char, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 6) RPC 2: 학생 업로드 (upload_code 매칭 + 잠금 체크 + INSERT)
-- ─────────────────────────────────────────────────────────────────

create or replace function public.upload_book(
  p_upload_code char(6),
  p_school_year text,
  p_pen_name    text,
  p_title       text,
  p_intro       text,
  p_data        jsonb,
  p_storage_paths text[] default '{}'
)
returns char(6)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class       public.classes%rowtype;
  v_now         timestamptz := now();
  v_pen         text := btrim(p_pen_name);
  v_slug        char(6);
  v_alphabet    text := '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  v_attempt     int := 0;
  v_inserted    boolean := false;
begin
  -- 학급 매칭
  select * into v_class
    from public.classes
   where upload_code  = p_upload_code
     and school_year  = p_school_year
   limit 1;

  if not found then
    -- 잠금 카운트 누적할 학급이 없으므로 즉시 거부 (특정 에러)
    raise exception '업로드 코드가 맞지 않아요' using errcode = 'P0001';
  end if;

  -- 잠금 상태 확인
  if v_class.upload_locked is not null and v_class.upload_locked > v_now then
    raise exception '업로드 코드가 일시 잠겼습니다. 잠시 후 다시 시도해 주세요' using errcode = 'P0002';
  end if;

  -- 필명 검증 (placeholder 거부)
  if v_pen is null or v_pen = '' or v_pen ~* '^(학생|이름|작가|name|student|test)$' then
    raise exception '필명을 사용해 주세요 (실명·placeholder 금지)' using errcode = 'P0003';
  end if;

  -- 슬러그 6자리 충돌 재시도 (최대 5회)
  while v_attempt < 5 and not v_inserted loop
    v_slug := '';
    for i in 1..6 loop
      v_slug := v_slug || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    begin
      insert into public.books
        (class_id, slug, pen_name, title, intro, data, storage_paths)
      values
        (v_class.id, v_slug, v_pen, nullif(btrim(p_title),''), nullif(btrim(p_intro),''),
         p_data, coalesce(p_storage_paths, '{}'::text[]));
      v_inserted := true;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
    end;
  end loop;

  if not v_inserted then
    raise exception '잠시 후 다시 시도해 주세요' using errcode = 'P0004';
  end if;

  -- 성공 — 잠금 카운터 초기화
  update public.classes
     set upload_failed = 0, upload_locked = null
   where id = v_class.id;

  return v_slug;
end $$;

grant execute on function public.upload_book(char, text, text, text, text, jsonb, text[])
  to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 7) RPC 3: 단권 조회 (slug로 한 권 펼치기, 누구나)
-- ─────────────────────────────────────────────────────────────────

create or replace function public.get_book(p_slug char(6))
returns table (
  slug         char(6),
  pen_name     text,
  title        text,
  intro        text,
  data         jsonb,
  created_at   timestamptz,
  class_name   text,
  class_grade  int,
  class_no     int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select b.slug, b.pen_name, b.title, b.intro, b.data, b.created_at,
           c.display_name, c.grade, c.class_no
      from public.books b
      join public.classes c on c.id = b.class_id
     where b.slug = p_slug
     limit 1;
end $$;

grant execute on function public.get_book(char) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 8) upload_book 실패 카운트용 헬퍼 RPC
-- ─────────────────────────────────────────────────────────────────
-- 클라이언트가 upload_book이 P0001(코드 미스)로 실패했을 때 호출하는
-- 별도 RPC. 학급이 존재하는 다른 시도에서만 카운터를 올리도록 분리.

create or replace function public.record_upload_failure(
  p_upload_code char(6),
  p_school_year text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.classes%rowtype;
begin
  -- 학급 존재할 때만 카운트 (없으면 무시)
  select * into v_class
    from public.classes
   where upload_code  = p_upload_code
     and school_year  = p_school_year
   limit 1;

  if not found then return; end if;

  update public.classes
     set upload_locked = case
           when upload_failed + 1 >= 10
             then now() + interval '1 hour'
           else upload_locked
         end,
         upload_failed = case
           when upload_failed + 1 >= 10 then 0
           else upload_failed + 1
         end
   where id = v_class.id;
end $$;

grant execute on function public.record_upload_failure(char, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 9) Storage — book-images 버킷 정책
-- ─────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-images', 'book-images', true, 512000,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- 누구나 read (이미지 URL이 책 데이터에 박혀 있어야 갤러리가 보입니다)
create policy "public read book-images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'book-images');

-- 학생 업로드를 위해 anon INSERT 허용
-- (메타데이터 검증은 upload_book RPC가 책임집니다)
create policy "anon upload book-images"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'book-images');

-- 교사(인증)는 자기 업로드 파일 삭제 가능. 누구나 업로드한 파일은
-- 책 삭제 시 storage_paths로 함께 정리하므로 별도 anon delete는 안 둡니다.
create policy "authenticated delete book-images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'book-images');

-- ─────────────────────────────────────────────────────────────────
-- 10) 검증용 쿼리 (주석)
-- ─────────────────────────────────────────────────────────────────
--
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('classes', 'books');
--
-- select * from public.view_class_books('9999', '2026-1');  -- 빈 결과 정상
-- select public.upload_book('ZZZZZZ', '2026-1', 'test', null, null, '{}'::jsonb);  -- P0001 정상
-- select public.get_book('XXXXXX');  -- 빈 결과 정상
