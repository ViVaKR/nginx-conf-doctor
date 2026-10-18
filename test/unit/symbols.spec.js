'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { indexText, outline, resolveInclude, lintReferences, variableCandidates } = require('../../src/nginx/symbols');
const { createWorkspaceIndex } = require('../../src/nginx/workspace-index');

const names = (arr, kind) => arr.filter((x) => x.kind === kind).map((x) => x.name);
const text = (src, x) => src.slice(x.start, x.end);

// ---------------------------------------------------------------------------
// 정의 / 참조
// ---------------------------------------------------------------------------
test('upstream 정의와 proxy_pass 참조 (범위는 이름만)', () => {
  const src = 'upstream api {\n  server 1.1.1.1;\n}\nserver { location / { proxy_pass http://api/v1; } }\n';
  const r = indexText(src);
  assert.deepEqual(names(r.defs, 'upstream'), ['api']);
  assert.deepEqual(names(r.refs, 'upstream'), ['api']);
  assert.equal(text(src, r.refs.find((x) => x.kind === 'upstream')), 'api');
  const def = r.defs.find((x) => x.kind === 'upstream');
  assert.equal(text(src, def), 'api');
  assert.equal(def.line, 0);
});

test('*_pass 참조 형태: scheme/port/따옴표, $변수·unix 소켓은 제외', () => {
  const src = `
proxy_pass https://b1:8443;
grpc_pass grpc://b2;
fastcgi_pass b3;
proxy_pass "http://b4/x";
fastcgi_pass unix:/run/x.sock;
proxy_pass http://$host;
proxy_pass http://b_$sfx;
fastcgi_pass 127.0.0.1:9000;
`;
  const r = indexText(src);
  assert.deepEqual(names(r.refs, 'upstream'), ['b1', 'b2', 'b3', 'b4', '127.0.0.1']);
  assert.equal(text(src, r.refs.find((x) => x.name === 'b4')), 'b4'); // 따옴표/scheme 제외
});

test('변수 정의: set / map / geo / split_clients / auth_request_set / keyval / set_by_lua / $로 시작하는 행', () => {
  const src = `
set $a 1;
map $http_x $b { default 0; }
geo $remote_addr $c { default 0; }
geo $d { default 0; }
split_clients "\${remote_addr}x" $e { 50% a; * b; }
auth_request_set $f $upstream_http_x;
keyval $arg_k $g zone=z;
set_by_lua_block $h { return 1 }
geoip2 /x.mmdb { $geoip2_data_country country iso_code; }
`;
  const r = indexText(src);
  assert.deepEqual(names(r.defs, 'variable'), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'geoip2_data_country']);
});

test('정규식 이름 캡처 (?<name>) / (?P<name>) 도 변수 정의', () => {
  const src = 'location ~ ^/u/(?<uid>\\d+)/(?P<slug>[a-z]+) { }\nserver_name ~^(?<sub>.+)\\.a\\.com$;\n';
  const r = indexText(src);
  assert.deepEqual(names(r.defs, 'variable'), ['uid', 'slug', 'sub']);
  const uid = r.defs.find((x) => x.name === 'uid');
  assert.equal(text(src, uid), 'uid');
});

test('변수 참조: 단어/문자열/${ }, 숫자 캡처·주석은 제외', () => {
  const src = 'add_header X "a${x}b$y"; # $comment\nset $z $1$host;\n';
  const r = indexText(src);
  assert.deepEqual(names(r.refs, 'variable'), ['x', 'y', 'z', 'host']);
  assert.equal(text(src, r.refs.find((x) => x.name === 'x')), '${x}'); // 중괄호 포함 범위
});

test('include 경로: 단어/따옴표(따옴표 제외 범위), 변수 포함은 무시', () => {
  const src = 'include /etc/nginx/a.conf;\ninclude "b c.conf";\ninclude $x;\n';
  const r = indexText(src);
  assert.deepEqual(r.includes.map((i) => i.name), ['/etc/nginx/a.conf', 'b c.conf']);
  assert.equal(text(src, r.includes[1]), 'b c.conf');
});

// ---------------------------------------------------------------------------
// 아웃라인
// ---------------------------------------------------------------------------
test('아웃라인: server 는 server_name 을 detail 로, location/upstream 계층', () => {
  const src = 'upstream u { server 1.1.1.1; }\nserver {\n  server_name a.com b.com c.com;\n  location ~* \\.php$ {\n    if ($a) { return 1; }\n  }\n}\n';
  const o = outline(indexText(src).parsed);
  assert.deepEqual(o.map((x) => [x.name, x.detail, x.kind]), [
    ['upstream', 'u', 'class'],
    ['server', 'a.com b.com', 'namespace'],
  ]);
  const loc = o[1].children[0];
  assert.deepEqual([loc.name, loc.detail, loc.kind], ['location', '~* \\.php$', 'function']);
  assert.equal(loc.children[0].name, 'if');
});

test('아웃라인: 닫히지 않은 블록도 자식이 부모 범위 안에 있다', () => {
  const o = outline(indexText('http {\n server {\n  location / {\n').parsed);
  const server = o[0].children[0];
  const loc = server.children[0];
  assert.ok(o[0].end >= server.end && server.end >= loc.end);
  for (const n of [o[0], server, loc]) assert.ok(n.selStart >= n.start && n.selEnd <= n.end);
});

// ---------------------------------------------------------------------------
// include 경로 해석
// ---------------------------------------------------------------------------
const FILES = [
  { key: 'a', path: '/w/nginx/snippets/csp.conf' },
  { key: 'b', path: '/w/other/snippets/csp.conf' },
  { key: 'c', path: '/w/nginx/conf.d/site.conf' },
];

