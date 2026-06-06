import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const isLocal = fs.existsSync(path.resolve(__dirname, '../../src/index.ts'));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: isLocal ? {
      'jotai-state-tree/react': path.resolve(__dirname, '../../src/react.ts'),
      'jotai-state-tree': path.resolve(__dirname, '../../src/index.ts'),
    } : {},
  },
  server: {
    port: 3003,
  },
});
