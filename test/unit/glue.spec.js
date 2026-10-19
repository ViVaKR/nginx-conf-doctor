'use strict';
// 가짜 vscode 모듈로 연결부(diagnostics.js / quickfix.js / extension.js)를 실제로 실행해 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const { createDirectiveDb } = require('../../src/nginx/directive-db');

function makeFake() {
  const handlers = {};
  const cfg = {};
  const providers = [];
  const completionProviders = [];
  const hoverProviders = [];
  const formatProviders = [];
  const rangeFormatProviders = [];
  const definitionProviders = [];
  const linkProviders = [];
  const symbolProviders = [];
  const referenceProviders = [];
  const renameProviders = [];
  const files = {}; // 가짜 파일시스템: path -> text
  const Uri = (p) => ({ path: p, fsPath: p, toString: () => 'file://' + p });
  const collection = { last: null, set(uri, d) { this.last = d; }, delete() {}, dispose() {} };
  class Position { constructor(l, c) { this.line = l; this.character = c; } }
  class Range { constructor(a, b) { this.start = a; this.end = b; } }
  class Diagnostic { constructor(range, message, severity) { Object.assign(this, { range, message, severity }); } }
  class CodeAction { constructor(title, kind) { this.title = title; this.kind = kind; } }
  class CompletionItem { constructor(label, kind) { this.label = label; this.kind = kind; } }
  class CompletionList { constructor(items, incomplete) { this.items = items; this.isIncomplete = incomplete; } }
  class TextEdit { static replace(range, newText) { return { range, newText }; } }
  class Location { constructor(uri, range) { this.uri = uri; this.range = range; } }
  class DocumentLink { constructor(range, target) { this.range = range; this.target = target; } }
  class DocumentSymbol { constructor(name, detail, kind, range, selectionRange) { Object.assign(this, { name, detail, kind, range, selectionRange, children: [] }); } }
  class Hover { constructor(contents, range) { this.contents = contents; this.range = range; } }
  class SnippetString { constructor(value) { this.value = value; } }
  class MarkdownString { constructor(value) { this.value = value; } }
  class WorkspaceEdit { constructor() { this.edits = []; } replace(uri, range, text) { this.edits.push({ uri, range, text }); } }
  const sub = (name) => (fn) => { handlers[name] = fn; return { dispose() {} }; };
  const doc = { languageId: 'nginx', uri: Uri('/t.nginx.conf'), text: '' };
  const offsetAt = (p) => {
    const lines = doc.text.split('\n');
    return lines.slice(0, p.line).reduce((n, l) => n + l.length + 1, 0) + p.character;
  };
  doc.getText = (range) => (range ? doc.text.slice(offsetAt(range.start), offsetAt(range.end)) : doc.text);
  doc.offsetAt = offsetAt;
  doc.positionAt = (o) => {
    const before = doc.text.slice(0, o).split('\n');
    return new Position(before.length - 1, before[before.length - 1].length);
  };
  const vscode = {
    Position, Range, Diagnostic, CodeAction, WorkspaceEdit,
    CompletionItem, CompletionList, SnippetString, MarkdownString, Hover, TextEdit,
    Location, DocumentLink, DocumentSymbol,
    SymbolKind: { Namespace: 2, Class: 4, Function: 11, Variable: 12, Object: 18, Struct: 22 },
    CompletionItemKind: { Keyword: 13, Struct: 21, Variable: 5 },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    CodeActionKind: { QuickFix: 'quickfix' },
    languages: {
      createDiagnosticCollection: () => collection,
      registerCodeActionsProvider: (sel, p) => { providers.push(p); return { dispose() {} }; },
      registerDocumentFormattingEditProvider: (sel, p) => { formatProviders.push(p); return { dispose() {} }; },
      registerDocumentRangeFormattingEditProvider: (sel, p) => { rangeFormatProviders.push(p); return { dispose() {} }; },
      registerDefinitionProvider: (sel, p) => { definitionProviders.push(p); return { dispose() {} }; },
      registerDocumentLinkProvider: (sel, p) => { linkProviders.push(p); return { dispose() {} }; },
      registerReferenceProvider: (sel, p) => { referenceProviders.push(p); return { dispose() {} }; },
      registerRenameProvider: (sel, p) => { renameProviders.push(p); return { dispose() {} }; },
      registerDocumentSymbolProvider: (sel, p) => { symbolProviders.push(p); return { dispose() {} }; },
      registerHoverProvider: (sel, p) => { hoverProviders.push(p); return { dispose() {} }; },
      registerCompletionItemProvider: (sel, p) => { completionProviders.push(p); return { dispose() {} }; },
    },
    workspace: {
      textDocuments: [doc],
      onDidOpenTextDocument: sub('open'),
      onDidChangeTextDocument: sub('change'),
      onDidCloseTextDocument: sub('close'),
      onDidChangeConfiguration: sub('config'),
      getConfiguration: () => ({ get: (k, d) => (k in cfg ? cfg[k] : d) }),
      onDidChangeWorkspaceFolders: sub('folders'),
      findFiles: async () => Object.keys(files).map(Uri),
      fs: { readFile: async (u) => Buffer.from(files[u.path] || '', 'utf8') },
      createFileSystemWatcher: () => ({
        onDidChange(fn) { handlers.fsChange = fn; },
        onDidCreate(fn) { handlers.fsCreate = fn; },
        onDidDelete(fn) { handlers.fsDelete = fn; },
        dispose() {},
      }),
    },
    window: { visibleTextEditors: [], onDidChangeTextEditorSelection: sub('selection') },
  };
  return { vscode, doc, collection, cfg, handlers, providers, completionProviders, hoverProviders, formatProviders, rangeFormatProviders,
    definitionProviders, linkProviders, symbolProviders, referenceProviders, renameProviders, files, Uri };
}