test('include: 서버 절대경로여도 뒤쪽 경로가 가장 길게 일치하는 파일', () => {
  assert.equal(resolveInclude('/etc/nginx/snippets/csp.conf', FILES, '/w/nginx/site.conf').key, 'a');
  assert.equal(resolveInclude('conf.d/site.conf', FILES).key, 'c');
  assert.equal(resolveInclude('site.conf', FILES).key, 'c');
});

test('include: 후보가 여럿이면 현재 파일과 가까운 것', () => {
  assert.equal(resolveInclude('snippets/csp.conf', FILES, '/w/other/x.conf').key, 'b');
  assert.equal(resolveInclude('snippets/csp.conf', FILES, '/w/nginx/x.conf').key, 'a');
});

test('include: 와일드카드/변수/없는 파일은 null', () => {
  assert.equal(resolveInclude('/etc/nginx/conf.d/*.conf', FILES), null);
  assert.equal(resolveInclude('/etc/$x/a.conf', FILES), null);
  assert.equal(resolveInclude('/etc/nginx/nothing.conf', FILES), null);
});

// ---------------------------------------------------------------------------
// 워크스페이스 인덱스
// ---------------------------------------------------------------------------
test('워크스페이스 인덱스: 정의 조회 / 이름 목록 / 삭제', () => {
  const ws = createWorkspaceIndex();
  ws.update('k1', '/a.conf', indexText('upstream x { }\nset $v 1;\n'));
  ws.update('k2', '/b.conf', indexText('upstream y { }\n'));
  assert.deepEqual([...ws.names('upstream')].sort(), ['x', 'y']);
  assert.deepEqual(ws.definitions('upstream', 'x').map((d) => d.key), ['k1']);
  assert.deepEqual([...ws.names('variable')], ['v']);
  assert.equal(ws.fileList().length, 2);
  ws.remove('k1');
  assert.deepEqual([...ws.names('upstream')], ['y']);
});

// ---------------------------------------------------------------------------
// 이름 오타 경고
// ---------------------------------------------------------------------------
const db = {
  variables: [
    { name: '$host' },
    { name: '$request_uri' },
    { name: '$arg_name', prefix: '$arg_' },
    { name: '$http_name', prefix: '$http_' },
  ],
};
function wsWith(...srcs) {
  const ws = createWorkspaceIndex();
  srcs.forEach((s, i) => ws.update(`k${i}`, `/f${i}.conf`, indexText(s)));
  return ws;
}
const UPSTREAMS = 'upstream buddham_api { server 1.1.1.1; }\nmap $http_upgrade $connection_upgrade { default 1; }\n';

test('upstream 오타: 정의된 이름과 비슷하면 경고 + 후보', () => {
  const src = 'location / { proxy_pass http://buddham_apy/x; }\n';
  const ws = wsWith(UPSTREAMS, src);
  const r = lintReferences(indexText(src), ws, db);
  assert.equal(r.length, 1);
  assert.equal(r[0].code, 'unknown-upstream');
  assert.deepEqual(r[0].suggestions, ['buddham_api']);
  assert.equal(text(src, r[0]), 'buddham_apy');
});

test('upstream: 호스트 이름(점)/localhost/비슷한 후보 없음/정의가 전혀 없음 → 침묵', () => {
  const src = [
    'proxy_pass http://api.example.com;',
    'proxy_pass http://localhost:3000;',
    'proxy_pass http://zzzzzzzz;',
    'fastcgi_pass 127.0.0.1:9000;',
    'proxy_pass http://buddham_api;', // 정의됨
  ].join('\n');
  assert.deepEqual(lintReferences(indexText(src), wsWith(UPSTREAMS, src), db), []);
  assert.deepEqual(lintReferences(indexText('proxy_pass http://buddham_apy;'), wsWith('proxy_pass http://buddham_apy;'), db), []);
});

test('변수 오타: 내장 변수와 비슷하면 경고 (${ } 형태는 중괄호 포함 범위)', () => {
  const src = 'add_header A $requst_uri;\nadd_header B "${requst_uri}";\n';
  const r = lintReferences(indexText(src), wsWith(src), db);
  assert.deepEqual(r.map((d) => d.code), ['unknown-variable', 'unknown-variable']);
  assert.deepEqual(r[0].suggestions, ['request_uri']);
  assert.equal(text(src, r[1]), '${requst_uri}');
});

test('변수: 내장/접두어 변수/정의된 변수/숫자 캡처/사용자 지정은 경고 없음', () => {
  const src = 'add_header A "$host $arg_foo $http_x_forwarded_for $connection_upgrade $1 $hostt";\n';
  const ws = wsWith(UPSTREAMS, src);
  const withTypo = lintReferences(indexText(src), ws, db);
  assert.deepEqual(withTypo.map((d) => text(src, d)), ['$hostt']); // 오타만 남음
  assert.deepEqual(lintReferences(indexText(src), ws, db, { extraVars: new Set(['hostt']) }), []);
});

test('변수: 비슷한 후보가 없으면 침묵 (서드파티 모듈 변수 등)', () => {
  const src = 'add_header A $geoip2_data_country_code;\n';
  assert.deepEqual(lintReferences(indexText(src), wsWith(src), db), []);
});

test('변수 후보 계산: 내장 + 정의됨 + 사용자 지정, 접두어 목록', () => {
  const c = variableCandidates(db, wsWith('set $mine 1;'), new Set(['extra']));
  assert.deepEqual([...c.candidates].sort(), ['arg_name', 'extra', 'host', 'http_name', 'mine', 'request_uri']);
  assert.deepEqual(c.prefixes, ['arg_', 'http_']);
});
