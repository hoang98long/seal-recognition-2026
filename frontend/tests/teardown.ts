import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
export default async function teardown() {
  const python = resolve(
    process.platform === 'win32' ? '../.venv/Scripts/python.exe' : '../.venv/bin/python',
  );
  execFileSync(python, [resolve('../scripts/cleanup_e2e.py')], {
    env: { ...process.env, PYTHONUTF8: '1' },
    stdio: 'inherit',
  });
}
