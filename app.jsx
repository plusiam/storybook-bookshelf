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

function defaultSchoolYearHome() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 7) return `${y}-1`;
  if (m >= 8) return `${y}-2`;
  return `${y - 1}-2`;
}

function GuestEntryForm({ onBack }) {
  const [code, setCode] = useState('');
  const [year, setYear] = useState(defaultSchoolYearHome);

  const submit = (e) => {
    e.preventDefault();
    window.location.hash = `#/c/${code}?y=${encodeURIComponent(year)}`;
  };

  return (
    <div className="home-scene">
      <form className="guest-entry" onSubmit={submit}>
        <header className="guest-entry-header">
          <span className="home-tag">📖 작품집 들어가기</span>
          <h1 className="guest-entry-title">학급 코드를 입력하세요</h1>
          <p className="guest-entry-sub">
            선생님이 알려주신 <strong>4자리 열람 코드</strong>와 <strong>학년도</strong>를 입력하면 작품집이 열려요.
          </p>
        </header>

        <label className="guest-entry-field guest-entry-field--code">
          <span>열람 코드 (4자리)</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            required
            autoFocus
          />
        </label>

        <label className="guest-entry-field">
          <span>학년도</span>
          <input
            type="text"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2026-1"
            required
          />
        </label>

        <button
          type="submit"
          className="btn primary guest-entry-submit"
          disabled={code.length !== 4 || !year.trim()}
        >
          작품집 열기
        </button>
        <button type="button" className="btn guest-entry-back" onClick={onBack}>
          ← 뒤로
        </button>
      </form>
    </div>
  );
}

function HomeScene() {
  const [guestMode, setGuestMode] = useState(false);
  const goUpload = useCallback(() => { window.location.hash = '#/upload'; }, []);
  const goAdmin = useCallback(() => { window.location.hash = '#/admin'; }, []);

  if (guestMode) {
    return <GuestEntryForm onBack={() => setGuestMode(false)} />;
  }

  return (
    <div className="home-scene">
      <header className="home-hero">
        <span className="home-tag">📖 우리 학급 작가의 작품집</span>
        <h1 className="home-title">학생 작가들의<br /><em>그림책 도서관</em></h1>
        <p className="home-sub">완성한 작품을 학급 작품집에 올리고, 친구·가족과 함께 펼쳐 봐요.</p>
      </header>

      <div className="home-cards">
        <button type="button" className="home-card home-card--guest" onClick={() => setGuestMode(true)}>
          <span className="home-card-icon">📖</span>
          <span className="home-card-label">작품집 보러 가기</span>
          <span className="home-card-desc">4자리 열람 코드로 학급 작품집을 봐요</span>
        </button>
        <button type="button" className="home-card home-card--upload" onClick={goUpload}>
          <span className="home-card-icon">✍️</span>
          <span className="home-card-label">작가로 올리기</span>
          <span className="home-card-desc">스토리보드에서 만든 JSON과 6자리 코드로 올려요</span>
        </button>
        <button type="button" className="home-card home-card--admin" onClick={goAdmin}>
          <span className="home-card-icon">👩‍🏫</span>
          <span className="home-card-label">선생님으로 들어가기</span>
          <span className="home-card-desc">학급을 만들고 두 종류 코드를 발급합니다</span>
        </button>
      </div>

      <section className="home-howto">
        <h2 className="home-howto-title">📚 이렇게 활용해요</h2>
        <ol className="home-howto-steps">
          <li className="home-howto-step">
            <span className="home-howto-num">1</span>
            <div className="home-howto-body">
              <strong>스토리보드에서 그림책 만들기</strong>
              <p>
                <a
                  className="home-howto-link"
                  href="https://plusiam.github.io/picturebook-storyboard/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ✏️ picturebook-storyboard
                </a>
                에서 페이지마다 그림과 글을 채워 완성한 뒤 <strong>JSON 파일</strong>로 저장합니다.
              </p>
            </div>
          </li>
          <li className="home-howto-step">
            <span className="home-howto-num">2</span>
            <div className="home-howto-body">
              <strong>작가로 올리기</strong>
              <p>위의 <em>✍️ 작가로 올리기</em>에서 선생님이 알려주신 <strong>6자리 업로드 코드</strong>와 함께 JSON 파일을 끌어다 놓으면 학급 작품집에 등록돼요.</p>
            </div>
          </li>
          <li className="home-howto-step">
            <span className="home-howto-num">3</span>
            <div className="home-howto-body">
              <strong>친구·가족과 함께 보기</strong>
              <p>업로드 후 받은 단권 공유 링크를 친구·가족에게 보내거나, 선생님이 알려주신 <strong>4자리 열람 코드</strong>로 학급 작품집 전체를 펼쳐 봐요.</p>
            </div>
          </li>
        </ol>
        <p className="home-howto-tip">
          👩‍🏫 선생님은 위 <em>선생님으로 들어가기</em>에서 학급을 만들면 자동으로 <strong>열람 코드(4자리)</strong>와 <strong>업로드 코드(6자리)</strong>가 발급됩니다. 각 코드별 안내문은 어드민에서 한 번에 복사할 수 있어요.
        </p>
      </section>

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
