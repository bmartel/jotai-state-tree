import { mock } from "bun:test";
import { vi } from "vitest";

// ============================================================================
// Global Timer Tracking & Automatic Cleanup
// ============================================================================
const activeIntervals = new Set<any>();

const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;

(globalThis as any).setInterval = (cb: any, delay: any, ...args: any[]) => {
  const timer = originalSetInterval(cb, delay, ...args);
  activeIntervals.add(timer);
  return timer;
};

(globalThis as any).clearInterval = (id: any) => {
  activeIntervals.delete(id);
  originalClearInterval(id);
};

if (typeof window !== "undefined") {
  (window as any).setInterval = globalThis.setInterval;
  (window as any).clearInterval = globalThis.clearInterval;
}

import * as ReactRoot from "./node_modules/react";
import * as ReactDOMRoot from "./node_modules/react-dom";
import * as ReactDOMClientRoot from "./node_modules/react-dom/client";
import * as JotaiRoot from "./node_modules/jotai";
import * as JotaiUtilsRoot from "./node_modules/jotai/utils";

import * as JSTRoot from "./src/index.ts";
import * as JSTReactRoot from "./src/react.ts";
import * as JSTDevToolsRoot from "./src/devtools.tsx";
import * as JSTSSRRoot from "./src/ssr.ts";

// Setup global.gc fallback if needed
if (typeof global.gc === "undefined") {
  global.gc = () => {
    if (typeof Bun !== "undefined") {
      Bun.gc(true);
    }
  };
}

// 2. Extend Bun's built-in vitest compatibility wrapper
const originalSpyOn = vi.spyOn;

(vi as any).spyOn = (obj: any, method: any, accessType?: 'get' | 'set') => {
  if (accessType === 'get') {
    const descriptor = Object.getOwnPropertyDescriptor(obj, method) || 
                       Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), method);
    if (descriptor && descriptor.get) {
      const originalGet = descriptor.get;
      const mockGet = mock(originalGet);
      Object.defineProperty(obj, method, {
        get: mockGet,
        configurable: true,
      });
      mockGet.mockRestore = () => {
        Object.defineProperty(obj, method, descriptor);
      };
      return mockGet;
    }
  }
  return originalSpyOn(obj, method);
};

const originalGlobals = new Map<string, PropertyDescriptor>();
const originalWindowGlobals = new Map<string, PropertyDescriptor>();

