const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const semver = require('semver');
const { resolveVersion } = require('./version.cjs');
const { createZip } = require('../tools/lib/zip.cjs');

const projectRoot = path.resolve(__dirname, '..');
const TAG_RE = /^children-social-emotional-learning-v(\d+\.\d+\.\d+)$/;

function planRelease(current, previous, event, root) {
  const plan = { publish: false, tag: '' };
  if (event.name !== 'push' || event.ref !== 'refs/heads/main') return plan;
  const tag = `children-social-emotional-learning-v${current}`;
  validateRelease({ SemVer: current, Sha: event.sha, UncommittedChanges: 0 }, tag, event.sha);
  // 不允许降级发布
  if (previous !== null && semver.valid(previous) && semver.lt(current, previous)) {
    throw new Error('Release version must increase; downgrades are not published.');
  }
  if (previous === null) {
    // 首次发布：该子项目路径上尚无历史版本
    plan.publish = true;
  } else if (semver.gt(current, previous)) {
    // 版本递增
    plan.publish = true;
  } else if (semver.eq(current, previous)) {
    // 同版本：仅当 tag 尚未存在时重发（覆盖"上一次推送设了版本却因流水线失败未发布"的情况），
    // 若 tag 已存在则跳过，避免重复发布。
    if (root && !runGit(root, ['tag', '--list', tag])) plan.publish = true;
  }
  if (plan.publish) plan.tag = tag;
  return plan;
}