function load(fake) {
  const orig = Module._load;
  Module._load = function (req, ...rest) {
    return req === 'vscode' ? fake.vscode : orig.call(this, req, ...rest);
  };
  for (const k of Object.keys(require.cache)) if (/[\\/]src[\\/](diagnostics|quickfix|completion|hover|format|navigation|workspace-index)\.js$|[\\/]extension\.js$/.test(k)) delete require.cache[k];
  try {
    return {
      diagnostics: require('../../src/diagnostics'),
      quickfix: require('../../src/quickfix'),
      completion: require('../../src/completion'),
      hover: require('../../src/hover'),
      format: require('../../src/format'),
      navigation: require('../../src/navigation'),
      service: require('../../src/workspace-index'),
    };
  } finally {
    Module._load = orig;
  }
}

const db = createDirectiveDb({
  directives: ['server', 'listen', 'server_name'].map((name) => ({ name, family: 'http' })),
});

test('열자마자 진단: 세미콜론 누락 + 알 수 없는 지시어(경고)', () => {
  const fake = makeFake();
  fake.doc.text = 'server {\n  listen 80;\n  lisen 8080;\n  server_name x\n}\n';
  const { diagnostics } = load(fake);
  diagnostics.registerDiagnostics({ subscriptions: [] }, db);

  const d = fake.collection.last;
  assert.deepEqual(d.map((x) => x.code).sort(), ['missing-semicolon', 'unknown-directive']);
  const unknown = d.find((x) => x.code === 'unknown-directive');
  assert.equal(unknown.severity, 1); // Warning
  assert.equal(unknown.range.start.line, 2);
  assert.equal(unknown.source, 'nginx-conf-doctor');
});

test('빠른 수정: lisen → listen', () => {
  const fake = makeFake();
  fake.doc.text = 'server {\n  lisen 8080;\n}\n';
  const { diagnostics, quickfix } = load(fake);
  diagnostics.registerDiagnostics({ subscriptions: [] }, db);
  quickfix.registerQuickFix({ subscriptions: [] }, db);

  const actions = fake.providers[0].provideCodeActions(fake.doc, null, { diagnostics: fake.collection.last });
  assert.equal(actions.length, 1);
  assert.match(actions[0].title, /listen/);
  assert.equal(actions[0].edit.edits[0].text, 'listen');
  assert.equal(actions[0].isPreferred, true);
});

test('설정: 심각도 off / extraDirectives 로 즉시 재검사', () => {
  const fake = makeFake();
  fake.doc.text = 'server {\n  lisen 8080;\n}\n';
  const { diagnostics } = load(fake);
  diagnostics.registerDiagnostics({ subscriptions: [] }, db);
  assert.equal(fake.collection.last.length, 1);

  fake.cfg.extraDirectives = ['lisen'];
  fake.handlers.config({ affectsConfiguration: () => true });
  assert.equal(fake.collection.last.length, 0);

  fake.cfg.extraDirectives = [];
  fake.cfg.unknownDirectiveSeverity = 'off';
  fake.handlers.config({ affectsConfiguration: () => true });
  assert.equal(fake.collection.last.length, 0);
});

