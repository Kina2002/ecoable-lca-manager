const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'data.js', 'received-data.js', 'review.js', 'requests.js', 'scope.js', 'projects.js', 'deadlines.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
}
const { scope: S, requests: R, projects: P } = context.LCA;
const today = '2026-10-17';
const samples = () => context.LCA.data.createSampleProjects(today);
const receipt = { kind: 'quantity', value: '100', unit: 'kWh', density: '', description: '', periodStart: '2025-01-01', periodEnd: '2025-12-31', evidenceFileName: '가상자료.xlsx' };
function setup() {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const projects = samples();
  const requests = R.createStore(projects.map((p) => p.id), () => storage);
  const store = S.createStore(projects, () => storage, null, (id) => requests.list(id));
  return { values, storage, projects, requests, store, project: projects[2] };
}
function add(s, categoryKey = 'energy', projectId = s.project.id) {
  return s.requests.add(projectId, { categoryKey, detail: '가상 검토 자료', dueDate: '2026-10-20' }).item;
}
function approve(s, item, projectId = s.project.id) {
  assert.equal(s.requests.recordReceipt(projectId, item.id, receipt).ok, true);
  const started = s.requests.startReview(projectId, item.id);
  assert.equal(s.requests.saveReview(projectId, item.id, { checks: { period: true, scope: true, complete: true }, note: '가상 자료 확인' }, 'approve', started.item.review).ok, true);
}
const finish = (s, expected = S.snapshot(s.project)) => s.store.finishReview(s.project.id, expected);

test('검토 준비는 승인과 받은 자료·검토 기록을 모두 요구하고 0건을 완료로 보지 않는다', () => {
  for (const status of ['요청', '제출됨', '검토 중', '보완 요청', '승인']) {
    const result = S.reviewReadiness('p', { ok: true, items: [{ projectId: 'p', status, receipt: {}, review: {} }] });
    assert.equal(result.ready, status === '승인');
    assert.equal(result.approved, status === '승인' ? 1 : 0);
  }
  assert.equal(S.reviewReadiness('p', { ok: true, items: [] }).ready, false);
  assert.equal(S.reviewReadiness('p', { ok: true, items: [{ projectId: 'p', status: '승인' }] }).ready, false);
});

test('검토 샘플의 승인 후 별도 버튼으로만 4→5를 저장하며 자료와 목표일을 보존한다', () => {
  const s = setup(), item = add(s);
  approve(s, item);
  assert.equal(s.store.reviewStatus(s.project.id).ready, true);
  assert.equal(s.project.stage, 4);
  const requestsBefore = s.values.get(R.STORAGE_KEY), target = s.project.targetDate;
  assert.equal(finish(s).ok, true);
  assert.equal(s.project.stage, 5);
  assert.equal(s.project.targetDate, target);
  assert.equal(s.values.get(R.STORAGE_KEY), requestsBefore);
  assert.equal(s.values.has(P.STORAGE_KEY), false);
  const fresh = samples();
  assert.equal(S.createStore(fresh, () => s.storage).load().ok, true);
  assert.equal(fresh[2].stage, 5);
  assert.equal(Number(fresh[2].functionalUnit.qty), 1);
  assert.equal(context.LCA.rules.stageCounts(fresh)[4], 0);
  assert.equal(context.LCA.rules.stageCounts(fresh)[5], 1);
});

test('수집→검토→승인→계산을 복원하고 범위·메모와 수집 마감일을 유지한다', () => {
  const s = setup();
  s.project = s.projects[0];
  const dates = P.createStore(samples(), today, () => s.storage, (id) => s.store.currentStage(id));
  dates.saveCollectionDeadline(s.project.id, '2026-10-23', '2026-10-24');
  const item = add(s);
  s.requests.recordReceipt(s.project.id, item.id, receipt);
  assert.equal(s.store.finishCollection(s.project.id, S.snapshot(s.project)).ok, true);
  assert.equal(finish(s).ok, false);
  approve(s, item);
  const before = S.snapshot(s.project);
  assert.equal(finish(s).ok, true);
  const fresh = dates.list().items;
  assert.equal(S.createStore(fresh, () => s.storage).load().ok, true);
  assert.equal(fresh[0].stage, 5);
  assert.equal(fresh[0].scopeStatus, before.scopeStatus);
  assert.equal(fresh[0].customerContactName, before.customerContactName);
  assert.equal(fresh[0].scopeMemo, before.scopeMemo);
  assert.equal(fresh[0].collectionDueDate, '2026-10-23');
  assert.equal(dates.saveCollectionDeadline(s.project.id, '', '2026-10-23').ok, false);
});

