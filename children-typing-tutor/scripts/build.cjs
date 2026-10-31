const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');

function parseTarget(args) {
  if (args.length > 1 || (args.length === 1 && !['all', 'web', 'windows'].includes(args[0]))) {
    throw new Error('Usage: npm run build:all | npm run build:web | npm run build:windows');
  }
  return args[0] || 'all';
}

function checkEnvironment(target, platform, nodeVersion) {
  const [major, minor] = nodeVersion.split('.').map(Number);
  if (!((major === 22 && minor >= 12) || major === 24 || major >= 26)) {
    throw new Error(
      `Node.js ${nodeVersion} is unsupported. Install Node.js 22.12+, 24 LTS or 26+.`,
    );
  }
  if (target !== 'web' && platform !== 'win32') {
    throw new Error('Windows desktop packaging must run on Windows. Use npm run build:web here.');
  }
}

function executeNpm(args, root, extraEnv = {}) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli || !fs.existsSync(npmCli)) {
    throw new Error('Start this script through npm run build:all, build:web or build:windows.');
  }
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...extraEnv, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed (${result.signal || result.status}).`);
  }
}

function verifyFiles(root, files) {
  for (const relativePath of files) {
    const artifact = path.join(root, relativePath);
    if (
      !fs.existsSync(artifact) ||
      !fs.statSync(artifact).isFile() ||
      fs.statSync(artifact).size === 0
    ) {
      throw new Error(`Missing or empty build artifact: ${artifact}`);
    }
  }
}

function runBuild(target, options = {}) {
  const root = options.root || projectRoot;
  const execute = options.execute || executeNpm;
  const log = options.log || console.log;
  checkEnvironment(
    target,
    options.platform || process.platform,
    options.nodeVersion || process.versions.node,
  );
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  if (lock.name !== metadata.name || lock.version !== metadata.version) {
    throw new Error(
      'package-lock.json does not match package.json. Update and commit the lockfile first.',
    );
  }

  const artifacts = ['dist/index.html', 'dist/sw.js', 'dist/manifest.webmanifest'];
  const lockPath = path.join(root, '.build.lock');
  let lockDescriptor;
  try {
    lockDescriptor = fs.openSync(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(
        `A build is already running, or was interrupted. Wait for it to finish. If no build is running, delete ${lockPath} and retry.`,
      );
    }
    throw error;
  }
  try {
    fs.writeFileSync(lockDescriptor, String(process.pid));
    log(`\nBuilding ${metadata.name} ${metadata.version} (${target})`);
    log('Installing locked dependencies. Network access is required for uncached downloads.');
    execute(['ci', '--no-audit', '--no-fund'], root);
    if (target !== 'web') {
      log('Preparing the locked Electron runtime for Windows x64.');
      execute(['run', 'desktop:runtime'], root, {
        ELECTRON_INSTALL_PLATFORM: 'win32',
        ELECTRON_INSTALL_ARCH: 'x64',
      });
      verifyFiles(root, [
        'node_modules/electron/dist/electron.exe',
        'node_modules/electron/dist/version',
      ]);
      const electronVersion = JSON.parse(
        fs.readFileSync(path.join(root, 'node_modules/electron/package.json'), 'utf8'),
      ).version;
      const installedVersion = fs
        .readFileSync(path.join(root, 'node_modules/electron/dist/version'), 'utf8')
        .trim()
        .replace(/^v/, '');
      if (installedVersion !== electronVersion)
        throw new Error(
          'The installed Electron runtime version does not match the locked package.',
        );
    }
    fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true, maxRetries: 3 });
    if (target !== 'web')
      fs.rmSync(path.join(root, 'release'), { recursive: true, force: true, maxRetries: 3 });
    execute(['run', 'build'], root);
    verifyFiles(root, artifacts);
    if (target !== 'web') {
      execute(
        [
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
        ],
        root,
      );
      artifacts.push(
        'release/win-unpacked/Typing Island.exe',
        'release/win-unpacked/resources/app.asar',
        `release/Typing-Island-${metadata.version}-x64-portable.exe`,
        `release/Typing-Island-${metadata.version}-x64-setup.exe`,
      );
      verifyFiles(root, artifacts);
    }
  } finally {
    fs.closeSync(lockDescriptor);
    fs.rmSync(lockPath);
  }

  log('\nBUILD SUCCEEDED');
  log(`Web: ${path.join(root, 'dist')} (serve over HTTP; do not open index.html directly)`);
  if (target !== 'web') {
    log(
      `Windows x64: ${path.join(root, 'release')} (unsigned portable, installer and unpacked app)`,
    );
  }
  return artifacts;
}

if (require.main === module) {
  try {
    runBuild(parseTarget(process.argv.slice(2)));
  } catch (error) {
    console.error(`\nBUILD FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { checkEnvironment, parseTarget, runBuild };
