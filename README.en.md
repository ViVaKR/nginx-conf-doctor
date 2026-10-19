<p align="center">
  <img src="https://raw.githubusercontent.com/ViVaKR/nginx-conf-doctor/main/icon_256.png" width="112" alt="Hun Nginx Conf Doctor Icon">
</p>

<h1 align="center">Hun Nginx Conf Doctor</h1>

<p align="center">
  <b>Context-aware diagnostics, IntelliSense, auto-formatting, and hover docs for Nginx configuration files</b><br>
</p>

<p align="center">
  <a href="README.md"><b>한국어</b></a> | <a href="README.en.md"><b>English</b></a>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=buddham-hq.nginx-conf-doctor"><img alt="Install" src="https://img.shields.io/badge/INSTALL-VS%20Code%20Marketplace-38bdf8?style=for-the-badge&labelColor=0b1220&logo=visualstudiocode&logoColor=38bdf8"></a>
  <a href="https://github.com/ViVaKR/nginx-conf-doctor"><img alt="GitHub" src="https://img.shields.io/badge/SOURCE-GitHub-f43f9a?style=for-the-badge&labelColor=0b1220&logo=github&logoColor=f43f9a"></a>
  <a href="https://github.com/ViVaKR/nginx-conf-doctor/issues"><img alt="Issues" src="https://img.shields.io/badge/FEEDBACK-Issues-a78bfa?style=for-the-badge&labelColor=0b1220&logo=githubissues&logoColor=a78bfa"></a>
</p>

<p align="center">
  <img alt="version" src="https://img.shields.io/badge/version-1.0.1-38bdf8?labelColor=0b1220">
  <img alt="vscode" src="https://img.shields.io/badge/VS%20Code-%E2%89%A5%201.90-38bdf8?labelColor=0b1220&logo=visualstudiocode&logoColor=white">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-f43f9a?labelColor=0b1220">
  <img alt="last commit" src="https://img.shields.io/github/last-commit/ViVaKR/nginx-conf-doctor?color=38bdf8&labelColor=0b1220">
  <img alt="stars" src="https://img.shields.io/github/stars/ViVaKR/nginx-conf-doctor?style=flat&color=f43f9a&labelColor=0b1220">
</p>

<p align="center">
  <a href="#-key-features">Features</a> ·
  <a href="#-supported-files">Supported Files</a> ·
  <a href="#%EF%B8%8F-configuration">Settings</a> ·
  <a href="#%EF%B8%8F-known-limitations">Limitations</a> ·
  <a href="#-release-notes">Release Notes</a>
</p>

---

## 🚀 Installation

Open `Ctrl+P` (macOS `Cmd+P`) in VS Code and paste the following:

```
ext install buddham-hq.nginx-conf-doctor
```

## 👀 See How It Works

```nginx
server {
    worker_processes 4;   # ⚠ Directive 'worker_processes' is not allowed in 'server' block
    listen 80
    server_name example.com;   # ✖ Missing semicolon (;) in previous line
}
```

---

A powerful VS Code extension that provides **syntax highlighting, error diagnostics, auto-completion, document formatting, and hover documentation** for Nginx configuration files (`nginx.conf`, `conf.d/*.conf`, etc.).

Instead of basic coloring, it parses the **exact context (`http`, `server`, `location`, etc.)** of directives to catch misplaced directives before deployment.

## ✨ Key Features

### Syntax Highlighting
- Custom TextMate grammar distinguishing directives, variables, strings, and comments.
- Embedded Lua syntax highlighting inside Lua blocks (e.g., `*_by_lua_block`).

### Diagnostics
Real-time error checking as you type:

| Category | Description |
|----------|-------------|
| **Structural Errors** | Unclosed braces, missing semicolons, unclosed quotes |
| **Context Errors** | Directives placed in invalid blocks (e.g., `worker_processes` inside `server`) |
| **Unknown Directives** | Directives not in official database (catches typos) |

