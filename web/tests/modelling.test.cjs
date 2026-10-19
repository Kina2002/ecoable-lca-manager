const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'data.js', 'received-data.js', 'review.js', 'requests.js', 'scope.js', 'modelling.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
}
const { modelling: M, requests: R, scope: S } = context.LCA;
const today = '2026-10-17';
const receipt = { kind: 'quantity', value: '12000', unit: 'kWh', density: '', description: '', periodStart: '2025-01-01', periodEnd: '2025-12-31', evidenceFileName: '가상자료.xlsx' };
const draft = (changes = {}) => ({ tool: '가상 도구 1.0', database: '가상 DB 1.0', method: '가상 평가 방법 v1', allocation: '가상 단일 제품 · 할당 없음', resultFileName: '가상결과.xlsx', note: '', calculatedOn: today, scopeConfirmed: true,
  indicators: [{ indicator: '가상 지구온난화', value: '1.2300', unit: 'kgCO₂e' }, { indicator: '가상 음수 결과', value: '-1.2e-3', unit: '가상 단위' }], ...changes });
function setup() {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const projects = context.LCA.data.createSampleProjects(today);
  const requests = R.createStore(projects.map((p) => p.id), () => storage);
  const scope = S.createStore(projects, () => storage, null, (id) => requests.list(id));
  const store = M.createStore(projects, () => storage, (id) => requests.list(id), (id) => {
    const result = scope.load();
    return result.ok ? { ok: true, project: projects.find((p) => p.id === id) } : result;
  });
  return { values, storage, projects, requests, scope, store, project: projects[0] };
}
function add(s, categoryKey = 'energy', id = s.project.id, detail = '가상 자료') {
  return s.requests.add(id, { categoryKey, detail, dueDate: '2026-10-24' }).item;
}
function approve(s, item, r = receipt) {
  s.requests.recordReceipt(item.projectId, item.id, r);
  const started = s.requests.startReview(item.projectId, item.id);
  assert.equal(s.requests.saveReview(item.projectId, item.id, { checks: { period: true, scope: true, complete: true }, note: '가상 확인' }, 'approve', started.item.review).ok, true);
}
function ready(s) {
  const item = add(s); approve(s, item);
  s.scope.finishCollection(s.project.id, S.snapshot(s.project));
  s.scope.finishReview(s.project.id, S.snapshot(s.project));
  return item;
}

test('승인 자료와 해당 없음 사유를 계산 근거에 보관하고 다시 읽는다', () => {
  const s = setup();
  const approved = add(s); approve(s, approved);
  const excluded = add(s, 'packaging');
  assert.equal(s.requests.markNotApplicable(s.project.id, excluded.id, '해당 공정이 없음').ok, true);
  assert.equal(s.scope.finishCollection(s.project.id, S.snapshot(s.project)).ok, true);
  assert.equal(s.scope.finishReview(s.project.id, S.snapshot(s.project)).ok, true);
  const current = s.store.load(s.project.id);
  assert.equal(current.ok, true);
  assert.equal(current.source.ready, true);
  const saved = s.store.save(s.project.id, draft(), 0, current.source.signature);
  assert.equal(saved.ok, true);
  assert.equal(saved.record.source.requests.find((item) => item.id === excluded.id).notApplicable.reason, '해당 공정이 없음');
  const restored = M.createStore(s.projects, () => s.storage, (id) => s.requests.list(id), (id) => ({ ok: true, project: s.projects.find((p) => p.id === id) }));
  assert.equal(restored.load(s.project.id).ok, true);
  assert.equal(restored.load(s.project.id).stale, false);
  assert.equal(restored.csv(s.project.id).count, 1);
});
function save(s, value = draft(), loaded = s.store.load(s.project.id)) {
  return s.store.save(s.project.id, value, loaded.record?.revision || 0, loaded.source?.signature || '');
}
test('평가 방법 계획 변경은 기존 계산 사본을 유지하며 재확인이 필요해진다', () => {
  const s = setup(); ready(s); s.project.information = { cutoff:'1% 검토', allocation:'질량', backgroundDatabase:'가상 DB' };
  const result = save(s); assert.equal(result.ok,true,result.error); const copy = JSON.stringify(result.record);
  assert.equal(s.store.load(s.project.id).stale,false);
  s.project.information.cutoff='전체 포함'; assert.equal(s.store.load(s.project.id).stale,true);
  assert.equal(JSON.stringify(s.store.load(s.project.id).record),copy);
});

