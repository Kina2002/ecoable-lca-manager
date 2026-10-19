const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const context = vm.createContext({}); vm.runInContext('window = globalThis;', context);
for (const file of ['constants', 'rules', 'received-data', 'review', 'message-history', 'requests', 'request-message']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), context, { filename: file });
}
const { LCA } = context;
const source = () => ({ ok: true, canGenerate: true, items: [], project: { id: 'a', stage: 2, companyName: '가상 회사', productName: '가상 제품',
  customerContactName: '', researcherId: 'r', researcherName: '김연구', targetDate: '2026-12-01', uses: [], functionalUnit: { qty: '', unit: '' },
  boundary: '', scopeStatus: '협의 중', refStart: '', refEnd: '', standards: [] }, sender: { id: 'r', name: '김연구', company: '가상 컨설팅', department: '평가팀' } });
test('자료 요청 0건에서도 고객에게 확인할 정보만 골라 안내문을 만든다', () => {
  const state = source(); const items = LCA.requestMessage.candidates(state, 'info').items;
  assert.ok(items.some((item) => item.id === 'customerContactName'));
  assert.equal(items.some((item) => /researcher/.test(item.id)), false);
  const result = LCA.requestMessage.build(state, 'info', ['customerContactName', 'boundary']);
  assert.equal(result.ok, true); assert.match(result.body, /담당하실 분의 성함/); assert.match(result.body, /함께 협의/);
  assert.doesNotMatch(result.body, /undefined|DRQ-|\[입력 필요: 고객 담당자\]/);
  assert.equal(result.warnings.length, 0);
});
test('정보가 채워지면 대상에서 빠지고 이전 초안의 기준 변경을 감지한다', () => {
  const state = source(); const result = LCA.requestMessage.build(state, 'info', ['customerContactName']);
  state.project.customerContactName = '박담당';
  assert.equal(LCA.requestMessage.candidates(state, 'info').items.some((item) => item.id === 'customerContactName'), false);
  assert.equal(LCA.requestMessage.check(state, 'info', result.ids, result.fingerprint).ok, false);
  Object.assign(state.project, { uses: ['환경성적표지'], functionalUnit: { qty: '1', unit: 'kg' }, boundary: '요람~문', scopeStatus: '확정', refStart: '2025-01-01', refEnd: '2025-12-31', standards: ['ISO 14040/44'] });
  assert.equal(LCA.requestMessage.candidates(state, 'info').items.length, 6);
  state.project.information = { contactDepartment:'자료팀', contactEmail:'demo@example.com', productCode:'DEMO', unitWeight:'1 kg', annualProduction:'100 kg', customerDueOn:'2026-12-01' };
  assert.equal(LCA.requestMessage.candidates(state, 'info').items.length, 0);
  state.project.researcherName = '';
  assert.equal(LCA.requestMessage.candidates(state, 'info').items.length, 0);
});
test('정보 확인도 기존 읽기 전용·단계 조건을 유지하고 할 일 바로가기를 구별한다', () => {
  const state = source(); state.project.stage = 9;
  assert.equal(LCA.requestMessage.build(state, 'info', ['customerContactName']).ok, false);
  assert.equal(LCA.requestMessage.typeForTask({ kind: 'info', stage: 2, infoKeys: ['boundary'] }), 'info');
  assert.equal(LCA.requestMessage.typeForTask({ kind: 'info', stage: 2, infoKeys: [] }), null);
});
test('정보 확인 안내문은 실제 발송 사본으로도 저장되며 자료를 생성하지 않는다', async () => {
  const state = source(); const result = LCA.requestMessage.build(state, 'info', ['customerContactName']); let raw = null;
  const store = LCA.requests.createStore(['a'], () => ({ getItem: () => raw, setItem: (key, value) => { raw = value; } }));
  const recorded = await store.recordMessage('a', { projectId: 'a', companyName: state.project.companyName, productName: state.project.productName,
    type: 'info', channel: '메일', recipient: '고객사 대표 연락처', actor: '김연구', title: result.title, body: result.body, targets: result.ids,
    sentAt: '2026-01-01T00:00:00.000Z', basisChanged: false, token: 'info-message-001', confirmed: true }, 1);
  assert.equal(recorded.ok, true, recorded.message); assert.equal(store.messages('a').items.length, 1); assert.equal(store.list('a').items.length, 0);
});
