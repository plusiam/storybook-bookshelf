/* global React, ReactDOM, UploadScreen, BookViewer, IntroAnimation, normalizeBook,
          ZoomModal, TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect, TweakToggle, TweakButton,
          PB_IDB */
const { useState, useEffect, useCallback, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "storybook",
  "mode": "flat",
  "layout": "classic",
  "coverVariant": "classic",
  "fontFamily": "playful",
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

function App() {
  const [library, setLibrary] = useState([]);
  const [book, setBook] = useState(null);
  const [introDone, setIntroDone] = useState(false);
  const [zoom, setZoom] = useState(null); // { src, caption }
  const positionsRef = useRef({});

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

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

  useEffect(() => {
    document.body.dataset.theme = t.theme || 'storybook';
    const f = FONT_PRESETS[t.fontFamily] || FONT_PRESETS.playful;
    document.documentElement.style.setProperty('--font-display', f.display);
    document.documentElement.style.setProperty('--font-body', f.body);
    document.documentElement.style.setProperty('--font-hand', f.hand);
    document.documentElement.style.setProperty('--font-storybook', f.storybook);
  }, [t.theme, t.fontFamily]);

  // ESC로 줌 닫기
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e) => { if (e.key === 'Escape') setZoom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

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
    setIntroDone(!t.showIntro);
  }, [t.showIntro]);

  const loadSample = useCallback(async () => {
    try {
      const res = await fetch('sample-book.json');
      const data = await res.json();
      handleLoad(data);
    } catch {}
  }, [handleLoad]);

  const openFromLibrary = useCallback((i) => {
    const b = library[i];
    if (b) { setBook(b); setIntroDone(!t.showIntro); }
  }, [library, t.showIntro]);

  const removeFromLibrary = useCallback((i) => {
    setLibrary((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      PB_IDB.saveLibrary(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setBook(null);
    setIntroDone(false);
  }, []);

  const printPDF = useCallback(() => { window.print(); }, []);

  if (!book) {
    return (
      <UploadScreen
        onLoad={handleLoad}
        library={library}
        onOpenBook={openFromLibrary}
        onRemoveBook={removeFromLibrary}
        onLoadSample={loadSample}
      />
    );
  }

  const bk = bookKey(book);
  const initialPos = positionsRef.current[bk] || 0;

  return (
    <div className="book-screen">
      <div className="book-topbar">
        <div className="book-topbar-left">
          <button className="icon-btn" onClick={reset} title="책장으로 돌아가기" aria-label="책장으로 돌아가기">↩</button>
          <h2 className="book-title-mini">{book.student?.title || '나의 그림책'}</h2>
        </div>
        <div className="book-topbar-right">
          <span className="book-author-mini">글·그림 {book.student?.name || ''}</span>
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

        <TweakSection label="내보내기">
          <TweakButton label="🖨 PDF로 인쇄·저장" onClick={printPDF} />
          <TweakButton label="📂 책장으로 돌아가기" onClick={reset} secondary />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

/* ===== 인쇄용 ===== */
function PrintLayout({ book }) {
  return (
    <div className="print-only" style={{ display: 'none' }}>
      {book.pages.map((p, i) => (
        <div key={i} className="print-page" style={{ width: '100%', aspectRatio: '8/10', padding: 24, background: 'white', color: '#222', breakAfter: 'page' }}>
          {p.type === 'cover' && (
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: 36, marginBottom: 8 }}>{book.student?.title}</h1>
              <p style={{ fontSize: 14, color: '#666' }}>주인공 · {book.student?.protagonist}</p>
              {p.drawing && <img src={p.drawing} style={{ width: '70%', margin: '24px auto', display: 'block', borderRadius: 16 }} />}
              <p style={{ marginTop: 24 }}>글·그림 {book.student?.name}</p>
            </div>
          )}
          {p.type !== 'cover' && p.type !== 'author' && (
            <div>
              {p.prompt && <p style={{ color: '#a55', fontSize: 18 }}>{p.prompt}</p>}
              {p.drawing && <img src={p.drawing} style={{ width: '100%', maxHeight: '60%', objectFit: 'contain', margin: '12px 0' }} />}
              <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7 }}>{p.text}</p>
            </div>
          )}
          {p.type === 'author' && (
            <div style={{ textAlign: 'center' }}>
              <h2>작가의 말</h2>
              <p>{book.author?.name || book.student?.name}</p>
              {book.author?.message && <p style={{ whiteSpace: 'pre-wrap' }}>{book.author.message}</p>}
              {book.author?.dedicationTo && <p>— {book.author.dedicationTo}에게 —</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
