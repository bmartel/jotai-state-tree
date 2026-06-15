/**
 * Undo/Redo Manager for jotai-state-tree
 * Provides time-travel debugging capabilities using Jotai atoms
 */

import { atom, type WritableAtom, type PrimitiveAtom } from 'jotai';
import type { IDisposer, IJsonPatch, IReversibleJsonPatch } from './types';
import {
  getStateTreeNode,
  applyPatch,
  onPatch,
  getSnapshot,
  applySnapshot,
  onAction,
  isActionRunning,
  getCurrentAction,
  getGlobalStore,
  onLifecycleChange,
} from './tree';

// ============================================================================
// Types
// ============================================================================

export interface IUndoManagerOptions {
  /** Maximum number of history entries to keep */
  maxHistoryLength?: number;
  /** Whether to group rapid changes together */
  groupByTime?: boolean;
  /** Time window for grouping changes (ms) */
  groupingWindow?: number;
}

export interface IHistoryEntry {
  /** Patches to apply to undo this entry */
  patches: IReversibleJsonPatch[];
  /** Patches to apply to redo this entry */
  inversePatches: IReversibleJsonPatch[];
  /** Timestamp when this entry was created */
  timestamp: number;
  /** Snapshot of the target after applying inversePatches (internal/optional) */
  snapshot?: unknown;
}

export interface IUndoManager {
  /** Whether there are entries that can be undone */
  readonly canUndo: boolean;
  /** Whether there are entries that can be redone */
  readonly canRedo: boolean;
  /** Number of undo entries available */
  readonly undoLevels: number;
  /** Number of redo entries available */
  readonly redoLevels: number;
  /** The full history */
  readonly history: IHistoryEntry[];
  /** Current position in history */
  readonly historyIndex: number;
  /** Undo the last change */
  undo(): void;
  /** Redo the last undone change */
  redo(): void;
  /** Clear all history */
  clear(): void;
  /** Start grouping changes */
  startGroup(): void;
  /** End grouping changes */
  endGroup(): void;
  /** Execute a function without recording history */
  withoutUndo<T>(fn: () => T): T;
  /** Stop tracking changes */
  dispose(): void;
}

export interface ITimeTravelManager {
  /** Current snapshot index */
  readonly currentIndex: number;
  /** Total number of snapshots */
  readonly snapshotCount: number;
  /** Whether we can go back */
  readonly canGoBack: boolean;
  /** Whether we can go forward */
  readonly canGoForward: boolean;
  /** Record the current snapshot */
  record(): void;
  /** Go back to previous snapshot */
  goBack(): void;
  /** Go forward to next snapshot */
  goForward(): void;
  /** Go to a specific snapshot index */
  goTo(index: number): void;
  /** Get snapshot at index */
  getSnapshot(index: number): unknown;
  /** Clear all snapshots */
  clear(): void;
  /** Dispose and clean up */
  dispose(): void;
}

export interface IHistoryState {
  entries: IHistoryEntry[];
  currentIndex: number; // Pointer into entries. -1 represents the initial state.
  initialSnapshot: unknown; // The snapshot before any changes
}

// ============================================================================
// HistoryTracker & Registry
// ============================================================================

export const historyTrackersRegistry = new WeakMap<any, HistoryTracker>();

export class HistoryTracker {
  readonly target: unknown;
  readonly historyAtom: PrimitiveAtom<IHistoryState>;

  // Settings
  maxHistoryLength: number;
  groupByTime: boolean;
  groupingWindow: number;

  // Transient state
  autoRecord: boolean = false;
  isApplyingHistory: boolean = false;
  skipRecording: boolean = false;
  grouping: boolean = false;
  actionGrouping: boolean = false;
  currentGroup: IReversibleJsonPatch[] = [];
  currentGroupInverse: IReversibleJsonPatch[] = [];
  lastChangeTime: number = 0;

  disposer: IDisposer | null = null;
  actionDisposer: IDisposer | null = null;
  lifecycleDisposer: IDisposer | null = null;

