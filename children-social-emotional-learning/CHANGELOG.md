# 更新日志

本文件记录心晴岛（Sunny Isles）的版本变更。版本号遵循语义化版本（SemVer），并与 git tag `children-social-emotional-learning-vX.Y.Z` 对应。

## [1.0.1] - 首次自动化发布修复

- 修复 GitHub Actions 发布流水线：将 `npm ci` 移至 `Plan release` 步骤之前，解决 `scripts/release.cjs` 在 `plan` 阶段 `require('semver')` 找不到模块（MODULE_NOT_FOUND）导致流水线中断的问题。
- 将 `npm ci` 改为 `npm install`，规避 electron-builder 平台专属可选依赖（如 macOS 的 dmg-license）导致的跨平台锁严格校验失败（EUSAGE）。
- 在 `npm install` 后增加 `git checkout -- package-lock.json`，还原被 npm 按平台重写的 lock 文件，满足发布流水线对干净工作树的要求。
- 将发布工作流自身加入 `paths` 过滤，确保仅修改工作流时也能自动触发 CI。
- 每次发布自动将本版本在 `CHANGELOG.md` 中的段落作为 GitHub Release 说明（release notes），确保发布包含改动内容；同时保留应用使用说明与离线/校验提示。
- 此为首次经 CI 成功打 tag 并发布 GitHub Release 的版本（应用功能与 1.0.0 一致）。

## [1.0.0] - 初版

- 5 座 SEL 小岛、19 个互动关卡（7 种题型）。
- 10 种情绪脸谱、每日 4 步情绪签到、心情日历。
- 5 个"策略肌肉"（觉察 / 呼吸 / 应对 / 拉开距离 / 表达）。
- 情绪花园 + 12 枚奖励贴纸 + 多档案。
- 家长面板（算术家长门、数据雷达、打卡日历、关卡进度、JSON 备份导入导出）。
- Web 版（双击 `index.html`，`file://` 离线运行）与 Windows 桌面便携版（Electron 单文件 exe）。
- 全离线：Web Audio 合成音效、浏览器 TTS 中文语音、内联 SVG 美术，零外部资源。
- 静态校验（`tools/verify.mjs`）与 jsdom 运行时冒烟测试（`tools/smoke.mjs`）。
- GitVersion 版本管理与 GitHub Actions 自动构建/发布。
