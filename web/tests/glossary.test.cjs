// 실행: node --test web/tests/*.test.cjs (추가 패키지 설치 없음)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext('window = globalThis;', context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'glossary.js'), 'utf8'), context);
const { TERMS, SOURCES, search } = context.LCA.glossary;
const ids = (query) => Array.from(search(query), (entry) => entry.id);

test('공백 검색은 전체, 없는 말과 기호만 쓴 검색은 0건이다', () => {
  assert.equal(search('').length, TERMS.length);
  assert.deepEqual(ids('  \t '), ids(''));
  assert.deepEqual(ids('없는용어987654'), []);
  assert.deepEqual(ids('[]()'), []);
});

test('영문 대소문자·전각·아래첨자를 같은 글자로 검색한다', () => {
  assert.deepEqual(ids('pcf'), ids('PCF'));
  assert.deepEqual(ids('ＰＣＦ'), ids('PCF'));
  assert.deepEqual(ids('kgCO₂e'), ids('kgCO2e'));
  assert.ok(ids('kgCO2e').includes('co2e'));
});

test('띄어쓰기·하이픈·물결표 차이와 한글 별칭을 허용한다', () => {
  assert.deepEqual(ids('기능 단위'), ids('기능단위'));
  assert.deepEqual(ids('cradle to gate'), ids('cradle-to-gate'));
  assert.deepEqual(ids('요람 문'), ids('요람~문'));
  assert.ok(ids('카테나엑스').includes('catena'));
  assert.ok(ids('피씨에프').includes('pcf'));
});

test('이름 외에 쉬운 뜻과 가상 예시도 검색한다', () => {
  assert.ok(ids('원료 확보').includes('cradle-gate'));
  assert.ok(ids('솔뫼철강').includes('modules'));
  assert.ok(ids('전기요금 고지서').includes('evidence'));
});

test('검색어를 정규식 명령으로 실행하지 않고 원본·순서를 보존한다', () => {
  const before = JSON.stringify(TERMS);
  assert.doesNotThrow(() => search('[a-z]+(.*)'));
  assert.deepEqual(ids('<script>alert(1)</script>'), []);
  const selected = search('요람');
  assert.ok(selected.length > 0);
  assert.ok(selected.every((entry, index) => index === 0 || TERMS.indexOf(selected[index - 1]) < TERMS.indexOf(entry)));
  assert.equal(JSON.stringify(TERMS), before);
  assert.notEqual(search(''), TERMS);
});

test('사전 40개의 고유 ID·설명·예시·출처 연결을 확인한다', () => {
  assert.equal(TERMS.length, 40);
  assert.equal(new Set(TERMS.map((entry) => entry.id)).size, TERMS.length);
  for (const entry of TERMS) {
    assert.ok(entry.term && entry.category && entry.meaning && entry.example);
    assert.ok(Array.isArray(entry.aliases));
    assert.ok(SOURCES[entry.source], entry.id + '의 출처 없음');
    const source = SOURCES[entry.source];
    assert.ok(source.url ? new URL(source.url).protocol === 'https:' : source.note);
  }
});
