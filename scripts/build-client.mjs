import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clientDir = path.join(rootDir, 'client');

function parseNodeVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

const node = parseNodeVersion(process.versions.node);
const MIN_NODE = { major: 20, minor: 19, patch: 0 };

const nodeOk =
  node.major > MIN_NODE.major ||
  (node.major === MIN_NODE.major &&
    (node.minor > MIN_NODE.minor ||
      (node.minor === MIN_NODE.minor && node.patch >= MIN_NODE.patch)));

if (!nodeOk) {
  console.error(
    `\nNode ${process.versions.node} is too old for Vite 8 (needs 20.19+ or 22.12+).\n` +
      'Upgrade on the server:\n' +
      '  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\n' +
      '  sudo apt-get install -y nodejs\n' +
      '  node -v\n',
  );
  process.exit(1);
}

try {
  const stat = fs.statfsSync ? fs.statfsSync(clientDir) : null;
  if (stat && stat.bfree * stat.bsize < 500 * 1024 * 1024) {
    console.warn('\nWarning: less than ~500MB free disk space — npm ci may fail (ENOSPC).\n');
  }
} catch {
  // statfs not available on all platforms
}

const env = {
  ...process.env,
  NODE_ENV: 'development',
  NPM_CONFIG_PRODUCTION: 'false',
};

function run(label, command, args, cwd) {
  console.log(`\n> ${label}: ${command} ${args.join(' ')}`);
  const result = spawnSync('npm', args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Node ${process.versions.node}`);

// npm install respects package.json deps; npm ci needs lockfile in sync.
run('install client', 'npm', ['install', '--no-audit', '--no-fund'], clientDir);

const viteBin = path.join(clientDir, 'node_modules', '.bin', 'vite');
if (!fs.existsSync(viteBin)) {
  console.error('\nVite not found after install. Common causes:');
  console.error('  - Node too old (need 20.19+)');
  console.error('  - Disk full (run: df -h)');
  console.error('  - npm registry/network error');
  process.exit(1);
}

run('build client', 'npm', ['run', 'build'], clientDir);

const indexHtml = path.join(clientDir, 'dist', 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('\nERROR: client/dist/index.html was not created.');
  process.exit(1);
}

const assetsDir = path.join(clientDir, 'dist', 'assets');
const assets = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).slice(0, 4) : [];
const builtAt = fs.statSync(indexHtml).mtime.toISOString();
console.log(`\nDist ready: ${indexHtml}`);
console.log(`Built at: ${builtAt}`);
if (assets.length) console.log(`Assets: ${assets.join(', ')}`);

console.log('\nClient build complete. Run: pm2 restart chessrad');
