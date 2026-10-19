const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'requests.js', 'review-workflow.js', 'certification.js', 'tasks.js', 'dashboard.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
}
const { LCA } = context;
LCA.projectFilter = { researcherOptions: () => [], select: (projects) => projects };
const project = { id: 'p', code: 'LCA-2026-001', companyName: '가상회사', productName: '가상제품', researcherName: '가상 연구원', stage: 10 };
const details = { kind: '인증', scheme: '환경성적표지', issuedOn: '2026-10-19' };
const requests = { ok: true, items: [] };
const input = (certifications) => ({ projects: [project], requests, comments: { ok: true, items: [] }, verifications: {}, certifications });

test('완료 프로젝트도 6개월 전부터 갱신 확인 할 일과 홈 요약에 나타난다', () => {
  const certifications = { ok: true, items: [{ projectId: 'p', status: '승인·등록', details }] };
  assert.equal(LCA.tasks.build(input(certifications), '2029-04-17').items.length, 0);
  const tasks = LCA.tasks.build(input(certifications), '2029-04-18');
  assert.equal(tasks.items.length, 1);
  assert.equal(tasks.items[0].kind, 'renewal');
  assert.equal(tasks.items[0].tab, 'certification');
  assert.equal(tasks.items[0].date, '2029-10-18');
  assert.equal(tasks.items[0].readOnly, true);
  assert.equal(LCA.tasks.deadline(tasks.items[0]).label, '예상 만료일');
  const home = LCA.dashboard.build({ projects: [project], requests, tasks, researchers: { ok: true, items: [] } }, '2029-04-18');
  assert.equal(home.activeCount, 0);
  assert.equal(home.taskCount, 1);
  assert.equal(home.attentionCount, 1);
});

test('고객 제출과 읽기 실패는 갱신 알림을 만들지 않고 실패를 알린다', () => {
  const customer = LCA.tasks.build(input({ ok: true, items: [{ projectId: 'p', status: '승인·등록', details: { ...details, kind: '고객 제출' } }] }), '2029-10-18');
  assert.equal(customer.items.length, 0);
  const failure = LCA.tasks.build(input({ ok: false, error: '인증 기록 손상' }), '2029-10-18');
  assert.equal(failure.items.length, 0);
  assert.match(failure.warnings.join(' '), /인증 기록 손상/);
});
