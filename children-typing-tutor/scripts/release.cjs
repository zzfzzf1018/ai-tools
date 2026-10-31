const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const semver = require('semver');
const { resolveVersion } = require('./version.cjs');

const projectRoot = path.resolve(__dirname, '..');

function planRelease(current, previous, event) {
  const plan = { publish: false, tag: '' };
  if (event.name !== 'push' || event.ref !== 'refs/heads/main') return plan;
  if (current === previous) return plan;
  const tag = `children-typing-tutor-v${current}`;
  validateRelease({ SemVer: current, Sha: event.sha, UncommittedChanges: 0 }, tag, event.sha);
  if (previous !== null && (!semver.valid(previous) || !semver.gt(current, previous))) {
    throw new Error('Release version must increase; downgrades are not published.');
  }
  return { publish: true, tag };
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
  if (!/^[0-9a-f]{40}$/i.test(env.TYPING_BEFORE_SHA || '')) {
    throw new Error('The push before SHA is required to compare project versions.');
  }
  if (runGit(root, ['rev-parse', 'HEAD']) !== event.sha) {
    throw new Error('Release planning requires the pushed commit to be checked out.');
  }
  const current = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  let previous = null;
  if (!/^0{40}$/.test(env.TYPING_BEFORE_SHA)) {
    const prefix = runGit(root, ['rev-parse', '--show-prefix']);
    const filename = `${prefix}package.json`;
    const entry = runGit(root, ['ls-tree', '--full-tree', env.TYPING_BEFORE_SHA, '--', filename]);
    if (entry) {
      previous = JSON.parse(runGit(root, ['show', `${env.TYPING_BEFORE_SHA}:${filename}`])).version;
    }
  }
  const plan = planRelease(current, previous, event);
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
      `Typing Island ${current}`,
      event.sha,
    ]);
    validateRelease(resolveVersion(root, { env }), plan.tag, event.sha);
  }
  return plan;
}

function validateRelease(version, tag, sha) {
  const match = /^children-typing-tutor-v(\d+\.\d+\.\d+)$/.exec(tag || '');
  if (!match || semver.valid(match[1]) !== match[1]) {
    throw new Error('Release tag must be children-typing-tutor-vX.Y.Z (stable SemVer).');
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

function prepareAssets(root, version) {
  if (!semver.valid(version.SemVer) || !/^[0-9a-f]{40}$/i.test(version.Sha || '')) {
    throw new Error('Invalid release version or SHA.');
  }
  const filenames = [
    `Typing-Island-${version.SemVer}-x64-portable.exe`,
    `Typing-Island-${version.SemVer}-x64-setup.exe`,
    `Typing-Island-${version.SemVer}-web.zip`,
  ];
  const source = path.join(root, 'release');
  for (const filename of filenames) {
    const artifact = path.join(source, filename);
    if (
      !fs.existsSync(artifact) ||
      !fs.statSync(artifact).isFile() ||
      !fs.statSync(artifact).size
    ) {
      throw new Error(`Missing or empty release asset: ${filename}`);
    }
  }
  const destination = path.join(root, 'release-assets');
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination);
  const assets = filenames.map((filename) => {
    const contents = fs.readFileSync(path.join(source, filename));
    fs.writeFileSync(path.join(destination, filename), contents);
    return {
      filename,
      bytes: contents.length,
      sha256: createHash('sha256').update(contents).digest('hex'),
    };
  });
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
