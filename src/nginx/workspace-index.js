// workspace-index.js — 여러 파일의 심볼(upstream/변수) 정의를 모아 두는 순수 인덱스 (vscode 비의존)
'use strict';

function createWorkspaceIndex() {
  /** @type {Map<string, { path: string, index: any }>} */
  const files = new Map();
  return {
    // @ts-ignore
    update(key, path, index) {
      files.set(key, { path, index });
    },
    // @ts-ignore
    remove(key) {
      files.delete(key);
    },
    fileList() {
      return [...files.entries()].map(([key, { path }]) => ({ key, path }));
    },
    /** @returns {Array<{ key: string, def: any }>} */
    // @ts-ignore
    definitions(kind, name) {
      const out = [];
      for (const [key, { index }] of files) {
        for (const d of index.defs) if (d.kind === kind && d.name === name) out.push({ key, def: d });
      }
      return out;
    },
    /** 정의+참조 전부 (같은 위치는 한 번만, 정의 표시 유지). 참조 찾기/이름 바꾸기용. */
    // @ts-ignore
    occurrences(kind, name) {
      const out = [];
      for (const [key, { index }] of files) {
        const seen = new Set();
        for (const [list, isDef] of [[index.defs, true], [index.refs, false]]) {
          for (const it of list) {
            if (it.kind !== kind || it.name !== name || seen.has(it.start)) continue;
            seen.add(it.start);
            out.push({ key, item: it, isDef });
          }
        }
      }
      return out;
    },
    // @ts-ignore
    names(kind) {
      const s = new Set();
      for (const { index } of files.values()) for (const d of index.defs) if (d.kind === kind) s.add(d.name);
      return s;
    },
    size: () => files.size,
  };
}

module.exports = { createWorkspaceIndex };
