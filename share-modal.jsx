// 그림책 공유 링크 만들기 모달 (Supabase 업로드 → 짧은 URL 발급 → 클립보드 복사)
/* global React, PB, normalizeBook */
const { useState: useStateShare, useCallback: useCallbackShare, useEffect: useEffectShare, useRef: useRefShare } = React;

/* ======================================================
   공유 링크 모달
   - 학생이 책 보기 화면 또는 책장에서 "🔗 공유" 누르면 열림
   - 학급코드(선택), 별명(선택) 입력 후 Supabase에 업로드
   - 발급된 짧은 링크 표시 + 자동 클립보드 복사
   ====================================================== */

function ShareModal({ book, onClose }) {
  const initialNickname = (book?.student?.name || '').trim();
  const [nickname, setNickname] = useStateShare(initialNickname);
  const [classCode, setClassCode] = useStateShare('');
  const [phase, setPhase] = useStateShare('form');      // form | uploading | done | error
  const [shareUrl, setShareUrl] = useStateShare('');
  const [galleryUrl, setGalleryUrl] = useStateShare('');
  const [errorMsg, setErrorMsg] = useStateShare('');
  const [copied, setCopied] = useStateShare(false);
  const linkRef = useRefShare(null);

  // 학급코드 LocalStorage 기억 (한 번 입력하면 다음 책 올릴 때 자동 채움)
  useEffectShare(() => {
    try {
      const remembered = localStorage.getItem('pb-last-class-code') || '';
      if (remembered) setClassCode(remembered);
    } catch {}
  }, []);

  const copyToClipboard = useCallbackShare(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — execCommand
      try {
        linkRef.current?.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  }, []);

  const handleUpload = useCallbackShare(async () => {
    if (!PB || !PB.isConfigured()) {
      setPhase('error');
      setErrorMsg('Supabase 설정이 안 돼 있어요. config.js를 확인해주세요.');
      return;
    }
    setPhase('uploading');
    setErrorMsg('');
    try {
      const { slug } = await PB.uploadBook(book, {
        classCode: classCode.trim(),
        nickname: nickname.trim(),
      });
      // 학급코드 기억
      try {
        if (classCode.trim()) localStorage.setItem('pb-last-class-code', classCode.trim());
      } catch {}

      const url = `${location.origin}${location.pathname}#/b/${slug}`;
      setShareUrl(url);
      if (classCode.trim()) {
        setGalleryUrl(`${location.origin}${location.pathname}#/g/${encodeURIComponent(classCode.trim())}`);
      }
      setPhase('done');
      // 자동 복사
      copyToClipboard(url);
    } catch (err) {
      setPhase('error');
      setErrorMsg(err?.message || '업로드에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  }, [book, classCode, nickname, copyToClipboard]);

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div className="share-backdrop" onClick={handleBackdrop} role="dialog" aria-modal="true">
      <div className="share-card">
        <button className="share-close" onClick={onClose} aria-label="닫기">×</button>

        {phase === 'form' && (
          <>
            <div className="share-header">
              <span className="share-icon">🔗</span>
              <h2 className="share-title">친구·부모님께 보여주기</h2>
              <p className="share-sub">짧은 링크를 만들어 패들렛·카톡·알림장에 붙여 넣을 수 있어요.</p>
            </div>

            <div className="share-form">
              <label className="share-field">
                <span className="share-label">작가 이름 <em>(별명, 필수)</em></span>
                <input
                  className="share-input"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.slice(0, 40))}
                  placeholder="예) 햇살이"
                  maxLength={40}
                />
              </label>
              <label className="share-field">
                <span className="share-label">학급 코드 <em>(선생님이 알려주신 경우만)</em></span>
                <input
                  className="share-input"
                  type="text"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.slice(0, 40))}
                  placeholder="예) 5-3-2026"
                  maxLength={40}
                />
                <span className="share-hint">비워두면 나만의 단독 링크가 만들어져요.</span>
              </label>
            </div>

            <div className="share-privacy">
              🔒 <strong>실명·학번·반번호는 올리지 마세요.</strong> 별명만 사용해요.
            </div>

            <div className="share-actions">
              <button className="share-btn share-btn--primary" onClick={handleUpload} disabled={!nickname.trim()}>
                ✨ 공유 링크 만들기
              </button>
              <button className="share-btn share-btn--ghost" onClick={onClose}>취소</button>
            </div>
          </>
        )}

        {phase === 'uploading' && (
          <div className="share-uploading">
            <div className="share-spinner">📚</div>
            <p>책을 책장에 올리는 중...</p>
          </div>
        )}

        {phase === 'done' && (
          <>
            <div className="share-header">
              <span className="share-icon share-icon--success">✅</span>
              <h2 className="share-title">링크가 만들어졌어요!</h2>
              <p className="share-sub">{copied ? '클립보드에 복사됐어요. 바로 붙여 넣을 수 있어요.' : '아래 링크를 복사해서 공유하세요.'}</p>
            </div>

            <div className="share-url-row">
              <input
                ref={linkRef}
                className="share-url-input"
                value={shareUrl}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <button className="share-btn share-btn--primary" onClick={() => copyToClipboard(shareUrl)}>
                {copied ? '✓ 복사됨' : '📋 복사'}
              </button>
            </div>

            <div className="share-tips">
              <p className="share-tips-title">붙여 넣을 곳</p>
              <ul>
                <li>📌 패들렛 · 알림장 · 학급 게시판</li>
                <li>💬 카카오톡 · 메시지</li>
                <li>📧 이메일 · 메모</li>
              </ul>
            </div>

            <div className="share-actions">
              <a className="share-btn share-btn--primary" href={shareUrl} target="_blank" rel="noreferrer">
                🔍 미리보기 열기
              </a>
              {galleryUrl && (
                <a className="share-btn share-btn--ghost" href={galleryUrl} target="_blank" rel="noreferrer">
                  🏛 학급 작품집 보기
                </a>
              )}
              <button className="share-btn share-btn--ghost" onClick={onClose}>닫기</button>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="share-header">
              <span className="share-icon share-icon--error">⚠️</span>
              <h2 className="share-title">어이쿠, 안 됐어요</h2>
              <p className="share-sub">{errorMsg}</p>
            </div>
            <div className="share-actions">
              <button className="share-btn share-btn--primary" onClick={() => setPhase('form')}>다시 시도</button>
              <button className="share-btn share-btn--ghost" onClick={onClose}>닫기</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

window.ShareModal = ShareModal;
