const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'received-data.js', 'review.js', 'requests.js', 'request-filter.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
}
const { collectionSnapshot, snapshot } = context.LCA.requestFilter;
const projects = Object.freeze([
  { id: 'a', stage: 3 }, { id: 'b', stage: 4 }, { id: 'c', stage: 3 }, { id: 'd', stage: 2 }
].map(Object.freeze));
const items = Object.freeze([
  { id: 'one', projectId: 'a', status: '제출됨' },
  { id: 'two', projectId: 'b', status: '승인' },
  { id: 'three', projectId: 'c', status: '보완 요청' },
  { id: 'four', projectId: 'a', status: '보완 요청' },
  { id: 'five', projectId: 'c', status: '승인', deletedAt: '2026-10-16T03:00:00.000Z' },
  { id: 'six', projectId: 'd', status: '요청' },
  { id: 'seven', projectId: 'unknown', status: '요청' }
].map(Object.freeze));

test('수집 단계 프로젝트만 합산하고 다른 단계·삭제·알 수 없는 프로젝트를 제외한다', () => {
  const result = collectionSnapshot(items, projects);
  assert.equal(result.projectCount, 2);
  assert.equal(result.total, 3);
  assert.equal(result.counts['제출됨'], 1);
  assert.equal(result.counts['보완 요청'], 2);
  assert.equal(result.counts['승인'], 0);
  assert.equal(Object.values(result.counts).reduce((a, b) => a + b, 0), result.total);
});

test('하위 상태 필터는 전체 건수·단계·원본을 유지하며 두 회사의 자료를 함께 조회한다', () => {
  const before = JSON.stringify({ projects, items });
  const result = collectionSnapshot(items, projects, '보완 요청');
  assert.deepEqual(Array.from(result.visible, (item) => item.id), ['three', 'four']);
  assert.equal(result.total, 3);
  assert.equal(result.counts['제출됨'], 1);
  assert.equal(JSON.stringify({ projects, items }), before);
  assert.deepEqual(Array.from(collectionSnapshot(items, projects).visible, (item) => item.id), ['one', 'three', 'four']);
});

test('수집 단계나 자료가 없을 때도 상태별 0건과 빈 목록을 구분한다', () => {
  const noProject = collectionSnapshot(items, projects.filter((project) => project.stage !== 3));
  assert.equal(noProject.projectCount, 0);
  assert.equal(noProject.total, 0);
  const noItems = collectionSnapshot([], projects);
  assert.equal(noItems.projectCount, 2);
  assert.equal(noItems.total, 0);
  assert.equal(Object.values(noItems.counts).every((count) => count === 0), true);
  assert.equal(collectionSnapshot(items, projects, '요청').visible.length, 0);
});

test('기존 회사별 필터는 그 회사만, 단계 하위 필터는 수집 프로젝트 전체를 조회한다', () => {
  const company = snapshot(items, 'a', '보완 요청');
  const stage = collectionSnapshot(items, projects, '보완 요청');
  assert.equal(company.total, 2);
  assert.equal(company.visible.length, 1);
  assert.equal(stage.total, 3);
  assert.equal(stage.visible.length, 2);
});

test('전체 목록 읽기는 최신 요청·삭제·복원을 반영하면서 저장을 쓰지 않는다', () => {
  let raw = null;
  let writes = 0;
  const store = context.LCA.requests.createStore(['a', 'b', 'c'], () => ({ getItem() { return raw; }, setItem(key, value) { raw = value; writes++; } }));
  assert.equal(store.listAll().items.length, 0);
  assert.equal(writes, 0);
  const request = { categoryKey: 'energy', detail: '가상 전력 자료', dueDate: '2026-10-23' };
  store.add('a', request); store.add('b', request); store.add('c', request);
  const before = raw;
  const count = writes;
  assert.equal(collectionSnapshot(store.listAll().items, projects).total, 2);
  assert.equal(raw, before);
  assert.equal(writes, count);
  store.remove('c', 'DRQ-0003');
  assert.equal(collectionSnapshot(store.listAll().items, projects).total, 1);
  store.restore('c', 'DRQ-0003');
  assert.equal(collectionSnapshot(store.listAll().items, projects).total, 2);
});

test('손상 저장본과 접근 실패를 0건 성공으로 반환하거나 덮어쓰지 않는다', () => {
  let writes = 0;
  const broken = context.LCA.requests.createStore(['a'], () => ({ getItem() { return '{broken'; }, setItem() { writes++; } }));
  assert.equal(broken.listAll().ok, false);
  assert.equal(writes, 0);
  const denied = context.LCA.requests.createStore(['a'], () => { throw new Error('denied'); });
  assert.equal(denied.listAll().ok, false);
});
