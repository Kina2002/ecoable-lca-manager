const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'data.js', 'received-data.js', 'review.js', 'requests.js', 'projects.js', 'scope.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
}
const S = context.LCA.scope;
const samples = () => {
  const items = context.LCA.data.createSampleProjects('2026-10-16');
  // 담당자가 미정인 계약 프로젝트를 검사하는 고정 입력이다.
  Object.assign(items[6], { customerContactName: '', researcherName: '', researcherId: '' });
  return items;
};
const names = { customerContactName: ' 김고객 ', researcherName: ' 박연구 ' };
function setup() {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const projects = samples();
  return { values, storage, projects, store: S.createStore(projects, () => storage), p: projects[6] };
}
function assign(s, changes = {}) { return s.store.saveAssignees(s.p.id, { ...names, ...changes }, S.snapshot(s.p)); }

test('담당자 저장은 이름을 정리하되 계약 단계와 기존 범위를 유지한다', () => {
  const s = setup(), boundary = s.p.boundary, status = s.p.scopeStatus;
  assert.equal(assign(s).ok, true);
  assert.equal(s.p.customerContactName, '김고객');
  assert.equal(s.p.researcherName, '박연구');
  assert.equal(s.p.stage, 1);
  assert.equal(s.p.boundary, boundary);
  assert.equal(s.p.scopeStatus, status);
});

test('두 담당자 모두 저장한 뒤 별도 시작으로 1에서 2로만 이동한다', () => {
  const s = setup();
  assert.equal(s.store.startScope(s.p.id, S.snapshot(s.p)).ok, false);
  assert.equal(assign(s, { researcherName: '' }).ok, true);
  assert.equal(s.store.startScope(s.p.id, S.snapshot(s.p)).ok, false);
  assert.equal(assign(s).ok, true);
  assert.equal(s.store.startScope(s.p.id, S.snapshot(s.p)).ok, true);
  assert.equal(s.p.stage, 2);
  assert.equal(s.p.scopeStatus, '고객 요청안');
  assert.equal(s.store.start(s.p.id, S.snapshot(s.p)).ok, false);
});

test('이름 형식과 100자 제한을 검사하고 한 사람만 먼저 저장할 수 있다', () => {
  const s = setup();
  for (const invalid of [null, 123, '가'.repeat(101)]) assert.equal(assign(s, { customerContactName: invalid }).ok, false);
  assert.equal(assign(s, { customerContactName: '가'.repeat(100), researcherName: ' ' }).ok, true);
  assert.equal(s.p.customerContactName.length, 100);
  assert.equal(s.p.researcherName, '');
  assert.equal(s.store.startScope(s.p.id, S.snapshot(s.p)).ok, false);
});

test('새로 연 명단에서도 담당자와 범위 정의 단계를 복원한다', () => {
  const s = setup(); assign(s);
  s.store.startScope(s.p.id, S.snapshot(s.p));
  const fresh = samples();
  assert.equal(S.createStore(fresh, () => s.storage).load().ok, true);
  assert.equal(fresh[6].stage, 2);
  assert.equal(fresh[6].customerContactName, '김고객');
  assert.equal(fresh[6].researcherName, '박연구');
});

test('범위 정의 이후 담당자 수정·중복 시작·단계 되돌리기를 허용하지 않는다', () => {
  const s = setup(); assign(s);
  s.store.startScope(s.p.id, S.snapshot(s.p));
  const before = s.storage.getItem(S.STORAGE_KEY);
  assert.equal(assign(s).ok, false);
  assert.equal(s.store.startScope(s.p.id, S.snapshot(s.p)).ok, false);
  assert.equal(s.store.save(s.p.id, { ...S.snapshot(s.p), stage: 1, customerContactName: '다른 이름' }, S.snapshot(s.p)).ok, true);
  assert.equal(s.p.stage, 2);
  assert.equal(s.p.customerContactName, '김고객');
  assert.equal(s.storage.getItem(S.STORAGE_KEY), before);
});

