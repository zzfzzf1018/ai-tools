const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { checkEnvironment, parseTarget, runBuild } = require('../scripts/build.cjs');
const { validateRelease, prepareAssets, planRelease } = require('../scripts/release.cjs');
const { parse: parseYaml } = require('yaml');

test('only a main push with an increased project version is published', () => {
  const event = { name: 'push', ref: 'refs/heads/main', sha: 'a'.repeat(40) };
  assert.deepEqual(planRelease('1.1.0', '1.1.0', event), { publish: false, tag: '' });
  assert.deepEqual(planRelease('1.1.1', '1.1.0', event), {
    publish: true,
    tag: 'children-typing-tutor-v1.1.1',
  });
  assert.equal(planRelease('1.1.0', null, event).publish, true);
  assert.equal(planRelease('1.1.1', '1.1.0', { ...event, name: 'pull_request' }).publish, false);
  assert.equal(
    planRelease('1.1.1', '1.1.0', { ...event, ref: 'refs/tags/children-typing-tutor-v1.1.1' })
      .publish,
    false,
  );
  assert.throws(() => planRelease('1.0.0', '1.1.0', event), /must increase/);
  assert.throws(() => planRelease('1.1.1-rc.1', '1.1.0', event), /stable SemVer/);
});

test('release accepts only a clean, matching stable project tag and Windows version', () => {
  const sha = 'a'.repeat(40);
  const version = { SemVer: '1.2.3', Sha: sha, UncommittedChanges: 0 };
  assert.equal(validateRelease(version, 'children-typing-tutor-v1.2.3', sha), '1.2.3');
  for (const tag of [
    'v1.2.3',
    'other-v1.2.3',
    'children-typing-tutor-v01.2.3',
    'children-typing-tutor-v1.2.3-rc.1',
    'children-typing-tutor-v1.0.0-sealed-20261031',
  ])
    assert.throws(() => validateRelease(version, tag, sha), /stable SemVer/);
  assert.throws(
    () => validateRelease(version, 'children-typing-tutor-v1.2.4', sha),
    /do not match/,
  );
  assert.throws(
    () => validateRelease(version, 'children-typing-tutor-v1.2.3', 'b'.repeat(40)),
    /do not match/,
  );
  assert.throws(
    () =>
      validateRelease({ ...version, UncommittedChanges: 1 }, 'children-typing-tutor-v1.2.3', sha),
    /clean worktree/,
  );
  assert.throws(() => validateRelease(version, 'children-typing-tutor-v65536.0.0', sha), /65535/);
});

test('release assets use the calculated version and include verifiable hashes', (context) => {
  const { root, write } = fixture(context);
  for (const suffix of ['x64-portable.exe', 'x64-setup.exe', 'web.zip'])
    write(`release/Typing-Island-1.2.3-${suffix}`);
  write('release-assets/stale.txt');
  const version = { SemVer: '1.2.3', FullSemVer: '1.2.3', Sha: 'a'.repeat(40) };
  const assets = prepareAssets(root, version);
  assert.equal(assets.length, 3);
  assert.equal(fs.existsSync(path.join(root, 'release-assets/stale.txt')), false);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-assets/release.json')));
  assert.equal(manifest.commit, version.Sha);
  assert.equal(manifest.version, version.SemVer);
  const { createHash } = require('node:crypto');
  for (const asset of assets) {
    const contents = fs.readFileSync(path.join(root, 'release-assets', asset.filename));
    assert.equal(asset.sha256, createHash('sha256').update(contents).digest('hex'));
    assert.equal(asset.bytes, contents.length);
    assert.ok(
      fs
        .readFileSync(path.join(root, 'release-assets/SHA256SUMS.txt'), 'utf8')
        .includes(`${asset.sha256}  ${asset.filename}\n`),
    );
  }
  fs.truncateSync(path.join(root, 'release/Typing-Island-1.2.3-web.zip'), 0);
  assert.throws(() => prepareAssets(root, version), /Missing or empty/);
  assert.equal(fs.existsSync(path.join(root, 'release-assets/release.json')), true);
  assert.throws(
    () => prepareAssets(root, { ...version, SemVer: '../../unsafe' }),
    /Invalid release/,
  );
});

