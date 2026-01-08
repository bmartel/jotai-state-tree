/**
 * Undo/Redo Manager for jotai-state-tree
 * Provides time-travel debugging capabilities
 */

import type { IDisposer, IJsonPatch, IReversibleJsonPatch } from './types';
import { getStateTreeNode, applyPatch, onPatch, getSnapshot, applySnapshot } from './tree';

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

// ============================================================================
// UndoManager Implementation
// ============================================================================

class UndoManager implements IUndoManager {
  private target: unknown;
  private options: Required<IUndoManagerOptions>;
  private historyEntries: IHistoryEntry[] = [];
  private currentIndex: number = -1;
  private isUndoing: boolean = false;
  private isRedoing: boolean = false;
  private skipRecording: boolean = false;
  private grouping: boolean = false;
  private currentGroup: IReversibleJsonPatch[] = [];
  private currentGroupInverse: IReversibleJsonPatch[] = [];
  private disposer: IDisposer | null = null;
  private lastChangeTime: number = 0;

  constructor(target: unknown, options: IUndoManagerOptions = {}) {
    this.target = target;
    this.options = {
      maxHistoryLength: options.maxHistoryLength ?? 100,
      groupByTime: options.groupByTime ?? false,
      groupingWindow: options.groupingWindow ?? 200,
    };

    // Subscribe to patches
    this.disposer = onPatch(target, (patch, reversePatch) => {
      this.recordPatch(patch, reversePatch);
    });
  }

  get canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  get canRedo(): boolean {
    return this.currentIndex < this.historyEntries.length - 1;
  }

  get undoLevels(): number {
    return this.currentIndex + 1;
  }

  get redoLevels(): number {
    return this.historyEntries.length - this.currentIndex - 1;
  }

  get history(): IHistoryEntry[] {
    return [...this.historyEntries];
  }

  get historyIndex(): number {
    return this.currentIndex;
  }

  private recordPatch(patch: IJsonPatch, reversePatch: IReversibleJsonPatch): void {
    if (this.isUndoing || this.isRedoing || this.skipRecording) {
      return;
    }

    const now = Date.now();

    if (this.grouping) {
      // Add to current group
      this.currentGroup.push(reversePatch);
      this.currentGroupInverse.unshift({ ...patch } as IReversibleJsonPatch);
      return;
    }

    // Check if we should group with previous entry
    if (
      this.options.groupByTime &&
      this.historyEntries.length > 0 &&
      now - this.lastChangeTime < this.options.groupingWindow &&
      this.currentIndex === this.historyEntries.length - 1
    ) {
      // Add to the last entry
      const lastEntry = this.historyEntries[this.currentIndex];
      lastEntry.patches.push(reversePatch);
      lastEntry.inversePatches.unshift({ ...patch } as IReversibleJsonPatch);
      lastEntry.timestamp = now;
    } else {
      // Remove any redo entries
      if (this.currentIndex < this.historyEntries.length - 1) {
        this.historyEntries.splice(this.currentIndex + 1);
      }

      // Add new entry
      this.historyEntries.push({
        patches: [reversePatch],
        inversePatches: [{ ...patch } as IReversibleJsonPatch],
        timestamp: now,
      });
      this.currentIndex++;

      // Trim history if needed
      if (this.historyEntries.length > this.options.maxHistoryLength) {
        const excess = this.historyEntries.length - this.options.maxHistoryLength;
        this.historyEntries.splice(0, excess);
        this.currentIndex -= excess;
      }
    }

    this.lastChangeTime = now;
  }

  undo(): void {
    if (!this.canUndo) {
      return;
    }

    this.isUndoing = true;
    try {
      const entry = this.historyEntries[this.currentIndex];
      // Apply patches in reverse order
      for (let i = entry.patches.length - 1; i >= 0; i--) {
        applyPatch(this.target, entry.patches[i]);
      }
      this.currentIndex--;
    } finally {
      this.isUndoing = false;
    }
  }

  redo(): void {
    if (!this.canRedo) {
      return;
    }

    this.isRedoing = true;
    try {
      this.currentIndex++;
      const entry = this.historyEntries[this.currentIndex];
      // Apply inverse patches in order
      for (const patch of entry.inversePatches) {
        applyPatch(this.target, patch);
      }
    } finally {
      this.isRedoing = false;
    }
  }

