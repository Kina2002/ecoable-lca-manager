const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'data.js', 'received-data.js', 'review.js', 'requests.js', 'projects.js', 'scope.js', 'request-filter.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
}
const P = context.LCA.projects;
const sample = () => context.LCA.data.createSampleProjects('2026-10-16');
const draft = (changes = {}) => ({ companyName: ' 푸른소재 ', productName: ' 재생 플라스틱 칩 ', purpose: '고객사 요구 대응', targetDate: '2026-12-15', ...changes });
function memory() {
  const values = new Map();
  let writes = 0;
  return { getItem: (key) => values.get(key) ?? null, setItem(key, value) { values.set(key, value); writes++; }, values, get writes() { return writes; } };
}
function setup() {
  const storage = memory();
  const samples = sample();
  return { storage, samples, store: P.createStore(samples, '2026-10-16', () => storage) };
}

test('기존 7개 샘플을 쓰기 없이 읽고 원본을 수정하지 않는다', () => {
  const { samples, storage, store } = setup();
  const before = JSON.stringify(samples);
  const result = store.list();
  assert.equal(result.ok, true);
  assert.equal(result.items.length, 7);
  result.items[0].companyName = '화면에서 바꾼 값';
  assert.equal(JSON.stringify(samples), before);
  assert.equal(storage.writes, 0);
});

test('기본 정보를 정리하고 계약·범위 미정과 샘플 다음 번호로 등록한다', () => {
  const { store } = setup();
  const result = store.add(draft());
  assert.equal(result.ok, true);
  assert.equal(result.items.length, 8);
  assert.equal(result.item.code, 'LCA-2026-008');
  assert.equal(result.item.companyName, '푸른소재');
  assert.equal(result.item.productName, '재생 플라스틱 칩');
  assert.equal(result.item.stage, 1);
  assert.equal(result.item.scopeStatus, '미정');
  assert.equal(result.item.boundary, '');
  assert.equal(result.item.functionalUnit.qty, '');
  assert.equal(result.item.standards.length, 0);
  assert.equal(result.item.isFictional, true);
  assert.equal(result.item.origin, 'user');
});

test('다시 연 저장소에서 ID·번호·직접 입력한 목표일을 복원한다', () => {
  const { store, storage } = setup();
  const first = store.add(draft()).item;
  const next = P.createStore(sample(), '2026-10-17', () => storage).list();
  assert.equal(next.ok, true);
  assert.equal(next.items[7].id, first.id);
  assert.equal(next.items[7].code, first.code);
  assert.equal(next.items[7].targetDate, '2026-12-15');
});

test('같은 회사·제품도 별도 업무로 등록하며 최신 번호를 이어 쓴다', () => {
  const { storage, store } = setup();
  const other = P.createStore(sample(), '2026-10-16', () => storage);
  const one = store.add(draft()), two = other.add(draft()), three = store.add(draft());
  assert.equal(two.item.code, 'LCA-2026-009');
  assert.equal(three.item.code, 'LCA-2026-010');
  assert.equal(new Set([one.item.id, two.item.id, three.item.id]).size, 3);
  assert.equal(store.list().items.length, 10);
});

test('필수·길이·알 수 없는 목적·잘못된 날짜는 쓰지 않는다', () => {
  for (const change of [{ companyName: ' ' }, { productName: '' }, { companyName: '가'.repeat(101) }, { productName: '나'.repeat(101) }, { purpose: '' }, { purpose: '없는 목적' }, { targetDate: '2026-02-29' }, { targetDate: '02026-10-16' }]) {
    const { storage, store } = setup();
    const result = store.add(draft(change));
    assert.equal(result.ok, false);
    assert.equal(Object.keys(result.errors).length > 0, true);
    assert.equal(storage.writes, 0);
  }
});

test('100자 경계·모든 목적·윤년·과거 목표일을 허용한다', () => {
  const { store } = setup();
  for (const purpose of P.PURPOSES) {
    assert.equal(store.add(draft({ companyName: '가'.repeat(100), productName: '나'.repeat(100), purpose, targetDate: '2024-02-29' })).ok, true);
  }
});

test('저장 실패는 등록·일련번호를 바꾸지 않고 재시도는 같은 다음 번호를 쓴다', () => {
  const { store, storage } = setup();
  store.add(draft());
  const before = storage.getItem(P.STORAGE_KEY);
  const setItem = storage.setItem.bind(storage);
  storage.setItem = () => { throw Error('quota'); };
  assert.equal(store.add(draft()).ok, false);
  assert.equal(storage.getItem(P.STORAGE_KEY), before);
  storage.setItem = setItem;
  assert.equal(store.add(draft()).item.code, 'LCA-2026-009');
});

test('손상·미지원 저장본은 샘플 성공으로 감추거나 덮어쓰지 않는다', () => {
  for (const raw of ['{', 'null', '{"version":2,"nextNumber":8,"projects":[]}', '{"version":1,"nextNumber":1,"projects":[]}']) {
    const { store, storage } = setup();
    storage.values.set(P.STORAGE_KEY, raw);
    assert.equal(store.list().ok, false);
    assert.equal(store.add(draft()).ok, false);
    assert.equal(storage.getItem(P.STORAGE_KEY), raw);
    assert.equal(storage.writes, 0);
  }
});