test('미승인 상태와 다른 프로젝트의 승인은 이동 조건을 대신하지 않는다', () => {
  const s = setup(), other = add(s, 'energy', s.projects[0].id);
  approve(s, other, s.projects[0].id);
  assert.equal(finish(s).ok, false);
  const item = add(s);
  assert.equal(finish(s).readiness.missing[0].status, '요청');
  s.requests.recordReceipt(s.project.id, item.id, receipt);
  assert.equal(finish(s).readiness.missing[0].status, '제출됨');
  const started = s.requests.startReview(s.project.id, item.id);
  assert.equal(finish(s).readiness.missing[0].status, '검토 중');
  s.requests.saveReview(s.project.id, item.id, { checks: { period: false, scope: false, complete: false }, note: '범위 보완' }, 'revision', started.item.review);
  assert.equal(finish(s).readiness.missing[0].status, '보완 요청');
  assert.equal(s.values.has(S.STORAGE_KEY), false);
});

test('승인 후 재기록·새 요청·삭제를 클릭 시 재검사하고 복원도 반영한다', () => {
  const s = setup(), item = add(s);
  approve(s, item);
  const expected = S.snapshot(s.project);
  assert.equal(s.store.reviewStatus(s.project.id).ready, true);
  s.requests.recordReceipt(s.project.id, item.id, receipt);
  assert.equal(finish(s, expected).ok, false);
  approve(s, item);
  const pending = add(s, 'water');
  assert.equal(finish(s, expected).ok, false);
  s.requests.remove(s.project.id, pending.id);
  assert.equal(s.store.reviewStatus(s.project.id).total, 1);
  s.requests.remove(s.project.id, item.id);
  assert.equal(finish(s, expected).ok, false);
  s.requests.restore(s.project.id, item.id);
  assert.equal(finish(s, expected).ok, true);
});

test('저장 실패와 손상된 요청·범위는 단계나 원본을 바꾸지 않는다', () => {
  const s = setup(), item = add(s);
  approve(s, item);
  const requestsBefore = s.values.get(R.STORAGE_KEY), projectBefore = JSON.stringify(s.project);
  s.storage.setItem = () => { throw Error('full'); };
  assert.equal(finish(s).ok, false);
  assert.equal(JSON.stringify(s.project), projectBefore);
  assert.equal(s.values.has(S.STORAGE_KEY), false);
  assert.equal(s.values.get(R.STORAGE_KEY), requestsBefore);
  s.values.set(R.STORAGE_KEY, '{');
  assert.equal(finish(s).ok, false);
  assert.equal(s.values.get(R.STORAGE_KEY), '{');
  s.values.set(R.STORAGE_KEY, requestsBefore);
  s.values.set(S.STORAGE_KEY, '{');
  assert.equal(finish(s).ok, false);
  assert.equal(s.values.get(S.STORAGE_KEY), '{');
});

test('다른 탭의 단계 변경과 중복 실행·건너뛰기·계산 이후 범위 수정을 막는다', () => {
  const s = setup(), item = add(s), staleProjects = samples();
  approve(s, item);
  const stale = S.createStore(staleProjects, () => s.storage, null, (id) => s.requests.list(id));
  const expected = S.snapshot(s.project);
  for (const p of [s.projects[0], s.projects[4], s.projects[6], s.projects[3]]) assert.equal(s.store.finishReview(p.id, S.snapshot(p)).ok, false);
  assert.equal(finish(s).ok, true);
  const raw = s.values.get(S.STORAGE_KEY);
  assert.equal(stale.finishReview(staleProjects[2].id, expected).ok, false);
  assert.equal(finish(s).ok, false);
  assert.equal(s.store.save(s.project.id, S.snapshot(s.project), S.snapshot(s.project)).ok, false);
  assert.equal(s.values.get(S.STORAGE_KEY), raw);
});

test('기존 단계 기록은 읽기만으로 쓰지 않고 미확정·되돌린 계산 기록은 거절한다', () => {
  const s = setup(), item = add(s);
  approve(s, item);
  finish(s);
  const raw = s.values.get(S.STORAGE_KEY);
  assert.equal(S.createStore(samples(), () => s.storage).load().ok, true);
  assert.equal(s.values.get(S.STORAGE_KEY), raw);
  const data = JSON.parse(raw);
  data.records[s.project.id].scopeStatus = '협의 중';
  s.values.set(S.STORAGE_KEY, JSON.stringify(data));
  assert.equal(S.createStore(samples(), () => s.storage).load().ok, false);
  data.records[s.project.id].scopeStatus = '확정';
  data.records[s.project.id].stage = 3;
  s.values.set(S.STORAGE_KEY, JSON.stringify(data));
  assert.equal(S.createStore(samples(), () => s.storage).load().ok, false);
});