test('repository-root workflow gates publication on full history, tests and actual exe checks', () => {
  const workflow = parseYaml(
    fs.readFileSync(
      path.resolve(__dirname, '../../.github/workflows/children-typing-tutor-release.yml'),
      'utf8',
    ),
  );
  assert.deepEqual(workflow.on.push.paths, ['children-typing-tutor/**']);
  assert.deepEqual(workflow.on.pull_request.paths, ['children-typing-tutor/**']);
  assert.equal(workflow.on.push.tags, undefined);
  assert.equal(workflow.on.workflow_dispatch, undefined);
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.jobs.verify['runs-on'], 'windows-latest');
  assert.equal(workflow.jobs.verify.defaults.run['working-directory'], 'children-typing-tutor');
  const steps = workflow.jobs.verify.steps;
  for (const step of [...steps, ...workflow.jobs.publish.steps]) {
    if (step.uses) assert.match(step.uses, /^actions\/[a-z-]+@[0-9a-f]{40}$/);
  }
  const checkout = steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with['fetch-depth'], 0);
  assert.equal(checkout.with['persist-credentials'], false);
  for (const command of [
    'dotnet tool restore',
    'npm test',
    'npm run test:version',
    'npm run test:e2e',
    'npm run build:all',
    'npm audit --audit-level=high',
  ])
    assert.ok(
      steps.some((step) => step.run === command),
      command,
    );
  assert.equal(steps.filter((step) => step.run?.includes('npm run test:desktop')).length, 2);
  assert.equal(workflow.jobs.publish.needs, 'verify');
  assert.equal(workflow.jobs.publish.permissions.contents, 'write');
  assert.equal(
    workflow.jobs.publish.if,
    "github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.verify.outputs.publish == 'true'",
  );
  assert.equal(workflow.jobs.verify.outputs.publish, '${{ steps.plan.outputs.publish }}');
  assert.ok(
    steps.find((step) => step.id === 'plan').env.TYPING_BEFORE_SHA.includes('github.event.before'),
  );
  const publish = workflow.jobs.publish.steps.find((step) => step.run)?.run;
  assert.ok(publish.includes('sha256sum --check SHA256SUMS.txt'));
  assert.ok(publish.includes('--target "$RELEASE_SHA" --draft'));
});

function fixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'typing build space '));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const metadata = { name: 'typing-island', version: '1.0.0' };
  for (const filename of ['package.json', 'package-lock.json']) {
    fs.writeFileSync(path.join(root, filename), JSON.stringify(metadata));
  }
  const commands = [];
  function write(relativePath) {
    const destination = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, 'fixture artifact');
  }
  const execute = (args, cwd, extraEnv) => {
    assert.equal(cwd, root);
    commands.push(args);
    if (args[1] === 'desktop:runtime') {
      assert.deepEqual(extraEnv, {
        ELECTRON_INSTALL_PLATFORM: 'win32',
        ELECTRON_INSTALL_ARCH: 'x64',
      });
      write('node_modules/electron/dist/electron.exe');
      write('node_modules/electron/dist/version');
      fs.writeFileSync(path.join(root, 'node_modules/electron/dist/version'), 'v45.1.0\n');
      fs.writeFileSync(
        path.join(root, 'node_modules/electron/package.json'),
        JSON.stringify({ version: '45.1.0' }),
      );
    }
    if (args[1] === 'build') {
      for (const artifact of ['dist/index.html', 'dist/sw.js', 'dist/manifest.webmanifest'])
        write(artifact);
    }
    if (args[0] === 'exec') {
      const version = args
        .find((argument) => argument.startsWith('-c.extraMetadata.version='))
        .split('=')[1];
      for (const artifact of [
        'release/win-unpacked/Typing Island.exe',
        'release/win-unpacked/resources/app.asar',
        `release/Typing-Island-${version}-x64-portable.exe`,
        `release/Typing-Island-${version}-x64-setup.exe`,
      ])
        write(artifact);
    }
  };
  return {
    root,
    commands,
    write,
    options: {
      root,
      execute,
      platform: 'win32',
      nodeVersion: '22.14.0',
      log: () => {},
      resolveVersion: () => ({ SemVer: '1.0.0' }),
    },
  };
}

test('GitVersion controls packaged version without ever changing npm source metadata', (context) => {
  const { root, options, commands } = fixture(context);
  const lockPath = path.join(root, 'package-lock.json');
  fs.writeFileSync(
    lockPath,
    JSON.stringify({
      name: 'typing-island',
      version: '1.0.0',
      packages: { '': { version: '1.0.0' } },
    }),
  );
  const originals = ['package.json', 'package-lock.json'].map((filename) =>
    fs.readFileSync(path.join(root, filename)),
  );
  options.resolveVersion = () => ({ SemVer: '1.2.3' });
  const execute = options.execute;
  options.execute = (args, cwd, extraEnv) => {
    for (const [index, filename] of ['package.json', 'package-lock.json'].entries())
      assert.deepEqual(fs.readFileSync(path.join(root, filename)), originals[index]);
    execute(args, cwd, extraEnv);
  };
  const artifacts = runBuild('windows', options);
  assert.ok(commands.at(-1).includes('-c.extraMetadata.version=1.2.3'));
  assert.ok(artifacts.includes('release/Typing-Island-1.2.3-x64-portable.exe'));
  for (const [index, filename] of ['package.json', 'package-lock.json'].entries())
    assert.deepEqual(fs.readFileSync(path.join(root, filename)), originals[index]);
  options.execute = () => {
    throw new Error('install failed');
  };
  assert.throws(() => runBuild('web', options), /install failed/);
  for (const [index, filename] of ['package.json', 'package-lock.json'].entries())
    assert.deepEqual(fs.readFileSync(path.join(root, filename)), originals[index]);
});

