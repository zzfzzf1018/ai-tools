# 0006 — 修复 release workflow annotated tag 场景下 gh release create 失败

**日期：** 2026-11-24
**状态：** Done
**工作流：** single-branch（main）
**评审策略：** never

## 用户原始请求

> CI挂了

## 根因

在 annotated tag push 事件中，GitHub Actions 的 `github.sha` 返回的是 **tag 对象 SHA**（如 `437561bf...`），而非 tag 指向的 commit SHA。`gh release create --target` 的官方文档明确注明 "(not tag SHA)"，传入 tag 对象会直接失败；且 tag 已存在时 `--target` 本来就会被 gh 忽略（gh 文档："Ignored if the tag provided already exists"），属于冗余且有害的参数。

本次 run `45341235423` 的 release job（`138265230042`）仅 1 秒即退出码 1，build job 成功，CHANGELOG 提取成功，唯独 `gh release create` 失败，与上述根因吻合。

## 修复

删除 `release-webpage-magnifier.yml` release job 中的：
```yaml
RELEASE_SHA: ${{ github.sha }}
ARGS+=( "--target" "$RELEASE_SHA" )
```
以及相关 env 定义。tag 已存在时 `gh release create <tagname> <asset>` 可以直接创建 release。

## 验收

- 工作流 YAML 解析通过
- 重新 push 标签（或 rerun release job）时 release 步骤成功
- 热修复范围仅限 `.github/workflows/release-webpage-magnifier.yml`

## 交互决策

- 不做 commit / push（settings.json 中 autoCommit=false、autoPush=false；用户未明确授权）
- 用户可选择：(a) 手动 commit + push 后 rerun release job；(b) 临时在本地用 gh CLI 创建 release
