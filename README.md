# 📖 우리 반 그림책 도서관 (storybook-bookshelf)

학생이 만든 그림책 JSON 파일을 **단 한 번의 업로드로 짧은 공유 링크**로 바꿔주는 정적 웹 앱입니다. 받은 링크를 패들렛·알림장·카톡에 붙여 넣으면 누구나 진짜 책처럼 펼쳐볼 수 있어요.

- **학생** — JSON 파일 끌어다 놓기 → 공유 링크 복사 → 패들렛에 붙여넣기. 끝.
- **친구·부모님** — 링크 클릭 → 바로 책 펼쳐짐. 가입·로그인 없음.
- **교사** — 학급코드를 학생들과 통일하면 `#/g/학급코드`에서 학급 작품집을 한눈에 봅니다.

연관 도구
- [picturebook-storyboard](https://plusiam.github.io/picturebook-storyboard/) — 그림책 JSON을 만드는 스토리보드 도구

---

## 학생용 사용법

1. picturebook-storyboard에서 그림책을 완성하고 JSON 파일로 저장하기
2. 우리 반 그림책 도서관 사이트 열기
3. JSON 파일을 페이지 위로 **끌어다 놓거나** 가운데 책장 빈 자리를 클릭해서 업로드
4. 미리보기로 책이 잘 펼쳐지는지 확인
5. **"공유 링크 만들기"** 버튼 → 학급코드(선택) 입력 → 짧은 링크 자동 복사
6. 패들렛·카톡·알림장에 붙여 넣기

> 학급코드는 비워두어도 돼요. 선생님이 학급코드를 알려주셨을 때만 입력하세요.

## 교사용 사용법

### 처음 한 번만 설정 (5분)

학생들이 올린 책을 받아두는 **저장 공간**을 한 번만 만들어 둡니다.

1. [supabase.com](https://supabase.com)에서 무료 계정 만들기 → 새 프로젝트 생성 (Region: Northeast Asia (Seoul))
2. **SQL Editor** → **New query** → 이 저장소의 [`schema.sql`](./schema.sql) 내용 전체 복사·붙여넣기 → **Run**
3. **Project Settings → API** 에서 다음 두 값 복사
   - Project URL
   - Project API keys → **anon public** (절대 service_role 키 사용하지 말 것)
4. [`config.js`](./config.js) 파일을 열어 두 값을 채워 넣기
   ```js
   window.PB_CONFIG = {
     SUPABASE_URL: 'https://xxxxx.supabase.co',
     SUPABASE_ANON_KEY: 'eyJhbGciOi...',
     // ...
   };
   ```
5. [Vercel](https://vercel.com)에서 이 저장소를 import → 자동 배포 → 끝

### 수업 운영

1. 학생들에게 **공통 학급코드** 알려주기 (예: `5-3-2026`)
2. 학생들이 각자 책을 올리면서 학급코드 입력
3. 교사는 `https://내사이트.vercel.app/#/g/5-3-2026` 으로 학급 책장 접속
4. 다단 책장에 학급 전체 작품이 모임. 클릭하면 한 권씩 펼쳐 보기

### 다른 선생님과 공유

- 같은 사이트 URL을 그대로 알려주시면 됩니다. 학급코드만 다르게 쓰면 데이터가 서로 섞이지 않아요.
- 별도 fork·배포 없이 한 사이트를 여러 학교·여러 학급이 공유합니다.

---

## 개인정보 정책

- **별명만 저장합니다.** 실명·학번·반번호는 클라우드에 올라가지 않아요.
- 학생이 JSON 파일을 만들 때부터 이름 칸에 별명·캐릭터 이름을 쓰도록 안내해 주세요 (대구시교육청 정보보호 기준).
- 한 번 올린 책은 **수정·삭제할 수 없습니다.** 잘못 올렸으면 새 링크를 다시 만들어서 쓰면 됩니다.

## 기술 스택

- React 18 (UMD) + Babel Standalone — 빌드 도구 없이 정적 사이트로 동작
- Supabase Postgres — 책 1권 = row 1개
- Vercel — 정적 호스팅
- 한국어 폰트 — Google Fonts (Jua, Gowun Dodum, Nanum Pen Script 등)

## 로컬에서 실행

```bash
# 저장소 디렉토리에서
python3 -m http.server 8000
# → http://localhost:8000 접속
```

`file://` 더블클릭으로 열면 fetch가 막혀서 안 돼요. 반드시 위처럼 로컬 서버를 띄우세요.

## 라이선스

MIT. 자유롭게 수정·재배포 가능합니다.

---

🌱 만든 사람 [룰루랄라 한기쌤](https://plusiam.github.io) · 2026
