# 운영 지침 (OPERATIONS)

storybook-bookshelf의 운영 정책을 정해두는 문서입니다. Supabase 대시보드의 어떤 항목을 어떻게 설정하고, 왜 그렇게 결정했는지 기록합니다.

## 1. 운영 모드

### 단일 교사 어드민 (현재)

- **어드민 사용자**: 한기쌤(plusiam) **1인만**
- **이 Supabase 프로젝트**(`storybook-bookshelf` / ref: `ipjdoabdjuuieuojvryl`)는 한기쌤 개인 운영 자원입니다.
- 다른 교사가 이 시스템을 쓰고 싶으면 **자기 저장소를 fork + 자기 Supabase 프로젝트 신규 생성**으로 분리합니다(같은 프로젝트에 다른 교사를 합치지 않습니다).

### 인증·권한 한눈

| 역할 | 인증 방식 | 메일 발송 | Supabase Auth 가입 |
|---|---|---|---|
| 교사 (한기쌤) | 이메일 OTP | 본인 로그인 시 1회 (가끔) | ✅ 1명 |
| 학생 | upload_code 6자리 | ❌ | ❌ (anon으로 RPC) |
| 관람객 | view_code 4자리 | ❌ | ❌ (anon으로 RPC) |

학생·관람객은 **Supabase Auth에 가입하지 않습니다**. Auth users 풀에는 한기쌤 1명만 존재합니다.

## 2. 회원가입 정책

### 결정: **외부 회원가입 OFF**

- **이유**: 한기쌤 1인 운영이므로 외부인이 자기 이메일로 Auth 가입해 Auth users 풀을 차지할 필요가 없습니다. RLS로 데이터 격리는 되어 있지만, 무료 Auth user 한도(50K)와 운영상 혼동을 줄이려면 OFF가 깔끔합니다.

### 한기쌤 본인 가입은 한 번만 수동으로

먼저 본인 어드민 계정을 만들고 → 그 다음 회원가입 토글을 OFF로 잠그는 순서입니다.

1. https://storybook-bookshelf.vercel.app/#/admin 접속
2. 본인 이메일 입력 → "6자리 코드 받기" → 메일함의 코드 입력 → "들어가기"
3. AdminShell 진입 확인 (좌상단에 본인 이메일이 표시되면 성공)
4. 한 번 가입되면 Supabase Auth에 영구 등록됩니다. 이후엔 같은 이메일로 언제든 로그인 가능.

### 회원가입 OFF 토글 (본인 가입 마친 뒤 한 번만)

- 위치: **Supabase Dashboard → storybook-bookshelf → Authentication → Sign In / Providers → User Signups**
- **"Allow new users to sign up"** 토글을 **OFF**로 변경 → Save

이후 외부 이메일로는 어드민 가입이 불가능합니다.

### 로그인 방식 (두 가지 병행)

`#/admin` 진입 화면에 두 탭이 있습니다.

- **🔑 비밀번호** (기본) — 이메일 + 비밀번호. 빠르고 SMTP 의존 없음. 평소엔 이 방식
- **📧 이메일 OTP** — 비밀번호를 잊었거나 다른 기기에서 일회용으로 로그인. SMTP 발송 필요

**⚠️ 비밀번호 보안 수칙**
- 비밀번호를 git·문서·메신저·메일에 **절대 적지 마세요**. 본인 머릿속 또는 비밀번호 매니저(1Password·Bitwarden 등)에만 보관
- Leaked Password Protection을 ON으로 켜면 약한 비밀번호는 거부됩니다. 그 전에 충분히 강한 비밀번호로 한 번 갱신 권장
- 비밀번호를 새로 정하려면 Supabase Dashboard → Authentication → Users → 해당 계정 → ⋯ 메뉴 → **Send password recovery** 또는 SQL `update auth.users set encrypted_password = crypt('새비번', gen_salt('bf')) where email = '...'`

## 3. SMTP 발송

### 결정: **현재는 기본 SMTP 유지, 필요해지면 Resend 연결**

- 한기쌤 본인 한 명만 OTP를 받으므로 Supabase 기본 SMTP의 시간당 ~3통 한도로 충분합니다.
- 가입 OFF 상태에선 다른 사람이 OTP를 요청할 일도 없습니다.

### Resend 연결이 필요해지는 시점

다음 중 하나에 해당하면 Resend(또는 다른 외부 SMTP) 연결을 권장합니다.

- 한기쌤이 같은 시간대에 4번 이상 반복 로그아웃·재로그인하게 되었을 때
- 운영 정책이 바뀌어 외부 교사 가입을 허용하게 될 때
- 학부모/학생 인증에 OTP를 추가하게 될 때 (현재 합의서엔 없음)

