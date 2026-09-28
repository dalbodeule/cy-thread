# mori.space 프로젝트 현황

> 기준: 2026-09-28 현재 저장소 코드와 설정. 이 문서는 구현된 동작, 운영에 필요한 설정, 아직 남은 작업을 한곳에 정리한다. 외부 서비스의 실제 설정 상태와 배포 상태는 코드만으로 증명할 수 없으므로 별도로 확인해야 한다.

## 1. 서비스 구조

`mori.space`는 관심사별 커뮤니티 서비스다. 구조는 **Forum → Category(게시글 모음) → Thread(게시글) → Post(본문·댓글)** 순서다. 홈은 전체 Forum과 활동을 보여주고, Forum별 페이지에서 카테고리를 고르거나 게시글을 읽고 작성한다.

| 영역      | 현재 구성                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------- |
| 웹        | Nuxt 4, Vue 3, Tailwind CSS 및 공통 스타일. 웹 페이지와 서버 API가 한 Worker에서 동작한다.                |
| 실행      | Cloudflare Workers, Nitro `cloudflare_module` 프리셋. 운영 도메인은 `community.mori.space`로 설정돼 있다. |
| 데이터    | Cloudflare D1(SQLite) + Drizzle ORM. 스키마와 SQL 마이그레이션은 `server/db/`에 있다.                     |
| 파일      | Cloudflare R2 `community` 버킷. 게시글 이미지와 업로드 프로필 사진을 저장한다.                            |
| 로그인    | Google OAuth, CHZZK OAuth, `nuxt-auth-utils` 세션 쿠키.                                                   |
| 메일      | Cloudflare Email Sending `EMAIL` 바인딩, 기본 발신 주소 `webmaster@mori.space`.                           |
| 예약 작업 | 매시 정각 인기 카테고리 갱신, 매분 발송 대기 메일 처리.                                                   |

주요 설정은 [`nuxt.config.ts`](nuxt.config.ts), [`wrangler.toml`](wrangler.toml), [`package.json`](package.json)을 참고한다. Neon의 기존 데이터는 D1로 이전하지 않는 개발 단계 방침이다.

## 2. 사용자 기능과 화면

| 기능        | 화면·동작                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 홈·탐색     | `/`에서 공개 Forum, 최근 게시글, 인기 카테고리를 본다. `/explore`에서 카테고리와 Forum을 탐색한다.                                                             |
| Forum       | `/forums/<slug>/threads`에서 Forum 소개, 카테고리, 검색·정렬·페이지네이션, 팔로우, 게시글 목록을 본다.                                                         |
| 게시글·댓글 | 게시글 작성·수정·삭제, 2단계 댓글, 북마크, 신고를 지원한다. 본문은 Toast UI 편집기를 사용한다. 삭제는 데이터베이스의 소프트 삭제다.                            |
| Forum 개설  | `/forums/request`에서 신청한다. 전체 관리자가 승인해야 Forum과 기본 카테고리가 생성된다.                                                                       |
| 프로필      | `/account/profile`에서 이름과 사진을 관리한다. 최초 로그인 공급자의 사진, 직접 업로드한 사진, Gravatar 중 선택할 수 있다. Gravatar는 확인된 이메일이 필요하다. |
| 이메일 확인 | CHZZK가 이메일을 제공하지 않으므로 `/account/email`에서 연락 주소를 입력하고 메일 링크로 확인한다. Google의 로그인 이메일과 별도로 저장된다.                   |
| 에러 화면   | [`app/error.vue`](app/error.vue)가 400, 401, 404, 500 상태별 안내와 이동·재시도 동작을 제공한다. API는 기존 오류 응답을 유지한다.                              |

공통 헤더·계정 메뉴·바닥글은 `app/components/SiteTopbar.vue`, `HeaderAccountActions.vue`, `SiteFooter.vue`와 [`app/app.vue`](app/app.vue)에서 구성한다. Forum은 별도 브랜드와 사각형 아이콘·색상 설정을 헤더에 반영한다. White/Dark/System 테마가 있으며 Forum 관리자가 해당 Forum의 다크 모드를 끌 수 있다.

## 3. 권한과 관리자 기능

| 역할                         | 가능한 작업                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 방문자                       | 공개 Forum과 게시글 읽기.                                                                                                 |
| 로그인 사용자                | 게시글·댓글 작성, 팔로우, 북마크, 신고, Forum 개설 신청, 본인 프로필 관리.                                                |
| Forum 운영진(`mod`)          | 신고 처리, 게시글 잠금·고정 등 운영 작업과 회원 제재.                                                                     |
| Forum 관리자(`admin`)·소유자 | 운영진 권한에 더해 카테고리, Forum 설정, Forum 대상 메일을 관리한다. 소유자는 관리자 임명 권한을 가진다.                  |
| 전체 관리자                  | Forum 개설 신청 승인·거절, 전체 사용자·Forum 관리, 전체·Forum·선택 사용자 대상 메일을 관리한다. Forum 운영 권한도 갖는다. |

