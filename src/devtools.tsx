import React from "react";
import {
  types,
  getSnapshot,
  applySnapshot,
  onSnapshot,
  onPatch,
  onAction,
  applyPatch,
  getRegistryStats,
  getCurrentAction,
  isAlive,
} from "./index";
import { activePersistenceManagers } from "./persistence";
import { nodeRegistry, identifierRegistry, getStateTreeNode, onLifecycleChange, activeReactRoots, incrementRootRef, decrementRootRef, rootNodesRegistry } from "./tree";
import { observer } from "./react";

export interface DevtoolsProps {
  store?: any;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  initialOpen?: boolean;
}

const isDev = (() => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch (e) {
    if (typeof window !== "undefined" && window.location) {
      const host = window.location.hostname;
      return (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "[::1]" ||
        host.endsWith(".local") ||
        host.endsWith(".webcontainer.io") ||
        host.endsWith(".stackblitz.io") ||
        host.endsWith(".stackblitz.app")
      );
    }
    return false;
  }
})();

// SVG Icons
const Icons = {
  Tree: () => (
    <svg className="jst-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V2.5" />
      <path d="M12 20.5 L7.5 17 L4.5 18" />
      <path d="M12 20.5 L16.5 17 L19.5 18" />
      <path d="M12 15.5 L9 12 L6.5 13" />
      <path d="M12 15.5 L15 12 L17.5 13" />
      <path d="M12 10 L10.5 7 L8.5 8" />
      <path d="M12 10 L13.5 7 L15.5 8" />
      <circle cx="12" cy="2.5" r="1.3" fill="currentColor" stroke="currentColor" />
      <circle cx="8.5" cy="8" r="1.3" fill="currentColor" stroke="currentColor" />
      <circle cx="15.5" cy="8" r="1.3" fill="currentColor" stroke="currentColor" />
      <circle cx="6.5" cy="13" r="1.3" fill="currentColor" stroke="currentColor" />
      <circle cx="17.5" cy="13" r="1.3" fill="currentColor" stroke="currentColor" />
      <circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="currentColor" />
      <circle cx="19.5" cy="18" r="1.3" fill="currentColor" stroke="currentColor" />
    </svg>
  ),
  History: () => (
    <svg className="jst-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Patches: () => (
    <svg className="jst-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Database: () => (
    <svg className="jst-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  ),
  Router: () => (
    <svg className="jst-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <path d="M12 8v4M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Registry: () => (
    <svg className="jst-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3.5A2.5 2.5 0 0 1 6.5 1h11A2.5 2.5 0 0 1 20 3.5V17M6.5 17H20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Pause: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  Undo: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Copy: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Maximize: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  ),
  Minimize: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="10" y1="14" x2="3" y2="21" />
    </svg>
  ),
  DockBottom: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  ),
  DockRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
};

// Styles Injection
const cssStyles = `
  .jst-devtools-trigger {
    position: fixed;
    z-index: 99999;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1 0%, #10b981 100%);
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #fff;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(8px);
  }
  .jst-devtools-trigger:hover {
    transform: scale(1.1) rotate(10deg);
    box-shadow: 0 6px 24px rgba(99, 102, 241, 0.6), 0 0 12px rgba(16, 185, 129, 0.4);
  }
  .jst-devtools-trigger:active {
    transform: scale(0.95);
  }
  .jst-devtools-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    background: #ef4444;
    color: #fff;
    font-size: 9px;
    font-weight: bold;
    border-radius: 9px;
    padding: 1px 5px;
    border: 1.5px solid #0f111a;
    min-width: 14px;
    text-align: center;
  }
  .jst-icon {
    width: 20px;
    height: 20px;
  }
  .jst-panel {
    position: fixed;
    z-index: 99998;
    background: rgba(10, 11, 16, 0.94);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
    color: #e2e8f0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .jst-panel.bottom {
    left: 0;
    right: 0;
    bottom: 0;
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
  }
  .jst-panel.right {
    top: 0;
    bottom: 0;
    right: 0;
    border-top-left-radius: 16px;
    border-bottom-left-radius: 16px;
  }
  .jst-panel.maximized {
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    border-radius: 0 !important;
  }
  .jst-header {
    height: 52px;
    padding: 0 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.02);
  }
  .jst-title-section {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .jst-logo {
    font-weight: 800;
    font-size: 14px;
    letter-spacing: 0.5px;
    background: linear-gradient(135deg, #a5b4fc 0%, #34d399 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .jst-select-store {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 500;
    outline: none;
    cursor: pointer;
  }
  .jst-select-store:focus {
    border-color: #6366f1;
  }
  .jst-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .jst-control-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }
  .jst-control-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }
  .jst-navbar {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    background: rgba(0, 0, 0, 0.2);
  }
  .jst-nav-item {
    padding: 12px 16px;
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }
  .jst-nav-item:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.02);
  }
  .jst-nav-item.active {
    color: #6366f1;
    border-bottom-color: #6366f1;
    background: rgba(99, 102, 241, 0.04);
  }
  .jst-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  .jst-sidebar {
    width: 320px;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.1);
  }
  .jst-main-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .jst-pane-header {
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #64748b;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .jst-list {
    flex: 1;
    overflow-y: auto;
  }
  .jst-list-item {
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    cursor: pointer;
    font-size: 11px;
    transition: all 0.15s;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .jst-list-item:hover {
    background: rgba(255, 255, 255, 0.02);
  }
  .jst-list-item.selected {
    background: rgba(99, 102, 241, 0.08);
    border-left: 3px solid #6366f1;
    padding-left: 11px;
  }
  .jst-tree-node {
    padding-left: 16px;
    font-family: Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
  }
  .jst-tree-label {
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #94a3b8;
  }
  .jst-tree-label:hover {
    background: rgba(255, 255, 255, 0.03);
    color: #cbd5e1;
  }
  .jst-tree-label.selected {
    background: rgba(99, 102, 241, 0.12);
    color: #a5b4fc;
  }
  .jst-tree-toggle {
    font-size: 9px;
    width: 12px;
    display: inline-block;
    text-align: center;
  }
  .jst-json-container {
    padding: 16px;
    overflow: auto;
    font-family: Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    background: #06070a;
    flex: 1;
  }
  .jst-json-key {
    color: #f43f5e;
  }
  .jst-json-string {
    color: #10b981;
  }
  .jst-json-number {
    color: #f59e0b;
  }
  .jst-json-boolean {
    color: #3b82f6;
  }
  .jst-json-null {
    color: #64748b;
  }
  .jst-time-scrubber {
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.01);
  }
  .jst-slider {
    flex: 1;
    accent-color: #6366f1;
    cursor: pointer;
  }
  .jst-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .jst-badge-indigo {
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
  }
  .jst-badge-emerald {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }
  .jst-badge-rose {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }
  .jst-badge-amber {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }
  .jst-search-bar {
    padding: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    position: relative;
  }
  .jst-search-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
    border-radius: 6px;
    padding: 6px 10px 6px 28px;
    font-size: 11px;
    outline: none;
    box-sizing: border-box;
  }
  .jst-search-input:focus {
    border-color: #6366f1;
    background: rgba(255, 255, 255, 0.06);
  }
  .jst-search-icon {
    position: absolute;
    left: 18px;
    top: 17px;
    color: #64748b;
  }
  .jst-detail-panel {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    flex: 1;
  }
  .jst-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 14px;
  }
  .jst-card-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
    margin-bottom: 10px;
  }
  .jst-nav-tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    padding-bottom: 6px;
  }
  .jst-nav-tab {
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    border-radius: 4px;
  }
  .jst-nav-tab:hover {
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.03);
  }
  .jst-nav-tab.active {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
  }
  .jst-resizer-bottom {
    height: 4px;
    cursor: ns-resize;
    background: transparent;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
  }
  .jst-resizer-right {
    width: 4px;
    cursor: ew-resize;
    background: transparent;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
  }
`;

// ============================================================================
// DevTools State Tree Model (Self-managed, Hook-free State)
// ============================================================================

const DevtoolsModel = types
  .model("DevtoolsModel", {
    isOpen: types.optional(types.boolean, false),
    activeTab: types.optional(types.string, "tree"),
    selectedStoreIndex: types.optional(types.number, 0),
    dock: types.optional(types.string, "bottom"),
    maximized: types.optional(types.boolean, false),
    height: types.optional(types.number, 380),
    width: types.optional(types.number, 600),
    selectedPath: types.optional(types.string, ""),
    searchQuery: types.optional(types.string, ""),
    patchSearchQuery: types.optional(types.string, ""),
    navPath: types.optional(types.string, ""),
    isPlaying: types.optional(types.boolean, false),
    selectedActionIndex: types.optional(types.number, 0),
  })
  .volatile(() => ({
    actions: [
      { id: "init", name: "@@INIT", path: "", args: [], timestamp: Date.now(), snapshot: null, patches: [] }
    ] as any[],
    patchesLog: [] as any[],
    activeSnapshot: null as any,
    expandedPaths: new Map<string, boolean>(),
    discoveredRoots: [] as any[],
    activeStore: null as any,
    isTimeTraveling: false,
    actionPatches: new Map<any, any[]>(),
    playTimer: null as any,
    storeDisposers: [] as (() => void)[],
    propStore: null as any,
    initialOpenSynced: false,
    isResizing: false,
    _cleanupInterval: null as any,
    _cleanupResize: null as any,
  }))
  .actions((self) => ({
    setIsOpen(val: boolean) {
      self.isOpen = val;
      if (val) {
        (self as any).startPolling();
      } else {
        (self as any).stopPolling();
      }
    },
    startPolling() {
      if (self._cleanupInterval) return;
      (self as any).updateRoots();
      if (typeof window !== "undefined") {
        const interval = setInterval(() => {
          if (isAlive(self)) {
            (self as any).updateRoots();
          }
        }, 1500);
        self._cleanupInterval = () => clearInterval(interval);
      }
    },
    stopPolling() {
      if (self._cleanupInterval) {
        self._cleanupInterval();
        self._cleanupInterval = null;
      }
    },
    setCleanupInterval(fn: any) {
      self._cleanupInterval = fn;
    },
    setCleanupResize(fn: any) {
      self._cleanupResize = fn;
    },
    setActiveTab(tab: string) {
      self.activeTab = tab;
    },
    setSelectedStoreIndex(idx: number) {
      self.selectedStoreIndex = idx;
      this.updateActiveStore();
    },
    setDock(dock: string) {
      self.dock = dock;
    },
    setMaximized(val: boolean) {
      self.maximized = val;
    },
    setHeight(h: number) {
      self.height = h;
    },
    setWidth(w: number) {
      self.width = w;
    },
    setSelectedPath(path: string) {
      self.selectedPath = path;
    },
    setSearchQuery(q: string) {
      self.searchQuery = q;
    },
    setPatchSearchQuery(q: string) {
      self.patchSearchQuery = q;
    },
    setNavPath(p: string) {
      self.navPath = p;
    },
    setIsResizing(val: boolean) {
      self.isResizing = val;
    },
    setExpandedPath(path: string, val: boolean) {
      const next = new Map(self.expandedPaths);
      next.set(path, val);
      self.expandedPaths = next;
    },
    updateRoots() {
      const rootsMap = new Set<any>();
      const activeRootsFiltered = new Set(
        Array.from(activeReactRoots).filter(
          (r: any) => r.$treenode?.$type?.name !== "DevtoolsModel"
        )
      );
      const hasActiveReactRoots = activeRootsFiltered.size > 0;
      for (const weakRef of rootNodesRegistry.values()) {
        const node = weakRef.deref();
        if (node && node.$isAlive) {
          if (node.$type.name === "DevtoolsModel") {
            continue;
          }
          const inst = node.getInstance();
          if (inst) {
            if (hasActiveReactRoots && !activeRootsFiltered.has(inst)) {
              continue;
            }
            rootsMap.add(inst);
          }
        }
      }
      const arrayRoots = Array.from(rootsMap);

      let changed = arrayRoots.length !== self.discoveredRoots.length;
      if (!changed) {
        for (let i = 0; i < arrayRoots.length; i++) {
          if (arrayRoots[i] !== self.discoveredRoots[i]) {
            changed = true;
            break;
          }
        }
      }

      if (changed) {
        self.discoveredRoots = arrayRoots;
        this.updateActiveStore();
      }
    },
    syncProps(propStore: any, initialOpen?: boolean) {
      let changed = false;
      if (self.propStore !== propStore) {
        self.propStore = propStore;
        changed = true;
        self.isOpen = initialOpen ?? false;
        self.initialOpenSynced = false;
      }
      if (initialOpen !== undefined && self.initialOpenSynced === false) {
        self.isOpen = initialOpen;
        self.initialOpenSynced = true;
      }
      if (self.isOpen) {
        (self as any).startPolling();
      } else {
        (self as any).stopPolling();
      }
      this.updateRoots();
      if (changed) {
        this.updateActiveStore();
      }
    },
    updateActiveStore() {
      // Unsubscribe from old store
      self.storeDisposers.forEach((d) => d());
      self.storeDisposers = [];
      self.actionPatches.clear();

      // Find new active store
      let store: any = null;
      if (self.discoveredRoots.length > 0 && self.selectedStoreIndex < self.discoveredRoots.length) {
        store = self.discoveredRoots[self.selectedStoreIndex];
      } else if (self.propStore) {
        store = self.propStore;
      }

      self.activeStore = store;

      if (!store) {
        self.activeSnapshot = null;
        self.actions = [{ id: "init", name: "@@INIT", path: "", args: [], timestamp: Date.now(), snapshot: null, patches: [] }];
        self.selectedActionIndex = 0;
        self.patchesLog = [];
        return;
      }

      // Subscribe to active store's lifecycle changes to auto-update/cleanup on destroy
      const node = getStateTreeNode(store);
      const disposeLifecycle = onLifecycleChange(node, (isAlive) => {
        if (!isAlive) {
          (self as any).updateRoots();
        }
      });
      self.storeDisposers.push(disposeLifecycle);

      // Initialize snapshots and actions for this store
      const snap = getSnapshot(store);
      self.activeSnapshot = snap;
      self.actions = [
        {
          id: "init",
          name: "@@INIT",
          path: "",
          args: [],
          timestamp: Date.now(),
          snapshot: snap,
          patches: []
        }
      ];
      self.selectedActionIndex = 0;
      self.patchesLog = [];

      // 1. Subscribe to Snapshots
      const disposeSnap = onSnapshot(store, (nextSnap) => {
        if (!self.isTimeTraveling) {
          (self as any).setActiveSnapshot(nextSnap);
        }
      });

      // 2. Subscribe to Patches
      const disposePatches = onPatch(store, (patch, reversePatch) => {
        if (self.isTimeTraveling) return;

        const logEntry = {
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toLocaleTimeString(),
          patch,
          reversePatch
        };

        (self as any).logPatch(logEntry, patch, store);
      });

      // 3. Subscribe to Actions
      const disposeActions = onAction(store, (call) => {
        if (self.isTimeTraveling) return;

        // Skip logging patch logging actions in the timeline to avoid clutter
        if (call.name === "logPatch" || call.name === "clearPatchLogs") {
          const currentCtx = getCurrentAction();
          if (currentCtx) {
            (self as any).deleteActionPatch(currentCtx);
          }
          return;
        }

        (self as any).logAction(call.name, call.path, call.args, store);
      });

      self.storeDisposers.push(disposeSnap, disposePatches, disposeActions);
    },
    setActiveSnapshot(snap: any) {
      self.activeSnapshot = snap;
    },
    deleteActionPatch(currentCtx: any) {
      self.actionPatches.delete(currentCtx);
    },
    logPatch(logEntry: any, patch: any, storeInstance: any) {
      self.patchesLog = [logEntry, ...self.patchesLog].slice(0, 100);

      const currentCtx = getCurrentAction();
      if (currentCtx) {
        if (!self.actionPatches.has(currentCtx)) {
          self.actionPatches.set(currentCtx, []);
        }
        self.actionPatches.get(currentCtx)!.push(patch);
      } else {
        // Aggregate patches into the latest action
        if (self.actions.length > 1) {
          const lastIdx = self.actions.length - 1;
          const updatedAction = {
            ...self.actions[lastIdx],
            patches: [...(self.actions[lastIdx].patches || []), patch],
            snapshot: getSnapshot(storeInstance)
          };
          const nextActions = [...self.actions];
          nextActions[lastIdx] = updatedAction;
          self.actions = nextActions;
        }
      }
    },
    logAction(name: string, path: string, args: any[], storeInstance: any) {
      const currentCtx = getCurrentAction();
      const patches = currentCtx ? (self.actionPatches.get(currentCtx) || []) : [];
      if (currentCtx) {
        self.actionPatches.delete(currentCtx);
      }

      // --- LINEAR HISTORY TRUNCATION FIX ---
      // Instead of appending to the end, truncate the future actions at the current time-travel position!
      const truncated = self.actions.slice(0, self.selectedActionIndex + 1);
      const nextIndex = truncated.length;

      const newAction = {
        id: Math.random().toString(36).substring(7),
        name,
        path,
        args,
        timestamp: Date.now(),
        snapshot: getSnapshot(storeInstance),
        patches: patches
      };

      self.actions = [...truncated, newAction];
      self.selectedActionIndex = nextIndex;
    },
    jumpToStateIndex(index: number) {
      if (!self.activeStore || index < 0 || index >= self.actions.length) return;
      self.isTimeTraveling = true;
      const node = getStateTreeNode(self.activeStore);
      const rootNode = node.getRoot();
      const wasApplyingHistory = rootNode.$isApplyingHistory;
      rootNode.$isApplyingHistory = true;
      try {
        const targetState = self.actions[index].snapshot;
        applySnapshot(self.activeStore, targetState);
        self.activeSnapshot = targetState;
        self.selectedActionIndex = index;
      } finally {
        rootNode.$isApplyingHistory = wasApplyingHistory;
        self.isTimeTraveling = false;
      }
    },
    togglePlay() {
      if (self.isPlaying) {
        self.isPlaying = false;
        if (self.playTimer) {
          clearInterval(self.playTimer);
          self.playTimer = null;
        }
      } else {
        self.isPlaying = true;
        self.playTimer = setInterval(() => {
          if (self.actions.length === 0) return;
          const nextIdx = (self.selectedActionIndex + 1) % self.actions.length;
          this.jumpToStateIndex(nextIdx);
        }, 1000);
      }
    },
    importHistory(parsedActions: any[]) {
      self.actions = parsedActions;
      self.selectedActionIndex = 0;
      self.isTimeTraveling = true;
      try {
        if (self.activeStore) {
          applySnapshot(self.activeStore, parsedActions[0].snapshot);
        }
        self.activeSnapshot = parsedActions[0].snapshot;
      } finally {
        self.isTimeTraveling = false;
      }
    }
  }))
  .afterCreate((self) => {
    // 1. Polling root discovery only if initially open
    if (self.isOpen) {
      (self as any).startPolling();
    }

    if (typeof window !== "undefined") {
      // 2. Global window resize handlers
      const handleMouseMove = (e: MouseEvent) => {
        if (!isAlive(self)) return;
        if (!self.isResizing) return;
        if (self.dock === "bottom") {
          const newHeight = window.innerHeight - e.clientY;
          (self as any).setHeight(Math.max(180, Math.min(window.innerHeight - 50, newHeight)));
        } else {
          const newWidth = window.innerWidth - e.clientX;
          (self as any).setWidth(Math.max(250, Math.min(window.innerWidth - 50, newWidth)));
        }
      };

      const handleMouseUp = () => {
        if (!isAlive(self)) return;
        if (self.isResizing) {
          (self as any).setIsResizing(false);
          document.body.style.userSelect = "";
          document.body.style.cursor = "";
        }
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      (self as any).setCleanupResize(() => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      });
    }
  })
  .beforeDestroy((self) => {
    self.storeDisposers.forEach((d) => d());
    (self as any).stopPolling();
    if ((self as any)._cleanupResize) {
      (self as any)._cleanupResize();
    }
    if (self.playTimer) {
      clearInterval(self.playTimer);
    }
  });

let _devtoolsStore = DevtoolsModel.create({});

const devtoolsStore = new Proxy({} as any, {
  get(target, prop) {
    if (!_devtoolsStore || !isAlive(_devtoolsStore)) {
      _devtoolsStore = DevtoolsModel.create({});
    }
    return Reflect.get(_devtoolsStore, prop);
  },
  set(target, prop, value) {
    if (!_devtoolsStore || !isAlive(_devtoolsStore)) {
      _devtoolsStore = DevtoolsModel.create({});
    }
    return Reflect.set(_devtoolsStore, prop, value);
  },
  has(target, prop) {
    if (!_devtoolsStore || !isAlive(_devtoolsStore)) {
      _devtoolsStore = DevtoolsModel.create({});
    }
    return Reflect.has(_devtoolsStore, prop);
  },
  ownKeys(target) {
    if (!_devtoolsStore || !isAlive(_devtoolsStore)) {
      _devtoolsStore = DevtoolsModel.create({});
    }
    return Reflect.ownKeys(_devtoolsStore);
  },
  getOwnPropertyDescriptor(target, prop) {
    if (!_devtoolsStore || !isAlive(_devtoolsStore)) {
      _devtoolsStore = DevtoolsModel.create({});
    }
    return Reflect.getOwnPropertyDescriptor(_devtoolsStore, prop);
  }
});

// ============================================================================
// UI Components
// ============================================================================

// Recursive JSON Tree Component (React Hook Free)
const JsonTree: React.ComponentType<{ data: any; label?: string; depth?: number; path?: string }> = observer(({ data, label, depth = 0, path = "" }) => {
  const currentPath = path ? `${path}.${label}` : (label || "root");
  const isExpanded = devtoolsStore.expandedPaths.has(currentPath)
    ? devtoolsStore.expandedPaths.get(currentPath)
    : depth < 2;

  const isObject = data !== null && typeof data === "object";
  const isArray = Array.isArray(data);

  if (!isObject) {
    let valStr = String(data);
    let typeClass = "jst-json-null";
    if (typeof data === "string") {
      valStr = `"${data}"`;
      typeClass = "jst-json-string";
    } else if (typeof data === "number") {
      typeClass = "jst-json-number";
    } else if (typeof data === "boolean") {
      typeClass = "jst-json-boolean";
    }

    return (
      <div style={{ paddingLeft: "16px", margin: "2px 0" }}>
        {label && <span className="jst-json-key">{label}: </span>}
        <span className={typeClass}>{valStr}</span>
      </div>
    );
  }

  const keys = Object.keys(data);
  const summary = isArray ? `Array(${keys.length})` : `Object {${keys.length}}`;

  return (
    <div style={{ paddingLeft: "12px", margin: "2px 0" }}>
      <div onClick={() => devtoolsStore.setExpandedPath(currentPath, !isExpanded)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
        <span style={{ fontSize: "8px", color: "#64748b", transform: isExpanded ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.1s" }}>▶</span>
        {label && <span className="jst-json-key">{label}: </span>}
        <span style={{ color: "#94a3b8", fontSize: "10px" }}>{summary}</span>
      </div>
      {isExpanded && (
        <div style={{ borderLeft: "1px dashed rgba(255,255,255,0.06)", marginLeft: "4px" }}>
          {keys.map((k) => (
            <JsonTree key={k} label={k} data={data[k]} depth={depth + 1} path={currentPath} />
          ))}
        </div>
      )}
    </div>
  );
});

// Real Implementation Component (React Hook Free)
const JotaiStateTreeDevtoolsImpl: React.ComponentType<DevtoolsProps> = observer(({
  store: propStore,
  position = "bottom-right",
  initialOpen = false,
}) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Sync props to devtoolsStore on mount/update (client-only)
  React.useEffect(() => {
    devtoolsStore.syncProps(propStore, initialOpen);
  }, [propStore, initialOpen]);

  // Register propStore in activeReactRoots on mount/update
  React.useEffect(() => {
    if (propStore) {
      const root = getStateTreeNode(propStore).getRoot().getInstance();
      incrementRootRef(root);
      return () => {
        decrementRootRef(root);
      };
    }
  }, [propStore]);

  // CSS styling injector
  React.useEffect(() => {
    const styleId = "jst-devtools-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = cssStyles;
      document.head.appendChild(style);
    }
  }, []);

  if (typeof window === "undefined" || !mounted) {
    return null;
  }

  // Active Persistence Manager
  const persistenceManager = devtoolsStore.activeStore ? activePersistenceManagers.get(devtoolsStore.activeStore) : null;

  // Find subrouter within current store
  const subRouter = (() => {
    const activeStore = devtoolsStore.activeStore;
    if (!activeStore) return null;
    for (const entry of nodeRegistry.values()) {
      const node = entry.node.deref();
      if (node && node.$isAlive && node.$type.name === "RouterModel") {
        let cur: any = node;
        while (cur.$parent) {
          cur = cur.$parent;
        }
        if (cur.getInstance() === activeStore) {
          return node.getInstance() as any;
        }
      }
    }
    return null;
  })();

  // Resizing implementation
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    devtoolsStore.setIsResizing(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = devtoolsStore.dock === "bottom" ? "ns-resize" : "ew-resize";
  };

  // Export/Import history
  const exportHistory = () => {
    const fileData = JSON.stringify(devtoolsStore.actions, null, 2);
    const blob = new Blob([fileData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jst-devtools-history-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].snapshot) {
          devtoolsStore.importHistory(parsed);
        }
      } catch (err) {
        alert("Failed to parse JST history file.");
      }
    };
    reader.readAsText(file);
  };

  // Helper: render navigation targets
  const floatingPositionStyles = (() => {
    switch (position) {
      case "bottom-left": return { bottom: "24px", left: "24px" };
      case "top-left": return { top: "24px", left: "24px" };
      case "top-right": return { top: "24px", right: "24px" };
      default: return { bottom: "24px", right: "24px" };
    }
  })();

  const panelPositionStyles = (() => {
    if (devtoolsStore.maximized) return {};
    if (devtoolsStore.dock === "bottom") {
      return { bottom: 0, left: 0, right: 0, height: `${devtoolsStore.height}px` };
    } else {
      return { top: 0, bottom: 0, right: 0, width: `${devtoolsStore.width}px` };
    }
  })();



  // Navigation router helpers
  const triggerNavigation = () => {
    if (subRouter && devtoolsStore.navPath) {
      subRouter.push(devtoolsStore.navPath);
    }
  };

  // State Tree rendering walker helper
  const renderStateTreeNodes = (node: any, path: string = ""): React.ReactNode => {
    if (!node || !node.$isAlive) return null;
    const nodePath = node.$path || "/";
    const name = node.$type.name || "AnonymousNode";
    const isSelected = devtoolsStore.selectedPath === nodePath;
    
    return (
      <div key={node.$id} className="jst-tree-node">
        <div 
          className={`jst-tree-label ${isSelected ? "selected" : ""}`}
          onClick={() => {
            devtoolsStore.setSelectedPath(nodePath);
          }}
        >
          <span className="jst-tree-toggle">▪</span>
          <span>{path || "Root"} <span style={{ color: "#475569", fontSize: "9px" }}>({name})</span></span>
        </div>
        
        <div style={{ paddingLeft: "12px", borderLeft: "1px dashed rgba(255,255,255,0.03)" }}>
          {/* Render subnodes recursively */}
          {Array.from(node.getChildren().entries()).map((entry: any) => {
            const [key, childNode] = entry;
            return renderStateTreeNodes(childNode, key);
          })}
        </div>
      </div>
    );
  };

  if (!devtoolsStore.isOpen) {
    return (
      <button
        className="jst-devtools-trigger"
        style={floatingPositionStyles}
        onClick={() => devtoolsStore.setIsOpen(true)}
        title="Open Jotai State Tree DevTools"
      >
        <Icons.Tree />
        {devtoolsStore.discoveredRoots.length > 0 && (
          <span className="jst-devtools-badge">{devtoolsStore.discoveredRoots.length}</span>
        )}
      </button>
    );
  }

  return (
    <div 
      className={`jst-panel ${devtoolsStore.dock} ${devtoolsStore.maximized ? "maximized" : ""}`}
      style={panelPositionStyles}
    >
      {/* Resize handlers */}
      {!devtoolsStore.maximized && devtoolsStore.dock === "bottom" && (
        <div className="jst-resizer-bottom" onMouseDown={startResize} />
      )}
      {!devtoolsStore.maximized && devtoolsStore.dock === "right" && (
        <div className="jst-resizer-right" onMouseDown={startResize} />
      )}

      {/* Devtools Header */}
      <div className="jst-header">
        <div className="jst-title-section">
          <Icons.Tree />
          <span className="jst-logo">JOTAI STATE TREE</span>
          {devtoolsStore.discoveredRoots.length > 0 ? (
            <select
              className="jst-select-store"
              value={devtoolsStore.selectedStoreIndex}
              onChange={(e) => devtoolsStore.setSelectedStoreIndex(Number(e.target.value))}
            >
              {devtoolsStore.discoveredRoots.map((root: any, idx: number) => {
                const node = (root as any).$treenode || { $type: { name: "Store" } };
                return (
                  <option key={idx} value={idx}>
                    {node.$type.name} (Root {idx + 1})
                  </option>
                );
              })}
            </select>
          ) : (
            <span className="jst-badge jst-badge-rose">No Active Tree</span>
          )}
        </div>

        <div className="jst-controls">
          <button
            className="jst-control-btn"
            onClick={() => devtoolsStore.setDock(devtoolsStore.dock === "bottom" ? "right" : "bottom")}
            title={devtoolsStore.dock === "bottom" ? "Dock to Right" : "Dock to Bottom"}
          >
            {devtoolsStore.dock === "bottom" ? <Icons.DockRight /> : <Icons.DockBottom />}
          </button>
          <button
            className="jst-control-btn"
            onClick={() => devtoolsStore.setMaximized(!devtoolsStore.maximized)}
            title={devtoolsStore.maximized ? "Minimize Panel" : "Maximize Panel"}
          >
            {devtoolsStore.maximized ? <Icons.Minimize /> : <Icons.Maximize />}
          </button>
          <button
            className="jst-control-btn"
            onClick={() => devtoolsStore.setIsOpen(false)}
            title="Close DevTools"
          >
            <Icons.Close />
          </button>
        </div>
      </div>

      {/* Navbar tabs */}
      <div className="jst-navbar">
        <div className={`jst-nav-item ${devtoolsStore.activeTab === "tree" ? "active" : ""}`} onClick={() => devtoolsStore.setActiveTab("tree")}>
          <Icons.Tree /> State Tree
        </div>
        <div className={`jst-nav-item ${devtoolsStore.activeTab === "actions" ? "active" : ""}`} onClick={() => devtoolsStore.setActiveTab("actions")}>
          <Icons.History /> Actions Timeline
        </div>
        <div className={`jst-nav-item ${devtoolsStore.activeTab === "patches" ? "active" : ""}`} onClick={() => devtoolsStore.setActiveTab("patches")}>
          <Icons.Patches /> Patches Feed
        </div>
        {persistenceManager && (
          <div className={`jst-nav-item ${devtoolsStore.activeTab === "persistence" ? "active" : ""}`} onClick={() => devtoolsStore.setActiveTab("persistence")}>
            <Icons.Database /> Persistence
          </div>
        )}
        {subRouter && (
          <div className={`jst-nav-item ${devtoolsStore.activeTab === "router" ? "active" : ""}`} onClick={() => devtoolsStore.setActiveTab("router")}>
            <Icons.Router /> Router
          </div>
        )}
        <div className={`jst-nav-item ${devtoolsStore.activeTab === "registry" ? "active" : ""}`} onClick={() => devtoolsStore.setActiveTab("registry")}>
          <Icons.Registry /> Registry
        </div>
      </div>

      {/* Tabs Panels */}
      <div className="jst-content">
        {/* 1. STATE TREE PANEL */}
        {devtoolsStore.activeTab === "tree" && (
          <>
            <div className="jst-sidebar">
              <div className="jst-pane-header">Tree Nodes</div>
              <div className="jst-list" style={{ padding: "8px" }}>
                {devtoolsStore.activeStore && (devtoolsStore.activeStore as any).$treenode ? (
                  renderStateTreeNodes((devtoolsStore.activeStore as any).$treenode)
                ) : (
                  <div style={{ padding: "16px", color: "#64748b", fontSize: "11px" }}>No stores found. Make sure a jotai-state-tree is instantiated.</div>
                )}
              </div>
            </div>
            <div className="jst-main-panel">
              <div className="jst-pane-header">
                <span>Node Details: {devtoolsStore.selectedPath || "/"}</span>
                {devtoolsStore.activeSnapshot && (
                  <button
                    className="jst-nav-tab"
                    style={{ border: "1px solid rgba(255,255,255,0.1)", background: "transparent", cursor: "pointer" }}
                    onClick={() => {
                      let subSnap = devtoolsStore.activeSnapshot;
                      if (devtoolsStore.selectedPath) {
                        const parts = devtoolsStore.selectedPath.split("/").filter(Boolean);
                        for (const part of parts) {
                          if (subSnap && typeof subSnap === "object") {
                            subSnap = subSnap[part];
                          }
                        }
                      }
                      navigator.clipboard.writeText(JSON.stringify(subSnap, null, 2));
                    }}
                  >
                    Copy Node Snapshot
                  </button>
                )}
              </div>
              <div className="jst-json-container">
                {devtoolsStore.activeSnapshot ? (
                  (() => {
                    let subSnap = devtoolsStore.activeSnapshot;
                    if (devtoolsStore.selectedPath) {
                      const parts = devtoolsStore.selectedPath.split("/").filter(Boolean);
                      for (const part of parts) {
                        if (subSnap && typeof subSnap === "object") {
                          subSnap = subSnap[part];
                        } else {
                          subSnap = undefined;
                        }
                      }
                    }
                    return <JsonTree data={subSnap} />;
                  })()
                ) : (
                  <div style={{ color: "#64748b" }}>Select a node in the tree to explore its state properties.</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* 2. ACTIONS TIMELINE PANEL */}
        {devtoolsStore.activeTab === "actions" && (
          <>
            <div className="jst-sidebar">
              <div className="jst-pane-header">
                <span>Timeline</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button className="jst-control-btn" style={{ height: "18px" }} onClick={() => devtoolsStore.togglePlay()} title={devtoolsStore.isPlaying ? "Pause Playback" : "Play Playback"}>
                    {devtoolsStore.isPlaying ? <Icons.Pause /> : <Icons.Play />}
                  </button>
                  <button className="jst-control-btn" style={{ height: "18px" }} onClick={exportHistory} title="Export Timeline History">
                    <Icons.Copy />
                  </button>
                  <label className="jst-control-btn" style={{ height: "18px", cursor: "pointer" }} title="Import Timeline History">
                    <input type="file" accept=".json" onChange={importHistory} style={{ display: "none" }} />
                    <span style={{ fontSize: "10px", lineHeight: "18px" }}>↓</span>
                  </label>
                </div>
              </div>
              <div className="jst-search-bar">
                <span className="jst-search-icon"><Icons.Search /></span>
                <input
                  type="text"
                  placeholder="Filter actions..."
                  className="jst-search-input"
                  value={devtoolsStore.searchQuery}
                  onChange={(e) => devtoolsStore.setSearchQuery(e.target.value)}
                />
              </div>
              <div className="jst-list">
                {devtoolsStore.actions
                  .filter((a: any) => a.name.toLowerCase().includes(devtoolsStore.searchQuery.toLowerCase()))
                  .map((act: any, index: number) => {
                    const isSelected = devtoolsStore.selectedActionIndex === index;
                    return (
                      <div
                        key={act.id + index}
                        className={`jst-list-item ${isSelected ? "selected" : ""}`}
                        onClick={() => devtoolsStore.jumpToStateIndex(index)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "600" }}>
                          <span>{act.name}</span>
                          <span style={{ color: "#64748b" }}>{new Date(act.timestamp).toLocaleTimeString()}</span>
                        </div>
                        {act.path && (
                          <span style={{ fontSize: "9px", color: "#6366f1" }}>{act.path}</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="jst-main-panel">
              <div className="jst-pane-header">Action Inspector</div>
              <div className="jst-detail-panel">
                {devtoolsStore.actions[devtoolsStore.selectedActionIndex] ? (
                  <>
                    <div className="jst-card">
                      <div className="jst-card-title">Action Details</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px" }}>
                        <div>
                          <span style={{ color: "#64748b" }}>Name:</span> <strong>{devtoolsStore.actions[devtoolsStore.selectedActionIndex].name}</strong>
                        </div>
                        {devtoolsStore.actions[devtoolsStore.selectedActionIndex].path && (
                          <div>
                            <span style={{ color: "#64748b" }}>Path:</span> <code style={{ color: "#6366f1" }}>{devtoolsStore.actions[devtoolsStore.selectedActionIndex].path}</code>
                          </div>
                        )}
                        <div>
                          <span style={{ color: "#64748b" }}>Arguments:</span>
                          <pre style={{ margin: "4px 0 0 0", padding: "6px", background: "rgba(0,0,0,0.3)", borderRadius: "4px" }}>
                            {JSON.stringify(devtoolsStore.actions[devtoolsStore.selectedActionIndex].args, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>

                    <div className="jst-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                      <div className="jst-card-title">State Patches during Action</div>
                      <div style={{ flex: 1, overflow: "auto", background: "#06070a", borderRadius: "6px", padding: "8px" }}>
                        {devtoolsStore.actions[devtoolsStore.selectedActionIndex].patches && devtoolsStore.actions[devtoolsStore.selectedActionIndex].patches.length > 0 ? (
                          <JsonTree data={devtoolsStore.actions[devtoolsStore.selectedActionIndex].patches} />
                        ) : (
                          <div style={{ color: "#64748b", padding: "8px", fontSize: "11px" }}>No mutations occurred in this action step (Read-Only View).</div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#64748b" }}>Select an action to inspect its state changes.</div>
                )}
              </div>

              {/* Scrubber timeline */}
              <div className="jst-time-scrubber">
                <span className="jst-badge jst-badge-indigo">
                  Step {devtoolsStore.selectedActionIndex + 1} / {devtoolsStore.actions.length}
                </span>
                <input
                  type="range"
                  min="0"
                  max={devtoolsStore.actions.length - 1}
                  value={devtoolsStore.selectedActionIndex}
                  className="jst-slider"
                  onChange={(e) => devtoolsStore.jumpToStateIndex(Number(e.target.value))}
                />
              </div>
            </div>
          </>
        )}

        {/* 3. PATCHES FEED PANEL */}
        {devtoolsStore.activeTab === "patches" && (
          <>
            <div className="jst-sidebar">
              <div className="jst-pane-header">Patches Log</div>
              <div className="jst-search-bar">
                <span className="jst-search-icon"><Icons.Search /></span>
                <input
                  type="text"
                  placeholder="Search by path..."
                  className="jst-search-input"
                  value={devtoolsStore.patchSearchQuery}
                  onChange={(e) => devtoolsStore.setPatchSearchQuery(e.target.value)}
                />
              </div>
              <div className="jst-list">
                {devtoolsStore.patchesLog
                  .filter((log: any) => log.patch.path.toLowerCase().includes(devtoolsStore.patchSearchQuery.toLowerCase()))
                  .map((log: any) => (
                    <div key={log.id} className="jst-list-item">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className={`jst-badge ${log.patch.op === "add" ? "jst-badge-emerald" : log.patch.op === "replace" ? "jst-badge-indigo" : "jst-badge-rose"}`}>
                          {log.patch.op}
                        </span>
                        <button
                          onClick={() => {
                            if (devtoolsStore.activeStore) {
                              applyPatch(devtoolsStore.activeStore, log.reversePatch);
                            }
                          }}
                          className="jst-nav-tab"
                          style={{ padding: "2px 6px", fontSize: "9px", background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}
                          title="Undo this specific patch operation"
                        >
                          <Icons.Undo /> Undo
                        </button>
                      </div>
                      <div style={{ fontSize: "10px", fontFamily: "monospace", color: "#6366f1", wordBreak: "break-all" }}>
                        {log.patch.path || "/"}
                      </div>
                    </div>
                  ))}
                {devtoolsStore.patchesLog.length === 0 && (
                  <div style={{ padding: "20px", color: "#64748b", fontSize: "11px", textAlign: "center" }}>
                    Mutations will stream here in real-time.
                  </div>
                )}
              </div>
            </div>
            <div className="jst-main-panel">
              <div className="jst-pane-header">Stream Inspector</div>
              <div className="jst-json-container">
                <JsonTree data={devtoolsStore.patchesLog} />
              </div>
            </div>
          </>
        )}

        {/* 4. PERSISTENCE PANEL */}
        {devtoolsStore.activeTab === "persistence" && persistenceManager && (
          <div className="jst-detail-panel">
            <div className="jst-card">
              <div className="jst-card-title">IndexedDB Persistence Manager</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "11px" }}>
                <div>
                  <span style={{ color: "#64748b" }}>Storage Key:</span> <strong>{(persistenceManager as any).key}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Database Name:</span> <strong>{(persistenceManager as any).storage?.dbName || "jotai-state-tree-persistence"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Sync Queue Status:</span>
                  <span className="jst-badge jst-badge-amber" style={{ marginLeft: "8px" }}>
                    Sync Pending
                  </span>
                </div>
              </div>
            </div>

            <div className="jst-card">
              <div className="jst-card-title">Manual Sync Controls</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => persistenceManager.sync()}
                  className="jst-nav-tab"
                  style={{ background: "#6366f1", color: "#fff", cursor: "pointer", border: "none" }}
                >
                  Flush Sync Queue
                </button>
                <button
                  onClick={() => persistenceManager.fetch(true)}
                  className="jst-nav-tab"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#fff", cursor: "pointer", border: "none" }}
                >
                  Force Fetch Revalidate
                </button>
                <button
                  onClick={() => persistenceManager.compact()}
                  className="jst-nav-tab"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#fff", cursor: "pointer", border: "none" }}
                >
                  Compact Storage Queue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. ROUTER PANEL */}
        {devtoolsStore.activeTab === "router" && subRouter && (
          <div className="jst-detail-panel">
            <div className="jst-card">
              <div className="jst-card-title">State Router Info</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px" }}>
                <div>
                  <span style={{ color: "#64748b" }}>Pathname:</span> <strong style={{ color: "#6366f1" }}>{subRouter.pathname}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Active Route:</span> <strong className="jst-badge jst-badge-indigo">{subRouter.currentRouteName || "None"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Action:</span> <strong>{subRouter.action}</strong>
                </div>
              </div>
            </div>

            <div className="jst-card">
              <div className="jst-card-title">Route Simulator</div>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="text"
                  placeholder="Enter pathname (e.g. /settings)..."
                  value={devtoolsStore.navPath}
                  onChange={(e) => devtoolsStore.setNavPath(e.target.value)}
                  style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", padding: "6px 12px", outline: "none", fontSize: "11px" }}
                />
                <button
                  onClick={triggerNavigation}
                  className="jst-nav-tab"
                  style={{ background: "#6366f1", color: "#fff", cursor: "pointer", border: "none", borderRadius: "6px" }}
                >
                  Navigate
                </button>
              </div>
            </div>

            <div className="jst-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="jst-card-title">Route Parameters & State</div>
              <div style={{ flex: 1, overflow: "auto", background: "#06070a", borderRadius: "6px", padding: "8px" }}>
                <JsonTree data={{ params: subRouter.params, query: subRouter.query }} />
              </div>
            </div>
          </div>
        )}

        {/* 6. REGISTRY PANEL */}
        {devtoolsStore.activeTab === "registry" && (
          <div className="jst-detail-panel">
            <div className="jst-card">
              <div className="jst-card-title">Registry Heap & Statistics</div>
              {(() => {
                const stats = getRegistryStats();
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "11px" }}>
                    <div>
                      <span style={{ color: "#64748b" }}>Live Node Count:</span> <strong style={{ color: "#10b981" }}>{stats.liveNodeCount}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b" }}>Stale Node Count:</span> <strong style={{ color: "#ef4444" }}>{stats.staleNodeCount}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b" }}>Registered Types:</span> <strong>{stats.identifierTypeCount}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b" }}>Weak Node Registry:</span> <strong>{stats.nodeRegistrySize}</strong>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="jst-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="jst-card-title">Registered Model Specifications</div>
              <div style={{ flex: 1, overflow: "auto", background: "#06070a", borderRadius: "6px", padding: "8px", fontSize: "11px" }}>
                {(() => {
                  const keys = Array.from(identifierRegistry.keys());
                  if (keys.length === 0) {
                    return <div style={{ color: "#64748b" }}>No typed model schemas are currently registered.</div>;
                  }
                  return <JsonTree data={keys} />;
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export const JotaiStateTreeDevtools: React.ComponentType<DevtoolsProps> = observer((props) => {
  const isProd = typeof process !== "undefined" && process.env.NODE_ENV === "production";
  if (isDev && !isProd) {
    return <JotaiStateTreeDevtoolsImpl {...props} />;
  }
  return null;
});

export function resetDevtoolsStore() {
  if (_devtoolsStore) {
    try {
      (_devtoolsStore as any).stopPolling();
      if ((_devtoolsStore as any)._cleanupResize) {
        (_devtoolsStore as any)._cleanupResize();
      }
      if ((_devtoolsStore as any).playTimer) {
        clearInterval((_devtoolsStore as any).playTimer);
      }
      if ((_devtoolsStore as any).storeDisposers) {
        (_devtoolsStore as any).storeDisposers.forEach((d: any) => d());
      }
    } catch (e) {
      // ignore
    }
    try {
      const { destroy } = require("./index");
      if (isAlive(_devtoolsStore)) {
        destroy(_devtoolsStore);
      }
    } catch (e) {
      // ignore
    }
  }
  _devtoolsStore = DevtoolsModel.create({});
}
