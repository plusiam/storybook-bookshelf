/* global React, PB_IDB */
const { useState, useRef, useCallback, useMemo } = React;

/* ======================================================
   업로드 화면 — 그림책 책장 분위기
   ====================================================== */

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeFilename(book) {
  const s = book?.student || {};
  const name = (s.name || '작가').replace(/[\\/:*?"<>|]/g, '_');
  const title = (s.title || '그림책').replace(/[\\/:*?"<>|]/g, '_');
  return `${name}_${title}.json`;
}

function UploadScreen({ onLoad, library, onOpenBook, onRemoveBook, onLoadSample, onClearLibrary }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback(async (files) => {
    setError(null);
    if (!files || files.length === 0) return;
    const results = [];
    const errs = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.json')) {
        errs.push(`${file.name}: JSON이 아니에요`);
        continue;
      }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.pages || !Array.isArray(data.pages)) {
          errs.push(`${file.name}: 그림책 데이터가 없어요`);
          continue;
        }
        results.push({ data, fileName: file.name });
      } catch (err) {
        errs.push(`${file.name}: ${err.message}`);
      }
    }
    if (errs.length > 0) setError(errs.join(' · '));
    if (results.length === 1) onLoad(results[0].data, results[0].fileName);
    else if (results.length > 1) onLoad(results.map((r) => r.data), null, true);
  }, [onLoad]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(Array.from(e.dataTransfer.files || []));
  }, [handleFiles]);

  const hasLibrary = library && library.length > 0;

  // 페이지 전체에 드래그 가능
  const onPageDragOver = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const onPageDragLeave = useCallback((e) => {
    if (e.relatedTarget === null || !e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  }, []);

  return (
    <div
      className={`upload-scene ${dragging ? 'is-dragging' : ''}`}
      onDragOver={onPageDragOver}
      onDragLeave={onPageDragLeave}
      onDrop={onDrop}
    >
      {/* 배경 — 따뜻한 방 */}
      <div className="scene-window" aria-hidden>
        <div className="scene-window-glow" />
        <div className="scene-floating sf-1">📖</div>
        <div className="scene-floating sf-2">✏️</div>
        <div className="scene-floating sf-3">🌷</div>
        <div className="scene-floating sf-4">🍃</div>
      </div>

      {/* 헤로 */}
      <header className="scene-hero">
        <span className="scene-hello">📚 우리 반 그림책 도서관</span>
        <h1 className="scene-title">
          내가 만든 그림책,<br />
          <em>책장에 꽂아볼까요?</em>
        </h1>
        <p className="scene-sub">
          스토리보드에서 만든 <strong>JSON 파일</strong>을 끌어다 놓으면<br />
          진짜 책처럼 펼쳐지는 그림책으로 변신해요.
        </p>
      </header>

      {/* 메인 책장 */}
      <section className="bookshelf-stage">
        <div className="bookshelf">
          <div className="bookshelf-row">
            <ShelfBooks library={library} onOpen={onOpenBook} onRemove={onRemoveBook} />

            {/* 드롭 슬롯 — 항상 책장 끝에 */}
            <div
              className={`shelf-slot ${dragging ? 'is-active' : ''}`}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="JSON 끌어다 놓기"
            >
              <div className="shelf-slot-inside">
                <span className="shelf-slot-plus">＋</span>
                <span className="shelf-slot-text">
                  {dragging ? '여기에 놓으세요!' : '책 꽂기'}
                </span>
                <span className="shelf-slot-hint">
                  {hasLibrary ? '드래그 또는 클릭' : 'JSON 파일을 끌어다 놓거나 클릭'}
                </span>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(Array.from(e.target.files || []))}
            />
          </div>
          <div className="bookshelf-plank" aria-hidden />
          <div className="bookshelf-shadow" aria-hidden />
        </div>

        {/* 빈 책장일 때 가이드 */}
        {!hasLibrary && (
          <div className="empty-hint">
            <span className="empty-hint-arrow">↑</span>
            여기에 첫 그림책을 꽂아볼까요?
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="scene-actions">
          <button className="btn primary" onClick={onLoadSample}>
            ✨ 샘플 그림책 펼쳐보기
          </button>
          <a className="btn ghost" href="https://plusiam.github.io/picturebook-storyboard/" target="_blank" rel="noreferrer">
            ✏️ 스토리보드 만들러 가기
          </a>
        </div>

        {/* 책장 관리 버튼 — 책이 1권 이상일 때만 표시 */}
        {library && library.length > 0 && (
          <div className="scene-actions shelf-actions">
            <button className="btn ghost" onClick={() => {
              library.forEach((book) => downloadJSON(book, safeFilename(book)));
            }}>
              💾 책장 전체 내보내기 ({library.length}권)
            </button>
            {!confirmClear ? (
              <button className="btn danger-ghost" onClick={() => setConfirmClear(true)}>
                🗑 책장 초기화
              </button>
            ) : (
              <div className="confirm-clear">
                <span>정말 모두 지울까요?</span>
                <button className="btn danger" onClick={() => { onClearLibrary(); setConfirmClear(false); }}>
                  네, 지울게요
                </button>
                <button className="btn ghost" onClick={() => setConfirmClear(false)}>
                  취소
                </button>
              </div>
            )}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
      </section>

      {/* 라이브러리 카운터 + 특징 */}
      <footer className="scene-footer">
        {hasLibrary && (
          <p className="scene-counter">
            <span className="scene-counter-num">{library.length}</span>
            권의 그림책이 책장에 꽂혀 있어요
          </p>
        )}
        <div className="scene-features">
          <span className="scene-feature">📕 진짜 책처럼 펼쳐짐</span>
          <span className="scene-feature">🎨 4가지 테마 + 4가지 표지</span>
          <span className="scene-feature">📱 폰·태블릿·PC</span>
          <span className="scene-feature">🖨 PDF 인쇄</span>
        </div>
      </footer>

      {/* 드래그 오버레이 */}
      {dragging && (
        <div className="drag-overlay" aria-hidden>
          <div className="drag-overlay-text">
            <div className="drag-overlay-icon">📖✨</div>
            여기에 놓으면 책장에 꽂혀요!
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 책장 위 책들 ---------- */
function ShelfBooks({ library, onOpen, onRemove }) {
  if (!library || library.length === 0) return null;
  return (
    <>
      {library.map((book, i) => (
        <BookSpine key={i} book={book} onClick={() => onOpen(i)} onRemove={() => onRemove(i)} index={i} />
      ))}
    </>
  );
}

/* ---------- 책 한 권 (책등) ---------- */
function BookSpine({ book, onClick, onRemove, index }) {
  const s = book?.student || {};
  const cover = book?.pages?.find((p) => p.type === 'cover');
  const hasImg = cover && typeof cover.drawing === 'string' && cover.drawing.startsWith('data:image');
  const seed = (s.name || s.title || `x${index}`).split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  // 책등 색상 — 학생 이름 시드 기반
  const palettes = [
    { bg: '#d97757', accent: '#a85a3e' },
    { bg: '#7ba07a', accent: '#557a55' },
    { bg: '#a9c8db', accent: '#7aa3b8' },
    { bg: '#f3c969', accent: '#c9a444' },
    { bg: '#c98ab1', accent: '#9c648a' },
    { bg: '#8a6dc1', accent: '#624a96' },
    { bg: '#e87a5d', accent: '#b85540' },
    { bg: '#5b8a4a', accent: '#3e6231' },
    { bg: '#dba566', accent: '#a87838' },
    { bg: '#6e9bb8', accent: '#4a7591' },
  ];
  const c = palettes[seed % palettes.length];

  // 책 두께 약간씩 다르게
  const widths = [44, 48, 52, 46, 50];
  const width = widths[seed % widths.length];

  // 약간의 기울기
  const tilt = (seed % 5 === 0) ? -1.5 : (seed % 7 === 0 ? 1.2 : 0);

  return (
    <div
      className="book-spine"
      style={{
        '--spine-bg': c.bg,
        '--spine-accent': c.accent,
        width: `${width}px`,
        transform: `rotate(${tilt}deg)`,
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${s.title || '제목 없는 그림책'} 펼치기`}
      title={`${s.title || ''} · ${s.name || ''}`}
    >
      <div className="book-spine-inner">
        <div className="book-spine-band" />
        <div className="book-spine-title">{s.title || '제목 없음'}</div>
        <div className="book-spine-author">{s.name || ''}</div>
        {hasImg && (
          <div className="book-spine-mini">
            <img src={cover.drawing} alt="" />
          </div>
        )}
      </div>
      <button
        className="book-spine-export"
        onClick={(e) => { e.stopPropagation(); downloadJSON(book, safeFilename(book)); }}
        aria-label="JSON으로 내보내기"
        title="JSON으로 저장"
      >↓</button>
      <button
        className="book-spine-remove"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label="책장에서 빼기"
        title="책장에서 빼기"
      >×</button>
    </div>
  );
}

window.UploadScreen = UploadScreen;
