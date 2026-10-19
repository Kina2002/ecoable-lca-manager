const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'received-data.js', 'review.js', 'requests.js', 'modelling.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
}
context.LCA.interpretation = { LABELS: {} };
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'report.js'), 'utf8'), context, { filename: 'report.js' });
const { receivedData: R, requests: Q, modelling: M } = context.LCA;
const base = (changes = {}) => ({ kind: 'quantity', value: '12,000', unit: 'kWh', density: '', description: '',
  periodStart: '2025-01-01', periodEnd: '2025-12-31', evidenceFileName: '가상전력.xlsx', ...changes });
const source = (changes = {}) => ({ activitySource: '1차', activitySourceDetail: '가상 전력 고지서', factorSource: '2차', acquisitionMethod: '측정',
  datasetDatabase: '가상 LCI DB', datasetName: '전력 생산', datasetVersion: 'v1.0', datasetYear: '2022', datasetSource: '가상 발행기관', ...changes });
function setup() {
  let raw = null;
  const storage = { getItem() { return raw; }, setItem(_key, value) { raw = value; } };
  const store = Q.createStore(['p'], () => storage);
  const item = store.add('p', { categoryKey: 'energy', detail: '가상 전력 사용량', dueDate: '2026-10-20' }).item;
  return { store, item, raw: () => raw, put: (value) => { raw = value; } };
}

test('기존 출처 미기록 자료를 그대로 읽고 새 출처는 저장·재읽기한다', () => {
  const s = setup();
  const old = s.store.recordReceipt('p', s.item.id, base());
  assert.equal(old.ok, true);
  assert.equal(old.item.receipt.provenance, undefined);
  assert.equal(R.validRecord(s.store.list('p').items[0].receipt), true);
  const saved = s.store.recordReceipt('p', s.item.id, base({ provenance: source() }));
  assert.equal(saved.ok, true);
  assert.equal(saved.item.receipt.provenance.datasetVersion, 'v1.0');
  assert.equal(s.store.list('p').items[0].receipt.provenance.datasetDatabase, '가상 LCI DB');
});

test('2차 활동량과 2차 계수의 근거 누락·잘못된 선택을 막는다', () => {
  assert.ok(R.validate(base({ provenance: source({ activitySource: '2차', activitySourceDetail: '' }) })).activitySourceDetail);
  for (const key of ['datasetDatabase', 'datasetName', 'datasetVersion', 'datasetSource']) {
    assert.ok(R.validate(base({ provenance: source({ [key]: '' }) }))[key]);
  }
  assert.ok(R.validate(base({ provenance: source({ datasetYear: '22' }) })).datasetYear);
  assert.ok(R.validate(base({ provenance: source({ factorSource: '가상' }) })).factorSource);
  assert.ok(R.validate(base({ provenance: source({ acquisitionMethod: '자동' }) })).acquisitionMethod);
  const s = setup(); const before = s.raw();
  assert.equal(s.store.recordReceipt('p', s.item.id, base({ provenance: source({ datasetName: '' }) })).ok, false);
  assert.equal(s.raw(), before);
});

test('1차 계수와 문서 자료에는 숨긴 2차 데이터셋 값을 저장하지 않는다', () => {
  const direct = R.normalize(base({ provenance: source({ factorSource: '1차' }) }));
  assert.equal(direct.provenance.datasetDatabase, '');
  assert.equal(R.validRecord({ ...direct, recordedAt: '2026-10-19T00:00:00.000Z', updatedAt: '2026-10-19T00:00:00.000Z' }), true);
  const doc = R.normalize(base({ kind: 'document', description: '가상 사업장 설명', provenance: source({ factorSource: '' }) }));
  assert.equal(doc.provenance.factorSource, '');
  assert.equal(doc.provenance.acquisitionMethod, '측정');
  assert.equal(doc.provenance.datasetName, '');
});

