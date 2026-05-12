// Supabase 연결 정보 — fork 후 두 값만 수정하면 됨
//
// 가져오는 곳
//   Supabase 대시보드 → Project Settings → API
//   1) Project URL                 → SUPABASE_URL
//   2) Project API keys → anon public → SUPABASE_ANON_KEY
//
// 주의
//   * anon key는 정적 파일에 노출되어도 안전함 (RLS로 보호됨)
//   * service_role 키는 절대 여기에 넣지 말 것

window.PB_CONFIG = {
  // Supabase 프로젝트 (구 picturebook-class-talk → storybook-bookshelf로 재활용)
  // 리전: 서울 (ap-northeast-2)
  SUPABASE_URL: 'https://ipjdoabdjuuieuojvryl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwamRvYWJkanV1aWV1b2p2cnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjQwMjAsImV4cCI6MjA5NDAwMDAyMH0.NP397ccLZ-04DG4DZob3KILWH2h95DUiIZ0xWFroF5A',

  // 업로드 제한 (악용 방지용 클라이언트 검증)
  MAX_BOOK_BYTES: 200 * 1024,   // 책 1권 최대 200KB
  MAX_PAGES: 30,                // 페이지 30장 초과 거부
};
