const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { resolveVersion } = require('../scripts/version.cjs');
const { validateRelease, prepareReleasePlan } = require('../scripts/release.cjs');

const localEnv = { ...process.env };
for (const key of Object.keys(localEnv)) {
  if (/^(GITHUB_|RUNNER_|TF_BUILD$|JENKINS_|TEAMCITY_|CI$)/.test(key)) delete localEnv[key];
}

function localVersion(project) {
  return resolveVersion(project, { env: localEnv });
}

function command(root, executable, args) {
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  return result.stdout.trim();
}

function versionFixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'typing version space '));
  context.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 }));
  const project = path.join(root, 'children-typing-tutor');
  fs.mkdirSync(path.join(project, '.config'), { recursive: true });
  for (const filename of ['GitVersion.yml', '.config/dotnet-tools.json'])
    fs.copyFileSync(path.resolve(__dirname, '..', filename), path.join(project, filename));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ version: '1.1.0' }));
  command(root, 'git', ['init', '--initial-branch=main']);
  command(root, 'git', ['config', 'user.name', 'Version Test']);
  command(root, 'git', ['config', 'user.email', 'version-test@example.invalid']);
  command(root, 'git', ['config', 'commit.gpgsign', 'false']);
  command(root, 'git', ['config', 'tag.gpgsign', 'false']);
  command(root, 'git', ['add', '.']);
  command(root, 'git', ['commit', '-m', 'Initial project']);
  command(root, 'git', ['tag', '-a', 'children-typing-tutor-v1.1.0', '-m', 'Stable base']);
  command(root, 'git', ['tag', 'other-v99.0.0']);
  command(project, 'dotnet', ['tool', 'restore']);
  return { root, project };
}

test('GitVersion integration: monorepo tags, development, stable detached checkout and clean guard', (context) => {
  const { root, project } = versionFixture(context);
  assert.equal(localVersion(project).SemVer, '1.1.0');
  fs.writeFileSync(path.join(root, 'other-project.txt'), 'Other project\n');
  command(root, 'git', ['add', '.']);
  command(root, 'git', ['commit', '-m', 'Other project +semver: major']);
  const development = localVersion(project);
  assert.match(development.SemVer, /^1\.1\.1-\d+$/);
  command(root, 'git', ['tag', '-a', 'children-typing-tutor-v1.1.1', '-m', 'Release']);
  command(root, 'git', ['checkout', '--detach', 'children-typing-tutor-v1.1.1']);
  const stable = localVersion(project);
  const sha = command(root, 'git', ['rev-parse', 'HEAD']);
  assert.equal(validateRelease(stable, 'children-typing-tutor-v1.1.1', sha), '1.1.1');
  fs.writeFileSync(path.join(root, 'other-project.txt'), 'Dirty\n');
  assert.throws(
    () => validateRelease(localVersion(project), 'children-typing-tutor-v1.1.1', sha),
    /clean worktree/,
  );
  command(root, 'git', ['checkout', 'main']);
  command(root, 'git', ['add', '.']);
  command(root, 'git', ['commit', '-m', 'Post-release change']);
  const clone = path.join(root, 'checkout');
  command(os.tmpdir(), 'git', ['clone', '--no-local', root, clone]);
  command(clone, 'git', ['checkout', '--detach', 'children-typing-tutor-v1.1.1']);
  const clonedProject = path.join(clone, 'children-typing-tutor');
  command(clonedProject, 'dotnet', ['tool', 'restore']);
  const githubVersion = resolveVersion(clonedProject, {
    env: {
      ...localEnv,
      GITHUB_ACTIONS: 'true',
      GITHUB_REF: 'refs/tags/children-typing-tutor-v1.1.1',
      GITHUB_REF_NAME: 'children-typing-tutor-v1.1.1',
      GITHUB_SHA: sha,
      GITHUB_REPOSITORY: 'test/typing-island',
      GITHUB_WORKSPACE: clone,
      CI: 'true',
    },
  });
  assert.equal(validateRelease(githubVersion, 'children-typing-tutor-v1.1.1', sha), '1.1.1');
});

test('release planning compares the project version across the whole push and tags only an increase', (context) => {
  const { root, project } = versionFixture(context);
  const base = command(root, 'git', ['rev-parse', 'HEAD']);
  const metadataPath = path.join(project, 'package.json');
  function commit(message) {
    command(root, 'git', ['add', '.']);
    command(root, 'git', ['commit', '-m', message]);
    return command(root, 'git', ['rev-parse', 'HEAD']);
  }
  function event(before, sha) {
    return {
      ...localEnv,
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_REF_NAME: 'main',
      GITHUB_SHA: sha,
      GITHUB_REPOSITORY: 'test/typing-island',
      GITHUB_WORKSPACE: root,
      TYPING_BEFORE_SHA: before,
    };
  }
  fs.writeFileSync(path.join(project, 'notes.txt'), 'Project change without a version bump\n');
  commit('Project change');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '99.0.0' }));
  const unchanged = commit('Other project version change');
  assert.deepEqual(prepareReleasePlan(project, event(base, unchanged)), {
    publish: false,
    tag: '',
  });
  assert.equal(
    command(root, 'git', ['tag', '--list', 'children-typing-tutor-v*']),
    'children-typing-tutor-v1.1.0',
  );
  fs.writeFileSync(metadataPath, JSON.stringify({ version: '1.2.0' }));
  commit('Bump project version');
  fs.writeFileSync(path.join(project, 'notes.txt'), 'A later commit in the same push\n');
  const increased = commit('Follow-up in the same push');
  const original = fs.readFileSync(metadataPath);
  const plan = prepareReleasePlan(project, event(unchanged, increased));
  assert.deepEqual(plan, { publish: true, tag: 'children-typing-tutor-v1.2.0' });
  assert.equal(localVersion(project).SemVer, '1.2.0');
  assert.equal(command(root, 'git', ['rev-parse', `${plan.tag}^{commit}`]), increased);
  assert.deepEqual(fs.readFileSync(metadataPath), original);
  assert.throws(() => prepareReleasePlan(project, event(unchanged, increased)), /already exists/);
  fs.writeFileSync(path.join(project, 'notes.txt'), 'Next pipeline without a release\n');
  const next = commit('No new release version');
  assert.match(localVersion(project).SemVer, /^1\.2\.1-\d+$/);
  assert.equal(prepareReleasePlan(project, event(increased, next)).publish, false);
  assert.equal(
    prepareReleasePlan(project, { ...event(increased, next), GITHUB_EVENT_NAME: 'pull_request' })
      .publish,
    false,
  );
  assert.throws(
    () => prepareReleasePlan(project, { ...event(increased, next), TYPING_BEFORE_SHA: 'invalid' }),
    /before SHA/,
  );
});
