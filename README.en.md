<p align="center">
  <img src="https://raw.githubusercontent.com/ViVaKR/nginx-conf-doctor/main/icon_256.png" width="112" alt="Hun Nginx Conf Doctor Icon">
</p>

<h1 align="center">Hun Nginx Conf Doctor</h1>

<p align="center">
  <b>Context-aware diagnostics, IntelliSense, auto-formatting, and hover docs for Nginx configuration files</b><br>
  <sub>nginx 설정의 컨텍스트를 읽는 진단 · 자동완성 · hover 문서</sub>
</p>

<p align="center">
  <a href="https://github.com/ViVaKR/nginx-conf-doctor/blob/main/README.md"><b>한국어</b></a>
  &nbsp;|&nbsp;
  <a href="https://github.com/ViVaKR/nginx-conf-doctor/blob/main/README.en.md"><b>English</b></a>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=buddham-hq.nginx-conf-doctor"><img alt="Install" src="https://img.shields.io/badge/INSTALL-VS%20Code%20Marketplace-38bdf8?style=for-the-badge&labelColor=0b1220&logo=visualstudiocode&logoColor=38bdf8"></a>
  <a href="https://github.com/ViVaKR/nginx-conf-doctor"><img alt="GitHub" src="https://img.shields.io/badge/SOURCE-GitHub-f43f9a?style=for-the-badge&labelColor=0b1220&logo=github&logoColor=f43f9a"></a>
  <a href="https://github.com/ViVaKR/nginx-conf-doctor/issues"><img alt="Issues" src="https://img.shields.io/badge/FEEDBACK-Issues-a78bfa?style=for-the-badge&labelColor=0b1220&logo=githubissues&logoColor=a78bfa"></a>
</p>

<p align="center">
  <img alt="version" src="https://img.shields.io/visual-studio-marketplace/v/buddham-hq.nginx-conf-doctor?color=38bdf8&labelColor=0b1220&label=version">
  <img alt="installs" src="https://img.shields.io/visual-studio-marketplace/i/buddham-hq.nginx-conf-doctor?color=a78bfa&labelColor=0b1220&label=installs">
  <img alt="vscode" src="https://img.shields.io/badge/VS%20Code-%E2%89%A5%201.90-38bdf8?labelColor=0b1220&logo=visualstudiocode&logoColor=white">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-f43f9a?labelColor=0b1220">
  <img alt="last commit" src="https://img.shields.io/github/last-commit/ViVaKR/nginx-conf-doctor?color=38bdf8&labelColor=0b1220">
  <img alt="stars" src="https://img.shields.io/github/stars/ViVaKR/nginx-conf-doctor?style=flat&color=f43f9a&labelColor=0b1220">
</p>

<p align="center">
  <a href="#key-features">Features</a> ·
  <a href="#supported-files">Supported Files</a> ·
  <a href="#configuration">Settings</a> ·
  <a href="#known-limitations">Limitations</a> ·
  <a href="#release-notes">Release Notes</a>
</p>

---

## Installation

Open `Ctrl+P` (macOS `Cmd+P`) in VS Code and paste the following:

```
ext install buddham-hq.nginx-conf-doctor
```

## See How It Works

```nginx
server {
    worker_processes 4;   # ⚠ Directive 'worker_processes' is not allowed in 'server' block
    listen 80
    server_name example.com;   # ✖ Missing semicolon (;) in previous line
}
```

---

A VS Code extension that provides **syntax highlighting, error diagnostics, auto-completion, document formatting, and hover documentation** for Nginx configuration files (`nginx.conf`, `conf.d/*.conf`, etc.).

Instead of basic coloring, it reads the **exact context (`http`, `server`, `location`, etc.)** of each directive to catch misplaced directives before deployment.

## Key Features

### Syntax Highlighting
- Custom TextMate grammar distinguishing directives, variables, strings, and comments.
- Embedded Lua syntax highlighting inside Lua blocks (e.g., `*_by_lua_block`).

### Diagnostics
Real-time error checking as you type:

| Category | Description |
|----------|-------------|
| **Structural Errors** | Unclosed braces, missing semicolons, unclosed quotes |
| **Context Errors** | Directives placed in invalid blocks (e.g., `worker_processes` inside `server`) |
| **Unknown Directives** | Directives not in the official database (catches typos) |
| **Reference Errors** | Undefined `upstream` or `$variable` names (catches typos) |

> Structural diagnostics continue to work even if the directive database fails to load.

### Quick Fix
Press `Ctrl+.` (macOS `Cmd+.`) on a diagnostic to apply the suggested fix.

### Context-Aware IntelliSense & Hover
- Suggests only the directives that are valid in the current context block.
- Shows documentation excerpts when you hover over a directive.

