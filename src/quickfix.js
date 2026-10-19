// quickfix.js — 오타 경고의 빠른 수정 (vscode 연결부)
//   unknown-directive : 'listen' 로 바꾸기
//   unknown-upstream  : 'buddham_api' 로 바꾸기
//   unknown-variable  : '$request_uri' 로 바꾸기
'use strict';

const vscode = require('vscode');
const { suggest } = require('./nginx/lint');
const { variableCandidates } = require('./nginx/symbols');

const LANGUAGE_ID = 'nginx';
const SOURCE = 'nginx-conf-doctor';

// @ts-ignore
function registerQuickFix(context, db, service = null) {
  if (!db) return;
  const directiveNames = db.names();

  // @ts-ignore
  function replacementsFor(doc, d) {
    // Diagnostic 객체에 사용자 데이터를 실을 수 없어서, 범위의 원문으로 후보를 다시 계산한다.
    const typed = doc.getText(d.range);
    if (d.code === 'unknown-directive') {
      return suggest(typed, directiveNames).map((s) => ({ label: s, text: s }));
    }
    if (d.code === 'unknown-upstream' && service) {
      // @ts-ignore
      return suggest(typed, [...service.ws.names('upstream')]).map((s) => ({ label: s, text: s }));
    }
    if (d.code === 'unknown-variable' && service) {
      const braced = typed.startsWith('${');
      const name = typed.replace(/^\$\{?/, '').replace(/\}$/, '');
      // @ts-ignore
      const extra = new Set(vscode.workspace.getConfiguration('nginx-conf-doctor').get('extraVariables', []).map((v) => v.replace(/^\$/, '')));
      // @ts-ignore
      const { candidates } = variableCandidates(db, service.ws, extra);
      return suggest(name, candidates).map((s) => ({ label: `$${s}`, text: braced ? `\${${s}}` : `$${s}` }));
    }
    return [];
  }

  const provider = {
    // @ts-ignore
    provideCodeActions(doc, _range, ctx) {
      // @ts-ignore
      const actions = [];
      for (const d of ctx.diagnostics) {
        if (d.source !== SOURCE) continue;
        replacementsFor(doc, d).forEach((r, i) => {
          const action = new vscode.CodeAction(`'${r.label}' 로 바꾸기`, vscode.CodeActionKind.QuickFix);
          action.edit = new vscode.WorkspaceEdit();
          action.edit.replace(doc.uri, d.range, r.text);
          action.diagnostics = [d];
          action.isPreferred = i === 0;
          actions.push(action);
        });
      }
      // @ts-ignore
      return actions;
    },
  };
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(LANGUAGE_ID, provider, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
  );
}

module.exports = { registerQuickFix };
