import React, { createContext, useContext } from "react";
import { useAtomValue } from "jotai";
import { string, enumeration, frozen } from "./primitives";
import { model } from "./model";
import { array } from "./array";
import { optional, maybeNull } from "./utilities";
import { flow } from "./lifecycle";
import { getStateTreeNode, hasStateTreeNode, getGlobalStore } from "./tree";

const isBrowser = () =>
  typeof window !== "undefined" &&
  typeof window.document !== "undefined" &&
  typeof window.location !== "undefined" &&
  typeof window.history !== "undefined";

function createPopStateListener(routerRef: WeakRef<any>) {
  return (event: PopStateEvent) => {
    const router = routerRef.deref();
    if (router && getStateTreeNode(router).$isAlive) {
      router._handlePopState(event);
    }
  };
}

const routerFinalizationRegistry = new FinalizationRegistry((cleanupFn: () => void) => {
  try {
    cleanupFn();
  } catch (e) {
    // Ignore errors during finalization
  }
});


// ============================================================================
// Route Definition Model
// ============================================================================

export const RouteDefinition = model("RouteDefinition", {
  path: string,
  name: string,
  meta: optional(frozen<any>(), {}),
});

// ============================================================================
// URL Parsing and Matching Utilities
// ============================================================================

export function normalizePathname(path: string): string {
  if (path === "/") return path;
  let normalized = path;
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  return normalized;
}

export function parseUrl(url: string, basePath = "") {
  let pathname = url;
  let search = "";
  let hash = "";

  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
    try {
      const fullUrl = url.startsWith("//") ? "http:" + url : url;
      const u = new URL(fullUrl);
      pathname = u.pathname;
      search = u.search;
      hash = u.hash;
    } catch {
      // Fallback in case URL parsing fails
    }
  } else {
    const hashIndex = pathname.indexOf("#");
    if (hashIndex !== -1) {
      hash = pathname.slice(hashIndex);
      pathname = pathname.slice(0, hashIndex);
    }

    const queryIndex = pathname.indexOf("?");
    if (queryIndex !== -1) {
      search = pathname.slice(queryIndex);
      pathname = pathname.slice(0, queryIndex);
    }
  }

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  // Parse query params
  const query: Record<string, string> = {};
  if (search && search.length > 1) {
    const pairs = search.slice(1).split("&");
    for (const pair of pairs) {
      const [key, value] = pair.split("=");
      if (key) {
        query[decodeURIComponent(key)] = value ? decodeURIComponent(value) : "";
      }
    }
  }

  return {
    pathname: normalizePathname(pathname),
    search,
    hash,
    query,
  };
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const normalizedPattern = normalizePathname(pattern);
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPattern === "/*" || normalizedPattern === "*") {
    return { "*": normalizedPathname };
  }

  const patternSegments = normalizedPattern.split("/").filter(Boolean);
  const pathnameSegments = normalizedPathname.split("/").filter(Boolean);

  const hasWildcard = patternSegments[patternSegments.length - 1] === "*";
  if (!hasWildcard && patternSegments.length !== pathnameSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  const limit = hasWildcard ? patternSegments.length - 1 : patternSegments.length;
  for (let i = 0; i < limit; i++) {
    const pSeg = patternSegments[i];
    const pathSeg = pathnameSegments[i];

    if (!pathSeg) return null;

    if (pSeg.startsWith(":")) {
      params[pSeg.slice(1)] = decodeURIComponent(pathSeg);
    } else if (pSeg !== pathSeg) {
      return null;
    }
  }

  if (hasWildcard) {
    const wildcardSegments = pathnameSegments.slice(limit);
    params["*"] = "/" + wildcardSegments.map(decodeURIComponent).join("/");
  }

  return params;
}

export function matchRoutes(routes: any[], pathname: string) {
  const normalizedPathname = normalizePathname(pathname);
  for (const route of routes) {
    const params = matchPath(route.path, normalizedPathname);
    if (params) {
      return {
        route,
        params,
      };
    }
  }
  return null;
}

// ============================================================================
// Router Model
// ============================================================================

