import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const rootWeb = new URL('web/', root);
const web = existsSync(rootWeb) ? rootWeb : new URL('../../web/', import.meta.url);
mkdirSync(new URL('public/', root), { recursive: true });
cpSync(web, new URL('public/', root), { recursive: true, filter: (source) => !source.includes(`${fileURLToPath(web)}tests`) });
const html = readFileSync(new URL('index.html', web), 'utf8');
writeFileSync(new URL('app/lca-html.ts', root), `// web/index.html에서 생성. scripts/sync-web.mjs로 갱신.\nexport const html = ${JSON.stringify(html)};\n`);
