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
const { scope: S, requests: R, projects: P, deadlines: D } = context.LCA;
const day = '2026-10-17';
const samples = () => context.LCA.data.createSampleProjects(day);
const receipt = { kind: 'quantity', value: '12000', unit: 'kWh', density: '', description: '', periodStart: '2025-01-01', periodEnd: '2025-12-31', evidenceFileName: '가상전력.xlsx' };
function setup() {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const projects = samples();
  const requests = R.createStore(projects.map((p) => p.id), () => storage);
  const store = S.createStore(projects, () => storage, null, (id) => requests.list(id));
  return { values, storage, projects, requests, store, project: projects[0] };
}
function request(s, projectId = s.project.id, categoryKey = 'energy') {
  return s.requests.add(projectId, { categoryKey, detail: '흐름 확인용 가상 자료', dueDate: '2026-10-20' }).item;
}
function finish(s, expected = S.snapshot(s.project)) { return s.store.finishCollection(s.project.id, expected); }

test('제출됨·검토 중·승인은 제출 확인에 포함하고 요청·보완·빈 기록은 제외한다', async () => {
  for (const status of ['요청', '제출됨', '검토 중', '보완 요청', '승인']) {
    const result = S.collectionReadiness('p', { ok: true, items: [{ projectId: 'p', status, receipt: {} }] });
    assert.equal(result.ready, ['제출됨', '검토 중', '승인'].includes(status));
  }
  assert.equal(S.collectionReadiness('p', { ok: true, items: [] }).ready, false);
  assert.equal(S.collectionReadiness('p', { ok: true, items: [{ projectId: 'p', status: '제출됨' }] }).ready, false);
  assert.equal(S.collectionReadiness('p', { ok: false, message: '읽기 실패' }).error, '읽기 실패');
});

test('원래 수집 단계 샘플을 검토로 이동하고 숫자 기준량을 보존해 재로딩한다', async () => {
  const s = setup(), item = request(s);
  s.requests.recordReceipt(s.project.id, item.id, receipt);
  const requestsBefore = s.values.get(R.STORAGE_KEY);
  assert.equal(D.collection(s.project, day).text, 'D-7');
  assert.equal(s.project.stage, 3);
  assert.equal(finish(s).ok, true);
  assert.equal(s.project.stage, 4);
  assert.equal(D.collection(s.project, day).text, '자료 수집 완료');
  assert.equal(s.values.get(R.STORAGE_KEY), requestsBefore);
  assert.equal(s.requests.list(s.project.id).items[0].status, '제출됨');
  const fresh = samples(), restored = S.createStore(fresh, () => s.storage);
  assert.equal(restored.load().ok, true);
  assert.equal(fresh[0].stage, 4);
  assert.equal(Number(fresh[0].functionalUnit.qty), 1);
  assert.equal(context.LCA.rules.stageCounts(fresh)[3], 0);
  assert.equal(context.LCA.rules.stageCounts(fresh)[4], 2);
});