export const RouterModel = model("RouterModel", {
  pathname: string,
  search: string,
  hash: string,
  action: enumeration("NavigationAction", ["PUSH", "REPLACE", "POP", "INITIAL"]),
  params: optional(frozen<Record<string, string>>(), {}),
  query: optional(frozen<Record<string, string>>(), {}),
  currentRouteName: optional(maybeNull(string), null),
  routes: array(RouteDefinition),
  basePath: optional(string, ""),
})
.views((self) => ({
  get currentRoute() {
    if (!self.currentRouteName) return null;
    return self.routes.find((r) => r.name === self.currentRouteName) || null;
  },
  isActive(routeName: string, params?: Record<string, string>): boolean {
    if (self.currentRouteName !== routeName) return false;
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        if (self.params[key] !== val) return false;
      }
    }
    return true;
  }
}))
.volatile(() => ({
  beforeNavigate: null as ((from: any, to: any) => boolean | string | Promise<boolean | string> | undefined) | null,
  afterNavigate: null as ((to: any) => void) | null,
  _popStateListener: null as ((event: PopStateEvent) => void) | null,
  _popStateRef: null as any | null,
  _historyStack: [] as string[],
  _historyIndex: -1,
}))
.actions((self) => {
  return {
    setGuards(before?: any, after?: any) {
      self.beforeNavigate = before;
      self.afterNavigate = after;
    },
    
    setPopStateListener(listener: any) {
      self._popStateListener = listener;
    },

    _setPopStateRef(ref: any) {
      self._popStateRef = ref;
    },

    syncLocation(pathname: string, search: string, hash: string, action: "PUSH" | "REPLACE" | "POP" | "INITIAL", state?: any) {
      const parsed = parseUrl(pathname + search + hash, self.basePath);
      self.pathname = parsed.pathname;
      self.search = parsed.search;
      self.hash = parsed.hash;
      self.action = action;
      
      const matched = matchRoutes(self.routes, parsed.pathname);
      
      self.params = matched ? matched.params : {};
      self.query = parsed.query;
      self.currentRouteName = matched ? matched.route.name : null;
      
      if (isBrowser()) {
        let browserPath = parsed.pathname;
        if (self.basePath && !browserPath.startsWith(self.basePath)) {
          browserPath = self.basePath + (browserPath.startsWith("/") ? "" : "/") + browserPath;
        }
        const fullPath = browserPath + parsed.search + parsed.hash;
        if (action === "PUSH") {
          window.history.pushState(state, "", fullPath);
        } else if (action === "REPLACE") {
          window.history.replaceState(state, "", fullPath);
        }
      } else {
        const fullPath = parsed.pathname + parsed.search + parsed.hash;
        if (action === "PUSH") {
          self._historyStack = self._historyStack.slice(0, self._historyIndex + 1);
          self._historyStack.push(fullPath);
          self._historyIndex = self._historyStack.length - 1;
        } else if (action === "REPLACE") {
          if (self._historyIndex === -1) {
            self._historyStack = [fullPath];
            self._historyIndex = 0;
          } else {
            self._historyStack[self._historyIndex] = fullPath;
          }
        } else if (action === "INITIAL") {
          self._historyStack = [fullPath];
          self._historyIndex = 0;
        }
      }
    },

    push: flow(function* (path: string, state?: any) {
      const parsed = parseUrl(path, self.basePath);
      if (parsed.pathname === self.pathname && parsed.search === self.search && parsed.hash === self.hash) {
        return;
      }
      const matched = matchRoutes(self.routes, parsed.pathname);
      
      const from = {
        pathname: self.pathname,
        search: self.search,
        hash: self.hash,
        params: self.params,
        query: self.query,
        currentRouteName: self.currentRouteName,
      };
      
      const to = {
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        params: matched ? matched.params : {},
        query: parsed.query,
        currentRouteName: matched ? matched.route.name : null,
        state,
      };

      if (self.beforeNavigate) {
        const result = yield Promise.resolve(self.beforeNavigate(from, to));
        if (result === false) {
          return;
        }
        if (typeof result === "string") {
          yield (self as any).push(result, state);
          return;
        }
      }

      (self as any).syncLocation(to.pathname, to.search, to.hash, "PUSH", state);
      
      if (self.afterNavigate) {
        self.afterNavigate(to);
      }
    }),

    replace: flow(function* (path: string, state?: any) {
      const parsed = parseUrl(path, self.basePath);
      if (parsed.pathname === self.pathname && parsed.search === self.search && parsed.hash === self.hash) {
        return;
      }
      const matched = matchRoutes(self.routes, parsed.pathname);
      
      const from = {
        pathname: self.pathname,
        search: self.search,
        hash: self.hash,
        params: self.params,
        query: self.query,
        currentRouteName: self.currentRouteName,
      };
      
      const to = {
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        params: matched ? matched.params : {},
        query: parsed.query,
        currentRouteName: matched ? matched.route.name : null,
        state,
      };

      if (self.beforeNavigate) {
        const result = yield Promise.resolve(self.beforeNavigate(from, to));
        if (result === false) {
          return;
        }
        if (typeof result === "string") {
          yield (self as any).replace(result, state);
          return;
        }
      }

      (self as any).syncLocation(to.pathname, to.search, to.hash, "REPLACE", state);
      
      if (self.afterNavigate) {
        self.afterNavigate(to);
      }
    }),

    go(delta: number) {
      if (isBrowser()) {
        window.history.go(delta);
      } else {
        const nextIndex = self._historyIndex + delta;
        if (nextIndex >= 0 && nextIndex < self._historyStack.length) {
          self._historyIndex = nextIndex;
          const targetPath = self._historyStack[nextIndex];
          (self as any).syncLocation(targetPath, "", "", "POP");
        }
      }
    },

    goBack() {
      if (isBrowser()) {
        window.history.back();
      } else {
        (self as any).go(-1);
      }
    },

    goForward() {
      if (isBrowser()) {
        window.history.forward();
      } else {
        (self as any).go(1);
      }
    },

    _handlePopState(event: PopStateEvent) {
      const parsed = parseUrl(window.location.pathname + window.location.search + window.location.hash, self.basePath);
      const matched = matchRoutes(self.routes, parsed.pathname);
      
      const from = {
        pathname: self.pathname,
        search: self.search,
        hash: self.hash,
        params: self.params,
        query: self.query,
        currentRouteName: self.currentRouteName,
      };
      
      const to = {
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        params: matched ? matched.params : {},
        query: parsed.query,
        currentRouteName: matched ? matched.route.name : null,
        state: event.state,
      };

      const proceed = () => {
        (self as any).syncLocation(to.pathname, to.search, to.hash, "POP", event.state);
        if (self.afterNavigate) {
          self.afterNavigate(to);
        }
      };

      const revert = () => {
        const fullPath = from.pathname + from.search + from.hash;
        window.history.replaceState(null, "", fullPath);
      };

      if (self.beforeNavigate) {
        const result = self.beforeNavigate(from, to);
        if (result instanceof Promise) {
          result.then((res) => {
            if (res === false) {
              revert();
            } else if (typeof res === "string") {
              (self as any).replace(res);
            } else {
              proceed();
            }
          }).catch(() => {
            revert();
          });
        } else {
          if (result === false) {
            revert();
          } else if (typeof result === "string") {
            (self as any).replace(result);
          } else {
            proceed();
          }
        }
      } else {
        proceed();
      }
    }
  };
})
.afterCreate((self) => {
  if (isBrowser()) {
    const routerRef = new WeakRef(self);
    const listener = createPopStateListener(routerRef);
    window.addEventListener("popstate", listener);
    self.setPopStateListener(listener);
    
    const cleanup = () => {
      window.removeEventListener("popstate", listener);
    };
    routerFinalizationRegistry.register(self, cleanup, self);
  }
})
.beforeDestroy((self) => {
  if (isBrowser()) {
    routerFinalizationRegistry.unregister(self);
    if (self._popStateListener) {
      window.removeEventListener("popstate", self._popStateListener);
      self.setPopStateListener(null);
    }
  }
});