test('출처를 고쳐 저장하면 기존 승인을 초기화하고 계산 CSV에 새 출처를 넣는다', () => {
  const s = setup();
  s.store.recordReceipt('p', s.item.id, base());
  const started = s.store.startReview('p', s.item.id);
  s.store.saveReview('p', s.item.id, { checks: { period: true, scope: true, complete: true }, note: '' }, 'approve', started.item.review);
  const changed = s.store.recordReceipt('p', s.item.id, base({ provenance: source() }));
  assert.equal(changed.item.status, '제출됨');
  assert.equal(changed.item.review, undefined);
  const next = s.store.startReview('p', s.item.id);
  assert.equal(s.store.saveReview('p', s.item.id, { checks: { period: true, scope: true, complete: true }, note: '' }, 'approve', next.item.review).ok, true);
  const project = { id: 'p', code: 'LCA-001', companyName: '가상회사', productName: '가상제품', functionalUnit: { qty: '1', unit: 'kg' },
    boundary: '요람~문', modules: '', refStart: '2025-01-01', refEnd: '2025-12-31', standards: ['가상 기준'] };
  const csv = M.exportCsv(project, { ok: true, items: s.store.list('p').items });
  assert.equal(csv.ok, true);
  assert.match(csv.csv, /"계수 데이터셋 버전"/);
  assert.match(csv.csv, /"가상 LCI DB","전력 생산","v1.0","2022","가상 발행기관"/);
});

test('손상된 출처를 정상 자료로 읽지 않고 원문을 보존한다', () => {
  const s = setup(); s.store.recordReceipt('p', s.item.id, base({ provenance: source() }));
  const damaged = JSON.parse(s.raw()); damaged.requests[0].receipt.provenance.datasetVersion = '';
  const raw = JSON.stringify(damaged); s.put(raw);
  assert.equal(s.store.list('p').ok, false);
  assert.equal(s.raw(), raw);
});

test('계산 결과를 다시 열고 보고서에도 당시 데이터셋 출처가 남는다', () => {
  const s = setup();
  s.store.recordReceipt('p', s.item.id, base({ provenance: source() }));
  const started = s.store.startReview('p', s.item.id);
  s.store.saveReview('p', s.item.id, { checks: { period: true, scope: true, complete: true }, note: '' }, 'approve', started.item.review);
  const project = { id: 'p', stage: 5, code: 'LCA-001', companyName: '가상회사', productName: '가상제품', functionalUnit: { qty: '1', unit: 'kg' },
    boundary: '요람~문', modules: '', refStart: '2025-01-01', refEnd: '2025-12-31', standards: ['가상 기준'] };
  let saved = null;
  const modelStorage = { getItem() { return saved; }, setItem(_key, value) { saved = value; } };
  const model = () => M.createStore([project], () => modelStorage, () => s.store.list('p'), () => ({ ok: true, project }));
  const current = model().load('p');
  assert.equal(current.source.ready, true);
  const draft = { tool: '가상 도구', database: '가상 DB', method: '가상 방법', allocation: '할당 없음', resultFileName: '결과.xlsx', note: '',
    calculatedOn: '2026-10-19', scopeConfirmed: true, indicators: [{ indicator: '가상 지구온난화', value: '1.2', unit: 'kgCO₂e' }] };
  assert.equal(model().save('p', draft, 0, current.source.signature).ok, true);
  const loaded = model().load('p');
  assert.equal(loaded.ok, true); assert.equal(loaded.stale, false);
  assert.equal(loaded.record.source.requests[0].receipt.provenance.datasetSource, '가상 발행기관');
  const sections = context.LCA.report.sections({ source: { project, interpretation: { revision: 1, calculation: loaded.record } }, note: '' });
  assert.match(sections.find((section) => section.title.startsWith('계산에 연결한 승인 원자료')).paragraphs[0], /가상 LCI DB · 전력 생산 · v1\.0 · 2022 · 가상 발행기관/);
});
