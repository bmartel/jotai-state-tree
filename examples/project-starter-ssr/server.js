import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

async function createServer() {
  const templateHtml = fs.readFileSync(
    path.resolve(__dirname, isProd ? 'dist/client/index.html' : 'index.html'),
    'utf-8'
  );

  // Setup Dev Mode Compilation & Live Reload
  const sockets = new Set();
  if (!isProd) {
    // Start dev bundle builder
    const projectRoot = path.resolve(__dirname, '../..');
    const jotaiStateTreePlugin = {
      name: 'jotai-state-tree-plugin',
      setup(build) {
        build.onResolve({ filter: /^jotai-state-tree($|\/)/ }, (args) => {
          const pkgName = args.path;
          let targetPath = '';
          if (pkgName === 'jotai-state-tree') {
            targetPath = path.resolve(projectRoot, 'src/index.ts');
          } else if (pkgName === 'jotai-state-tree/react') {
            targetPath = path.resolve(projectRoot, 'src/react.ts');
          } else if (pkgName === 'jotai-state-tree/devtools') {
            targetPath = path.resolve(projectRoot, 'src/devtools.tsx');
          } else if (pkgName === 'jotai-state-tree/ssr') {
            targetPath = path.resolve(projectRoot, 'src/ssr.ts');
          }
          return { path: targetPath };
        });
      }
    };

    const buildClient = async () => {
      const res = await Bun.build({
        entrypoints: ['src/entry-client.tsx'],
        outdir: '.dev',
        sourcemap: 'inline',
        plugins: [jotaiStateTreePlugin],
      });
      if (!res.success) {
        console.error('[jotai-state-tree] Dev client build failed:', res.logs);
      }
    };

    await buildClient();

    // Compile Tailwind in watch mode
    Bun.spawn([
      'bunx',
      'tailwindcss',
      '-i',
      'src/index.css',
      '-o',
      '.dev/index.css',
      '--watch'
    ]);

    // WebSocket server for live reloading on port 3001
    Bun.serve({
      port: 3001,
      fetch(req, server) {
        if (server.upgrade(req)) return;
        return new Response("Upgrade failed", { status: 400 });
      },
      websocket: {
        open(ws) {
          sockets.add(ws);
        },
        close(ws) {
          sockets.delete(ws);
        },
        message() {}
      }
    });

    // Watch src folder for changes to rebuild client bundle and notify browser
    const { watch } = await import('fs');
    let debounceTimeout = null;
    watch(path.resolve(__dirname, 'src'), { recursive: true }, () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        console.log('[jotai-state-tree] Rebuilding client bundle...');
        await buildClient();
        for (const socket of sockets) {
          socket.send('reload');
        }
      }, 100);
    });
  }

  // Load the SSR handler from jotai-state-tree.
  // In Bun, we load our local source ssr file directly in dev.
  const { createSSRHandler } = isProd
    ? await import('jotai-state-tree/ssr')
    : await import('../../src/ssr.ts');

  // Load Route Config, API routes, and Store creators directly via Bun's TypeScript execution
  const routeModule = await import('./src/routes/router.ts');
  const routes = routeModule.routes;
  const apiModule = await import('./src/routes/api.ts');
  const apiRoutes = apiModule.apiRoutes;
  const storeModule = await import('./src/models/RootStore.ts');
  const createAppStore = storeModule.createAppStore;

  const renderApp = async (store, url) => {
    if (!isProd) {
      const { render } = await import('./src/entry-server.tsx');
      return render(store, url);
    } else {
      const { render } = await import('./dist/server/entry-server.js');
      return render(store, url);
    }
  };

  const handler = createSSRHandler({
    createStore: createAppStore,
    renderApp,
    routes,
    apiRoutes,
    template: async ({ html, state, req }) => {
      let template = templateHtml;
      if (!isProd) {
        const reloadScript = `
        <script>
          (function() {
            const ws = new WebSocket("ws://" + location.hostname + ":3001");
            ws.onmessage = (event) => {
              if (event.data === "reload") {
                console.log("[jotai-state-tree] Reloading...");
                location.reload();
              }
            };
          })();
        </script>
        `;
        template = template.replace('</body>', `${reloadScript}</body>`);
      }
      return template
        .replace('<!--app-html-->', html)
        .replace('<!--app-state-->', state);
    },
    // Register actions for client-server RPC sync
    actions: {
      toggleTask: async (store, { id }) => {
        const task = store.tasks.items.find(t => t.id === id);
        if (task) {
          task.toggle();
          return { success: true };
        }
        return { success: false, error: 'Task not found' };
      },
      addTask: async (store, { title, category }) => {
        store.tasks.addTask(title, category);
        return { success: true };
      },
      deleteTask: async (store, { id }) => {
        store.tasks.deleteTask(id);
        return { success: true };
      }
    }
  });

  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    const pathname = new URL(url, `http://${req.headers.host || 'localhost'}`).pathname;

    // Serve dev-compiled client assets in dev mode
    if (!isProd) {
      if (pathname === '/src/entry-client.tsx') {
        const filePath = path.join(__dirname, '.dev/entry-client.js');
        if (fs.existsSync(filePath)) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/javascript');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }
      if (pathname === '/src/index.css') {
        const filePath = path.join(__dirname, '.dev/index.css');
        if (fs.existsSync(filePath)) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/css');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }
    }

    // Serve static files in production or development
    if (!pathname.startsWith('/api/')) {
      const baseDir = isProd ? 'dist/client' : '.';
      const filePath = path.join(__dirname, baseDir, pathname);
      
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.json': 'application/json',
          '.ico': 'image/x-icon',
        };
        res.statusCode = 200;
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    const runHandler = async () => {
      try {
        const handled = await handler(req, res);
        if (!handled) {
          res.statusCode = 404;
          res.end('Not Found');
        }
      } catch (err) {
        res.statusCode = 500;
        res.end(err.stack || err.message || 'Internal Server Error');
      }
    };

    runHandler();
  });

  const port = 3000;
  server.listen(port, () => {
    console.log(`\x1b[32m[jotai-state-tree]\x1b[0m SSR Server running at http://localhost:${port}`);
  });
}

createServer();