test('GitVersion failure does not install, clean outputs or leave a lock', (context) => {
  const { root, options, commands, write } = fixture(context);
  write('dist/keep.txt');
  options.resolveVersion = () => {
    throw new Error('GitVersion failed');
  };
  assert.throws(() => runBuild('web', options), /GitVersion failed/);
  assert.equal(commands.length, 0);
  assert.equal(fs.existsSync(path.join(root, 'dist/keep.txt')), true);
  assert.equal(fs.existsSync(path.join(root, '.build.lock')), false);
});

test('targets are explicit and unknown or extra arguments fail', () => {
  assert.equal(parseTarget([]), 'all');
  for (const target of ['all', 'web', 'windows']) assert.equal(parseTarget([target]), target);
  assert.throws(() => parseTarget(['desktop']), /Usage/);
  assert.throws(() => parseTarget(['web', 'windows']), /Usage/);
});

test('Node support matches the package engine and desktop is Windows-only', () => {
  for (const version of ['22.12.0', '22.14.0', '24.0.0', '26.4.0'])
    checkEnvironment('all', 'win32', version);
  for (const version of ['20.19.0', '22.11.0', '23.0.0', '25.0.0']) {
    assert.throws(() => checkEnvironment('all', 'win32', version), /unsupported/);
  }
  assert.throws(() => checkEnvironment('windows', 'linux', '24.0.0'), /must run on Windows/);
  checkEnvironment('web', 'linux', '24.0.0');
});

test('web installs locked dependencies, builds once and preserves desktop outputs', (context) => {
  const { root, options, commands, write } = fixture(context);
  write('dist/stale.txt');
  write('release/keep.txt');
  assert.equal(runBuild('web', options).length, 3);
  assert.deepEqual(commands, [
    ['ci', '--no-audit', '--no-fund'],
    ['run', 'build'],
  ]);
  assert.equal(fs.existsSync(path.join(root, 'dist/stale.txt')), false);
  assert.equal(fs.existsSync(path.join(root, 'release/keep.txt')), true);
});

for (const target of ['all', 'windows']) {
  test(`${target} builds web once and packages x64 without publishing`, (context) => {
    const { root, options, commands, write } = fixture(context);
    write('release/stale.exe');
    assert.equal(runBuild(target, options).length, 7);
    assert.equal(commands.filter((args) => args[1] === 'build').length, 1);
    assert.deepEqual(commands[2], ['run', 'build']);
    assert.deepEqual(commands[3], [
      'exec',
      '--no',
      '--',
      'electron-builder',
      '--win',
      'portable',
      'nsis',
      '--x64',
      '--publish',
      'never',
      '-c.extraMetadata.version=1.0.0',
    ]);
    assert.equal(fs.existsSync(path.join(root, 'release/stale.exe')), false);
  });
}

test('installation failure stops before cleaning or building', (context) => {
  const { root, options, write } = fixture(context);
  write('dist/keep.txt');
  options.execute = () => {
    throw new Error('download failed');
  };
  assert.throws(() => runBuild('all', options), /download failed/);
  assert.equal(fs.existsSync(path.join(root, 'dist/keep.txt')), true);
});

test('missing web artifacts fail before desktop packaging', (context) => {
  const { options } = fixture(context);
  const commands = [];
  const execute = options.execute;
  options.execute = (args, root, extraEnv) => {
    commands.push(args);
    if (args[1] !== 'build') execute(args, root, extraEnv);
  };
  assert.throws(() => runBuild('all', options), /Missing or empty build artifact/);
  assert.equal(commands.length, 3);
});

test('missing installer cannot be hidden by old outputs', (context) => {
  const { options, write } = fixture(context);
  write('release/Typing-Island-1.0.0-x64-setup.exe');
  const execute = options.execute;
  options.execute = (args, root, extraEnv) => {
    execute(args, root, extraEnv);
    if (args[0] === 'exec')
      fs.unlinkSync(path.join(root, 'release/Typing-Island-1.0.0-x64-setup.exe'));
  };
  assert.throws(() => runBuild('all', options), /setup.exe/);
});

