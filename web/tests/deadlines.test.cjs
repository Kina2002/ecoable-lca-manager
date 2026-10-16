const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'received-data.js', 'review.js', 'requests.js', 'deadlines.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
const D = context.LCA.deadlines;
const today = '2026-10-16';
const record = (changes = {}) => ({ id: 'DRQ-0001', projectId: 'p', categoryKey: 'energy', dueDate: '2026-10-17', status: '요청', ...changes });

test('전날·당일·지난 날을 D-1·D-0·D+1로 표시한다', () => {
  assert.equal(D.item(record(), today).text, 'D-1');
  assert.equal(D.item(record({ dueDate: today }), today).text, 'D-0');
  assert.equal(D.item(record({ dueDate: '2026-10-15' }), today).text, 'D+1');
});
test('월말·연말·윤년과 1~99년을 달력 날짜 기준으로 계산한다', () => {
  assert.equal(D.item(record({ dueDate: '2027-01-01' }), '2026-12-31').text, 'D-1');
  assert.equal(D.item(record({ dueDate: '2024-03-01' }), '2024-02-28').text, 'D-2');
  assert.equal(D.item(record({ dueDate: '0001-01-02' }), '0001-01-01').text, 'D-1');
  assert.equal(D.item(record({ dueDate: '2026-03-09' }), '2026-03-08').text, 'D-1');
});
test('날짜 오류를 가짜 D-day로 바꾸지 않는다', () => {
  assert.equal(D.item(record({ dueDate: '2026-02-30' }), today).text, '기한 확인 필요');
  assert.equal(D.item(record(), '틀린 날짜').days, null);
  assert.equal(D.project({ stage: 1, targetDate: '' }, today).text, '기한 확인 필요');
});
test('프로젝트는 기한 경과로 완료되지 않고 10단계일 때만 완료로 고정한다', () => {
  assert.equal(D.project({ stage: 9, targetDate: '2026-10-01' }, today).text, 'D+15');
  const complete = D.project({ stage: 10, targetDate: '2026-10-01' }, today);
  assert.equal(complete.text, '완료');
  assert.equal(D.refresh(complete, '2030-01-01').text, '완료');
});
test('제출됨·검토 중·보완 요청은 계속 세고 승인은 고정한다', () => {
  for (const status of ['요청', '제출됨', '검토 중', '보완 요청']) assert.equal(D.item(record({ dueDate: '2026-10-15', status }), today).text, 'D+1');
  const approved = D.item(record({ status: '승인' }), today);
  assert.equal(D.refresh(approved, '2030-01-01').text, '승인');
});
test('검토 중의 D+는 고객 제출 지연을 뜻하는 강조색과 구분한다', () => {
  assert.equal(D.item(record({ dueDate: '2026-10-15', status: '검토 중' }), today).tone, 'review');
  assert.equal(D.item(record({ dueDate: '2026-10-15', status: '요청' }), today).tone, 'elapsed');
  assert.equal(D.item(record(), today).tone, 'soon');
});
test('프로젝트별 미승인 자료의 가장 이른 기한과 그 상태를 보여준다', () => {
  const items = [record({ id: 'approved', dueDate: '2026-01-01', status: '승인' }), record({ id: 'later', dueDate: '2026-10-20' }), record({ id: 'earliest', dueDate: '2026-10-14', status: '검토 중' })];
  const result = D.summary('p', items, today);
  assert.equal(result.text, 'D+2');
  assert.equal(result.status, '검토 중');
  assert.equal(result.sourceId, 'earliest');
  assert.equal(result.approved, 1);
  assert.equal(result.pending, 2);
});
test('자료 0건과 모두 승인된 경우를 구분하고 삭제·다른 프로젝트는 제외한다', () => {
  assert.equal(D.summary('p', [], today).text, '요청 없음');
  assert.equal(D.summary('p', [record({ deletedAt: today }), record({ projectId: 'other' })], today).text, '요청 없음');
  const summary = D.summary('p', [record({ status: '승인' }), record({ id: 'deleted', deletedAt: today })], today);
  assert.equal(summary.text, '자료 검토 완료');
  assert.equal(summary.total, 1);
  assert.equal(D.refresh(summary, '2030-01-01').text, '자료 검토 완료');
});
test('같은 기한은 등록 순서를 유지하고 원본을 정렬·수정하지 않는다', () => {
  const items = [record({ id: 'first' }), record({ id: 'second', status: '보완 요청' })];
  const before = JSON.stringify(items);
  assert.equal(D.summary('p', items, today).sourceId, 'first');
  assert.equal(JSON.stringify(items), before);
});
test('새 날짜로 계산하면 진행 중 D-day만 바뀐다', () => {
  const summary = D.summary('p', [record()], today);
  assert.equal(summary.text, 'D-1');
  assert.equal(D.refresh(summary, '2026-10-18').text, 'D+1');
  assert.equal(summary.text, 'D-1');
});
test('미승인 날짜가 잘못된 경우 완료로 감추지 않는다', () => {
  const result = D.summary('p', [record({ dueDate: '' }), record({ id: 'approved', status: '승인' })], today);
  assert.equal(result.text, '기한 확인 필요');
  assert.equal(result.pending, 1);
});
test('실제 검토 승인·자료 재기록·보완·삭제 복원 뒤 현황을 다시 계산한다', () => {
  let raw = null;
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  const store = context.LCA.requests.createStore(['p'], () => storage);
  const id = store.add('p', { categoryKey: 'energy', detail: '전력 사용량', dueDate: '2026-10-15' }).item.id;
  const receipt = { kind: 'quantity', value: '100', unit: 'kWh', density: '', description: '', periodStart: '2025-01-01', periodEnd: '2025-12-31', evidenceFileName: '가상.xlsx' };
  store.recordReceipt('p', id, receipt);
  let started = store.startReview('p', id);
  store.saveReview('p', id, { checks: { period: true, scope: true, complete: true }, note: '' }, 'approve', started.item.review);
  assert.equal(D.summary('p', store.listAll().items, today).text, '자료 검토 완료');
  store.recordReceipt('p', id, receipt);
  assert.equal(D.summary('p', store.listAll().items, today).status, '제출됨');
  started = store.startReview('p', id);
  store.saveReview('p', id, { checks: { period: false, scope: false, complete: false }, note: '기간 보완' }, 'revision', started.item.review);
  assert.equal(D.summary('p', store.listAll().items, today).text, 'D+1');
  assert.equal(D.summary('p', store.listAll().items, today).status, '보완 요청');
  store.remove('p', id);
  assert.equal(D.summary('p', store.listAll().items, today).text, '요청 없음');
  store.restore('p', id);
  assert.equal(D.summary('p', store.listAll().items, today).text, 'D+1');
});