test('지시어 데이터(db) 없이도 구조 진단은 동작, 알 수 없는 지시어는 검사 안 함', () => {
  const fake = makeFake();
  fake.doc.text = 'server {\n  lisen 8080\n}\n';
  const { diagnostics } = load(fake);
  diagnostics.registerDiagnostics({ subscriptions: [] }, null);
  assert.deepEqual(fake.collection.last.map((x) => x.code), ['missing-semicolon']);
});

const E = (name, family, contexts, block = false) => ({
  name, family, module: 'm', contexts, block, default: null, description: `${name} 설명`, docUrl: null,
  syntaxes: [{ text: block ? '' : 'arg', block, line: `${name};` }],
});
const dbC = createDirectiveDb({
  directives: [
    E('http', 'http', ['main'], true),
    E('server', 'http', ['http'], true),
    E('listen', 'http', ['server']),
    E('proxy_pass', 'http', ['location']),
    E('gzip', 'http', ['http', 'server', 'location']),
  ],
  variables: [{ name: '$host', prefix: null, family: 'http', module: 'ngx_http_core_module', description: 'host' }],
});

test('자동완성: server 블록 안에서 lis → 컨텍스트에 맞는 지시어만 + 스니펫', () => {
  const fake = makeFake();
  fake.doc.text = 'http {\n  server {\n    lis\n  }\n}\n';
  const { completion } = load(fake);
  completion.registerCompletion({ subscriptions: [] }, dbC);

  const offset = fake.doc.text.indexOf('lis') + 3;
  const list = fake.completionProviders[0].provideCompletionItems(fake.doc, fake.doc.positionAt(offset));
  const labels = list.items.map((i) => i.label);
  assert.deepEqual(labels, ['gzip', 'listen']); // proxy_pass(location 전용), http/server 는 제외
  const listen = list.items.find((i) => i.label === 'listen');
  assert.equal(listen.insertText.value, 'listen ${1};$0');
  assert.equal(listen.range.inserting.start.character, 4);
  assert.equal(listen.range.inserting.end.character, 7);
  assert.ok(listen.documentation.value.includes('listen'));
});

test('자동완성: 주석 안에서는 아무것도 제안하지 않는다', () => {
  const fake = makeFake();
  fake.doc.text = 'server {\n  # lis\n}\n';
  const { completion } = load(fake);
  completion.registerCompletion({ subscriptions: [] }, dbC);
  const offset = fake.doc.text.indexOf('lis') + 3;
  assert.equal(fake.completionProviders[0].provideCompletionItems(fake.doc, fake.doc.positionAt(offset)), undefined);
});

test('자동완성: $ 변수', () => {
  const fake = makeFake();
  fake.doc.text = 'server {\n  return 200 "$ho";\n}\n';
  const { completion } = load(fake);
  completion.registerCompletion({ subscriptions: [] }, dbC);
  const offset = fake.doc.text.indexOf('$ho') + 3;
  const list = fake.completionProviders[0].provideCompletionItems(fake.doc, fake.doc.positionAt(offset));
  assert.deepEqual(list.items.map((i) => i.label), ['$host']);
  assert.equal(list.items[0].insertText, '$host');
});

test('자동완성: db 가 없으면 등록하지 않는다', () => {
  const fake = makeFake();
  const { completion } = load(fake);
  completion.registerCompletion({ subscriptions: [] }, null);
  assert.equal(fake.completionProviders.length, 0);
});

test('hover: listen 위에서 문서가 나오고, 인자 위에서는 나오지 않는다', () => {
  const fake = makeFake();
  fake.doc.text = 'http {\n  server {\n    listen 80;\n  }\n}\n';
  const { hover } = load(fake);
  hover.registerHover({ subscriptions: [] }, dbC);

  const on = fake.doc.text.indexOf('listen') + 2;
  const h = fake.hoverProviders[0].provideHover(fake.doc, fake.doc.positionAt(on));
  assert.ok(h.contents.value.includes('listen'));
  assert.equal(h.range.start.character, 4);
  assert.equal(h.range.end.character, 10);

  const arg = fake.doc.text.indexOf('80');
  assert.equal(fake.hoverProviders[0].provideHover(fake.doc, fake.doc.positionAt(arg)), undefined);
});

