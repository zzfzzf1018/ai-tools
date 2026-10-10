# 网页转 Markdown

传入一个网址，抓取网页并将**正文**和**其他可读页面内容**分开保存。适合文章、教程、文档章节等以文字为主的页面。

默认使用 Mozilla Readability 自动识别正文，再转换为 Markdown。支持标题、段落、列表、引用、代码块、带表头的表格、删除线、链接和图片引用。相对链接和图片地址会转换为绝对地址。

## Windows 一键运行

安装 **Node.js 22 或更新版本**后，无需手动执行 `npm install`：

```powershell
.\run.cmd "https://www.socratopia.app/library/command-ai-adult-zh/chapter-1"
```

也可以在资源管理器中双击 `run.cmd`，按提示粘贴网址并回车。双击运行结束后会暂停，便于查看输出目录或错误。

脚本会检查 Node.js/npm，首次运行自动使用 `npm ci` 安装锁定版本的依赖。后续运行检查依赖状态；依赖缺失、损坏或依赖清单改变时重新安装，否则直接复用。安装失败立即停止并报告错误。

所有 CLI 参数都可以透传：

```powershell
.\run.cmd "https://example.com/article" --selector "article" -o ".\my-docs"
.\run.cmd "https://example.com/article" --render --wait-for "article" --timeout 60000
```

使用 `--render` 时，脚本自动安装 Chromium；已安装的对应版本会复用。第一次安装依赖或浏览器需要联网。

脚本可以从其他工作目录调用，默认输出及相对 `--output` 路径均相对于工具目录。不自动修改系统环境或安装 Node.js；缺少 Node.js 时会给出安装提示。

如果希望直接使用 PowerShell：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\run.ps1 "https://example.com/article"
```

`run.cmd` 同样仅为本次 PowerShell 进程设置执行策略，不修改系统执行策略。

## 手动安装

需要 **Node.js 22 或更新版本**，无需 Python 或 API Key。

在此目录运行：

```powershell
npm install
```

## 快速开始

```powershell
node .\src\cli.js "https://www.socratopia.app/library/command-ai-adult-zh/chapter-1"
```

也可以通过 npm 启动：

```powershell
npm start -- "https://www.socratopia.app/library/command-ai-adult-zh/chapter-1"
```

每次抓取都会在 `output` 下创建一个独立的“标题-时间戳”目录，避免覆盖已有结果：

```text
output\
  标题-时间戳\
    content.md
    extras.md
    metadata.json
```

| 文件 | 内容 |
| --- | --- |
| `content.md` | 正文，标题链接到传入的原始网址；附原始网址、重定向后的最终网址（如不同）和抓取时间 |
| `extras.md` | 没有被选入正文的可读内容，例如导航、目录、侧栏、页脚；没有其他内容时会明确标注 |
| `metadata.json` | 原始/最终网址、标题、作者、摘要、站点、语言、提取方式、正文文本长度、抓取时间和警告；缺失字段为 `null` |

输出使用 UTF-8。抓取时间使用 UTC。图片保留在线引用，**不会下载图片文件**。脚本、样式、嵌入框架和明确标记为隐藏的内容不会转换。

转换前会恢复常见的 `data-src`、`data-original`、`data-lazy-src` 懒加载图片，以及仅包含单张图片的 `noscript` 回退（相邻占位图片会被替换）。仅接受 HTTP/HTTPS 图片地址；其他依赖站点脚本或特殊属性的懒加载方式不保证支持，可以尝试 `--render`。

正文标题的格式为 `# [文章标题](<原始网址>)`，点击标题即可返回原网页。已生成的旧文档不会被改写，重新抓取后才采用新格式。

`.gitignore` 已忽略 `node_modules`、默认 `output`、日志、覆盖率和本地环境变量文件；依赖锁文件保留在版本控制中。自定义输出到其他目录时，请自行添加对应忽略规则。

## 正文识别不准确时

自动识别是一种启发式算法，不保证适用于所有页面。请检查结果，尤其是带有大量目录、登录提示或侧栏的页面。

如果知道正文容器的 CSS 选择器，可直接指定：

```powershell
node .\src\cli.js "https://example.com/article" --selector "article"
```

选择器必须匹配**恰好一个元素**。选中容器内的所有可读内容都会作为正文，因此应尽量选择正文内容区，而不是包含导航的整个页面。

