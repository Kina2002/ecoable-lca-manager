const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const context = vm.createContext({}); vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'received-data.js', 'review.js', 'requests.js', 'request-message.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
const M = context.LCA.requestMessage;
const project = () => ({ id: 'project-a', stage: 3, companyName: '푸른소재', productName: '재생 칩', customerContactName: '김민서', researcherId: 'researcher-sample-1', researcherName: '김하늘', refStart: '2025-01-01', refEnd: '2025-12-31' });
const item = (id = 'DRQ-0001', status = '요청', changes = {}) => ({ id, projectId: 'project-a', categoryKey: 'energy', detail: '전력 사용량과 고지서', dueDate: '2026-10-25', status, ...changes });
const state = (items = [item()]) => ({ ok: true, canGenerate: true, project: project(), sender: { id: 'researcher-sample-1', name: '김하늘', company: '새움환경컨설팅', department: '제품환경팀' }, items });
const build = (s = state(), kind = 'initial', ids = ['DRQ-0001']) => M.build(s, kind, ids);
const plain = (v) => JSON.parse(JSON.stringify(v));

for (const kind of ['initial', 'reminder']) test(`${kind}: 요청·미수신만 고르고 제출/검토/보완/승인/삭제/다른 프로젝트는 제외`, () => {
  const source = state([item(), item('DRQ-0002', '제출됨'), item('DRQ-0003', '검토 중'), item('DRQ-0004', '보완 요청'), item('DRQ-0005', '승인'), item('DRQ-0006', '요청', { deletedAt: '2026-10-18' }), item('DRQ-0007', '요청', { projectId: 'other' }), item('DRQ-0008', '요청', { receipt: {} })]);
  assert.deepEqual(plain(M.candidates(source, kind).items.map((v) => v.id)), ['DRQ-0001']);
});
test('보완은 보완 요청만 고르고 사유와 기존 기한을 구분한다', () => {
  const source = state([item(), item('DRQ-0002', '보완 요청', { review: { note: '7~12월 자료가 빠졌어요.' } }), item('DRQ-0003', '승인')]);
  const result = build(source, 'revision', ['DRQ-0002']);
  assert.equal(result.ok, true); assert.match(result.body, /7~12월 자료가 빠졌어요/); assert.match(result.body, /기존 제출 기한: 2026.10.25 \(보완 기한은 별도 협의\)/);
  assert.doesNotMatch(result.body, /DRQ-0001|DRQ-0003|2026.10.18/);
});
for (const [kind, prefix] of [['initial', 'LCA 자료 요청'], ['reminder', '자료 제출 확인 요청'], ['revision', '자료 보완 요청']]) test(`${kind}: 회사·제품·담당자·기간·서명과 제목을 채운다`, () => {
  const source = state([item('DRQ-0001', kind === 'revision' ? '보완 요청' : '요청', { review: { note: '누락 자료 확인' } })]);
  const result = build(source, kind);
  assert.equal(result.title, `[${prefix}] 푸른소재 재생 칩 평가`);
  for (const value of ['김민서 담당자님', '푸른소재', '재생 칩', '2025.01.01~2025.12.31', '담당 연구원 김하늘', 'DRQ-0001', '전력 사용량과 고지서']) assert.ok(result.body.includes(value), value);
  assert.equal(result.warnings.length, 0); assert.match(result.body, /새움환경컨설팅 제품환경팀 김하늘입니다\./);
});
test('같은 기한은 공통으로 한 번 표시한다', () => {
  const result = build(state([item(), item('DRQ-0002')]), 'initial', ['DRQ-0001', 'DRQ-0002']);
  assert.equal((result.body.match(/제출 기한:/g) || []).length, 1);
});
test('서로 다른 기한은 자료별로 표시한다', () => {
  const result = build(state([item(), item('DRQ-0002', '요청', { dueDate: '2026-10-28' })]), 'reminder', ['DRQ-0001', 'DRQ-0002']);
  assert.equal((result.body.match(/제출 기한:/g) || []).length, 2); assert.match(result.body, /2026.10.25/); assert.match(result.body, /2026.10.28/);
  assert.match(result.body, /이미 보내주셨다면/); assert.doesNotMatch(result.body, /기한이 지났|연체/);
});
test('선택한 자료만 넣고 선택 순서와 무관하게 안정적으로 정렬한다', () => {
  const source = state([item('DRQ-0003'), item(), item('DRQ-0002')]);
  const a = build(source, 'initial', ['DRQ-0003', 'DRQ-0001']); const b = build(source, 'initial', ['DRQ-0001', 'DRQ-0003']);
  assert.equal(a.body, b.body); assert.equal(a.fingerprint, b.fingerprint); assert.doesNotMatch(a.body, /DRQ-0002/);
});
for (const ids of [[], null, ['missing'], ['DRQ-0001', 'DRQ-0001']]) test(`빈 선택·없는 번호·중복 선택은 생성하지 않는다: ${JSON.stringify(ids)}`, () => assert.equal(build(state(), 'initial', ids).ok, false));
test('알 수 없는 형식과 읽기 실패·잘못된 자료 배열은 막는다', () => {
  assert.equal(build(state(), 'other').ok, false);
  assert.equal(build({ ok: false, error: '읽기 실패' }).error, '읽기 실패');
  assert.equal(build({ ...state(), items: null }).ok, false);
  assert.equal(build(state([null])).ok, false);
  assert.equal(build(state([item(), item()])).ok, false);
});
for (const stage of [0, 9, 10]) test(`${stage}단계는 요청문을 만들지 않는다`, () => { const source = state(); source.project.stage = stage; assert.equal(build(source).ok, false); });
test('저장소가 읽기 전용이면 생성과 복사를 막는다', () => {
  const source = { ...state(), canGenerate: false, reason: '단계 확인 필요' }; assert.equal(build(source).error, '단계 확인 필요');
});
test('미등록 정보와 잘못된 기간·기한은 입력 필요로 표시하고 추측하지 않는다', () => {
  const source = state([item('DRQ-0001', '요청', { detail: '', dueDate: '2026-02-30', categoryKey: 'unknown' })]);
  Object.assign(source.project, { companyName: '', productName: '', customerContactName: '', researcherName: '', refStart: '2025-12-31', refEnd: '2025-01-01' });
  source.sender = null;
  const result = build(source); assert.equal(result.ok, true);
  for (const label of ['회사명', '제품명', '고객 담당자', '담당 연구원', '자료 기준기간', 'DRQ-0001 요청 내용', 'DRQ-0001 제출 기한', '자료 구분']) assert.ok((result.title + result.body).includes(`[입력 필요: ${label}]`));
  assert.equal(result.warnings.length, 10); assert.doesNotMatch(result.body, /undefined|null|2025.12.31~/);
});
test('보완 사유가 없으면 일반 검토 메모나 사용량으로 대신하지 않는다', () => {
  const result = build(state([item('DRQ-0001', '보완 요청', { receipt: { value: '12000', evidenceFileName: '비공개.xlsx' } })]), 'revision');
  assert.match(result.body, /\[입력 필요: DRQ-0001 보완 사유\]/); assert.doesNotMatch(result.body, /12000|비공개/);
});
test('제목의 줄바꿈을 정리하고 본문 내용은 평문 그대로 보존한다', () => {
  const source = state([item('DRQ-0001', '요청', { detail: '<script>bad()</script>\n두 번째 줄' })]); source.project.companyName = '회사\n이름';
  const result = build(source); assert.doesNotMatch(result.title, /\n/); assert.match(result.body, /<script>bad\(\)<\/script>\n두 번째 줄/);
});
test('긴 요청·보완 사유를 임의로 자르지 않는다', () => {
  const result = build(state([item('DRQ-0001', '보완 요청', { detail: '가'.repeat(1000), review: { note: '나'.repeat(1000) } })]), 'revision');
  assert.ok(result.body.includes('가'.repeat(1000))); assert.ok(result.body.includes('나'.repeat(1000)));
});
for (const field of ['companyName', 'productName', 'customerContactName', 'researcherName', 'refStart', 'refEnd', 'stage']) test(`복사 전 프로젝트 변경을 발견한다: ${field}`, () => {
  const source = state(); const result = build(source); source.project[field] = field === 'stage' ? 4 : '바뀐 값';
  assert.equal(M.check(source, 'initial', result.ids, result.fingerprint).ok, false);
});
for (const field of ['detail', 'dueDate', 'status', 'deletedAt']) test(`복사 전 자료 변경을 발견한다: ${field}`, () => {
  const source = state(); const result = build(source); source.items[0][field] = field === 'status' ? '제출됨' : field === 'dueDate' ? '2026-10-29' : '바뀜';
  assert.equal(M.check(source, 'initial', result.ids, result.fingerprint).ok, false);
});
test('보완 사유 변경을 발견하고 수정 전 사유를 복사하지 않는다', () => {
  const source = state([item('DRQ-0001', '보완 요청', { review: { note: '처음 사유' } })]); const result = build(source, 'revision'); source.items[0].review.note = '새 사유';
  assert.equal(M.check(source, 'revision', result.ids, result.fingerprint).ok, false);
});
test('선택하지 않은 자료 변화는 기존 선택의 문장을 바꾸지 않는다', () => {
  const source = state([item(), item('DRQ-0002')]); const result = build(source); source.items[1].detail = '바뀜';
  assert.equal(M.check(source, 'initial', result.ids, result.fingerprint).ok, true);
});
for (const field of ['name', 'company', 'department']) test(`복사 전에 연구원 프로필 변경을 발견한다: ${field}`, () => {
  const source = state(); const result = build(source); source.sender[field] = '변경';
  assert.equal(M.check(source, 'initial', result.ids, result.fingerprint).ok, false);
});
test('동명이인이나 연결되지 않은 연구원의 소속은 자동으로 쓰지 않는다', () => {
  const source = state(); source.project.researcherId = ''; const result = build(source);
  assert.match(result.body, /\[입력 필요: 연구원 회사\]/); assert.match(result.body, /\[입력 필요: 연구원 부서\]/);
  assert.doesNotMatch(result.body, /새움환경컨설팅/);
});
test('만들기와 최신 확인은 원본을 바꾸지 않는다', () => {
  const source = state(); const before = JSON.stringify(source); Object.freeze(source.project); Object.freeze(source.items[0]); Object.freeze(source.items); Object.freeze(source);
  const result = build(source); assert.equal(M.check(source, 'initial', result.ids, result.fingerprint).ok, true); assert.equal(JSON.stringify(source), before);
});
test('복사는 편집한 문자열을 정확히 전달하고 성공 후에만 성공을 반환한다', async () => {
  let copied; const content = '직접 고친 제목\n\n내용 1\n내용 2';
  const result = await M.copy(content, { async writeText(value) { copied = value; } }); assert.equal(result.ok, true); assert.equal(copied, content);
});
for (const [name, clipboard] of [['미지원', null], ['비동기 거부', { async writeText() { throw Error('denied'); } }], ['동기 오류', { writeText() { throw Error('failure'); } }]]) test(`복사 ${name}는 성공으로 표시하지 않는다`, async () => assert.equal((await M.copy('내용', clipboard)).ok, false));
test('실제 자료 저장소와 연결해도 생성·확인·복사는 저장 횟수를 늘리지 않는다', async () => {
  const values = new Map(); let writes = 0; const storage = { getItem: (key) => values.get(key) ?? null, setItem(key, value) { values.set(key, value); writes++; } };
  const store = context.LCA.requests.createStore(['project-a'], () => storage);
  const saved = store.add('project-a', { categoryKey: 'energy', detail: '전력 사용량', dueDate: '2026-10-25' }); assert.equal(saved.ok, true);
  const source = { ...state(), items: store.list('project-a').items }; const before = JSON.stringify([...values]); const count = writes;
  const result = build(source); assert.equal(result.ok, true); assert.equal(M.check(source, 'initial', result.ids, result.fingerprint).ok, true); await M.copy(result.body, { async writeText() {} });
  assert.equal(writes, count); assert.equal(JSON.stringify([...values]), before); assert.equal(store.list('project-a').items[0].status, '요청');
});