test('진단: 컨텍스트 오류(server 안의 proxy_pass)가 경고로 나오고, 설정으로 끌 수 있다', () => {
  const fake = makeFake();
  fake.doc.text = 'http {\n  server {\n    proxy_pass x;\n  }\n}\n';
  const { diagnostics } = load(fake);
  diagnostics.registerDiagnostics({ subscriptions: [] }, dbC);

  const d = fake.collection.last.find((x) => x.code === 'directive-not-allowed');
  assert.ok(d);
  assert.equal(d.severity, 1); // Warning
  assert.equal(d.range.start.line, 2);

  fake.cfg.contextSeverity = 'off';
  fake.handlers.config({ affectsConfiguration: () => true });
  assert.equal(fake.collection.last.some((x) => x.code === 'directive-not-allowed'), false);
});

// 편집을 문자열에 적용해 보는 도우미 (줄 단위 교체)
function applyLineEdits(text, edits) {
  const ls = text.split('\n');
  for (const e of edits) {
    const i = e.range.start.line;
    ls[i] = e.newText + (ls[i].endsWith('\r') ? '\r' : '');
  }
  return ls.join('\n');
}

test('포매터: 문서 전체 — 바뀐 줄만 편집으로 돌려준다', () => {
  const fake = makeFake();
  fake.doc.text = 'http {\n   server {\nlisten 80;\n  }\n}\n';
  const { format } = load(fake);
  format.registerFormatter({ subscriptions: [] }, dbC);

  const edits = fake.formatProviders[0].provideDocumentFormattingEdits(fake.doc, { tabSize: 4, insertSpaces: true });
  assert.equal(applyLineEdits(fake.doc.text, edits), 'http {\n    server {\n        listen 80;\n    }\n}\n');
  assert.equal(edits.length, 3); // 안 바뀐 첫 줄/마지막 줄은 편집 없음
});

test('포매터: 선택 영역 — 범위 안의 줄만', () => {
  const fake = makeFake();
  fake.doc.text = 'http {\nserver {\nlisten 80;\n}\n}\n';
  const { format } = load(fake);
  format.registerFormatter({ subscriptions: [] }, dbC);

  const range = { start: { line: 2, character: 0 }, end: { line: 2, character: 9 } };
  const edits = fake.rangeFormatProviders[0].provideDocumentRangeFormattingEdits(
    fake.doc, range, { tabSize: 4, insertSpaces: true });
  assert.equal(edits.length, 1);
  assert.equal(edits[0].range.start.line, 2);
  assert.equal(edits[0].newText, '        listen 80;'); // 깊이는 문서 전체 맥락으로 계산
});

test('포매터: CRLF 문서 — 편집 범위는 \\r 제외, 새 텍스트에 \\r 없음', () => {
  const fake = makeFake();
  fake.doc.text = 'server {\r\nlisten 80;\r\n}\r\n';
  const { format } = load(fake);
  format.registerFormatter({ subscriptions: [] }, dbC);

  const edits = fake.formatProviders[0].provideDocumentFormattingEdits(fake.doc, { tabSize: 4, insertSpaces: true });
  assert.equal(edits.length, 1);
  assert.equal(edits[0].range.end.character, 'listen 80;'.length);
  assert.ok(!edits[0].newText.includes('\r'));
  assert.equal(applyLineEdits(fake.doc.text, edits), 'server {\r\n    listen 80;\r\n}\r\n');
});

test('포매터: 이미 정리된 문서는 편집 0개 / db 없이도 동작', () => {
  const fake = makeFake();
  fake.doc.text = 'server {\n    listen 80;\n}\n';
  const { format } = load(fake);
  format.registerFormatter({ subscriptions: [] }, null);
  assert.deepEqual(fake.formatProviders[0].provideDocumentFormattingEdits(fake.doc, { tabSize: 4, insertSpaces: true }), []);
});

