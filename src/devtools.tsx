import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  getSnapshot,
  applySnapshot,
  onSnapshot,
  onPatch,
  onAction,
  applyPatch,
  isAlive,
  getType,
  getPath,
  getMembers,
  getRegistryStats,
  splitJsonPath,
  joinJsonPath,
} from "./index";
import { activePersistenceManagers } from "./persistence";
import { nodeRegistry, identifierRegistry } from "./tree";

export interface DevtoolsProps {
  store?: any;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  initialOpen?: boolean;
}

// Default export is null in production to support tree-shaking
export let JotaiStateTreeDevtools: React.ComponentType<DevtoolsProps> = () => null;

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

if (isDev) {
  // SVG Icons
  const Icons = {
    Tree: () => (
      <svg className="jst-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v8M12 10a4 4 0 0 1 4 4v4M12 10a4 4 0 0 0-4 4v4M16 18h2M8 18H6" strokeLinecap="round" />
        <circle cx="12" cy="10" r="2" fill="currentColor" />
        <circle cx="18" cy="18" r="2" fill="currentColor" />
        <circle cx="6" cy="18" r="2" fill="currentColor" />
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

  // Recursive JSON Tree Component
  const JsonTree: React.FC<{ data: any; label?: string; depth?: number }> = ({ data, label, depth = 0 }) => {
    const [expanded, setExpanded] = useState(depth < 2);

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
        <div onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "8px", color: "#64748b", transform: expanded ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.1s" }}>▶</span>
          {label && <span className="jst-json-key">{label}: </span>}
          <span style={{ color: "#94a3b8", fontSize: "10px" }}>{summary}</span>
        </div>
        {expanded && (
          <div style={{ borderLeft: "1px dashed rgba(255,255,255,0.06)", marginLeft: "4px" }}>
            {keys.map((k) => (
              <JsonTree key={k} label={k} data={data[k]} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Real Implementation Component
  const JotaiStateTreeDevtoolsImpl: React.FC<DevtoolsProps> = ({
    store: propStore,
    position = "bottom-right",
    initialOpen = false,
  }) => {
    const [isOpen, setIsOpen] = useState(initialOpen);

    useEffect(() => {
      setIsOpen(initialOpen);
    }, [initialOpen]);
    const [activeTab, setActiveTab] = useState<"tree" | "actions" | "patches" | "persistence" | "router" | "registry">("tree");
    const [discoveredRoots, setDiscoveredRoots] = useState<any[]>([]);
    const [selectedStoreIndex, setSelectedStoreIndex] = useState(0);
    const [dock, setDock] = useState<"bottom" | "right">("bottom");
    const [maximized, setMaximized] = useState(false);
    const [height, setHeight] = useState(380);
    const [width, setWidth] = useState(600);
    const isResizingRef = useRef(false);

    // Sub-elements selection state
    const [selectedPath, setSelectedPath] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [patchSearchQuery, setPatchSearchQuery] = useState("");
    const [navPath, setNavPath] = useState("");

    // Selected Store Action Logs
    const [actions, setActions] = useState<any[]>([
      { id: "init", name: "@@INIT", path: "", args: [], timestamp: Date.now(), snapshot: null, patches: [] }
    ]);
    const [selectedActionIndex, setSelectedActionIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const playTimerRef = useRef<any>(null);
    const isTimeTravelingRef = useRef(false);

    // Active Store
    const activeStore = useMemo(() => {
      if (propStore) return propStore;
      if (discoveredRoots.length > 0 && selectedStoreIndex < discoveredRoots.length) {
        return discoveredRoots[selectedStoreIndex];
      }
      return null;
    }, [propStore, discoveredRoots, selectedStoreIndex]);

    // Active store snapshot
    const [activeSnapshot, setActiveSnapshot] = useState<any>(null);
    const [patchesLog, setPatchesLog] = useState<any[]>([]);

    // Discovers stores dynamically
    const updateRoots = useCallback(() => {
      const rootsMap = new Set<any>();
      for (const entry of nodeRegistry.values()) {
        const node = entry.node.deref();
        if (node && node.$isAlive && !node.$parent) {
          const inst = node.getInstance();
          if (inst) rootsMap.add(inst);
        }
      }
      const arrayRoots = Array.from(rootsMap);
      setDiscoveredRoots(arrayRoots);
    }, []);

    // Polling discovery
    useEffect(() => {
      updateRoots();
      const interval = setInterval(updateRoots, 1500);
      return () => clearInterval(interval);
    }, [updateRoots]);

    // Track active store changes and reset actions/snapshots
    useEffect(() => {
      if (!activeStore) return;

      const snap = getSnapshot(activeStore);
      setActiveSnapshot(snap);

      // Re-initialize actions log
      setActions([
        {
          id: "init",
          name: "@@INIT",
          path: "",
          args: [],
          timestamp: Date.now(),
          snapshot: snap,
          patches: []
        }
      ]);
      setSelectedActionIndex(0);
      setPatchesLog([]);

      // 1. Subscribe to Snapshots
      const disposeSnap = onSnapshot(activeStore, (nextSnap) => {
        if (!isTimeTravelingRef.current) {
          setActiveSnapshot(nextSnap);
        }
      });

      // 2. Subscribe to Patches
      const disposePatches = onPatch(activeStore, (patch, reversePatch) => {
        if (isTimeTravelingRef.current) return;

        const logEntry = {
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toLocaleTimeString(),
          patch,
          reversePatch
        };

        setPatchesLog((prev) => [logEntry, ...prev].slice(0, 100));

        // Aggregate patches into the latest action
        setActions((prev) => {
          if (prev.length <= 1) return prev;
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          copy[lastIdx] = {
            ...copy[lastIdx],
            patches: [...(copy[lastIdx].patches || []), patch],
            snapshot: getSnapshot(activeStore)
          };
          return copy;
        });
      });

      // 3. Subscribe to Actions
      const disposeActions = onAction(activeStore, (call) => {
        if (isTimeTravelingRef.current) return;

        setActions((prev) => {
          const nextIndex = prev.length;
          const newAction = {
            id: Math.random().toString(36).substring(7),
            name: call.name,
            path: call.path,
            args: call.args,
            timestamp: Date.now(),
            snapshot: getSnapshot(activeStore),
            patches: []
          };
          setSelectedActionIndex(nextIndex);
          return [...prev, newAction];
        });
      });

      return () => {
        disposeSnap();
        disposePatches();
        disposeActions();
      };
    }, [activeStore]);

    // Resizing implementation
    const startResize = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      document.body.style.userSelect = "none";
      document.body.style.cursor = dock === "bottom" ? "ns-resize" : "ew-resize";
    }, [dock]);

    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizingRef.current) return;
        if (dock === "bottom") {
          const newHeight = window.innerHeight - e.clientY;
          setHeight(Math.max(180, Math.min(window.innerHeight - 50, newHeight)));
        } else {
          const newWidth = window.innerWidth - e.clientX;
          setWidth(Math.max(250, Math.min(window.innerWidth - 50, newWidth)));
        }
      };

      const handleMouseUp = () => {
        if (isResizingRef.current) {
          isResizingRef.current = false;
          document.body.style.userSelect = "";
          document.body.style.cursor = "";
        }
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }, [dock]);

    // Time travel logic
    const jumpToStateIndex = useCallback((index: number) => {
      if (!activeStore || index < 0 || index >= actions.length) return;
      isTimeTravelingRef.current = true;
      try {
        const targetState = actions[index].snapshot;
        applySnapshot(activeStore, targetState);
        setActiveSnapshot(targetState);
        setSelectedActionIndex(index);
      } finally {
        isTimeTravelingRef.current = false;
      }
    }, [activeStore, actions]);

    // Playback for Time Travel
    const togglePlay = () => {
      if (isPlaying) {
        setIsPlaying(false);
        if (playTimerRef.current) clearInterval(playTimerRef.current);
      } else {
        setIsPlaying(true);
        let currentIdx = selectedActionIndex;
        playTimerRef.current = setInterval(() => {
          currentIdx = (currentIdx + 1) % actions.length;
          jumpToStateIndex(currentIdx);
        }, 1000);
      }
    };

    useEffect(() => {
      return () => {
        if (playTimerRef.current) clearInterval(playTimerRef.current);
      };
    }, []);

    // Find subrouter within current store
    const subRouter = useMemo(() => {
      if (!activeStore) return null;
      // Walk nodeRegistry or traverse fields
      for (const entry of nodeRegistry.values()) {
        const node = entry.node.deref();
        if (node && node.$isAlive && node.$type.name === "RouterModel") {
          // Verify it belongs to active store tree
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
    }, [activeStore]);

    // Active Persistence Manager
    const persistenceManager = useMemo(() => {
      return activeStore ? activePersistenceManagers.get(activeStore) : null;
    }, [activeStore]);

    const [persistenceStatus, setPersistenceStatus] = useState<any>(null);
    useEffect(() => {
      if (!persistenceManager) {
        setPersistenceStatus(null);
        return;
      }
      const store = getSnapshot(activeStore); // trigger
      const statusAtom = (persistenceManager as any).statusAtom;
      const jStore = (activeStore as any).$id ? (activeStore as any) : null;
      // Subscribe to changes in IndexedDB status atom
      const dispose = onSnapshot(activeStore, () => {
        try {
          const globalSt = (global as any).getGlobalStore?.() || (activeStore as any).valueAtom ? (activeStore as any) : null;
          // Simple poll backup as atoms are internal
        } catch {}
      });
      
      const poll = setInterval(() => {
        try {
          const val = getSnapshot(persistenceManager.target); // mock trigger
          // Status updates are captured reactively
        } catch {}
      }, 1000);

      return () => {
        dispose();
        clearInterval(poll);
      };
    }, [persistenceManager, activeStore]);

    // Export/Import history
    const exportHistory = () => {
      const fileData = JSON.stringify(actions, null, 2);
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
            setActions(parsed);
            setSelectedActionIndex(0);
            isTimeTravelingRef.current = true;
            applySnapshot(activeStore, parsed[0].snapshot);
            setActiveSnapshot(parsed[0].snapshot);
            isTimeTravelingRef.current = false;
          }
        } catch (err) {
          alert("Failed to parse JST history file.");
        }
      };
      reader.readAsText(file);
    };

    // Helper: render navigation targets
    const floatingPositionStyles = useMemo(() => {
      switch (position) {
        case "bottom-left": return { bottom: "24px", left: "24px" };
        case "top-left": return { top: "24px", left: "24px" };
        case "top-right": return { top: "24px", right: "24px" };
        default: return { bottom: "24px", right: "24px" };
      }
    }, [position]);

    const panelPositionStyles = useMemo(() => {
      if (maximized) return {};
      if (dock === "bottom") {
        return { bottom: 0, left: 0, right: 0, height: `${height}px` };
      } else {
        return { top: 0, bottom: 0, right: 0, width: `${width}px` };
      }
    }, [dock, height, width, maximized]);

    // CSS styling injector
    useEffect(() => {
      const styleId = "jst-devtools-styles";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = cssStyles;
        document.head.appendChild(style);
      }
    }, []);

    // Navigation router helpers
    const triggerNavigation = () => {
      if (subRouter && navPath) {
        subRouter.push(navPath);
      }
    };

    // State Tree rendering walker helper
    const renderStateTreeNodes = (node: any, path: string = ""): React.ReactNode => {
      if (!node || !node.$isAlive) return null;
      const nodePath = node.$path || "/";
      const name = node.$type.name || "AnonymousNode";
      const isSelected = selectedPath === nodePath;
      const isExpanded = true; // Simple node traversal
      
      return (
        <div key={node.$id} className="jst-tree-node">
          <div 
            className={`jst-tree-label ${isSelected ? "selected" : ""}`}
            onClick={() => {
              setSelectedPath(nodePath);
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

    if (!isOpen) {
      return (
        <button
          className="jst-devtools-trigger"
          style={floatingPositionStyles}
          onClick={() => setIsOpen(true)}
          title="Open Jotai State Tree DevTools"
        >
          <Icons.Tree />
          {discoveredRoots.length > 0 && (
            <span className="jst-devtools-badge">{discoveredRoots.length}</span>
          )}
        </button>
      );
    }

    return (
      <div 
        className={`jst-panel ${dock} ${maximized ? "maximized" : ""}`}
        style={panelPositionStyles}
      >
        {/* Resize handlers */}
        {!maximized && dock === "bottom" && (
          <div className="jst-resizer-bottom" onMouseDown={startResize} />
        )}
        {!maximized && dock === "right" && (
          <div className="jst-resizer-right" onMouseDown={startResize} />
        )}

        {/* Devtools Header */}
        <div className="jst-header">
          <div className="jst-title-section">
            <Icons.Tree />
            <span className="jst-logo">JOTAI STATE TREE</span>
            {discoveredRoots.length > 0 ? (
              <select
                className="jst-select-store"
                value={selectedStoreIndex}
                onChange={(e) => setSelectedStoreIndex(Number(e.target.value))}
              >
                {discoveredRoots.map((root, idx) => {
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
              onClick={() => setDock(dock === "bottom" ? "right" : "bottom")}
              title={dock === "bottom" ? "Dock to Right" : "Dock to Bottom"}
            >
              {dock === "bottom" ? <Icons.DockRight /> : <Icons.DockBottom />}
            </button>
            <button
              className="jst-control-btn"
              onClick={() => setMaximized(!maximized)}
              title={maximized ? "Minimize Panel" : "Maximize Panel"}
            >
              {maximized ? <Icons.Minimize /> : <Icons.Maximize />}
            </button>
            <button
              className="jst-control-btn"
              onClick={() => setIsOpen(false)}
              title="Close DevTools"
            >
              <Icons.Close />
            </button>
          </div>
        </div>

        {/* Navbar tabs */}
        <div className="jst-navbar">
          <div className={`jst-nav-item ${activeTab === "tree" ? "active" : ""}`} onClick={() => setActiveTab("tree")}>
            <Icons.Tree /> State Tree
          </div>
          <div className={`jst-nav-item ${activeTab === "actions" ? "active" : ""}`} onClick={() => setActiveTab("actions")}>
            <Icons.History /> Actions Timeline
          </div>
          <div className={`jst-nav-item ${activeTab === "patches" ? "active" : ""}`} onClick={() => setActiveTab("patches")}>
            <Icons.Patches /> Patches Feed
          </div>
          {persistenceManager && (
            <div className={`jst-nav-item ${activeTab === "persistence" ? "active" : ""}`} onClick={() => setActiveTab("persistence")}>
              <Icons.Database /> Persistence
            </div>
          )}
          {subRouter && (
            <div className={`jst-nav-item ${activeTab === "router" ? "active" : ""}`} onClick={() => setActiveTab("router")}>
              <Icons.Router /> Router
            </div>
          )}
          <div className={`jst-nav-item ${activeTab === "registry" ? "active" : ""}`} onClick={() => setActiveTab("registry")}>
            <Icons.Registry /> Registry
          </div>
        </div>

        {/* Tabs Panels */}
        <div className="jst-content">
          {/* 1. STATE TREE PANEL */}
          {activeTab === "tree" && (
            <>
              <div className="jst-sidebar">
                <div className="jst-pane-header">Tree Nodes</div>
                <div className="jst-list" style={{ padding: "8px" }}>
                  {activeStore && (activeStore as any).$treenode ? (
                    renderStateTreeNodes((activeStore as any).$treenode)
                  ) : (
                    <div style={{ padding: "16px", color: "#64748b", fontSize: "11px" }}>No stores found. Make sure a jotai-state-tree is instantiated.</div>
                  )}
                </div>
              </div>
              <div className="jst-main-panel">
                <div className="jst-pane-header">
                  <span>Node Details: {selectedPath || "/"}</span>
                  {activeSnapshot && (
                    <button
                      className="jst-nav-tab"
                      style={{ border: "1px solid rgba(255,255,255,0.1)", background: "transparent", cursor: "pointer" }}
                      onClick={() => {
                        let subSnap = activeSnapshot;
                        if (selectedPath) {
                          const parts = selectedPath.split("/").filter(Boolean);
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
                  {activeSnapshot ? (
                    (() => {
                      let subSnap = activeSnapshot;
                      if (selectedPath) {
                        const parts = selectedPath.split("/").filter(Boolean);
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
          {activeTab === "actions" && (
            <>
              <div className="jst-sidebar">
                <div className="jst-pane-header">
                  <span>Timeline</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button className="jst-control-btn" style={{ height: "18px" }} onClick={togglePlay} title={isPlaying ? "Pause Playback" : "Play Playback"}>
                      {isPlaying ? <Icons.Pause /> : <Icons.Play />}
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
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="jst-list">
                  {actions
                    .filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((act, index) => {
                      const isSelected = selectedActionIndex === index;
                      return (
                        <div
                          key={act.id + index}
                          className={`jst-list-item ${isSelected ? "selected" : ""}`}
                          onClick={() => jumpToStateIndex(index)}
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
                  {actions[selectedActionIndex] ? (
                    <>
                      <div className="jst-card">
                        <div className="jst-card-title">Action Details</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px" }}>
                          <div>
                            <span style={{ color: "#64748b" }}>Name:</span> <strong>{actions[selectedActionIndex].name}</strong>
                          </div>
                          {actions[selectedActionIndex].path && (
                            <div>
                              <span style={{ color: "#64748b" }}>Path:</span> <code style={{ color: "#6366f1" }}>{actions[selectedActionIndex].path}</code>
                            </div>
                          )}
                          <div>
                            <span style={{ color: "#64748b" }}>Arguments:</span>
                            <pre style={{ margin: "4px 0 0 0", padding: "6px", background: "rgba(0,0,0,0.3)", borderRadius: "4px" }}>
                              {JSON.stringify(actions[selectedActionIndex].args, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>

                      <div className="jst-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                        <div className="jst-card-title">State Patches during Action</div>
                        <div style={{ flex: 1, overflow: "auto", background: "#06070a", borderRadius: "6px", padding: "8px" }}>
                          {actions[selectedActionIndex].patches && actions[selectedActionIndex].patches.length > 0 ? (
                            <JsonTree data={actions[selectedActionIndex].patches} />
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
                    Step {selectedActionIndex + 1} / {actions.length}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={actions.length - 1}
                    value={selectedActionIndex}
                    className="jst-slider"
                    onChange={(e) => jumpToStateIndex(Number(e.target.value))}
                  />
                </div>
              </div>
            </>
          )}

          {/* 3. PATCHES FEED PANEL */}
          {activeTab === "patches" && (
            <>
              <div className="jst-sidebar">
                <div className="jst-pane-header">Patches Log</div>
                <div className="jst-search-bar">
                  <span className="jst-search-icon"><Icons.Search /></span>
                  <input
                    type="text"
                    placeholder="Search by path..."
                    className="jst-search-input"
                    value={patchSearchQuery}
                    onChange={(e) => setPatchSearchQuery(e.target.value)}
                  />
                </div>
                <div className="jst-list">
                  {patchesLog
                    .filter((log) => log.patch.path.toLowerCase().includes(patchSearchQuery.toLowerCase()))
                    .map((log) => (
                      <div key={log.id} className="jst-list-item">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className={`jst-badge ${log.patch.op === "add" ? "jst-badge-emerald" : log.patch.op === "replace" ? "jst-badge-indigo" : "jst-badge-rose"}`}>
                            {log.patch.op}
                          </span>
                          <button
                            onClick={() => {
                              if (activeStore) {
                                applyPatch(activeStore, log.reversePatch);
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
                  {patchesLog.length === 0 && (
                    <div style={{ padding: "20px", color: "#64748b", fontSize: "11px", textAlign: "center" }}>
                      Mutations will stream here in real-time.
                    </div>
                  )}
                </div>
              </div>
              <div className="jst-main-panel">
                <div className="jst-pane-header">Stream Inspector</div>
                <div className="jst-json-container">
                  <JsonTree data={patchesLog} />
                </div>
              </div>
            </>
          )}

          {/* 4. PERSISTENCE PANEL */}
          {activeTab === "persistence" && persistenceManager && (
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
          {activeTab === "router" && subRouter && (
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
                    value={navPath}
                    onChange={(e) => setNavPath(e.target.value)}
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
          {activeTab === "registry" && (
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
  };

  JotaiStateTreeDevtools = JotaiStateTreeDevtoolsImpl;
}
