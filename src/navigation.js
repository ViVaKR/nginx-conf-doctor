// navigation.js — 정의로 이동(F12) / include 경로 링크 / 아웃라인 (vscode 연결부)
'use strict';

const vscode = require('vscode');
const { outline, resolveInclude, checkRenameTarget, checkRenameName, renameEdits } = require('./nginx/symbols');

const LANGUAGE_ID = 'nginx';

function registerNavigation(context, service, db = null) {
  const { ws } = service;
  const dbForRename = db || { variables: [] };
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

    // Shift+F12: upstream / $변수의 모든 사용 위치 (여러 파일에 걸쳐)
    vscode.languages.registerReferenceProvider(LANGUAGE_ID, {
      provideReferences(doc, position, ctx) {
        const offset = doc.offsetAt(position);
        const fi = service.indexDocument(doc);
        const hit = [...fi.refs, ...fi.defs].find((x) => within(x, offset));
        if (!hit) return [];
        return ws
          .occurrences(hit.kind, hit.name)
          .filter((o) => !o.isDef || !ctx || ctx.includeDeclaration !== false)
          .map(({ key, item }) => {
            const uri = service.uriOf(key);
            if (!uri) return null;
            return new vscode.Location(
              uri,
              new vscode.Range(new vscode.Position(item.line, item.character), new vscode.Position(item.endLine, item.endCharacter)),
            );
          })
          .filter(Boolean);
      },
    }),

    // F2: upstream / $변수 이름 바꾸기 (정의와 모든 파일의 사용처를 한 번에)
    vscode.languages.registerRenameProvider(LANGUAGE_ID, {
      prepareRename(doc, position) {
        const offset = doc.offsetAt(position);
        const fi = service.indexDocument(doc);
        const hit = [...fi.refs, ...fi.defs].find((x) => within(x, offset));
        if (!hit) throw new Error('이름을 바꿀 수 있는 upstream 이나 $변수가 아닙니다.');
        const why = checkRenameTarget(hit.kind, hit.name, ws, dbForRename);
        if (why) throw new Error(why);
        // $ 나 ${ } 는 빼고 이름 부분만 편집 대상으로 보여준다
        const a = hit.form === '$' ? hit.start + 1 : hit.form === 'brace' ? hit.start + 2 : hit.start;
        const b = hit.form === 'brace' ? hit.end - 1 : hit.end;
        return { range: new vscode.Range(doc.positionAt(a), doc.positionAt(b)), placeholder: hit.name };
      },
      provideRenameEdits(doc, position, newName) {
        const offset = doc.offsetAt(position);
        const fi = service.indexDocument(doc);
        const hit = [...fi.refs, ...fi.defs].find((x) => within(x, offset));
        if (!hit) throw new Error('이름을 바꿀 수 있는 upstream 이나 $변수가 아닙니다.');
        const extra = new Set(vscode.workspace.getConfiguration('nginx-conf-doctor').get('extraVariables', []).map((v) => v.replace(/^\$/, '')));
        const why = checkRenameTarget(hit.kind, hit.name, ws, dbForRename) || checkRenameName(hit.kind, hit.name, newName, ws, dbForRename, extra);
        if (why) throw new Error(why);

        const edit = new vscode.WorkspaceEdit();
        for (const e of renameEdits(ws, hit.kind, hit.name, newName)) {
          const uri = service.uriOf(e.key);
          if (!uri) continue;
          edit.replace(uri, new vscode.Range(new vscode.Position(e.line, e.character), new vscode.Position(e.endLine, e.endCharacter)), e.newText);
        }
        return edit;
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
