// 교사 어드민 — 학급 관리 v3 (두 코드 분리: view_code 열람용 / upload_code 학생 업로드용)
/* global React, PB */
const { useState: useStateCls, useEffect: useEffectCls, useCallback: useCallbackCls } = React;

/* ─── 헬퍼 ─────────────────────────────────────────────────────────── */

function defaultSchoolYear() {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 3 && month <= 7) return `${year}-1`;
  if (month >= 8) return `${year}-2`;
  return `${year - 1}-2`;
}

function formatRemaining(until) {
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return '곧 풀림';
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `약 ${mins}분 남음`;
  const hours = Math.ceil(mins / 60);
  return `약 ${hours}시간 남음`;
}

function ageInDays(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

async function copyToClipboard(text, successMsg) {
  try {
    await navigator.clipboard.writeText(text);
    window.alert(successMsg);
  } catch (e) {
    window.prompt('아래 내용을 복사해서 사용해 주세요', text);
  }
}

function siteOrigin() {
  return `${window.location.origin}${window.location.pathname}`;
}

/* ─── 학급 만들기 폼 (코드는 자동 발급, 수동 입력 폐기) ────────── */

function CreateClassForm({ onCreated, onCancel }) {
  const [schoolYear, setSchoolYear] = useStateCls(defaultSchoolYear);
  const [grade, setGrade] = useStateCls(5);
  const [classNo, setClassNo] = useStateCls(1);
  const [displayName, setDisplayName] = useStateCls('');
  const [submitting, setSubmitting] = useStateCls(false);
  const [error, setError] = useStateCls(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await PB.createClass({
        school_year: schoolYear,
        grade,
        class_no: classNo,
        display_name: displayName,
      });
      onCreated();
    } catch (err) {
      setError(err?.message || '학급 생성에 실패했어요');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="class-create-card" onSubmit={submit}>
      <h3 className="class-create-title">새 학급 만들기</h3>

      <div className="class-create-grid">
        <label className="class-create-field">
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

        <label className="class-create-field">
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

        <label className="class-create-field">
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

      <label className="class-create-field class-create-field--full">
        <span>표시 이름 (선택)</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={`${grade}학년 ${classNo}반 (${schoolYear})`}
          maxLength={40}
          disabled={submitting}
        />
      </label>

      <p className="class-create-hint">
        📌 학급을 만들면 <strong>열람 코드(4자리)</strong>와 <strong>업로드 코드(6자리)</strong>가 자동으로 발급됩니다.
      </p>

      {error && <p className="class-create-error">{error}</p>}

      <div className="class-create-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
          취소
        </button>
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? '만드는 중...' : '학급 만들기'}
        </button>
      </div>
    </form>
  );
}

/* ─── 학급 카드 ───────────────────────────────────────────────────── */