test('저장된 번호·ID·중복·필수 정보 손상을 거절한다', () => {
  for (const mutate of [
    (data) => data.projects[0].id = 'project-001',
    (data) => data.projects[0].code = 'LCA-2026-001',
    (data) => data.projects.push(data.projects[0]),
    (data) => data.projects[0].purpose = '없는 목적',
    (data) => data.nextNumber = data.projects[0].number
  ]) {
    const { store, storage } = setup(); store.add(draft());
    const data = JSON.parse(storage.getItem(P.STORAGE_KEY));
    mutate(data); storage.values.set(P.STORAGE_KEY, JSON.stringify(data));
    const before = storage.getItem(P.STORAGE_KEY);
    assert.equal(store.add(draft()).ok, false);
    assert.equal(storage.getItem(P.STORAGE_KEY), before);
  }
});

test('저장소 접근 거절과 잘못된 기준일은 등록 실패로 알린다', () => {
  const blocked = P.createStore(sample(), '2026-10-16', () => { throw Error('blocked'); });
  assert.equal(blocked.list().ok, false);
  assert.equal(blocked.add(draft()).ok, false);
  const storage = memory();
  assert.equal(P.createStore(sample(), '틀린 날짜', () => storage).add(draft()).ok, false);
  assert.equal(storage.writes, 0);
});

test('등록한 프로젝트의 범위·자료 요청을 별도 저장소에 연결하고 복원한다', () => {
  const { store, storage } = setup();
  const registered = store.add(draft());
  const projects = registered.items, p = projects[7];
  const scope = context.LCA.scope.createStore(projects, () => storage);
  const scopeDraft = { ...context.LCA.scope.snapshot(p), scopeStatus: '협의 중', scopeMemo: '범위 확인 중' };
  assert.equal(scope.save(p.id, scopeDraft, context.LCA.scope.snapshot(p)).ok, true);
  const requests = context.LCA.requests.createStore(projects.map((project) => project.id), () => storage);
  assert.equal(requests.add(p.id, { categoryKey: 'energy', detail: '전력 사용량', dueDate: '2026-12-01' }).ok, true);
  const restored = store.list().items;
  assert.equal(context.LCA.scope.createStore(restored, () => storage).load().ok, true);
  assert.equal(restored[7].scopeMemo, '범위 확인 중');
  assert.equal(restored[7].stage, 1);
  assert.equal(context.LCA.requests.createStore(restored.map((project) => project.id), () => storage).list(p.id).items.length, 1);
});

test('등록으로 명단을 다시 연결해도 기존 범위·받은 자료·검토·필터가 보존된다', () => {
  const { store, storage } = setup();
  const before = store.list().items;
  const scope = context.LCA.scope.createStore(before, () => storage);
  const scopeProject = before[4];
  assert.equal(scope.save(scopeProject.id, { ...context.LCA.scope.snapshot(scopeProject), scopeMemo: '기존 협의', functionalUnit: { qty: '1', unit: '장' } }, context.LCA.scope.snapshot(scopeProject)).ok, true);
  const requests = context.LCA.requests.createStore(before.map((p) => p.id), () => storage);
  const id = requests.add(before[0].id, { categoryKey: 'energy', detail: '전력 사용량', dueDate: '2026-12-01' }).item.id;
  requests.recordReceipt(before[0].id, id, { kind: 'quantity', value: '100', unit: 'kWh', density: '', description: '', periodStart: '2025-01-01', periodEnd: '2025-12-31', evidenceFileName: '가상전력.xlsx' });
  const started = requests.startReview(before[0].id, id);
  requests.saveReview(before[0].id, id, { checks: { period: true, scope: true, complete: true }, note: '기존 검토' }, 'approve', started.item.review);
  const requestRaw = storage.getItem(context.LCA.requests.STORAGE_KEY);
  const scopeRaw = storage.getItem(context.LCA.scope.STORAGE_KEY);
  const after = store.add(draft()).items;
  assert.equal(context.LCA.scope.createStore(after, () => storage).load().ok, true);
  assert.equal(after[4].scopeMemo, '기존 협의');
  const all = context.LCA.requests.createStore(after.map((p) => p.id), () => storage).listAll();
  assert.equal(all.ok, true);
  assert.equal(all.items[0].status, '승인');
  assert.equal(all.items[0].receipt.value, '100');
  assert.equal(context.LCA.requestFilter.collectionSnapshot(all.items, after, '승인').total, 1);
  assert.equal(context.LCA.rules.stageCounts(after)[1], 2);
  assert.equal(storage.getItem(context.LCA.requests.STORAGE_KEY), requestRaw);
  assert.equal(storage.getItem(context.LCA.scope.STORAGE_KEY), scopeRaw);
});
