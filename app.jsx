/* global React, ReactDOM, UploadScreen, BookViewer, IntroAnimation, normalizeBook,
          ZoomModal, TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect, TweakToggle, TweakButton, TweakSlider,
          ShareModal, PB, PB_IDB */
const { useState, useEffect, useCallback, useRef } = React;

/* ──────────────────────────────────────────────
   hash 라우팅 — 단순 파서
   #/             → home (책장)
   #/b/:slug      → Supabase에서 책 한 권 펼치기
   ────────────────────────────────────────────── */
function parseRoute() {
  const h = (window.location.hash || '').replace(/^#/, '');
  const mBook = h.match(/^\/b\/([A-Za-z0-9]{4,12})$/);
  if (mBook) return { type: 'book', slug: mBook[1] };
  const mGallery = h.match(/^\/g\/(.+)$/);
  if (mGallery) return { type: 'gallery', classCode: decodeURIComponent(mGallery[1]) };
  return { type: 'home' };
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "storybook",
  "mode": "flat",
  "layout": "classic",
  "coverVariant": "classic",
  "fontFamily": "playful",
  "textScale": 1,
  "soundOn": true,
  "showIntro": true
}/*EDITMODE-END*/;

const FONT_PRESETS = {
  playful: { display: "'Jua', sans-serif", body: "'Gowun Dodum', sans-serif", hand: "'Nanum Pen Script', cursive", storybook: "'Gowun Batang', serif" },
  hand: { display: "'Nanum Pen Script', cursive", body: "'Gaegu', sans-serif", hand: "'Nanum Pen Script', cursive", storybook: "'Gaegu', sans-serif" },
  classic: { display: "'Gowun Batang', serif", body: "'Gowun Dodum', sans-serif", hand: "'Hi Melody', cursive", storybook: "'Gowun Batang', serif" },
  cute: { display: "'Hi Melody', cursive", body: "'Gaegu', sans-serif", hand: "'Hi Melody', cursive", storybook: "'Gaegu', sans-serif" },
};

function bookKey(book) {
  return PB_IDB.bookKey(book);
}

function useFullscreen() {
  const [isFS, setIsFS] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFS(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const enter = () => document.documentElement.requestFullscreen?.().catch(() => {});
  const exit  = () => document.exitFullscreen?.().catch(() => {});
  const toggle = () => isFS ? exit() : enter();

  return { isFS, toggle };
}

function App() {
  const [library, setLibrary] = useState([]);
  const [book, setBook] = useState(null);
  const [bookSource, setBookSource] = useState('local'); // 'local' | 'remote'
  const [introDone, setIntroDone] = useState(false);
  const [zoom, setZoom] = useState(null); // { src, caption }
  const [expanded, setExpanded] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [route, setRoute] = useState(parseRoute);
  const [remoteState, setRemoteState] = useState({ loading: false, error: null });
  const [shareBook, setShareBook] = useState(null);
  const positionsRef = useRef({});
  const { isFS, toggle: toggleFS } = useFullscreen();

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const openTweaks = useCallback(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: '__activate_edit_mode' } }));
  }, []);

  // 앱 시작 시 마이그레이션 후 라이브러리·위치 로드
  useEffect(() => {
    (async () => {
      await PB_IDB.migrate();
      const [books, positions] = await Promise.all([
        PB_IDB.loadLibrary(),
        PB_IDB.loadPositions(),
      ]);
      positionsRef.current = positions;
      setLibrary(books.map(normalizeBook).filter(Boolean));
    })();
  }, []);

  // hash 라우팅 — URL 바뀔 때마다 route 갱신
  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // #/b/:slug 로 들어오면 Supabase에서 책 fetch
  useEffect(() => {
    if (route.type !== 'book') return;
    let cancelled = false;
    setRemoteState({ loading: true, error: null });
    (async () => {
      try {
        if (!PB || !PB.isConfigured()) throw new Error('Supabase 설정이 안 돼 있어요.');
        const row = await PB.getBook(route.slug);
        if (cancelled) return;
        if (!row) {
          setRemoteState({ loading: false, error: '책을 찾을 수 없어요. 링크가 만료되었거나 잘못된 주소일 수 있어요.' });
          return;
        }
        const norm = normalizeBook(row.data);
        if (!norm) {
          setRemoteState({ loading: false, error: '책 데이터가 깨져 있어요.' });
          return;
        }
        setBook(norm);
        setBookSource('remote');
        setIntroDone(!t.showIntro);
        setRemoteState({ loading: false, error: null });
      } catch (e) {
        if (!cancelled) setRemoteState({ loading: false, error: e?.message || '책을 불러오지 못했어요.' });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.type, route.slug]);

  useEffect(() => {
    document.body.dataset.theme = t.theme || 'storybook';
    const f = FONT_PRESETS[t.fontFamily] || FONT_PRESETS.playful;
    document.documentElement.style.setProperty('--font-display', f.display);
    document.documentElement.style.setProperty('--font-body', f.body);
    document.documentElement.style.setProperty('--font-hand', f.hand);
    document.documentElement.style.setProperty('--font-storybook', f.storybook);
  }, [t.theme, t.fontFamily]);

  // ESC로 줌 닫기 / F키로 전체화면 토글
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setZoom(null); setExpanded(false); }
      if (e.key === 'f' || e.key === 'F') { if (!zoom) toggleFS(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom, toggleFS]);

  const handleLoad = useCallback((data, fileName, isMulti) => {
    if (isMulti && Array.isArray(data)) {
      const norm = data.map(normalizeBook).filter(Boolean);
      setLibrary((prev) => {
        const merged = [...prev];
        for (const b of norm) {
          const k = bookKey(b);
          const i = merged.findIndex((m) => bookKey(m) === k);
          if (i >= 0) merged[i] = b; else merged.push(b);
        }
        PB_IDB.saveLibrary(merged);
        return merged;
      });
      return;
    }
    const norm = normalizeBook(data);
    if (!norm) return;
    setLibrary((prev) => {
      const k = bookKey(norm);
      const i = prev.findIndex((m) => bookKey(m) === k);
      const next = [...prev];
      if (i >= 0) next[i] = norm; else next.push(norm);
      PB_IDB.saveLibrary(next);
      return next;
    });
    setBook(norm);
    setBookSource('local');
    setIntroDone(!t.showIntro);
  }, [t.showIntro]);

  const loadSample = useCallback(async (mode) => {
    try {
      const res = await fetch('sample-book.json');
      const data = await res.json();
      if (mode) setTweak('mode', mode);
      handleLoad(data);
    } catch {}
  }, [handleLoad, setTweak]);

  const openFromLibrary = useCallback((i) => {
    const b = library[i];
    if (b) { setBook(b); setBookSource('local'); setIntroDone(!t.showIntro); }
  }, [library, t.showIntro]);

  const handleShareBook = useCallback((b) => {
    setShareBook(b || book);
  }, [book]);

  const removeFromLibrary = useCallback((i) => {
    setLibrary((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      PB_IDB.saveLibrary(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setBook(null);
    setBookSource('local');
    setIntroDone(false);
    setRemoteState({ loading: false, error: null });
    // 단일 공유 링크(#/b/...)는 정리해서 홈으로
    // 갤러리(#/g/...)는 유지 → 갤러리 화면으로 복귀
    if ((window.location.hash || '').startsWith('#/b/')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      setRoute({ type: 'home' });
    }
  }, []);

  // 갤러리(#/g/...)에서 도서관으로 가는 명시적 핸들러
  const goHome = useCallback(() => {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setRoute({ type: 'home' });
    setBook(null);
    setBookSource('local');
    setRemoteState({ loading: false, error: null });
  }, []);

  // 갤러리에서 책 한 권 클릭 → 원격 책으로 펼치기
  const openFromGallery = useCallback((b) => {
    if (!b) return;
    setBook(b);
    setBookSource('remote');
    setIntroDone(!t.showIntro);
  }, [t.showIntro]);

  const clearLibrary = useCallback(async () => {
    await PB_IDB.clearLibrary();
    positionsRef.current = {};
    setLibrary([]);
  }, []);

  const printPDF = useCallback(() => { window.print(); }, []);

  // 공유 링크(#/b/:slug)로 들어왔는데 아직 로딩/에러 상태
  if (!book && route.type === 'book') {
    if (remoteState.loading) {
      return (
        <div className="remote-state">
          <div className="remote-state-spinner">📚</div>
          <p className="remote-state-text">책장에서 책을 꺼내는 중...</p>
        </div>
      );
    }
    if (remoteState.error) {
      return (
        <div className="remote-state remote-state--error">
          <div className="remote-state-icon">😢</div>
          <h2 className="remote-state-title">앗, 책이 없어요</h2>
          <p className="remote-state-text">{remoteState.error}</p>
          <button className="btn primary" onClick={reset}>📚 도서관으로 가기</button>
        </div>
      );
    }
  }

  // 학급 작품집(#/g/:classCode)
  if (!book && route.type === 'gallery') {
    return (
      <>
        <Gallery
          classCode={route.classCode}
          onOpenBook={openFromGallery}
          onBack={goHome}
        />
        {shareBook && <ShareModal book={shareBook} onClose={() => setShareBook(null)} />}
      </>
    );
  }

  if (!book) {
    return (
      <>
        <UploadScreen
          onLoad={handleLoad}
          library={library}
          onOpenBook={openFromLibrary}
          onRemoveBook={removeFromLibrary}
          onLoadSample={loadSample}
          onClearLibrary={clearLibrary}
          onShareBook={handleShareBook}
          onOpenGallery={(code) => {
            history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/g/${encodeURIComponent(code)}`);
            setRoute({ type: 'gallery', classCode: code });
          }}
        />
        {shareBook && <ShareModal book={shareBook} onClose={() => setShareBook(null)} />}
      </>
    );
  }

  const bk = bookKey(book);
  const initialPos = positionsRef.current[bk] || 0;

  return (
    <div className={`book-screen${expanded ? ' is-expanded' : ''}`} style={{ '--text-scale': t.textScale }}>
      <div className="book-topbar">
        <div className="book-topbar-left">
          {!expanded && (
            <button className="icon-btn" onClick={reset} title="책장으로 돌아가기" aria-label="책장으로 돌아가기">↩</button>
          )}
          <h2 className="book-title-mini">{book.student?.title || '나의 그림책'}</h2>
        </div>
        <div className="book-topbar-right">
          <span className="book-author-mini">글·그림 {book.student?.name || ''}</span>
          {bookSource === 'local' && (
            <button
              className="icon-btn"
              onClick={() => handleShareBook(book)}
              title="공유 링크 만들기"
              aria-label="공유 링크 만들기"
            >🔗</button>
          )}
          <button className="icon-btn" onClick={openTweaks} title="디자인·보기 방식 바꾸기" aria-label="디자인 패널 열기">🎨</button>
          <button
            className={`icon-btn${expanded ? ' active' : ''}`}
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? '일반 모드로 (Esc)' : '꽉 찬 화면으로'}
            aria-label={expanded ? '일반 모드' : '꽉 찬 화면'}
          >{expanded ? '⊠' : '⊞'}</button>
          <button
            className={`icon-btn${isFS ? ' active' : ''}`}
            onClick={toggleFS}
            title={isFS ? '전체화면 나가기 (F)' : '전체화면 (F)'}
            aria-label={isFS ? '전체화면 나가기' : '전체화면'}
          >{isFS ? '🗗' : '🗖'}</button>
          <button className="icon-btn" onClick={printPDF} title="PDF로 인쇄" aria-label="PDF로 인쇄">🖨</button>
        </div>
      </div>

      {!introDone && t.showIntro && (
        <IntroAnimation
          title={book.student?.title}
          onSkip={() => setIntroDone(true)}
          onDone={() => setIntroDone(true)}
        />
      )}

      <BookViewer
        book={book}
        bookId={bk}
        mode={t.mode}
        layout={t.layout}
        coverVariant={t.coverVariant}
        soundOn={t.soundOn}
        initialPos={initialPos}
        onPosChange={(i) => {
          positionsRef.current[bk] = i;
          PB_IDB.savePosition(bk, i);
        }}
        onZoom={(src, caption) => setZoom({ src, caption })}
      />

      <PrintLayout book={book} />

      {zoom && <ZoomModal src={zoom.src} caption={zoom.caption} onClose={() => setZoom(null)} />}

      {shareBook && <ShareModal book={shareBook} onClose={() => setShareBook(null)} />}

      <TweaksPanel title="🎨 디자인 바꾸기">
        <TweakSection label="테마">
          <TweakSelect
            label="색감" value={t.theme} onChange={(v) => setTweak('theme', v)}
            options={[
              { value: 'storybook', label: '🌷 동화책 (기본)' },
              { value: 'forest', label: '🌳 숲속 친구' },
              { value: 'cream', label: '🤍 미니멀 크림' },
              { value: 'night', label: '🌙 밤하늘' },
            ]}
          />
          <TweakSelect
            label="글꼴 스타일" value={t.fontFamily} onChange={(v) => setTweak('fontFamily', v)}
            options={[
              { value: 'playful', label: '✨ 발랄한 (기본)' },
              { value: 'hand', label: '✏️ 손글씨' },
              { value: 'classic', label: '📚 단정한 책' },
              { value: 'cute', label: '🌸 귀여운' },
            ]}
          />
          <TweakSlider label="글자 크기" value={t.textScale} min={0.8} max={1.5} step={0.05} unit="×" onChange={(v) => setTweak('textScale', v)} />
        </TweakSection>

        <TweakSection label="표지 디자인">
          <TweakSelect
            label="표지 스타일" value={t.coverVariant} onChange={(v) => setTweak('coverVariant', v)}
            options={[
              { value: 'classic', label: '⭕ 클래식 (원형 그림)' },
              { value: 'fullbleed', label: '🌅 풀그림 (전면)' },
              { value: 'split', label: '📐 좌우 분할' },
              { value: 'frame', label: '🖼 액자형' },
            ]}
          />
        </TweakSection>

        <TweakSection label="책 모드">
          <TweakRadio
            label="펼침 방식" value={t.mode} onChange={(v) => setTweak('mode', v)}
            options={[
              { value: 'flat', label: '두 면' },
              { value: 'spread', label: '그림+글' },
              { value: 'slide', label: '한 면' },
            ]}
          />
          <TweakSelect
            label="페이지 레이아웃" value={t.layout} onChange={(v) => setTweak('layout', v)}
            options={[
              { value: 'classic', label: '📖 정석 (그림 위, 글 아래)' },
              { value: 'gallery', label: '🖼 갤러리 (액자형)' },
              { value: 'immersive', label: '🌅 풀그림 (텍스트 오버레이)' },
              { value: 'typography', label: '🔤 타이포 중심' },
            ]}
          />
        </TweakSection>

        <TweakSection label="효과">
          <TweakToggle label="페이지 넘김 소리" value={t.soundOn} onChange={(v) => setTweak('soundOn', v)} />
          <TweakToggle label="표지 인트로 애니메이션" value={t.showIntro} onChange={(v) => setTweak('showIntro', v)} />
        </TweakSection>

        <TweakSection label="화면">
          <TweakButton label={expanded ? '⊠ 일반 모드로' : '⊞ 꽉 찬 화면으로'} onClick={() => setExpanded((v) => !v)} secondary />
          <TweakButton label={isFS ? '🗗 전체화면 나가기' : '🗖 전체화면 (F키)'} onClick={toggleFS} secondary />
        </TweakSection>

        <TweakSection label="내보내기">
          <TweakButton label="🖨 PDF로 인쇄·저장" onClick={printPDF} />
          <TweakButton label="📂 책장으로 돌아가기" onClick={reset} secondary />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

/* ===== 인쇄용 (A4 가로 2면 책형) ===== */
function PrintHalf({ page, book }) {
  if (!page) return <div className="print-half empty" />;
  const p = page;
  if (p.type === 'cover') {
    return (
      <div className="print-half">
        <div className="ph-title">{book.student?.title}</div>
        {book.student?.protagonist && (
          <div className="ph-subtitle">주인공 · {book.student.protagonist}</div>
        )}
        {p.drawing && <img src={p.drawing} alt="" />}
        <div className="ph-author">글·그림 {book.student?.name}</div>
      </div>
    );
  }
  if (p.type === 'author') {
    return (
      <div className="print-half">
        <div className="ph-heading">작가의 말</div>
        <div className="ph-subtitle">{book.author?.name || book.student?.name}</div>
        {book.author?.message && <div className="ph-msg">{book.author.message}</div>}
        {book.author?.dedicationTo && (
          <div className="ph-dedicate">— {book.author.dedicationTo}에게 —</div>
        )}
      </div>
    );
  }
  return (
    <div className="print-half">
      {p.prompt && <div className="ph-prompt">{p.prompt}</div>}
      {p.drawing && <img src={p.drawing} alt="" />}
      {p.text && <div className="ph-text">{p.text}</div>}
    </div>
  );
}

function PrintLayout({ book }) {
  // 페이지를 시트(A4 가로 1장 = 2면)로 묶음
  // 표지: 왼쪽 빈 면 + 오른쪽 표지
  // 본문: 2장씩 좌우 페어
  // 작가의 말: 왼쪽 배치 + 오른쪽 빈 면
  const pages = book.pages || [];
  const sheets = [];

  let i = 0;
  while (i < pages.length) {
    const p = pages[i];
    if (p.type === 'cover') {
      sheets.push([null, p]);
      i++;
    } else if (p.type === 'author') {
      sheets.push([p, null]);
      i++;
    } else {
      const next = pages[i + 1];
      if (next && next.type !== 'cover' && next.type !== 'author') {
        sheets.push([p, next]);
        i += 2;
      } else {
        sheets.push([p, null]);
        i++;
      }
    }
  }

  return (
    <div className="print-only">
      {sheets.map((pair, si) => (
        <div key={si} className="print-sheet">
          <PrintHalf page={pair[0]} book={book} />
          <PrintHalf page={pair[1]} book={book} />
        </div>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