test('신규 등록→담당자→범위→수집→검토를 복원하며 다른 기록과 마감일을 보존한다', async () => {
  const s = setup();
  const registry = P.createStore(samples(), day, () => s.storage);
  const created = (await registry.add({ companyName: '흐름확인', productName: '가상 제품', purpose: '고객사 요구 대응', targetDate: '2026-12-01' }));
  const project = created.items.at(-1);
  const requests = R.createStore(created.items.map((p) => p.id), () => s.storage);
  const store = S.createStore(created.items, () => s.storage, null, (id) => requests.list(id));
  store.saveAssignees(project.id, { customerContactName: '가상고객', researcherName: '가상연구원' }, S.snapshot(project));
  store.startScope(project.id, S.snapshot(project));
  store.save(project.id, { ...S.snapshot(project), scopeStatus: '확정', functionalUnit: { qty: '1', unit: 'kg' }, boundary: '요람~문', refStart: '2025-01-01', refEnd: '2025-12-31', standards: ['ISO 14040/44'], scopeMemo: '합의 기록' }, S.snapshot(project));
  store.start(project.id, S.snapshot(project));
  (await registry.saveCollectionDeadline(project.id, '2026-10-25', ''));
  const item = requests.add(project.id, { categoryKey: 'energy', detail: '전력', dueDate: '2026-10-20' }).item;
  requests.recordReceipt(project.id, item.id, receipt);
  const other = requests.add(s.projects[4].id, { categoryKey: 'energy', detail: '다른 프로젝트 자료', dueDate: '2026-10-20' }).item;
  const requestsBefore = s.values.get(R.STORAGE_KEY);
  assert.equal(store.finishCollection(project.id, S.snapshot(project)).ok, true);
  const fresh = registry.list().items;
  assert.equal(S.createStore(fresh, () => s.storage).load().ok, true);
  const restored = fresh.find((p) => p.id === project.id);
  assert.equal(restored.stage, 4);
  assert.equal(restored.scopeMemo, '합의 기록');
  assert.equal(restored.customerContactName, '가상고객');
  assert.equal(restored.collectionDueDate, '2026-10-25');
  assert.equal(s.values.get(R.STORAGE_KEY), requestsBefore);
  assert.equal(requests.list(s.projects[4].id).items[0].id, other.id);
});

test('0건·다른 프로젝트·삭제된 요청만으로는 수집을 완료하지 않는다', async () => {
  const s = setup();
  assert.equal(finish(s).ok, false);
  const other = request(s, s.projects[4].id);
  s.requests.recordReceipt(s.projects[4].id, other.id, receipt);
  assert.equal(finish(s).ok, false);
  const item = request(s);
  s.requests.recordReceipt(s.project.id, item.id, receipt);
  s.requests.remove(s.project.id, item.id);
  assert.equal(finish(s).ok, false);
  assert.equal(s.values.has(S.STORAGE_KEY), false);
  s.requests.restore(s.project.id, item.id);
  assert.equal(finish(s).ok, true);
});

test('버튼 표시 후 새 요청이나 보완 상태가 생기면 클릭 시 최신 기록으로 거절한다', async () => {
  const s = setup(), item = request(s);
  s.requests.recordReceipt(s.project.id, item.id, receipt);
  const expected = S.snapshot(s.project);
  assert.equal(s.store.collectionStatus(s.project.id).ready, true);
  const later = request(s, s.project.id, 'water');
  assert.equal(finish(s, expected).ok, false);
  s.requests.recordReceipt(s.project.id, later.id, { ...receipt, unit: 'm³', density: '1000' });
  const started = s.requests.startReview(s.project.id, item.id);
  s.requests.saveReview(s.project.id, item.id, { checks: { period: false, scope: false, complete: false }, note: '기간 보완 필요' }, 'revision', started.item.review);
  const blocked = finish(s, expected);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.readiness.missing[0].status, '보완 요청');
  s.requests.recordReceipt(s.project.id, item.id, receipt);
  assert.equal(finish(s, expected).ok, true);
});

test('범위 저장 실패는 단계·자료·기존 범위 저장본을 바꾸지 않는다', async () => {
  const s = setup(), item = request(s);
  s.requests.recordReceipt(s.project.id, item.id, receipt);
  const before = JSON.stringify(s.project), raw = s.values.get(S.STORAGE_KEY), requestRaw = s.values.get(R.STORAGE_KEY);
  s.storage.setItem = () => { throw Error('quota'); };
  assert.equal(finish(s).ok, false);
  assert.equal(JSON.stringify(s.project), before);
  assert.equal(s.values.get(S.STORAGE_KEY), raw);
  assert.equal(s.values.get(R.STORAGE_KEY), requestRaw);
});