function runGit(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: false });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.error?.message || result.stderr}`);
  }
  return result.stdout.trim();
}

function prepareReleasePlan(root, env) {
  const event = { name: env.GITHUB_EVENT_NAME, ref: env.GITHUB_REF, sha: env.GITHUB_SHA };
  if (event.name !== 'push' || event.ref !== 'refs/heads/main') {
    return { publish: false, tag: '' };
  }
  if (!/^[0-9a-f]{40}$/i.test(env.SEL_BEFORE_SHA || '')) {
    throw new Error('The push before SHA is required to compare project versions.');
  }
  if (runGit(root, ['rev-parse', 'HEAD']) !== event.sha) {
    throw new Error('Release planning requires the pushed commit to be checked out.');
  }
  const current = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  let previous = null;
  if (!/^0{40}$/.test(env.SEL_BEFORE_SHA)) {
    const prefix = runGit(root, ['rev-parse', '--show-prefix']);
    const filename = `${prefix}package.json`;
    const entry = runGit(root, ['ls-tree', '--full-tree', env.SEL_BEFORE_SHA, '--', filename]);
    if (entry) {
      previous = JSON.parse(runGit(root, ['show', `${env.SEL_BEFORE_SHA}:${filename}`])).version;
    }
  }
  const plan = planRelease(current, previous, event, root);
  if (plan.publish) {
    if (runGit(root, ['tag', '--list', plan.tag])) {
      throw new Error(`Release tag ${plan.tag} already exists; use a new version.`);
    }
    runGit(root, [
      '-c',
      'user.name=github-actions[bot]',
      '-c',
      'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      '-c',
      'tag.gpgsign=false',
      'tag',
      '-a',
      plan.tag,
      '-m',
      `心晴岛 ${current}`,
      event.sha,
    ]);
    validateRelease(resolveVersion(root, { env }), plan.tag, event.sha);
  }
  return plan;
}

function validateRelease(version, tag, sha) {
  const match = TAG_RE.exec(tag || '');
  if (!match || semver.valid(match[1]) !== match[1]) {
    throw new Error('Release tag must be children-social-emotional-learning-vX.Y.Z (stable SemVer).');
  }
  if (match[1].split('.').some((number) => Number(number) > 65535)) {
    throw new Error('Windows version components must not exceed 65535.');
  }
  if (version.SemVer !== match[1] || version.Sha !== sha) {
    throw new Error(
      `Release tag, GitVersion and checked-out commit do not match: ${tag}, ${version.SemVer}, ${version.Sha}, ${sha}.`,
    );
  }
  if (version.UncommittedChanges !== 0) {
    throw new Error('A release requires a clean worktree.');
  }
  return match[1];
}

function existsFile(p) {
  return fs.existsSync(p) && fs.statSync(p).isFile() && fs.statSync(p).size > 0;
}

function prepareAssets(root, version) {
  if (!semver.valid(version.SemVer) || !/^[0-9a-f]{40}$/i.test(version.Sha || '')) {
    throw new Error('Invalid release version or SHA.');
  }
  const distDir = path.join(root, 'dist');
  const portableName = `SunnyIsles-SEL-${version.SemVer}.exe`;
  const portable = path.join(distDir, portableName);
  if (!existsFile(portable)) {
    throw new Error(`Missing or empty release asset: ${portableName} (run npm run build:win first).`);
  }

  const destination = path.join(root, 'release-assets');
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination);

  const assets = [];
  const addAsset = (srcPath, fileName) => {
    const contents = fs.readFileSync(srcPath);
    fs.writeFileSync(path.join(destination, fileName), contents);
    assets.push({
      filename: fileName,
      bytes: contents.length,
      sha256: createHash('sha256').update(contents).digest('hex'),
    });
  };

  // 桌面版：electron-builder 产出的单文件便携 exe
  addAsset(portable, portableName);

  // Web 版：纯前端文件打包（可用浏览器直接打开或静态托管）
  // 注意：manifest / Service Worker / 图标必须一起打包，否则「安装到桌面 + 离线启动」失效。
  const webName = `SunnyIsles-SEL-${version.SemVer}-web.zip`;
  const webZip = path.join(destination, webName);
  const webEntries = [
    'index.html',
    'manifest.webmanifest',
    'sw.js',
    'icons',
    'src',
    'desktop',
    'README.md',
    'CHANGELOG.md',
  ].map((e) => path.join(root, e));
  webEntries.forEach((p) => {
    if (!fs.existsSync(p)) throw new Error(`Web 打包缺文件: ${path.relative(root, p)}`);
  });
  const packed = createZip(webZip, webEntries);
  // 打完再验一遍：缺了 PWA 文件的包看起来"能跑"，但装不了也离线不了，必须在发布前拦住。
  // 同时也确认条目名统一用 '/'——反斜杠在 macOS/Linux 解压会变成文件名的一部分，路径全废。
  const required = [
    'index.html',
    'manifest.webmanifest',
    'sw.js',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'src/main.js',
    'src/core/screentime.js',
    'src/ui/calm.js',
    'desktop/serve.mjs',
  ];
  const missing = required.filter((f) => !packed.includes(f));
  if (missing.length) throw new Error(`web.zip 缺少 PWA 文件: ${missing.join(', ')}`);
  const backslash = packed.filter((f) => f.includes('\\'));
  if (backslash.length) throw new Error(`web.zip 条目名用了反斜杠: ${backslash.slice(0, 3).join(', ')}`);
  if (!existsFile(webZip)) throw new Error(`Web zip not created: ${webName}`);
  addAsset(webZip, webName);

  fs.writeFileSync(
    path.join(destination, 'SHA256SUMS.txt'),
    assets.map((asset) => `${asset.sha256}  ${asset.filename}\n`).join(''),
  );
  fs.writeFileSync(
    path.join(destination, 'release.json'),
    `${JSON.stringify({ version: version.SemVer, fullVersion: version.FullSemVer, commit: version.Sha, assets }, null, 2)}\n`,
  );
  return assets;
}

if (require.main === module) {
  try {
    const mode = process.argv[2];
    if (!['plan', 'version', 'prepare'].includes(mode))
      throw new Error('Usage: node scripts/release.cjs plan|version|prepare');
    if (mode === 'plan') {
      const plan = prepareReleasePlan(projectRoot, process.env);
      console.log(
        plan.publish
          ? `Version changed: publish ${plan.tag}`
          : 'Version unchanged or PR: pipeline only.',
      );
      if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `publish=${plan.publish}\ntag=${plan.tag}\n`);
      }
      return;
    }
    const version = resolveVersion(projectRoot);
    if (process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF_TYPE === 'tag') {
      validateRelease(version, process.env.GITHUB_REF_NAME, process.env.GITHUB_SHA);
    }
    if (mode === 'version') {
      console.log(`GitVersion: ${version.SemVer} (${version.Sha})`);
      if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version.SemVer}\n`);
      }
    } else {
      if (process.env.RELEASE_VERSION !== version.SemVer) {
        throw new Error('Build version changed before preparing release assets.');
      }
      prepareAssets(projectRoot, version);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateRelease, prepareAssets, planRelease, prepareReleasePlan };
