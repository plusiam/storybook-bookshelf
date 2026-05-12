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
//   ─── 학급 관리 (Phase 3a — 교사 어드민) ───
//   PB.listClasses()                              → classes row[] (내가 만든 학급 목록)
//   PB.createClass({school_year, grade, class_no, display_name, class_code?})
//                                                 → 새 classes row (코드 미지정 시 자동 생성)
//   PB.deleteClass(id)                            → undefined (책도 cascade 삭제)
//   PB.regenerateClassCode(id)                    → 새 4자리 코드
//   PB.unlockClass(id)                            → undefined (실패 카운터·잠금 초기화)
//   PB.countBooksByClass(classIds[])              → { [class_id]: count }
//   ─── 책 관리 (Phase 3b — 교사 어드민) ───
//   PB.listBooks(classId)                         → books row[] (학급 안)
//   PB.createBookForClass({class_id, student_name, title, data, visibility})
//                                                 → 새 books row (이미지는 Storage에 분리 업로드)
//   PB.updateBookVisibility(id, visibility)       → undefined ('private' | 'class')
//   PB.deleteBook(id)                             → undefined (Storage 파일도 함께 정리 시도)
//   ─── 학부모 진입 (Phase 4) ───
//   PB.fetchClassBooks({code, school_year, grade, class_no, child_name})
//                                                 → row[] (자녀 작품 + 학급 공개 작품, RPC)
//                                                 빈 배열이면 코드/학년/반/이름 중 무엇이 틀렸는지 알려주지 않습니다.
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

  // 이미지 한 장을 Storage에 업로드하고 공개 URL + 경로를 반환
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
    return { url: data.publicUrl, path };
  }

  // 책 데이터에서 base64 이미지를 모두 Storage URL로 교체한 사본 + 업로드된 경로 배열 반환
  // 반환: { data: <pages 교체된 책>, paths: <업로드된 storage 경로[]> }
  async function extractAndUploadImages(data, slug) {
    const paths = [];
    const pages = await Promise.all(
      (data.pages || []).map(async (page, idx) => {
        const p = { ...page };
        if (isDataURL(p.drawing)) {
          try {
            const r = await uploadImage(slug, idx, 'drawing', p.drawing);
            p.drawing = r.url;
            paths.push(r.path);
          } catch (e) {
            console.warn(`[PB] 페이지 ${idx} 이미지 업로드 실패, base64 유지:`, e.message);
            // 업로드 실패 시 base64 그대로 유지 (폴백)
          }
        }
        return p;
      })
    );
    return { data: { ...data, pages }, paths };
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
      // v1 학생 흐름은 storage_paths를 추적하지 않습니다(Phase 4에서 폐기 예정).
      let uploadData;
      try {
        const r = await extractAndUploadImages(data, slug);
        uploadData = r.data;
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

  // ── 학급 관리 (Phase 3a) ───────────────────────────────────────────────
  // RLS 정책 "teacher manages own classes" 덕분에 anon SELECT는 거부되고
  // 인증된 교사는 자기 teacher_id 행만 조회·수정·삭제할 수 있습니다.

  function generateClassCode() {
    // 1000~9999 사이 4자리 숫자
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(1000 + (arr[0] % 9000));
  }

  async function listClasses() {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    const { data, error } = await sb
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message || '학급 목록을 불러오지 못했어요');
    return data || [];
  }

  async function createClass(input) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) throw new Error('로그인이 필요해요');

    const grade = parseInt(input.grade, 10);
    const class_no = parseInt(input.class_no, 10);
    const school_year = (input.school_year || '').trim();
    const display_name =
      (input.display_name || '').trim() ||
      `${grade}학년 ${class_no}반 (${school_year})`;

    if (!school_year) throw new Error('학년도를 입력해 주세요');
    if (!(grade >= 1 && grade <= 6)) throw new Error('학년은 1~6 사이여야 합니다');
    if (!(class_no >= 1 && class_no <= 20)) throw new Error('반은 1~20 사이여야 합니다');

    const payload = {
      teacher_id: u.user.id,
      school_year, grade, class_no, display_name,
    };

    const explicitCode = (input.class_code || '').trim();
    if (explicitCode) {
      if (!/^[0-9]{4}$/.test(explicitCode)) {
        throw new Error('학급 코드는 4자리 숫자여야 합니다');
      }
      const { data, error } = await sb
        .from('classes')
        .insert({ ...payload, class_code: explicitCode })
        .select()
        .single();
      if (error) {
        if (error.code === '23505') {
          throw new Error('이 학년도에 같은 코드가 이미 있어요. 다른 코드로 시도해 주세요');
        }
        throw new Error(error.message || '학급 생성에 실패했어요');
      }
      return data;
    }

    // 자동 생성 — 5회까지 충돌 재시도
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateClassCode();
      const { data, error } = await sb
        .from('classes')
        .insert({ ...payload, class_code: code })
        .select()
        .single();
      if (!error) return data;
      if (error.code !== '23505') {
        throw new Error(error.message || '학급 생성에 실패했어요');
      }
    }
    throw new Error('학급 코드 자동 생성에 계속 실패했어요. 직접 입력해 주세요');
  }

  async function deleteClass(id) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    const { error } = await sb.from('classes').delete().eq('id', id);
    if (error) throw new Error(error.message || '학급 삭제에 실패했어요');
  }

  async function regenerateClassCode(id) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    // 새 코드 + 실패 카운터·잠금 초기화 (재발급은 신뢰 회복 의미)
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateClassCode();
      const { error } = await sb
        .from('classes')
        .update({ class_code: code, failed_attempts: 0, locked_until: null })
        .eq('id', id);
      if (!error) return code;
      if (error.code !== '23505') {
        throw new Error(error.message || '코드 재발급에 실패했어요');
      }
    }
    throw new Error('새 코드 생성에 계속 실패했어요. 잠시 후 다시 시도해 주세요');
  }

  async function unlockClass(id) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    const { error } = await sb
      .from('classes')
      .update({ failed_attempts: 0, locked_until: null })
      .eq('id', id);
    if (error) throw new Error(error.message || '잠금 해제에 실패했어요');
  }

  async function countBooksByClass(classIds) {
    if (!sb || !classIds || classIds.length === 0) return {};
    const { data, error } = await sb
      .from('books')
      .select('class_id')
      .in('class_id', classIds);
    if (error) return {};
    const counts = {};
    for (const row of data || []) {
      counts[row.class_id] = (counts[row.class_id] || 0) + 1;
    }
    return counts;
  }

  // ── 책 관리 (Phase 3b) ────────────────────────────────────────────────

  async function listBooks(classId) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    if (!classId) return [];
    const { data, error } = await sb
      .from('books')
      .select('id, slug, student_name, title, visibility, storage_paths, created_at')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message || '책 목록을 불러오지 못했어요');
    return data || [];
  }

  // 학급에 책 업로드 — JSON + 이미지 분리 + INSERT
  // 슬러그 충돌 시 최대 3회 재시도. 한 책당 storage_paths를 함께 기록해 삭제 시 정리합니다.
  async function createBookForClass({ class_id, student_name, title, data, visibility }) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    if (!class_id) throw new Error('학급이 선택되지 않았어요');

    const { data: u } = await sb.auth.getUser();
    if (!u?.user) throw new Error('로그인이 필요해요');

    const cleanName = (student_name || '').trim();
    if (!cleanName) throw new Error('학생 이름을 입력해 주세요');

    const errMsg = validateBook(data);
    if (errMsg) throw new Error(errMsg);

    const vis = visibility === 'class' ? 'class' : 'private';
    const cleanTitle = (title || '').trim() || null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = generateSlug();

      let payloadData;
      let paths = [];
      try {
        const r = await extractAndUploadImages(data, slug);
        payloadData = r.data;
        paths = r.paths;
      } catch (e) {
        console.warn('[PB] 이미지 분리 실패, 원본 데이터 사용:', e.message);
        payloadData = data;
      }

      const bytes = new Blob([JSON.stringify(payloadData)]).size;
      const maxBytes = cfg.MAX_BOOK_BYTES || 500 * 1024;
      if (bytes > maxBytes) {
        throw new Error(
          `책이 너무 커요 (${Math.round(bytes / 1024)}KB / 최대 ${Math.round(maxBytes / 1024)}KB). 이미지 화질을 낮춰보세요.`
        );
      }

      const { data: inserted, error } = await sb
        .from('books')
        .insert({
          class_id,
          slug,
          student_name: cleanName,
          title: cleanTitle,
          data: payloadData,
          visibility: vis,
          storage_paths: paths,
          created_by: u.user.id,
        })
        .select()
        .single();

      if (!error) return inserted;
      // 23505 = unique_violation (slug 충돌). 재시도.
      if (error.code === '23505') continue;
      throw new Error(error.message || '책 업로드에 실패했어요');
    }
    throw new Error('슬러그 생성에 계속 실패했어요. 잠시 후 다시 시도해 주세요');
  }

  async function updateBookVisibility(id, visibility) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    const vis = visibility === 'class' ? 'class' : 'private';
    const { error } = await sb.from('books').update({ visibility: vis }).eq('id', id);
    if (error) throw new Error(error.message || '공개 범위 변경에 실패했어요');
  }

  // ── 학부모 진입 RPC (Phase 4) ───────────────────────────────────────
  // 4요소(코드+학년도+학년+반)+자녀 이름 매칭. 통일 에러를 위해
  // 어떤 입력이 틀렸는지 호출자에게 알리지 않습니다 (RPC가 빈 배열 반환).

  async function fetchClassBooks({ code, school_year, grade, class_no, child_name }) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');

    const p_code = (code || '').toString().trim();
    const p_school_year = (school_year || '').toString().trim();
    const p_grade = parseInt(grade, 10);
    const p_class_no = parseInt(class_no, 10);
    const p_child_name = (child_name || '').trim();

    if (!/^[0-9]{4}$/.test(p_code)) throw new Error('학급 코드는 4자리 숫자입니다');
    if (!p_school_year) throw new Error('학년도를 입력해 주세요');
    if (!(p_grade >= 1 && p_grade <= 6)) throw new Error('학년은 1~6 사이여야 합니다');
    if (!(p_class_no >= 1 && p_class_no <= 20)) throw new Error('반은 1~20 사이여야 합니다');
    if (!p_child_name) throw new Error('자녀 이름을 입력해 주세요');

    const { data, error } = await sb.rpc('get_class_books', {
      p_code, p_school_year, p_grade, p_class_no, p_child_name,
    });
    if (error) throw new Error(error.message || '조회에 실패했어요');
    return data || [];
  }

  async function deleteBook(id) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    // 책 row의 storage_paths를 먼저 조회 → 가능하면 Storage 파일 정리 → row 삭제
    const { data: bk } = await sb
      .from('books')
      .select('storage_paths')
      .eq('id', id)
      .single();
    const paths = bk?.storage_paths || [];
    if (paths.length > 0) {
      try { await sb.storage.from(BUCKET).remove(paths); } catch (_) { /* 정리 실패해도 진행 */ }
    }
    const { error } = await sb.from('books').delete().eq('id', id);
    if (error) throw new Error(error.message || '책 삭제에 실패했어요');
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
    listClasses,
    createClass,
    deleteClass,
    regenerateClassCode,
    unlockClass,
    countBooksByClass,
    listBooks,
    createBookForClass,
    updateBookVisibility,
    deleteBook,
    fetchClassBooks,
  };
})();