### Resend 연결 절차 (필요해질 때 참고)

1. [resend.com](https://resend.com) 무료 가입 (월 3,000건 한도)
2. **API Keys**에서 새 키 생성 (예: `re_xxx`)
3. (선택) 발신 도메인 DNS 인증. 도메인 없으면 `onboarding@resend.dev`로 발송 가능
4. **Supabase Dashboard → Authentication → SMTP Settings → Enable Custom SMTP**
   - Host: `smtp.resend.com`
   - Port: `465` (또는 `587`)
   - Username: `resend`
   - Password: 위에서 만든 Resend API 키
   - Sender email: 본인 도메인 이메일 또는 `onboarding@resend.dev`
5. **Save** → 본인 어드민에서 한 번 로그아웃 → 재로그인해 OTP 정상 발송 확인

## 4. 권장 추가 보안 토글

본인 가입을 마치고 회원가입 OFF한 직후 같이 처리하면 좋은 항목들입니다.

| 위치 | 토글 | 결정 |
|---|---|---|
| **Authentication → URL Configuration → Site URL** | 입력 | `https://storybook-bookshelf.vercel.app` |
| **Authentication → URL Configuration → Redirect URLs** | 추가 | `https://storybook-bookshelf.vercel.app/*` |
| **Authentication → Sign In / Providers → Password Policy** | Leaked Password Protection | **ON** (Advisor 권고) |
| (선택) **Authentication → Email Templates → Magic Link / OTP** | 본문 한국어로 | 학교 발송 시 친절 |

## 5. 본인 계정 분실·복구

### 이메일을 잃거나 메일함에 접근 못 할 때

- Supabase Dashboard에 **organization 소유자 권한**으로 접속 가능하면, **Authentication → Users**에서 자기 user row를 보고 이메일을 변경할 수 있습니다.
- organization 소유자 권한까지 잃으면 Supabase 지원팀에 문의 (계정 회복 절차).
- 따라서 **Supabase 가입 시 사용한 GitHub/Google 계정도 별도로 보존**해야 합니다.

### 어드민 권한이 한 명만 있다는 위험

- 만약 한기쌤 이메일이 정지되면 어드민 진입 자체가 불가능 → 학급 코드 재발급·잠금 해제·부적절 작품 삭제가 안 됨
- **권장 대비책**: 한기쌤이 사용 가능한 두 번째 이메일(예: 학교 이메일 + 개인 이메일)을 미리 가입시켜 두 계정 모두 어드민으로 등록. 평소엔 한 계정만 사용, 비상시 두 번째 계정으로 진입.
- 이 작업은 회원가입 OFF 전에 끝내야 합니다. OFF한 뒤에는 새 가입 불가하므로 두 번째 이메일을 미리 가입시키지 못함.

## 6. 미래에 다른 교사가 합류하고 싶을 때

별도 fork 구조를 권장합니다 (단일 교사 정책 유지).

1. 그 교사가 GitHub에서 이 저장소 fork
2. 자기 Supabase 프로젝트 신규 생성 + `schema.sql` 적용
3. fork한 저장소의 `config.js`의 URL/key를 자기 프로젝트 것으로 교체
4. Vercel(또는 다른 정적 호스팅)에 자기 fork를 배포
5. 자기 학교 도메인으로 운영

같은 Supabase 프로젝트에 합치고 싶다면, 회원가입을 일시 ON으로 돌려 그 교사 가입을 받고 다시 OFF로 잠그면 됩니다. 단 이 경우 두 교사가 같은 무료 한도를 나눠 씁니다.

## 7. 학기 운영 체크리스트

| 시점 | 작업 |
|---|---|
| 학기 시작 직전 | 학부모 동의서 ([family-consent.md](./family-consent.md)) 인쇄·서명 수집 |
| 학기 시작 | 어드민에서 학년도·학년·반 학급 만들기 → 두 코드 발급 |
| 학기 중 활동 | 학생 작품 만들 때 별명 사용 안내 (실명 작품에 직접 적지 않도록) |
| 학기말 본격 운영 직전 | 필요 시 Resend SMTP 연결, Auth → Users에서 본인 외 계정 없는지 점검 |
| 학기말 | 어드민에서 학생 안내문(✍️) 학급 메신저 발송 → 학생 직접 업로드 |
| 학기 완료 후 | 열람 안내문(📢) 가정통신문 발송 |
| 다음 학기 직전 | 1년 경과 ⚠️ 배지가 뜬 학급 정리(삭제 또는 보존 결정) |

---

문서 유지보수 — 운영 정책이 바뀔 때마다 이 파일을 갱신해 주세요. 결정의 **이유**를 적어두면 미래의 본인 또는 인수자가 같은 결정을 다시 내릴 수 있습니다.