  constructor(
    target: unknown,
    options: IUndoManagerOptions & { maxSnapshots?: number; autoRecord?: boolean } = {}
  ) {
    this.target = target;
    this.maxHistoryLength = options.maxHistoryLength ?? options.maxSnapshots ?? 100;
    this.groupByTime = options.groupByTime ?? false;
    this.groupingWindow = options.groupingWindow ?? 200;
    this.autoRecord = options.autoRecord ?? false;

    const initialSnapshot = getSnapshot(target);
    this.historyAtom = atom<IHistoryState>({
      entries: [],
      currentIndex: -1,
      initialSnapshot,
    });

    // Subscribe to patches
    this.disposer = onPatch(target, (patch, reversePatch) => {
      this.recordPatch(patch, reversePatch);
    });

    // Subscribe to actions to end grouping synchronously on top-level action completion
    this.actionDisposer = onAction(target, () => {
      const current = getCurrentAction();
      if (current && !current.parent) {
        if (this.actionGrouping) {
          this.endGroup();
        }
      }
    });

    // Subscribe to lifecycle changes to auto-dispose
    const node = getStateTreeNode(target);
    this.lifecycleDisposer = onLifecycleChange(node, (isAlive) => {
      if (!isAlive) {
        this.dispose();
      }
    });
  }

  private recordPatch(patch: IJsonPatch, reversePatch: IReversibleJsonPatch): void {
    if (!this.autoRecord) {
      return;
    }
    if (this.isApplyingHistory || this.skipRecording) {
      return;
    }
    const node = getStateTreeNode(this.target);
    if (node.getRoot().$isApplyingHistory) {
      return;
    }

    const store = getGlobalStore();
    const now = Date.now();

    if (isActionRunning() && !this.grouping) {
      this.grouping = true;
      this.actionGrouping = true;
      this.currentGroup = [];
      this.currentGroupInverse = [];
      Promise.resolve().then(() => {
        if (this.actionGrouping) {
          this.endGroup();
        }
      });
    }

    if (this.grouping) {
      this.currentGroup.push(reversePatch);
      this.currentGroupInverse.push({ ...patch } as IReversibleJsonPatch);
      return;
    }

    store.set(this.historyAtom, (prev: IHistoryState) => {
      // Truncate future entries if we were in the middle of history
      let entries = prev.currentIndex < prev.entries.length - 1
        ? prev.entries.slice(0, prev.currentIndex + 1)
        : [...prev.entries];

      // Check if we should group with previous entry
      if (
        this.groupByTime &&
        entries.length > 0 &&
        now - this.lastChangeTime < this.groupingWindow &&
        prev.currentIndex === prev.entries.length - 1
      ) {
        const lastEntry = { ...entries[entries.length - 1] };
        lastEntry.patches = [...lastEntry.patches, reversePatch];
        lastEntry.inversePatches = [...lastEntry.inversePatches, { ...patch } as IReversibleJsonPatch];
        lastEntry.timestamp = now;
        lastEntry.snapshot = getSnapshot(this.target);
        entries[entries.length - 1] = lastEntry;

        this.lastChangeTime = now;
        return {
          ...prev,
          entries,
        };
      } else {
        const newEntry: IHistoryEntry = {
          patches: [reversePatch],
          inversePatches: [{ ...patch } as IReversibleJsonPatch],
          timestamp: now,
          snapshot: getSnapshot(this.target),
        };

        entries.push(newEntry);
        let newIndex = entries.length - 1;

        // Trim history if needed
        if (entries.length > this.maxHistoryLength) {
          const excess = entries.length - this.maxHistoryLength;
          entries = entries.slice(excess);
          newIndex -= excess;
        }

        this.lastChangeTime = now;
        return {
          ...prev,
          entries,
          currentIndex: newIndex,
        };
      }
    });
  }