function ClassCard({
  cls, bookCount,
  onOpen,
  onCopyViewAnnouncement, onCopyUploadAnnouncement,
  onRegenerateView, onRegenerateUpload,
  onUnlockUpload, onDelete,
}) {
  const locked = cls.upload_locked && new Date(cls.upload_locked) > new Date();
  const aged = ageInDays(cls.created_at) >= 365;
  const stop = (e) => e.stopPropagation();

  return (
    <article
      className={`class-card${locked ? ' is-locked' : ''} is-clickable`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(); }
      }}
      title="클릭해서 학급 안의 책 보기"
    >
      <div className="class-card-code-row">
        <div className="class-card-code-block">
          <span className="class-card-code-label">열람</span>
          <span className="class-card-code class-card-code--view">{cls.view_code}</span>
        </div>
        {aged && (
          <span className="class-card-aged" title="만든 지 1년이 지났어요">
            ⚠️ 1년 경과
          </span>
        )}
      </div>

      <div className="class-card-code-row class-card-code-row--upload">
        <div className="class-card-code-block">
          <span className="class-card-code-label">업로드</span>
          <span className="class-card-code class-card-code--upload">{cls.upload_code}</span>
        </div>
      </div>

      <h3 className="class-card-title">{cls.display_name}</h3>
      <p className="class-card-meta">
        {cls.school_year} · {cls.grade}학년 {cls.class_no}반
      </p>
      <p className="class-card-count">📚 책 {bookCount}권</p>

      {locked && (
        <div className="class-card-locked-banner" onClick={stop}>
          <span>🔒 업로드 잠금 · {formatRemaining(cls.upload_locked)}</span>
          <button type="button" className="btn btn-sm" onClick={onUnlockUpload}>
            지금 풀기
          </button>
        </div>
      )}

      <div className="class-card-actions" onClick={stop}>
        <button
          type="button"
          className="btn btn-sm class-card-announce class-card-announce--view"
          onClick={onCopyViewAnnouncement}
          title="누구나 공유 가능한 열람 안내문 (SNS·블로그 안전)"
        >
          📢 열람 안내
        </button>
        <button
          type="button"
          className="btn btn-sm class-card-announce class-card-announce--upload"
          onClick={onCopyUploadAnnouncement}
          title="학생에게만 보내는 업로드 안내문"
        >
          ✍️ 업로드 안내
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={onRegenerateView}
          title="열람 코드만 새로 발급"
        >
          🔁 열람
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={onRegenerateUpload}
          title="업로드 코드만 새로 발급 (잠금도 함께 해제)"
        >
          🔁 업로드
        </button>
        <button
          type="button"
          className="btn btn-sm class-card-delete"
          onClick={onDelete}
        >
          🗑 삭제
        </button>
      </div>
    </article>
  );
}

/* ─── 메인 ────────────────────────────────────────────────────────── */

