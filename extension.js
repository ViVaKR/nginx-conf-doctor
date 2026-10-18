'use strict';

const { loadDefaultDb } = require('./src/nginx/directive-db');
const { registerDiagnostics } = require('./src/diagnostics');
const { registerQuickFix } = require('./src/quickfix');
const { registerCompletion } = require('./src/completion');
const { registerHover } = require('./src/hover');
const { registerFormatter } = require('./src/format');
const { createWorkspaceService } = require('./src/workspace-index');
const { registerNavigation } = require('./src/navigation');

function activate(context) {
  // 지시어 데이터가 없어도 구조 진단(중괄호/세미콜론/따옴표)은 동작한다.
  let db = null;
  try {
    db = loadDefaultDb();
  } catch (e) {
    console.warn(`[nginx-conf-doctor] 지시어 데이터를 읽지 못했습니다: ${e.message}`);
  }
  // 워크스페이스 전체의 upstream/변수 정의를 모으는 인덱스 (스캔은 백그라운드로 진행)
  const service = createWorkspaceService(context, { isKnownDirective: db ? db.isKnownDirective : undefined });
  registerDiagnostics(context, db, service);
  registerQuickFix(context, db, service);
  registerNavigation(context, service);
  registerCompletion(context, db);
  registerHover(context, db);
  registerFormatter(context, db);
}

function deactivate() {}

module.exports = { activate, deactivate };