  undo(): void {
    const store = getGlobalStore();
    const state = store.get(this.historyAtom);
    if (state.currentIndex < 0) {
      return;
    }

    const node = getStateTreeNode(this.target);
    const rootNode = node.getRoot();
    const wasApplying = rootNode.$isApplyingHistory;
    rootNode.$isApplyingHistory = true;
    this.isApplyingHistory = true;

    try {
      const entry = state.entries[state.currentIndex];
      // Apply patches in reverse order
      for (let i = entry.patches.length - 1; i >= 0; i--) {
        applyPatch(this.target, entry.patches[i]);
      }

      store.set(this.historyAtom, (prev: IHistoryState) => ({
        ...prev,
        currentIndex: prev.currentIndex - 1,
      }));
    } finally {
      this.isApplyingHistory = false;
      rootNode.$isApplyingHistory = wasApplying;
    }
  }

  redo(): void {
    const store = getGlobalStore();
    const state = store.get(this.historyAtom);
    if (state.currentIndex >= state.entries.length - 1) {
      return;
    }

    const node = getStateTreeNode(this.target);
    const rootNode = node.getRoot();
    const wasApplying = rootNode.$isApplyingHistory;
    rootNode.$isApplyingHistory = true;
    this.isApplyingHistory = true;

    try {
      const nextIndex = state.currentIndex + 1;
      const entry = state.entries[nextIndex];
      // Apply forward patches in order
      for (const patch of entry.inversePatches) {
        applyPatch(this.target, patch);
      }

      store.set(this.historyAtom, (prev: IHistoryState) => ({
        ...prev,
        currentIndex: nextIndex,
      }));
    } finally {
      this.isApplyingHistory = false;
      rootNode.$isApplyingHistory = wasApplying;
    }
  }

  goTo(index: number): void {
    const store = getGlobalStore();
    const state = store.get(this.historyAtom);
    const maxIdx = state.entries.length;
    if (index < 0 || index > maxIdx) {
      return;
    }

    const node = getStateTreeNode(this.target);
    const rootNode = node.getRoot();
    const wasApplying = rootNode.$isApplyingHistory;
    rootNode.$isApplyingHistory = true;
    this.isApplyingHistory = true;

    try {
      const targetSnapshot = index === 0 ? state.initialSnapshot : state.entries[index - 1].snapshot;
      applySnapshot(this.target, targetSnapshot);

      store.set(this.historyAtom, (prev: IHistoryState) => ({
        ...prev,
        currentIndex: index - 1,
      }));
    } finally {
      this.isApplyingHistory = false;
      rootNode.$isApplyingHistory = wasApplying;
    }
  }

  goBack(): void {
    const store = getGlobalStore();
    const state = store.get(this.historyAtom);
    const currentSnapshotIndex = state.currentIndex + 1;
    if (currentSnapshotIndex > 0) {
      this.goTo(currentSnapshotIndex - 1);
    }
  }

  goForward(): void {
    const store = getGlobalStore();
    const state = store.get(this.historyAtom);
    const currentSnapshotIndex = state.currentIndex + 1;
    if (currentSnapshotIndex < state.entries.length) {
      this.goTo(currentSnapshotIndex + 1);
    }
  }

  record(): void {
    const store = getGlobalStore();
    const state = store.get(this.historyAtom);

    // Truncate future entries if we were in the middle of history
    let entries = state.currentIndex < state.entries.length - 1
      ? state.entries.slice(0, state.currentIndex + 1)
      : [...state.entries];

    const newEntry: IHistoryEntry = {
      patches: [],
      inversePatches: [],
      timestamp: Date.now(),
      snapshot: getSnapshot(this.target),
    };

    entries.push(newEntry);
    let newIndex = entries.length - 1;

    // Trim history if needed
    if (entries.length > this.maxHistoryLength) {
      const excess = entries.length - this.maxHistoryLength;
      entries = entries.slice(excess);
      newIndex -= excess;
    }

    store.set(this.historyAtom, {
      ...state,
      entries,
      currentIndex: newIndex,
    });
  }

  getSnapshot(index: number): unknown {
    const store = getGlobalStore();
    const state = store.get(this.historyAtom);
    if (index < 0 || index > state.entries.length) {
      throw new Error(`[jotai-state-tree] Invalid snapshot index: ${index}`);
    }
    return index === 0 ? state.initialSnapshot : state.entries[index - 1].snapshot;
  }

