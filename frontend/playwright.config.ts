import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import './server/database.ts';

process.env.E2E_RUN_ID ??= String(Date.now());
process.env.API_DATA_DIR = resolve(`.data/e2e-${process.env.E2E_RUN_ID}`);
process.env.API_PORT = '3002';
process.env.DATABASE_SCHEMA = `e2e_${process.env.E2E_RUN_ID}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: `./artifacts/test-results-${Date.now()}`,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5183', channel: 'chrome', headless: true, viewport: { width: 1440, height: 1050 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 5183 --strictPort', url: 'http://127.0.0.1:5183/api/health', reuseExistingServer: false, timeout: 60_000, env: { NODE_ENV: 'test', API_PORT: '3002', API_DATA_DIR: process.env.API_DATA_DIR, DATABASE_SCHEMA: process.env.DATABASE_SCHEMA } },
});