// ---------------------------------------------------------------------------
// 워크스페이스 인덱스 / 내비게이션 / 이름 오타 경고 (가짜 파일시스템)
// ---------------------------------------------------------------------------
const navDb = createDirectiveDb({
  directives: [
    E('server', 'http', ['http'], true),
    E('location', 'http', ['server', 'location'], true),
    E('proxy_pass', 'http', ['location']),
    E('proxy_set_header', 'http', ['http', 'server', 'location']),
    E('include', 'core', ['any']),
    E('upstream', 'http', ['http'], true),
    E('map', 'http', ['http'], true),
  ],
  variables: [
    { name: '$host', prefix: null, family: 'http', module: 'ngx_http_core_module', description: 'host' },
    { name: '$request_uri', prefix: null, family: 'http', module: 'ngx_http_core_module', description: 'uri' },
  ],
});
const UPSTREAMS_CONF = 'upstream buddham_api {\n  server 127.0.0.1:1;\n}\nmap $http_upgrade $connection_upgrade { default upgrade; }\n';
const SITE_OK = 'server {\n  location / {\n    proxy_pass http://buddham_api/x;\n    proxy_set_header Upgrade $connection_upgrade;\n    include /etc/nginx/snippets/a.conf;\n  }\n}\n';
const SITE_TYPO = 'server {\n  location / {\n    proxy_pass http://buddham_apy/x;\n    proxy_set_header Host $requst_uri;\n  }\n}\n';

async function setupWorkspace(siteText) {
  const fake = makeFake();
  fake.files['/w/nginx/upstreams.conf'] = UPSTREAMS_CONF;
  fake.files['/w/nginx/snippets/a.conf'] = 'proxy_set_header X 1;\n';
  fake.files['/w/nginx/site.conf'] = siteText;
  fake.doc.uri = fake.Uri('/w/nginx/site.conf');
  fake.doc.text = siteText;
  const mods = load(fake);
  const ctx = { subscriptions: [] };
  const service = mods.service.createWorkspaceService(ctx, { isKnownDirective: navDb.isKnownDirective });
  await service.ready;
  return { fake, mods, ctx, service };
}
const at = (fake, needle, add = 2) => fake.doc.positionAt(fake.doc.text.indexOf(needle) + add);

test('인덱스 서비스: 시작 시 파일을 스캔해 upstream/변수 정의를 모은다 (열려 있는 문서는 편집 중 내용 사용)', async () => {
  const { service } = await setupWorkspace(SITE_OK);
  assert.equal(service.ws.fileList().length, 3);
  const defs = service.ws.definitions('upstream', 'buddham_api');
  assert.equal(defs.length, 1);
  assert.equal(service.uriOf(defs[0].key).path, '/w/nginx/upstreams.conf');
  assert.deepEqual([...service.ws.names('variable')], ['connection_upgrade']);
});

test('인덱스 서비스: 파일 변경/삭제 감시', async () => {
  const { fake, service } = await setupWorkspace(SITE_OK);
  let notified = 0;
  service.onDidChange(() => notified++);

  fake.files['/w/nginx/upstreams.conf'] = 'upstream renamed_api { }\n';
  await fake.handlers.fsChange(fake.Uri('/w/nginx/upstreams.conf'));
  assert.deepEqual([...service.ws.names('upstream')], ['renamed_api']);
  assert.equal(notified, 1);

  fake.handlers.fsDelete(fake.Uri('/w/nginx/upstreams.conf'));
  assert.deepEqual([...service.ws.names('upstream')], []);
  assert.equal(service.ws.fileList().length, 2);
});

test('정의로 이동: upstream 이름 / $변수 / include 경로 / 아무 데도 아닌 곳', async () => {
  const { fake, mods, service } = await setupWorkspace(SITE_OK);
  mods.navigation.registerNavigation({ subscriptions: [] }, service);
  const def = fake.definitionProviders[0];

  const up = def.provideDefinition(fake.doc, at(fake, 'buddham_api'));
  assert.equal(up.length, 1);
  assert.equal(up[0].uri.path, '/w/nginx/upstreams.conf');
  assert.equal(up[0].range.start.line, 0);

  const v = def.provideDefinition(fake.doc, at(fake, '$connection_upgrade'));
  assert.equal(v[0].uri.path, '/w/nginx/upstreams.conf');
  assert.equal(v[0].range.start.line, 3); // map 줄

  const inc = def.provideDefinition(fake.doc, at(fake, '/etc/nginx/snippets/a.conf', 10));
  assert.equal(inc.uri.path, '/w/nginx/snippets/a.conf'); // 서버 경로 → 워크스페이스 파일

  assert.equal(def.provideDefinition(fake.doc, at(fake, 'server {', 1)), undefined);
});

