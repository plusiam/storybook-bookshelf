// 교사 어드민 — 학급 안의 책 모니터링·삭제 (v3 — 업로드는 학생이 직접)
/* global React, PB */
const { useState: useStateBk, useEffect: useEffectBk, useCallback: useCallbackBk } = React;

/* ─── 책 카드 (모니터 + 삭제) ─────────────────────────────────────── */

function BookCard({ book, onOpenViewer, onDelete }) {
  const date = new Date(book.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });

  return (
    <article className="book-card">
      <span className="book-card-slug" title="단권 공유 슬러그">#{book.slug}</span>
      <h4 className="book-card-title">{book.title || '제목 없음'}</h4>
      <p className="book-card-author">✍️ {book.pen_name}</p>
      {book.intro && <p className="book-card-intro">{book.intro}</p>}
      <p className="book-card-date">{date}</p>
      <div className="book-card-actions">
        <button type="button" className="btn btn-sm" onClick={onOpenViewer}>
          🔗 단권 보기
        </button>
        <button type="button" className="btn btn-sm book-card-delete" onClick={onDelete}>
          🗑 삭제
        </button>
      </div>
    </article>
  );
}

/* ─── 메인 — 학급 안의 책 모니터링 ─────────────────────────────── */

function BooksAdmin({ cls, onBack }) {
  const [books, setBooks] = useStateBk([]);
  const [loading, setLoading] = useStateBk(true);
  const [error, setError] = useStateBk(null);

  const reload = useCallbackBk(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await PB.listBooks(cls.id);
      setBooks(list);
    } catch (e) {
      setError(e?.message || '책 목록을 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, [cls.id]);

  useEffectBk(() => { reload(); }, [reload]);

  const handleDelete = async (book) => {
    const label = book.title || `${book.pen_name}의 책`;
    const ok = window.confirm(`'${label}'을(를) 삭제할까요?\n되돌릴 수 없습니다.`);
    if (!ok) return;
    try {
      await PB.deleteBook(book.id);
      await reload();
    } catch (e) {
      window.alert(e?.message || '삭제에 실패했어요');
    }
  };

  const handleOpenViewer = (book) => {
    // 단권 뷰어 라우트 (Phase 10에서 구현). 일단 같은 도메인의 #/b/:slug로 새 탭 열기.
    window.open(`#/b/${book.slug}`, '_blank', 'noopener,noreferrer');
  };

  const viewUrl = `${window.location.origin}${window.location.pathname}#/c/${cls.view_code}?y=${encodeURIComponent(cls.school_year)}`;

  return (
    <section className="books-admin">
      <header className="books-admin-header">
        <div className="books-admin-breadcrumb">
          <button type="button" className="btn btn-sm" onClick={onBack}>
            ← 학급 목록
          </button>
          <div className="books-admin-codes">
            <span className="books-admin-class-code" title="열람 코드 (4자리)">
              📢 {cls.view_code}
            </span>
            <span className="books-admin-class-code books-admin-class-code--upload" title="업로드 코드 (6자리)">
              ✍️ {cls.upload_code}
            </span>
          </div>
          <div className="books-admin-class-block">
            <span className="books-admin-class-name">{cls.display_name}</span>
            <span className="books-admin-class-meta">
              {cls.school_year} · {cls.grade}학년 {cls.class_no}반
            </span>
          </div>
        </div>
        <a
          className="btn"
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="학급 공개 작품집을 새 탭에서 보기"
        >
          🔗 학급 작품집 열기
        </a>
      </header>

      <p className="books-admin-note">
        📌 업로드는 <strong>학생이 직접</strong> '업로드 코드'로 합니다. 교사는 부적절한 작품을 발견하면 삭제할 수 있어요.
      </p>

      {loading && (
        <div className="classes-admin-loading">
          <span>⏳</span> 불러오는 중...
        </div>
      )}

      {!loading && error && (
        <div className="classes-admin-error">
          <p>{error}</p>
          <button type="button" className="btn" onClick={reload}>다시 시도</button>
        </div>
      )}

      {!loading && !error && books.length === 0 && (
        <div className="classes-admin-empty">
          <div className="classes-admin-empty-icon">📚</div>
          <h3>아직 올라온 책이 없어요</h3>
          <p>학생들에게 '업로드 안내' 메시지를 보내 작품을 올리도록 안내해 주세요.</p>
        </div>
      )}

      {!loading && books.length > 0 && (
        <div className="books-grid">
          {books.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              onOpenViewer={() => handleOpenViewer(b)}
              onDelete={() => handleDelete(b)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

window.BooksAdmin = BooksAdmin;