function ClassesAdmin({ onSelectClass }) {
  const [classes, setClasses] = useStateCls([]);
  const [counts, setCounts] = useStateCls({});
  const [loading, setLoading] = useStateCls(true);
  const [error, setError] = useStateCls(null);
  const [showCreate, setShowCreate] = useStateCls(false);

  const reload = useCallbackCls(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await PB.listClasses();
      setClasses(list);
      if (list.length > 0) {
        const cnt = await PB.countBooksByClass(list.map((c) => c.id));
        setCounts(cnt);
      } else {
        setCounts({});
      }
    } catch (e) {
      setError(e?.message || '학급 목록을 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffectCls(() => { reload(); }, [reload]);

  // ── 안내문 두 종류 ────────────────────────────────────────────
  const handleCopyViewAnnouncement = (cls) => {
    const url = `${siteOrigin()}#/c/${cls.view_code}?y=${encodeURIComponent(cls.school_year)}`;
    const text =
      `📖 ${cls.display_name} — 작품집 안내\n\n` +
      `우리 반 학생 작가들의 그림책 작품집을 함께 보실 수 있어요.\n\n` +
      `📲 접속 주소: ${url}\n` +
      `🔑 열람 코드: ${cls.view_code} (4자리 숫자)\n` +
      `🏫 학년도: ${cls.school_year}\n\n` +
      `코드를 알고 계신 분은 누구나 보실 수 있습니다. SNS/블로그/가정통신문에 공유 가능합니다.\n` +
      `* 작품은 학생 필명으로 표시됩니다.\n\n` +
      `— 담임 드림`;
    copyToClipboard(text, '열람 안내문이 클립보드에 복사되었어요.\n가정통신문이나 학급 메신저에 붙여넣어 주세요.');
  };

  const handleCopyUploadAnnouncement = (cls) => {
    const url = `${siteOrigin()}#/upload?y=${encodeURIComponent(cls.school_year)}`;
    const text =
      `✍️ ${cls.display_name} — 작품 업로드 안내 (학생용)\n\n` +
      `완성한 그림책 JSON 파일을 직접 올려 작가로 등록할 수 있어요.\n\n` +
      `📲 접속 주소: ${url}\n` +
      `🔐 업로드 코드: ${cls.upload_code} (6자리, 학생에게만 안내)\n` +
      `🏫 학년도: ${cls.school_year}\n\n` +
      `업로드 흐름\n` +
      `  1) 위 주소로 접속\n` +
      `  2) 업로드 코드와 학년도 입력\n` +
      `  3) 자신의 필명(별명) 입력 — 실명 사용 금지\n` +
      `  4) JSON 파일 드래그·드롭 → 업로드\n` +
      `  5) 공유 링크가 생기면 학급 작품집에서도 자동으로 보입니다\n\n` +
      `⚠️ 업로드 코드는 우리 반 학생에게만 알려야 합니다.\n` +
      `잘못된 입력이 10회 누적되면 코드가 일시 잠깁니다.\n\n` +
      `— 담임 드림`;
    copyToClipboard(text, '학생용 업로드 안내문이 클립보드에 복사되었어요.\n학급 메신저(학생 그룹)에만 공유해 주세요.');
  };

  const handleRegenerateView = async (cls) => {
    const ok = window.confirm(
      `'${cls.display_name}'의 열람 코드를 새로 발급할까요?\n` +
      `이전 코드(${cls.view_code})로는 더 이상 접속할 수 없습니다.`
    );
    if (!ok) return;
    try {
      await PB.regenerateViewCode(cls.id);
      await reload();
    } catch (e) {
      window.alert(e?.message || '재발급에 실패했어요');
    }
  };

  const handleRegenerateUpload = async (cls) => {
    const ok = window.confirm(
      `'${cls.display_name}'의 업로드 코드를 새로 발급할까요?\n` +
      `이전 코드(${cls.upload_code})는 사용 불가 + 잠금 카운터도 초기화됩니다.`
    );
    if (!ok) return;
    try {
      await PB.regenerateUploadCode(cls.id);
      await reload();
    } catch (e) {
      window.alert(e?.message || '재발급에 실패했어요');
    }
  };

  const handleUnlockUpload = async (cls) => {
    try {
      await PB.unlockUpload(cls.id);
      await reload();
    } catch (e) {
      window.alert(e?.message || '잠금 해제에 실패했어요');
    }
  };

  const handleDelete = async (cls) => {
    const cnt = counts[cls.id] || 0;
    const ok = window.confirm(
      `'${cls.display_name}' 학급을 삭제할까요?\n` +
      (cnt > 0 ? `이 학급의 책 ${cnt}권도 모두 함께 삭제됩니다.\n` : '') +
      `되돌릴 수 없습니다.`
    );
    if (!ok) return;
    try {
      await PB.deleteClass(cls.id);
      await reload();
    } catch (e) {
      window.alert(e?.message || '삭제에 실패했어요');
    }
  };

  return (
    <section className="classes-admin">
      <header className="classes-admin-header">
        <div>
          <h2 className="classes-admin-title">학급 관리</h2>
          <p className="classes-admin-sub">
            학년도별 학급을 만들고 두 종류 코드(<strong>열람</strong>·<strong>업로드</strong>)로 안내하세요.
          </p>
        </div>
        {!showCreate && (
          <button
            type="button"
            className="btn primary"
            onClick={() => setShowCreate(true)}
          >
            ＋ 새 학급
          </button>
        )}
      </header>

      {showCreate && (
        <CreateClassForm
          onCreated={async () => { setShowCreate(false); await reload(); }}
          onCancel={() => setShowCreate(false)}
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

      {!loading && !error && classes.length === 0 && !showCreate && (
        <div className="classes-admin-empty">
          <div className="classes-admin-empty-icon">🏫</div>
          <h3>아직 만든 학급이 없어요</h3>
          <p>'＋ 새 학급' 버튼으로 첫 학급을 만들어 보세요.</p>
        </div>
      )}

      {!loading && classes.length > 0 && (
        <div className="classes-grid">
          {classes.map((c) => (
            <ClassCard
              key={c.id}
              cls={c}
              bookCount={counts[c.id] || 0}
              onOpen={() => onSelectClass?.(c)}
              onCopyViewAnnouncement={() => handleCopyViewAnnouncement(c)}
              onCopyUploadAnnouncement={() => handleCopyUploadAnnouncement(c)}
              onRegenerateView={() => handleRegenerateView(c)}
              onRegenerateUpload={() => handleRegenerateUpload(c)}
              onUnlockUpload={() => handleUnlockUpload(c)}
              onDelete={() => handleDelete(c)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

window.ClassesAdmin = ClassesAdmin;
