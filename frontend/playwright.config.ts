import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const python = resolve(process.platform === 'win32' ? '../.venv/Scripts/python.exe' : '../.venv/bin/python');
export default defineConfig({
  globalTeardown: './tests/teardown.ts',
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: {
    actionTimeout: 15000,
    baseURL: 'http://localhost:15174',
    viewport: { width: 1366, height: 768 },
    launchOptions: existsSync(chrome) ? { executablePath: chrome } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `"${python}" ../scripts/e2e_backend.py`,
      url: 'http://127.0.0.1:18081/api/v1/health',
      timeout: 60000,
      reuseExistingServer: false,
      env: { PYTHONUTF8: '1' },
    },
    {
      command: 'npm run dev -- --port 15174',
      url: 'http://localhost:15174',
      timeout: 60000,
      reuseExistingServer: false,
      env: { SEAL_API_TARGET: 'http://127.0.0.1:18081' },
    },
  ],
});
