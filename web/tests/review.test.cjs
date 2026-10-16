const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'received-data.js', 'review.js', 'requests.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
}
const { createStore, STORAGE_KEY } = context.LCA.requests;
const receipt = () => ({ kind: 'quantity', value: '12000', unit: 'kWh', density: '', description: '', periodStart: '2025-01-01', periodEnd: '2025-12-31', evidenceFileName: '가상_고지서.xlsx' });
const draft = (checks = { period: true, scope: true, complete: true }, note = '') => ({ checks, note });
function setup(submitted = true) {
  let raw = null;
  let writes = 0;
  const storage = {
    getItem(key) { assert.equal(key, STORAGE_KEY); return raw; },
    setItem(key, value) { assert.equal(key, STORAGE_KEY); raw = value; writes++; },
    get raw() { return raw; }, get writes() { return writes; }
  };
  const store = createStore(['a', 'b'], () => storage);
  store.add('a', { categoryKey: 'energy', detail: '2025년 전력 사용 자료', dueDate: '2026-10-23' });
  if (submitted) store.recordReceipt('a', 'DRQ-0001', receipt());
  return { store, storage };
}

test('받은 자료가 있는 제출됨 요청만 검토를 시작하고 기존 받은 자료와 기한을 유지한다', () => {
  const pending = setup(false);
  assert.equal(pending.store.startReview('a', 'DRQ-0001').ok, false);
  const { store, storage } = setup();
  const before = store.list('a').items[0];
  const result = store.startReview('a', before.id);
  assert.equal(result.ok, true);
  assert.equal(result.item.status, '검토 중');
  assert.equal(JSON.stringify(result.item.receipt), JSON.stringify(before.receipt));
  assert.equal(result.item.dueDate, before.dueDate);
  assert.equal(Object.values(result.item.review.checks).every((value) => value === false), true);
  const writes = storage.writes;
  assert.equal(store.startReview('a', before.id).ok, true);
  assert.equal(storage.writes, writes);
  assert.equal(createStore(['a', 'b'], () => storage).list('a').items[0].status, '검토 중');
});

test('미완료 체크와 메모를 검토 중으로 저장하고 다시 읽는다', () => {
  const { store, storage } = setup();
  const first = store.startReview('a', 'DRQ-0001').item;
  const result = store.saveReview('a', first.id, draft({ period: true, scope: false, complete: false }, '  기간만 확인  '), 'draft', first.review);
  assert.equal(result.ok, true);
  assert.equal(result.item.status, '검토 중');
  const restored = createStore(['a', 'b'], () => storage).list('a').items[0];
  assert.equal(restored.review.checks.period, true);
  assert.equal(restored.review.checks.scope, false);
  assert.equal(restored.review.note, '기간만 확인');
  assert.equal(restored.review.startedAt, first.review.startedAt);
});

test('승인은 세 항목 확인이 모두 필요하고 체크 누락·잘못된 형식을 저장하지 않는다', () => {
  const { store, storage } = setup();
  const item = store.startReview('a', 'DRQ-0001').item;
  const before = storage.raw;
  for (const key of ['period', 'scope', 'complete']) {
    const checks = { period: true, scope: true, complete: true, [key]: false };
    assert.ok(store.saveReview('a', item.id, draft(checks), 'approve', item.review).errors.checks);
  }
  assert.ok(store.saveReview('a', item.id, draft({ period: 'true', scope: true, complete: true }), 'approve', item.review).errors.checks);
  assert.ok(store.saveReview('a', item.id, draft(null), 'draft', item.review).errors.checks);
  assert.equal(storage.raw, before);
  const approved = store.saveReview('a', item.id, draft(), 'approve', item.review);
  assert.equal(approved.ok, true);
  assert.equal(approved.item.status, '승인');
  assert.equal(store.list('a').items[0].status, '승인');
  assert.equal(store.startReview('a', item.id).ok, false);
});

test('보완 요청은 미완료 체크로 가능하지만 공백 사유는 저장하지 않는다', () => {
  const { store, storage } = setup();
  const item = store.startReview('a', 'DRQ-0001').item;
  const checks = { period: false, scope: true, complete: false };
  const before = storage.raw;
  assert.ok(store.saveReview('a', item.id, draft(checks, '  '), 'revision', item.review).errors.note);
  assert.equal(storage.raw, before);
  const result = store.saveReview('a', item.id, draft(checks, '  12월 고지서를 추가해 주세요.  '), 'revision', item.review);
  assert.equal(result.ok, true);
  assert.equal(result.item.status, '보완 요청');
  assert.equal(result.item.review.note, '12월 고지서를 추가해 주세요.');
  assert.equal(createStore(['a', 'b'], () => storage).list('a').items[0].status, '보완 요청');
});

test('검토 중·보완 요청·승인 후 자료를 다시 저장하면 체크와 결과를 초기화한다', () => {
  for (const action of ['draft', 'revision', 'approve']) {
    const { store } = setup();
    const item = store.startReview('a', 'DRQ-0001').item;
    store.saveReview('a', item.id, draft(undefined, '확인 또는 보완 사유'), action, item.review);
    const resubmitted = store.recordReceipt('a', item.id, { ...receipt(), value: '14000' });
    assert.equal(resubmitted.item.status, '제출됨');
    assert.equal('review' in resubmitted.item, false);
    const restarted = store.startReview('a', item.id).item;
    assert.equal(Object.values(restarted.review.checks).every((value) => value === false), true);
    assert.equal(restarted.review.note, '');
    assert.equal(restarted.receipt.value, '14000');
  }
});

