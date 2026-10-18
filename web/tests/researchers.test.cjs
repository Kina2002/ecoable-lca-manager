const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'data.js', 'received-data.js', 'review.js', 'requests.js', 'researchers.js', 'scope.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context);
}
const R = context.LCA.researchers, S = context.LCA.scope;
const samples = () => context.LCA.data.createSampleProjects('2026-10-16');
function setup() {
  const values = new Map(); let writes = 0;
  const storage = { getItem: (key) => values.get(key) ?? null, setItem(key, value) { values.set(key, value); writes++; } };
  const roster = R.createStore(() => storage), projects = samples();
  return { values, storage, roster, projects, scope: S.createStore(projects, () => storage, () => roster.list()), get writes() { return writes; } };
}

test('가상 연구원 3명과 고객 담당자 7건은 실제 샘플 ID에 연결되고 조회는 쓰지 않는다', () => {
  const s = setup(), roster = s.roster.list();
  assert.equal(roster.items.length, 3);
  for (const project of s.projects) {
    assert.equal(Boolean(project.customerContactName), true);
    assert.equal(roster.items.find((person) => person.id === project.researcherId).name, project.researcherName);
  }
  assert.equal(roster.items.every((person) => person.isFictional), true);
  roster.items[0].name = '화면 변경';
  assert.equal(s.roster.list().items[0].name, '김하늘');
  assert.equal(s.writes, 0);
});

test('이름을 정리하고 샘플 다음 번호를 발급하며 재로딩 후에도 유지한다', () => {
  const s = setup(), added = s.roster.add('  최연구  ');
  assert.equal(added.ok, true);
  assert.equal(added.item.name, '최연구');
  assert.equal(added.item.code, 'RSR-004');
  assert.equal(R.createStore(() => s.storage).list().items[3].id, added.item.id);
});

test('동명이인을 번호로 구분하고 다른 저장 객체의 최신 등록을 이어 쓴다', () => {
  const s = setup(), other = R.createStore(() => s.storage);
  const one = s.roster.add('김하늘'), two = other.add('김하늘');
  assert.notEqual(one.item.id, two.item.id);
  assert.equal(two.item.code, 'RSR-005');
  assert.equal(s.roster.list().items.length, 5);
});

test('빈 이름·잘못된 형식·100자 초과를 거절하고 100자는 허용한다', () => {
  const s = setup();
  for (const name of ['', ' ', null, 123, '가'.repeat(101)]) assert.equal(s.roster.add(name).ok, false);
  assert.equal(s.writes, 0);
  assert.equal(s.roster.add('가'.repeat(100)).ok, true);
});

test('연구원 저장 실패는 기록·다음 번호를 보존한다', () => {
  const s = setup(), original = s.storage.setItem;
  s.storage.setItem = () => { throw Error('quota'); };
  assert.equal(s.roster.add('최연구').ok, false);
  assert.equal(s.values.size, 0);
  s.storage.setItem = original;
  assert.equal(s.roster.add('최연구').item.code, 'RSR-004');
});

test('손상·미지원 버전·중복 번호·접근 실패는 보존하고 차단한다', () => {
  const s = setup(); s.roster.add('최연구');
  const duplicate = JSON.parse(s.storage.getItem(R.STORAGE_KEY)); duplicate.researchers.push(duplicate.researchers[0]);
  for (const raw of ['{', 'null', '{"version":2,"nextNumber":4,"researchers":[]}', JSON.stringify(duplicate)]) {
    s.values.set(R.STORAGE_KEY, raw);
    assert.equal(s.roster.list().ok, false);
    assert.equal(s.roster.add('이연구').ok, false);
    assert.equal(s.storage.getItem(R.STORAGE_KEY), raw);
  }
  const blocked = R.createStore(() => { throw Error('blocked'); });
  assert.equal(blocked.list().ok, false);
  assert.equal(blocked.add('이연구').ok, false);
});

test('프로젝트 선택은 ID로 이름을 조회하며 단계·범위는 유지한다', () => {
  const s = setup(), person = s.roster.add('최연구').item, p = s.projects[6];
  const result = s.scope.saveAssignees(p.id, { customerContactName: ' 김고객 ', researcherId: person.id, researcherName: '조작한 이름' }, S.snapshot(p));
  assert.equal(result.ok, true);
  assert.equal(p.researcherId, person.id);
  assert.equal(p.researcherName, '최연구');
  assert.equal(p.customerContactName, '김고객');
  assert.equal(p.stage, 1);
  assert.equal(p.scopeStatus, '고객 요청안');
});

