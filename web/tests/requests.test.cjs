const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'received-data.js', 'requests.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
}
const { createStore, STORAGE_KEY, validDate, formatDateInput, validate } = context.LCA.requests;
const projects = ['project-a', 'project-b'];
const draft = (categoryKey = 'energy', detail = ' 지난해 전력 사용량과 고지서 ', dueDate = '2026-10-23') => ({ categoryKey, detail, dueDate });
function memoryStorage(initial = null) {
  let raw = initial;
  let writes = 0;
  return {
    getItem(key) { assert.equal(key, STORAGE_KEY); return raw; },
    setItem(key, value) { assert.equal(key, STORAGE_KEY); raw = value; writes++; },
    get raw() { return raw; }, get writes() { return writes; }
  };
}
const receiptDraft = (changes = {}) => ({
  kind: 'quantity', value: '12,000.50', unit: 'kWh', density: '', description: '',
  periodStart: '2025-01-01', periodEnd: '2025-12-31', evidenceFileName: ' 2025년_전기요금고지서.xlsx ', ...changes
});

test('처음에는 0건이며 읽기만 해서는 저장하지 않는다', () => {
  const storage = memoryStorage();
  assert.equal(createStore(projects, () => storage).list('project-a').items.length, 0);
  assert.equal(storage.writes, 0);
});

test('프로젝트별로 분리하고 새 저장 객체에서도 요청·기한·문장을 복원한다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  const saved = store.add('project-a', draft());
  assert.equal(saved.ok, true);
  assert.equal(saved.item.id, 'DRQ-0001');
  assert.equal(saved.item.detail, '지난해 전력 사용량과 고지서');
  assert.equal(saved.item.status, '요청');
  assert.equal(saved.item.dueDate, '2026-10-23');
  const reloaded = createStore(projects, () => storage);
  assert.equal(reloaded.list('project-a').items[0].id, saved.item.id);
  assert.equal(reloaded.list('project-b').items.length, 0);
});

test('같은 프로젝트의 중복 구분을 막고 다른 프로젝트에는 같은 구분을 등록한다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  store.add('project-a', draft());
  assert.ok(store.add('project-a', draft()).errors.categoryKey);
  assert.equal(storage.writes, 1);
  assert.equal(store.add('project-b', draft()).item.id, 'DRQ-0002');
  assert.equal(store.add('project-a', draft('transport')).item.id, 'DRQ-0003');
  assert.equal(store.list('project-a').items.length, 2);
});

test('알 수 없는 프로젝트·구분, 빈 내용·기한, 긴 내용은 저장하지 않는다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  for (const invalid of [draft('unknown'), draft('energy', '  '), draft('energy', 'x'.repeat(1001)), draft('energy', '내용', '')]) {
    assert.equal(store.add('project-a', invalid).ok, false);
  }
  assert.equal(store.add('unknown', draft()).ok, false);
  assert.equal(storage.writes, 0);
  assert.deepEqual(Object.keys(validate(draft('energy', 'x'.repeat(1000)))), []);
});

test('실제 달력 날짜와 윤년을 확인하며 과거 기한도 기록할 수 있다', () => {
  assert.equal(validDate('2024-02-29'), true);
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '2026-1-01']) assert.equal(validDate(date), false);
  assert.equal(createStore(projects, () => memoryStorage()).add('project-a', draft('energy', '과거 요청', '2020-01-01')).ok, true);
});

test('구분 11개 모두 기본 문장과 근거가 있고 등록 당시 근거를 함께 보관한다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  for (const category of context.LCA.constants.CATEGORIES) {
    assert.ok(category.detail);
    const saved = store.add('project-a', draft(category.key, category.detail));
    assert.equal(saved.ok, true);
    assert.ok(saved.item.guideline.section);
    assert.equal(saved.item.guideline.checkedOn, '2026-10-16');
    assert.equal(new URL(saved.item.guideline.url).hostname, 'law.go.kr');
  }
  assert.equal(store.list('project-a').items.length, 11);
  const item = store.list('project-a').items[0];
  item.guideline.section = '화면에서 바꾼 사본';
  assert.notEqual(store.list('project-a').items[0].guideline.section, item.guideline.section);
});

