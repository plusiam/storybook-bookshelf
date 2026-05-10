/* global React, PageRenderer */
const { useState: useStateBook, useEffect: useEffectBook, useMemo: useMemoBook, useRef: useRefBook, useCallback: useCallbackBook } = React;

/* ======================================================
   책 컴포넌트 — 3D 페이지 플립 + 슬라이드 모드
   ====================================================== */

// 펼침면 모드를 위한 페이지 슬롯 빌더
// 결과: [{left, right, kind}, ...]
//  - 표지/작가/단일 그림책: left=null, right=page
//  - 일반 펼침: left=image, right=text (혹은 두 페이지)
function buildSpreads(pages, mode /* 'flat' | 'spread' */) {
  const spreads = [];
  if (!pages || pages.length === 0) return spreads;

  // 표지 — 항상 단독 우측면
  const cover = pages.find((p) => p.type === 'cover');
  const author = pages.find((p) => p.type === 'author');
  const story = pages.filter((p) => p.type !== 'cover' && p.type !== 'author');

  if (cover) spreads.push({ left: null, right: cover, leftKind: 'blank', rightKind: 'cover' });

  if (mode === 'spread') {
    // 각 스토리 페이지 = 좌(그림) + 우(텍스트)
    for (const p of story) {
      spreads.push({
        left: p,
        right: p,
        leftKind: 'spread-image',
        rightKind: 'spread-text',
        pageRef: p,
      });
    }
  } else {
    // 두 페이지를 하나의 펼침면으로 묶음
    for (let i = 0; i < story.length; i += 2) {
      spreads.push({
        left: story[i] || null,
        right: story[i + 1] || null,
        leftKind: 'full',
        rightKind: 'full',
      });
    }
  }

  if (author) spreads.push({ left: null, right: author, leftKind: 'blank', rightKind: 'author' });

  return spreads;
}

/* ---------- 단일 페이지(슬라이드) 모드용 단순 시퀀스 ---------- */
function buildLinear(pages) {
  return pages.slice();
}

/* ============== 슬라이드 모드 ============== */

function SlideMode({ pages, layout, total, index, dir, book }) {
  // 현재 + 직전 페이지 동시에 렌더해서 트랜지션
  const cur = pages[index];
  return (
    <div className="slide-stage">
      <div key={index} className="slide-card active" style={{ transform: 'translateX(0)' }}>
        <PageRenderer page={cur} book={book} layout={layout} total={total} />
      </div>
    </div>
  );
}

