/* global React */
const { useEffect, useState: useStateIntro } = React;

/* ======================================================
   인트로 — 책이 펼쳐지는 애니메이션 (약 2초)
   ====================================================== */

function IntroAnimation({ title, accent, onDone, onSkip }) {
  const [hide, setHide] = useStateIntro(false);

  const skip = () => {
    setHide(true);
    onSkip && onSkip();
    onDone && onDone();
  };

  useEffect(() => {
    const t1 = setTimeout(() => setHide(true), 2200);
    const t2 = setTimeout(() => onDone && onDone(), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div className="intro-stage" style={{ opacity: hide ? 0 : 1, transition: 'opacity 0.4s ease' }}
         onClick={skip} role="button" aria-label="건너뛰기">
      <div className="intro-book">
        <div className="intro-cover-back" style={{ background: accent || 'var(--accent)' }}>
          <span style={{ fontSize: 48, opacity: 0.4 }}>📖</span>
        </div>
        <div className="intro-cover-front" style={{ background: accent || 'var(--accent)' }}>
          <div className="intro-cover-front-inner">{title || '나의 그림책'}</div>
        </div>
      </div>
      <div className="intro-spinner">책을 펼치는 중… <span style={{ fontSize: '0.8em', opacity: 0.6 }}>(클릭해서 건너뛰기)</span></div>
    </div>
  );
}

window.IntroAnimation = IntroAnimation;