test('쓰기 실패와 저장소 접근 거부를 성공으로 표시하지 않는다', () => {
  const storage = memoryStorage();
  const deniedWrite = { getItem: storage.getItem, setItem() { throw new Error('quota'); } };
  const result = createStore(projects, () => deniedWrite).add('project-a', draft());
  assert.equal(result.ok, false);
  assert.match(result.message, /저장하지 못/);
  assert.equal(storage.raw, null);
  const deniedRead = createStore(projects, () => { throw new Error('denied'); });
  assert.equal(deniedRead.list('project-a').ok, false);
  assert.equal(deniedRead.add('project-a', draft()).ok, false);
});

test('깨진 JSON·다른 버전·잘못된 기록을 덮어쓰지 않는다', () => {
  const good = memoryStorage();
  createStore(projects, () => good).add('project-a', draft());
  const badRecord = JSON.parse(good.raw);
  badRecord.requests[0].dueDate = '2026-02-31';
  const badLink = JSON.parse(good.raw);
  badLink.requests[0].guideline.url = 'javascript:alert(1)';
  for (const raw of ['{broken', JSON.stringify({ version: 2, requests: [] }), JSON.stringify(badRecord), JSON.stringify(badLink)]) {
    const storage = memoryStorage(raw);
    const store = createStore(projects, () => storage);
    assert.equal(store.list('project-a').ok, false);
    assert.equal(store.add('project-a', draft()).ok, false);
    assert.equal(storage.raw, raw);
    assert.equal(storage.writes, 0);
  }
});

test('다른 저장 객체가 추가한 최신 기록과 일련번호를 이어 쓴다', () => {
  const storage = memoryStorage();
  const first = createStore(projects, () => storage);
  const second = createStore(projects, () => storage);
  first.list('project-a');
  second.add('project-b', draft('material'));
  assert.equal(first.add('project-a', draft()).item.id, 'DRQ-0002');
  assert.equal(second.list('project-b').items.length, 1);
});

test('삭제는 현재 목록에서 제외하고 새로 열어도 보존하며 원래 내용으로 복원한다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  const original = store.add('project-a', draft()).item;
  store.add('project-b', draft());
  assert.equal(store.remove('project-a', original.id).ok, true);
  const reloaded = createStore(projects, () => storage);
  assert.equal(reloaded.list('project-a').items.length, 0);
  assert.equal(reloaded.list('project-a').deletedItems[0].id, original.id);
  assert.equal(reloaded.list('project-b').items.length, 1);
  const restored = reloaded.restore('project-a', original.id);
  assert.equal(restored.ok, true);
  assert.equal(JSON.stringify(restored.item), JSON.stringify(original));
  assert.equal(reloaded.list('project-a').deletedItems.length, 0);
});

test('삭제 후 같은 구분을 새 번호로 등록하고 중복 구분의 복원을 막는다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  store.add('project-a', draft());
  store.remove('project-a', 'DRQ-0001');
  assert.equal(store.add('project-a', draft()).item.id, 'DRQ-0002');
  const before = storage.raw;
  assert.match(store.restore('project-a', 'DRQ-0001').message, /같은 자료 구분/);
  assert.equal(storage.raw, before);
  store.remove('project-a', 'DRQ-0002');
  assert.equal(store.restore('project-a', 'DRQ-0001').ok, true);
  assert.equal(store.list('project-a').items[0].id, 'DRQ-0001');
});

