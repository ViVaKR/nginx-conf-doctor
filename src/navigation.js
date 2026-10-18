// navigation.js — 정의로 이동(F12) / include 경로 링크 / 아웃라인 (vscode 연결부)
'use strict';

const vscode = require('vscode');
const { outline, resolveInclude } = require('./nginx/symbols');

const LANGUAGE_ID = 'nginx';

function registerNavigation(context, service) {
  const { ws } = service;
  const within = (x, offset) => offset >= x.start && offset <= x.end;

  const SYMBOL_KIND = {
    namespace: vscode.SymbolKind.Namespace,
    function: vscode.SymbolKind.Function,
    class: vscode.SymbolKind.Class,
    variable: vscode.SymbolKind.Variable,
    struct: vscode.SymbolKind.Struct,
    object: vscode.SymbolKind.Object,
  };

  context.subscriptions.push(
    // F12 / Cmd+클릭: include 경로 → 파일, upstream 이름 → upstream 블록, $변수 → 정의 위치
    vscode.languages.registerDefinitionProvider(LANGUAGE_ID, {
      provideDefinition(doc, position) {
        const offset = doc.offsetAt(position);
        const fi = service.indexDocument(doc);

        const inc = fi.includes.find((i) => within(i, offset));
        if (inc) {
          const target = resolveInclude(inc.name, ws.fileList(), doc.uri.path);
          const uri = target && service.uriOf(target.key);
          return uri ? new vscode.Location(uri, new vscode.Position(0, 0)) : undefined;
        }

        const hit = [...fi.refs, ...fi.defs].find((x) => within(x, offset));
        if (!hit) return undefined;
        const locations = ws
          .definitions(hit.kind, hit.name)
          .map(({ key, def }) => {
            const uri = service.uriOf(key);
            if (!uri) return null;
            const range = new vscode.Range(
              new vscode.Position(def.line, def.character),
              new vscode.Position(def.endLine, def.endCharacter),
            );
            return new vscode.Location(uri, range);
          })
          .filter(Boolean);
        return locations.length ? locations : undefined;
      },
    }),

    // include 경로에 밑줄 링크 (서버 경로가 달라도 뒤쪽 경로가 일치하는 워크스페이스 파일로 연결)
    vscode.languages.registerDocumentLinkProvider(LANGUAGE_ID, {
      provideDocumentLinks(doc) {
        const fi = service.indexDocument(doc);
        const files = ws.fileList();
        const links = [];
        for (const inc of fi.includes) {
          const target = resolveInclude(inc.name, files, doc.uri.path);
          const uri = target && service.uriOf(target.key);
          if (!uri) continue;
          const link = new vscode.DocumentLink(new vscode.Range(doc.positionAt(inc.start), doc.positionAt(inc.end)), uri);
          link.tooltip = `${target.path} 열기`;
          links.push(link);
        }
        return links;
      },
    }),

    // 아웃라인(Cmd+Shift+O, 탐색기의 개요, 브레드크럼)
    vscode.languages.registerDocumentSymbolProvider(LANGUAGE_ID, {
      provideDocumentSymbols(doc) {
        const fi = service.indexDocument(doc);
        const toSymbol = (o) => {
          const range = new vscode.Range(doc.positionAt(o.start), doc.positionAt(o.end));
          const sel = new vscode.Range(doc.positionAt(o.selStart), doc.positionAt(o.selEnd));
          const sym = new vscode.DocumentSymbol(o.name, o.detail, SYMBOL_KIND[o.kind], range, sel);
          sym.children = o.children.map(toSymbol);
          return sym;
        };
        return outline(fi.parsed).map(toSymbol);
      },
    }),
  );
}

module.exports = { registerNavigation };