test('CSV는 현재 프로젝트의 미삭제 승인 자료만 내보내고 수치·밀도·문서를 원래대로 보존한다', () => {
  const s = setup(), energy = add(s), water = add(s, 'water'), document = add(s, 'general');
  approve(s, energy);
  approve(s, water, { ...receipt, value: '2', unit: 'L', density: '900' });
  approve(s, document, { ...receipt, kind: 'document', value: '', unit: '', density: '', description: '가상 사업장 설명' });
  add(s, 'transport');
  const deleted = add(s, 'packaging'); approve(s, deleted); s.requests.remove(s.project.id, deleted.id);
  const other = add(s, 'energy', s.projects[2].id); approve(s, other);
  const before = s.values.get(R.STORAGE_KEY);
  const result = s.store.csv(s.project.id);
  assert.equal(result.ok, true);
  assert.equal(result.count, 3);
  assert.equal(result.excluded, 1);
  assert.ok(result.csv.startsWith('\uFEFF'));
  assert.ok(result.csv.includes('"12000","kWh"'));
  assert.ok(result.csv.includes('"2","L","900"'));
  assert.ok(result.csv.includes('가상 사업장 설명'));
  assert.ok(!result.csv.includes(other.id));
  assert.ok(!result.csv.includes(deleted.id));
  assert.equal(s.values.get(R.STORAGE_KEY), before);
  assert.equal(s.values.has(M.STORAGE_KEY), false);
});

test('CSV는 쉼표·줄바꿈·따옴표를 이스케이프하고 수식으로 해석될 텍스트를 보호한다', () => {
  const s = setup(), item = add(s, 'energy', s.project.id, '=SUM(1,2)\n"가상 설명"');
  approve(s, item);
  const csv = s.store.csv(s.project.id).csv;
  assert.ok(csv.includes('"\'=SUM(1,2)\n""가상 설명"""'));
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(s.store.csv(s.projects[4].id).ok, false);
});

test('외부 결과의 음수·0·소수·지수와 유효 자릿수를 보존하고 잘못된 숫자·중복 지표를 막는다', () => {
  for (const value of ['-0.001', '0', '1.2300', '1.2e-3', '-2E+4']) assert.equal(M.numeric(value), true);
  for (const value of ['', 'NaN', 'Infinity', '1e999', '1,200', '1+2']) assert.equal(M.numeric(value), false);
  assert.equal(Object.keys(M.validate(draft())).length, 0);
  assert.ok(M.validate(draft({ scopeConfirmed: false })).scopeConfirmed);
  assert.ok(M.validate(draft({ calculatedOn: '2026-02-30' })).calculatedOn);
  assert.ok(M.validate(draft({ resultFileName: 'C:\\결과.xlsx' })).resultFileName);
  assert.ok(M.validate(draft({ indicators: [] })).indicators);
  assert.ok(M.validate(draft({ indicators: Array.from({ length: 21 }, (_, i) => ({ indicator: String(i), value: '1', unit: 'u' })) })).indicators);
  assert.ok(M.validate(draft({ indicators: [{ indicator: 'GWP', value: '1', unit: 'u' }, { indicator: ' gwp ', value: '2', unit: 'u' }] })).indicators);
});

test('계산 이전 단계·요청 0건·미승인 자료는 결과 저장을 허용하지 않는다', () => {
  const s = setup(), item = add(s); approve(s, item);
  assert.equal(save(s).ok, false);
  s.scope.finishCollection(s.project.id, S.snapshot(s.project));
  assert.equal(save(s).ok, false);
  s.scope.finishReview(s.project.id, S.snapshot(s.project));
  const pending = add(s, 'water');
  assert.equal(save(s).ok, false);
  s.requests.remove(s.project.id, pending.id);
  s.requests.remove(s.project.id, item.id);
  assert.equal(save(s).ok, false);
  assert.equal(s.values.has(M.STORAGE_KEY), false);
});

test('결과·도구·근거와 당시 승인 자료를 저장하고 새 저장 객체에서 정확히 복원한다', () => {
  const s = setup(); ready(s);
  const requestBefore = s.values.get(R.STORAGE_KEY), scopeBefore = s.values.get(S.STORAGE_KEY);
  const result = save(s);
  assert.equal(result.ok, true);
  const restored = M.createStore(s.projects, () => s.storage, (id) => s.requests.list(id)).load(s.project.id);
  assert.equal(restored.ok, true);
  assert.equal(restored.stale, false);
  assert.equal(restored.record.indicators[0].value, '1.2300');
  assert.equal(restored.record.indicators[1].value, '-1.2e-3');
  assert.equal(restored.record.source.project.functionalUnit.unit, 'kg');
  assert.equal(restored.record.source.requests.length, 1);
  assert.equal(restored.record.tool, draft().tool);
  assert.equal(s.values.get(R.STORAGE_KEY), requestBefore);
  assert.equal(s.values.get(S.STORAGE_KEY), scopeBefore);
});

