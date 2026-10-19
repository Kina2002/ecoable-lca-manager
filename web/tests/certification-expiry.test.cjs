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
