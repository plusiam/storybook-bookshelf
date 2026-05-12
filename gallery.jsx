// 학급 작품집 — 같은 학급코드로 올라온 책들을 다단 책장으로 모아 보기
/* global React, MultiShelf, PB, normalizeBook */
const { useState: useStateGL, useEffect: useEffectGL, useCallback: useCallbackGL } = React;

/* ======================================================
   Gallery
   - URL: #/g/:classCode
   - Supabase에서 같은 class_code 책들 fetch
   - 다단 책장으로 표시 + 권수 카운터
   - 책 한 권 클릭 → 부모에게 위임 (onOpen)
   ====================================================== */

function Gallery({ classCode, onOpenBook, onBack }) {
  const [state, setState] = useStateGL({ loading: true, error: null, books: [] });

  const fetchBooks = useCallbackGL(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      if (!PB || !PB.isConfigured()) {
        throw new Error('Supabase 설정이 안 돼 있어요.');
      }
      const rows = await PB.getClassBooks(classCode);
      const books = rows
        .map((r) => {
          const norm = normalizeBook(r.data);
          if (!norm) return null;
          // slug·nickname을 normalized book에 메타로 부착
          norm.__slug = r.slug;
          norm.__remoteNickname = r.nickname;
          return norm;
        })
        .filter(Boolean);
      setState({ loading: false, error: null, books });
    } catch (e) {
      setState({ loading: false, error: e?.message || '학급 책장을 불러오지 못했어요.', books: [] });
    }
  }, [classCode]);

  useEffectGL(() => { fetchBooks(); }, [fetchBooks]);

  return (
    <div className="gallery-scene">
      <header className="gallery-header">
        <button className="gallery-back" onClick={onBack} aria-label="도서관으로 가기" title="도서관으로 가기">↩</button>
        <div className="gallery-title-block">
          <span className="gallery-tag">📚 학급 작품집</span>
          <h1 className="gallery-title"><em>{classCode}</em></h1>
          {!state.loading && !state.error && (
            <p className="gallery-count">
              <strong>{state.books.length}</strong>권의 그림책이 모였어요
            </p>
          )}
        </div>
        <button
          className="gallery-refresh"
          onClick={fetchBooks}
          disabled={state.loading}
          aria-label="새로고침"
          title="새로고침"
        >🔄</button>
      </header>

      {state.loading && (
        <div className="gallery-state">
          <div className="gallery-spinner">📚</div>
          <p>책장을 정리하는 중...</p>
        </div>
      )}

      {!state.loading && state.error && (
        <div className="gallery-state gallery-state--error">
          <div className="gallery-state-icon">😢</div>
          <p>{state.error}</p>
          <button className="btn primary" onClick={fetchBooks}>🔄 다시 시도</button>
        </div>
      )}

      {!state.loading && !state.error && state.books.length === 0 && (
        <div className="gallery-state gallery-state--empty">
          <div className="gallery-state-icon">📖</div>
          <h2>아직 책이 없어요</h2>
          <p>이 학급 코드(<code>{classCode}</code>)로 올라온 책이 아직 없습니다.<br />
          학생들이 책을 올리면 여기에 자동으로 나타나요.</p>
        </div>
      )}

      {!state.loading && !state.error && state.books.length > 0 && (
        <section className="gallery-stage">
          <MultiShelf
            books={state.books}
            onOpen={(book) => onOpenBook && onOpenBook(book)}
            onRemove={null}
            onShare={null}
          />
        </section>
      )}

      <footer className="gallery-footer">
        <p className="gallery-hint">
          💡 책을 클릭하면 펼쳐서 읽을 수 있어요. 화면 위쪽 <strong>↩</strong> 버튼으로 도서관으로 돌아가요.
        </p>
      </footer>
    </div>
  );
}

window.Gallery = Gallery;
