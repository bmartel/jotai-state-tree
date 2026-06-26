import { JSDOM } from "jsdom";
import { mock } from "bun:test";

// 1. Initialize DOM environment using JSDOM
const jsdom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

(globalThis as any).jsdom = jsdom;
globalThis.window = jsdom.window as any;
globalThis.document = jsdom.window.document;
globalThis.navigator = jsdom.window.navigator;
global.window = globalThis.window;
global.document = globalThis.document;
global.navigator = globalThis.navigator;

// Mock window alert/confirm/prompt to prevent blocking in headless tests
const noopAlert = mock(() => {});
const noopConfirm = mock(() => true);
const noopPrompt = mock(() => null);

jsdom.window.alert = noopAlert;
jsdom.window.confirm = noopConfirm;
jsdom.window.prompt = noopPrompt;

for (const prop of ["alert", "confirm", "prompt"]) {
  Object.defineProperty(global, prop, {
    configurable: true,
    get: () => (jsdom.window as any)[prop],
    set: (v) => {
      (jsdom.window as any)[prop] = v;
    },
  });
  Object.defineProperty(globalThis, prop, {
    configurable: true,
    get: () => (jsdom.window as any)[prop],
    set: (v) => {
      (jsdom.window as any)[prop] = v;
    },
  });
}


// 2. Direct override of Event and DOM classes to avoid compatibility issues with JSDOM window
const CLASSES_TO_OVERRIDE = [
  "Event", "EventTarget", "CustomEvent", 
  "MouseEvent", "KeyboardEvent", "FocusEvent", 
  "TouchEvent", "PopStateEvent", "HashChangeEvent", 
  "ErrorEvent", "ProgressEvent", "MessageEvent", "UIEvent"
];
for (const cls of CLASSES_TO_OVERRIDE) {
  if ((jsdom.window as any)[cls]) {
    (global as any)[cls] = (jsdom.window as any)[cls];
    (globalThis as any)[cls] = (jsdom.window as any)[cls];
  }
}

// 3. Copy other properties that are undefined in Bun global safely
const activeLookups = new Set<string>();

Object.getOwnPropertyNames(jsdom.window)
  .filter((prop) => typeof (global as any)[prop] === "undefined")
  .forEach((prop) => {
    try {
      const getter = () => {
        if (activeLookups.has(prop)) {
          return undefined;
        }
        activeLookups.add(prop);
        try {
          return (jsdom.window as any)[prop];
        } finally {
          activeLookups.delete(prop);
        }
      };

      Object.defineProperty(global, prop, {
        configurable: true,
        get: getter,
      });
      Object.defineProperty(globalThis, prop, {
        configurable: true,
        get: getter,
      });
    } catch (e) {
      // Ignore
    }
  });

// Define userAgent safely to prevent react-dom initialization crashes
if (global.navigator) {
  try {
    Object.defineProperty(global.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      configurable: true,
      writable: true
    });
  } catch (e) {
    (global.navigator as any).userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }
}

// Setup global.gc fallback
if (typeof global.gc === "undefined") {
  global.gc = () => {
    if (typeof Bun !== "undefined") {
      Bun.gc(true);
    }
  };
}
