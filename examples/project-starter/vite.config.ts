import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

const __dirname = path.resolve();
const isLocal = fs.existsSync(path.resolve(__dirname, '../../src/index.ts'));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: isLocal ? {
      'jotai-state-tree/react': path.resolve(__dirname, '../../src/react.ts'),
      'jotai-state-tree/devtools': path.resolve(__dirname, '../../src/devtools.tsx'),
      'jotai-state-tree': path.resolve(__dirname, '../../src/index.ts'),
    } : {},
  },
  server: {
    port: 3000,
  },
});
