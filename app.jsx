/* global React, ReactDOM, useTweaks, FamilyScene, TeacherLogin, AdminShell, PB */
const { useState, useEffect, useCallback } = React;

/* ──────────────────────────────────────────────
   가족 공유 그림책 도서관 — 진입 라우터

   hash 라우팅
     #/             → 두 진입점 안내 (학부모 / 교사)
     #/family       → 학부모 진입 (4자리 코드 + 자녀 실명 매칭)
     #/admin        → 교사 어드민 (Supabase Auth OTP)

   학생 피드백 모드(JSON 드래그·드롭, IndexedDB 책장, 단축링크 공유 등)는
   별개 브랜치(main)에서 운영하며 이 브랜치(family)에서는 의도적으로 제거되었습니다.
   ────────────────────────────────────────────── */

function parseRoute() {
  const h = (window.location.hash || '').replace(/^#/, '');
  if (/^\/admin\/?$/.test(h)) return { type: 'admin' };
  if (/^\/family\/?$/.test(h)) return { type: 'family' };
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
  const goFamily = useCallback(() => { window.location.hash = '#/family'; }, []);
  const goAdmin = useCallback(() => { window.location.hash = '#/admin'; }, []);

  return (
    <div className="home-scene">
      <header className="home-hero">
        <span className="home-tag">📖 우리 반 그림책 도서관</span>
        <h1 className="home-title">집에서 보는<br /><em>우리 아이 그림책</em></h1>
        <p className="home-sub">학기말 학급 작품을 가정에서 함께 펼쳐 보는 비공개 도서관입니다.</p>
      </header>

      <div className="home-cards">
        <button type="button" className="home-card home-card--family" onClick={goFamily}>
          <span className="home-card-icon">👨‍👩‍👧</span>
          <span className="home-card-label">학부모님으로 들어가기</span>
          <span className="home-card-desc">학급 코드 + 자녀 이름으로 자녀의 작품을 볼 수 있어요</span>
        </button>
        <button type="button" className="home-card home-card--admin" onClick={goAdmin}>
          <span className="home-card-icon">👩‍🏫</span>
          <span className="home-card-label">선생님으로 들어가기</span>
          <span className="home-card-desc">학급을 만들고 학생 작품을 업로드합니다</span>
        </button>
      </div>

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

  if (route.type === 'family') return <FamilyScene />;

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
