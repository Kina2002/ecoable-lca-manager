const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'requests.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
}
const { createStore, STORAGE_KEY, validDate, validate } = context.LCA.requests;
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
