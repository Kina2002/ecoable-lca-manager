const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const context = vm.createContext({}); vm.runInContext('window = globalThis;', context);
for (const file of ['constants', 'rules', 'data', 'requests', 'projects', 'report-history', 'report']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), context, { filename: file });
}
const { LCA } = context; const P = LCA.projects;
const profile = () => ({ industry: '배터리·소재', type: 'PCF 산정', drivers: ['Catena-X'], uses: ['PCF', '환경성적표지'] });
const expected = (state) => ({ revision: state.revision, stage: state.stage, basic: P.basicSnapshot(state.project), profileRevision: state.profileRevision, profile: P.profileSnapshot(state.project) });
function setup(stage = 2) {
  const values = new Map(); let fail = false; const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); } };
  const samples = LCA.data.createSampleProjects('2026-10-19'); const project = samples.find((p) => p.stage === 2); let currentStage = stage;
  const store = P.createStore(samples, '2026-10-19', () => storage, () => ({ ok: true, stage: currentStage }));
  return { store, values, samples, project, storage, fail: () => { fail = true; }, stage: (value) => { currentStage = value; } };
}
test('기존 샘플을 쓰기 없이 읽고 추가정보 변경·복원·이력을 보관한다', async () => {
  const s = setup(); const original = JSON.stringify(s.samples); const state = s.store.basic(s.project.id);
  assert.equal(s.values.size, 0);
  const result = await s.store.updateBasic(s.project.id, { ...P.basicSnapshot(state.project), profile: profile(), reason: '요구 문서 확인' }, expected(state));
  assert.equal(result.ok, true, result.error); assert.equal(result.revision, 0); assert.equal(result.profileRevision, 1);
  const loaded = s.store.basic(s.project.id); assert.equal(loaded.project.type, 'PCF 산정'); assert.equal(loaded.profileHistory.length, 1);
  assert.equal(JSON.stringify(s.samples), original);
  assert.equal(P.createStore(s.samples, '2026-10-19', () => s.storage).list().items.find((p) => p.id === s.project.id).uses.length, 2);
});
test('오래된 추가정보·인증 단계·잘못된 선택은 저장하지 않는다', async () => {
  const s = setup(); const state = s.store.basic(s.project.id); const draft = { ...P.basicSnapshot(state.project), profile: profile(), reason: '' };
  assert.equal((await s.store.updateBasic(s.project.id, draft, expected(state))).ok, true);
  const before = s.values.get(P.STORAGE_KEY);
  assert.equal((await s.store.updateBasic(s.project.id, { ...draft, profile: { ...profile(), uses: ['고객사 제출'] } }, expected(state))).ok, false);
  const current = s.store.basic(s.project.id); s.stage(9); const finalStage = s.store.basic(s.project.id);
  assert.equal((await s.store.updateBasic(s.project.id, { ...P.basicSnapshot(current.project), profile: { ...profile(), uses: [] }, reason: '' }, expected(finalStage))).ok, false);
  assert.equal(s.values.get(P.STORAGE_KEY), before);
  s.stage(2);
  const invalid = await s.store.updateBasic(s.project.id, { ...draft, profile: { ...profile(), uses: ['PCF', 'PCF'] } }, expected(current));
  assert.ok(invalid.errors.profile);
  const corrupted = JSON.parse(before); corrupted.profileHistory[s.project.id][0].after.uses.push('PCF');
  const raw = JSON.stringify(corrupted); s.values.set(P.STORAGE_KEY, raw);
  assert.equal(s.store.list().ok, false);
  assert.equal((await s.store.updateBasic(s.project.id, draft, expected(current))).ok, false);
  assert.equal(s.values.get(P.STORAGE_KEY), raw);
});
test('기본정보와 추가정보를 함께 저장해도 실패하면 둘 다 원래 값으로 남는다', async () => {
  const s = setup(1); const created = await s.store.add({ companyName: '신규 회사', productName: '제품', purpose: '고객사 요구 대응', targetDate: '2026-12-01' });
  const state = s.store.basic(created.item.id); const before = s.values.get(P.STORAGE_KEY); s.fail();
  const result = await s.store.updateBasic(created.item.id, { ...P.basicSnapshot(state.project), companyName: '변경 회사', profile: profile(), reason: '기본·추가 동시 수정' }, expected(state));
  assert.equal(result.ok, false); assert.equal(s.values.get(P.STORAGE_KEY), before);
  assert.equal(s.store.basic(created.item.id).project.companyName, '신규 회사'); assert.equal(s.store.basic(created.item.id).profileRevision, 0);
});
test('추가정보 변경은 옛 보고서를 보존하고 새 초안 기준과 본문에 연결한다', async () => {
  LCA.interpretation = { validRecord: () => true };
  const values = new Map(); const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const project = { id: 'p', code: 'LCA-2026-001', companyName: '가상', productName: '제품', purpose: '고객사 요구 대응', type: 'LCA 수행', stage: 7, profileRevision: 0 };
  const report = LCA.report.createStore([project], () => ({ ok: true, ready: true, stale: false, project, record: { revision: 1 } }), () => storage);
  const change = { summary: '초안', reason: '확인', before: '', after: '작성', author: '연구원', reviewRef: '' };
  let state = report.load('p'); const first = await report.save('p', { title: '보고서', note: '', confirmed: true, change }, 0, state.sourceKey);
  assert.equal(first.ok, true, first.error); const firstCopy = JSON.stringify(first.record);
  Object.assign(project, profile(), { profileRevision: 1 }); state = report.load('p');
  assert.equal(state.stale, true); assert.equal(JSON.stringify(state.record), firstCopy);
  const second = await report.save('p', { title: '보고서', note: '', confirmed: true, change: { ...change, before: '기존 정보', after: '추가정보 반영' } }, 1, state.sourceKey);
  assert.equal(second.ok, true, second.error); assert.equal(second.record.source.project.profile.industry, '배터리·소재');
  assert.equal(report.load('p').versions[1].source.project.profile, undefined);
});
