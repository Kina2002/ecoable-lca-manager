const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const context = vm.createContext({}); vm.runInContext('window = globalThis;', context);
for (const name of ['constants','rules','received-data','review','requests']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',`${name}.js`),'utf8'),context);
const { LCA } = context;
function setup() { let raw = null; let fail = false; const storage = { getItem: () => raw, setItem: (_, v) => { if (fail) throw Error(); raw = v; } }; const store = LCA.requests.createStore(['p'], () => storage); return { store, storage, raw: () => raw, fail: () => { fail = true; } }; }
test('기본 문장은 쓰기 없이 읽으며 사용자 문장을 재사용하고 기존 자료는 유지한다', async () => {
  const s = setup(); const base = s.store.templates(); assert.equal(s.raw(), null);
  s.store.add('p', { categoryKey: 'energy', detail: '기존 전력 요청', dueDate: '2026-10-25' });
  const before = JSON.stringify(s.store.listAll().items);
  assert.equal((await s.store.saveTemplate('energy', '  연간 사용량과 고지서를 주세요.  ', base.revision)).ok, true);
  const reload = LCA.requests.createStore(['p'], () => s.storage); assert.equal(reload.templates().values.energy, '연간 사용량과 고지서를 주세요.');
  assert.equal(JSON.stringify(reload.listAll().items), before);
  assert.equal((await reload.saveTemplate('energy', null, 1)).ok, true); assert.equal(reload.templates().values.energy, base.values.energy);
  assert.equal(JSON.stringify(reload.listAll().items), before);
});
test('다른 창·빈 문장·잘못된 구분·저장 실패는 저장본을 덮어쓰지 않는다', async () => {
  const s = setup(); await s.store.saveTemplate('energy', '전력', 0); const before = s.raw();
  for (const [key,value,revision] of [['energy','다른 문장',0],['unknown','문장',1],['energy',' ',1],['energy','가'.repeat(1001),1]]) assert.equal((await s.store.saveTemplate(key,value,revision)).ok,false);
  s.fail(); assert.equal((await s.store.saveTemplate('energy','변경',1)).ok,false); assert.equal(s.raw(),before);
});