例如，所提供的 Socratopia 示例目前可以默认识别；若想明确指定其章节内容区：

```powershell
node .\src\cli.js "https://www.socratopia.app/library/command-ai-adult-zh/chapter-1" --selector ".chapter-content"
```

页面结构可能变化，选择器不是站点永久接口。其目录、辅助阅读副本等未选入正文的内容保留在备用文档中，备用文档可能包含与正文重复的文字。

分离按内容的 DOM 来源进行，不按文字内容全局去重：已提取正文不会因段落重组再次进入备用文件，但原页面其他位置独立存在的相同文字或同名标题会保留。正文中与文档标题相同的一级标题会去除，避免重复显示；此处理不影响备用文件中的标题。

## 需要 JavaScript 渲染的网页

默认直接下载 HTML，不执行网页脚本。对于浏览器打开后才出现正文的页面，安装 Chromium 并使用渲染模式：

```powershell
npx playwright install chromium
node .\src\cli.js "https://example.com/article" --render
```

默认渲染模式等待网络空闲。存在持续网络请求，或正文延迟加载的页面，可指定等待的可见元素；此时会在初始 HTML 加载后等待该元素，不再等待网络空闲：

```powershell
node .\src\cli.js "https://example.com/article" --render --wait-for "article" --selector "article" --timeout 60000
```

`--wait-for` 仅控制渲染等待条件，`--selector` 控制提取范围，两者可以不同。选择能代表正文加载完成的元素。渲染模式会执行目标网页的 JavaScript，请仅用于可信页面。

## 参数

| 参数 | 说明 |
| --- | --- |
| `-o, --output <目录>` | 输出父目录，默认 `output` |
| `--selector <CSS>` | 指定唯一的正文容器，默认自动识别 |
| `--render` | 使用无头 Chromium 渲染网页 |
| `--wait-for <CSS>` | 等待元素可见，必须同时使用 `--render` |
| `--timeout <毫秒>` | 网络请求或浏览器导航/元素等待的超时，默认 `30000`；不是整个命令的总时限 |
| `-h, --help` | 显示帮助 |

自定义输出位置：

```powershell
node .\src\cli.js "https://example.com/article" -o ".\my-docs"
```

抓取失败、HTTP 错误、非 HTML 响应、选择器无匹配/多匹配、未找到正文或文件写入失败时，会输出错误并以非零退出码结束，不会假装生成成功。正文很短时会输出警告，提醒检查结果。工具不自动重试，也不自动切换到浏览器模式。

## 范围与限制

- 一次处理一个网址，不自动抓取全站、整本书或下一章。
- 不绕过登录、付费墙、验证码、反爬限制或站点访问控制；没有有效登录会话的页面可能只能提取登录提示。
- 默认抓取只依据 HTML，无法判断依赖外部 CSS 的全部可见性；CSS 隐藏的辅助阅读副本可能留在备用文档中。
- 备用文档是其他**可读 HTML 内容**的 Markdown，不是完整 HTML、脚本或资源归档。
- 不处理 PDF，不提取图片文字，不保证保留复杂交互组件、视频或无表头/合并单元格表格的完整结构。
- 仅支持 HTTP/HTTPS，不接受带用户名或密码的网址。作为本地 CLI，它可以访问本机可访问的网址；不要未经访问限制就将它部署成对外开放的抓取服务。
- 请仅抓取你有权使用的内容，并遵守目标站点条款、版权和适用的访问规则。

## 开发与验证

```powershell
npx playwright install chromium
npm test
```

测试使用原创 HTML 和本机 HTTP 服务，覆盖正文/备用内容分离、重组段落来源追踪、独立重复文字与同名标题保留、懒加载图片恢复、Markdown 结构、链接与图片地址、字符编码、重定向、标题原网址链接、错误、超时、重复输出、CLI 端到端流程，以及 JavaScript 动态正文。渲染测试需要上述 Chromium 安装。Windows 下还会在临时目录验证一键脚本的首次依赖安装、复用和参数透传，因此需要访问 npm 软件包源。

代码分工：

- `src\fetch.js`：静态下载、字符编码处理和可选浏览器渲染。
- `src\extract.js`：正文识别、备用内容分离和 Markdown 转换。
- `src\cli.js`：参数校验、文件输出和终端错误报告。
- `test\webpage-md.test.js`：自动化回归测试。
- `run.cmd` / `run.ps1`：Windows 一键启动和依赖准备。
