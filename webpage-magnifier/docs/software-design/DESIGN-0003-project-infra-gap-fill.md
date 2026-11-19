# DESIGN-0003 — 补齐项目基础设施四项缺失

**Task ID：** 0003  
**Slug：** project-infra-gap-fill  
**日期：** 2026-11-19  
**关联需求：** [REQ-0003](../requirements/REQ-0003-project-infra-gap-fill.md)  
**关联计划：** [PLAN-0003](../execution-plans/PLAN-0003-project-infra-gap-fill.md)

---

## 1. 设计概览

本任务不涉及运行时代码改动，属于**文档与自动化基础设施层**。四个交付物之间独立，无运行时依赖，按用户需求逐个设计即可。

```
设计范围：
├── README.md（用户文档 + 开发者指南）
├── .gitignore（版本控制排除规则）
├── CHANGELOG.md（版本变更日志）
└── release-webpage-magnifier.yml（GitHub Actions 自动化）

设计约束：
├── workflow 放在 monorepo 根 c:\flying\ai-tools\.github\workflows\
├── 所有文本内容使用中文（settings.language = zh-CN）
├── Git 操作不自动执行（用户显式要求审阅后 commit）
└── YAML 语法必须校验通过
```

## 2. README.md 设计

### 2.1 内容结构（8 章节，与 REQ-1.2 对齐）

| 章节 | 来源 | 说明 |
|------|------|------|
| 项目简介 | manifest.json description | 标注 v1.0.0，可留空功能截图占位符 |
| 功能列表 | manifest commands + content.js | 5 项核心功能 + 快捷键 |
| 安装步骤 | Edge 扩展流程 | edge://extensions → 开发者模式 → 加载解压缩 |
| 使用说明 | content.js + popup.js 交互 | 选区模式、拖拽、缩放滑块、层级切换、关闭 |
| 开发指南 | manifest.json + content.js + background.js | manifest v3 三文件职责、消息协议、SPA 兼容、顶层 frame 守卫 |
| 目录结构表 | Glob 扫描结果 | 核心文件 + 辅助脚本 + 资源 |
| 已知限制 | content.js 注释 + 逻辑推导 | canvas 空白、跨域 iframe、快照不随原页面更新 |
| 权限说明 | manifest.json permissions + content.js/background.js 实际使用 | 4 项权限逐条解释 |

### 2.2 权限说明映射（从 manifest + 代码提取）

| 权限 | 实际用途 | 代码位置 |
|------|----------|----------|
| `storage` | 预留扩展数据持久化（当前未实际写入，但 manifest 已声明，保留） | manifest.json line 6 |
| `activeTab` | 查询当前活动 tab（chrome.tabs.query），获取 tabId 用于注入和发消息 | popup.js `getActiveTab()`、background.js `chrome.tabs.query` |
| `scripting` | 主动注入 content.js / content.css（executeScript / insertCSS），解决 service worker 与 manifest content_scripts 的注入时序差 | background.js `ensureInjected()`、popup.js `ensureContentScript()` |
| `host_permissions: <all_urls>` | 允许在任意网页运行 content script（manifest content_scripts.matches） | manifest.json content_scripts.matches + background.js isInjectable 拦截 chrome://等受限协议 |

### 2.3 消息协议（README 开发指南要覆盖）

**popup → content（chrome.tabs.sendMessage）：**
- PING / TOGGLE_SELECT_MODE / CREATE_MAGNIFIER / DESTROY_ALL / GET_STATUS / SET_SCALE / TOGGLE_Z_INDEX / DESTROY_CURRENT / RESPAWN

**content → popup（chrome.runtime.sendMessage 广播）：**
- SELECT_MODE_CHANGED / MAGNIFIER_CREATED / MAGNIFIER_DESTROYED / SPA_NAVIGATED

**background → content：** 仅 TOGGLE_SELECT_MODE（快捷键兜底）

**content SPA 兼容：**
- hook history.pushState/replaceState（content.js line 127-156）
- 监听 popstate/hashchange/__wpm_spa_nav__
- 导航后销毁放大镜 + 退出选区 + 通知 popup
- 顶层 frame 守卫：`window.top !== window.self` 直接 return，避免 iframe 重复注入

## 3. .gitignore 设计

### 3.1 排除规则（与 REQ-2 对齐）

