// 공개 학급 작품집 + 단권 뷰어
/* global React, PB, BookViewer, normalizeBook */
const { useState: useStatePg, useEffect: useEffectPg, useCallback: useCallbackPg, useMemo: useMemoPg } = React;

/* ─── 헬퍼 ─────────────────────────────────────────────────────────── */

// 라우트 안의 view_code, school_year 추출
// 입력 형식: '/c/0000?y=2026-1'
function parseGalleryHash(hash) {
  const m = (hash || '').match(/^\/c\/([0-9]{4})(\?.*)?$/);
  if (!m) return null;
  const viewCode = m[1];
  const qs = m[2] ? new URLSearchParams(m[2].slice(1)) : null;
  return { viewCode, schoolYear: qs ? qs.get('y') || '' : '' };
}

function parseBookHash(hash) {
  const m = (hash || '').match(/^\/b\/([A-Za-z0-9]{4,12})$/);
  return m ? { slug: m[1] } : null;
}

// data에서 표지 그림(첫 cover 페이지의 drawing) 추출
function findCoverDrawing(data) {
  const pages = data?.pages || [];
  const cover = pages.find((p) => p.type === 'cover');
  if (cover && typeof cover.drawing === 'string' && cover.drawing.length > 0) {
    return cover.drawing;
  }
  return null;
}

/* ─── 학년도 입력 폼 (URL에 ?y= 가 없을 때 폴백) ──────────────── */

function YearPrompt({ viewCode, onSubmit }) {
  const [schoolYear, setSchoolYear] = useStatePg('');
  return (
    <div className="pg-prompt">
      <h2 className="pg-prompt-title">학년도가 필요해요</h2>
      <p className="pg-prompt-sub">
        열람 코드 <strong>{viewCode}</strong>는 확인했어요. 어느 학년도의 작품집을 볼지 알려주세요.
      </p>
      <form
        className="pg-prompt-form"
        onSubmit={(e) => { e.preventDefault(); onSubmit(schoolYear); }}
      >
        <input
          type="text"
          className="pg-prompt-input"
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          placeholder="예: 2026-1"
          required
          autoFocus
        />
        <button type="submit" className="btn primary">들어가기</button>
      </form>
    </div>
  );
}

/* ─── 책 카드 ─────────────────────────────────────────────────────── */

function PublicBookCard({ row, onOpen }) {
  const cover = findCoverDrawing(row?.data);

  return (
    <button
      type="button"
      className="pg-book-card"
      onClick={onOpen}
      aria-label={`${row.title || '제목 없는 책'} 펼치기`}
    >
      <div className="pg-book-cover">
        {cover ? (
          <img src={cover} alt="" loading="lazy" />
        ) : (
          <span className="pg-book-cover-fallback">📖</span>
        )}
      </div>
      <div className="pg-book-info">
        <h4 className="pg-book-title">{row.title || '제목 없음'}</h4>
        <p className="pg-book-author">✍️ {row.pen_name}</p>
        {row.intro && <p className="pg-book-intro">{row.intro}</p>}
      </div>
    </button>
  );
}

/* ─── 학급 작품집 ─────────────────────────────────────────────────── */

