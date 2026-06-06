import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'jotai-state-tree/react': path.resolve(__dirname, '../../src/react.ts'),
      'jotai-state-tree': path.resolve(__dirname, '../../src/index.ts'),
    },
  },
  server: {
    port: 3002,
  },
});