test('다른 프로젝트·없는 번호·이미 처리된 요청은 삭제나 복원하지 않는다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  store.add('project-a', draft());
  for (const [projectId, id] of [['project-b', 'DRQ-0001'], ['unknown', 'DRQ-0001'], ['project-a', 'DRQ-9999']]) {
    assert.equal(store.remove(projectId, id).ok, false);
    assert.equal(store.restore(projectId, id).ok, false);
  }
  assert.equal(store.restore('project-a', 'DRQ-0001').ok, false);
  assert.equal(storage.writes, 1);
  store.remove('project-a', 'DRQ-0001');
  assert.equal(store.remove('project-a', 'DRQ-0001').ok, false);
  assert.equal(storage.writes, 2);
});

test('삭제·복원 쓰기 실패와 손상 기록에서 기존 저장본을 보존한다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  store.add('project-a', draft());
  const denied = createStore(projects, () => ({ getItem: storage.getItem, setItem() { throw new Error('quota'); } }));
  const active = storage.raw;
  assert.equal(denied.remove('project-a', 'DRQ-0001').ok, false);
  assert.equal(storage.raw, active);
  store.remove('project-a', 'DRQ-0001');
  const deleted = storage.raw;
  assert.equal(denied.restore('project-a', 'DRQ-0001').ok, false);
  assert.equal(storage.raw, deleted);
  const corrupt = JSON.parse(deleted);
  corrupt.requests[0].deletedAt = 'invalid';
  const broken = memoryStorage(JSON.stringify(corrupt));
  const badStore = createStore(projects, () => broken);
  assert.equal(badStore.remove('project-a', 'DRQ-0001').ok, false);
  assert.equal(badStore.restore('project-a', 'DRQ-0001').ok, false);
  assert.equal(broken.writes, 0);
});

test('숫자 연속 입력과 붙여넣기를 정리하고 연도 4자리·전체 숫자 8자리를 넘기지 않는다', () => {
  let typed = '';
  for (const digit of '20261023') typed = formatDateInput(typed + digit);
  assert.equal(typed, '2026-10-23');
  assert.equal(formatDateInput('2026102399'), '2026-10-23');
  assert.equal(formatDateInput('123456-10-23'), '1234-10-23');
  assert.equal(formatDateInput('2026.10.23'), '2026-10-23');
  assert.equal(formatDateInput('2026/10/23'), '2026-10-23');
  assert.equal(formatDateInput('202-10-23'), '202-10-23');
  assert.equal(formatDateInput(''), '');
  assert.equal(formatDateInput('abcd'), '');
  assert.equal(validDate(formatDateInput('20260229')), false);
  assert.equal(validDate(formatDateInput('20240229')), true);
  assert.equal(validDate('123456-10-23'), false);
});

test('기존 요청에 받은 자료를 붙이고 제출됨으로 저장해 새로고침 후에도 복원한다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  const before = store.add('project-a', draft()).item;
  store.add('project-b', draft());
  const result = store.recordReceipt('project-a', before.id, receiptDraft());
  assert.equal(result.ok, true);
  assert.equal(result.item.status, '제출됨');
  assert.equal(result.item.receipt.value, '12000.50');
  assert.equal(result.item.receipt.evidenceFileName, '2025년_전기요금고지서.xlsx');
  for (const key of ['id', 'projectId', 'categoryKey', 'detail', 'dueDate', 'createdAt']) assert.equal(result.item[key], before[key]);
  assert.equal(JSON.stringify(result.item.guideline), JSON.stringify(before.guideline));
  const reloaded = createStore(projects, () => storage);
  assert.equal(reloaded.list('project-a').items[0].receipt.value, '12000.50');
  assert.equal(reloaded.list('project-a').items.length, 1);
  assert.equal(reloaded.list('project-b').items[0].status, '요청');
  assert.equal(reloaded.add('project-a', draft('transport')).item.id, 'DRQ-0003');
});

