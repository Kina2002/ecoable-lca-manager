const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'data.js', 'requests.js', 'projects.js', 'deadlines.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
}
const { projects: P, deadlines: D } = context.LCA;
const today = '2026-10-17';
const draft = { companyName: '시험소재', productName: '가상 제품', purpose: '고객사 요구 대응', targetDate: '2026-12-01' };
function setup(initial = {}) {
  const values = new Map(Object.entries(initial));
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const samples = context.LCA.data.createSampleProjects(today);
  return { values, storage, samples, store: P.createStore(samples, today, () => storage) };
}

test('요청이 없어도 별도 수집 마감일을 계산하고 프로젝트 목표일과 구분한다', async () => {
  const { store } = setup();
  const project = store.list().items[0];
  assert.equal(D.collection(project, today).text, 'D-7');
  assert.equal(D.project(project, today).text, 'D-45');
  assert.equal(D.summary(project.id, [], today).text, '요청 없음');
  assert.equal(D.collection(project, '2026-10-25').text, 'D+1');
});

test('계약·범위와 기존 수집 기록의 미지정 날짜는 미정이며 지정하면 D-day다', async () => {
  for (const stage of [1, 2, 3]) {
    assert.equal(D.collection({ stage }, today).text, '미정');
    assert.equal(D.collection({ stage, collectionDueDate: today }, today).text, 'D-0');
  }
  assert.equal(D.collection({ stage: 3, collectionDueDate: '2026-02-30' }, today).text, '기한 확인 필요');
});

test('수집 단계는 승인 건수와 무관하게 날짜를 세며 검토 이후에는 수집 완료다', async () => {
  const project = { id: 'p', stage: 3, collectionDueDate: '2026-10-16' };
  assert.equal(D.summary('p', [{ projectId: 'p', status: '승인' }], today).text, '자료 검토 완료');
  assert.equal(D.collection(project, today).text, 'D+1');
  for (const stage of [4, 5, 8, 10]) {
    const complete = D.collection({ ...project, stage }, today);
    assert.equal(D.refresh(complete, '2030-01-01').text, '자료 수집 완료');
  }
});

test('기존 저장본을 읽기만 하며 수집 날짜 저장·새로고침·미정 복원을 지원한다', async () => {
  const { store, storage, values, samples } = setup();
  const created = (await store.add(draft)).item;
  const legacy = values.get(P.STORAGE_KEY);
  assert.equal(store.list().ok, true);
  assert.equal(values.get(P.STORAGE_KEY), legacy);
  assert.equal((await store.saveCollectionDeadline(created.id, '2026-10-22', '')).ok, true);
  const restored = P.createStore(samples, today, () => storage);
  assert.equal(restored.list().items.find((p) => p.id === created.id).collectionDueDate, '2026-10-22');
  assert.equal((await restored.saveCollectionDeadline(created.id, '', '2026-10-22')).ok, true);
  assert.equal(D.collection(restored.list().items.find((p) => p.id === created.id), today).text, '미정');
  assert.equal(JSON.parse(values.get(P.STORAGE_KEY)).projects[0].targetDate, draft.targetDate);
});

test('샘플 날짜 수정 후 새 프로젝트를 등록해도 날짜와 다른 저장소를 보존한다', async () => {
  const { store, values } = setup({ 'ecoable-lca-manager.requests.v1': '요청 원본', 'ecoable-lca-manager.scope.v1': '범위 원본' });
  assert.equal((await store.saveCollectionDeadline('project-001', '2026-10-23', '2026-10-24')).ok, true);
  assert.equal((await store.add(draft)).items[0].collectionDueDate, '2026-10-23');
  assert.equal(values.get('ecoable-lca-manager.requests.v1'), '요청 원본');
  assert.equal(values.get('ecoable-lca-manager.scope.v1'), '범위 원본');
  assert.equal((await store.saveCollectionDeadline('project-001', '', '2026-10-23')).ok, true);
  assert.equal(store.list().items[0].collectionDueDate, '');
});

test('다른 탭의 변경·없는 프로젝트·완료 단계·날짜 오류를 덮어쓰지 않는다', async () => {
  const { store, values } = setup();
  assert.equal((await store.saveCollectionDeadline('project-001', '2026-10-22', '2026-10-24')).ok, true);
  const saved = values.get(P.STORAGE_KEY);
  for (const [id, date, expected] of [
    ['project-001', '', '2026-10-24'], ['missing', today, ''],
    ['project-002', today, ''], ['project-005', '2026-02-30', '']
  ]) assert.equal((await store.saveCollectionDeadline(id, date, expected)).ok, false);
  assert.equal(values.get(P.STORAGE_KEY), saved);
});

test('손상된 날짜 저장본이나 저장 실패는 성공으로 표시하거나 원본을 덮지 않는다', async () => {
  const { store, values, storage } = setup();
  (await store.add(draft));
  const data = JSON.parse(values.get(P.STORAGE_KEY));
  data.collectionDueDates = { 'project-001': '2026-02-30' };
  const corrupted = JSON.stringify(data);
  values.set(P.STORAGE_KEY, corrupted);
  assert.equal(store.list().ok, false);
  assert.equal((await store.saveCollectionDeadline('project-001', today, '2026-10-24')).ok, false);
  assert.equal(values.get(P.STORAGE_KEY), corrupted);
  delete data.collectionDueDates;
  values.set(P.STORAGE_KEY, JSON.stringify(data));
  storage.setItem = () => { throw Error('full'); };
  assert.equal((await store.saveCollectionDeadline('project-001', today, '2026-10-24')).ok, false);
  assert.equal(store.list().items[0].collectionDueDate, '2026-10-24');
});