test('include 링크 / 아웃라인', async () => {
  const { fake, mods, service } = await setupWorkspace(SITE_OK);
  mods.navigation.registerNavigation({ subscriptions: [] }, service);

  const links = fake.linkProviders[0].provideDocumentLinks(fake.doc);
  assert.equal(links.length, 1);
  assert.equal(links[0].target.path, '/w/nginx/snippets/a.conf');
  assert.equal(fake.doc.getText(links[0].range), '/etc/nginx/snippets/a.conf');

  const symbols = fake.symbolProviders[0].provideDocumentSymbols(fake.doc);
  assert.equal(symbols.length, 1);
  assert.equal(symbols[0].name, 'server'); // server_name 이 없으면 이름만
  assert.equal(symbols[0].kind, 2); // Namespace
  assert.equal(symbols[0].children[0].name, 'location /');
  assert.equal(symbols[0].children[0].kind, 11); // Function
});

test('진단: upstream/변수 오타 경고 + 빠른 수정, 설정으로 끄기', async () => {
  const { fake, mods, service } = await setupWorkspace(SITE_TYPO);
  mods.diagnostics.registerDiagnostics({ subscriptions: [] }, navDb, service);
  mods.quickfix.registerQuickFix({ subscriptions: [] }, navDb, service);

  const diags = fake.collection.last;
  const up = diags.find((d) => d.code === 'unknown-upstream');
  const va = diags.find((d) => d.code === 'unknown-variable');
  assert.ok(up && va);
  assert.equal(up.severity, 1); // Warning
  assert.equal(fake.doc.getText(up.range), 'buddham_apy');
  assert.equal(fake.doc.getText(va.range), '$requst_uri');

  const actions = fake.providers[0].provideCodeActions(fake.doc, null, { diagnostics: diags });
  const titles = actions.map((a) => a.title);
  assert.ok(titles.includes("'buddham_api' 로 바꾸기"));
  assert.ok(titles.includes("'$request_uri' 로 바꾸기"));
  assert.equal(actions.find((a) => a.title.includes('$request_uri')).edit.edits[0].text, '$request_uri');

  fake.cfg.referenceSeverity = 'off';
  fake.handlers.config({ affectsConfiguration: () => true });
  assert.equal(fake.collection.last.some((d) => d.code === 'unknown-upstream' || d.code === 'unknown-variable'), false);

  fake.cfg.referenceSeverity = 'warning';
  fake.cfg.extraVariables = ['requst_uri'];
  fake.handlers.config({ affectsConfiguration: () => true });
  assert.equal(fake.collection.last.some((d) => d.code === 'unknown-variable'), false); // 사용자 지정 변수는 허용
  assert.equal(fake.collection.last.some((d) => d.code === 'unknown-upstream'), true);
});

test('진단: 올바른 설정은 오타 경고가 없다', async () => {
  const { fake, mods, service } = await setupWorkspace(SITE_OK);
  mods.diagnostics.registerDiagnostics({ subscriptions: [] }, navDb, service);
  assert.deepEqual(fake.collection.last.map((d) => d.code), []);
});

test('진단: 다른 파일의 upstream 정의가 바뀌면 열려 있는 문서를 다시 검사한다', async () => {
  const { fake, mods, service } = await setupWorkspace(SITE_OK);
  mods.diagnostics.registerDiagnostics({ subscriptions: [] }, navDb, service);
  assert.equal(fake.collection.last.some((d) => d.code === 'unknown-upstream'), false);

  // buddham_api 가 buddham_apx 로 이름이 바뀌었는데 site.conf 는 아직 buddham_api → 오타처럼 보임
  fake.files['/w/nginx/upstreams.conf'] = 'upstream buddham_apx { }\n';
  await fake.handlers.fsChange(fake.Uri('/w/nginx/upstreams.conf'));
  await new Promise((r) => setTimeout(r, 400)); // schedule 의 debounce(250ms) 대기
  assert.equal(fake.collection.last.some((d) => d.code === 'unknown-upstream'), true);
});

// ---------------------------------------------------------------------------
// 참조 찾기 / 이름 바꾸기
// ---------------------------------------------------------------------------
const SITE_RENAME = 'server {\n  server_name a.com;\n  location /a/ { proxy_pass http://buddham_api/; proxy_set_header Upgrade $connection_upgrade; }\n  location /b/ { proxy_pass http://buddham_api/b; add_header X "${connection_upgrade}"; }\n  location /c/ { proxy_set_header Host $host; }\n}\n';

