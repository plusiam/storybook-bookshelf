-- Supabase 그림책 단축링크 저장용 스키마 (books 단일 테이블 + RLS)
--
-- 사용 방법
--   1. Supabase 대시보드 → SQL Editor → New query
--   2. 이 파일 전체 복사·붙여넣기 → Run
--   3. 에러 없이 끝나면 완료
--
-- 정책 요약
--   * 누구나 책을 읽고(SELECT), 새로 올릴(INSERT) 수 있음
--   * 누구도 기존 책을 수정·삭제할 수 없음 (UPDATE/DELETE 정책 없음 = 거부)
--   * 학급코드(class_code)는 선택 입력. 같은 코드끼리 갤러리로 묶어 봄

-- 1) 테이블
create table if not exists books (
  slug         text primary key,                          -- nanoid 6자 (예: 'xK3p9q')
  data         jsonb not null,                            -- 그림책 전체 데이터
  class_code   text,                                      -- 선택 입력 (예: '5-3-2026')
  nickname     text,                                      -- 학급 갤러리 정렬·표시용 (별명만)
  created_at   timestamptz not null default now(),
  views        int not null default 0
);

-- 2) 학급 갤러리 빠른 조회용 인덱스
create index if not exists books_class_code_idx
  on books(class_code)
  where class_code is not null;

-- 3) RLS 활성화
alter table books enable row level security;

-- 4) 누구나 읽기
drop policy if exists "anon read books" on books;
create policy "anon read books"
  on books
  for select
  using (true);

-- 5) 누구나 새 책 업로드 (단순 무결성 체크)
drop policy if exists "anon insert books" on books;
create policy "anon insert books"
  on books
  for insert
  with check (
    jsonb_typeof(data) = 'object'
    and length(slug) between 5 and 10
    and (class_code is null or length(class_code) between 1 and 40)
    and (nickname   is null or length(nickname)   between 1 and 40)
  );

-- update / delete 정책 없음 → 자동 거부

-- ── 검증용 ─────────────────────────────────────────────────────────────
-- select count(*) from books;
-- insert into books(slug, data, class_code, nickname) values
--   ('test01', '{"pages":[],"student":{"name":"테스트"}}'::jsonb, 'test-class', '테스트');
-- update books set views = views + 1 where slug = 'test01';  -- 실패해야 정상
-- delete from books where slug = 'test01';                    -- 실패해야 정상