- 전체 관리자 화면: `/admin`, `/admin/forum-requests`, `/admin/users`, `/admin/mail`. 헤더의 **관리도구** 버튼으로 들어간다.
- 사용자 목록은 이름·이메일·작성글·댓글을 검색하고 페이지네이션한다. 사용자 상세에서 최근 활동과 제재 기록을 본다. 정지는 30분, 1시간, 6시간, 1일, 7일, 1개월, 영구 중 선택하고 해제할 수 있다. 정지 중에는 인증된 쓰기 요청이 제한된다.
- Forum 관리 화면: `/forums/<slug>/admin`, 하위 `categories`, `settings`, `users`, `mail`; 신고 검토는 `/forums/<slug>/reports`다.
- 카테고리를 삭제할 때 글이 남아 있다면 같은 Forum의 다른 카테고리를 지정해야 하며, 기존 글을 일괄 이동한다.
- 화면의 버튼 노출과 별개로 서버의 `requireGlobalAdmin`·`requireForumModerator` 및 각 API가 권한을 검사한다. 세부 권한은 [`server/utils/requireForumModerator.ts`](server/utils/requireForumModerator.ts)와 `server/api/admin/`, `server/api/forums/[slug]/moderation/`에 있다.

## 4. 게시글 검색과 파일

- 게시글은 D1에 저장하며 제목·본문 검색, 카테고리·고정·잠금 필터, 정렬 및 페이지네이션을 제공한다. FTS5 관련 SQL은 [`0006_post_search_fts.sql`](server/db/migrations/0006_post_search_fts.sql)에 있다.
- 본문 이미지 업로드는 JPEG/PNG/GIF/WebP, 최대 5 MB다. 서버가 파일 서명을 확인하고 R2에 저장한 뒤 D1 `attachments` 행을 만든다. 게시글에 연결되기 전 이미지는 업로더에게만 보이고, 연결된 이미지는 공개 게시글의 가시성 검사를 통과해야 제공된다.
- Forum 운영진은 **24시간이 지난 미사용 업로드**를 수동으로 정리할 수 있다. 게시글에서 이미지를 제거했을 때의 참조 재계산, 게시글 삭제 후 보관 기간에 따른 자동 삭제, 정리 실패 재시도는 아직 구현되지 않았다. R2 전체 경로에 단순 만료 규칙을 걸면 게시 중인 파일까지 삭제될 수 있으므로 주의한다.
- 프로필 업로드는 JPEG/PNG/WebP, 최대 2 MB다. 새 사진으로 전환한 뒤 이전 R2 파일 삭제를 시도하지만, 실패한 삭제를 정기 재시도하는 작업은 없다. 공급자 사진과 Gravatar는 외부 URL이며 이 서비스의 R2 파일이 아니다.

관련 코드: [`attachments.post.ts`](server/api/forums/%5Bslug%5D/attachments.post.ts), [`cleanup.post.ts`](server/api/forums/%5Bslug%5D/moderation/attachments/cleanup.post.ts), [`avatar.post.ts`](server/api/account/avatar.post.ts).

## 5. 운영 메일

전체 관리자는 `/admin/mail`에서 전체 사용자, 특정 Forum 참여자 또는 선택한 사용자에게 메일을 예약할 수 있다. Forum 소유자·관리자는 자신의 Forum 참여자에게만 보낼 수 있다. 작성 화면에는 안내 양식, 수신 대상, 미리보기와 미완성 `{{...}}` 항목 검사 기능이 있다. 실제 발송 전 확인 단계를 거친다.

서버는 메일을 D1 대기열에 넣고, 매분 예약 작업에서 대상자를 펼친 다음 Cloudflare Email Sending으로 발송한다. HTML과 일반 텍스트 본문을 함께 생성한다. 제재 안내와 CHZZK 연락 이메일 확인 메일도 같은 발송 경로를 쓴다. 단체 메일에는 수신 거부 링크가 붙고 수신 설정 및 확인된 주소를 고려한다. 기본 발신자는 `wrangler.toml`의 `MAIL_FROM_ADDRESS`로 바꿀 수 있다.

관련 코드: [`MailComposer.vue`](app/components/MailComposer.vue), [`createMailCampaign.ts`](server/utils/createMailCampaign.ts), [`renderMail.ts`](server/utils/renderMail.ts), [`server/plugins/mail.ts`](server/plugins/mail.ts).

## 6. 보안과 데이터 보호

