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
function setup(changes = {}) {
  const savedEvents = JSON.parse(JSON.stringify(events));
  for (const event of savedEvents) if (event.details) Object.assign(event.details, changes);
  const values = new Map([[LCA.certification.STORAGE_KEY, JSON.stringify({ version: 1, records: { p: { revision: savedEvents.length, events: savedEvents } } })]]);
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

test('International EPD 버전 기준으로 점검 중·완료를 보관하고 다음 미완료 연도로 이동한다', async () => {
  const originalToday = LCA.rules.today; LCA.rules.today = () => '2028-10-01';
  try {
    const { store } = setup({ kind: '등록', scheme: 'International EPD' });
    let result = await store.save('p', 'inspection-plan', { actor: '연구원', reason: '최신 EPD 확인', version: ':001', versionOn: '2026-10-01', documentName: 'EPD.pdf' }, 5);
    assert.equal(result.ok, true, result.error);
    let loaded = store.load('p');
    let schedule = LCA.certification.inspectionSchedule(loaded.process.details, loaded.process.status, loaded.inspectionPlan, loaded.inspections, '2027-08-31');
    assert.equal(schedule.active, false);
    schedule = LCA.certification.inspectionSchedule(loaded.process.details, loaded.process.status, loaded.inspectionPlan, loaded.inspections, '2027-09-01');
    assert.equal(schedule.date, '2027-10-01'); assert.equal(schedule.active, true);
    const draft = { actor: '연구원', reason: '생산 조건 변경 여부를 검토 중', dueOn: '2027-10-01', checkedOn: '2027-10-01', documentName: '점검.xlsx', status: '점검 중', version: ':001', versionOn: '2026-10-01' };
    result = await store.save('p', 'inspection', draft, 6); assert.equal(result.ok, true, result.error);
    loaded = store.load('p'); assert.equal(loaded.inspections.at(-1).status, '점검 중');
    assert.equal((await store.save('p', 'inspection', { ...draft, status: '점검 완료' }, 7)).ok, false);
    result = await store.save('p', 'inspection', { ...draft, status: '점검 완료', confirmed: true, reason: '변경 없음. 기존 정보의 유효성을 확인함' }, 7);
    assert.equal(result.ok, true, result.error);
    const snapshot = store.renewalSnapshot();
    schedule = LCA.certification.inspectionSchedule(snapshot.items[0].details, snapshot.items[0].status, snapshot.items[0].inspectionPlan, snapshot.items[0].inspections, '2028-09-01');
    assert.equal(schedule.date, '2028-10-01');
    const tasks = LCA.tasks.build({ projects: [project], requests: { ok: true, items: [] }, comments: { ok: true, items: [] }, verifications: {}, certifications: snapshot }, '2028-09-01');
    assert.equal(tasks.items.find((item) => item.kind === 'inspection').date, '2028-10-01');
    assert.equal(store.currentStage('p').stage, 10);
    result = await store.save('p', 'renewed', { actor: '연구원', reason: '갱신 문서 확인', actionOn: '2028-10-01', documentName: '새EPD.pdf',
      submittedOn: '2028-09-01', issuedOn: '2028-10-01', registrationNumber: 'EPD-NEW', expiryOn: '2033-10-01', confirmed: true }, 8);
    assert.equal(result.ok, true, result.error);
    loaded = store.load('p'); assert.equal(loaded.inspectionPlan, null); assert.equal(loaded.inspections.length, 0);
    assert.equal(loaded.record.events.filter((event) => event.type === 'inspection').length, 2);
    const renewedTasks = LCA.tasks.build({ projects: [project], requests: { ok: true, items: [] }, comments: { ok: true, items: [] }, verifications: {}, certifications: store.renewalSnapshot() }, '2028-10-01');
    assert.equal(renewedTasks.items.filter((item) => item.kind === 'renewal').length, 0);
    assert.match(renewedTasks.items.find((item) => item.kind === 'inspection').title, /기준일/);
  } finally { LCA.rules.today = originalToday; }
});

test('점검 기록은 미래 날짜·다른 버전·없는 점검 차례를 거절한다', async () => {
  const originalToday = LCA.rules.today; LCA.rules.today = () => '2028-10-01';
  try {
    const { store, values } = setup({ kind: '등록', scheme: 'International EPD' });
    await store.save('p', 'inspection-plan', { actor: '연구원', reason: '확인', version: ':001', versionOn: '2026-10-01', documentName: 'EPD.pdf' }, 5);
    const original = values.get(LCA.certification.STORAGE_KEY);
    const draft = { actor: '연구원', reason: '확인', dueOn: '2027-10-01', checkedOn: '2027-10-01', documentName: '점검.xlsx', status: '점검 완료', confirmed: true, version: ':001', versionOn: '2026-10-01' };
    for (const changes of [{ checkedOn: '2028-10-02' }, { version: ':002' }, { dueOn: '2027-11-01' }, { checkedOn: '2027-08-31' }]) {
      assert.equal((await store.save('p', 'inspection', { ...draft, ...changes }, 6)).ok, false);
      assert.equal(values.get(LCA.certification.STORAGE_KEY), original);
    }
  } finally { LCA.rules.today = originalToday; }
});

test('갱신 준비·요청은 할 일을 유지하고 공식 갱신 완료 뒤 새 만료일로 전환한다', async () => {
  const originalToday = LCA.rules.today; LCA.rules.today = () => '2029-10-20';
  try {
    const { store } = setup();
    const before = store.load('p');
    const draft = { actor: '연구원', reason: '갱신 자료 신청', actionOn: '2029-10-20', documentName: '갱신접수.pdf', status: '갱신 요청' };
    let result = await store.save('p', 'renewal-progress', draft, 5); assert.equal(result.ok, true, result.error);
    const input = () => ({ projects: [project], requests: { ok: true, items: [] }, comments: { ok: true, items: [] }, verifications: {}, certifications: store.renewalSnapshot() });
    assert.equal(LCA.tasks.build(input(), '2029-10-20').items[0].status, '갱신 요청');
    result = await store.save('p', 'renewed', { ...draft, reason: '새 인증서 발급 확인', submittedOn: '2029-09-01', issuedOn: '2029-10-19',
      registrationNumber: '2029-0002', expiryOn: '2032-10-18', confirmed: true }, 6);
    assert.equal(result.ok, true, result.error);
    const loaded = store.load('p');
    assert.equal(loaded.process.details.registrationNumber, '2029-0002');
    assert.equal(loaded.validity.expiryOn, '2032-10-18');
    assert.equal(loaded.renewalProgress, null);
    assert.equal(JSON.stringify(loaded.finished), JSON.stringify(before.finished));
    assert.equal(store.currentStage('p').stage, 10);
    assert.equal(LCA.tasks.build(input(), '2029-10-20').items.filter((item) => item.kind === 'renewal').length, 0);
    assert.equal(LCA.tasks.build(input(), '2032-04-18').items.find((item) => item.kind === 'renewal').date, '2032-10-18');
  } finally { LCA.rules.today = originalToday; }
});

test('새 발급일·만료일·기관 확인이 없는 갱신 완료는 기존 인증을 바꾸지 않는다', async () => {
  const originalToday = LCA.rules.today; LCA.rules.today = () => '2029-10-20';
  try {
    const { store, values } = setup();
    const original = values.get(LCA.certification.STORAGE_KEY);
    const draft = { actor: '연구원', reason: '갱신 확인', actionOn: '2029-10-20', documentName: '새인증서.pdf', submittedOn: '2029-09-01',
      issuedOn: '2029-10-19', registrationNumber: '2029-0002', expiryOn: '2032-10-18', confirmed: true };
    for (const changes of [{ issuedOn: '2026-10-19' }, { expiryOn: '2029-10-18' }, { confirmed: false }, { registrationNumber: '' }]) {
      assert.equal((await store.save('p', 'renewed', { ...draft, ...changes }, 5)).ok, false);
      assert.equal(values.get(LCA.certification.STORAGE_KEY), original);
    }
    const customer = setup({ kind: '고객 제출' });
    assert.equal((await customer.store.save('p', 'renewed', draft, 5)).ok, false);
  } finally { LCA.rules.today = originalToday; }
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
