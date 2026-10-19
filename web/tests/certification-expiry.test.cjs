const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
for (const file of ['constants.js', 'rules.js', 'requests.js', 'review-workflow.js', 'certification.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), context, { filename: file });
}
const expiry = context.LCA.certification.expectedExpiry;
const renewal = context.LCA.certification.renewalSchedule;
const details = (changes = {}) => ({ kind: '인증', scheme: '환경성적표지', issuedOn: '2026-10-19', ...changes });

test('국내 인증은 발급일에서 3년 뒤 하루 전을 예상 만료일로 보여 준다', () => {
  assert.equal(expiry(details(), '승인·등록').date, '2029-10-18');
  assert.equal(expiry(details({ scheme: '저탄소제품', issuedOn: '2024-02-29' }), '승인·등록').date, '2027-02-28');
});

test('세 EPD 등록은 발급·등록일에서 5년 뒤를 예상한다', () => {
  for (const scheme of ['International EPD', 'EPD Norway', 'UL EPD']) {
    assert.equal(expiry(details({ kind: '등록', scheme }), '승인·등록').date, '2031-10-19');
  }
});

test('고객 확인일·미승인·제도 불일치·임의 제도·잘못된 날짜는 계산하지 않는다', () => {
  assert.equal(expiry(details({ kind: '고객 제출' }), '승인·등록'), null);
  assert.equal(expiry(details(), '제출 완료'), null);
  assert.equal(expiry(details({ kind: '등록' }), '승인·등록'), null);
  assert.equal(expiry(details({ scheme: '환경성적표지 비슷한 제도' }), '승인·등록'), null);
  assert.equal(expiry(details({ issuedOn: '2026-02-30' }), '승인·등록'), null);
  assert.equal(expiry(details({ issuedOn: '' }), '승인·등록'), null);
});

test('보통 제도는 예상 만료일 6개월 전, UL EPD는 60일 전부터 안내한다', () => {
  const ordinary = renewal(details(), '승인·등록', '2029-04-17');
  assert.equal(ordinary.startDate, '2029-04-18');
  assert.equal(ordinary.active, false);
  assert.equal(renewal(details(), '승인·등록', '2029-04-18').active, true);
  const ul = details({ kind: '등록', scheme: 'UL EPD' });
  assert.equal(renewal(ul, '승인·등록', '2031-08-19').active, false);
  assert.equal(renewal(ul, '승인·등록', '2031-08-20').active, true);
  assert.equal(renewal(ul, '승인·등록', '2031-08-20').startDate, '2031-08-20');
  assert.equal(renewal(ul, '승인·등록', '2031-10-20').days, -1);
  assert.equal(renewal(details({ kind: '고객 제출' }), '승인·등록'), null);
});

test('월말의 6개월 전 시작일은 해당 달 마지막 날짜로 맞춘다', () => {
  const schedule = renewal(details({ issuedOn: '2026-09-01' }), '승인·등록', '2029-02-27');
  assert.equal(schedule.date, '2029-08-31');
  assert.equal(schedule.startDate, '2029-02-28');
  assert.equal(schedule.active, false);
});

test('계산 규칙이 없는 제도도 문서 만료일을 확인했다면 그 날짜로 안내한다', () => {
  const direct = renewal(details({ scheme: '별도 인증 제도' }), '승인·등록', '2029-07-31', '2030-01-31');
  assert.equal(direct.official, true);
  assert.equal(direct.startDate, '2029-07-31');
  assert.equal(direct.active, true);
  assert.equal(renewal(details({ scheme: '별도 인증 제도' }), '승인·등록', '2029-07-31'), null);
});
