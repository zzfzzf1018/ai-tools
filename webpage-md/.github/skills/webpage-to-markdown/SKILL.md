---
name: webpage-to-markdown
description: "Use when you need to fetch a webpage, extract its main article as Markdown, keep the original URL in the heading, and save supplementary content separately as extras for later reference. Works for article pages, tutorials, documentation chapters, and batch URL processing."
argument-hint: "Webpage URL, output folder, optional CSS selector, optional render mode, optional wait-for selector, optional timeout"
user-invocable: true
disable-model-invocation: false
---

# 网页转 Markdown

## Outcome
Use this skill to fetch a webpage, detect and convert the main article into Markdown, and write the page's non-article/readability content into a separate file. This keeps the article clean while preserving navigation, sidebars, footers, and other supplemental content for later review.

## When to Use
- You need to convert a URL into Markdown for reading, copying, or archiving.
- The page is an article, tutorial, chapter, or document-style page with an obvious main content area.
- You want the article title to link back to the original source URL.
- You want the article content separated from ancillary material like sidebars, menus, or footer text.
- You need to process multiple URLs in one batch.

## Inputs to Collect
- Target URL (HTTP/HTTPS only)
- Optional output folder
- Optional CSS selector when the default auto-detection is not good enough
- Optional `--render` if the page depends on JavaScript to load content
- Optional `--wait-for` selector for JS-rendered pages
- Optional timeout value in milliseconds
- Optional list file for batch processing (`--file .\urls.txt`)

## Repo Commands
the following commands work from the workspace root for this project:

- Single page: `node .\src\cli.js "https://example.com/article"`
- Single page via Windows wrapper: ` .\run.cmd "https://example.com/article" `
- Batch processing: ` .\batch.cmd --file .\urls.txt `
- Batch processing with direct URLs: ` .\batch.cmd "https://example.com/article-1" "https://example.com/article-2" `

## Procedure
1. Verify Node.js 22+ is installed.
2. If needed, run the repository wrapper to install dependencies automatically.
3. Fetch the page HTML and detect the main article content.
4. Convert the selected content into Markdown while preserving the original source URL in the title.
5. Save the article as `content.md`, extras as `extras.md`, and metadata as `metadata.json` in an output subfolder.
6. If the page is JS-driven or lazy-loading content, rerun with `--render` and a suitable `--wait-for` selector.
7. For many URLs, use the batch script and summarize any failed pages without stopping the rest.

## Output Structure
Each successful fetch creates a separate folder under `output\`:

```text
output\
  标题-时间戳\
    content.md
    extras.md
    metadata.json
```

- `content.md`: main article text; title is formatted as `# [文章标题](<原始网址>)`
- `extras.md`: supplemental page content (menus, nav, sidebar, footer, etc.)
- `metadata.json`: original URL, final redirected URL, title, author, summary, extracted metadata, time, warnings, and the extraction method

## Defaults in This Repo
- Primary extraction uses Mozilla Readability.
- Non-article DOM content is retained in `extras.md` instead of being discarded.
- Output is UTF-8 and uses UTC timestamps.
- Images remain as online references; the tool does not download image binaries.
- If the page has a noisy layout or poor auto-detection, specify a CSS selector with `--selector`.

## Quality Criteria
- Markdown was generated for the target page.
- Original URL is present in the generated title and metadata.
- Article content is separated from navigation/sidebar/footer content.
- Output is saved under a unique per-run directory.
- Failed URLs are reported clearly when using batch mode.

## Example Prompts
- `/webpage-to-markdown 抓取这篇文章并转成 Markdown：https://www.socratopia.app/library/command-ai-adult-zh/chapter-1`
- `/webpage-to-markdown 把这个网页正文保存成 Markdown，标题要带上原网址，并把侧栏和导航放到 extras.md`
- `/webpage-to-markdown 使用默认识别抓取这个页面并输出到 output 目录`
- `/webpage-to-markdown 批量处理 urls.txt 中的多个网页，遇到失败继续处理后面的地址`
- `/webpage-to-markdown 这个页面依赖 JS，使用 render 和 wait-for 方式抓取正文`

## Notes
- This skill is intentionally scoped to the current repo. It packages the local tool in `webpage-md` and relies on the project scripts and CLI.
- If the user asks for a different output path, pass `-o` or `--output` with a workspace-relative or absolute path.
- If a site requires JavaScript rendering, prefer `--render --wait-for "article"` or another stable selector.