test('lockfile identity mismatch fails before installing dependencies', (context) => {
  const { root, options, commands } = fixture(context);
  fs.writeFileSync(
    path.join(root, 'package-lock.json'),
    JSON.stringify({ name: 'other', version: '1.0.0' }),
  );
  assert.throws(() => runBuild('web', options), /does not match/);
  assert.equal(commands.length, 0);
});

test('simultaneous builds are rejected before touching dependencies or outputs', (context) => {
  const { options } = fixture(context);
  const execute = options.execute;
  options.execute = (args, root, extraEnv) => {
    if (args[0] === 'ci') {
      assert.throws(() => runBuild('web', { ...options, execute }), /already running/);
    }
    execute(args, root, extraEnv);
  };
  runBuild('all', options);
});

test('the build lock is released after success and command failure', (context) => {
  const { root, options } = fixture(context);
  const lockPath = path.join(root, '.build.lock');
  const execute = options.execute;
  options.execute = (args, cwd) => {
    assert.equal(fs.existsSync(lockPath), true);
    execute(args, cwd);
  };
  runBuild('web', options);
  assert.equal(fs.existsSync(lockPath), false);
  options.execute = () => {
    throw new Error('build failed');
  };
  assert.throws(() => runBuild('web', options), /build failed/);
  assert.equal(fs.existsSync(lockPath), false);
});

test('zero-length output is not accepted as a successful build', (context) => {
  const { options } = fixture(context);
  const execute = options.execute;
  options.execute = (args, root) => {
    execute(args, root);
    if (args[0] === 'run') fs.truncateSync(path.join(root, 'dist/index.html'), 0);
  };
  assert.throws(() => runBuild('web', options), /Missing or empty/);
});

test('runtime download failure preserves previous outputs and releases the lock', (context) => {
  const { root, options, write } = fixture(context);
  write('dist/keep.txt');
  const execute = options.execute;
  options.execute = (args, cwd, extraEnv) => {
    if (args[1] === 'desktop:runtime') throw new Error('Electron download failed');
    execute(args, cwd, extraEnv);
  };
  assert.throws(() => runBuild('all', options), /Electron download failed/);
  assert.equal(fs.existsSync(path.join(root, 'dist/keep.txt')), true);
  assert.equal(fs.existsSync(path.join(root, '.build.lock')), false);
});

test('mismatched Electron runtime fails before production build', (context) => {
  const { options, commands } = fixture(context);
  const execute = options.execute;
  options.execute = (args, root, extraEnv) => {
    execute(args, root, extraEnv);
    if (args[1] === 'desktop:runtime')
      fs.writeFileSync(path.join(root, 'node_modules/electron/dist/version'), '44.0.0');
  };
  assert.throws(() => runBuild('all', options), /runtime version does not match/);
  assert.equal(
    commands.some((args) => args[1] === 'build'),
    false,
  );
});

test(
  'Windows launchers dispatch correctly from special paths and propagate failure',
  { skip: process.platform !== 'win32' },
  (context) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'typing \u4e2d\u6587 space & ! '));
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const filename of ['build.cmd', 'build-web.cmd', 'build-windows.cmd']) {
      fs.copyFileSync(path.join(__dirname, '..', filename), path.join(root, filename));
    }
    fs.writeFileSync(
      path.join(root, 'npm.cmd'),
      '@echo off\r\necho NPM_STUB:%*\r\necho CWD:"%CD%"\r\nexit /b 7\r\n',
    );
    fs.writeFileSync(path.join(root, 'node.exe'), 'only used by where.exe');
    for (const [filename, target] of [
      ['build.cmd', 'all'],
      ['build-web.cmd', 'web'],
      ['build-windows.cmd', 'windows'],
    ]) {
      const result = spawnSync(
        process.env.ComSpec,
        ['/d', '/s', '/c', `""${path.join(root, filename)}""`],
        {
          cwd: os.tmpdir(),
          env: {
            ...process.env,
            PATH: `${root};${path.join(process.env.SystemRoot, 'System32')}`,
            TYPING_BUILD_NO_PAUSE: '1',
          },
          encoding: 'utf8',
          shell: false,
          windowsVerbatimArguments: true,
        },
      );
      assert.equal(result.status, 7, result.stdout + result.stderr);
      assert.match(result.stdout, new RegExp(`NPM_STUB:run build:${target}`));
      assert.match(result.stdout, /BUILD FAILED/);
      assert.equal(result.stderr, '');
    }
  },
);
