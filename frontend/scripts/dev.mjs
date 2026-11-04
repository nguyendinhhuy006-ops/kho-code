import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const api = spawn(process.execPath, ['server/index.ts'], { stdio: 'inherit', windowsHide: true });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--configLoader', 'native', ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true });
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; api.kill(); vite.kill(); setTimeout(() => process.exit(code), 250); }
api.on('exit', code => stop(code ?? 1)); vite.on('exit', code => stop(code ?? 1));
api.on('error', () => stop(1)); vite.on('error', () => stop(1));
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
