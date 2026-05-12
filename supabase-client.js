// Supabase 클라이언트 + 학급/책/업로드 헬퍼 (v3 — 공개 학생 작가 작품집)
//
// 사용 전제
//   * index.html이 @supabase/supabase-js UMD를 먼저 로드
//   * config.js가 먼저 로드되어 window.PB_CONFIG가 있어야 함
//
// 외부 API (window.PB)
//   ─── 환경·유틸 ───
//   PB.isConfigured()                              → boolean
//   PB.generateSlug()                              → 6자 영숫자 (단권 슬러그)
//
//   ─── 인증 (교사 OTP) ───
//   PB.signInWithOtp(email)                        → undefined (이메일 발송)
//   PB.verifyOtp(email, token)                     → session
//   PB.signOut() / getSession() / onAuthStateChange(cb)
//
//   ─── 학급 관리 (교사) ───
//   PB.listClasses()                               → classes row[]
//   PB.createClass({school_year, grade, class_no, display_name})
//                                                  → 새 학급 (view_code 4자리 + upload_code 6자리 자동 발급)
//   PB.deleteClass(id) / PB.countBooksByClass(ids[])
//   PB.regenerateViewCode(id)                      → 새 view_code 4자리
//   PB.regenerateUploadCode(id)                    → 새 upload_code 6자리 + 잠금 카운터 초기화
//   PB.unlockUpload(id)                            → upload 잠금만 해제
//
//   ─── 책 관리 (교사) ───
//   PB.listBooks(classId)                          → books row[]
//   PB.deleteBook(id)                              → undefined (Storage 정리 시도)
//
//   ─── 학생 업로드 (anon) ───
//   PB.uploadStudentBook({uploadCode, schoolYear, penName, title, intro, data})
//                                                  → { slug } 또는 throw (err.code = 'P0001'·'P0002'·'P0003'·...)
//
//   ─── 공개 열람 (anon) ───
//   PB.viewClassBooks(viewCode, schoolYear)        → row[] (학급 공개 작품집)
//   PB.getBookBySlug(slug)                         → row 또는 null

