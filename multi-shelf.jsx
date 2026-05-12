// 다단 책장 — 책 N권을 화면 폭에 맞춰 여러 층으로 자동 분할
/* global React, BookSpine */
const { useState: useStateMS, useEffect: useEffectMS, useMemo: useMemoMS } = React;

/* ======================================================
   MultiShelf
   - 책 배열을 받아 화면 폭에 따라 자동 다단으로 표시
   - 각 층마다 plank(선반 판자) + shadow(그림자) 복제
   - props
       books:       [{slug?, data}] 또는 [normalizedBook] 배열
       onOpen:      (book, index) => void
       onRemove:    (book, index) => void | null     ← null이면 × 버튼 숨김
       onShare:     (book) => void | null            ← null이면 🔗 버튼 숨김
       compact:     boolean (작은 책등으로 표시, 갤러리 모드)
   ====================================================== */

// 화면 폭 기반 한 층당 권수 계산
// 책 한 권 평균 ~50px, 사이 간격 6px, 좌우 패딩 80px
function calcPerRow(width, compact = false) {
  const slotWidth = compact ? 42 : 56;
  const usable = Math.max(width - 80, 320);
  const n = Math.floor(usable / slotWidth);
  return Math.max(4, n);
}

function useShelfRows(books, compact) {
  const [perRow, setPerRow] = useStateMS(() => calcPerRow(window.innerWidth, compact));

  useEffectMS(() => {
    let raf = 0;
    const onR = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPerRow(calcPerRow(window.innerWidth, compact)));
    };
    window.addEventListener('resize', onR);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onR);
    };
  }, [compact]);

  return useMemoMS(() => {
    if (!books || books.length === 0) return [];
    const rows = [];
    for (let i = 0; i < books.length; i += perRow) {
      rows.push(books.slice(i, i + perRow));
    }
    return rows;
  }, [books, perRow]);
}

function MultiShelf({ books, onOpen, onRemove, onShare, compact = false }) {
  const rows = useShelfRows(books, compact);

  if (!books || books.length === 0) {
    return null;
  }

  return (
    <div className={`multi-shelf ${compact ? 'is-compact' : ''}`}>
      {rows.map((rowBooks, rowIdx) => (
        <div className="multi-shelf-tier" key={rowIdx}>
          <div className="multi-shelf-row">
            {rowBooks.map((book, colIdx) => {
              const globalIdx = rowIdx * (rows[0]?.length || 1) + colIdx;
              // 정확한 글로벌 인덱스 계산
              const flatIdx = books.indexOf(book);
              return (
                <BookSpine
                  key={book.slug || flatIdx}
                  book={book}
                  index={flatIdx >= 0 ? flatIdx : globalIdx}
                  onClick={() => onOpen && onOpen(book, flatIdx >= 0 ? flatIdx : globalIdx)}
                  onRemove={onRemove ? () => onRemove(book, flatIdx >= 0 ? flatIdx : globalIdx) : null}
                  onShare={onShare ? () => onShare(book) : null}
                />
              );
            })}
          </div>
          <div className="multi-shelf-plank" aria-hidden />
          <div className="multi-shelf-shadow" aria-hidden />
        </div>
      ))}
    </div>
  );
}

window.MultiShelf = MultiShelf;
