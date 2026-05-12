# 📖 우리 반 그림책 도서관 (storybook-bookshelf)

학생이 만든 그림책을 **두 가지 방식**으로 보여주는 정적 웹 앱입니다.

| 모드 | 누구를 위해 | 어디서 | 백엔드 | 인증 |
|---|---|---|---|---|
| **학생 피드백** | 수업 중 학생·교사 | [plusiam.github.io/storybook-bookshelf](https://plusiam.github.io/storybook-bookshelf/) (GH Pages, `main`) | 없음 (JSON 드래그) | 없음 |
| **가족 공유** | 학기말 가정 열람 | Vercel (`family` 브랜치) | Supabase | 학급 코드 + 자녀 실명 |

두 모드는 한 저장소의 별개 브랜치로 운영됩니다. 학생용 화면은 영원히 백엔드 없는 단순 뷰어로 유지하고, 가족 공유는 별도 도메인에서 운영합니다.

연관 도구 — [picturebook-storyboard](https://plusiam.github.io/picturebook-storyboard/) (그림책 JSON을 만드는 스토리보드)

---

## 🎒 학생 피드백 모드 (`main` → GH Pages)

수업 중 활동·발표용입니다. 백엔드가 없으므로 학생 작품이 외부 서버로 가지 않습니다.

1. picturebook-storyboard에서 그림책을 완성하고 JSON으로 저장
2. 도서관 페이지에 JSON 파일을 끌어다 놓거나 책장 빈 자리를 클릭해 업로드
3. 펼침면·슬라이드·풀그림 등 4가지 보기 방식 중 선택
4. 전자칠판이면 `🗖 전체화면(F키)` 또는 `⊞ 꽉 찬 화면`으로 발표
5. 책장은 그 기기 브라우저(IndexedDB)에만 저장 — 다른 기기에서 보려면 책등의 `↓` 버튼으로 JSON을 내보낸 뒤 다시 꽂으세요

→ **개인 또는 학급 단위로 진행 중인 작품을 같이 보며 피드백**할 때 사용합니다. 작품이 클라우드로 가지 않으므로 학생 개인정보 부담이 없습니다.

---

## 👨‍👩‍👧 가족 공유 모드 (`family` → Vercel)

학기말, 학부모님이 집에서 자녀의 완성 작품을 보실 수 있는 비공개 서비스입니다.

### 학부모 동선 (3단계)

1. 담임이 안내한 **접속 주소**(예: `https://___.vercel.app/#/family`)에 접속
2. **4자리 학급 코드 + 학년도 + 학년·반 + 자녀 실명** 입력
3. 자녀 작품(⭐ 우리 아이) + 같은 반 친구들의 공개 작품을 한눈에 — 클릭하면 책처럼 펼쳐 봄

> 4가지 정보가 모두 정확해야 결과가 나옵니다. 잘못된 입력이 10회 누적되면 학급 코드가 **1시간 잠금**되니 가정통신문의 정보를 정확히 입력해 주세요.

### 교사 운영 흐름

1. **Supabase 설정** (한 번만 — 아래 "Supabase 처음 설정" 섹션 참고)
2. **/admin** 페이지에서 이메일 OTP로 로그인
3. **＋ 새 학급** 으로 학년도·학년·반 입력 → 4자리 코드 자동 발급
4. 학급 카드 클릭 → **＋ 책 업로드** 로 학생 JSON 하나씩 업로드
5. 책마다 **공개 범위** 선택
   - 🔒 비공개 — 자녀 본인 학부모만 볼 수 있음 (기본)
   - 👥 학급 공개 — 같은 반 학부모 누구나 볼 수 있음
6. 학급 카드의 **📋 안내문** 버튼으로 학부모 안내 메시지를 클립보드에 복사 → 가정통신문·메신저에 붙여넣기
7. 학기 종료 후 데이터 정리는 **🗑 삭제** 로 학급 단위로 일괄 처리 (책도 cascade로 함께 삭제)

### 보안 정책 (대구시교육청 기준)

- 학생 **실명**과 작품을 다루므로 가정통신문 단계에서 **학부모 동의서**([family-consent.md](./family-consent.md))를 받습니다
- 작품은 같은 학급 학부모님께만 노출되며 검색엔진에 인덱싱되지 않습니다
- 학번·연락처·주소 등은 수집하지 않습니다
- 학급 코드가 SNS 등으로 유출돼도 **자녀 실명을 모르면 어떤 작품도 보이지 않습니다**
- 학급 단위 1차 방어선: 실패 10회 누적 시 1시간 잠금
- 한 학년도가 지나면 어드민에 ⚠️ 1년 경과 배지가 떠 정리를 안내합니다

---

## 🔧 Supabase 처음 설정 (교사용, 한 번만)

가족 공유 모드를 자기 학교에서 사용하려면 한 번만 설정합니다.

1. [supabase.com](https://supabase.com)에서 무료 계정 → 새 프로젝트 (Region: Northeast Asia (Seoul))
2. 대시보드 **SQL Editor → New query** → [`schema.sql`](./schema.sql) 전체 붙여넣기 → **Run**
3. **Project Settings → API**에서 두 값 복사
   - Project URL
   - Project API keys → **anon public** *(service_role 키는 절대 사용하지 말 것)*
4. [`config.js`](./config.js)의 `SUPABASE_URL`·`SUPABASE_ANON_KEY`에 붙여넣기
5. **Authentication → Providers → Email** 활성화 확인 (기본 활성)
6. (선택) **Authentication → SMTP Settings**에서 외부 SMTP(Resend/SendGrid 등) 연결 — 기본 SMTP는 시간당 발송 한도가 낮아 본격 운영 시 필요
7. [Vercel](https://vercel.com)에서 이 저장소를 import → `family` 브랜치를 프로덕션으로 설정 → 자동 배포

---

## 🚀 로컬에서 실행

```bash
# 저장소 디렉터리에서
python3 -m http.server 8000
# → http://localhost:8000 접속
```

`file://`로 더블클릭하면 `fetch`가 막혀 작동하지 않습니다. 반드시 로컬 서버로 띄우세요.

라우트 — `#/` 학생 도서관 / `#/admin` 교사 어드민 / `#/family` 학부모 진입

---

## 🛠 기술 스택

- React 18 (UMD) + Babel Standalone — 빌드 도구 없이 정적 사이트로 동작
- Supabase Postgres + Auth(OTP) + Storage — 가족 공유 모드 전용
- Vercel — `family` 브랜치 정적 호스팅
- GitHub Pages — `main` 브랜치 정적 호스팅 (학생 피드백 모드)
- 한국어 폰트 — Google Fonts (Jua, Gowun Dodum, Nanum Pen Script 외)

데이터 모델 한눈에 (Supabase) —
- `classes` — 학급 (4자리 코드, 학년도, 학년·반, 교사 FK, 잠금 카운터)
- `books` — 책 (class FK, 학생 실명, 책 데이터 JSONB, visibility, 이미지 storage 경로)
- RPC `get_class_books(코드, 학년도, 학년, 반, 자녀이름)` — 학부모가 호출하는 유일한 진입점

## 📄 라이선스

MIT. 자유롭게 수정·재배포 가능합니다.

---

🌱 만든 사람 [룰루랄라 한기쌤](https://plusiam.github.io) · 2026