test('0·소수·쉼표 숫자를 허용하며 빈 값·음수·문자·잘못된 쉼표·지수 표기는 거부한다', () => {
  const validateReceipt = context.LCA.receivedData.validate;
  for (const value of ['0', '0.5', '12,000.123456789', '12000', ' 1.25 ']) assert.equal(Object.keys(validateReceipt(receiptDraft({ value }))).length, 0);
  for (const value of ['', ' ', '-1', '1e3', 'Infinity', 'NaN', '열둘', '12,00', '1,2,3', '9'.repeat(20), '1.2.3']) assert.ok(validateReceipt(receiptDraft({ value })).value);
  assert.ok(validateReceipt(receiptDraft({ unit: 'unknown' })).unit);
  assert.equal(context.LCA.receivedData.displayNumber('12000.123456789'), '12,000.123456789');
});

test('문서 자료는 설명을 저장하고 숨긴 수치 값을 섞지 않는다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  store.add('project-a', draft('general'));
  const result = store.recordReceipt('project-a', 'DRQ-0001', receiptDraft({ kind: 'document', description: ' 사업장별 주소와 제품 정보를 받음 ' }));
  assert.equal(result.ok, true);
  assert.equal(result.item.receipt.description, '사업장별 주소와 제품 정보를 받음');
  assert.equal(result.item.receipt.value, '');
  assert.equal(result.item.receipt.unit, '');
  assert.equal(createStore(projects, () => storage).list('project-a').ok, true);
  assert.ok(store.recordReceipt('project-a', 'DRQ-0001', receiptDraft({ kind: 'document', description: '' })).errors.description);
  assert.ok(store.recordReceipt('project-a', 'DRQ-0001', receiptDraft({ kind: 'document', description: 'x'.repeat(1001) })).errors.description);
});

test('존재하지 않는 날짜·역전 기간을 막고 같은 날짜·윤년·과거 기간을 허용한다', () => {
  const validateReceipt = context.LCA.receivedData.validate;
  assert.ok(validateReceipt(receiptDraft({ periodStart: '2025-02-29' })).periodStart);
  assert.ok(validateReceipt(receiptDraft({ periodEnd: '2024-12-31' })).periodEnd);
  assert.ok(validateReceipt(receiptDraft({ periodEnd: '' })).periodEnd);
  assert.ok(validateReceipt(receiptDraft({ periodStart: '123456-01-01' })).periodStart);
  assert.equal(Object.keys(validateReceipt(receiptDraft({ periodStart: '2024-02-29', periodEnd: '2024-02-29' }))).length, 0);
});

test('증빙 파일 이름은 필수이며 공백·폴더 경로·너무 긴 이름을 거부한다', () => {
  const validateReceipt = context.LCA.receivedData.validate;
  for (const evidenceFileName of ['', '  ', 'C:\\자료\\전력.xlsx', '../전력.xlsx', 'x'.repeat(201), '기록\n.xlsx']) {
    assert.ok(validateReceipt(receiptDraft({ evidenceFileName })).evidenceFileName);
  }
  assert.equal(Object.keys(validateReceipt(receiptDraft({ evidenceFileName: '생산 기록 (가상).pdf' }))).length, 0);
});

test('부피 단위는 양의 밀도가 있어야 하며 다른 단위에는 밀도를 남기지 않는다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  store.add('project-a', draft('water'));
  for (const unit of ['m³', 'L']) {
    for (const density of ['', '0', '-1', '가상']) assert.ok(store.recordReceipt('project-a', 'DRQ-0001', receiptDraft({ unit, density })).errors.density);
  }
  const volume = store.recordReceipt('project-a', 'DRQ-0001', receiptDraft({ unit: 'm³', density: '1,000' }));
  assert.equal(volume.item.receipt.density, '1000');
  assert.equal(store.list('project-a').ok, true);
  const changed = store.recordReceipt('project-a', 'DRQ-0001', receiptDraft({ density: '1000', description: '숨긴 문장' }));
  assert.equal(changed.item.receipt.density, '');
  assert.equal(changed.item.receipt.description, '');
});

