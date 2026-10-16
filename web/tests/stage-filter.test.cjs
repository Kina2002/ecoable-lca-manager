// 실행: node --test web/tests/stage-filter.test.cjs (별도 패키지 설치 없음)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
}
const { stageCounts, projectsForStage } = context.LCA.rules;

// 실제 샘플과 다른 분포로, 같은 단계에 여러 프로젝트가 있어도 맞게 동작하는지 확인한다.
const projects = Object.freeze([
  Object.freeze({ id: 'a', stage: 3 }),
  Object.freeze({ id: 'b', stage: 8 }),
  Object.freeze({ id: 'c', stage: 3 }),
  Object.freeze({ id: 'd', stage: 10 }),
  Object.freeze({ id: 'e', stage: 8 })
]);

test('같은 단계의 여러 건을 세며 0건인 단계와 완료 단계도 남긴다', () => {
  const counts = stageCounts(projects);
  assert.equal(Object.keys(counts).length, 10);
  assert.equal(counts[3], 2);
  assert.equal(counts[8], 2);
  assert.equal(counts[10], 1);
  assert.equal(counts[5], 0);
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), projects.length);
});

test('단계를 골라 원래 순서대로 보여주고 원본 프로젝트 단계를 바꾸지 않는다', () => {
  const selected = projectsForStage(projects, 3);
  assert.deepEqual(Array.from(selected, (project) => project.id), ['a', 'c']);
  assert.equal(selected[0], projects[0]);
  assert.equal(projects[1].stage, 8);
  assert.equal(projects.length, 5);
});

test('다른 단계로 옮겨 조회해도 전체 명단 기준 건수는 유지된다', () => {
  const before = JSON.stringify(stageCounts(projects));
  projectsForStage(projects, 3);
  projectsForStage(projects, 8);
  assert.equal(JSON.stringify(stageCounts(projects)), before);
  assert.equal(projectsForStage(projects, 8).length, 2);
});

test('빈 단계와 빈 명단도 처리하고, 전체 보기로 모든 프로젝트를 복구한다', () => {
  assert.equal(projectsForStage(projects, 5).length, 0);
  assert.equal(projectsForStage(projects, null).length, 5);
  assert.notEqual(projectsForStage(projects, null), projects);
  assert.equal(Object.values(stageCounts([])).every((count) => count === 0), true);
  assert.equal(projectsForStage([], 3).length, 0);
});
