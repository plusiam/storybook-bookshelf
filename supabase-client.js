// Supabase 클라이언트 + 그림책 업로드·조회 헬퍼
//
// 사용 전제
//   * index.html이 @supabase/supabase-js UMD를 먼저 로드
//   * config.js가 먼저 로드되어 window.PB_CONFIG가 있어야 함
//
// 외부 API (window.PB로 노출)
//   ─── 책 (학생 공유 흐름. Phase 4에서 RPC 기반으로 정리 예정) ───
//   PB.uploadBook(data, { classCode, nickname }) → { slug }
//   PB.getBook(slug)                              → book row 또는 null
//   PB.getClassBooks(classCode)                   → book row 배열
//   ─── 인증 (Phase 2 — 교사 OTP) ───
//   PB.signInWithOtp(email)                       → undefined (이메일 발송)
//   PB.verifyOtp(email, token)                    → session (성공 시)
//   PB.signOut()                                  → undefined
//   PB.getSession()                               → session 또는 null
//   PB.onAuthStateChange(cb)                      → unsubscribe 함수
//   ─── 유틸 ───
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
  // 교사 로그인 세션을 새로고침해도 유지해야 하므로 기본 설정(persistSession=true, autoRefreshToken=true)을 그대로 둡니다.
  const sb = !placeholder && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const BUCKET = 'book-images';

  // 6자 영숫자 슬러그 — 사람이 헷갈리기 쉬운 글자(0/O/1/l/I)는 제외
  const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  function generateSlug(len = 6) {
    let s = '';
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) s += ALPHABET[arr[i] % ALPHABET.length];
    return s;
  }

  // base64 data URL → Blob 변환
  function dataURLtoBlob(dataURL) {
    const [header, base64] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(base64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // base64 data URL인지 확인
  function isDataURL(str) {
    return typeof str === 'string' && str.startsWith('data:image/');
  }

  // 이미지 한 장을 Storage에 업로드하고 공개 URL 반환
  async function uploadImage(bookSlug, pageIdx, field, dataURL) {
    const blob = dataURLtoBlob(dataURL);
    const ext = blob.type.split('/')[1] || 'png';
    const path = `${bookSlug}/${pageIdx}-${field}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type,
      upsert: false,
    });
    if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  // 책 데이터에서 base64 이미지를 모두 Storage URL로 교체한 사본 반환
  async function extractAndUploadImages(data, slug) {
    // 깊은 복사 없이 페이지 배열만 새로 구성 (data URL은 크므로 직접 변환)
    const pages = await Promise.all(
      (data.pages || []).map(async (page, idx) => {
        const p = { ...page };
        if (isDataURL(p.drawing)) {
          try {
            p.drawing = await uploadImage(slug, idx, 'drawing', p.drawing);
          } catch (e) {
            console.warn(`[PB] 페이지 ${idx} 이미지 업로드 실패, base64 유지:`, e.message);
            // 업로드 실패 시 base64 그대로 유지 (폴백)
          }
        }
        return p;
      })
    );
    return { ...data, pages };
  }

  // 업로드 검증 — 클라이언트에서 한 번 거름
  function validateBook(data) {
    if (!data || typeof data !== 'object') return '책 데이터가 비어 있어요';
    if (!Array.isArray(data.pages)) return '페이지 정보가 없어요';
    if (data.pages.length === 0) return '페이지가 한 장도 없어요';
    if (data.pages.length > (cfg.MAX_PAGES || 30)) {
      return `페이지가 너무 많아요 (최대 ${cfg.MAX_PAGES || 30}장)`;
    }
    return null;
  }

  // 책 업로드
  //   1) 이미지를 Storage에 먼저 올려 URL로 교체
  //   2) 교체된 JSON을 books 테이블에 INSERT
  //   슬러그 충돌 시 최대 3번 재시도
  async function uploadBook(data, opts = {}) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요 (config.js 확인)');

    const errMsg = validateBook(data);
    if (errMsg) throw new Error(errMsg);

    const classCode = (opts.classCode || '').trim() || null;
    const nickname = (opts.nickname || data?.student?.name || '').trim().slice(0, 40) || null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = generateSlug();

      // 이미지 분리 업로드 (실패해도 base64 폴백으로 계속)
      let uploadData;
      try {
        uploadData = await extractAndUploadImages(data, slug);
      } catch (e) {
        console.warn('[PB] 이미지 분리 실패, 원본 데이터 사용:', e.message);
        uploadData = data;
      }

      // JSON 크기 최종 확인 (이미지 분리 후 훨씬 작아져야 함)
      const bytes = new Blob([JSON.stringify(uploadData)]).size;
      const maxBytes = cfg.MAX_BOOK_BYTES || 500 * 1024; // Storage 분리 후 한도 500KB로 완화
      if (bytes > maxBytes) {
        throw new Error(`책이 너무 커요 (${Math.round(bytes / 1024)}KB / 최대 ${Math.round(maxBytes / 1024)}KB). 이미지 화질을 낮춰보세요.`);
      }

      const { error } = await sb
        .from('books')
        .insert({ slug, data: uploadData, class_code: classCode, nickname });

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

  // ── 인증 (Phase 2 — 교사 OTP) ─────────────────────────────────────────────
  // Supabase Auth의 이메일 OTP는 한 번의 호출로 매직 링크와 6자리 코드를 모두 발송합니다.
  // 우리는 6자리 코드 입력 방식만 사용합니다 (학교 환경에서 다른 기기로 링크 클릭이 어려운 경우 대비).

  async function signInWithOtp(email) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요 (config.js 확인)');
    const cleaned = (email || '').trim().toLowerCase();
    if (!cleaned) throw new Error('이메일을 입력해 주세요');
    const { error } = await sb.auth.signInWithOtp({
      email: cleaned,
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error(error.message || '이메일 발송에 실패했어요');
  }

  async function verifyOtp(email, token) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요 (config.js 확인)');
    const cleaned = (email || '').trim().toLowerCase();
    const code = (token || '').trim();
    if (!cleaned || !code) throw new Error('이메일과 코드를 모두 입력해 주세요');
    const { data, error } = await sb.auth.verifyOtp({
      email: cleaned,
      token: code,
      type: 'email',
    });
    if (error) throw new Error(error.message || '코드가 맞지 않아요');
    return data.session;
  }

  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
  }

  async function getSession() {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session;
  }

  function onAuthStateChange(callback) {
    if (!sb) return () => {};
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return () => data.subscription.unsubscribe();
  }

  window.PB = {
    uploadBook,
    getBook,
    getClassBooks,
    generateSlug,
    isConfigured: () => !placeholder && !!sb,
    signInWithOtp,
    verifyOtp,
    signOut,
    getSession,
    onAuthStateChange,
  };
})();
