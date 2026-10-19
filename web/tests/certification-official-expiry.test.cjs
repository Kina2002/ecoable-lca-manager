const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'requests.js', 'review-workflow.js', 'certification.js', 'tasks.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
}
const { LCA } = context;
LCA.report = { validate: () => ({}), validSource: () => true };
LCA.reportHistory = { validate: () => ({}) };
LCA.reviewRoute = { validEvidence: () => true };
const report = { projectId: 'p', revision: 1, source: {}, sourceKey: '{}', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', change: {} };
const details = { kind: '인증', organization: '기관', scheme: '환경성적표지', submittedOn: '2026-10-01', registrationNumber: '2026-0001', issuedOn: '2026-10-19', note: '' };
const events = [
  { type: 'completed', actor: '연구원', reason: '확인', at: '2026-10-01T00:00:00.000Z', completedOn: '2026-10-01', documentName: '결과.pdf', report, reviewMethod: 'internal', verification: null, reviewRoute: {} },
  { type: 'started', actor: '연구원', reason: '시작', at: '2026-10-02T00:00:00.000Z', status: '제출 준비', details: { ...details, submittedOn: '', registrationNumber: '', issuedOn: '' } },
  { type: 'updated', actor: '연구원', reason: '제출', at: '2026-10-03T00:00:00.000Z', status: '제출 완료', details: { ...details, registrationNumber: '', issuedOn: '' } },
  { type: 'updated', actor: '연구원', reason: '승인', at: '2026-10-20T00:00:00.000Z', status: '승인·등록', details },
  { type: 'finished', actor: '연구원', reason: '완료', at: '2026-10-20T00:00:00.000Z', finishedOn: '2026-10-20', confirmed: true, reportRevision: 1, details }
];
const project = { id: 'p', stage: 10 };
function setup() {
  const values = new Map([[LCA.certification.STORAGE_KEY, JSON.stringify({ version: 1, records: { p: { revision: events.length, events } } })]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = LCA.certification.createStore([project], () => ({ ok: true, project }), () => ({ ok: true, record: report, ready: true }),
    () => ({ ok: true, warning: '', record: null }), () => storage);
  return { store, values };
}

test('완료 프로젝트에서 문서 만료일을 기록하면 갱신 안내가 공식 날짜를 사용한다', async () => {
  const { store } = setup();
  assert.equal(store.load('p').canRecordValidity, true, JSON.stringify(store.load('p')));
  const result = await store.save('p', 'validity', { actor: '연구원', reason: '인증서 확인', expiryOn: '2030-01-31', documentName: '인증서.pdf', confirmed: true }, 5);
  assert.equal(result.ok, true, result.error);
  const loaded = store.load('p');
  assert.equal(loaded.validity.expiryOn, '2030-01-31');
  assert.equal(loaded.finished.type, 'finished');
  const snapshot = store.renewalSnapshot();
  assert.equal(snapshot.items[0].officialExpiryOn, '2030-01-31');
  const schedule = LCA.certification.renewalSchedule(details, '승인·등록', '2029-07-31', snapshot.items[0].officialExpiryOn);
  assert.equal(schedule.official, true);
  assert.equal(schedule.startDate, '2029-07-31');
  assert.equal(schedule.active, true);
  const tasks = LCA.tasks.build({ projects: [project], requests: { ok: true, items: [] }, comments: { ok: true, items: [] }, verifications: {}, certifications: snapshot }, '2029-07-31');
  assert.equal(tasks.items[0].date, '2030-01-31');
  assert.equal(LCA.tasks.deadline(tasks.items[0]).label, '기록한 만료일');
});

test('잘못된 만료일·미확인 문서·오래된 화면은 기존 기록을 바꾸지 않는다', async () => {
  const { store, values } = setup();
  const original = values.get(LCA.certification.STORAGE_KEY);
  const draft = { actor: '연구원', reason: '확인', expiryOn: '2026-10-18', documentName: '인증서.pdf', confirmed: true };
  assert.equal((await store.save('p', 'validity', draft, 5)).ok, false);
  assert.equal((await store.save('p', 'validity', { ...draft, expiryOn: '2030-01-31', documentName: '' }, 5)).ok, false);
  assert.equal((await store.save('p', 'validity', { ...draft, expiryOn: '2030-01-31' }, 4)).ok, false);
  assert.equal(values.get(LCA.certification.STORAGE_KEY), original);
  const corrupted = JSON.parse(original);
  corrupted.records.p.events.push({ type: 'validity', actor: '연구원', reason: '확인', at: '2026-10-21T00:00:00.000Z',
    expiryOn: '2026-10-18', documentName: '인증서.pdf', issuedOn: details.issuedOn, scheme: details.scheme, registrationNumber: details.registrationNumber });
  corrupted.records.p.revision++;
  values.set(LCA.certification.STORAGE_KEY, JSON.stringify(corrupted));
  assert.equal(store.load('p').ok, false);
  assert.equal(store.renewalSnapshot().ok, false);
});
