// 학부모 진입 — 4자리 코드 + 학년도/학년/반 + 자녀 실명 매칭 후 작품 열람
/* global React, PB, BookViewer, normalizeBook */
const { useState: useStateFm, useEffect: useEffectFm, useCallback: useCallbackFm, useMemo: useMemoFm } = React;

/* ─── 헬퍼 ─────────────────────────────────────────────────────────── */

// 교사 어드민과 같은 로직으로 현재 학년도 추정
function defaultSchoolYearFm() {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 3 && month <= 7) return `${year}-1`;
  if (month >= 8) return `${year}-2`;
  return `${year - 1}-2`;
}

/* ─── 입력 폼 ─────────────────────────────────────────────────────── */

function FamilyEntryForm({ initialQuery, onResults }) {
  const [code, setCode] = useStateFm(initialQuery?.code || '');
  const [schoolYear, setSchoolYear] = useStateFm(
    initialQuery?.school_year || defaultSchoolYearFm()
  );
  const [grade, setGrade] = useStateFm(initialQuery?.grade ?? 5);
  const [classNo, setClassNo] = useStateFm(initialQuery?.class_no ?? 1);
  const [childName, setChildName] = useStateFm(initialQuery?.child_name || '');
  const [submitting, setSubmitting] = useStateFm(false);
  const [error, setError] = useStateFm(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const query = {
        code,
        school_year: schoolYear,
        grade,
        class_no: classNo,
        child_name: childName,
      };
      const rows = await PB.fetchClassBooks(query);
      onResults(query, rows);
    } catch (err) {
      setError(err?.message || '조회에 실패했어요');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="family-form" onSubmit={submit}>
      <header className="family-form-header">
        <span className="family-form-tag">📖 우리 반 그림책 도서관</span>
        <h1 className="family-form-title">자녀의 작품을 보러 오셨군요</h1>
        <p className="family-form-sub">
          담임 선생님이 안내해 드린 학급 코드와 정보를 입력해 주세요.
        </p>
      </header>

      <div className="family-form-fields">
        <label className="family-field family-field--code">
          <span>학급 코드 (4자리)</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            disabled={submitting}
            required
            autoFocus
          />
        </label>

        <div className="family-field-row">
          <label className="family-field family-field--year">
            <span>학년도</span>
            <input
              type="text"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="2026-1"
              disabled={submitting}
              required
            />
          </label>
          <label className="family-field family-field--grade">
            <span>학년</span>
            <select
              value={grade}
              onChange={(e) => setGrade(parseInt(e.target.value, 10))}
              disabled={submitting}
            >
              {[1, 2, 3, 4, 5, 6].map((g) => (
                <option key={g} value={g}>{g}학년</option>
              ))}
            </select>
          </label>
          <label className="family-field family-field--classno">
            <span>반</span>
            <input
              type="number"
              min={1}
              max={20}
              value={classNo}
              onChange={(e) => setClassNo(parseInt(e.target.value, 10) || 1)}
              disabled={submitting}
              required
            />
          </label>
        </div>

        <label className="family-field">
          <span>자녀 이름</span>
          <input
            type="text"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="예: 김민준"
            maxLength={40}
            disabled={submitting}
            required
          />
        </label>
      </div>

      {error && <p className="family-form-error">{error}</p>}

      <button
        type="submit"
        className="btn primary family-form-submit"
        disabled={submitting}
      >
        {submitting ? '찾는 중...' : '들어가기'}
      </button>

      <p className="family-form-hint">
        🔒 입력하신 정보는 자녀가 속한 학급의 작품을 찾는 데만 사용됩니다.
        실패가 반복되면 학급 코드가 일시 잠길 수 있어요.
      </p>
    </form>
  );
}

/* ─── 책 카드 (갤러리 안) ─────────────────────────────────────────── */

function FamilyBookCard({ row, onOpen }) {
  const student = row?.data?.student || {};
  const cover = (row?.data?.pages || []).find((p) => p.type === 'cover');
  const hasImg =
    cover && typeof cover.drawing === 'string' && cover.drawing.length > 0;

  return (
    <button
      type="button"
      className={`family-book-card${row.is_own_child ? ' is-own' : ''}`}
      onClick={onOpen}
      aria-label={`${row.title || '제목 없는 책'} 펼치기`}
    >
      <div className="family-book-cover">
        {hasImg ? (
          <img src={cover.drawing} alt="" loading="lazy" />
        ) : (
          <span className="family-book-cover-fallback">📖</span>
        )}
        {row.is_own_child && (
          <span className="family-book-own-badge">⭐ 우리 아이</span>
        )}
      </div>
      <div className="family-book-info">
        <h4 className="family-book-title">
          {row.title || student.title || '제목 없음'}
        </h4>
        <p className="family-book-author">글·그림 {row.student_name}</p>
      </div>
    </button>
  );
}

