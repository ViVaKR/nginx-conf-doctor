// symbols.js — 설정 파일에서 심볼을 뽑아내는 순수 로직 (vscode 비의존)
//   indexText      : 정의(upstream, $변수) / 참조 / include 경로
//   outline        : 아웃라인(블록 계층)
//   resolveInclude : include 경로를 워크스페이스 파일에 연결 (경로 뒤쪽부터 가장 길게 일치)
//   lintReferences : "정의된 것과 비슷한데 정의가 없는" 이름(오타) 경고
'use strict';

const { parse } = require('./parser');
const { TokenType: T } = require('./tokenizer');
const { suggest } = require('./lint');

const PASS_DIRECTIVES = new Set(['proxy_pass', 'grpc_pass', 'fastcgi_pass', 'uwsgi_pass', 'scgi_pass', 'memcached_pass']);
const VAR_RE = /\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/g;
const NAMED_CAPTURE_RE = /\(\?P?<([A-Za-z_][A-Za-z0-9_]*)>/g;
// @ts-ignore
const IS_WORDISH = (t) => t && (t.type === T.WORD || t.type === T.STRING);

/**
 * @returns {{ defs: any[], refs: any[], includes: any[], parsed: any }}
 *   각 항목: { kind, name, start, end, line, character, endLine, endCharacter }
 */
// @ts-ignore
function indexText(text, opts = {}) {
  const parsed = parse(text, opts);
  const pos = parsed.positionAt;
  // form: 'bare'(이름만) | '$'($name) | 'brace'(${name}) — 이름 바꾸기에서 표기를 그대로 보존하려고 기록
  // @ts-ignore
  const item = (kind, name, start, end, form = 'bare') => {
    const a = pos(start);
    const b = pos(end);
    return { kind, name, form, start, end, line: a.line, character: a.character, endLine: b.line, endCharacter: b.character };
  };
  // @ts-ignore
  const defs = [];
  const refs = [];
  // @ts-ignore
  const includes = [];

  // @ts-ignore
  const isVar = (t) => t && t.type === T.WORD && /^\$[A-Za-z_][A-Za-z0-9_]*$/.test(t.value);
  // @ts-ignore
  const defVar = (t) => {
    if (isVar(t)) defs.push(item('variable', t.value.slice(1), t.start, t.end, '$'));
  };

  // @ts-ignore
  const visit = (children) => {
    for (const d of children) {
      const A = d.args;
      const nt = d.nameToken;

      // 이름 자체가 $변수인 행 (geoip2 { $geoip2_data_country_code ... } 등)
      if (isVar(nt)) defs.push(item('variable', nt.value.slice(1), nt.start, nt.end, '$'));

      switch (d.name) {
        case 'upstream':
          if (d.block && IS_WORDISH(A[0])) {
            const q = A[0].type === T.STRING ? 1 : 0;
            defs.push(item('upstream', A[0].value, A[0].start + q, A[0].start + q + A[0].value.length));
          }
          break;
        case 'set':
        case 'auth_request_set':
        case 'perl_set':
        case 'js_set':
        case 'js_var':
          defVar(A[0]);
          break;
        case 'map':
        case 'split_clients':
        case 'keyval':
        case 'num_map':
          defVar(A[1]);
          break;
        case 'geo':
          defVar(A[A.length - 1]);
          break;
        default:
          if (/^set_by_lua/.test(d.name)) defVar(A[0]);
      }

      // 정규식 이름 캡처 (?<name>...) 는 $name 변수를 만든다
      for (const t of [nt, ...A]) {
        if (!IS_WORDISH(t)) continue;
        NAMED_CAPTURE_RE.lastIndex = 0;
        let m;
        while ((m = NAMED_CAPTURE_RE.exec(t.text))) {
          const s = t.start + m.index + m[0].length - 1 - m[1].length;
          defs.push(item('variable', m[1], s, s + m[1].length));
        }
      }

      // upstream 참조: *_pass 의 첫 인자 (http://name/uri, name:port 등). $변수/unix 소켓은 제외
      if (PASS_DIRECTIVES.has(d.name) && IS_WORDISH(A[0]) && !/^["']?unix:/.test(A[0].text)) {
        const t = A[0];
        const pre = /^(["']?)(?:([A-Za-z][A-Za-z0-9+.-]*):\/\/)?/.exec(t.text);
        // @ts-ignore
        const rest = t.text.slice(pre[0].length);
        const n = /^[A-Za-z0-9_.-]+/.exec(rest);
        if (n && rest[n[0].length] !== '$' && !rest.startsWith('$') && !/^\d+$/.test(n[0])) {
          // @ts-ignore
          const s = t.start + pre[0].length;
          refs.push(item('upstream', n[0], s, s + n[0].length));
        }
      }

      if (d.name === 'include' && IS_WORDISH(A[0]) && !A[0].value.includes('$')) {
        const t = A[0];
        const q = t.type === T.STRING ? 1 : 0;
        includes.push(item('include', t.value, t.start + q, t.end - (t.type === T.STRING && !t.unterminated ? 1 : 0)));
      }

      if (d.block && !d.block.raw) visit(d.block.children);
    }
  };
  visit(parsed.root.children);

  // $변수 참조: 단어/문자열 어디서든 ($1 같은 숫자 캡처는 이름 규칙상 제외)
  for (const t of parsed.tokens) {
    if (!IS_WORDISH(t)) continue;
    VAR_RE.lastIndex = 0;
    let m;
    while ((m = VAR_RE.exec(t.text))) {
      refs.push(item('variable', m[1] || m[2], t.start + m.index, t.start + m.index + m[0].length, m[0].startsWith('${') ? 'brace' : '$'));
    }
  }

  // @ts-ignore
  return { defs, refs, includes, parsed };
}

// ---------------------------------------------------------------------------
// 아웃라인
// ---------------------------------------------------------------------------
const KIND = {
  http: 'namespace', server: 'namespace', stream: 'namespace', mail: 'namespace', events: 'namespace',
  location: 'function', upstream: 'class', map: 'variable', geo: 'variable', split_clients: 'variable'
};

/** @returns Array<{ name, detail, kind, start, end, selStart, selEnd, children }> (오프셋 기준) */
// @ts-ignore
function outline(parsed) {
  // @ts-ignore
  const build = (children) =>
    children
      // @ts-ignore
      .filter((d) => d.block && d.nameToken)
      // @ts-ignore
      .map((d) => {
        // 심볼 선택창(Cmd+Shift+O)은 detail 을 보여주지 않아 location 이 모두 똑같이 보이므로, 인자를 이름에 넣는다.
        // @ts-ignore
        let arg = d.args.map((t) => t.value).join(' ');
        if (d.name === 'server') {
          // @ts-ignore
          const sn = d.block.children.find((c) => c.name === 'server_name');
          // @ts-ignore
          arg = sn ? sn.args.slice(0, 2).map((t) => t.value).join(' ') : '';
        }
        const label = (arg ? `${d.name} ${arg}` : d.name);
        const name = label.length > 70 ? `${label.slice(0, 69)}…` : label;
        const kids = d.block.raw ? [] : build(d.block.children);
        // @ts-ignore
        const end = Math.max(d.end, d.nameToken.end, ...kids.map((k) => k.end));
        return {
          name,
          detail: '',
          // @ts-ignore
          kind: KIND[d.name] || (d.name === 'if' || d.name === 'limit_except' ? 'struct' : 'object'),
          start: d.nameToken.start,
          end,
          selStart: d.nameToken.start,
          selEnd: d.nameToken.end,
          children: kids,
        };
      });
  return build(parsed.root.children);
}

// ---------------------------------------------------------------------------
// include 경로 → 워크스페이스 파일
// ---------------------------------------------------------------------------
// @ts-ignore
function commonPrefixLen(a, b) {
  const x = a.split('/');
  const y = b.split('/');
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return i;
}

/**
 * 서버 경로(/etc/nginx/snippets/a.conf)와 로컬 경로가 달라도, 뒤쪽 경로가 가장 길게 일치하는 파일을 고른다.
 * 와일드카드/변수가 있으면 null. 후보가 여럿이면 현재 파일과 가까운 것.
 * @param {Array<{ key: string, path: string }>} files
 */
// @ts-ignore
function resolveInclude(pathText, files, fromPath = '') {
  if (!pathText || /[*?[\]$]/.test(pathText)) return null;
  const segs = pathText.replace(/\\/g, '/').split('/').filter(Boolean);
  for (let k = segs.length; k >= 1; k--) {
    const suffix = '/' + segs.slice(segs.length - k).join('/');
    const hits = files.filter((f) => f.path.endsWith(suffix));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) {
      return hits
        .slice()
        .sort((a, b) => commonPrefixLen(b.path, fromPath) - commonPrefixLen(a.path, fromPath) || a.path.localeCompare(b.path))[0];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 이름 오타 경고 (오탐보다 놓침이 낫다: "정의된 것과 비슷한데 정의가 없을 때"만)
// ---------------------------------------------------------------------------
/** 알려진 변수 이름(내장 + 워크스페이스에서 정의됨 + 사용자 지정). 이름은 '$' 없이. */
// @ts-ignore
function variableCandidates(db, ws, extraVars = new Set()) {
  const exact = new Set();
  const prefixes = [];
  for (const v of db.variables || []) {
    exact.add(v.name.replace(/^\$/, ''));
    if (v.prefix) prefixes.push(v.prefix.replace(/^\$/, ''));
  }
  const defined = ws.names('variable');
  return { exact, prefixes, defined, candidates: [...new Set([...exact, ...defined, ...extraVars])] };
}

/**
 * @param {{ refs: any[] }} fileIndex 검사할 파일의 indexText 결과
 * @param {{ names: (kind: string) => Set<string> }} ws 워크스페이스 인덱스 (이 파일 자신도 반영돼 있어야 함)
 * @param {{ variables?: any[] }} db
 * @param {{ extraVars?: Set<string> }} [opts] 서드파티 모듈 등이 만드는 변수 (이름만, $ 제외)
 */
function lintReferences(fileIndex, ws, db, { extraVars = new Set() } = {}) {
  const out = [];

  const upstreams = ws.names('upstream');
  if (upstreams.size) {
    const list = [...upstreams];
    for (const r of fileIndex.refs) {
      if (r.kind !== 'upstream') continue;
      const n = r.name;
      if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(n) || n === 'localhost' || upstreams.has(n)) continue;
      const sug = suggest(n, list);
      if (!sug.length) continue;
      out.push({
        code: 'unknown-upstream',
        message: `정의되지 않은 upstream '${n}' 입니다. 혹시 ${sug.map((s) => `'${s}'`).join(' / ')} 을(를) 말씀하신 건가요?`,
        start: r.start,
        end: r.end,
        severity: 'warning',
        suggestions: sug,
      });
    }
  }

  const { exact, prefixes, defined, candidates } = variableCandidates(db, ws, extraVars);
  for (const r of fileIndex.refs) {
    if (r.kind !== 'variable') continue;
    const n = r.name;
    if (exact.has(n) || defined.has(n) || extraVars.has(n)) continue;
    if (prefixes.some((p) => n.startsWith(p) && n.length > p.length)) continue; // $arg_x, $http_x ...
    const sug = suggest(n, candidates);
    if (!sug.length) continue;
    out.push({
      code: 'unknown-variable',
      message: `알 수 없는 변수 '$${n}' 입니다. 혹시 ${sug.map((s) => `'$${s}'`).join(' / ')} 을(를) 말씀하신 건가요?`,
      start: r.start,
      end: r.end,
      severity: 'warning',
      suggestions: sug,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 이름 바꾸기 (upstream / $변수)
// ---------------------------------------------------------------------------
const IDENT = { upstream: /^[A-Za-z_][A-Za-z0-9_-]*$/, variable: /^[A-Za-z_][A-Za-z0-9_]*$/ };

/** 바꿀 "대상"이 이름을 바꿀 수 있는 것인가? 문제가 있으면 사유 문자열, 괜찮으면 null. */
// @ts-ignore
function checkRenameTarget(kind, name, ws, db) {
  if (kind === 'upstream') {
    return ws.names('upstream').has(name) ? null : `'${name}' 은(는) 워크스페이스에 정의된 upstream 이 아닙니다 (호스트 이름일 수 있습니다).`;
  }
  const { exact, prefixes, defined } = variableCandidates(db, ws);
  if (defined.has(name)) return null;
  if (exact.has(name) || prefixes.some((p) => name.startsWith(p) && name.length > p.length)) {
    return `'$${name}' 은(는) nginx 내장 변수라 이름을 바꿀 수 없습니다.`;
  }
  return `'$${name}' 의 정의가 워크스페이스에 없어 이름을 바꿀 수 없습니다 (모듈이 만드는 변수일 수 있습니다).`;
}

/** 새 이름이 올바르고 충돌하지 않는가? 문제가 있으면 사유 문자열, 괜찮으면 null. */
// @ts-ignore
function checkRenameName(kind, oldName, newName, ws, db, extraVars = new Set()) {
  // @ts-ignore
  if (!IDENT[kind].test(newName)) {
    return kind === 'upstream'
      ? `'${newName}' 은(는) 올바른 upstream 이름이 아닙니다 (영문자/숫자/_/- 만, 숫자로 시작할 수 없음).`
      : `'${newName}' 은(는) 올바른 변수 이름이 아닙니다 (영문자/숫자/_ 만, 숫자로 시작할 수 없음).`;
  }
  if (newName === oldName) return null;
  if (kind === 'upstream') {
    return ws.names('upstream').has(newName) ? `이미 정의된 upstream '${newName}' 입니다.` : null;
  }
  const { exact, prefixes, defined } = variableCandidates(db, ws, extraVars);
  if (exact.has(newName) || defined.has(newName) || prefixes.some((p) => newName.startsWith(p) && newName.length > p.length)) {
    return `'$${newName}' 은(는) 이미 있는 변수 이름입니다.`;
  }
  return null;
}

/** 모든 파일의 정의+참조를 새 이름으로 바꾸는 편집 목록 ($x / ${x} / 이름만 표기를 보존). */
// @ts-ignore
function renameEdits(ws, kind, oldName, newName) {
  // @ts-ignore
  return ws.occurrences(kind, oldName).map(({ key, item }) => ({
    key,
    line: item.line,
    character: item.character,
    endLine: item.endLine,
    endCharacter: item.endCharacter,
    newText: item.form === 'brace' ? `\${${newName}}` : item.form === '$' ? `$${newName}` : newName,
  }));
}

module.exports = { indexText, outline, resolveInclude, lintReferences, variableCandidates, checkRenameTarget, checkRenameName, renameEdits };
