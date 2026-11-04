import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = { '/api': { target: `http://127.0.0.1:${process.env.API_PORT ?? 3001}` } };
export default defineConfig({
  plugins: [react()],
  server: { proxy, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.data/**', '**/.npm-cache/**', '**/server/**', '**/artifacts/**'] } },
  preview: { proxy },
});
