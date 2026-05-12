-- 가족 공유 그림책 도서관 스키마 v2
-- (교사 어드민 + 학부모 인증 열람 구조)
--
-- 적용 방법
--   1. Supabase 대시보드 → SQL Editor → New query
--   2. 이 파일 전체 복사·붙여넣기 → Run
--   3. 에러 없이 끝나면 완료
--
-- v1 → v2 마이그레이션 주의
--   * v1의 books 테이블(slug PK, anon insert 허용)을 DROP하고 새로 만듭니다.
--   * v1으로 올라간 작품 데이터는 이 SQL 실행 시 모두 삭제됩니다.
--   * Storage 'book-images' 버킷은 재사용합니다(파일은 보존).
--   * v1을 처음부터 안 쓰셨다면 그대로 실행해도 안전합니다.
--
-- 정책 요약
--   * 교사(auth.users)만 학급(classes)을 만들고 책(books)을 올립니다.
--   * 학부모(anon)는 RPC get_class_books로만 데이터에 접근합니다.
--   * 학급 코드 4자리 + 학년도 + 학년 + 반 + 자녀 실명이 모두 맞아야 결과가 나옵니다.
--   * 실패 10회 누적 시 해당 학급 코드는 1시간 잠깁니다.

-- ─────────────────────────────────────────────────────────────────
-- 0) v1 정리 (있을 경우)
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.get_class_books(char, text, int, int, text);
drop policy if exists "anon read books" on public.books;
drop policy if exists "anon insert books" on public.books;
drop policy if exists "anon read book-images" on storage.objects;
drop policy if exists "anon upload book-images" on storage.objects;
drop table if exists public.books cascade;

-- ─────────────────────────────────────────────────────────────────
-- 1) 학급 (classes)
-- ─────────────────────────────────────────────────────────────────
-- class_code는 4자리 숫자. 합의서대로 학부모 편의 우선.
-- 보안은 학년도·학년·반·자녀 이름 4요소 매칭 + 실패 누적 잠금으로 보완합니다.

create table public.classes (
  id              uuid primary key default gen_random_uuid(),
  class_code      char(4) not null check (class_code ~ '^[0-9]{4}$'),
  school_year     text not null,                          -- 예: '2026-1', '2026-2'
  grade           int not null check (grade between 1 and 6),
  class_no        int not null check (class_no between 1 and 20),
  display_name    text not null,                          -- 예: '5학년 3반 (2026)'
  teacher_id      uuid not null references auth.users(id) on delete cascade,
  failed_attempts int not null default 0,
  locked_until    timestamptz,                            -- null이면 잠금 없음
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- 같은 학년도 안에서는 같은 코드 중복 금지
  unique (school_year, class_code)
);

create index classes_teacher_idx on public.classes(teacher_id);
create index classes_lookup_idx
  on public.classes(class_code, school_year, grade, class_no);

-- ─────────────────────────────────────────────────────────────────
-- 2) 책 (books)
-- ─────────────────────────────────────────────────────────────────
-- student_name은 실명. 학부모가 자녀 이름으로 매칭하기 위함.
-- 한 학생이 여러 권 올릴 수 있으므로 (class_id, student_name) UNIQUE 두지 않음.
-- visibility = 'private'면 자녀 본인 매칭 시에만 노출.
-- visibility = 'class'면 같은 학급 학부모 누구나 노출 (교사 토글).

create table public.books (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references public.classes(id) on delete cascade,
  slug          char(6) not null unique,                  -- 단권 뷰어 URL용
  student_name  text not null,
  title         text,
  data          jsonb not null,                           -- 그림책 전체 (이미지는 Storage URL)
  visibility    text not null default 'private'
                check (visibility in ('private', 'class')),
  storage_paths text[] not null default '{}',             -- 책 삭제 시 Storage 정리용
  created_by    uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index books_class_idx on public.books(class_id);
create index books_class_name_idx on public.books(class_id, student_name);

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

-- ─────────────────────────────────────────────────────────────────
-- 5) 교사 RLS — 자기 소유 학급·책만 접근
-- ─────────────────────────────────────────────────────────────────

create policy "teacher manages own classes"
  on public.classes for all
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "teacher manages own books"
  on public.books for all
  to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = books.class_id and c.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.classes c
      where c.id = books.class_id and c.teacher_id = auth.uid()
    )
  );

-- anon은 직접 SELECT 불가. RPC를 통해서만 접근.

