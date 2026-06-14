import { AsyncLocalStorage } from "node:async_hooks";
import { createStore } from "jotai";
import {
  setActiveStoreResolver,
  getSnapshot,
  applySnapshot,
  onPatch,
  applyPatch,
  type IJsonPatch,
} from "./index";

// ============================================================================
// Store Request Isolation
// ============================================================================

const storeStorage = new AsyncLocalStorage<ReturnType<typeof createStore>>();

// Bind the core library's store resolver to read from our AsyncLocalStorage
setActiveStoreResolver(() => {
  return storeStorage.getStore() || null;
});

/**
 * Executes a callback within a request-scoped Jotai store context.
 * Prevents cross-request state bleeding under high server concurrency.
 */
export function runWithStore<T>(store: ReturnType<typeof createStore>, fn: () => T): T {
  return storeStorage.run(store, fn);
}

/**
 * Creates a fresh Jotai store.
 */
export function createSSRStore() {
  return createStore();
}

// ============================================================================
// Route Matching
// ============================================================================

export interface SSRRoute<TStore> {
  path: string;
  loader?: (store: TStore, params: Record<string, string>) => Promise<void> | void;
}

export function matchRoute<TStore>(
  routes: SSRRoute<TStore>[],
  pathname: string
): { route: SSRRoute<TStore>; params: Record<string, string> } | null {
  const cleanPathname = pathname.split("?")[0].replace(/\/$/, "") || "/";

  for (const route of routes) {
    const cleanPattern = route.path.replace(/\/$/, "") || "/";
    const patternSegments = cleanPattern.split("/").filter(Boolean);
    const pathnameSegments = cleanPathname.split("/").filter(Boolean);

    if (patternSegments.length !== pathnameSegments.length) {
      continue;
    }

    const params: Record<string, string> = {};
    let matched = true;

    for (let i = 0; i < patternSegments.length; i++) {
      const pSeg = patternSegments[i];
      const pathSeg = pathnameSegments[i];

      if (pSeg.startsWith(":")) {
        params[pSeg.slice(1)] = decodeURIComponent(pathSeg);
      } else if (pSeg !== pathSeg) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return { route, params };
    }
  }

  return null;
}

// ============================================================================
// Server Handler & RPC Engine
// ============================================================================

export interface SSROptions<TStore> {
  createStore: () => TStore;
  renderApp: (store: TStore) => Promise<string> | string;
  routes?: SSRRoute<TStore>[];
  actions?: Record<string, (store: TStore, args: any) => Promise<any> | any>;
  template: string | ((args: { html: string; state: string }) => string);
  apiRoutes?: Record<string, (req: any, res: any) => Promise<void> | void>;
}

/**
 * Creates a Node.js compliant HTTP request handler for SSR and Server Actions/APIs.
 */
export function createSSRHandler<TStore>(options: SSROptions<TStore>) {
  return async (req: any, res: any): Promise<boolean> => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // 1. Intercept Server Action RPC API
    if (req.method === "POST" && pathname === "/api/_jst_action") {
      const body = await readRequestBody(req);
      const { actionName, args, clientSnapshot } = JSON.parse(body || "{}");

      const action = options.actions?.[actionName];
      if (!action) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: `Server action "${actionName}" not found.` }));
        return true;
      }

      const jotaiStore = createSSRStore();
      await runWithStore(jotaiStore, async () => {
        const storeInstance = options.createStore();

        if (clientSnapshot) {
          applySnapshot(storeInstance, clientSnapshot);
        }

        const patches: IJsonPatch[] = [];
        const disposePatch = onPatch(storeInstance, (patch) => {
          patches.push(patch);
        });

        try {
          const result = await action(storeInstance, args);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ result, patches }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message || "Server action failed." }));
        } finally {
          disposePatch();
        }
      });

      return true;
    }

    // 2. Intercept Custom API Routes
    if (pathname.startsWith("/api/")) {
      const apiPath = pathname.slice(4); // Remove "/api" prefix
      const handler = options.apiRoutes?.[apiPath] || options.apiRoutes?.[pathname];
      if (handler) {
        const jotaiStore = createSSRStore();
        await runWithStore(jotaiStore, async () => {
          await handler(req, res);
        });
        return true;
      }
    }

    // 3. Page Routes SSR
    const match = matchRoute(options.routes || [], pathname);
    // Render the page if it matches a route, or default fallback to '/'
    if (match || pathname === "/" || req.headers.accept?.includes("text/html")) {
      const jotaiStore = createSSRStore();
      await runWithStore(jotaiStore, async () => {
        const storeInstance = options.createStore();

        // Run loader if route matched
        if (match && match.route.loader) {
          try {
            await match.route.loader(storeInstance, match.params);
          } catch (err) {
            console.error(`Route loader failed for ${pathname}:`, err);
          }
        }

        // Render to string
        const html = await options.renderApp(storeInstance);
        const snapshot = getSnapshot(storeInstance);
        const serializedState = JSON.stringify(snapshot);

        // Inject snapshot and HTML into template
        let outputHtml = "";
        const injectedScript = `<script id="__JST_DATA__">window.__JST_DATA__ = ${serializedState};</script>`;

        if (typeof options.template === "function") {
          outputHtml = options.template({ html, state: injectedScript });
        } else {
          outputHtml = options.template
            .replace("<!--app-html-->", html)
            .replace("<!--app-state-->", injectedScript);
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html");
        res.end(outputHtml);
      });
      return true;
    }

    return false;
  };
}

/**
 * Starts a standalone ultra-performance HTTP server.
 */
export function startSSRServer<TStore>(
  options: SSROptions<TStore> & { port?: number }
) {
  const handler = createSSRHandler(options);
  const http = require("node:http");
  const server = http.createServer(async (req: any, res: any) => {
    try {
      const handled = await handler(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.end("Not Found");
      }
    } catch (err: any) {
      res.statusCode = 500;
      res.end(err.message || "Internal Server Error");
    }
  });

  const port = options.port || 3000;
  server.listen(port, () => {
    console.log(`[jotai-state-tree] SSR server running at http://localhost:${port}`);
  });

  return server;
}

// Helper: read body stream from request
function readRequestBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: any) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      resolve(body);
    });
    req.on("error", (err: any) => {
      reject(err);
    });
  });
}