test('작성 중 다른 저장본의 자료·검토가 바뀌면 낡은 검토 결과를 덮어쓰지 않는다', () => {
  const { store, storage } = setup();
  const second = createStore(['a', 'b'], () => storage);
  const stale = store.startReview('a', 'DRQ-0001').item;
  second.saveReview('a', stale.id, draft(undefined, '다른 창의 검토 메모'), 'draft', stale.review);
  const before = storage.raw;
  assert.equal(store.saveReview('a', stale.id, draft(), 'approve', stale.review).ok, false);
  assert.equal(storage.raw, before);
  const current = second.list('a').items[0];
  second.recordReceipt('a', current.id, { ...receipt(), value: '15000' });
  assert.equal(store.saveReview('a', current.id, draft(), 'approve', current.review).ok, false);
  assert.equal(store.list('a').items[0].status, '제출됨');
});

test('다른 프로젝트·없는 요청·삭제된 요청·이미 결정된 결과 변경을 거부한다', () => {
  const { store, storage } = setup();
  const item = store.startReview('a', 'DRQ-0001').item;
  const before = storage.raw;
  for (const [project, id] of [['b', item.id], ['unknown', item.id], ['a', 'DRQ-9999']]) {
    assert.equal(store.startReview(project, id).ok, false);
    assert.equal(store.saveReview(project, id, draft(), 'approve', item.review).ok, false);
  }
  assert.equal(storage.raw, before);
  store.saveReview('a', item.id, draft(), 'approve', item.review);
  const approved = storage.raw;
  assert.equal(store.saveReview('a', item.id, draft(undefined, '늦은 변경'), 'revision', item.review).ok, false);
  assert.equal(storage.raw, approved);
  store.remove('a', item.id);
  assert.equal(store.startReview('a', item.id).ok, false);
  assert.equal(store.saveReview('a', item.id, draft(), 'approve', item.review).ok, false);
  const restored = store.restore('a', item.id).item;
  assert.equal(restored.status, '승인');
  assert.equal(restored.review.checks.complete, true);
});

test('메모 길이와 처리 방법을 검사하고 1,000자까지 허용한다', () => {
  const { store, storage } = setup();
  const item = store.startReview('a', 'DRQ-0001').item;
  const before = storage.raw;
  assert.ok(store.saveReview('a', item.id, draft(undefined, 'x'.repeat(1001)), 'approve', item.review).errors.note);
  assert.ok(store.saveReview('a', item.id, draft(), 'unknown', item.review).errors.action);
  assert.equal(storage.raw, before);
  assert.equal(store.saveReview('a', item.id, draft(undefined, 'x'.repeat(1000)), 'draft', item.review).ok, true);
});

test('검토 시작·결과·재제출 쓰기 실패에서 기존 상태와 값을 유지한다', () => {
  const { store, storage } = setup();
  const denied = createStore(['a', 'b'], () => ({ getItem: storage.getItem, setItem() { throw new Error('quota'); } }));
  const submitted = storage.raw;
  assert.equal(denied.startReview('a', 'DRQ-0001').ok, false);
  assert.equal(storage.raw, submitted);
  const item = store.startReview('a', 'DRQ-0001').item;
  const reviewing = storage.raw;
  assert.equal(denied.saveReview('a', item.id, draft(), 'approve', item.review).ok, false);
  assert.equal(storage.raw, reviewing);
  store.saveReview('a', item.id, draft(), 'approve', item.review);
  const approved = storage.raw;
  assert.equal(denied.recordReceipt('a', item.id, receipt()).ok, false);
  assert.equal(storage.raw, approved);
});

test('손상된 검토 기록·상태 불일치·다른 자료 버전을 자동 복구하거나 덮어쓰지 않는다', () => {
  const { store, storage } = setup();
  const item = store.startReview('a', 'DRQ-0001').item;
  store.saveReview('a', item.id, draft(), 'approve', item.review);
  for (const corrupt of [
    (value) => { delete value.review; },
    (value) => { value.review.checks.period = false; },
    (value) => { value.review.updatedAt = 'invalid'; },
    (value) => { value.review.receiptUpdatedAt = 'old'; },
    (value) => { value.status = '제출됨'; },
    (value) => { value.status = '보완 요청'; value.review.note = ''; }
  ]) {
    const data = JSON.parse(storage.raw);
    corrupt(data.requests[0]);
    let raw = JSON.stringify(data);
    let writes = 0;
    const bad = createStore(['a', 'b'], () => ({ getItem() { return raw; }, setItem() { writes++; } }));
    assert.equal(bad.list('a').ok, false);
    assert.equal(bad.startReview('a', item.id).ok, false);
    assert.equal(bad.saveReview('a', item.id, draft(), 'approve', item.review).ok, false);
    assert.equal(writes, 0);
  }
});