> Structural diagnostics continue to work even if directive database resolution fails.

### Quick Fix
Press `Ctrl+.` (macOS `Cmd+.`) on diagnostic warnings to apply suggested automatic fixes.

### Context-Aware IntelliSense & Hover
- Recommends only valid directives available in the current context block.
- Displays official documentation excerpts when hovering over directives.

### Advanced Code Navigation & Formatting
- **Go to Definition / Find References**: Instantly jump between `upstream` blocks and variable declarations.
- **Rename Symbol (F2)**: Rename `upstream` names and variables across files.
- **Outline Support**: Navigate server and location structure via Symbol Outline.
- **Document Formatter**: Clean up mixed tabs/spaces with smart indentation while preserving multiline strings and Lua blocks.

---

## 📂 Supported Files

Automatically recognized as `nginx` language:

- **Filenames**: `nginx.conf`, `mime.types`, `fastcgi_params`, `scgi_params`, `uwsgi_params`
- **Extensions**: `.nginx`, `.nginx.conf`
- **Path Patterns**: `**/nginx/**/*.conf`, `**/conf.d/*.conf`, `**/sites-available/*`, `**/sites-enabled/*`, `**/snippets/*.conf`

For other files, select `Nginx` manually from the bottom-right language selector.

### Custom File Associations (settings.json)

To associate custom file extensions with Nginx, add the following to your VS Code `settings.json`:

```json
"files.associations": {
  "*.zone": "nginx",
  "*.conf": "nginx",
  "*.conf.d": "nginx"
}
```

---

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `nginx-conf-doctor.extraDirectives` | `[]` | List of custom third-party directives to ignore "Unknown directive" warnings. |
| `nginx-conf-doctor.contextSeverity` | `warning` | Severity for invalid context placement (`error` / `warning` / `information` / `off`). |
| `nginx-conf-doctor.unknownDirectiveSeverity` | `warning` | Severity for unknown directive warnings (`error` / `warning` / `information` / `off`). |

---

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

---

## 📋 Requirements

- VS Code `1.90.0` or higher
- Disable or uninstall duplicate Nginx extension plugins for optimal performance.

## ⚠️ Known Limitations

- This extension does not execute Nginx binary. Always verify configuration on server using `nginx -t`.
- Unresolved `include` file paths outside current workspace context are ignored.

## 🛠️ Development

```bash
npm install
npm run gen:grammar      # Generate TextMate syntax grammar
npm run gen:directives   # Generate Nginx directives metadata
npm run check            # Diagnostic check suite
npm run test:unit        # Unit tests
```

To package extension:

```bash
npx vsce package
```

## 📝 Release Notes

### [1.0.1] - 2026-10-19 (Official Release) 🎉
- **Document Formatter & Auto Indent**: Added Nginx formatter and smart Enter indentation with multiline string and Lua block protection.
- **Smart Symbol Navigation**: Added Ctrl+Click on `include` paths, Go to Definition, Find References (Shift+F12), Rename (F2), and Symbol Outline.
- **Context Diagnostics & Quick Fix**: Enhanced strict context validation (`http`, `server`, `location`), typo checking, and automated Quick Fix suggestions.
- **Updated Directives**: Synchronized database with 1,011 official directives from official Nginx docs.

<details>
<summary><b>📦 View Previous Pre-release History (0.0.1 ~ 0.0.7)</b></summary>

#### [0.0.7]
- Indexing references (Shift+F12) and symbol renaming (F2).
- Go to Definition on hover and click.
- Diagnostic fixes for 71 test suites.

#### [0.0.6]
- Improved formatter indent rules.

#### [0.0.5]
- Added Nginx Document Formatting Provider.

#### [0.0.3]
- Bug fixes on hover tooltip docs.

#### [0.0.2]
- Refreshed Marketplace assets and icon.

#### [0.0.1]
- Initial release with syntax highlighting, context validation, and IntelliSense.

</details>

## 📄 License

[MIT](LICENSE)