```
# === 打包产物 ===
*.zip
*.crx
*.pem

# === 系统垃圾 ===
.DS_Store
Thumbs.db
ehthumbs.db

# === IDE / 编辑器 user data（模板文件保留）===
.vscode/
.idea/

# === TRAE / Codebuddy / Workbuddy user data ===
.trae/htmlshare/
.codebuddy/agents/user/
.codebuddy/commands/user/
.workbuddy/user/

# === 临时产物目录 ===
.trae-html-share-packages/
node_modules/

# === Screenshots 临时文件 ===
.screenshots/.tmp
```

### 3.2 关键决策：`.agent-toolkit/` 不误排

`.agent-toolkit/` 包含 5 个文件（settings.json / install-files.json / install-manifest.json / settings.schema.json / settings.template.json），**全部在 git 中**，需要提交。因此不在 .gitignore 中排除 `.agent-toolkit/`。

`.trae/` / `.codebuddy/` / `.workbuddy/` 这些目录混合了模板文件和 user data。模板文件（SKILL.md、agent 描述等）通常也在 git 中，user data（如 trae 临时 share 包、codebuddy user agents）不在 git 中。因此采用**子目录级排除**策略，而非整目录排除——只明确排除确定是 user data 的子目录。

## 4. CHANGELOG.md 设计

### 4.1 格式（Keep a Changelog）

```markdown
# Changelog

本文件记录所有版本变更，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [1.0.0] - 2026-11-19

### 新增

- 网页区域放大器初始版本发布
- 选区模式：快捷键 Ctrl+Shift+M 或 popup 按钮启动，拖拽矩形区域创建放大镜
- 放大镜覆盖层：支持拖拽移动、缩放调节（1.0x ~ 5.0x，步长 0.1）
- 层级切换：置顶（z-index: 2147483647）/ 置底（z-index: 1）
- SPA 兼容：hook history.pushState/replaceState + 监听 popstate/hashchange，导航后自动销毁
- DOM 安全清洗：移除 script/iframe/base/link[rel=stylesheet]/object/embed，去除内联事件处理器
- 资源路径绝对化：手动绝对化 src/href/srcset/poster 等属性，绕过 <base> 影响
- 仅顶层 frame 工作：window.top !== self 守卫，避免 iframe 嵌套时重复注入
- content/background/popup 三文件分离：background 负责快捷键兜底与主动注入竞态处理

### 修复

### 重构

### 文档

### 安全

```

### 4.2 版本号对齐

CHANGELOG 版本 `[1.0.0]` 必须与 manifest.json `"version": "1.0.0"` 一致，日期 `2026-11-19` 与 task 创建日期一致。

## 5. GitHub Actions Workflow 设计

### 5.1 位置与命名

```
c:\flying\ai-tools\.github\workflows\release-webpage-magnifier.yml
```

命名模式：`<name>-release.yml`，与 monorepo 现有 9 个 workflow（如 web-markdown-ext-release.yml、speech-to-text-release.yml）风格一致。

### 5.2 触发条件设计

参照 web-markdown-ext-release.yml 的 paths 写法（精确 glob）：

```yaml
on:
  push:
    branches: [main]
    paths:
      - "webpage-magnifier/**/*.js"
      - "webpage-magnifier/**/*.json"
      - "webpage-magnifier/**/*.css"
      - "webpage-magnifier/**/*.html"
      - "webpage-magnifier/**/*.md"
      - "webpage-magnifier/**/*.png"
    tags:
      - "webpage-magnifier-v*"
```

同时触发 `push main + paths`（CI/检查 zip 能否构建）和 `push tag webpage-magnifier-v*`（正式 Release）。

### 5.3 Build Job 设计

使用 PowerShell `Compress-Archive`（与 `scripts/pack.ps1` 技术栈一致，避免额外工具依赖）。文件清单严格对齐 `pack.ps1`：

