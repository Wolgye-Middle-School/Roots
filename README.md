# Roots · 느티나무 게시판

특수학급 교사와 학부모의 원활한 소통을 위한 온라인 커뮤니티 (월계중학교 느티나무반)

## 왜 만들었나요?

- **문제점**: 특수학급 교사는 학생 한 명당 1년에 평균 50~60회 이상 학부모와 소통하며, 이에 많은 시간을 쓰고 있습니다.
- **해결책**: 게시판을 통해 아이들의 학습 현황과 수업 활동을 한 번에 공유하고, 학부모님들이 서로 공감하며 정보를 나누는 공동체를 만듭니다.

## 주요 기능 (MVP)

| 기능 | 설명 |
| --- | --- |
| 메인 페이지 | 느티나무반 소개, 공지사항, 전체 최신글 |
| 게시판 | 공지사항 · 느티나무반 소개 · 학습·활동 공유 · 학부모 소통방 |
| 공개 범위 | 게시글마다 **전체 공개** / **🔒 회원 전용** 선택 (기본값: 회원 전용) |
| 사진 첨부 | 게시글당 5장, 보호자 동의 확인 필수, 열람 권한이 있는 사람만 사진 조회 가능 |
| 댓글 · 공감 | 승인된 회원은 댓글과 공감(좋아요) 가능 |
| 회원가입 / 로그인 | 일반(아이디·비밀번호), 카카오, 네이버, 구글 |
| 게시판 관리자 | 가입 승인/거절, 역할(학부모·교사·관리자) 변경, 회원·게시글 삭제 |

### 권한

| | 비회원 | 승인 대기 회원 | 학부모 | 교사 | 관리자 |
| --- | :-: | :-: | :-: | :-: | :-: |
| 전체 공개 글 열람 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 회원 전용 글 열람 |  |  | ✅ | ✅ | ✅ |
| 학부모 소통방 글쓰기 |  |  | ✅ | ✅ | ✅ |
| 공지사항 · 반 소개 · 학습·활동 공유 글쓰기 |  |  |  | ✅ | ✅ |
| 댓글 · 공감 |  |  | ✅ | ✅ | ✅ |
| 회원 관리 |  |  |  |  | ✅ |

- 새로 가입한 회원(소셜 로그인 포함)은 **승인 대기** 상태이며, 관리자가 실제 느티나무반 학부모·교사인지 확인 후 승인합니다.
- 소셜 로그인으로 가입한 회원은 학부모로 등록되며, 교사는 관리자가 역할을 변경해 주어야 합니다.

## 시작하기

Node.js **22.13 이상**이 필요합니다. (내장 `node:sqlite` 사용, 별도 DB 설치 불필요)

```bash
npm install
cp .env.example .env   # 값 채우기 (SESSION_SECRET은 꼭 변경)
npm start              # http://localhost:3000
```

개발 중에는 `npm run dev`로 파일 변경 시 자동 재시작됩니다.

### 관리자 계정

최초 실행 시 관리자 계정이 자동 생성됩니다.

- 아이디: `admin`
- 비밀번호: `admin`

> ⚠️ 운영 전에 반드시 로그인 후 **비밀번호 변경** 메뉴에서 비밀번호를 바꿔 주세요. 기본 비밀번호를 쓰는 동안 관리자 페이지에 경고가 표시됩니다.

### 소셜 로그인 설정

`.env`에 키를 입력한 소셜 로그인만 활성화됩니다. 각 개발자 콘솔에 아래 **Redirect URI(Callback URL)** 를 등록하세요. (`BASE_URL`을 실제 주소로 변경)

| 서비스 | 개발자 콘솔 | Redirect URI | 환경변수 |
| --- | --- | --- | --- |
| 카카오 | https://developers.kakao.com | `{BASE_URL}/auth/kakao/callback` | `KAKAO_CLIENT_ID`(REST API 키), `KAKAO_CLIENT_SECRET`(선택) |
| 네이버 | https://developers.naver.com | `{BASE_URL}/auth/naver/callback` | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` |
| 구글 | https://console.cloud.google.com | `{BASE_URL}/auth/google/callback` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |

## 배포 시 주의사항

데이터베이스(`data/roots.db`), 로그인 세션, 업로드한 사진(`uploads/`)이 **서버 디스크에 저장**됩니다.

- Render, Railway, Fly.io 등 **영구 디스크(volume)** 를 붙일 수 있는 곳에 배포하세요. 경로는 `DATA_DIR`, `UPLOAD_DIR` 환경변수로 바꿀 수 있습니다.
- Vercel(Express 프리셋)에서도 실행되지만, 서버리스 환경에서는 `/tmp`에 저장되어 **인스턴스가 재시작되면 데이터와 로그인이 초기화**됩니다. 시연용으로만 사용하고, 실제 운영은 외부 DB·파일 저장소로 전환하거나 영구 디스크가 있는 곳에 배포하세요. (관리자 화면에 경고 표시)
- Vercel 환경변수에 `SESSION_SECRET`, `BASE_URL`(예: `https://roots-xxx.vercel.app`)을 반드시 설정하세요.
- HTTPS 주소를 `BASE_URL`에 설정하면 세션 쿠키에 `Secure`가 적용됩니다.

## 보안

- 비밀번호 bcrypt 해시 저장, 로그인 시도 제한 (IP당 15분 10회)
- 모든 POST 요청 CSRF 토큰 검증, 소셜 로그인 OAuth `state` 검증
- 게시글·댓글 내용은 HTML 이스케이프 처리 (XSS 방지)
- 업로드 파일은 확장자가 아닌 파일 시그니처로 이미지 여부 확인, 무작위 파일명으로 저장
- 사진은 공개 경로가 아닌 `/files/:id`에서 게시글 열람 권한 확인 후 제공

## 프로젝트 구조

```
src/
  app.js              서버 진입점, 미들웨어 설정
  db.js               SQLite 스키마 및 관리자 계정 생성
  boards.js           게시판 정의 및 권한 규칙
  passport.js         일반 로그인
  social.js           카카오·네이버·구글 로그인
  uploads.js          사진 업로드 처리
  session-store.js    SQLite 세션 저장소
  middleware/         인증, CSRF, 플래시 메시지
  routes/             home, auth, posts, comments, account, admin
views/                EJS 템플릿
public/css/           스타일
```

## 기술 스택

Node.js 22 · Express 4 · EJS · SQLite(`node:sqlite`) · Passport.js · Multer

## 커밋 컨벤션

```
[타입] 한글로 변경 내용 요약

- 상세 내용
```

| 타입 | 용도 |
| --- | --- |
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 수정 |
| `style` | 코드 포맷, 스타일 (동작 변경 없음) |
| `refactor` | 리팩토링 |
| `test` | 테스트 |
| `chore` | 빌드, 설정, 패키지 |

예: `[feat] 게시판 생성 API`
