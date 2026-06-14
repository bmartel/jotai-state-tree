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

  let vite;
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
  }

  // Dynamically load the SSR helpers from jotai-state-tree.
  // In development, we load the TypeScript source file directly via Vite's load module.
  const { createSSRHandler } = isProd
    ? await import('jotai-state-tree/ssr')
    : await vite.ssrLoadModule('jotai-state-tree/ssr');

  // Load Route Config, API routes, and Store creators
  let routes, apiRoutes, createAppStore;
  if (!isProd) {
    const routeModule = await vite.ssrLoadModule('/src/routes/router.ts');
    routes = routeModule.routes;
    const apiModule = await vite.ssrLoadModule('/src/routes/api.ts');
    apiRoutes = apiModule.apiRoutes;
    const storeModule = await vite.ssrLoadModule('/src/models/RootStore.ts');
    createAppStore = storeModule.createAppStore;
  } else {
    const routeModule = await import('./src/routes/router.js');
    routes = routeModule.routes;
    const apiModule = await import('./src/routes/api.js');
    apiRoutes = apiModule.apiRoutes;
    const storeModule = await import('./src/models/RootStore.js');
    createAppStore = storeModule.createAppStore;
  }

  // Define the renderApp function
  const renderApp = async (store) => {
    if (!isProd) {
      const { render } = await vite.ssrLoadModule('/src/entry-server.tsx');
      return render();
    } else {
      const { render } = await import('./dist/server/entry-server.js');
      return render();
    }
  };

  const handler = createSSRHandler({
    createStore: createAppStore,
    renderApp,
    routes,
    apiRoutes,
    template: templateHtml,
    // Register actions for client-server RPC sync
    actions: {
      toggleTask: async (store, { id }) => {
        const task = store.tasks.items.find(t => t.id === id);
        if (task) {
          task.toggleCompleted();
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

    // Serve static files in production
    if (isProd) {
      const pathname = new URL(url, `http://${req.headers.host}`).pathname;
      const filePath = path.join(__dirname, 'dist/client', pathname);
      
      if (!pathname.startsWith('/api/') && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'text/javascript',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.json': 'application/json',
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

    if (!isProd) {
      vite.middlewares(req, res, runHandler);
    } else {
      runHandler();
    }
  });

  const port = 3000;
  server.listen(port, () => {
    console.log(`\x1b[32m[jotai-state-tree]\x1b[0m SSR Server running at http://localhost:${port}`);
  });
}

createServer();
