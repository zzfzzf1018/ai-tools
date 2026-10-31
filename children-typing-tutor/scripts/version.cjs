const path = require('node:path');
const { spawnSync } = require('node:child_process');

function resolveVersion(root, options = {}) {
  const env = options.env || process.env;
  const head = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    env,
  });
  if (head.error || head.status !== 0) {
    throw new Error('GitVersion requires Git and a full checkout with commits and tags.');
  }
  const sha = head.stdout.trim();
  const result = spawnSync(
    'dotnet',
    [
      'tool',
      'run',
      'dotnet-gitversion',
      '--',
      '/output',
      'json',
      '/config',
      path.join(root, 'GitVersion.yml'),
      '/c',
      sha,
      '/nofetch',
      '/nonormalize',
      '/nocache',
      '/verbosity',
      'quiet',
    ],
    { cwd: root, encoding: 'utf8', shell: false, env },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      `GitVersion failed. Install .NET SDK 8 and run dotnet tool restore; use a full Git checkout with tags. ${result.error?.message || result.stderr || result.stdout}`,
    );
  }
  const version = JSON.parse(result.stdout.replace(/^\uFEFF/, ''));
  if (
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version.SemVer || '') ||
    !/^[0-9a-f]{40}$/i.test(version.Sha || '')
  ) {
    throw new Error('GitVersion returned invalid SemVer or commit SHA.');
  }
  if (version.Sha !== sha) {
    throw new Error(`GitVersion selected ${version.Sha} instead of checked-out HEAD ${sha}.`);
  }
  return version;
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(resolveVersion(path.resolve(__dirname, '..')), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { resolveVersion };
