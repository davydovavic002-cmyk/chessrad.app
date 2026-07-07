import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clientDir = path.join(rootDir, 'client');

// Production servers often set NODE_ENV=production globally, which makes npm ci
// skip devDependencies (Vite, etc.). Force a full client install for the build.
const env = {
  ...process.env,
  NODE_ENV: 'development',
  NPM_CONFIG_PRODUCTION: 'false',
};

function run(label, command, args, cwd) {
  console.log(`\n> ${label}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('install client', 'npm', ['ci', '--no-audit', '--no-fund'], clientDir);
run('build client', 'npm', ['run', 'build'], clientDir);

console.log('\nClient build complete.');
