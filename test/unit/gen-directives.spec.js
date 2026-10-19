'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFixtureDocs } = require('./fixture-docs');
const { generate, stripTags } = require('../../scripts/gen-directives');

const { result, warnings } = generate(makeFixtureDocs());
// @ts-ignore
const find = (name, family) => result.directives.find((d) => d.name === name && d.family === family);

test('모듈 두 개를 읽고 경고가 없다', () => {
  assert.equal(result.modules.length, 2);
  assert.deepEqual(warnings, []);
});

test('family: 루트 파일은 core, http/ 아래는 http', () => {
  // @ts-ignore
  assert.equal(find('daemon', 'core').module, 'Core functionality');
  assert.ok(find('listen', 'http'));
});

test('block="yes" 자기닫힘 syntax → block: true', () => {
  const ev = find('events', 'core');
  // @ts-ignore
  assert.equal(ev.block, true);
  // @ts-ignore
  assert.equal(ev.syntaxes[0].line, 'events { ... }');
  // @ts-ignore
  assert.equal(ev.default, null);
});

test('syntax 여러 개 + 세미콜론 정리', () => {
  const l = find('listen', 'http');
  // @ts-ignore
  assert.equal(l.syntaxes.length, 2);
  // @ts-ignore
  assert.equal(l.syntaxes[0].line, 'listen address[:port] [default_server];');
  // @ts-ignore
  assert.equal(l.block, false);
});

test('block 속성 + 인자가 같이 있는 syntax', () => {
  const loc = find('location', 'http');
  // @ts-ignore
  assert.equal(loc.syntaxes[0].line, 'location [ = | ~ ] uri { ... }');
  // @ts-ignore
  assert.deepEqual(loc.contexts, ['server', 'location']);
});

test('context 의 "if in location" 같은 값 보존', () => {
  // @ts-ignore
  assert.deepEqual(find('return', 'http').contexts, ['server', 'location', 'if in server', 'if in location']);
});

test('설명: 첫 문단만, literal 은 백틱, 엔티티 디코딩', () => {
  // @ts-ignore
  assert.equal(find('listen', 'http').description, 'Sets the `address` and `port` & more; use <value>.');
});

test('docUrl', () => {
  // @ts-ignore
  assert.equal(find('listen', 'http').docUrl, 'https://nginx.org/en/docs/http/ngx_http_sample_module.html#listen');
});

test('내장 변수 추출 + 접두어 패턴 변수', () => {
  // @ts-ignore
  const host = result.variables.find((v) => v.name === '$host');
  // @ts-ignore
  assert.ok(host && host.prefix === null);
  // @ts-ignore
  const arg = result.variables.find((v) => v.name === '$arg_name');
  // @ts-ignore
  assert.equal(arg.prefix, '$arg_');
});

test('자기닫힘 <link/> 는 문서/지시어 이름으로 대체 (빈 따옴표 방지)', () => {
  assert.equal(stripTags('in the “<link doc="../server_names.xml"/>” document'), 'in the “server_names” document');
  assert.equal(stripTags('see <link id="listen"/>.', { backticks: true }), 'see `listen`.');
  assert.equal(stripTags('a <link id="x">text</link> b'), 'a text b'); // 내용 있는 링크는 그대로
});
