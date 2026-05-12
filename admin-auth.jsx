// 교사 어드민 진입 화면 — Supabase Auth 이메일 OTP 로그인 + 학급/책 관리 셸
/* global React, PB, ClassesAdmin, BooksAdmin */
const { useState: useStateAuth, useEffect: useEffectAuth, useCallback: useCallbackAuth } = React;

/* ======================================================
   TeacherLogin — 비로그인 상태에서 OTP 흐름
   1단계: 이메일 입력 → signInWithOtp 호출 → 6자리 코드 메일 발송
   2단계: 코드 입력 → verifyOtp → 세션 발급, 부모에게 콜백
   ====================================================== */

function TeacherLogin({ onSession }) {
  // 'password' (기본) | 'email' (OTP 발송) | 'code' (OTP 검증)
  const [mode, setMode] = useStateAuth('password');
  const [email, setEmail] = useStateAuth('');
  const [password, setPassword] = useStateAuth('');
  const [code, setCode] = useStateAuth('');
  const [sending, setSending] = useStateAuth(false);
  const [verifying, setVerifying] = useStateAuth(false);
  const [error, setError] = useStateAuth(null);
  const [info, setInfo] = useStateAuth(null);

  const resetMessages = () => { setError(null); setInfo(null); };

  const signInPw = useCallbackAuth(async (e) => {
    e?.preventDefault?.();
    resetMessages();
    setVerifying(true);
    try {
      const session = await PB.signInWithPassword(email, password);
      if (session) onSession?.(session);
    } catch (err) {
      setError(err?.message || '로그인에 실패했어요');
    } finally {
      setVerifying(false);
    }
  }, [email, password, onSession]);

  const sendCode = useCallbackAuth(async (e) => {
    e?.preventDefault?.();
    resetMessages();
    setSending(true);
    try {
      await PB.signInWithOtp(email);
      setMode('code');
      setInfo(`${email.trim()}로 6자리 코드를 보냈어요. 메일을 확인해 주세요.`);
    } catch (err) {
      setError(err?.message || '이메일 발송에 실패했어요');
    } finally {
      setSending(false);
    }
  }, [email]);

  const verifyCode = useCallbackAuth(async (e) => {
    e?.preventDefault?.();
    resetMessages();
    setVerifying(true);
    try {
      const session = await PB.verifyOtp(email, code);
      if (session) onSession?.(session);
    } catch (err) {
      setError(err?.message || '코드가 맞지 않아요');
    } finally {
      setVerifying(false);
    }
  }, [email, code, onSession]);

  const switchMode = (next) => {
    setMode(next);
    setCode('');
    resetMessages();
  };

  return (
    <div className="admin-auth-scene">
      <div className="admin-auth-card">
        <header className="admin-auth-header">
          <span className="admin-auth-icon">👩‍🏫</span>
          <h1 className="admin-auth-title">교사 어드민</h1>
          <p className="admin-auth-sub">학급을 만들고 학생 작품을 관리합니다.</p>
        </header>

        {mode !== 'code' && (
          <div className="admin-auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={`admin-auth-tab${mode === 'password' ? ' is-active' : ''}`}
              onClick={() => switchMode('password')}
            >
              🔑 비밀번호
            </button>
            <button
              type="button"
              role="tab"
              className={`admin-auth-tab${mode === 'email' ? ' is-active' : ''}`}
              onClick={() => switchMode('email')}
            >
              📧 이메일 OTP
            </button>
          </div>
        )}

        {mode === 'password' && (
          <form className="admin-auth-form" onSubmit={signInPw}>
            <label className="admin-auth-label" htmlFor="admin-email-pw">이메일</label>
            <input
              id="admin-email-pw"
              className="admin-auth-input"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="teacher@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={verifying}
            />
            <label className="admin-auth-label" htmlFor="admin-password">비밀번호</label>
            <input
              id="admin-password"
              className="admin-auth-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={verifying}
            />
            <button
              className="btn primary admin-auth-submit"
              type="submit"
              disabled={verifying || !email.trim() || !password}
            >
              {verifying ? '확인 중...' : '로그인'}
            </button>
            <p className="admin-auth-hint">
              🔐 이메일과 비밀번호로 빠르게 들어옵니다. 등록된 어드민만 사용 가능합니다.
            </p>
          </form>
        )}

        {mode === 'email' && (
          <form className="admin-auth-form" onSubmit={sendCode}>
            <label className="admin-auth-label" htmlFor="admin-email-otp">이메일</label>
            <input
              id="admin-email-otp"
              className="admin-auth-input"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="teacher@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={sending}
            />
            <button
              className="btn primary admin-auth-submit"
              type="submit"
              disabled={sending || !email.trim()}
            >
              {sending ? '메일 보내는 중...' : '6자리 코드 받기'}
            </button>
            <p className="admin-auth-hint">
              📧 비밀번호 대신 6자리 코드로 로그인합니다. 메일이 안 오면 비밀번호 탭을 써주세요.
            </p>
          </form>
        )}

        {mode === 'code' && (
          <form className="admin-auth-form" onSubmit={verifyCode}>
            <label className="admin-auth-label" htmlFor="admin-code">받은 6자리 코드</label>
            <input
              id="admin-code"
              className="admin-auth-input admin-auth-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              disabled={verifying}
              autoFocus
            />
            <button
              className="btn primary admin-auth-submit"
              type="submit"
              disabled={verifying || code.length !== 6}
            >
              {verifying ? '확인 중...' : '들어가기'}
            </button>
            <button
              className="btn admin-auth-link"
              type="button"
              onClick={() => switchMode('email')}
              disabled={verifying}
            >
              ← 다른 이메일로 시도
            </button>
          </form>
        )}

        {info && <p className="admin-auth-info">{info}</p>}
        {error && <p className="admin-auth-error">{error}</p>}
      </div>
    </div>
  );
}

/* ======================================================
   AdminShell — 로그인 후 placeholder
   Phase 3에서 학급 CRUD·책 업로드·visibility 토글이 채워질 예정
   ====================================================== */

function AdminShell({ session, onSignOut, onExitAdmin }) {
  const email = session?.user?.email || '';
  const [selectedClass, setSelectedClass] = useStateAuth(null);

  const handleSignOut = useCallbackAuth(async () => {
    await PB.signOut();
    onSignOut?.();
  }, [onSignOut]);

  return (
    <div className="admin-shell">
      <header className="admin-shell-header">
        <div className="admin-shell-title-block">
          <span className="admin-shell-tag">🔐 교사 어드민</span>
          <h1 className="admin-shell-title">환영합니다</h1>
          <p className="admin-shell-email">{email}</p>
        </div>
        <div className="admin-shell-actions">
          <button className="btn" type="button" onClick={onExitAdmin} title="홈으로">
            🏠 홈
          </button>
          <button className="btn admin-shell-signout" type="button" onClick={handleSignOut}>
            로그아웃
          </button>
        </div>
      </header>

      {selectedClass ? (
        <BooksAdmin cls={selectedClass} onBack={() => setSelectedClass(null)} />
      ) : (
        <ClassesAdmin onSelectClass={setSelectedClass} />
      )}
    </div>
  );
}

window.TeacherLogin = TeacherLogin;
window.AdminShell = AdminShell;