  clear(): void {
    const store = getGlobalStore();
    store.set(this.historyAtom, {
      entries: [],
      currentIndex: -1,
      initialSnapshot: getSnapshot(this.target),
    });
    this.currentGroup = [];
    this.currentGroupInverse = [];
    this.grouping = false;
    this.actionGrouping = false;
  }

  startGroup(): void {
    this.grouping = true;
    this.actionGrouping = false;
    this.currentGroup = [];
    this.currentGroupInverse = [];
  }

  endGroup(): void {
    if (!this.grouping) {
      return;
    }
    this.grouping = false;
    this.actionGrouping = false;

    if (this.currentGroup.length > 0) {
      const store = getGlobalStore();
      store.set(this.historyAtom, (prev: IHistoryState) => {
        let entries = prev.currentIndex < prev.entries.length - 1
          ? prev.entries.slice(0, prev.currentIndex + 1)
          : [...prev.entries];

        const newEntry: IHistoryEntry = {
          patches: [...this.currentGroup],
          inversePatches: [...this.currentGroupInverse],
          timestamp: Date.now(),
          snapshot: getSnapshot(this.target),
        };

        entries.push(newEntry);
        let newIndex = entries.length - 1;

        if (entries.length > this.maxHistoryLength) {
          const excess = entries.length - this.maxHistoryLength;
          entries = entries.slice(excess);
          newIndex -= excess;
        }

        return {
          ...prev,
          entries,
          currentIndex: newIndex,
        };
      });
    }
    this.currentGroup = [];
    this.currentGroupInverse = [];
  }

  withoutUndo<T>(fn: () => T): T {
    this.skipRecording = true;
    try {
      return fn();
    } finally {
      this.skipRecording = false;
    }
  }

  dispose(): void {
    historyTrackersRegistry.delete(this.target);
    if (this.disposer) {
      this.disposer();
      this.disposer = null;
    }
    if (this.actionDisposer) {
      this.actionDisposer();
      this.actionDisposer = null;
    }
    if (this.lifecycleDisposer) {
      this.lifecycleDisposer();
      this.lifecycleDisposer = null;
    }
  }
}