  clear(): void {
    this.historyEntries = [];
    this.currentIndex = -1;
    this.currentGroup = [];
    this.currentGroupInverse = [];
    this.grouping = false;
  }

  startGroup(): void {
    this.grouping = true;
    this.currentGroup = [];
    this.currentGroupInverse = [];
  }

  endGroup(): void {
    if (!this.grouping) {
      return;
    }

    this.grouping = false;

    if (this.currentGroup.length > 0) {
      // Remove any redo entries
      if (this.currentIndex < this.historyEntries.length - 1) {
        this.historyEntries.splice(this.currentIndex + 1);
      }

      // Add grouped entry
      this.historyEntries.push({
        patches: this.currentGroup,
        inversePatches: this.currentGroupInverse,
        timestamp: Date.now(),
      });
      this.currentIndex++;

      // Trim history if needed
      if (this.historyEntries.length > this.options.maxHistoryLength) {
        const excess = this.historyEntries.length - this.options.maxHistoryLength;
        this.historyEntries.splice(0, excess);
        this.currentIndex -= excess;
      }
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
    if (this.disposer) {
      this.disposer();
      this.disposer = null;
    }
    this.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an undo manager for a state tree
 */
export function createUndoManager(
  target: unknown,
  options?: IUndoManagerOptions
): IUndoManager {
  return new UndoManager(target, options);
}

// ============================================================================
// Snapshot-based Time Travel
// ============================================================================

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

class TimeTravelManager implements ITimeTravelManager {
  private target: unknown;
  private snapshots: unknown[] = [];
  private index: number = -1;
  private maxSnapshots: number;
  private isApplying: boolean = false;
  private disposer: IDisposer | null = null;
  private autoRecord: boolean;

  constructor(
    target: unknown,
    options: {
      maxSnapshots?: number;
      autoRecord?: boolean;
    } = {}
  ) {
    this.target = target;
    this.maxSnapshots = options.maxSnapshots ?? 50;
    this.autoRecord = options.autoRecord ?? false;

    // Record initial snapshot
    this.record();

    // Auto-record on changes if enabled
    if (this.autoRecord) {
      this.disposer = onPatch(target, () => {
        if (!this.isApplying) {
          this.record();
        }
      });
    }
  }

  get currentIndex(): number {
    return this.index;
  }

  get snapshotCount(): number {
    return this.snapshots.length;
  }

  get canGoBack(): boolean {
    return this.index > 0;
  }

  get canGoForward(): boolean {
    return this.index < this.snapshots.length - 1;
  }

  record(): void {
    // Remove any future snapshots
    if (this.index < this.snapshots.length - 1) {
      this.snapshots.splice(this.index + 1);
    }

    // Add new snapshot
    this.snapshots.push(getSnapshot(this.target));
    this.index++;

    // Trim if needed
    if (this.snapshots.length > this.maxSnapshots) {
      const excess = this.snapshots.length - this.maxSnapshots;
      this.snapshots.splice(0, excess);
      this.index -= excess;
    }
  }

  goBack(): void {
    if (!this.canGoBack) return;
    this.goTo(this.index - 1);
  }

  goForward(): void {
    if (!this.canGoForward) return;
    this.goTo(this.index + 1);
  }

  goTo(index: number): void {
    if (index < 0 || index >= this.snapshots.length) return;
    
    this.isApplying = true;
    try {
      this.index = index;
      applySnapshot(this.target, this.snapshots[index]);
    } finally {
      this.isApplying = false;
    }
  }

  getSnapshot(index: number): unknown {
    if (index < 0 || index >= this.snapshots.length) {
      throw new Error(`[jotai-state-tree] Invalid snapshot index: ${index}`);
    }
    return this.snapshots[index];
  }

  clear(): void {
    this.snapshots = [];
    this.index = -1;
    // Record current state
    this.record();
  }

  dispose(): void {
    if (this.disposer) {
      this.disposer();
      this.disposer = null;
    }
  }
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
  return new TimeTravelManager(target, options);
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
    
    // Import onAction dynamically to avoid circular dependency
    const { onAction } = require('./tree');
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
