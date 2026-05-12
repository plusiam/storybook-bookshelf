// 교사 어드민 — 학급 안의 책 관리 (업로드·공개범위 토글·삭제)
/* global React, PB */
const { useState: useStateBk, useEffect: useEffectBk, useCallback: useCallbackBk, useRef: useRefBk } = React;

/* ─── 책 업로드 폼 ────────────────────────────────────────────────── */

function UploadBookForm({ cls, onUploaded, onCancel }) {
  const [file, setFile] = useStateBk(null);
  const [parsed, setParsed] = useStateBk(null);
  const [studentName, setStudentName] = useStateBk('');
  const [title, setTitle] = useStateBk('');
  const [visibility, setVisibility] = useStateBk('private');
  const [submitting, setSubmitting] = useStateBk(false);
  const [error, setError] = useStateBk(null);
  const [dragOver, setDragOver] = useStateBk(false);
  const inputRef = useRefBk(null);

  const handleFile = useCallbackBk(async (f) => {
    if (!f) return;
    setError(null);
    setParsed(null);
    setFile(f);
    if (!f.name.toLowerCase().endsWith('.json')) {
      setError('JSON 파일이 아니에요');
      return;
    }
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (!data?.pages || !Array.isArray(data.pages)) {
        throw new Error('그림책 데이터가 아니에요 (pages 배열이 없음)');
      }
      setParsed(data);
      setStudentName(data?.student?.name || '');
      setTitle(data?.student?.title || '');
    } catch (e) {
      setError(e?.message || '파일을 읽지 못했어요');
    }
  }, []);

  const onDrop = useCallbackBk((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const submit = async (e) => {
    e.preventDefault();
    if (!parsed) return;
    setError(null);
    setSubmitting(true);
    try {
      await PB.createBookForClass({
        class_id: cls.id,
        student_name: studentName,
        title,
        data: parsed,
        visibility,
      });
      onUploaded();
    } catch (err) {
      setError(err?.message || '업로드에 실패했어요');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="book-upload-card" onSubmit={submit}>
      <h3 className="book-upload-title">책 업로드 — {cls.display_name}</h3>

      <div
        className={`book-upload-drop${dragOver ? ' is-dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={submitting}
        />
        {parsed ? (
          <div className="book-upload-parsed">
            <span className="book-upload-icon">📄</span>
            <strong>{file?.name}</strong>
            <span className="book-upload-info">📚 {parsed.pages.length}페이지</span>
          </div>
        ) : (
          <div className="book-upload-empty">
            <span className="book-upload-icon">📁</span>
            <span>JSON 파일을 여기에 끌어다 놓거나 클릭해서 선택</span>
          </div>
        )}
      </div>

      {parsed && (
        <div className="book-upload-fields">
          <label className="book-upload-field">
            <span>학생 이름 (실명)</span>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              maxLength={40}
              required
              disabled={submitting}
            />
          </label>

          <label className="book-upload-field">
            <span>책 제목</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="(JSON에서 자동)"
              disabled={submitting}
            />
          </label>

          <fieldset className="book-upload-vis">
            <legend>공개 범위</legend>
            <label>
              <input
                type="radio"
                name="vis"
                value="private"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
                disabled={submitting}
              />
              <span>🔒 비공개 — 자녀 본인만 볼 수 있음</span>
            </label>
            <label>
              <input
                type="radio"
                name="vis"
                value="class"
                checked={visibility === 'class'}
                onChange={() => setVisibility('class')}
                disabled={submitting}
              />
              <span>👥 학급 공개 — 같은 반 학부모 누구나 볼 수 있음</span>
            </label>
          </fieldset>
        </div>
      )}

      {error && <p className="book-upload-error">{error}</p>}

      <div className="book-upload-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
          취소
        </button>
        <button
          type="submit"
          className="btn primary"
          disabled={!parsed || !studentName.trim() || submitting}
        >
          {submitting ? '업로드 중...' : '업로드'}
        </button>
      </div>
    </form>
  );
}

/* ─── 책 카드 ─────────────────────────────────────────────────────── */

function BookCard({ book, onToggle, onDelete }) {
  const date = new Date(book.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const isPublic = book.visibility === 'class';

  return (
    <article className="book-card">
      <span className={`book-card-visibility${isPublic ? ' is-public' : ''}`}>
        {isPublic ? '👥 학급 공개' : '🔒 비공개'}
      </span>
      <h4 className="book-card-title">{book.title || '제목 없음'}</h4>
      <p className="book-card-author">글·그림 {book.student_name}</p>
      <p className="book-card-date">{date}</p>
      <div className="book-card-actions">
        <button type="button" className="btn btn-sm" onClick={onToggle}>
          {isPublic ? '🔒 비공개로' : '👥 학급 공개로'}
        </button>
        <button type="button" className="btn btn-sm book-card-delete" onClick={onDelete}>
          🗑 삭제
        </button>
      </div>
    </article>
  );
}

/* ─── 메인 — 학급 안의 책 관리 ─────────────────────────────────── */

function BooksAdmin({ cls, onBack }) {
  const [books, setBooks] = useStateBk([]);
  const [loading, setLoading] = useStateBk(true);
  const [error, setError] = useStateBk(null);
  const [showUpload, setShowUpload] = useStateBk(false);

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

  const handleToggle = async (book) => {
    try {
      const next = book.visibility === 'class' ? 'private' : 'class';
      await PB.updateBookVisibility(book.id, next);
      await reload();
    } catch (e) {
      window.alert(e?.message || '변경에 실패했어요');
    }
  };

  const handleDelete = async (book) => {
    const label = book.title || `${book.student_name}의 책`;
    const ok = window.confirm(`'${label}'을(를) 삭제할까요?\n되돌릴 수 없습니다.`);
    if (!ok) return;
    try {
      await PB.deleteBook(book.id);
      await reload();
    } catch (e) {
      window.alert(e?.message || '삭제에 실패했어요');
    }
  };

  return (
    <section className="books-admin">
      <header className="books-admin-header">
        <div className="books-admin-breadcrumb">
          <button type="button" className="btn btn-sm" onClick={onBack}>
            ← 학급 목록
          </button>
          <span className="books-admin-class-code">{cls.class_code}</span>
          <div className="books-admin-class-block">
            <span className="books-admin-class-name">{cls.display_name}</span>
            <span className="books-admin-class-meta">
              {cls.school_year} · {cls.grade}학년 {cls.class_no}반
            </span>
          </div>
        </div>
        {!showUpload && (
          <button type="button" className="btn primary" onClick={() => setShowUpload(true)}>
            ＋ 책 업로드
          </button>
        )}
      </header>

      {showUpload && (
        <UploadBookForm
          cls={cls}
          onUploaded={async () => { setShowUpload(false); await reload(); }}
          onCancel={() => setShowUpload(false)}
        />
      )}

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

      {!loading && !error && books.length === 0 && !showUpload && (
        <div className="classes-admin-empty">
          <div className="classes-admin-empty-icon">📚</div>
          <h3>아직 올린 책이 없어요</h3>
          <p>'＋ 책 업로드' 버튼으로 학생들의 JSON 작품을 올려 보세요.</p>
        </div>
      )}

      {!loading && books.length > 0 && (
        <div className="books-grid">
          {books.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              onToggle={() => handleToggle(b)}
              onDelete={() => handleDelete(b)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

window.BooksAdmin = BooksAdmin;
