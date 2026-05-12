// Supabase 클라이언트 + 그림책 업로드·조회 헬퍼
//
// 사용 전제
//   * index.html이 @supabase/supabase-js UMD를 먼저 로드
//   * config.js가 먼저 로드되어 window.PB_CONFIG가 있어야 함
//
// 외부 API (window.PB로 노출)
//   PB.uploadBook(data, { classCode, nickname }) → { slug }
//   PB.getBook(slug)                              → book row 또는 null
//   PB.getClassBooks(classCode)                   → book row 배열 (created_at 내림차순)
//   PB.generateSlug()                             → 6자 영숫자 (예: 'xK3p9q')
//   PB.isConfigured()                             → boolean (config.js가 placeholder 아닌지)

(function () {
  const cfg = window.PB_CONFIG || {};
  const placeholder =
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_ANON_KEY ||
    cfg.SUPABASE_URL.includes('YOUR-PROJECT') ||
    cfg.SUPABASE_ANON_KEY.includes('YOUR-ANON');

  // Supabase 클라이언트 초기화 (UMD는 window.supabase 글로벌로 노출)
  const sb = !placeholder && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  // 6자 영숫자 슬러그 — 사람이 헷갈리기 쉬운 글자(0/O/1/l/I)는 제외
  const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  function generateSlug(len = 6) {
    let s = '';
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) s += ALPHABET[arr[i] % ALPHABET.length];
    return s;
  }

  // 업로드 검증 — 클라이언트에서 한 번 거름 (서버 RLS는 무결성만 체크)
  function validateBook(data) {
    if (!data || typeof data !== 'object') return '책 데이터가 비어 있어요';
    if (!Array.isArray(data.pages)) return '페이지 정보가 없어요';
    if (data.pages.length === 0) return '페이지가 한 장도 없어요';
    if (data.pages.length > (cfg.MAX_PAGES || 30)) {
      return `페이지가 너무 많아요 (최대 ${cfg.MAX_PAGES || 30}장)`;
    }
    const bytes = new Blob([JSON.stringify(data)]).size;
    if (bytes > (cfg.MAX_BOOK_BYTES || 200 * 1024)) {
      const kb = Math.round(bytes / 1024);
      const maxKb = Math.round((cfg.MAX_BOOK_BYTES || 200 * 1024) / 1024);
      return `책이 너무 커요 (${kb}KB / 최대 ${maxKb}KB)`;
    }
    return null;
  }

  // 책 업로드 — 중복 slug 만나면 최대 3번 재시도
  async function uploadBook(data, opts = {}) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요 (config.js 확인)');

    const errMsg = validateBook(data);
    if (errMsg) throw new Error(errMsg);

    const classCode = (opts.classCode || '').trim() || null;
    const nickname = (opts.nickname || data?.student?.name || '').trim().slice(0, 40) || null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = generateSlug();
      const { error } = await sb
        .from('books')
        .insert({ slug, data, class_code: classCode, nickname });

      if (!error) return { slug };
      // 23505 = unique_violation (slug 충돌). 재시도.
      if (error.code === '23505') continue;
      throw new Error(error.message || '업로드에 실패했어요');
    }
    throw new Error('짧은 링크 생성에 계속 실패했어요. 잠시 후 다시 시도해주세요');
  }

  async function getBook(slug) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요 (config.js 확인)');
    const { data, error } = await sb
      .from('books')
      .select('slug, data, class_code, nickname, created_at')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error(error.message || '책을 불러오지 못했어요');
    return data;
  }

  async function getClassBooks(classCode) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요 (config.js 확인)');
    if (!classCode) return [];
    const { data, error } = await sb
      .from('books')
      .select('slug, data, class_code, nickname, created_at')
      .eq('class_code', classCode)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message || '학급 책장을 불러오지 못했어요');
    return data || [];
  }

  window.PB = {
    uploadBook,
    getBook,
    getClassBooks,
    generateSlug,
    isConfigured: () => !placeholder && !!sb,
  };
})();
