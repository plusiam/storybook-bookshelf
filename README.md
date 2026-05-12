# 📖 우리 학급 그림책 작품집 (storybook-bookshelf)

학생을 **작가**로 모시고, 학생이 직접 자기 작품을 학급 작품집에 올리는 정적 웹 앱입니다. 가족·친구·다른 학급 누구나 학급 코드로 작품을 펼쳐볼 수 있도록 해 학생의 표현을 응원하는 것이 목적입니다.

| 모드 | 누구를 위해 | 어디서 | 백엔드 |
|---|---|---|---|
| **학생 피드백** | 수업 중 학생·교사 | [plusiam.github.io/storybook-bookshelf](https://plusiam.github.io/storybook-bookshelf/) (GH Pages, `main`) | 없음 (JSON 드래그) |
| **공개 작품집** | 학기말 가정·친구·다른 학급 | Vercel (`family` 브랜치) | Supabase |

두 모드는 한 저장소의 별개 브랜치로 운영됩니다. 학생용 화면은 영원히 백엔드 없는 단순 뷰어로 유지하고, 공개 작품집은 별도 도메인에서 운영합니다.

연관 도구 — [picturebook-storyboard](https://plusiam.github.io/picturebook-storyboard/) (그림책 JSON을 만드는 스토리보드)

---

## 🎒 학생 피드백 모드 (`main` → GH Pages)

수업 중 활동·발표용입니다. 백엔드가 없어 학생 작품이 외부 서버로 가지 않습니다.

1. picturebook-storyboard에서 그림책을 완성하고 JSON으로 저장
2. 도서관 페이지에 JSON 파일을 끌어다 놓거나 책장 빈 자리를 클릭해 업로드
3. 펼침면·슬라이드·풀그림 등 4가지 보기 방식 중 선택
4. 전자칠판이면 `🗖 전체화면(F키)` 또는 `⊞ 꽉 찬 화면`으로 발표
5. 책장은 그 기기 브라우저(IndexedDB)에만 저장됨

→ **개인·학급 단위로 진행 중인 작품을 함께 보며 피드백**할 때 사용합니다. 작품이 클라우드로 가지 않으므로 학생 개인정보 부담이 없습니다.

---

## 📖 공개 작품집 모드 (`family` → Vercel)

학기말 학생 작품을 **누구나 코드로 펼쳐볼 수 있는** 공개 작품집입니다. 가족·친구·다른 반 학생들이 함께 보는 것이 핵심 의도입니다.

### 세 가지 진입점

| 진입 | 누구 | 입력 | 가능한 동작 |
|---|---|---|---|
| `#/upload?y=...` | **학생 작가** | 6자리 업로드 코드 + 필명(별명) + JSON | 자기 작품을 학급 작품집에 올림 + 단권 공유 링크 발급 |
| `#/c/<코드>?y=...` | **누구나 관람객** | 4자리 열람 코드 | 학급 전체 작품집 보기 + 한 권씩 펼쳐 읽기 |
| `#/admin` | **교사** | 이메일 OTP | 학급 만들기·코드 발급·부적절 작품 삭제 |

### 학급당 두 종류 코드

- **열람 코드 4자리** — 누구나 알면 학급 작품집 열람. SNS·블로그·가정통신문에 안전하게 공유 가능
- **업로드 코드 6자리** — 학생에게만 안내. 학생만 작품 업로드 가능. 잘못된 입력 10회 누적 시 1시간 잠금

### 교사 운영 흐름

1. **Supabase 설정** (한 번만 — 아래 "Supabase 처음 설정" 참고)
2. `#/admin`에서 이메일 OTP로 로그인
3. **＋ 새 학급** → 학년도·학년·반 입력 → 두 코드 자동 발급
4. 학급 카드의 **📢 열람 안내** / **✍️ 업로드 안내** 버튼으로 메시지를 클립보드에 복사
   - 📢 열람 안내 (녹색) — 가정통신문·SNS에 공유 가능
   - ✍️ 업로드 안내 (파랑) — 학생 그룹 메신저에만 공유
5. 학생들이 직접 업로드 → 학급 카드 클릭으로 모니터, 부적절한 작품은 **🗑 삭제**
6. 학기 종료 후 학급 단위로 일괄 정리

### 학생 업로드 흐름 (학생 입장)

1. 선생님이 보낸 업로드 안내 메시지의 주소(`#/upload?y=2026-1`) 접속
2. **6자리 업로드 코드** 입력
3. **필명**(별명) 입력 — 실명·학번은 절대 입력 금지. 시스템이 흔한 실명 패턴 감지 시 노란 경고 표시
4. 한 줄 작가 소개 입력 (선택)
5. picturebook-storyboard에서 만든 **JSON 파일을 끌어다 놓기**
6. **🚀 작가로 올리기** → 성공 화면에서 단권 공유 링크 자동 발급, SNS·메신저에 복사

### 보안 정책 (대구시교육청 기준)

- 학생 실명·학번·연락처 **수집하지 않음**. 학생은 모두 **필명**으로 표시됨
- 검색엔진 인덱싱 차단 (`<meta name="robots" content="noindex, nofollow">`)
- 작품 데이터에 학생 실명을 적지 않도록 사전 지도 필수 — picturebook-storyboard에서 만들 때부터 별명 사용
- 업로드 코드 외부 유출 시 즉시 재발급 가능 (어드민 **🔁 업로드** 버튼)
- 학부모 동의서 권장 ([family-consent.md](./family-consent.md))
- 운영 정책 ([OPERATIONS.md](./OPERATIONS.md)) — 단일 교사 모드 / 회원가입 OFF / SMTP 운영 / 학기 체크리스트

---

## 🔧 Supabase 처음 설정 (교사용, 한 번만)

1. [supabase.com](https://supabase.com)에서 무료 계정 → 새 프로젝트 (Region: Northeast Asia (Seoul))
2. 대시보드 **SQL Editor → New query** → [`schema.sql`](./schema.sql) 전체 붙여넣기 → **Run**
3. **Project Settings → API**에서 두 값 복사
   - Project URL
   - Project API keys → **anon public** *(service_role 키는 절대 사용하지 말 것)*
4. [`config.js`](./config.js)의 `SUPABASE_URL` / `SUPABASE_ANON_KEY`에 붙여넣기
5. **Authentication → Providers → Email** 활성화 확인 (기본 활성)
6. (선택) **Authentication → SMTP Settings**에서 외부 SMTP 연결 — 본격 운영 시 기본 SMTP의 시간당 발송 한도가 낮음
7. [Vercel](https://vercel.com)에서 이 저장소를 import → `family` 브랜치를 프로덕션으로 설정 → 자동 배포

---

## 🚀 로컬에서 실행

```bash
# 저장소 디렉터리에서
python3 -m http.server 8000
# → http://localhost:8000 접속
```

`file://`로 더블클릭하면 `fetch`가 막혀 작동하지 않습니다. 반드시 로컬 서버로 띄우세요.

라우트
- `#/` — 홈 (학생·관람객·교사 세 카드)
- `#/upload?y=...` — 학생 업로드
- `#/c/<코드>?y=...` — 공개 학급 작품집
- `#/b/<slug>` — 단권 뷰어
- `#/admin` — 교사 어드민

---

## 🛠 기술 스택

- React 18 (UMD) + Babel Standalone — 빌드 도구 없이 정적 사이트로 동작
- Supabase Postgres + Auth(OTP) + Storage — 공개 작품집 전용
- Vercel — `family` 브랜치 정적 호스팅
- GitHub Pages — `main` 브랜치 정적 호스팅 (학생 피드백 모드)
- 한국어 폰트 — Google Fonts (Jua, Gowun Dodum, Nanum Pen Script 외)

### 데이터 모델 (Supabase)

- `classes` — 학급 (`view_code` 4자리 / `upload_code` 6자리, 학년도·학년·반, 교사 FK, upload 잠금 카운터)
- `books` — 책 (class FK, `pen_name` 필명, `title`, `intro`, JSONB 책 데이터, 이미지 storage 경로)
- RPC 4개
  - `view_class_books(코드, 학년도)` — 관람객 학급 작품집 열람
  - `upload_book(...)` — 학생 업로드 (서버 측 코드 매칭·잠금·필명 검증·슬러그 발급)
  - `get_book(slug)` — 단권 조회
  - `record_upload_failure(코드, 학년도)` — 잠금 카운트 누적

## 📄 라이선스

MIT. 자유롭게 수정·재배포 가능합니다.

---

🌱 만든 사람 [룰루랄라 한기쌤](https://plusiam.github.io) · 2026