(function () {
  const cfg = window.PB_CONFIG || {};
  const placeholder =
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_ANON_KEY ||
    cfg.SUPABASE_URL.includes('YOUR-PROJECT') ||
    cfg.SUPABASE_ANON_KEY.includes('YOUR-ANON');

  const sb = !placeholder && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const BUCKET = 'book-images';

  // ── 슬러그/코드 생성 ──────────────────────────────────────────────
  // 슬러그: 헷갈리기 쉬운 글자(0/O/1/l/I) 제외
  const SLUG_ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  function generateSlug(len = 6) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    let s = '';
    for (let i = 0; i < len; i++) s += SLUG_ALPHABET[arr[i] % SLUG_ALPHABET.length];
    return s;
  }

  // upload_code: 대문자 영숫자 6자리, O/0/I/1 제외 (schema CHECK와 일치)
  const UPLOAD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function generateUploadCode() {
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    let s = '';
    for (let i = 0; i < 6; i++) s += UPLOAD_ALPHABET[arr[i] % UPLOAD_ALPHABET.length];
    return s;
  }

  // view_code: 4자리 숫자 1000~9999
  function generateViewCode() {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(1000 + (arr[0] % 9000));
  }

  // ── 이미지 헬퍼 ──────────────────────────────────────────────────
  function dataURLtoBlob(dataURL) {
    const [header, base64] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(base64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function isDataURL(s) {
    return typeof s === 'string' && s.startsWith('data:image/');
  }

  async function uploadImage(slug, pageIdx, field, dataURL) {
    const blob = dataURLtoBlob(dataURL);
    const ext = blob.type.split('/')[1] || 'png';
    const path = `${slug}/${pageIdx}-${field}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type,
      upsert: false,
    });
    if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  // 책 데이터에서 base64 이미지를 모두 Storage URL로 교체한 사본 + 업로드된 경로 배열
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
          }
        }
        return p;
      })
    );
    return { data: { ...data, pages }, paths };
  }

  function validateBook(data) {
    if (!data || typeof data !== 'object') return '책 데이터가 비어 있어요';
    if (!Array.isArray(data.pages)) return '페이지 정보가 없어요';
    if (data.pages.length === 0) return '페이지가 한 장도 없어요';
    if (data.pages.length > (cfg.MAX_PAGES || 30)) {
      return `페이지가 너무 많아요 (최대 ${cfg.MAX_PAGES || 30}장)`;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // 인증 (교사 OTP)
  // ─────────────────────────────────────────────────────────────────

  async function signInWithOtp(email) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    const cleaned = (email || '').trim().toLowerCase();
    if (!cleaned) throw new Error('이메일을 입력해 주세요');
    const { error } = await sb.auth.signInWithOtp({
      email: cleaned, options: { shouldCreateUser: true },
    });
    if (error) throw new Error(error.message || '이메일 발송에 실패했어요');
  }

  async function verifyOtp(email, token) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    const cleaned = (email || '').trim().toLowerCase();
    const code = (token || '').trim();
    if (!cleaned || !code) throw new Error('이메일과 코드를 모두 입력해 주세요');
    const { data, error } = await sb.auth.verifyOtp({
      email: cleaned, token: code, type: 'email',
    });
    if (error) throw new Error(error.message || '코드가 맞지 않아요');
    return data.session;
  }

  async function signOut() { if (sb) await sb.auth.signOut(); }
  async function getSession() {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session;
  }
  function onAuthStateChange(cb) {
    if (!sb) return () => {};
    const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s));
    return () => data.subscription.unsubscribe();
  }

  // ─────────────────────────────────────────────────────────────────
  // 학급 관리 (교사 — RLS로 자기 학급만 접근)
  // ─────────────────────────────────────────────────────────────────

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

    const base = { teacher_id: u.user.id, school_year, grade, class_no, display_name };

    // view_code + upload_code 자동 생성, 두 컬럼 모두 unique 제약 → 충돌 시 8회 재시도
    for (let attempt = 0; attempt < 8; attempt++) {
      const view_code = generateViewCode();
      const upload_code = generateUploadCode();
      const { data, error } = await sb
        .from('classes')
        .insert({ ...base, view_code, upload_code })
        .select()
        .single();
      if (!error) return data;
      if (error.code !== '23505') {
        throw new Error(error.message || '학급 생성에 실패했어요');
      }
    }
    throw new Error('코드 생성에 계속 실패했어요. 잠시 후 다시 시도해 주세요');
  }

  async function deleteClass(id) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    const { error } = await sb.from('classes').delete().eq('id', id);
    if (error) throw new Error(error.message || '학급 삭제에 실패했어요');
  }

  async function regenerateCode(id, column, generator) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generator();
      const patch = { [column]: code };
      // upload_code 재발급은 신뢰 회복 의미 → 잠금 카운터도 초기화
      if (column === 'upload_code') {
        patch.upload_failed = 0;
        patch.upload_locked = null;
      }
      const { error } = await sb.from('classes').update(patch).eq('id', id);
      if (!error) return code;
      if (error.code !== '23505') {
        throw new Error(error.message || '재발급에 실패했어요');
      }
    }
    throw new Error('새 코드 생성에 계속 실패했어요. 잠시 후 다시 시도해 주세요');
  }
  async function regenerateViewCode(id)   { return regenerateCode(id, 'view_code',   generateViewCode); }
  async function regenerateUploadCode(id) { return regenerateCode(id, 'upload_code', generateUploadCode); }

  async function unlockUpload(id) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    const { error } = await sb
      .from('classes')
      .update({ upload_failed: 0, upload_locked: null })
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

  // ─────────────────────────────────────────────────────────────────
  // 책 관리 (교사 — 모니터/삭제만, 업로드는 학생이 직접)
  // ─────────────────────────────────────────────────────────────────

  async function listBooks(classId) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    if (!classId) return [];
    const { data, error } = await sb
      .from('books')
      .select('id, slug, pen_name, title, intro, storage_paths, created_at')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message || '책 목록을 불러오지 못했어요');
    return data || [];
  }

  async function deleteBook(id) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
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

  // ─────────────────────────────────────────────────────────────────
  // 학생 업로드 (anon — upload_code 매칭 + 잠금 + INSERT를 RPC가 책임)
  // ─────────────────────────────────────────────────────────────────

  async function uploadStudentBook({ uploadCode, schoolYear, penName, title, intro, data }) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');

    const cleanCode = (uploadCode || '').trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(cleanCode)) {
      throw new Error('업로드 코드는 6자리 영숫자입니다');
    }
    const cleanYear = (schoolYear || '').trim();
    if (!cleanYear) throw new Error('학년도를 입력해 주세요');
    const cleanPen = (penName || '').trim();
    if (!cleanPen) throw new Error('필명을 입력해 주세요');

    const errMsg = validateBook(data);
    if (errMsg) throw new Error(errMsg);

    // 1) 이미지 분리 업로드 — 임시 slug 경로(클라이언트). 최종 slug는 RPC가 결정.
    //    storage_paths를 RPC에 같이 넘겨 books.storage_paths에 기록 → 책 삭제 시 정리 가능.
    const tempSlug = generateSlug();
    let uploaded;
    try {
      uploaded = await extractAndUploadImages(data, tempSlug);
    } catch (e) {
      console.warn('[PB] 이미지 분리 실패, 원본 데이터 사용:', e.message);
      uploaded = { data, paths: [] };
    }

    const bytes = new Blob([JSON.stringify(uploaded.data)]).size;
    const maxBytes = cfg.MAX_BOOK_BYTES || 500 * 1024;
    if (bytes > maxBytes) {
      throw new Error(
        `책이 너무 커요 (${Math.round(bytes / 1024)}KB / 최대 ${Math.round(maxBytes / 1024)}KB). 이미지 화질을 낮춰보세요.`
      );
    }

    // 2) RPC 호출 — 매칭·잠금·필명 검증·슬러그 발급은 서버가 책임
    const { data: slug, error } = await sb.rpc('upload_book', {
      p_upload_code: cleanCode,
      p_school_year: cleanYear,
      p_pen_name: cleanPen,
      p_title: (title || '').trim() || null,
      p_intro: (intro || '').trim() || null,
      p_data: uploaded.data,
      p_storage_paths: uploaded.paths,
    });

    if (error) {
      // 코드 미스(P0001)는 별도 RPC로 실패 카운트 누적 — 학급이 실존할 때만 카운트
      if (error.code === 'P0001') {
        try {
          await sb.rpc('record_upload_failure', {
            p_upload_code: cleanCode,
            p_school_year: cleanYear,
          });
        } catch (_) { /* 실패해도 본 흐름 영향 없음 */ }
      }
      const wrapped = new Error(error.message || '업로드에 실패했어요');
      wrapped.code = error.code;
      throw wrapped;
    }

    return { slug };
  }

  // ─────────────────────────────────────────────────────────────────
  // 공개 열람 (anon)
  // ─────────────────────────────────────────────────────────────────

  async function viewClassBooks(viewCode, schoolYear) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    const cleanCode = (viewCode || '').trim();
    const cleanYear = (schoolYear || '').trim();
    if (!/^[0-9]{4}$/.test(cleanCode)) throw new Error('열람 코드는 4자리 숫자입니다');
    if (!cleanYear) throw new Error('학년도를 입력해 주세요');

    const { data, error } = await sb.rpc('view_class_books', {
      p_view_code: cleanCode,
      p_school_year: cleanYear,
    });
    if (error) throw new Error(error.message || '학급을 불러오지 못했어요');
    return data || [];
  }

  async function getBookBySlug(slug) {
    if (!sb) throw new Error('Supabase가 설정되지 않았어요');
    const cleanSlug = (slug || '').trim();
    if (!cleanSlug) return null;
    const { data, error } = await sb.rpc('get_book', { p_slug: cleanSlug });
    if (error) throw new Error(error.message || '책을 불러오지 못했어요');
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  window.PB = {
    isConfigured: () => !placeholder && !!sb,
    generateSlug,
    // 인증
    signInWithOtp, verifyOtp, signOut, getSession, onAuthStateChange,
    // 학급
    listClasses, createClass, deleteClass, countBooksByClass,
    regenerateViewCode, regenerateUploadCode, unlockUpload,
    // 책 (교사)
    listBooks, deleteBook,
    // 학생 업로드
    uploadStudentBook,
    // 공개 열람
    viewClassBooks, getBookBySlug,
  };
})();