test('받은 자료를 수정하면 같은 번호와 최초 기록 시각을 유지하고 새 요청을 만들지 않는다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  store.add('project-a', draft());
  const original = store.recordReceipt('project-a', 'DRQ-0001', receiptDraft()).item;
  const updated = store.recordReceipt('project-a', 'DRQ-0001', receiptDraft({ value: '14000', evidenceFileName: '수정 고지서.xlsx' })).item;
  assert.equal(updated.receipt.recordedAt, original.receipt.recordedAt);
  assert.equal(updated.receipt.value, '14000');
  assert.equal(updated.receipt.evidenceFileName, '수정 고지서.xlsx');
  assert.equal(store.list('project-a').items.length, 1);
  assert.equal(store.add('project-a', draft('transport')).item.id, 'DRQ-0002');
});

test('제출된 요청을 삭제·복원해도 받은 값·기한·제출 상태가 남는다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  store.add('project-a', draft());
  const original = store.recordReceipt('project-a', 'DRQ-0001', receiptDraft()).item;
  store.remove('project-a', original.id);
  assert.equal(store.list('project-a').deletedItems[0].receipt.value, '12000.50');
  assert.equal(store.recordReceipt('project-a', original.id, receiptDraft()).ok, false);
  assert.equal(JSON.stringify(store.restore('project-a', original.id).item), JSON.stringify(original));
});

test('다른 프로젝트·없는 요청의 받은 자료 기록을 거부하고 최신 다른 요청을 보존한다', () => {
  const storage = memoryStorage();
  const first = createStore(projects, () => storage);
  const second = createStore(projects, () => storage);
  first.add('project-a', draft());
  second.add('project-b', draft());
  const before = storage.raw;
  for (const [project, id] of [['project-b', 'DRQ-0001'], ['unknown', 'DRQ-0001'], ['project-a', 'DRQ-9999']]) assert.equal(first.recordReceipt(project, id, receiptDraft()).ok, false);
  assert.equal(storage.raw, before);
  first.recordReceipt('project-a', 'DRQ-0001', receiptDraft());
  assert.equal(second.list('project-b').items[0].status, '요청');
});

test('받은 자료 쓰기 실패는 요청 상태와 기존 받은 값을 바꾸지 않는다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  store.add('project-a', draft());
  const denied = createStore(projects, () => ({ getItem: storage.getItem, setItem() { throw new Error('quota'); } }));
  const before = storage.raw;
  assert.equal(denied.recordReceipt('project-a', 'DRQ-0001', receiptDraft()).ok, false);
  assert.equal(storage.raw, before);
  store.recordReceipt('project-a', 'DRQ-0001', receiptDraft());
  const submitted = storage.raw;
  assert.equal(denied.recordReceipt('project-a', 'DRQ-0001', receiptDraft({ value: '14000' })).ok, false);
  assert.equal(storage.raw, submitted);
});

test('상태와 받은 자료가 맞지 않거나 손상된 저장본을 덮어쓰지 않는다', () => {
  const storage = memoryStorage();
  const store = createStore(projects, () => storage);
  store.add('project-a', draft());
  store.recordReceipt('project-a', 'DRQ-0001', receiptDraft());
  const corruptions = [
    (item) => { delete item.receipt; },
    (item) => { item.status = '요청'; },
    (item) => { item.status = '승인'; },
    (item) => { item.receipt.value = '-1'; },
    (item) => { item.receipt.updatedAt = 'invalid'; },
    (item) => { item.receipt.periodEnd = '2024-01-01'; }
  ];
  for (const corrupt of corruptions) {
    const data = JSON.parse(storage.raw);
    corrupt(data.requests[0]);
    const raw = JSON.stringify(data);
    const badStorage = memoryStorage(raw);
    const bad = createStore(projects, () => badStorage);
    assert.equal(bad.list('project-a').ok, false);
    assert.equal(bad.recordReceipt('project-a', 'DRQ-0001', receiptDraft()).ok, false);
    assert.equal(badStorage.raw, raw);
    assert.equal(badStorage.writes, 0);
  }
});