async function setupRename() {
  const r = await setupWorkspace(SITE_RENAME);
  r.mods.navigation.registerNavigation({ subscriptions: [] }, r.service, navDb);
  return r;
}
const editsOf = (we) => we.edits.map((e) => ({ path: e.uri.path, line: e.range.start.line, text: e.text }));

test('참조 찾기: 여러 파일에 걸친 upstream 사용처 (선언 포함/제외)', async () => {
  const { fake } = await setupRename();
  const prov = fake.referenceProviders[0];
  const pos = at(fake, 'buddham_api');

  const withDecl = prov.provideReferences(fake.doc, pos, { includeDeclaration: true });
  assert.deepEqual(withDecl.map((l) => l.uri.path).sort(), ['/w/nginx/site.conf', '/w/nginx/site.conf', '/w/nginx/upstreams.conf']);

  const noDecl = prov.provideReferences(fake.doc, pos, { includeDeclaration: false });
  assert.equal(noDecl.length, 2);
  assert.ok(noDecl.every((l) => l.uri.path === '/w/nginx/site.conf'));

  assert.deepEqual(prov.provideReferences(fake.doc, at(fake, 'server_name', 1), { includeDeclaration: true }), []);
});

test('이름 바꾸기: upstream — 정의 + 모든 파일의 proxy_pass 를 한 번에', async () => {
  const { fake } = await setupRename();
  const prov = fake.renameProviders[0];
  const pos = at(fake, 'buddham_api');

  const prep = prov.prepareRename(fake.doc, pos);
  assert.equal(fake.doc.getText(prep.range), 'buddham_api');
  assert.equal(prep.placeholder, 'buddham_api');

  const edits = editsOf(prov.provideRenameEdits(fake.doc, pos, 'buddham_main'));
  assert.equal(edits.length, 3);
  assert.deepEqual(edits.map((e) => e.path).sort(), ['/w/nginx/site.conf', '/w/nginx/site.conf', '/w/nginx/upstreams.conf']);
  assert.ok(edits.every((e) => e.text === 'buddham_main'));
});

test('이름 바꾸기: $변수 — $x / ${x} 표기를 각각 보존, prepare 범위는 이름 부분만', async () => {
  const { fake } = await setupRename();
  const prov = fake.renameProviders[0];
  const pos = at(fake, '$connection_upgrade', 4);

  const prep = prov.prepareRename(fake.doc, pos);
  assert.equal(fake.doc.getText(prep.range), 'connection_upgrade'); // $ 제외

  const edits = editsOf(prov.provideRenameEdits(fake.doc, pos, 'conn_up'));
  const texts = edits.map((e) => e.text).sort();
  assert.deepEqual(texts, ['$conn_up', '$conn_up', '${conn_up}']); // map 의 정의($), 일반 참조($), 문자열 속 참조(${ })
  assert.deepEqual(edits.map((e) => e.path).sort(), ['/w/nginx/site.conf', '/w/nginx/site.conf', '/w/nginx/upstreams.conf']);
});

test('이름 바꾸기: 내장 변수 / 정의 없는 이름 / 잘못된 새 이름 / 충돌은 거부', async () => {
  const { fake } = await setupRename();
  const prov = fake.renameProviders[0];

  assert.throws(() => prov.prepareRename(fake.doc, at(fake, '$host', 3)), /내장 변수/);
  assert.throws(() => prov.prepareRename(fake.doc, at(fake, 'server_name', 1)), /바꿀 수 있는/);

  const pos = at(fake, 'buddham_api');
  assert.throws(() => prov.provideRenameEdits(fake.doc, pos, '9bad'), /올바른 upstream 이름/);
  assert.throws(() => prov.provideRenameEdits(fake.doc, pos, 'a b'), /올바른 upstream 이름/);

  const vpos = at(fake, '$connection_upgrade', 4);
  assert.throws(() => prov.provideRenameEdits(fake.doc, vpos, 'host'), /이미 있는 변수/); // 내장 변수와 충돌
  assert.throws(() => prov.provideRenameEdits(fake.doc, vpos, 'a-b'), /올바른 변수 이름/); // 변수는 - 불가
});
