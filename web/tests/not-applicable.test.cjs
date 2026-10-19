const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'received-data.js', 'review.js', 'requests.js', 'request-filter.js', 'scope.js', 'modelling.js', 'deadlines.js', 'dashboard.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
}
context.LCA.interpretation = { LABELS: {} };
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'report.js'), 'utf8'), context, { filename: 'report.js' });
const { requests: R, scope: S, modelling: M, deadlines: D, requestFilter: F } = context.LCA;
const project = { id: 'p', stage: 3, code: 'LCA-001', companyName: '가상회사', productName: '가상제품', functionalUnit: { qty: '1', unit: 'kg' } };
function setup() {
  let raw = null; let fail = false;
  const storage = { getItem() { return raw; }, setItem(_key, value) { if (fail) throw Error('quota'); raw = value; } };
  const store = R.createStore(['p'], () => storage);
  const add = (categoryKey) => store.add('p', { categoryKey, detail: '가상 자료', dueDate: '2026-10-15' }).item;
  return { store, add, raw: () => raw, put: (value) => { raw = value; }, fail: (value) => { fail = value; } };
}
const receipt = { kind: 'quantity', value: '100', unit: 'kWh', density: '', description: '', periodStart: '2025-01-01', periodEnd: '2025-12-31', evidenceFileName: '가상.xlsx' };
function approve(store, id) {
  assert.equal(store.recordReceipt('p', id, receipt).ok, true);
  const started = store.startReview('p', id);
  assert.equal(store.saveReview('p', id, { checks: { period: true, scope: true, complete: true }, note: '' }, 'approve', started.item.review).ok, true);
}

test('사유가 있어야 해당 없음으로 저장하고 필터·기한·복원을 연결한다', () => {
  const s = setup(); const item = s.add('energy'); const before = s.raw();
  assert.equal(s.store.markNotApplicable('p', item.id, ' ').ok, false);
  assert.equal(s.raw(), before);
  assert.equal(s.store.markNotApplicable('p', item.id, ' 공정 없음 ').ok, true);
  const saved = s.store.list('p').items[0];
  assert.equal(saved.notApplicable.reason, '공정 없음');
  assert.equal(F.snapshot([saved], 'p', '해당 없음').visible.length, 1);
  assert.equal(D.item(saved, '2026-10-19').text, '해당 없음');
  assert.equal(D.summary('p', [saved], '2026-10-19').text, '해당 자료 없음');
  assert.equal(s.store.recordReceipt('p', item.id, receipt).ok, false);
  assert.equal(s.store.markNotApplicable('p', item.id, '중복').ok, false);
  assert.equal(s.store.remove('p', item.id).ok, true);
  assert.equal(s.store.restore('p', item.id).ok, true);
  assert.equal(s.store.list('p').items[0].notApplicable.reason, '공정 없음');
  assert.equal(s.store.restoreApplicable('p', item.id).ok, true);
  assert.equal(s.store.list('p').items[0].status, '요청');
  assert.equal(s.store.list('p').items[0].notApplicable, undefined);
});

test('해당 없음은 수집·검토·계산 분모에서 빠지고 실제 승인 자료 한 건을 요구한다', () => {
  const s = setup(); const na = s.add('energy');
  assert.equal(s.store.markNotApplicable('p', na.id, '발생하지 않음').ok, true);
  let items = s.store.list('p').items;
  assert.equal(S.collectionReadiness('p', { ok: true, items }).ready, false);
  assert.equal(S.reviewReadiness('p', { ok: true, items }).ready, false);
  assert.equal(M.sourceState(project, { ok: true, items }).ready, false);
  const actual = s.add('packaging'); approve(s.store, actual.id);
  items = s.store.list('p').items;
  const collected = S.collectionReadiness('p', { ok: true, items });
  const reviewed = S.reviewReadiness('p', { ok: true, items });
  const model = M.sourceState(project, { ok: true, items });
  assert.equal(collected.ready, true); assert.equal(collected.total, 1); assert.equal(collected.notApplicable, 1);
  assert.equal(reviewed.ready, true); assert.equal(reviewed.total, 1);
  assert.equal(model.ready, true); assert.equal(model.approved.length, 1); assert.equal(model.notApplicable, 1);
  assert.equal(D.summary('p', items, '2026-10-19').text, '자료 검토 완료');
  assert.equal(context.LCA.rules.projectStats(project, items).total, 1);
  assert.equal(F.snapshot(items, 'p').total, 2);
});

test('상태가 바뀌었거나 저장이 실패하면 기존 기록을 보호하고 손상된 사유도 거부한다', () => {
  const s = setup(); const item = s.add('energy');
  approve(s.store, item.id);
  const approved = s.raw();
  assert.equal(s.store.markNotApplicable('p', item.id, '뒤늦게 변경').ok, false);
  assert.equal(s.raw(), approved);
  const other = s.add('packaging');
  const before = s.raw(); s.fail(true);
  assert.equal(s.store.markNotApplicable('p', other.id, '공정 없음').ok, false);
  assert.equal(s.raw(), before); s.fail(false);
  assert.equal(s.store.markNotApplicable('p', other.id, '공정 없음').ok, true);
  const damaged = JSON.parse(s.raw()); damaged.requests[1].notApplicable.reason = '';
  s.put(JSON.stringify(damaged));
  assert.equal(s.store.list('p').ok, false);
});

test('보고서에는 승인 원자료와 해당 없음 사유를 별도 항목으로 보여준다', () => {
  const s = setup(); const actual = s.add('energy'); approve(s.store, actual.id);
  const na = s.add('packaging'); s.store.markNotApplicable('p', na.id, '포장 공정 없음');
  const source = M.sourceState(project, { ok: true, items: s.store.list('p').items });
  const reportScope = { ...project, boundary: '요람~문', refStart: '2025-01-01', refEnd: '2025-12-31', standards: ['가상 기준'] };
  const sections = context.LCA.report.sections({ source: { project, interpretation: {
    revision: 1, calculation: { revision: 1, source: { project: reportScope, requests: source.basis.requests },
      calculatedOn: '2026-10-19', tool: '가상 도구', database: '가상 DB', method: '가상 방법', allocation: '없음', resultFileName: '결과.xlsx', note: '', indicators: [] }
  } }, note: '' });
  const approvedSection = sections.find((section) => section.title.startsWith('계산에 연결한 승인 원자료'));
  const naSection = sections.find((section) => section.title.startsWith('해당 없음 자료'));
  assert.equal(approvedSection.paragraphs.length, 1);
  assert.equal(naSection.paragraphs.length, 1);
  assert.match(naSection.paragraphs[0], /포장 공정 없음/);
});
