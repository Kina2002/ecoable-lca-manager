const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const name of ['constants.js', 'rules.js', 'data.js', 'received-data.js', 'review.js', 'requests.js', 'scope.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8'), context);
}
const S = context.LCA.scope;
function setup() {
  const projects = context.LCA.data.createSampleProjects('2026-10-16');
  let raw = null;
  let writes = 0;
  const storage = { getItem(key) { assert.equal(key, S.STORAGE_KEY); return raw; }, setItem(key, value) { assert.equal(key, S.STORAGE_KEY); raw = value; writes++; } };
  const store = S.createStore(projects, () => storage);
  return { projects, store, storage, get raw() { return raw; }, set raw(value) { raw = value; }, get writes() { return writes; } };
}
function save(state, project, changes) { return state.store.save(project.id, { ...S.snapshot(project), ...changes }, S.snapshot(project)); }
function confirmed(state) {
  const project = state.projects[4];
  assert.equal(save(state, project, { scopeStatus: '확정', functionalUnit: { qty: '1', unit: '장' } }).ok, true);
  return project;
}

test('샘플 상태는 명시되며 초기 조회는 쓰기를 하지 않는다', () => {
  const s = setup();
  assert.equal(s.store.load().ok, true);
  assert.equal(s.projects[6].scopeStatus, '고객 요청안');
  assert.equal(s.projects[4].scopeStatus, '협의 중');
  assert.equal(s.writes, 0);
});
test('네 상태는 필수 정보가 있는 경우 순서를 강제하지 않는다', () => {
  const s = setup(), p = s.projects[4];
  for (const status of S.STATUSES) assert.equal(save(s, p, { scopeStatus: status, functionalUnit: { qty: '1', unit: '장' } }).ok, true);
  assert.equal(p.stage, 2);
});
test('확정 저장과 수집 시작은 별도이며 새 저장소에서 복원된다', () => {
  const s = setup(), p = confirmed(s);
  assert.equal(p.stage, 2);
  assert.equal(s.store.start(p.id, S.snapshot(p)).ok, true);
  assert.equal(p.stage, 3);
  const fresh = context.LCA.data.createSampleProjects('2026-10-16');
  assert.equal(S.createStore(fresh, () => s.storage).load().ok, true);
  assert.equal(fresh[4].stage, 3);
  assert.equal(fresh[4].scopeStatus, '확정');
  assert.equal(s.projects[0].stage, 3);
});
test('미확정 상태는 수집 시작을 막는다', () => {
  const s = setup(), p = s.projects[4];
  assert.equal(s.store.start(p.id, S.snapshot(p)).ok, false);
  assert.equal(p.stage, 2);
  assert.equal(s.writes, 0);
});
test('빈 범위는 초안 저장 가능하지만 확정할 수 없다', () => {
  const s = setup(), p = s.projects[4];
  const draft = { scopeStatus: '미정', functionalUnit: { qty: '', unit: '' }, boundary: '', refStart: '', refEnd: '', standards: [] };
  assert.equal(save(s, p, draft).ok, true);
  assert.equal(save(s, p, { scopeStatus: '확정' }).ok, false);
  assert.equal(p.scopeStatus, '미정');
});
test('확정의 필수 정보는 각각 검사한다', () => {
  for (const changes of [{ functionalUnit: { qty: '0', unit: 'kg' } }, { functionalUnit: { qty: '1', unit: '' } }, { boundary: '' }, { refStart: '' }, { refEnd: '' }, { standards: [] }]) {
    const s = setup(), p = s.projects[4];
    assert.equal(save(s, p, { functionalUnit: { qty: '1', unit: '장' }, scopeStatus: '확정', ...changes }).ok, false);
    assert.equal(s.writes, 0);
  }
});
test('잘못된 날짜·역순·기준량·기준 이름을 거절한다', () => {
  for (const changes of [{ refStart: '2025-02-30' }, { refStart: '2026-01-01' }, { functionalUnit: { qty: '1e3', unit: 'kg' } }, { standards: ['없는 기준'] }]) {
    const s = setup(), p = s.projects[4];
    assert.equal(save(s, p, { functionalUnit: { qty: '1', unit: '장' }, ...changes }).ok, false);
  }
});
test('12개월이 아닌 확정 기간은 사유를 요구한다', () => {
  const s = setup(), p = s.projects[4];
  const draft = { scopeStatus: '확정', functionalUnit: { qty: '1', unit: '장' }, refEnd: '2025-06-30' };
  assert.equal(save(s, p, draft).ok, false);
  assert.equal(save(s, p, { ...draft, periodReason: '신규 생산으로 6개월 자료만 확보' }).ok, true);
  assert.equal(S.twelveMonths('2024-01-01', '2024-12-31'), true);
  assert.equal(S.twelveMonths('2025-04-01', '2026-03-31'), true);
});
test('계약 단계의 확정은 저장 가능하나 수집으로 건너뛰지 않는다', () => {
  const s = setup(), p = s.projects[6];
  assert.equal(save(s, p, { scopeStatus: '확정', functionalUnit: { qty: '1', unit: '개' }, refStart: '2025-01-01', refEnd: '2025-12-31', standards: ['ISO 14067'] }).ok, true);
  assert.equal(s.store.start(p.id, S.snapshot(p)).ok, false);
  assert.equal(p.stage, 1);
});
test('수집 시작 후 범위 변경과 중복 시작을 막는다', () => {
  const s = setup(), p = confirmed(s);
  assert.equal(s.store.start(p.id, S.snapshot(p)).ok, true);
  assert.equal(save(s, p, { scopeStatus: '협의 중' }).ok, false);
  assert.equal(s.store.start(p.id, S.snapshot(p)).ok, false);
});
test('저장 실패 시 메모리와 단계가 바뀌지 않는다', () => {
  const s = setup(), p = confirmed(s);
  const before = JSON.stringify(p);
  s.storage.setItem = () => { throw Error('quota'); };
  assert.equal(s.store.start(p.id, S.snapshot(p)).ok, false);
  assert.equal(JSON.stringify(p), before);
  assert.equal(save(s, p, { scopeStatus: '미정' }).ok, false);
  assert.equal(JSON.stringify(p), before);
});
test('손상·미지원 버전·알 수 없는 프로젝트는 보존하고 쓰기를 막는다', () => {
  for (const raw of ['{', 'null', '{"version":2,"records":{}}', '{"version":1,"records":{"unknown":{}}}']) {
    const s = setup(); s.raw = raw;
    assert.equal(s.store.load().ok, false);
    assert.equal(save(s, s.projects[4], {}).ok, false);
    assert.equal(s.raw, raw);
    assert.equal(s.writes, 0);
  }
});
test('다른 탭에서 바뀐 범위를 이전 화면이 덮어쓰지 않는다', () => {
  const s = setup(), p = s.projects[4], expected = S.snapshot(p);
  confirmed(s);
  assert.equal(s.store.save(p.id, expected, expected).ok, false);
  assert.equal(s.store.start(p.id, expected).ok, false);
  assert.equal(p.scopeStatus, '확정');
});