test('담당자 저장 실패와 단계 저장 실패는 메모리·저장본을 보존한다', () => {
  const s = setup(), set = s.storage.setItem;
  const before = JSON.stringify(s.p);
  s.storage.setItem = () => { throw Error('quota'); };
  assert.equal(assign(s).ok, false);
  assert.equal(JSON.stringify(s.p), before);
  s.storage.setItem = set; assign(s);
  const raw = s.storage.getItem(S.STORAGE_KEY);
  s.storage.setItem = () => { throw Error('quota'); };
  assert.equal(s.store.startScope(s.p.id, S.snapshot(s.p)).ok, false);
  assert.equal(s.p.stage, 1);
  assert.equal(s.storage.getItem(S.STORAGE_KEY), raw);
});

test('다른 화면에서 이름·범위가 바뀌면 이전 저장과 이동을 거절한다', () => {
  const s = setup(); assign(s);
  const expected = S.snapshot(s.p);
  assign(s, { researcherName: '이연구' });
  assert.equal(s.store.startScope(s.p.id, expected).ok, false);
  assert.equal(s.store.saveAssignees(s.p.id, names, expected).ok, false);
  const current = S.snapshot(s.p);
  s.store.save(s.p.id, { ...current, scopeMemo: '새 협의 내용', functionalUnit: { qty: '1', unit: '개' } }, current);
  assert.equal(s.store.startScope(s.p.id, current).ok, false);
  assert.equal(s.p.researcherName, '이연구');
});

test('담당자 필드가 없던 기존 v1의 범위·메모를 쓰기 없이 읽는다', () => {
  const s = setup();
  const p = s.projects[4];
  s.store.save(p.id, { ...S.snapshot(p), functionalUnit: { qty: '1', unit: '장' }, scopeMemo: '기존 메모' }, S.snapshot(p));
  const data = JSON.parse(s.storage.getItem(S.STORAGE_KEY));
  delete data.records[p.id].customerContactName;
  delete data.records[p.id].researcherName;
  delete data.records[p.id].researcherId;
  const raw = JSON.stringify(data); s.values.set(S.STORAGE_KEY, raw);
  assert.equal(s.store.load().ok, true);
  assert.equal(p.customerContactName, '정서현');
  assert.equal(p.scopeMemo, '기존 메모');
  assert.equal(s.storage.getItem(S.STORAGE_KEY), raw);
});

test('담당자 없는 계약 프로젝트의 부정한 단계 기록·손상 기록은 보존하고 차단한다', () => {
  for (const change of [(r) => r.stage = 2, (r) => r.customerContactName = 123]) {
    const s = setup(); assign(s, { customerContactName: '', researcherName: '' });
    const data = JSON.parse(s.storage.getItem(S.STORAGE_KEY));
    change(data.records[s.p.id]);
    const raw = JSON.stringify(data); s.values.set(S.STORAGE_KEY, raw);
    assert.equal(s.store.load().ok, false);
    assert.equal(assign(s).ok, false);
    assert.equal(s.storage.getItem(S.STORAGE_KEY), raw);
  }
});

test('새 프로젝트 등록→담당자→범위 정의→확정→수집을 이어서 복원한다', () => {
  const s = setup();
  const registry = context.LCA.projects.createStore(samples(), '2026-10-16', () => s.storage);
  const added = registry.add({ companyName: '푸른소재', productName: '재생 칩', purpose: '고객사 요구 대응', targetDate: '2026-12-31' });
  const p = added.items[7], store = S.createStore(added.items, () => s.storage);
  assert.equal(store.load().ok, true);
  assert.equal(store.saveAssignees(p.id, names, S.snapshot(p)).ok, true);
  assert.equal(store.startScope(p.id, S.snapshot(p)).ok, true);
  assert.equal(store.save(p.id, { ...S.snapshot(p), scopeStatus: '확정', functionalUnit: { qty: '1', unit: 'kg' }, boundary: '요람~문', refStart: '2025-01-01', refEnd: '2025-12-31', standards: ['ISO 14040/44'], scopeMemo: '고객 합의' }, S.snapshot(p)).ok, true);
  assert.equal(store.start(p.id, S.snapshot(p)).ok, true);
  const fresh = registry.list().items;
  assert.equal(S.createStore(fresh, () => s.storage).load().ok, true);
  assert.equal(fresh[7].stage, 3);
  assert.equal(fresh[7].customerContactName, '김고객');
  assert.equal(fresh[7].scopeMemo, '고객 합의');
  assert.equal(context.LCA.rules.stageCounts(fresh)[3], 2);
});