-- ─────────────────────────────────────────────────────────────────
-- 6) 학부모 진입 RPC
-- ─────────────────────────────────────────────────────────────────
-- 5요소 매칭(코드+학년도+학년+반+자녀이름) → 자녀 작품 + 학급 공개 작품 반환
-- 실패 시 통일 에러(빈 결과), 학급이 존재할 때만 failed_attempts++
-- 10회 누적 시 1시간 잠금 (잠금 동안은 어떤 입력에도 빈 결과)

create or replace function public.get_class_books(
  p_code        char(4),
  p_school_year text,
  p_grade       int,
  p_class_no    int,
  p_child_name  text
)
returns table (
  slug         char(6),
  student_name text,
  title        text,
  data         jsonb,
  visibility   text,
  created_at   timestamptz,
  is_own_child boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class       public.classes%rowtype;
  v_child       text := btrim(p_child_name);
  v_now         timestamptz := now();
  v_matched     boolean;
begin
  -- 학급 매칭 (코드 + 학년도 + 학년 + 반)
  select * into v_class
    from public.classes
   where class_code  = p_code
     and school_year = p_school_year
     and grade       = p_grade
     and class_no    = p_class_no
   limit 1;

  if not found then
    -- 학급 코드 자체가 매칭 안 됨. 잠금 카운트는 학급이 있을 때만 누적.
    return;  -- 통일 에러 (빈 결과)
  end if;

  -- 잠금 상태 확인 (잠금 중에는 어떤 입력에도 빈 결과)
  if v_class.locked_until is not null and v_class.locked_until > v_now then
    return;
  end if;

  -- 자녀 이름 매칭 확인
  select exists (
    select 1 from public.books b
     where b.class_id = v_class.id and b.student_name = v_child
  ) into v_matched;

  if not v_matched then
    -- 실패 누적
    -- SET 절의 컬럼 참조는 UPDATE 전 값. failed_attempts + 1을 두 CASE에서 동일 의미로 사용.
    update public.classes
       set locked_until = case
             when failed_attempts + 1 >= 10
               then v_now + interval '1 hour'
             else locked_until
           end,
           failed_attempts = case
             when failed_attempts + 1 >= 10 then 0
             else failed_attempts + 1
           end
     where id = v_class.id;
    return;
  end if;

  -- 성공 — 실패 카운트 초기화
  update public.classes
     set failed_attempts = 0, locked_until = null
   where id = v_class.id;

  -- 결과: 자녀 본인 작품(visibility 무관) + 같은 학급의 'class' 공개 작품(자녀 본인 외)
  return query
    select b.slug, b.student_name, b.title, b.data, b.visibility,
           b.created_at,
           (b.student_name = v_child) as is_own_child
      from public.books b
     where b.class_id = v_class.id
       and (
         b.student_name = v_child
         or b.visibility = 'class'
       )
     order by (b.student_name = v_child) desc, b.created_at desc;
end $$;

-- anon이 호출할 수 있도록 권한 부여
grant execute on function public.get_class_books(char, text, int, int, text)
  to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 7) Storage — book-images 버킷 정책 교체
-- ─────────────────────────────────────────────────────────────────
-- 버킷 자체는 v1 그대로 재사용. 정책만 교체.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-images', 'book-images', true, 512000,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- 누구나 읽기 (이미지 URL이 책 데이터에 박혀 있어야 학부모가 봅니다)
drop policy if exists "public read book-images" on storage.objects;
create policy "public read book-images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'book-images');

-- 인증된 교사만 업로드
drop policy if exists "teacher upload book-images" on storage.objects;
create policy "teacher upload book-images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'book-images');

-- 인증된 교사가 자기 업로드 파일 삭제 가능
drop policy if exists "teacher delete book-images" on storage.objects;
create policy "teacher delete book-images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'book-images' and owner = auth.uid());

-- ─────────────────────────────────────────────────────────────────
-- 8) 검증용 쿼리 (주석 — 필요 시 직접 실행)
-- ─────────────────────────────────────────────────────────────────
--
-- 테이블 확인
-- select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('classes', 'books');
--
-- RLS 확인 (anon으로 SELECT 시도하면 0건 나와야 정상)
-- select * from public.classes;
-- select * from public.books;
--
-- RPC 호출 예 (잘못된 코드 — 0건, 잠금 카운트도 안 오름)
-- select * from public.get_class_books('9999', '2026-1', 5, 3, '홍길동');
--
-- 잠금 상태 확인 (교사 어드민에서 실행)
-- select class_code, failed_attempts, locked_until from public.classes;
--
-- 잠금 수동 해제 (교사 어드민 작업)
-- update public.classes set failed_attempts = 0, locked_until = null where id = '...';