test('없는 연구원·손상 목록·범위 저장을 통한 담당자 우회 변경은 막는다', () => {
  const s = setup(), p = s.projects[6], before = JSON.stringify(p);
  assert.equal(s.scope.saveAssignees(p.id, { customerContactName: '고객', researcherId: 'researcher-user-999' }, S.snapshot(p)).ok, false);
  s.values.set(R.STORAGE_KEY, '{');
  assert.equal(s.scope.saveAssignees(p.id, { customerContactName: '고객', researcherId: 'researcher-sample-2' }, S.snapshot(p)).ok, false);
  assert.equal(JSON.stringify(p), before);
  assert.equal(s.scope.save(p.id, { ...S.snapshot(p), functionalUnit: { qty: '1', unit: '개' }, researcherId: 'researcher-sample-2', researcherName: '박서연' }, S.snapshot(p)).ok, true);
  assert.equal(p.researcherId, 'researcher-sample-1');
});

test('선택을 비우면 이름과 ID를 함께 비우고 단계 시작도 막는다', () => {
  const s = setup(), p = s.projects[6];
  assert.equal(s.scope.saveAssignees(p.id, { customerContactName: '고객', researcherId: '' }, S.snapshot(p)).ok, true);
  assert.equal(p.researcherName, '');
  assert.equal(p.researcherId, '');
  assert.equal(s.scope.startScope(p.id, S.snapshot(p)).ok, false);
});

test('예전 이름 기록·명시적으로 비운 이름은 유지하고 같은 이름에도 자동 연결하지 않는다', () => {
  const s = setup(), p = s.projects[6];
  s.scope.saveAssignees(p.id, { customerContactName: '직접 입력 고객', researcherName: '김하늘' }, S.snapshot(p));
  const data = JSON.parse(s.storage.getItem(S.STORAGE_KEY)); delete data.records[p.id].researcherId;
  const raw = JSON.stringify(data); s.values.set(S.STORAGE_KEY, raw);
  assert.equal(s.scope.load().ok, true);
  assert.equal(p.customerContactName, '직접 입력 고객');
  assert.equal(p.researcherName, '김하늘');
  assert.equal(p.researcherId, '');
  assert.equal(s.storage.getItem(S.STORAGE_KEY), raw);
  s.scope.saveAssignees(p.id, { customerContactName: '', researcherName: '' }, S.snapshot(p));
  assert.equal(s.scope.load().ok, true);
  assert.equal(p.customerContactName, '');
  assert.equal(p.researcherName, '');
});

test('담당자 키가 없던 범위 기록은 가상 기본값을 쓰되 읽기만으로 저장하지 않는다', () => {
  const s = setup(), p = s.projects[4];
  s.scope.save(p.id, { ...S.snapshot(p), functionalUnit: { qty: '1', unit: '장' }, scopeMemo: '기존 메모' }, S.snapshot(p));
  const data = JSON.parse(s.storage.getItem(S.STORAGE_KEY));
  for (const key of ['customerContactName', 'researcherName', 'researcherId']) delete data.records[p.id][key];
  const raw = JSON.stringify(data); s.values.set(S.STORAGE_KEY, raw);
  assert.equal(s.scope.load().ok, true);
  assert.equal(p.customerContactName, '정서현');
  assert.equal(p.researcherId, 'researcher-sample-3');
  assert.equal(p.scopeMemo, '기존 메모');
  assert.equal(p.stage, 2);
  assert.equal(s.storage.getItem(S.STORAGE_KEY), raw);
});

test('배정 조회는 ID로 합산하고 완료·미배정·기존 이름 기록을 구분한다', () => {
  const s = setup(), roster = s.roster.list().items;
  const projects = [...s.projects, { id: 'legacy', researcherName: '김하늘', researcherId: '' }, { id: 'empty' }];
  const before = JSON.stringify(projects), result = R.overview(roster, projects);
  assert.deepEqual(Array.from(result.rows, (row) => row.projects.length), [3, 2, 2]);
  assert.equal(result.rows[1].projects.some((project) => project.stage === 10), true);
  assert.equal(result.unlinked[0].id, 'legacy');
  assert.equal(result.unassigned[0].id, 'empty');
  assert.equal(JSON.stringify(projects), before);
});

test('동명이인 선택·범위 정의 이동 후 재로딩해도 같은 번호의 배정만 유지한다', () => {
  const s = setup(), person = s.roster.add('김하늘').item, p = s.projects[6];
  s.scope.saveAssignees(p.id, { customerContactName: '고객', researcherId: person.id }, S.snapshot(p));
  assert.equal(s.scope.startScope(p.id, S.snapshot(p)).ok, true);
  const fresh = samples();
  assert.equal(S.createStore(fresh, () => s.storage, () => s.roster.list()).load().ok, true);
  assert.equal(fresh[6].researcherId, person.id);
  assert.equal(fresh[6].stage, 2);
  const overview = R.overview(s.roster.list().items, fresh);
  assert.equal(overview.rows[0].projects.length, 2);
  assert.equal(overview.rows[3].projects.length, 1);
});

