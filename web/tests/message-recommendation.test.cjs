const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const context = vm.createContext({}); vm.runInContext('window = globalThis;', context);
for (const name of ['constants','rules','requests','deadlines','request-message']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',`${name}.js`),'utf8'),context);
const { LCA } = context; LCA.rules.today = () => '2026-10-19';
const project = { id:'p', stage:3, companyName:'가상 회사', productName:'제품', customerContactName:'고객', researcherName:'연구원', targetDate:'2026-12-01', uses:['PCF'], functionalUnit:{qty:1,unit:'kg'}, boundary:'요람~문', scopeStatus:'확정', refStart:'2025-01-01', refEnd:'2025-12-31', standards:['ISO'] };
const item = (id,status,dueDate) => ({ id, projectId:'p', status, dueDate, categoryKey:'energy', detail:id, review:status === '보완 요청' ? {note:'합계 확인'} : undefined });
project.information = { contactDepartment:'자료팀', contactEmail:'demo@example.com', productCode:'DEMO', unitWeight:'1 kg', annualProduction:'100 kg', customerDueOn:'2026-12-01' };
const state = (items) => ({ok:true,project,items});
test('추천 우선순위는 기한 초과·보완과 임박·보완·임박·정보 확인·없음이다', () => {
  const revise = item('DRQ-0001','보완 요청','2026-10-01'); const soon = item('DRQ-0002','요청','2026-10-22'); const overdue = item('DRQ-0003','요청','2026-10-18');
  for (const [items,type] of [[[overdue],'followup'],[[revise,soon],'followup'],[[revise],'revision'],[[soon],'upcoming'],[[] ,null]]) assert.equal(LCA.requestMessage.recommend(state(items)).type,type);
  assert.equal(LCA.requestMessage.recommend({...state([]),project:{...project,uses:[]}}).type,'info');
  assert.equal(LCA.requestMessage.recommend({...state([overdue]),project:{...project,stage:9}}).ok,false);
});
test('종합 안내는 세 집단을 구분하고 받은 자료·삭제·해당 없음은 제외한다', () => {
  const items = [item('DRQ-0001','요청','2026-10-18'), item('DRQ-0002','보완 요청','2026-10-01'),item('DRQ-0003','요청','2026-11-01'),item('DRQ-0004','검토 중','2026-10-01'),item('DRQ-0005','해당 없음','2026-10-01'),{...item('DRQ-0006','요청','2026-10-01'),deletedAt:'today'}];
  const input = state(items); const before = JSON.stringify(input); const rec = LCA.requestMessage.recommend(input);
  assert.deepEqual(Array.from(rec.ids),['DRQ-0001','DRQ-0002','DRQ-0003']);
  const built = LCA.requestMessage.build(input,'followup',rec.ids); assert.equal(built.ok,true,built.error);
  assert.match(built.body,/기한 지난 미제출 자료/); assert.match(built.body,/보완이 필요한 자료/); assert.match(built.body,/아직 기한 전인/); assert.match(built.body,/합계 확인/);
  for (const id of ['DRQ-0004','DRQ-0005','DRQ-0006']) assert.equal(built.body.includes(id),false);
  assert.equal(JSON.stringify(input),before);
  items[1].review.note='변경'; assert.equal(LCA.requestMessage.check(input,'followup',rec.ids,built.fingerprint).ok,false);
});
