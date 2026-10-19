const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const context = vm.createContext({ crypto: webcrypto, navigator: {}, Blob }); vm.runInContext('window = globalThis;', context);
for (const file of ['constants', 'rules', 'data', 'received-data', 'review', 'message-history', 'requests', 'projects', 'researchers', 'scope',
  'modelling', 'interpretation', 'report-history', 'report', 'review-workflow', 'customer-review', 'verification', 'review-route', 'certification', 'storage', 'backup', 'project-deletion']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), context, { filename: file });
}
const { LCA } = context;
function memory() {
  const values = new Map(); return { values, get length() { return values.size; }, key: (index) => [...values.keys()][index],
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}
const message = (changes = {}) => ({ projectId: 'a', companyName: '가상 회사', productName: '제품', type: 'initial', channel: '메일', recipient: '가상 담당자',
  actor: '가상 연구원', title: '자료 요청', body: '전력 자료를 요청합니다.', targets: ['DRQ-0001'], sentAt: '2026-01-01T01:00:00.000Z', basisChanged: false, token: 'message-token-001', confirmed: true, ...changes });
function setup() {
  const storage = memory(); const store = LCA.requests.createStore(['a', 'b'], () => storage);
  store.add('a', { categoryKey: 'energy', detail: '전력', dueDate: '2026-10-23' }); return { storage, store };
}
test('발송 사본을 저장·재읽기해도 요청 상태와 값은 바뀌지 않는다', async () => {
  const { storage, store } = setup(); const before = JSON.stringify(store.list('a').items);
  assert.equal(store.messages('a').items.length, 0);
  const result = await store.recordMessage('a', message(), 1); assert.equal(result.ok, true, result.message);
  const reloaded = LCA.requests.createStore(['a', 'b'], () => storage);
  assert.equal(reloaded.messages('a').items[0].body, message().body); assert.equal(reloaded.messages('b').items.length, 0);
  assert.equal(JSON.stringify(reloaded.list('a').items), before);
  assert.equal((await reloaded.recordMessage('a', message(), 2)).ok, false);
  reloaded.remove('a', 'DRQ-0001');
  assert.equal(reloaded.messages('a').items[0].title, '자료 요청');
  assert.equal((await reloaded.recordMessage('a', message({ token: 'message-token-002', basisChanged: true }), 2)).ok, true);
});
test('미래 시각·확인 누락·다른 프로젝트·입력 필요 표시는 기록하지 않는다', async () => {
  const { store, storage } = setup(); const before = storage.getItem(LCA.requests.STORAGE_KEY);
  for (const changes of [{ sentAt: '9999-01-01T00:00:00.000Z' }, { confirmed: false }, { projectId: 'b' }, { title: '[입력 필요: 이름]' }]) {
    assert.equal((await store.recordMessage('a', message(changes), 1)).ok, false);
    assert.equal(storage.getItem(LCA.requests.STORAGE_KEY), before);
  }
  assert.equal(LCA.messageHistory.sentTime('2026-10-19', '09:30'), '2026-10-19T00:30:00.000Z');
  assert.equal(LCA.messageHistory.sentTime('2026-02-30', '09:30'), null);
});
test('손상 발송 이력은 읽기 실패로 알리고 원문을 보존한다', async () => {
  const { store, storage } = setup(); await store.recordMessage('a', message(), 1);
  const data = JSON.parse(storage.getItem(LCA.requests.STORAGE_KEY)); data.messageLog.items[0].projectId = 'missing';
  const raw = JSON.stringify(data); storage.setItem(LCA.requests.STORAGE_KEY, raw);
  assert.equal(store.messages('a').ok, false); assert.equal(store.listAll().ok, false);
  assert.equal((await store.recordMessage('a', message({ token: 'message-token-002' }), 2)).ok, false);
  assert.equal(storage.getItem(LCA.requests.STORAGE_KEY), raw);
});
test('기존 백업 키로 발송 기록을 검증하고 프로젝트 삭제 계획은 해당 기록만 제거한다', async () => {
  const storage = memory(); context.localStorage = storage; await LCA.storage.bootstrap();
  const date = '2026-10-19'; const samples = LCA.data.createSampleProjects(date);
  const projects = LCA.projects.createStore(samples, date, () => storage);
  const created = await projects.add({ companyName: '가상 신규', productName: '가상 제품', purpose: '고객사 요구 대응', targetDate: '2026-12-01' });
  const ids = created.items.map((item) => item.id); const store = LCA.requests.createStore(ids, () => storage);
  store.add(created.item.id, { categoryKey: 'energy', detail: '전력', dueDate: '2026-10-23' });
  await store.recordMessage(created.item.id, message({ projectId: created.item.id }), 1);
  await store.recordMessage(samples[0].id, message({ projectId: samples[0].id, type: 'info', targets: ['customerContactName'], token: 'message-token-002' }), 2);
  const snapshot = LCA.backup.create(date); assert.equal(snapshot.summary.messages, 2);
  assert.equal(LCA.backup.parse(snapshot.content).summary.messages, 2);
  const plan = LCA.projectDeletion.prepare(created.item.id, date); assert.equal(plan.counts.messages, 1);
  const after = JSON.parse(plan.values[LCA.requests.STORAGE_KEY]);
  assert.equal(after.messageLog.items.length, 1); assert.equal(after.messageLog.items[0].projectId, samples[0].id);
  assert.equal(store.messages(created.item.id).items.length, 1);
});