/* ============== 책 모드 (3D 플립) ==============
   책은 두 펼침면을 한꺼번에 보여줌. 각 spread를 sheet 한 장으로 표현.
   - 평소: sheet의 앞면(현재 spread의 우측 페이지) + 다음 sheet의 뒷면(다음 spread의 좌측 페이지)
   - 플립 시: sheet 회전 → 뒷면(다음 spread의 좌측)이 보임
   단순화 구현: 두 인접 spread만 렌더한다. (전체 책의 3D 깊이는 단순화)
*/
function BookMode({ spreads, currentSpread, flipping, flipDir, layout, total, book, isMobile, coverVariant, onZoom }) {
  // 현재 spread (왼/오)
  const cur = spreads[currentSpread] || { left: null, right: null };
  const nextSp = spreads[currentSpread + 1];
  const prevSp = spreads[currentSpread - 1];

  // 플립 중인 sheet
  // 다음으로 갈 때: 우측 페이지(현재 cur.right)가 왼쪽으로 회전. 회전 결과 뒤에 다음 spread의 좌측이 드러남
  // 이전으로 갈 때: 좌측 페이지(현재 cur.left)가 오른쪽으로 회전. 결과 뒤에 이전 spread의 우측이 드러남
  const flipForward = flipping && flipDir === 'next';
  const flipBackward = flipping && flipDir === 'prev';

  return (
    <div className={`book ${isMobile ? 'responsive-collapse' : ''}`}>
      {/* 좌측 정적 페이지 — 플립 백워드 시 임시로 다음 spread의 우측이 보여야 하므로 prev로 갱신 */}
      <div className="book-half left">
        <div className="page-face left-side">
          <PageRenderer
            page={flipBackward ? (prevSp?.left ?? null) : cur.left}
            book={book}
            layout={layout}
            kind={flipBackward ? (prevSp?.leftKind || 'full') : (cur.leftKind || 'full')}
            total={total}
            coverVariant={coverVariant}
            onZoom={onZoom}
          />
        </div>
      </div>

      {/* 우측 정적 페이지 — 플립 포워드 시 다음 spread의 우측을 미리 보여줌 */}
      <div className="book-half right">
        <div className="page-face right-side">
          <PageRenderer
            page={flipForward ? (nextSp?.right ?? null) : cur.right}
            book={book}
            layout={layout}
            kind={flipForward ? (nextSp?.rightKind || 'full') : (cur.rightKind || 'full')}
            total={total}
            coverVariant={coverVariant}
            onZoom={onZoom}
          />
        </div>
      </div>

      {/* 플립 — 다음으로 (우측 페이지가 좌로 회전) */}
      {flipForward && (
        <div
          className="flip-page right-side flipped"
          style={{ pointerEvents: 'none' }}
        >
          {/* 앞면: 현재 우측 페이지 */}
          <div className="page-face front">
            <PageRenderer page={cur.right} book={book} layout={layout} kind={cur.rightKind || 'full'} total={total} coverVariant={coverVariant} onZoom={onZoom} />
          </div>
          {/* 뒷면: 다음 spread의 좌측 */}
          <div className="page-face back">
            <PageRenderer page={nextSp?.left} book={book} layout={layout} kind={nextSp?.leftKind || 'full'} total={total} coverVariant={coverVariant} onZoom={onZoom} />
          </div>
        </div>
      )}

      {/* 플립 — 이전으로 (좌측 페이지가 우로 회전) */}
      {flipBackward && (
        <div
          className="flip-page right-side"
          style={{
            left: 0,
            transformOrigin: 'right center',
            transform: 'rotateY(180deg)',
            animation: 'flipBack 0.85s cubic-bezier(0.55, 0.05, 0.4, 1) forwards',
            pointerEvents: 'none',
          }}
        >
          <div className="page-face back">
            <PageRenderer page={cur.left} book={book} layout={layout} kind={cur.leftKind || 'full'} total={total} coverVariant={coverVariant} onZoom={onZoom} />
          </div>
          <div className="page-face front">
            <PageRenderer page={prevSp?.right} book={book} layout={layout} kind={prevSp?.rightKind || 'full'} total={total} coverVariant={coverVariant} onZoom={onZoom} />
          </div>
        </div>
      )}

      <div className="book-spine" />
    </div>
  );
}

/* ============== 메인 BookViewer ============== */