test('이름이 같아도 다른 화면에서 담당 ID가 바뀌면 이전 저장과 시작을 막는다', () => {
  const s = setup(), p = s.projects[6], expected = S.snapshot(p), person = s.roster.add('김하늘').item;
  assert.equal(s.scope.saveAssignees(p.id, { customerContactName: p.customerContactName, researcherId: person.id }, expected).ok, true);
  assert.equal(p.researcherName, expected.researcherName);
  assert.equal(s.scope.startScope(p.id, expected).ok, false);
  assert.equal(s.scope.saveAssignees(p.id, { customerContactName: '고객', researcherId: expected.researcherId }, expected).ok, false);
  assert.equal(p.researcherId, person.id);
});

test('기본 연구원은 가상 회사와 서로 다른 부서가 있고 읽기로 저장하지 않는다', () => {
  const s = setup(); const people = s.roster.list().items;
  assert.equal(people.every((p) => p.company === '새움환경컨설팅'), true);
  assert.equal(new Set(people.map((p) => p.department)).size, 3); assert.equal(s.writes, 0);
});
test('회사·부서를 함께 등록하고 예전 이름만 있는 기록은 빈 소속으로 읽는다', () => {
  const s = setup(); const added = s.roster.add(' 최연구 ', ' 가상회사 ', ' 평가팀 ').item;
  assert.equal(added.company, '가상회사'); assert.equal(added.department, '평가팀');
  const data = JSON.parse(s.storage.getItem(R.STORAGE_KEY)); delete data.researchers[0].company; delete data.researchers[0].department;
  const raw = JSON.stringify(data); s.values.set(R.STORAGE_KEY, raw);
  assert.equal(s.roster.list().items[3].company, ''); assert.equal(s.roster.list().items[3].department, ''); assert.equal(s.storage.getItem(R.STORAGE_KEY), raw);
});
test('기본·생성 연구원을 수정하고 번호·프로젝트 배정·과거 기록 이름은 유지한다', () => {
  const s = setup(); const before = JSON.stringify(s.projects); const original = s.roster.list().items[0];
  assert.equal(s.roster.update(original.id, { name: '김새이름', company: '가상연구소', department: '환경팀' }, original).ok, true);
  const updated = R.createStore(() => s.storage).list().items[0];
  assert.equal(updated.name, '김새이름'); assert.equal(updated.code, original.code); assert.equal(updated.revision, 1);
  assert.equal(JSON.stringify(s.projects), before); assert.equal(R.overview(s.roster.list().items, s.projects).rows[0].projects.length, 3);
  const created = s.roster.add('신규').item; const current = s.roster.list().items.find((p) => p.id === created.id);
  assert.equal(s.roster.update(current.id, { name: '신규', company: '생성회사', department: '평가팀' }, current).ok, true);
  assert.equal(s.roster.list().items.find((p) => p.id === current.id).company, '생성회사');
});
test('연구원 수정의 이전 리비전·없는 ID·빈 이름·긴 소속·변경 없음은 거절한다', () => {
  const s = setup(); const original = s.roster.list().items[0];
  for (const change of [{ name: '' }, { company: '가'.repeat(101) }, { department: null }]) assert.equal(s.roster.update(original.id, { ...original, ...change }, original).ok, false);
  assert.equal(s.roster.update('missing', original, original).ok, false); assert.equal(s.roster.update(original.id, original, original).ok, false);
  assert.equal(s.roster.update(original.id, { ...original, department: '새부서' }, original).ok, true);
  const saved = s.storage.getItem(R.STORAGE_KEY);
  assert.equal(s.roster.update(original.id, { ...original, company: '다른회사' }, original).ok, false); assert.equal(s.storage.getItem(R.STORAGE_KEY), saved);
});
test('연구원 수정 저장 실패는 현재 정보·다음 번호를 바꾸지 않는다', () => {
  const s = setup(); const person = s.roster.list().items[0]; const original = s.storage.setItem;
  s.storage.setItem = () => { throw Error('quota'); };
  assert.equal(s.roster.update(person.id, { ...person, department: '새부서' }, person).ok, false); assert.equal(s.roster.list().items[0].department, person.department);
  s.storage.setItem = original; assert.equal(s.roster.add('다음연구').item.code, 'RSR-004');
});
test('손상된 프로필·알 수 없는 ID는 읽기 실패로 보존한다', () => {
  const s = setup(); const person = s.roster.list().items[0];
  for (const profiles of [{ missing: { ...person, revision: 1 } }, { [person.id]: { ...person, revision: 0 } }, { [person.id]: { ...person, company: null, revision: 1 } }]) {
    const raw = JSON.stringify({ version: 1, nextNumber: 4, researchers: [], profiles }); s.values.set(R.STORAGE_KEY, raw);
    assert.equal(s.roster.list().ok, false); assert.equal(s.storage.getItem(R.STORAGE_KEY), raw);
  }
});