(vi as any).stubGlobal = (name: string, value: any) => {
  // Special handling for JSDOM location reconfigure
  if (name === 'location') {
    let url: string | undefined;
    if (typeof value === 'string') {
      url = value;
    } else if (value && typeof value === 'object') {
      const pathname = value.pathname || '/';
      const search = value.search || '';
      const hash = value.hash || '';
      url = `http://localhost${pathname}${search}${hash}`;
    }
    if (url) {
      try {
        const jsdom = (globalThis as any).jsdom;
        if (jsdom) {
          jsdom.reconfigure({ url });
        }
      } catch (e) {
        // ignore
      }
    }
    return vi;
  }

  if (!originalGlobals.has(name)) {
    const desc = Object.getOwnPropertyDescriptor(global, name) || {
      value: (global as any)[name],
      writable: true,
      configurable: true,
      enumerable: true
    };
    originalGlobals.set(name, desc);
  }

  if (global.window && !originalWindowGlobals.has(name)) {
    const desc = Object.getOwnPropertyDescriptor(global.window, name) || {
      value: (global.window as any)[name],
      writable: true,
      configurable: true,
      enumerable: true
    };
    originalWindowGlobals.set(name, desc);
  }

  // Redefine on global via Object.defineProperty to bypass readonly properties safely
  try {
    Object.defineProperty(global, name, {
      value: value,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    (global as any)[name] = value;
  }

  if (global.window) {
    try {
      Object.defineProperty(global.window, name, {
        value: value,
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch (e) {
      try {
        (global.window as any)[name] = value;
      } catch (err) {
        // ignore
      }
    }
  }
  return vi;
};

(vi as any).unstubAllGlobals = () => {
  for (const [name, desc] of originalGlobals.entries()) {
    try {
      Object.defineProperty(global, name, desc);
    } catch (e) {
      try {
        (global as any)[name] = desc.value;
      } catch (err) {
        // ignore
      }
    }

    try {
      Object.defineProperty(globalThis, name, desc);
    } catch (e) {
      try {
        (globalThis as any)[name] = desc.value;
      } catch (err) {
        // ignore
      }
    }
  }

  if (global.window) {
    for (const [name, desc] of originalWindowGlobals.entries()) {
      try {
        Object.defineProperty(global.window, name, desc);
      } catch (e) {
        try {
          (global.window as any)[name] = desc.value;
        } catch (err) {
          // ignore
        }
      }
    }
  }

  originalGlobals.clear();
  originalWindowGlobals.clear();
  return vi;
};

(vi as any).mocked = (obj: any) => obj;
(vi as any).resetModules = () => {};

// Also define it globally for tests that access it globally
(globalThis as any).vi = vi;

// 3. Mock packages to ensure single-instance resolution and avoid duplicate loads (especially React)
mock.module("react", () => ReactRoot);
mock.module("react-dom", () => ReactDOMRoot);
mock.module("react-dom/client", () => ReactDOMClientRoot);
mock.module("jotai", () => JotaiRoot);
mock.module("jotai/utils", () => JotaiUtilsRoot);

mock.module("jotai-state-tree", () => JSTRoot);
mock.module("jotai-state-tree/react", () => JSTReactRoot);
mock.module("jotai-state-tree/devtools", () => JSTDevToolsRoot);
mock.module("jotai-state-tree/ssr", () => JSTSSRRoot);

// 4. Register beforeEach and afterEach hooks for JSDOM location reset and Testing Library cleanup
import { beforeEach, afterEach } from "bun:test";

beforeEach(() => {
  try {
    const jsdom = (globalThis as any).jsdom;
    if (jsdom) {
      jsdom.reconfigure({ url: "http://localhost/" });
    }
  } catch (e) {
    // ignore
  }

  // Clear localStorage and sessionStorage to prevent state leakage
  try {
    if (global.window && global.window.localStorage) {
      global.window.localStorage.clear();
    }
    if (global.window && global.window.sessionStorage) {
      global.window.sessionStorage.clear();
    }
  } catch (e) {
    // ignore
  }

  // Reset JSDOM history stack and state
  try {
    if (global.window && global.window.history) {
      const symbols = Object.getOwnPropertySymbols(global.window.history);
      const implSym = symbols.find(s => s.toString() === "Symbol(impl)");
      if (implSym) {
        const historyImpl = (global.window.history as any)[implSym];
        if (historyImpl) {
          historyImpl._state = null;
          const winImpl = historyImpl._window;
          const sh = winImpl?._sessionHistory;
          if (sh && sh._entries) {
            sh._entries = [sh._entries[0]];
            sh._currentIndex = 0;
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
});

afterEach(() => {
  // Clear all pending/leaked intervals
  for (const id of activeIntervals) {
    originalClearInterval(id);
  }
  activeIntervals.clear();

  try {
    const { cleanup } = require("@testing-library/react");
    cleanup();
  } catch (e) {
    // Ignore if not in a React test or testing-library is not installed
  }
  try {
    vi.unstubAllGlobals();
  } catch (e) {
    // ignore
  }
  try {
    if (global.alert && (global.alert as any).mockClear) {
      (global.alert as any).mockClear();
    }
    if (global.confirm && (global.confirm as any).mockClear) {
      (global.confirm as any).mockClear();
    }
    if (global.prompt && (global.prompt as any).mockClear) {
      (global.prompt as any).mockClear();
    }
  } catch (e) {
    // ignore
  }
  try {
    JSTDevToolsRoot.resetDevtoolsStore();
  } catch (e) {
    // ignore
  }
  try {
    JSTRoot.clearAllRegistries();
  } catch (e) {
    // ignore
  }
  try {
    JSTRoot.clearModelRegistry();
  } catch (e) {
    // ignore
  }
});