test('다른 프로젝트 결과를 보존하고 버전으로 동시 편집 덮어쓰기를 막는다', () => {
  const s = setup(); ready(s);
  save(s);
  const old = s.store.load(s.project.id);
  const other = s.projects[3], item = add(s, 'energy', other.id); approve(s, item);
  const loaded = s.store.load(other.id);
  assert.equal(s.store.save(other.id, draft({ tool: '다른 도구' }), 0, loaded.source.signature).ok, true);
  assert.equal(save(s, draft({ note: '새 메모' }), old).ok, true);
  const saved = s.values.get(M.STORAGE_KEY);
  assert.equal(save(s, draft({ note: '낡은 화면' }), old).ok, false);
  assert.equal(s.values.get(M.STORAGE_KEY), saved);
  assert.equal(s.store.load(other.id).record.tool, '다른 도구');
  assert.equal(s.store.load(s.project.id).record.revision, 2);
  assert.equal(s.store.load(s.project.id).record.createdAt, old.record.createdAt);
});

test('자료 재기록·승인 갱신 뒤 과거 결과를 표시하고 새 근거 확인 전 덮어쓰지 않는다', () => {
  const s = setup(), item = ready(s);
  save(s);
  const old = s.store.load(s.project.id), original = s.values.get(M.STORAGE_KEY);
  s.requests.recordReceipt(s.project.id, item.id, { ...receipt, value: '13000' });
  assert.equal(s.store.load(s.project.id).stale, true);
  assert.equal(save(s, draft(), old).ok, false);
  approve(s, item, { ...receipt, value: '13000' });
  assert.equal(save(s, draft(), old).ok, false);
  assert.equal(s.values.get(M.STORAGE_KEY), original);
  const current = s.store.load(s.project.id);
  assert.equal(save(s, draft({ note: '재계산 확인' }), current).ok, true);
  assert.equal(s.store.load(s.project.id).stale, false);
  assert.equal(s.store.load(s.project.id).record.source.requests[0].receipt.value, '13000');
});

test('새 요청·삭제·범위 변경은 결과 기준 변경이며 단계만의 이동은 기준을 바꾸지 않는다', () => {
  const s = setup(); ready(s); save(s);
  const extra = add(s, 'water');
  assert.equal(s.store.load(s.project.id).stale, true);
  s.requests.remove(s.project.id, extra.id);
  assert.equal(s.store.load(s.project.id).stale, false);
  const direct = M.createStore(s.projects, () => s.storage, (id) => s.requests.list(id));
  s.project.stage = 6;
  assert.equal(direct.load(s.project.id).stale, false);
  s.project.functionalUnit = { qty: '2', unit: 'kg' };
  assert.equal(direct.load(s.project.id).stale, true);
});

test('저장 실패·손상된 결과·요청·범위 저장본은 기존 기록을 보존한다', () => {
  const s = setup(); ready(s); save(s);
  const loaded = s.store.load(s.project.id), original = s.values.get(M.STORAGE_KEY);
  s.storage.setItem = () => { throw Error('full'); };
  assert.equal(save(s, draft({ note: '저장 실패' }), loaded).ok, false);
  assert.equal(s.values.get(M.STORAGE_KEY), original);
  for (const corrupted of ['{', JSON.stringify({ version: 2, records: {} }), JSON.stringify({ version: 1, records: { unknown: {} } })]) {
    s.values.set(M.STORAGE_KEY, corrupted);
    assert.equal(s.store.load(s.project.id).ok, false);
    assert.equal(save(s, draft(), loaded).ok, false);
    assert.equal(s.values.get(M.STORAGE_KEY), corrupted);
  }
  s.values.set(M.STORAGE_KEY, original);
  s.values.set(R.STORAGE_KEY, '{');
  assert.equal(s.store.load(s.project.id).ok, false);
  assert.equal(s.store.csv(s.project.id).ok, false);
  s.values.set(S.STORAGE_KEY, '{');
  assert.equal(s.store.load(s.project.id).ok, false);
  assert.equal(s.values.get(M.STORAGE_KEY), original);
});

test('저장된 기준량·승인 스냅샷·지표의 손상을 정상 결과로 숨기지 않는다', () => {
  const s = setup(); ready(s); save(s);
  const original = s.values.get(M.STORAGE_KEY);
  for (const change of [
    (r) => r.source.project.functionalUnit.qty = '',
    (r) => r.source.requests[0].status = '제출됨',
    (r) => r.source.requests[0].review.checks.period = false,
    (r) => r.indicators[0].value = 'NaN',
    (r) => r.revision = 0
  ]) {
    const data = JSON.parse(original); change(data.records[s.project.id]);
    const corrupted = JSON.stringify(data); s.values.set(M.STORAGE_KEY, corrupted);
    assert.equal(s.store.load(s.project.id).ok, false);
    assert.equal(s.values.get(M.STORAGE_KEY), corrupted);
  }
});
