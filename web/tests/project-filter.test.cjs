const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'data.js', 'project-filter.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
const F = context.LCA.projectFilter;
const projects = context.LCA.data.createSampleProjects('2026-10-16');
const ids = (items) => Array.from(items, (item) => item.id);

test('빈 검색과 공백은 전체이며 단계만 고르면 기존 단계 조회와 같다', () => {
  assert.equal(F.select(projects, null).length, 7);
  assert.equal(F.select(projects, null, { query: '  ' }).length, 7);
  assert.deepEqual(ids(F.select(projects, 3)), ids(context.LCA.rules.projectsForStage(projects, 3)));
});
test('회사·제품·프로젝트 번호·연구원 이름과 번호로 찾는다', () => {
  for (const query of ['라온', '전구체', 'lca-2026-001', 'ＬＣＡ２０２６００１']) assert.deepEqual(ids(F.select(projects, null, { query })), ['project-001']);
  assert.equal(F.select(projects, null, { query: '김하늘' }).length, 3);
  assert.equal(F.select(projects, null, { query: 'RSR-002' }).length, 2);
});
test('여러 검색어는 다른 필드라도 모두 일치해야 한다', () => {
  assert.deepEqual(ids(F.select(projects, null, { query: '김하늘 전구체' })), ['project-001']);
  assert.equal(F.select(projects, null, { query: '김하늘 철근' }).length, 0);
});
test('단계·담당 ID·목적·검색을 동시에 적용한다', () => {
  const state = { query: '솔뫼 철근', researcher: 'researcher-sample-2', purpose: '규제 대응' };
  assert.deepEqual(ids(F.select(projects, 8, state)), ['project-002']);
  assert.equal(F.select(projects, 3, state).length, 0);
  assert.equal(F.select(projects, 8, { ...state, purpose: '고객사 요구 대응' }).length, 0);
});
test('동명이인은 ID로 구분하고 이름만 기록된 자료는 별도 필터에 둔다', () => {
  const data = [...projects,
    { id: 'same-name', companyName: '가상회사', researcherName: '김하늘', researcherId: 'researcher-user-4', stage: 1 },
    { id: 'legacy', researcherName: '김하늘', researcherId: '', stage: 1 },
    { id: 'new', researcherName: '', researcherId: '', stage: 1 }
  ];
  assert.equal(F.select(data, null, { researcher: 'researcher-sample-1' }).length, 3);
  assert.deepEqual(ids(F.select(data, null, { researcher: 'researcher-user-4' })), ['same-name']);
  assert.deepEqual(ids(F.select(data, 1, { researcher: 'legacy' })), ['legacy']);
  assert.deepEqual(ids(F.select(data, null, { researcher: 'unassigned' })), ['new']);
});
test('선택지는 전체 프로젝트의 ID를 중복 없이 모으며 같은 이름도 번호로 나눈다', () => {
  const options = F.researcherOptions([...projects, { researcherId: 'researcher-user-4', researcherName: '김하늘' }]);
  assert.equal(options.length, 4);
  assert.notEqual(options[0].label, options[3].label);
  assert.equal(F.researcherOptions([]).length, 0);
});
test('빈 결과·없는 담당자·문자 기호도 예외나 전체 결과로 바꾸지 않는다', () => {
  for (const query of ['없는회사', '*[', '---', '<script>']) assert.equal(F.select(projects, null, { query }).length, 0);
  assert.equal(F.select(projects, null, { researcher: 'researcher-user-999' }).length, 0);
  assert.equal(F.select([], 1, { query: '제품' }).length, 0);
});
test('조회는 원본·정렬·배정·단계를 바꾸지 않고 전체 단계 건수도 유지한다', () => {
  const before = JSON.stringify(projects), counts = JSON.stringify(context.LCA.rules.stageCounts(projects));
  F.select(projects, 3, { query: '없음', researcher: 'researcher-sample-2' });
  F.researcherOptions(projects);
  assert.equal(JSON.stringify(projects), before);
  assert.equal(JSON.stringify(context.LCA.rules.stageCounts(projects)), counts);
});
test('조건 초기화 판정은 공백만 있는 검색을 제외한다', () => {
  assert.equal(F.active({ query: '  ', researcher: '', purpose: '' }), false);
  assert.equal(F.active({ query: '라온' }), true);
  assert.equal(F.active({ purpose: '규제 대응' }), true);
  assert.equal(F.active({ researcher: 'unassigned' }), true);
});
