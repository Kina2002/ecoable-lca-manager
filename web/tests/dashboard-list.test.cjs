const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const context = vm.createContext({}); vm.runInContext('window = globalThis;', context);
for (const name of ['constants', 'rules', 'requests', 'project-filter', 'dashboard']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${name}.js`), 'utf8'), context);
const { LCA } = context; LCA.tasks = { KINDS: { info: '정보 확인' } };
LCA.deadlines = { project: () => ({ days: null }) };
const projects = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, code: `LCA-${i}`, companyName: `회사${i}`, stage: i === 5 ? 10 : 2, targetDate: `2026-10-${20 + i}`, researcherId: i % 2 ? 'r1' : 'r2' }));
const tasks = { items: projects.slice(0, 5).map((p) => ({ id: p.id, projectId: p.id, kind: 'info', stage: p.stage })), warnings: [] };
const input = { projects, requests: { ok: true, items: [] }, tasks };
const ids = (items) => Array.from(items, (p) => p.id);
test('홈 요약 3건과 전체 목록은 같은 순서이며 연구원별 건수도 일치한다', () => {
  const home = LCA.dashboard.build(input, '2026-10-19');
  assert.equal(home.attention.length, 3); assert.equal(home.allAttention.length, 5);
  assert.deepEqual(ids(home.attention), ids(home.allAttention.slice(0, 3)));
  assert.equal(home.allTasks.length, 5); assert.equal(home.projectCount, 6); assert.equal(home.completedCount, 1);
  const own = LCA.dashboard.build(input, '2026-10-19', 'r1');
  assert.equal(own.projectCount, 3); assert.equal(own.completedCount, 1); assert.equal(own.attentionCount, 2);
});
test('주의 필터를 단계·검색과 함께 적용하고 정렬은 원본을 바꾸지 않는다', () => {
  const before = JSON.stringify(projects); const state = { attentionOnly: true, sort: 'target', query: '회사', researcher: 'r2' };
  assert.deepEqual(ids(LCA.projectFilter.select(projects, 2, state, ['p4', 'p2'])), ['p2', 'p4']);
  assert.equal(LCA.projectFilter.select(projects, 10, state, ['p4']).length, 0);
  assert.equal(LCA.projectFilter.select(projects, null, { attentionOnly: true }).length, 0);
  assert.deepEqual(ids(LCA.projectFilter.select(projects, null, { sort: 'newest' })), ids([...projects].reverse()));
  const data = [{ ...projects[0], targetDate: 'invalid' }, { ...projects[5], targetDate: '2020-01-01' }, projects[1]];
  assert.equal(LCA.projectFilter.select(data, null, { sort: 'target' })[0].id, 'p1');
  assert.equal(JSON.stringify(projects), before); assert.equal(LCA.projectFilter.active(state), true);
});