- Google/CHZZK OAuth 토큰은 영구 저장하지 않는다. 세션은 서명·암호화된 HTTP 전용 쿠키를 사용한다. CHZZK 연락 이메일은 확인 전까지 로그인 식별자나 Google 계정 연결 근거가 아니다.
- Turnstile은 게시글, 댓글, 신고, 게시글 본문 이미지 업로드 등의 쓰기 흐름에서 검증한다. 프로필 사진 업로드에는 Turnstile 검증이 없다. Worker Rate Limiting 바인딩은 읽기·쓰기·이미지 업로드·신고·운영 작업 등을 분리한다. 제한 값은 [`wrangler.toml`](wrangler.toml), 요청 분류는 [`server/middleware/security.ts`](server/middleware/security.ts)에 있다.
- 백업용 별도 Worker·Workflow 코드는 [`backup/`](backup/)에 있다. 설정된 일정은 매일 한국 시간 02:00(UTC 17:00)이며 D1 내보내기와 R2 스냅샷을 대상으로 한다. **저장소에 코드가 있다는 사실만으로 백업 Worker 배포·정상 실행·복구 가능성이 확인되지는 않는다.** 배포 후 첫 실행의 `manifest.json`과 실제 복구 연습을 별도로 확인해야 한다.
- Cloudflare Workers Logs 및 429·5xx 관측 코드가 구성돼 있다. 로그 설정과 보관 기간은 실제 계정 설정에서 확인한다.
- 공개 Forum과 게시글 주소는 동적 사이트맵에 포함한다. 계정·관리 화면은 `robots` 설정으로 검색 노출을 제한한다. 관련 설정은 [`nuxt.config.ts`](nuxt.config.ts)와 [`urls.get.ts`](server/api/__sitemap__/urls.get.ts)에 있다.

## 7. 개발·배포 요약

```sh
npm install
npm run db:migrate:local
npm run dev:worker
```

`npm run dev`는 일반 Nuxt 개발 서버다. D1·R2 등 Worker 바인딩이 필요한 흐름은 `npm run dev:worker`를 사용한다. 로컬 미리보기 데이터가 필요하면 `npm run db:seed:local`을 실행한다.

운영 배포 순서는 **마이그레이션 확인 → 빌드 → Worker 배포**다.

```sh
npm run db:migrate:remote
npm run build
npx wrangler deploy .output/server/index.mjs --assets .output/public
```

필요한 비밀 값은 `NUXT_SESSION_PASSWORD`, `NUXT_TURNSTILE_SECRET_KEY`, 사용 중인 OAuth 공급자의 `NUXT_OAUTH_GOOGLE_CLIENT_ID`·`NUXT_OAUTH_GOOGLE_CLIENT_SECRET` 및 `NUXT_OAUTH_CHZZK_CLIENT_ID`·`NUXT_OAUTH_CHZZK_CLIENT_SECRET`이다. 공개 Turnstile 키는 `NUXT_PUBLIC_TURNSTILE_SITE_KEY`다. 값은 저장소에 쓰지 않고 Worker secret/variable 또는 로컬 `.dev.vars`에 둔다. OAuth 공급자에도 운영 콜백 주소를 정확히 등록해야 한다. Wrangler 로그인 상태라면 일반 배포·D1 마이그레이션에 별도 API 토큰은 필요하지 않다. 백업 Worker의 D1 REST API 호출은 별도 토큰이 필요하다.

첫 전체 관리자는 신뢰할 수 있는 계정으로 로그인한 뒤 D1의 `users.is_global_admin`을 운영자가 직접 설정해야 한다. 그 이후 Forum 개설 승인과 전체 관리자 기능은 해당 계정에서 처리한다. 백업 Workflow는 별도 배포가 필요하며, 코드상 스냅샷 보관 기간은 31일이다. 배포·복구 절차의 상세 명령은 [`README.md`](README.md)의 **Backups and recovery** 및 **Cloudflare setup** 절을 따른다.

## 8. 아직 확인하거나 결정할 사항

1. **이미지 수명 관리:** 미사용 게시글 이미지의 자동 정리, 편집·삭제 뒤 참조 추적 및 보관 기간, R2 삭제 실패 재시도를 구현할지 결정해야 한다. 현재 가능한 정리는 Forum 운영진의 수동 작업이다.
2. **백업 운영 검증:** 백업 Worker가 실제 배포돼 있는지, 예정된 작업이 성공하는지, 스냅샷에서 복구되는지 확인해야 한다.
3. **비공개 정책:** `forums.visibility`에는 `followers`·`admins` 값이 정의돼 있지만, 이 모드의 완전한 읽기·쓰기 접근 정책은 후속 작업으로 남아 있다. 현재 사용자 흐름은 공개 Forum 중심이다.
4. **메일·OAuth 외부 설정:** 코드와 Worker 바인딩 외에 발송 도메인, OAuth 앱 권한·콜백, 비밀 값이 운영 계정에 맞게 설정됐는지 별도 확인해야 한다.

자세한 배경과 이전 설계 판단은 [`README.md`](README.md), 개별 동작의 최종 근거는 해당 API와 화면 코드를 확인한다.
