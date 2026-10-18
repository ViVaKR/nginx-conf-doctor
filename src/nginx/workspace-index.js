// workspace-index.js — 여러 파일의 심볼(upstream/변수) 정의를 모아 두는 순수 인덱스 (vscode 비의존)
'use strict';

function createWorkspaceIndex() {
  /** @type {Map<string, { path: string, index: any }>} */
  const files = new Map();
  return {
    update(key, path, index) {
      files.set(key, { path, index });
    },
    remove(key) {
      files.delete(key);
    },
    fileList() {
      return [...files.entries()].map(([key, { path }]) => ({ key, path }));
    },
    /** @returns {Array<{ key: string, def: any }>} */
    definitions(kind, name) {
      const out = [];
      for (const [key, { index }] of files) {
        for (const d of index.defs) if (d.kind === kind && d.name === name) out.push({ key, def: d });
      }
      return out;
    },
    names(kind) {
      const s = new Set();
      for (const { index } of files.values()) for (const d of index.defs) if (d.kind === kind) s.add(d.name);
      return s;
    },
    size: () => files.size,
  };
}

module.exports = { createWorkspaceIndex };
