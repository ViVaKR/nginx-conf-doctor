// workspace-index.js — 워크스페이스의 nginx 설정 파일을 스캔해 심볼 인덱스를 유지 (vscode 연결부)
//   - 시작할 때 한 번 스캔(비동기, 활성화를 막지 않음) + 파일 변경 감시 + 열려 있는 문서는 편집 중인 내용으로 반영
//   - 순수 로직은 src/nginx/symbols.js, src/nginx/workspace-index.js
'use strict';

const vscode = require('vscode');
const { indexText } = require('./nginx/symbols');
const { createWorkspaceIndex } = require('./nginx/workspace-index');

const GLOBS = ['**/*.{conf,nginx,types}', '**/{sites-available,sites-enabled,conf.d,snippets}/*'];
const WATCH_GLOB = '**/*.{conf,nginx,types}';
const EXCLUDE = '**/{node_modules,.git,out,dist,.vscode-test}/**';
const MAX_FILES = 3000;
const LIVE_DEBOUNCE_MS = 300;

function createWorkspaceService(context, { isKnownDirective } = {}) {
  const ws = createWorkspaceIndex();
  const uris = new Map(); // key -> Uri
  const listeners = new Set();
  const liveTimers = new Map();
  const cache = new Map(); // key -> { version, idx }

  const emit = () => {
    for (const fn of listeners) {
      try {
        fn();
      } catch (e) {
        console.warn('[nginx-conf-doctor] 인덱스 리스너 오류:', e.message);
      }
    }
  };

  function put(uri, text) {
    const key = uri.toString();
    uris.set(key, uri);
    const idx = indexText(text, { isKnownDirective });
    ws.update(key, uri.path, idx);
    return idx;
  }

  async function indexUri(uri) {
    const key = uri.toString();
    const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === key);
    try {
      const text = open ? open.getText() : new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(uri));
      put(uri, text);
    } catch {
      // 읽기 실패(삭제 직후 등)는 조용히 무시
    }
  }

  async function scan() {
    const found = new Map();
    for (const g of GLOBS) {
      for (const u of await vscode.workspace.findFiles(g, EXCLUDE, MAX_FILES)) found.set(u.toString(), u);
    }
    const all = [...found.values()].slice(0, MAX_FILES);
    for (let i = 0; i < all.length; i += 20) await Promise.all(all.slice(i, i + 20).map(indexUri));
    emit();
  }

  /** 열려 있는 문서의 "지금 내용"을 인덱스에 반영하고 결과를 돌려준다 (이벤트는 발생시키지 않음). */
  function indexDocument(doc) {
    const key = doc.uri.toString();
    const hit = cache.get(key);
    if (doc.version !== undefined && hit && hit.version === doc.version) return hit.idx;
    const idx = put(doc.uri, doc.getText());
    cache.set(key, { version: doc.version, idx });
    return idx;
  }

  const ready = scan().catch((e) => console.warn('[nginx-conf-doctor] 워크스페이스 스캔 실패:', e.message));

  const watcher = vscode.workspace.createFileSystemWatcher(WATCH_GLOB);
  const onFileChanged = async (uri) => {
    cache.delete(uri.toString());
    await indexUri(uri);
    emit();
  };
  watcher.onDidChange(onFileChanged);
  watcher.onDidCreate(onFileChanged);
  watcher.onDidDelete((uri) => {
    const key = uri.toString();
    uris.delete(key);
    cache.delete(key);
    ws.remove(key);
    emit();
  });

  context.subscriptions.push(
    watcher,
    vscode.workspace.onDidChangeTextDocument((e) => {
      const doc = e.document;
      if (doc.languageId !== 'nginx') return;
      const key = doc.uri.toString();
      clearTimeout(liveTimers.get(key));
      liveTimers.set(
        key,
        setTimeout(() => {
          indexDocument(doc);
          emit();
        }, LIVE_DEBOUNCE_MS),
      );
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId !== 'nginx') return;
      indexDocument(doc);
      emit();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      scan();
    }),
  );

  return {
    ws,
    ready,
    scan,
    indexDocument,
    uriOf: (key) => uris.get(key),
    onDidChange(fn) {
      listeners.add(fn);
      return { dispose: () => listeners.delete(fn) };
    },
  };
}

module.exports = { createWorkspaceService };
