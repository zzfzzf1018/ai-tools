# 更新日志

本文件记录心晴岛（Sunny Isles）的版本变更。版本号遵循语义化版本（SemVer），并与 git tag `children-social-emotional-learning-vX.Y.Z` 对应。

## [1.0.1] - 首次自动化发布修复

- 修复 GitHub Actions 发布流水线：将 `npm ci` 移至 `Plan release` 步骤之前，解决 `scripts/release.cjs` 在 `plan` 阶段 `require('semver')` 找不到模块（MODULE_NOT_FOUND）导致流水线中断的问题。
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