function BookViewer({ book, mode, layout, soundOn, coverVariant, initialPos = 0, onPosChange, onZoom, bookId }) {
  // mode: 'flat' (책 펼침면, 페이지 2장씩) | 'spread' (한 페이지 = 좌그림+우글) | 'slide' (단일 슬라이드)
  // layout: classic | gallery | immersive | typography (페이지 단위 적용)
  const isMobile = useIsMobile();
  const effectiveMode = isMobile && (mode === 'flat' || mode === 'spread') ? 'mobile-book' : mode;

  // 슬라이드 모드용 페이지 시퀀스
  const linear = useMemoBook(() => buildLinear(book.pages), [book]);
  const spreads = useMemoBook(
    () => buildSpreads(book.pages, mode === 'spread' ? 'spread' : 'flat'),
    [book, mode]
  );

  const total = linear.length;

  const [slideIdx, setSlideIdx] = useStateBook(() => Math.min(initialPos, Math.max(0, (book.pages || []).length - 1)));
  const [spreadIdx, setSpreadIdx] = useStateBook(0);

  // 책 변경 시 저장된 위치로 복원
  useEffectBook(() => {
    setSlideIdx(Math.min(initialPos, Math.max(0, total - 1)));
    // spread 인덱스도 슬라이드에서 추정 (스토리 페이지 i → spread)
    const cover = book.pages.find((p) => p.type === 'cover') ? 1 : 0;
    const story = book.pages.filter((p) => p.type !== 'cover' && p.type !== 'author').length;
    if (initialPos < cover) setSpreadIdx(0);
    else if (initialPos >= cover + story) setSpreadIdx(spreads.length - 1);
    else {
      const storyIdx = initialPos - cover;
      setSpreadIdx(cover + (mode === 'spread' ? storyIdx : Math.floor(storyIdx / 2)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);
  const [flipping, setFlipping] = useStateBook(false);
  const [flipDir, setFlipDir] = useStateBook('next');
  const flipTimerRef = useRefBook(null);

  // 위치 변경 시 저장
  useEffectBook(() => {
    if (!onPosChange) return;
    const idx = (mode === 'slide' || effectiveMode === 'mobile-book') ? slideIdx : spreadIdx;
    onPosChange(idx);
  }, [slideIdx, spreadIdx, mode, effectiveMode, onPosChange]);

  const playSound = useCallbackBook(() => {
    if (!soundOn) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 380;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.frequency.exponentialRampToValueAtTime(280, t + 0.35);
      o.start(t); o.stop(t + 0.36);
    } catch(e) {}
  }, [soundOn]);

  const goNext = useCallbackBook(() => {
    if (mode === 'slide' || effectiveMode === 'mobile-book') {
      setSlideIdx((i) => Math.min(i + 1, total - 1));
      playSound();
      return;
    }
    if (spreadIdx >= spreads.length - 1 || flipping) return;
    setFlipDir('next');
    setFlipping(true);
    playSound();
    clearTimeout(flipTimerRef.current);
    flipTimerRef.current = setTimeout(() => {
      setSpreadIdx((i) => i + 1);
      setFlipping(false);
    }, 850);
  }, [mode, effectiveMode, total, spreadIdx, spreads.length, flipping, playSound]);

  const goPrev = useCallbackBook(() => {
    if (mode === 'slide' || effectiveMode === 'mobile-book') {
      setSlideIdx((i) => Math.max(i - 1, 0));
      playSound();
      return;
    }
    if (spreadIdx <= 0 || flipping) return;
    setFlipDir('prev');
    setFlipping(true);
    playSound();
    clearTimeout(flipTimerRef.current);
    flipTimerRef.current = setTimeout(() => {
      setSpreadIdx((i) => i - 1);
      setFlipping(false);
    }, 850);
  }, [mode, effectiveMode, spreadIdx, flipping, playSound]);

  // 키보드 내비
  useEffectBook(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  // 스와이프
  const stageRef = useRefBook(null);
  useEffectBook(() => {
    const el = stageRef.current;
    if (!el) return;
    let sx = 0, sy = 0;
    const onStart = (e) => {
      const t = e.touches?.[0] || e;
      sx = t.clientX; sy = t.clientY;
    };
    const onEnd = (e) => {
      const t = e.changedTouches?.[0] || e;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goNext(); else goPrev();
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [goNext, goPrev]);

  // 진행도 (슬라이드/책 모드)
  const progressIdx = (mode === 'slide' || effectiveMode === 'mobile-book') ? slideIdx : spreadIdx;
  const progressTotal = (mode === 'slide' || effectiveMode === 'mobile-book') ? total : spreads.length;
  const canPrev = progressIdx > 0;
  const canNext = progressIdx < progressTotal - 1;

  // 스테이지 본문
  let stageContent;
  if (mode === 'slide' || effectiveMode === 'mobile-book') {
    const cur = linear[slideIdx];
    const kind = cur?.type === 'cover' ? 'cover' : cur?.type === 'author' ? 'author' : 'full';
    stageContent = (
      <div className="slide-stage">
        <div key={slideIdx} className="slide-card active">
          <PageRenderer page={cur} book={book} layout={layout} kind={kind} total={total} coverVariant={coverVariant} onZoom={onZoom} />
        </div>
      </div>
    );
  } else {
    stageContent = (
      <BookMode
        spreads={spreads}
        currentSpread={spreadIdx}
        flipping={flipping}
        flipDir={flipDir}
        layout={layout}
        total={total}
        book={book}
        isMobile={false}
        coverVariant={coverVariant}
        onZoom={onZoom}
      />
    );
  }

  return (
    <div className="book-stage" ref={stageRef}>
      {stageContent}
      <button className="nav-arrow prev" onClick={goPrev} disabled={!canPrev} aria-label="이전 페이지">‹</button>
      <button className="nav-arrow next" onClick={goNext} disabled={!canNext} aria-label="다음 페이지">›</button>
      <BookProgress idx={progressIdx} total={progressTotal} onJump={(i) => {
        if (mode === 'slide' || effectiveMode === 'mobile-book') setSlideIdx(i);
        else setSpreadIdx(i);
      }} />
    </div>
  );
}

function BookProgress({ idx, total, onJump }) {
  return (
    <div className="book-bottombar">
      <div className="page-indicator">{idx + 1} / {total}</div>
      <div className="page-dots">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            className={`page-dot ${i === idx ? 'active' : ''}`}
            onClick={() => onJump(i)}
            aria-label={`${i + 1}번째 페이지로`}
          />
        ))}
      </div>
    </div>
  );
}

function useIsMobile() {
  const [m, setM] = useStateBook(() => window.innerWidth < 760);
  useEffectBook(() => {
    const onR = () => setM(window.innerWidth < 760);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  return m;
}

window.BookViewer = BookViewer;
