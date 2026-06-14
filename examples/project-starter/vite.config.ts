import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isLocal = fs.existsSync(path.resolve(__dirname, '../../src/index.ts')) && fs.existsSync(path.resolve(__dirname, '../../node_modules'));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      ...(isLocal ? {
        'jotai-state-tree/react': path.resolve(__dirname, '../../src/react.ts'),
        'jotai-state-tree/devtools': path.resolve(__dirname, '../../src/devtools.tsx'),
        'jotai-state-tree/ssr': path.resolve(__dirname, '../../src/ssr.ts'),
        'jotai-state-tree': path.resolve(__dirname, '../../src/index.ts'),
      } : {}),
    },
  },
  server: {
    port: 3000,
  },
  ssr: {
    noExternal: ['jotai-state-tree'],
  },
});