test('계약·범위·검토에서 건너뛰기와 재실행을 거절하며 수집 이후 범위는 잠근다', async () => {
  const s = setup(), item = request(s);
  s.requests.recordReceipt(s.project.id, item.id, receipt);
  for (const p of [s.projects[4], s.projects[6], s.projects[2]]) assert.equal(s.store.finishCollection(p.id, S.snapshot(p)).ok, false);
  const expected = S.snapshot(s.project);
  assert.equal(finish(s, expected).ok, true);
  const raw = s.values.get(S.STORAGE_KEY);
  assert.equal(finish(s, expected).ok, false);
  assert.equal(finish(s).ok, false);
  assert.equal(s.store.save(s.project.id, S.snapshot(s.project), S.snapshot(s.project)).ok, false);
  assert.equal(s.values.get(S.STORAGE_KEY), raw);
});

test('다른 탭의 단계 변경·손상 저장소·확인 불가 요청을 덮어쓰지 않는다', async () => {
  const s = setup(), item = request(s), oldProject = samples();
  s.requests.recordReceipt(s.project.id, item.id, receipt);
  const oldStore = S.createStore(oldProject, () => s.storage, null, (id) => s.requests.list(id));
  assert.equal(finish(s).ok, true);
  const saved = s.values.get(S.STORAGE_KEY);
  assert.equal(oldStore.finishCollection(oldProject[0].id, S.snapshot(oldProject[0])).ok, false);
  assert.equal(s.values.get(S.STORAGE_KEY), saved);
  const corrupt = setup(), pending = request(corrupt);
  corrupt.requests.recordReceipt(corrupt.project.id, pending.id, receipt);
  corrupt.values.set(R.STORAGE_KEY, '{');
  assert.equal(finish(corrupt).ok, false);
  assert.equal(corrupt.values.get(R.STORAGE_KEY), '{');
  assert.equal(corrupt.values.has(S.STORAGE_KEY), false);
  corrupt.values.set(S.STORAGE_KEY, '{');
  assert.equal(finish(corrupt).ok, false);
  assert.equal(corrupt.values.get(S.STORAGE_KEY), '{');
});

test('단계 이동 뒤 다른 탭에서 수집 마감일을 저장하려 하면 거절한다', async () => {
  const s = setup(), item = request(s);
  s.requests.recordReceipt(s.project.id, item.id, receipt);
  const dates = P.createStore(samples(), day, () => s.storage, (id) => s.store.currentStage(id));
  const expected = dates.list().items[0].collectionDueDate;
  assert.equal(finish(s).ok, true);
  assert.equal((await dates.saveCollectionDeadline(s.project.id, '2026-10-29', expected)).ok, false);
  s.values.set(S.STORAGE_KEY, '{');
  assert.equal((await dates.saveCollectionDeadline(s.project.id, '2026-10-29', expected)).ok, false);
  assert.equal(s.values.has(P.STORAGE_KEY), false);
});

test('이미 검토 중·승인된 자료도 인정하며 이동은 자료 검토 기록을 변경하지 않는다', async () => {
  const s = setup(), item = request(s), other = request(s, s.project.id, 'water');
  for (const record of [item, other]) s.requests.recordReceipt(s.project.id, record.id, receipt);
  const started = s.requests.startReview(s.project.id, item.id);
  s.requests.saveReview(s.project.id, item.id, { checks: { period: true, scope: true, complete: true }, note: '확인함' }, 'approve', started.item.review);
  s.requests.startReview(s.project.id, other.id);
  const before = s.values.get(R.STORAGE_KEY);
  assert.equal(finish(s).ok, true);
  assert.equal(s.values.get(R.STORAGE_KEY), before);
  const fresh = samples();
  const data = JSON.parse(s.values.get(S.STORAGE_KEY));
  data.records[s.project.id].scopeStatus = '협의 중';
  s.values.set(S.STORAGE_KEY, JSON.stringify(data));
  assert.equal(S.createStore(fresh, () => s.storage).load().ok, false);
});
