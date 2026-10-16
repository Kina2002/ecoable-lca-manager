const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'received-data.js', 'review.js', 'requests.js', 'request-filter.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
}
const { snapshot, STATUSES } = context.LCA.requestFilter;
const items = Object.freeze([
  { id: 'r1', projectId: 'a', status: '요청' },
  { id: 'r2', projectId: 'a', status: '승인' },
  { id: 'r3', projectId: 'a', status: '보완 요청' },
  { id: 'r4', projectId: 'a', status: '검토 중' },
  { id: 'r5', projectId: 'a', status: '제출됨' },
  { id: 'r6', projectId: 'a', status: '요청' },
  { id: 'r7', projectId: 'a', status: '승인', deletedAt: '2026-10-16T03:00:00.000Z' },
  { id: 'r8', projectId: 'b', status: '승인' }
].map(Object.freeze));

test('현재 프로젝트의 삭제하지 않은 요청만 세고 상태 건수 합계가 전체와 같다', () => {
  const result = snapshot(items, 'a');
  assert.equal(result.total, 6);
  assert.equal(result.counts['요청'], 2);
  for (const status of ['제출됨', '검토 중', '보완 요청', '승인']) assert.equal(result.counts[status], 1);
  assert.equal(Object.values(result.counts).reduce((sum, count) => sum + count, 0), result.total);
  assert.equal(snapshot(items, 'b').total, 1);
  assert.equal(snapshot(items, 'b').counts['승인'], 1);
});

test('상태를 골라도 전체와 모든 상태의 건수는 그대로이며 원래 순서로 조회한다', () => {
  const all = snapshot(items, 'a');
  for (const status of STATUSES) {
    const result = snapshot(items, 'a', status);
    assert.equal(result.total, 6);
    assert.equal(JSON.stringify(result.counts), JSON.stringify(all.counts));
    assert.equal(result.visible.every((item) => item.status === status), true);
  }
  assert.deepEqual(Array.from(snapshot(items, 'a', '요청').visible, (item) => item.id), ['r1', 'r6']);
  assert.deepEqual(Array.from(snapshot(items, 'a').visible, (item) => item.id), ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
});

test('0건 상태와 빈 프로젝트도 남기고 없는 상태 선택은 빈 목록으로 처리한다', () => {
  const only = snapshot([items[0]], 'a', '승인');
  assert.equal(only.total, 1);
  assert.equal(only.counts['승인'], 0);
  assert.equal(only.visible.length, 0);
  const empty = snapshot([], 'a');
  assert.equal(Object.keys(empty.counts).length, 5);
  assert.equal(Object.values(empty.counts).every((count) => count === 0), true);
  assert.equal(snapshot(items, 'missing').total, 0);
  assert.equal(snapshot(items, 'a', '알 수 없는 상태').visible.length, 0);
});

test('조회는 자료 상태·원본 순서·프로젝트 단계를 바꾸지 않는다', () => {
  const project = Object.freeze({ id: 'a', stage: 3 });
  const original = JSON.stringify(items);
  const result = snapshot(items, project.id, '보완 요청');
  assert.equal(result.visible[0], items[2]);
  result.visible.reverse();
  assert.equal(JSON.stringify(items), original);
  assert.equal(project.stage, 3);
});

function setup() {
  let raw = null;
  let writes = 0;
  const storage = { getItem() { return raw; }, setItem(key, value) { raw = value; writes++; } };
  const store = context.LCA.requests.createStore(['a', 'b'], () => storage);
  const request = { categoryKey: 'energy', detail: '2025년 전력 사용량', dueDate: '2026-10-23' };
  store.add('a', request);
  store.add('b', request);
  const receipt = { kind: 'quantity', value: '12000', unit: 'kWh', density: '', description: '', periodStart: '2025-01-01', periodEnd: '2025-12-31', evidenceFileName: '가상_고지서.xlsx' };
  return { store, receipt, raw: () => raw, writes: () => writes };
}

test('실제 저장소의 제출·검토·보완·승인·재기록 후 새 건수와 목록을 계산한다', () => {
  const { store, receipt } = setup();
  const get = (status = null) => snapshot(store.list('a').items, 'a', status);
  assert.equal(get('요청').visible.length, 1);
  store.recordReceipt('a', 'DRQ-0001', receipt);
  assert.equal(get('요청').visible.length, 0);
  assert.equal(get().counts['제출됨'], 1);
  let reviewing = store.startReview('a', 'DRQ-0001').item;
  assert.equal(get('제출됨').visible.length, 0);
  assert.equal(get('검토 중').visible.length, 1);
  store.saveReview('a', reviewing.id, { checks: { period: false, scope: true, complete: false }, note: '12월 자료 추가 요청' }, 'revision', reviewing.review);
  assert.equal(get().counts['보완 요청'], 1);
  store.recordReceipt('a', 'DRQ-0001', receipt);
  reviewing = store.startReview('a', 'DRQ-0001').item;
  store.saveReview('a', reviewing.id, { checks: { period: true, scope: true, complete: true }, note: '' }, 'approve', reviewing.review);
  assert.equal(get('승인').visible.length, 1);
  assert.equal(get().total, 1);
  store.recordReceipt('a', 'DRQ-0001', receipt);
  assert.equal(get('승인').visible.length, 0);
  assert.equal(get().counts['제출됨'], 1);
  assert.equal(snapshot(store.list('b').items, 'b').counts['요청'], 1);
});

test('삭제·복원 후 건수를 다시 계산하며 필터 조회는 브라우저 저장을 쓰지 않는다', () => {
  const { store, raw, writes } = setup();
  const before = raw();
  const beforeWrites = writes();
  for (const status of [null, ...STATUSES]) snapshot(store.list('a').items, 'a', status);
  assert.equal(raw(), before);
  assert.equal(writes(), beforeWrites);
  store.remove('a', 'DRQ-0001');
  const deleted = store.list('a');
  assert.equal(snapshot([...deleted.items, ...deleted.deletedItems], 'a').total, 0);
  store.restore('a', 'DRQ-0001');
  assert.equal(snapshot(store.list('a').items, 'a', '요청').visible.length, 1);
});