### Navigation & Formatting
- **Go to Definition / Find References**: Jump between `upstream` blocks and variable declarations.
- **Rename Symbol (F2)**: Rename `upstream` names and variables in one step.
- **Outline**: Browse the `server` > `location` structure in the Symbol Outline.
- **Document Formatter**: Cleans up mixed tabs/spaces with smart indentation while preserving multiline strings and Lua blocks.

---

## Supported Files

Automatically recognized as the `nginx` language:

- **Filenames**: `nginx.conf`, `mime.types`, `fastcgi_params`, `scgi_params`, `uwsgi_params`
- **Extensions**: `.nginx`, `.nginx.conf`
- **Path Patterns**: `**/nginx/**/*.conf`, `**/conf.d/*.conf`, `**/sites-available/*`, `**/sites-enabled/*`, `**/snippets/*.conf`

For other files, select `Nginx` manually from the language selector at the bottom right.

### Custom File Associations (settings.json)

To always treat custom file extensions as Nginx, add the following to your VS Code `settings.json`:

```json
"files.associations": {
  "*.zone": "nginx",
  "*.conf": "nginx",
  "*.conf.d": "nginx"
}
```

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `nginx-conf-doctor.extraDirectives` | `[]` | Third-party directive names this extension does not know. Listing them removes the "Unknown directive" warning. |
| `nginx-conf-doctor.extraVariables` | `[]` | Variable names defined outside the workspace (e.g., by third-party modules). They are treated as defined when checking for typos. |
| `nginx-conf-doctor.contextSeverity` | `warning` | Severity for directives used in an invalid context (`error` / `warning` / `information` / `off`). |
| `nginx-conf-doctor.unknownDirectiveSeverity` | `warning` | Severity for unknown directive warnings (`error` / `warning` / `information` / `off`). |
| `nginx-conf-doctor.referenceSeverity` | `warning` | Severity for upstream/variable name typo warnings (`error` / `warning` / `information` / `off`). |

### Recommended Settings (settings.json)

```json
"[nginx]": {
  "editor.suggest.insertMode": "insert",
  "editor.insertSpaces": true,
  "editor.tabSize": 4,
  "editor.autoIndent": "full",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "buddham-hq.nginx-conf-doctor"
}
```

### Example: Allow Third-Party Module Directives

```json
{
  "nginx-conf-doctor.extraDirectives": [
    "more_set_headers",
    "brotli",
    "brotli_types"
  ]
}
```

## Requirements

- VS Code `1.90.0` or higher
- Disable or uninstall other Nginx extensions with overlapping features.

## Known Limitations

- This extension does not run the Nginx binary. Always verify your configuration on the server with `nginx -t`.
- The contents of files loaded via `include` are not analyzed.
- Third-party module directives must be listed in `extraDirectives` to silence warnings.

## Development

```bash
npm install
npm run gen:grammar      # Generate TextMate syntax grammar
npm run gen:directives   # Generate Nginx directives metadata
npm run check            # Config file check script
npm run mutate           # Mutation check
npm run test:unit        # Unit tests
```

To package the extension:

```bash
npx vsce package
```

## Release Notes

### [1.0.4] - 2026-10-20
- **Marketplace page polish**: Language links now use absolute URLs, the version badge follows the latest Marketplace version automatically, and table-of-contents anchors are fixed.
- **Settings docs**: Documented `extraVariables` and `referenceSeverity`.

### [1.0.1] - 2026-10-19 (Official Release) 🎉
- **Document Formatter & Auto Indent**: Added Nginx formatter and smart Enter indentation with multiline string and Lua block protection.
- **Smart Symbol Navigation**: Added Ctrl+Click on `include` paths, Go to Definition, Find References (Shift+F12), Rename (F2), and Symbol Outline.
- **Context Diagnostics & Quick Fix**: Enhanced strict context validation (`http`, `server`, `location`), typo checking, and automated Quick Fix suggestions.
- **Updated Directives**: Synchronized the database with 1,011 directives from the official Nginx docs.

<details>
<summary><b>View previous pre-release history (0.0.1 ~ 0.0.7)</b></summary>

#### [0.0.7]
- Indexing references (Shift+F12) and symbol renaming (F2).
- Go to Definition on hover and click.
- Diagnostic fixes for 71 check suites.

#### [0.0.6]
- Improved formatter indent rules.

#### [0.0.5]
- Added Nginx Document Formatting Provider.

#### [0.0.3]
- Bug fixes on hover tooltip docs.

#### [0.0.2]
- Original icon (braces with a heartbeat line), finalized display name, bilingual description.
- Reworked Marketplace page (buttons, badges, table of contents, diagnostics example).
- Packaging polish (gallery banner, untrusted/virtual workspace support, keywords).

#### [0.0.1]
- Initial release with syntax highlighting, context validation, and IntelliSense.

</details>

## License

[MIT](LICENSE)