export function getOrCreateHistoryTracker(
  target: unknown,
  options: IUndoManagerOptions & { maxSnapshots?: number; autoRecord?: boolean } = {}
): HistoryTracker {
  let tracker = historyTrackersRegistry.get(target);
  if (!tracker) {
    tracker = new HistoryTracker(target, options);
    historyTrackersRegistry.set(target, tracker);
  }
  return tracker;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an undo manager for a state tree
 */
export function createUndoManager(
  target: unknown,
  options?: IUndoManagerOptions
): IUndoManager {
  const tracker = getOrCreateHistoryTracker(target, options);
  tracker.autoRecord = true; // UndoManager always auto-records
  const store = getGlobalStore();

  return {
    get canUndo() {
      const state = store.get(tracker.historyAtom);
      return state.currentIndex >= 0;
    },
    get canRedo() {
      const state = store.get(tracker.historyAtom);
      return state.currentIndex < state.entries.length - 1;
    },
    get undoLevels() {
      const state = store.get(tracker.historyAtom);
      return state.currentIndex + 1;
    },
    get redoLevels() {
      const state = store.get(tracker.historyAtom);
      return state.entries.length - state.currentIndex - 1;
    },
    get history() {
      const state = store.get(tracker.historyAtom);
      return state.entries;
    },
    get historyIndex() {
      const state = store.get(tracker.historyAtom);
      return state.currentIndex;
    },
    undo() {
      tracker.undo();
    },
    redo() {
      tracker.redo();
    },
    clear() {
      tracker.clear();
    },
    startGroup() {
      tracker.startGroup();
    },
    endGroup() {
      tracker.endGroup();
    },
    withoutUndo<T>(fn: () => T): T {
      return tracker.withoutUndo(fn);
    },
    dispose() {
      tracker.dispose();
    },
  };
}

/**
 * Create a time travel manager for snapshot-based history
 */
export function createTimeTravelManager(
  target: unknown,
  options?: {
    maxSnapshots?: number;
    autoRecord?: boolean;
  }
): ITimeTravelManager {
  const tracker = getOrCreateHistoryTracker(target, options);
  if (options?.autoRecord) {
    tracker.autoRecord = true;
  }
  const store = getGlobalStore();

  return {
    get currentIndex() {
      const state = store.get(tracker.historyAtom);
      return state.currentIndex + 1;
    },
    get snapshotCount() {
      const state = store.get(tracker.historyAtom);
      return state.entries.length + 1;
    },
    get canGoBack() {
      const state = store.get(tracker.historyAtom);
      return state.currentIndex + 1 > 0;
    },
    get canGoForward() {
      const state = store.get(tracker.historyAtom);
      return state.currentIndex + 1 < state.entries.length + 1 - 1;
    },
    record() {
      tracker.record();
    },
    goBack() {
      tracker.goBack();
    },
    goForward() {
      tracker.goForward();
    },
    goTo(index: number) {
      tracker.goTo(index);
    },
    getSnapshot(index: number) {
      return tracker.getSnapshot(index);
    },
    clear() {
      tracker.clear();
    },
    dispose() {
      tracker.dispose();
    },
  };
}

// ============================================================================
// Action-based Recording
// ============================================================================

export interface IActionRecording {
  /** Name of the action */
  name: string;
  /** Path to the node where action was called */
  path: string;
  /** Arguments passed to the action */
  args: unknown[];
  /** Timestamp */
  timestamp: number;
}

export interface IActionRecorder {
  /** Whether currently recording */
  readonly isRecording: boolean;
  /** All recorded actions */
  readonly actions: IActionRecording[];
  /** Start recording */
  start(): void;
  /** Stop recording */
  stop(): void;
  /** Clear recorded actions */
  clear(): void;
  /** Replay actions on a target */
  replay(target: unknown): void;
  /** Export actions as JSON */
  export(): string;
  /** Import actions from JSON */
  import(json: string): void;
  /** Dispose and clean up */
  dispose(): void;
}

class ActionRecorder implements IActionRecorder {
  private target: unknown;
  private recording: boolean = false;
  private recordedActions: IActionRecording[] = [];
  private disposer: IDisposer | null = null;

  constructor(target: unknown) {
    this.target = target;
  }

  get isRecording(): boolean {
    return this.recording;
  }

  get actions(): IActionRecording[] {
    return [...this.recordedActions];
  }

  start(): void {
    if (this.recording) return;
    this.recording = true;

    this.disposer = onAction(this.target, (action: { name: string; path: string; args: unknown[] }) => {
      this.recordedActions.push({
        ...action,
        timestamp: Date.now(),
      });
    });
  }

  stop(): void {
    this.recording = false;
    if (this.disposer) {
      this.disposer();
      this.disposer = null;
    }
  }

  clear(): void {
    this.recordedActions = [];
  }

  replay(target: unknown): void {
    const node = getStateTreeNode(target);

    for (const action of this.recordedActions) {
      // Navigate to the correct node
      let currentNode = node;
      if (action.path) {
        const parts = action.path.split('/').filter(Boolean);
        for (const part of parts) {
          const child = currentNode.getChild(part);
          if (!child) {
            console.warn(`[jotai-state-tree] Could not find path: ${action.path}`);
            continue;
          }
          currentNode = child;
        }
      }

      const instance = currentNode.getInstance() as Record<string, Function>;
      if (typeof instance[action.name] === 'function') {
        instance[action.name](...action.args);
      }
    }
  }

  export(): string {
    return JSON.stringify(this.recordedActions, null, 2);
  }

  import(json: string): void {
    try {
      const actions = JSON.parse(json);
      if (Array.isArray(actions)) {
        this.recordedActions = actions;
      }
    } catch (e) {
      throw new Error(`[jotai-state-tree] Failed to import actions: ${e}`);
    }
  }

  dispose(): void {
    this.stop();
    this.clear();
  }
}

/**
 * Create an action recorder for debugging and testing
 */
export function createActionRecorder(target: unknown): IActionRecorder {
  return new ActionRecorder(target);
}