/* ─── 결과 갤러리 ─────────────────────────────────────────────────── */

function FamilyGallery({ query, rows, onOpenBook, onBack }) {
  const own = useMemoFm(() => rows.filter((r) => r.is_own_child), [rows]);
  const others = useMemoFm(() => rows.filter((r) => !r.is_own_child), [rows]);

  return (
    <div className="family-gallery">
      <header className="family-gallery-header">
        <button type="button" className="btn btn-sm" onClick={onBack}>
          ← 다시 검색
        </button>
        <div className="family-gallery-title-block">
          <span className="family-gallery-tag">👨‍👩‍👧 가족 열람</span>
          <h2 className="family-gallery-title">
            {query.grade}학년 {query.class_no}반 · {query.child_name}
          </h2>
          <p className="family-gallery-meta">{query.school_year}</p>
        </div>
      </header>

      {rows.length === 0 && (
        <div className="family-empty">
          <div className="family-empty-icon">🔍</div>
          <h3>정보를 찾을 수 없어요</h3>
          <p>
            학급 코드·학년·반·자녀 이름 중 하나가 맞지 않거나, 작품이 아직 올라오지 않았을 수 있어요.
            <br />
            반복 실패가 누적되면 학급 코드가 일시 잠깁니다. 담임 선생님께 문의해 주세요.
          </p>
          <button type="button" className="btn primary" onClick={onBack}>
            다시 검색
          </button>
        </div>
      )}

      {own.length > 0 && (
        <section className="family-gallery-section">
          <h3 className="family-gallery-section-title">
            ⭐ {query.child_name}의 작품 <small>({own.length}권)</small>
          </h3>
          <div className="family-gallery-grid">
            {own.map((r) => (
              <FamilyBookCard key={r.slug} row={r} onOpen={() => onOpenBook(r)} />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="family-gallery-section">
          <h3 className="family-gallery-section-title">
            👥 같은 반 친구들 작품 <small>({others.length}권)</small>
          </h3>
          <div className="family-gallery-grid">
            {others.map((r) => (
              <FamilyBookCard key={r.slug} row={r} onOpen={() => onOpenBook(r)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── 책 펼치기 (slide 모드 단순 뷰) ───────────────────────────── */

function FamilyBookView({ row, onBack }) {
  const book = useMemoFm(() => normalizeBook(row?.data), [row]);

  if (!book) {
    return (
      <div className="family-empty">
        <p>책 데이터가 깨져 있어요.</p>
        <button type="button" className="btn" onClick={onBack}>← 돌아가기</button>
      </div>
    );
  }

  return (
    <div className="family-book-view">
      <header className="family-book-view-bar">
        <button type="button" className="btn btn-sm" onClick={onBack}>
          ← 갤러리로
        </button>
        <h2 className="family-book-view-title">
          {book.student?.title || '나의 그림책'}
        </h2>
        <span className="family-book-view-author">
          글·그림 {book.student?.name || ''}
        </span>
      </header>
      <div className="family-book-view-stage">
        <BookViewer
          book={book}
          bookId={`family-${row.slug}`}
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

/* ─── 메인 — FamilyScene ─────────────────────────────────────────── */

function FamilyScene() {
  const [step, setStep] = useStateFm('form'); // 'form' | 'gallery' | 'book'
  const [query, setQuery] = useStateFm(null);
  const [rows, setRows] = useStateFm([]);
  const [openedRow, setOpenedRow] = useStateFm(null);

  const handleResults = useCallbackFm((q, r) => {
    setQuery(q);
    setRows(r);
    setStep('gallery');
  }, []);

  const openBook = useCallbackFm((row) => {
    setOpenedRow(row);
    setStep('book');
  }, []);

  const backToGallery = useCallbackFm(() => {
    setOpenedRow(null);
    setStep('gallery');
  }, []);

  const backToForm = useCallbackFm(() => {
    setStep('form');
  }, []);

  if (step === 'book' && openedRow) {
    return <FamilyBookView row={openedRow} onBack={backToGallery} />;
  }
  if (step === 'gallery' && query) {
    return (
      <FamilyGallery
        query={query}
        rows={rows}
        onOpenBook={openBook}
        onBack={backToForm}
      />
    );
  }
  return (
    <div className="family-scene">
      <FamilyEntryForm initialQuery={query} onResults={handleResults} />
    </div>
  );
}

window.FamilyScene = FamilyScene;