test('협의 메모를 저장·재로딩하고 수집 시작 후에도 유지한다', () => {
  const s = setup(), p = confirmed(s);
  const memo = '고객 요청: 요람~무덤\n사용 단계 자료 확보 가능 여부 확인';
  assert.equal(save(s, p, { scopeMemo: memo }).ok, true);
  assert.equal(p.stage, 2);
  assert.equal(s.store.start(p.id, S.snapshot(p)).ok, true);
  const fresh = context.LCA.data.createSampleProjects('2026-10-16');
  assert.equal(S.createStore(fresh, () => s.storage).load().ok, true);
  assert.equal(fresh[4].scopeMemo, memo);
  assert.equal(fresh[4].stage, 3);
  assert.equal(fresh[6].scopeMemo, '');
});

test('메모 없는 기존 v1 기록을 쓰기 없이 읽고 이후 수정할 수 있다', () => {
  const s = setup(), p = confirmed(s);
  const previous = JSON.parse(s.raw);
  delete previous.records[p.id].scopeMemo;
  s.raw = JSON.stringify(previous);
  const raw = s.raw, writes = s.writes;
  const fresh = context.LCA.data.createSampleProjects('2026-10-16');
  const store = S.createStore(fresh, () => s.storage);
  assert.equal(store.load().ok, true);
  assert.equal(fresh[4].scopeMemo, '');
  assert.equal(fresh[4].scopeStatus, '확정');
  assert.equal(s.raw, raw);
  assert.equal(s.writes, writes);
  assert.equal(store.save(p.id, { ...S.snapshot(fresh[4]), scopeMemo: '협의 결과 기록' }, S.snapshot(fresh[4])).ok, true);
  assert.equal(fresh[4].scopeMemo, '협의 결과 기록');
});

test('협의 메모 길이·형식과 저장 실패를 검사하고 기존 메모를 지킨다', () => {
  const s = setup(), p = confirmed(s);
  assert.equal(save(s, p, { scopeMemo: '가'.repeat(2000) }).ok, true);
  const before = s.raw;
  for (const memo of ['가'.repeat(2001), null, 123]) {
    assert.equal(save(s, p, { scopeMemo: memo }).ok, false);
    assert.equal(s.raw, before);
  }
  s.storage.setItem = () => { throw Error('quota'); };
  assert.equal(save(s, p, { scopeMemo: '변경' }).ok, false);
  assert.equal(p.scopeMemo.length, 2000);
});

test('다른 화면에서 메모만 수정해도 이전 화면의 저장·시작을 막는다', () => {
  const s = setup(), p = confirmed(s), expected = S.snapshot(p);
  assert.equal(save(s, p, { scopeMemo: '새 합의 내용' }).ok, true);
  assert.equal(s.store.save(p.id, { ...expected, scopeMemo: '이전 화면 내용' }, expected).ok, false);
  assert.equal(s.store.start(p.id, expected).ok, false);
  assert.equal(p.scopeMemo, '새 합의 내용');
  assert.equal(p.stage, 2);
});
