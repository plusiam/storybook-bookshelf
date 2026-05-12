// 교사 어드민 — 학급 관리 (목록·만들기·코드 재발급·잠금 해제·삭제)
/* global React, PB */
const { useState: useStateCls, useEffect: useEffectCls, useCallback: useCallbackCls } = React;

/* ─── 헬퍼 ─────────────────────────────────────────────────────────── */

// 현재 시점으로부터 합리적인 디폴트 학년도 추정
// 한국 학기제: 3~7월 = 1학기, 8월~익년 2월 = 2학기
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

/* ─── 학급 만들기 폼 ──────────────────────────────────────────────── */

function CreateClassForm({ onCreated, onCancel }) {
  const [schoolYear, setSchoolYear] = useStateCls(defaultSchoolYear);
  const [grade, setGrade] = useStateCls(5);
  const [classNo, setClassNo] = useStateCls(1);
  const [classCode, setClassCode] = useStateCls('');
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
        class_code: classCode,
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

        <label className="class-create-field">
          <span>학급 코드 (선택)</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={classCode}
            onChange={(e) => setClassCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="비우면 자동"
            disabled={submitting}
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

function ClassCard({ cls, bookCount, onRegenerate, onUnlock, onDelete }) {
  const locked = cls.locked_until && new Date(cls.locked_until) > new Date();
  const aged = ageInDays(cls.created_at) >= 365;

  return (
    <article className={`class-card${locked ? ' is-locked' : ''}`}>
      <div className="class-card-code-row">
        <span className="class-card-code">{cls.class_code}</span>
        {aged && (
          <span className="class-card-aged" title="만든 지 1년이 지났어요">
            ⚠️ 1년 경과
          </span>
        )}
      </div>
      <h3 className="class-card-title">{cls.display_name}</h3>
      <p className="class-card-meta">
        {cls.school_year} · {cls.grade}학년 {cls.class_no}반
      </p>
      <p className="class-card-count">📚 책 {bookCount}권</p>

      {locked && (
        <div className="class-card-locked-banner">
          <span>🔒 잠금 중 · {formatRemaining(cls.locked_until)}</span>
          <button type="button" className="btn btn-sm" onClick={onUnlock}>
            지금 풀기
          </button>
        </div>
      )}

      <div className="class-card-actions">
        <button type="button" className="btn btn-sm" onClick={onRegenerate}>
          🔁 코드 재발급
        </button>
        <button type="button" className="btn btn-sm class-card-delete" onClick={onDelete}>
          🗑 삭제
        </button>
      </div>
    </article>
  );
}

/* ─── 메인 — 학급 어드민 ─────────────────────────────────────────── */

function ClassesAdmin() {
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

  const handleRegenerate = async (cls) => {
    const ok = window.confirm(
      `'${cls.display_name}'의 학급 코드를 새로 발급할까요?\n` +
      `이전 코드(${cls.class_code})는 더 이상 사용할 수 없습니다.`
    );
    if (!ok) return;
    try {
      await PB.regenerateClassCode(cls.id);
      await reload();
    } catch (e) {
      window.alert(e?.message || '재발급에 실패했어요');
    }
  };

  const handleUnlock = async (cls) => {
    try {
      await PB.unlockClass(cls.id);
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
            학년도별로 학급을 만들고 4자리 코드로 학부모에게 안내하세요.
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
              onRegenerate={() => handleRegenerate(c)}
              onUnlock={() => handleUnlock(c)}
              onDelete={() => handleDelete(c)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

window.ClassesAdmin = ClassesAdmin;