// ============================================================================
// createRouter Helper
// ============================================================================

export function createRouter(config: {
  routes: Array<{ path: string; name: string; meta?: any }>;
  basePath?: string;
  initialUrl?: string;
  beforeNavigate?: (from: any, to: any) => boolean | string | Promise<boolean | string> | undefined;
  afterNavigate?: (to: any) => void;
  runInitialGuards?: boolean;
}) {
  let initialPathname = "/";
  let initialSearch = "";
  let initialHash = "";
  const basePath = config.basePath || "";
  
  if (config.initialUrl) {
    const parsed = parseUrl(config.initialUrl, basePath);
    initialPathname = parsed.pathname;
    initialSearch = parsed.search;
    initialHash = parsed.hash;
  } else if (isBrowser()) {
    const parsed = parseUrl(window.location.pathname + window.location.search + window.location.hash, basePath);
    initialPathname = parsed.pathname;
    initialSearch = parsed.search;
    initialHash = parsed.hash;
  }

  const router = RouterModel.create({
    pathname: initialPathname,
    search: initialSearch,
    hash: initialHash,
    action: "INITIAL",
    currentRouteName: null,
    routes: config.routes.map((r) => ({
      path: r.path,
      name: r.name,
      meta: r.meta || {},
    })),
    basePath,
  });

  router.setGuards(config.beforeNavigate, config.afterNavigate);
  router.syncLocation(initialPathname, initialSearch, initialHash, "INITIAL");

  // Run transition guards on initial mount if opted in
  if (config.runInitialGuards && (config.beforeNavigate || config.afterNavigate)) {
    Promise.resolve().then(() => {
      const from = null;
      const to = {
        pathname: router.pathname,
        search: router.search,
        hash: router.hash,
        params: router.params,
        query: router.query,
        currentRouteName: router.currentRouteName,
        state: null,
      };

      if (config.beforeNavigate) {
        const res = config.beforeNavigate(from, to);
        if (res instanceof Promise) {
          res.then((val) => {
            if (val === false) {
              // Revert or do nothing
            } else if (typeof val === "string") {
              router.replace(val);
            } else {
              if (config.afterNavigate) config.afterNavigate(to);
            }
          }).catch(() => {});
        } else {
          if (res === false) {
            // Revert or do nothing
          } else if (typeof res === "string") {
            router.replace(res);
          } else {
            if (config.afterNavigate) config.afterNavigate(to);
          }
        }
      } else {
        if (config.afterNavigate) config.afterNavigate(to);
      }
    });
  }

  return router;
}

// ============================================================================
// React Router Bindings
// ============================================================================

export const RouterContext = createContext<any>(null);

export function useRouter() {
  const router = useContext(RouterContext);
  if (!router) {
    throw new Error("[jotai-state-tree] useRouter must be used within a RouterContext.Provider");
  }
  
  if (hasStateTreeNode(router)) {
    const node = getStateTreeNode(router);
    useAtomValue(node.snapshotAtom, { store: getGlobalStore() });
  }
  return router;
}
