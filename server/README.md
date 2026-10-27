# 계정별 서버 저장 개발 안내

화면은 상위 `web/`, 서버/API는 이 폴더에서 관리합니다. 기존 Python 실행은 로그인 없는 브라우저 체험을 유지합니다.

## 구성

- `app/api/session`: 로그인 여부 조회.
- `app/api/workspace`, `lib/workspace.ts`: 계정 확인, 형식·버전 검사, D1 읽기/저장.
- `db/schema.ts`, `drizzle/`: 데이터베이스 구조와 적용 순서.
- `scripts/sync-web.mjs`: 화면을 `public/`로 복사하고 루트 HTML 생성. 생성물은 직접 수정하지 않습니다.
- `.openai/hosting.json`: 기존 Site ID와 D1 DB 연결. 로그인은 Sites가 관리하며 앱은 비밀번호나 로그인 토큰을 저장하지 않습니다.

## 로컬 개발

Node.js 22.13 이상을 사용합니다. 이 폴더에서 실행합니다.

```powershell
npm run install:ci
node scripts/sync-web.mjs
npm run build
```

로컬에 아직 적용하지 않은 migration만 순서대로 적용합니다. 새 로컬 환경의 첫 파일은 다음과 같습니다.

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cuddly_amphibian.sql
npm run dev -- --port 8792 --hostname 127.0.0.1
```

로컬 로그인은 loopback 개발 환경에서만 Seedy 가상 계정을 사용합니다. 실제 배포의 ChatGPT 로그인과 다릅니다. 개발 DB·브라우저 임시 사본·공개 배포 DB는 별개입니다. 환경 파일·실제 기록·생성물을 커밋하지 않습니다.

화면 코드를 바꾸면 `node scripts/sync-web.mjs`로 반영합니다. 배포는 기존 Sites 소스에 화면과 서버를 함께 반영한 뒤 빌드·버전 저장·배포 순서로 진행합니다. GitHub push만으로 공개 사이트가 바뀌지는 않습니다.

동작과 확인 범위는 [WEB-071 SPEC](../docs/04-webapp-spec/WEB-071-account-server-storage.md)을 참고하세요.
