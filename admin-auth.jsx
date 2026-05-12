// 교사 어드민 진입 화면 — Supabase Auth 이메일 OTP 로그인 + 학급 관리 셸
/* global React, PB, ClassesAdmin */
const { useState: useStateAuth, useEffect: useEffectAuth, useCallback: useCallbackAuth } = React;

/* ======================================================
   TeacherLogin — 비로그인 상태에서 OTP 흐름
   1단계: 이메일 입력 → signInWithOtp 호출 → 6자리 코드 메일 발송
   2단계: 코드 입력 → verifyOtp → 세션 발급, 부모에게 콜백
   ====================================================== */

function TeacherLogin({ onSession }) {
  const [step, setStep] = useStateAuth('email'); // 'email' | 'code'
  const [email, setEmail] = useStateAuth('');
  const [code, setCode] = useStateAuth('');
  const [sending, setSending] = useStateAuth(false);
  const [verifying, setVerifying] = useStateAuth(false);
  const [error, setError] = useStateAuth(null);
  const [info, setInfo] = useStateAuth(null);

  const sendCode = useCallbackAuth(async (e) => {
    e?.preventDefault?.();
    setError(null);
    setInfo(null);
    setSending(true);
    try {
      await PB.signInWithOtp(email);
      setStep('code');
      setInfo(`${email.trim()}로 6자리 코드를 보냈어요. 메일을 확인해 주세요.`);
    } catch (err) {
      setError(err?.message || '이메일 발송에 실패했어요');
    } finally {
      setSending(false);
    }
  }, [email]);

  const verify = useCallbackAuth(async (e) => {
    e?.preventDefault?.();
    setError(null);
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

  const goBack = useCallbackAuth(() => {
    setStep('email');
    setCode('');
    setError(null);
    setInfo(null);
  }, []);

  return (
    <div className="admin-auth-scene">
      <div className="admin-auth-card">
        <header className="admin-auth-header">
          <span className="admin-auth-icon">👩‍🏫</span>
          <h1 className="admin-auth-title">교사 어드민</h1>
          <p className="admin-auth-sub">학급을 만들고 학생 작품을 업로드합니다.</p>
        </header>

        {step === 'email' && (
          <form className="admin-auth-form" onSubmit={sendCode}>
            <label className="admin-auth-label" htmlFor="admin-email">이메일</label>
            <input
              id="admin-email"
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
              📧 입력하신 이메일로 6자리 인증 코드를 보내드립니다. 처음이라도 자동으로 가입돼요.
            </p>
          </form>
        )}

        {step === 'code' && (
          <form className="admin-auth-form" onSubmit={verify}>
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
              onClick={goBack}
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
          <button className="btn" type="button" onClick={onExitAdmin} title="도서관으로">
            📚 도서관
          </button>
          <button className="btn admin-shell-signout" type="button" onClick={handleSignOut}>
            로그아웃
          </button>
        </div>
      </header>

      <ClassesAdmin />
    </div>
  );
}

window.TeacherLogin = TeacherLogin;
window.AdminShell = AdminShell;
