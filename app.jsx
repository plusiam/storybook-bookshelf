/* global React, ReactDOM, useTweaks,
          TeacherLogin, AdminShell, StudentUpload, PublicGallery, PublicBookView, PB */
const { useState, useEffect, useCallback } = React;

/* ──────────────────────────────────────────────
   공개 학생 작가 작품집 — 진입 라우터

   hash 라우팅
     #/             → 진입점 안내 (Phase 11에서 학생·관람객·교사 세 카드로 재작성 예정)
     #/admin        → 교사 어드민
     #/upload       → 학생 작품 업로드 (?y=2026-1 학년도 자동 채움)
     #/c/:viewCode  → 공개 학급 작품집 (Phase 10)
     #/b/:slug      → 단권 뷰어 (Phase 10)

   학생 피드백 모드(JSON 드래그·드롭, IndexedDB)는 main 브랜치에서 영구 유지됩니다.
   ────────────────────────────────────────────── */

function parseRoute() {
  const h = (window.location.hash || '').replace(/^#/, '');
  if (/^\/admin\/?$/.test(h)) return { type: 'admin' };
  if (/^\/upload(\/|\?.*)?$/.test(h)) return { type: 'upload' };

  // /c/<view_code>?y=<school_year>
  const mGallery = h.match(/^\/c\/([0-9]{4})(\?.*)?$/);
  if (mGallery) {
    const qs = mGallery[2] ? new URLSearchParams(mGallery[2].slice(1)) : null;
    return {
      type: 'gallery',
      viewCode: mGallery[1],
      schoolYear: qs ? (qs.get('y') || '') : '',
    };
  }

  // /b/<slug>
  const mBook = h.match(/^\/b\/([A-Za-z0-9]{4,12})$/);
  if (mBook) return { type: 'book', slug: mBook[1] };

  return { type: 'home' };
}

// TweaksPanel(외부 도구)이 디스크에 다시 쓸 수 있도록 EDITMODE 블록은 보존합니다.
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "storybook",
  "fontFamily": "playful"
}/*EDITMODE-END*/;

const FONT_PRESETS = {
  playful: { display: "'Jua', sans-serif", body: "'Gowun Dodum', sans-serif", hand: "'Nanum Pen Script', cursive", storybook: "'Gowun Batang', serif" },
  hand:    { display: "'Nanum Pen Script', cursive", body: "'Gaegu', sans-serif", hand: "'Nanum Pen Script', cursive", storybook: "'Gaegu', sans-serif" },
  classic: { display: "'Gowun Batang', serif", body: "'Gowun Dodum', sans-serif", hand: "'Hi Melody', cursive", storybook: "'Gowun Batang', serif" },
  cute:    { display: "'Hi Melody', cursive", body: "'Gaegu', sans-serif", hand: "'Hi Melody', cursive", storybook: "'Gaegu', sans-serif" },
};

/* ─── 홈 — 두 진입점 안내 ─────────────────────────────────────── */

function HomeScene() {
  const goUpload = useCallback(() => { window.location.hash = '#/upload'; }, []);
  const goAdmin = useCallback(() => { window.location.hash = '#/admin'; }, []);

  return (
    <div className="home-scene">
      <header className="home-hero">
        <span className="home-tag">📖 우리 학급 작가의 작품집</span>
        <h1 className="home-title">학생 작가들의<br /><em>그림책 도서관</em></h1>
        <p className="home-sub">완성한 작품을 학급 작품집에 올리고, 친구·가족과 함께 펼쳐 봐요.</p>
      </header>

      <div className="home-cards">
        <button type="button" className="home-card home-card--upload" onClick={goUpload}>
          <span className="home-card-icon">✍️</span>
          <span className="home-card-label">작가로 올리기</span>
          <span className="home-card-desc">선생님이 알려주신 6자리 업로드 코드로 내 작품을 올려요</span>
        </button>
        <button type="button" className="home-card home-card--admin" onClick={goAdmin}>
          <span className="home-card-icon">👩‍🏫</span>
          <span className="home-card-label">선생님으로 들어가기</span>
          <span className="home-card-desc">학급을 만들고 두 종류 코드(열람·업로드)를 발급합니다</span>
        </button>
      </div>

      <p className="home-note">
        🔍 학급 작품집을 보러 오셨다면, 선생님이 알려주신 <strong>4자리 열람 코드</strong> 주소(<code>#/c/0000</code>)로 바로 접속해 주세요.
      </p>

      <footer className="home-footer">
        만든이 · <strong>룰루랄라 한기쌤</strong>
      </footer>
    </div>
  );
}

/* ─── 진입 라우터 ───────────────────────────────────────────────── */

function App() {
  const [route, setRoute] = useState(parseRoute);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [t] = useTweaks(TWEAK_DEFAULTS);

  // hash 변화 감지 (앞으로/뒤로가기)
  useEffect(() => {
    const sync = () => setRoute(parseRoute());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  // Supabase 세션 초기 + 변화 구독 (어드민 라우트에서 사용)
  useEffect(() => {
    if (!PB || !PB.isConfigured()) {
      setAuthReady(true);
      return;
    }
    (async () => {
      const s = await PB.getSession();
      setSession(s);
      setAuthReady(true);
    })();
    return PB.onAuthStateChange((s) => setSession(s));
  }, []);

  // 테마·폰트 CSS 변수 적용
  useEffect(() => {
    document.body.dataset.theme = t.theme || 'storybook';
    const f = FONT_PRESETS[t.fontFamily] || FONT_PRESETS.playful;
    document.documentElement.style.setProperty('--font-display', f.display);
    document.documentElement.style.setProperty('--font-body', f.body);
    document.documentElement.style.setProperty('--font-hand', f.hand);
    document.documentElement.style.setProperty('--font-storybook', f.storybook);
  }, [t.theme, t.fontFamily]);

  if (route.type === 'upload') return <StudentUpload />;

  if (route.type === 'gallery') {
    return (
      <PublicGallery
        viewCode={route.viewCode}
        schoolYear={route.schoolYear}
        onOpenBook={(row) => { window.location.hash = `#/b/${row.slug}`; }}
        onMissingYear={(y) => {
          window.location.hash = `#/c/${route.viewCode}?y=${encodeURIComponent(y)}`;
        }}
      />
    );
  }

  if (route.type === 'book') {
    return (
      <PublicBookView
        slug={route.slug}
        onBack={() => {
          if (window.history.length > 1) window.history.back();
          else window.location.hash = '#/';
        }}
      />
    );
  }

  if (route.type === 'admin') {
    if (!authReady) {
      return (
        <div className="remote-state">
          <div className="remote-state-spinner">🔐</div>
          <p className="remote-state-text">세션 확인 중...</p>
        </div>
      );
    }
    if (!session) return <TeacherLogin onSession={setSession} />;
    return (
      <AdminShell
        session={session}
        onSignOut={() => setSession(null)}
        onExitAdmin={() => {
          history.replaceState(null, '', window.location.pathname + window.location.search);
          setRoute({ type: 'home' });
        }}
      />
    );
  }

  return <HomeScene />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