```yaml
jobs:
  build:
    runs-on: windows-latest
    outputs:
      version: ${{ steps.extract-version.outputs.version }}
    steps:
      - uses: actions/checkout@...
        with:
          fetch-depth: 0
          fetch-tags: true

      - name: Extract version from tag or manifest
        id: extract-version
        run: |
          if ("${{ github.ref }}" -match "^refs/tags/webpage-magnifier-v(.+)$") {
            $version = $Matches[1]
          } else {
            $manifest = Get-Content webpage-magnifier/manifest.json -Raw | ConvertFrom-Json
            $version = $manifest.version
          }
          echo "version=$version" | Out-File -FilePath $env:GITHUB_OUTPUT -Encoding utf8

      - name: Build zip
        run: |
          $version = "${{ steps.extract-version.outputs.version }}"
          $files = @(
            "webpage-magnifier/manifest.json",
            "webpage-magnifier/content.js",
            "webpage-magnifier/content.css",
            "webpage-magnifier/popup.html",
            "webpage-magnifier/popup.js",
            "webpage-magnifier/popup.css",
            "webpage-magnifier/background.js",
            "webpage-magnifier/icons/icon16.png",
            "webpage-magnifier/icons/icon48.png",
            "webpage-magnifier/icons/icon128.png"
          )
          $zipPath = "webpage-magnifier-$version.zip"
          Compress-Archive -Path $files -DestinationPath $zipPath -Force

      - name: Upload artifact
        uses: actions/upload-artifact@...
        with:
          name: webpage-magnifier-${{ steps.extract-version.outputs.version }}
          path: webpage-magnifier-*.zip
          if-no-files-found: error
```

### 5.4 Release Job 设计（tag 触发时）

```yaml
  release:
    needs: build
    if: startsWith(github.ref, 'refs/tags/webpage-magnifier-v')
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@...
        with:
          name: webpage-magnifier-${{ needs.build.outputs.version }}
          path: downloads

      - name: Publish GitHub Release
        env:
          GH_TOKEN: ${{ github.token }}
          GH_REPO: ${{ github.repository }}
          RELEASE_TAG: ${{ github.ref_name }}
          RELEASE_SHA: ${{ github.sha }}
        shell: bash
        run: |
          set -euo pipefail
          cd downloads
          if gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
            echo 'Release already exists; refusing to overwrite.' >&2
            exit 1
          fi
          VERSION="${RELEASE_TAG#webpage-magnifier-v}"
          gh release create "$RELEASE_TAG" webpage-magnifier-*.zip \
            --target "$RELEASE_SHA" \
            --title "webpage-magnifier v${VERSION}" \
            --generate-notes
```

### 5.5 ZIP 排除项（已在 Build step 的 $files 数组中精确列出，不 include 则不打包）

| 排除项 | 理由 |
|--------|------|
| `.agent-toolkit/**` | 模板配置，与扩展运行无关 |
| `.trae/**` | TRAE agent 模板 |
| `.github/**` | GitHub 配置 |
| `.codebuddy/**` | Codebuddy 模板 |
| `.workbuddy/**` | Workbuddy 模板 |
| `docs/agent-toolkit.md` | 工具链文档 |
| `scripts/doctor*.ps1` | 开发辅助脚本 |
| `.trae-html-share-packages/**` | popup.html 导出临时目录 |
| `.screenshots/**` | 截图目录 |
| `webpage-magnifier.zip` | 旧产物 |

## 6. 安全与兼容性

- **YAML 语法**：设计完成后必须用 `node -e "const YAML=require('js-yaml'); YAML.load(fs.readFileSync('release-webpage-magnifier.yml','utf8'))"` 校验
- **路径前缀**：所有 workflows 在 monorepo 根，paths 必须带 `webpage-magnifier/` 前缀，zip 构建文件列表也必须带 `webpage-magnifier/` 前缀
- **不与现有 workflow 重名**：9 个现有 workflow 文件名检查通过，`release-webpage-magnifier.yml` 无冲突
- **Git 权限不自动触发**：用户显式要求审阅后 commit，settings 中 Git 权限不自动生效

## 7. 测试验证方案

| 验证对象 | 验证方法 |
|----------|----------|
| README.md 存在 | `Test-Path "c:\flying\ai-tools\webpage-magnifier\README.md"` |
| .gitignore 覆盖规则 | `Get-Content .gitignore | Select-String -Pattern "\*\.zip|\.agent-toolkit"` |
| CHANGELOG 格式 | `Get-Content CHANGELOG.md | Select-String -Pattern "^## \[1\.0\.0\]|^### "` |
| workflow YAML 语法 | `node -e "const fs=require('fs'); const yaml=require('js-yaml'); yaml.load(fs.readFileSync('c:/flying/ai-tools/.github/workflows/release-webpage-magnifier.yml','utf8')); console.log('YAML OK')"` |
| workflow tag 触发规则 | 人工检查 `startsWith(github.ref,'refs/tags/webpage-magnifier-v')` 写法 |
| workflow build 排除项 | 人工检查 `$files` 数组不含 `.agent-toolkit/`、`.trae/` 等模板文件 |