function PublicGallery({ viewCode, schoolYear, onOpenBook, onMissingYear }) {
  const [state, setState] = useStatePg({ loading: true, error: null, rows: [] });

  const reload = useCallbackPg(async (signal) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const rows = await PB.viewClassBooks(viewCode, schoolYear);
      if (signal?.aborted) return;
      setState({ loading: false, error: null, rows });
    } catch (e) {
      if (!signal?.aborted) {
        setState({ loading: false, error: e?.message || '학급을 불러오지 못했어요', rows: [] });
      }
    }
  }, [viewCode, schoolYear]);

  useEffectPg(() => {
    if (!schoolYear) return;  // 학년도 없으면 YearPrompt가 먼저
    const controller = new AbortController();
    reload(controller.signal);
    return () => controller.abort();
  }, [reload, schoolYear]);

  if (!schoolYear) {
    return (
      <div className="pg-scene">
        <YearPrompt viewCode={viewCode} onSubmit={onMissingYear} />
      </div>
    );
  }

  // 학급 정보는 첫 row의 class_name·class_grade·class_no에서 추출
  // 결과가 비어 있으면 학급 자체가 없거나 코드/학년도가 틀린 것
  const cls = state.rows[0];

  return (
    <div className="pg-scene">
      <div className="pg-topbar">
        <a className="btn btn-sm" href="#/" aria-label="홈으로">← 홈</a>
      </div>
      <header className="pg-header">
        <span className="pg-tag">📖 학급 작품집</span>
        {cls ? (
          <>
            <h1 className="pg-title">{cls.class_name}</h1>
            <p className="pg-meta">
              {schoolYear} · {cls.class_grade}학년 {cls.class_no}반 · 작품 {state.rows.length}권
            </p>
          </>
        ) : (
          <>
            <h1 className="pg-title">열람 코드 {viewCode}</h1>
            <p className="pg-meta">{schoolYear}</p>
          </>
        )}
      </header>

      {state.loading && (
        <div className="pg-state">
          <span>⏳</span> 작품집을 펼치는 중...
        </div>
      )}

      {!state.loading && state.error && (
        <div className="pg-state pg-state--error">
          <p>{state.error}</p>
          <button type="button" className="btn" onClick={() => reload()}>다시 시도</button>
        </div>
      )}

      {!state.loading && !state.error && state.rows.length === 0 && (
        <div className="pg-empty">
          <div className="pg-empty-icon">🔍</div>
          <h3>작품을 찾을 수 없어요</h3>
          <p>
            열람 코드(<code>{viewCode}</code>) 또는 학년도(<code>{schoolYear}</code>)가 맞지 않거나,
            아직 학생들이 작품을 올리지 않았을 수 있어요.<br />
            담임 선생님이 알려주신 정보를 한 번 더 확인해 주세요.
          </p>
        </div>
      )}

      {!state.loading && state.rows.length > 0 && (
        <section className="pg-grid">
          {state.rows.map((r) => (
            <PublicBookCard key={r.slug} row={r} onOpen={() => onOpenBook(r)} />
          ))}
        </section>
      )}

      <footer className="pg-footer">
        만든이 · <strong>룰루랄라 한기쌤</strong>
      </footer>
    </div>
  );
}

/* ─── 단권 뷰어 ───────────────────────────────────────────────────── */

function PublicBookView({ slug, onBack }) {
  const [state, setState] = useStatePg({ loading: true, error: null, row: null });

  useEffectPg(() => {
    const controller = new AbortController();
    (async () => {
      setState({ loading: true, error: null, row: null });
      try {
        const row = await PB.getBookBySlug(slug);
        if (controller.signal.aborted) return;
        if (!row) {
          setState({ loading: false, error: '책을 찾을 수 없어요', row: null });
          return;
        }
        setState({ loading: false, error: null, row });
      } catch (e) {
        if (!controller.signal.aborted) {
          setState({ loading: false, error: e?.message || '책을 불러오지 못했어요', row: null });
        }
      }
    })();
    return () => controller.abort();
  }, [slug]);

  const book = useMemoPg(() => normalizeBook(state.row?.data), [state.row]);

  if (state.loading) {
    return (
      <div className="pg-state">
        <span>📚</span> 책을 꺼내는 중...
      </div>
    );
  }

  if (state.error || !book) {
    return (
      <div className="pg-empty">
        <div className="pg-empty-icon">😢</div>
        <h3>{state.error || '책 데이터가 깨져 있어요'}</h3>
        <button type="button" className="btn primary" onClick={onBack}>← 돌아가기</button>
      </div>
    );
  }

  const row = state.row;
  return (
    <div className="pg-book-view">
      <header className="pg-book-view-bar">
        <button type="button" className="btn btn-sm" onClick={onBack}>
          ← 뒤로
        </button>
        <div className="pg-book-view-title-block">
          <h2 className="pg-book-view-title">{row.title || book.student?.title || '제목 없음'}</h2>
          <span className="pg-book-view-author">
            ✍️ {row.pen_name}
            {row.class_name && ` · ${row.class_name}`}
          </span>
        </div>
      </header>
      <div className="pg-book-view-stage">
        <BookViewer
          book={book}
          bookId={`pg-${slug}`}
          mode="slide"
          layout="classic"
          coverVariant="classic"
          soundOn={false}
          initialPos={0}
          onPosChange={() => {}}
          onZoom={() => {}}
        />
      </div>
    </div>
  );
}

window.PublicGallery = PublicGallery;
window.PublicBookView = PublicBookView;
window.parseGalleryHash = parseGalleryHash;
window.parseBookHash = parseBookHash;
