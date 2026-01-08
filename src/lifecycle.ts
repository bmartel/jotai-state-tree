/**
 * Lifecycle hooks and middleware system
 * Implements afterCreate, beforeDestroy, afterAttach, beforeDetach, etc.
 *
 * MEMORY MANAGEMENT:
 * - Uses WeakMap for all node-keyed registries to allow GC
 * - Action recorders are stored in WeakMap to prevent memory leaks
 * - All registries automatically clean up when nodes are garbage collected
 */

import type { IDisposer } from "./types";
import {
  StateTreeNode,
  getStateTreeNode,
  registerActionRecorderHook,
  type ActionCall,
} from "./tree";

// ============================================================================
// Lifecycle Hook Types
// ============================================================================

export interface ILifecycleHooks {
  afterCreate?(): void;
  afterAttach?(): void;
  beforeDetach?(): void;
  beforeDestroy?(): void;
}

export interface IHooksConfig {
  afterCreate?: () => void;
  afterAttach?: () => void;
  beforeDetach?: () => void;
  beforeDestroy?: () => void;
}

// ============================================================================
// Hook Registration (WeakMap - allows GC)
// ============================================================================

const nodeHooks = new WeakMap<StateTreeNode, IHooksConfig>();

/**
 * Register lifecycle hooks for a node
 */
export function registerHooks(node: StateTreeNode, hooks: IHooksConfig): void {
  const existing = nodeHooks.get(node) || {};
  nodeHooks.set(node, { ...existing, ...hooks });
}

/**
 * Get hooks for a node
 */
export function getHooks(node: StateTreeNode): IHooksConfig | undefined {
  return nodeHooks.get(node);
}

/**
 * Run afterCreate hook
 */
export function runAfterCreate(node: StateTreeNode): void {
  const hooks = nodeHooks.get(node);
  if (hooks?.afterCreate) {
    hooks.afterCreate();
  }
}

/**
 * Run afterAttach hook
 */
export function runAfterAttach(node: StateTreeNode): void {
  const hooks = nodeHooks.get(node);
  if (hooks?.afterAttach) {
    hooks.afterAttach();
  }
}

/**
 * Run beforeDetach hook
 */
export function runBeforeDetach(node: StateTreeNode): void {
  const hooks = nodeHooks.get(node);
  if (hooks?.beforeDetach) {
    hooks.beforeDetach();
  }
}

/**
 * Run beforeDestroy hook
 */
export function runBeforeDestroy(node: StateTreeNode): void {
  const hooks = nodeHooks.get(node);
  if (hooks?.beforeDestroy) {
    hooks.beforeDestroy();
  }
}

// ============================================================================
// Middleware System
// ============================================================================

export interface IMiddlewareEvent {
  type:
    | "action"
    | "flow_spawn"
    | "flow_resume"
    | "flow_resume_error"
    | "flow_return"
    | "flow_throw";
  name: string;
  id: number;
  parentId: number;
  rootId: number;
  context: unknown;
  tree: unknown;
  args: unknown[];
  parentEvent?: IMiddlewareEvent;
}

export interface IMiddlewareHandler {
  (
    call: IMiddlewareEvent,
    next: (
      call: IMiddlewareEvent,
      callback?: (value: unknown) => unknown,
    ) => unknown,
    abort: (value: unknown) => unknown,
  ): unknown;
}

export interface IActionContext {
  name: string;
  context: unknown;
  tree: unknown;
  args: unknown[];
  parentActionEvent?: IMiddlewareEvent;
}

// Global middleware stack - these are global handlers, not per-node
const middlewareStack: IMiddlewareHandler[] = [];
let middlewareIdCounter = 0;

/**
 * Add middleware to the global stack
 */
export function addMiddleware(
  target: unknown,
  handler: IMiddlewareHandler,
  includeHooks: boolean = true,
): IDisposer {
  middlewareStack.push(handler);
  return () => {
    const index = middlewareStack.indexOf(handler);
    if (index >= 0) {
      middlewareStack.splice(index, 1);
    }
  };
}

/**
 * Create a middleware runner
 */
export function createMiddlewareRunner(
  node: StateTreeNode,
  actionName: string,
  args: unknown[],
): (fn: () => unknown) => unknown {
  if (middlewareStack.length === 0) {
    return (fn) => fn();
  }

  const id = ++middlewareIdCounter;
  const event: IMiddlewareEvent = {
    type: "action",
    name: actionName,
    id,
    parentId: 0,
    rootId: id,
    context: node.getInstance(),
    tree: node.getRoot().getInstance(),
    args,
  };

  return (fn: () => unknown) => {
    let index = 0;
    let aborted = false;
    let abortValue: unknown;

    const abort = (value: unknown) => {
      aborted = true;
      abortValue = value;
      return value;
    };

    const next = (
      call: IMiddlewareEvent,
      callback?: (value: unknown) => unknown,
    ): unknown => {
      if (aborted) return abortValue;

      if (index >= middlewareStack.length) {
        const result = fn();
        return callback ? callback(result) : result;
      }

      const middleware = middlewareStack[index++];
      return middleware(call, next, abort);
    };

    return next(event);
  };
}

// ============================================================================
// Action Tracking Context
// ============================================================================

interface ActionCallContext {
  name: string;
  args: unknown[];
  tree: StateTreeNode;
  parentContext?: ActionCallContext;
}

let currentActionContext: ActionCallContext | null = null;

/**
 * Get the current action context
 */
export function getRunningActionContext(): ActionCallContext | null {
  return currentActionContext;
}

/**
 * Set the current action context
 */
export function setRunningActionContext(
  context: ActionCallContext | null,
): void {
  currentActionContext = context;
}

// ============================================================================
// Action Recording (WeakMap - allows GC of nodes)
// ============================================================================

export interface ISerializedActionCall {
  name: string;
  path: string;
  args: unknown[];
}

/**
 * WeakMap for action recorders - allows nodes to be garbage collected
 * even if they have recorders attached
 */
const actionRecorders = new WeakMap<
  StateTreeNode,
  Set<(action: ISerializedActionCall) => void>
>();

/**
 * Record all actions on a subtree
 *
 * MEMORY SAFETY: Uses WeakMap so nodes can be garbage collected
 * even while recording is active. The stop() function properly
 * cleans up the recorder from the Set.
 */
export function recordActions(target: unknown): {
  actions: ISerializedActionCall[];
  stop: () => void;
  replay: (target: unknown) => void;
} {
  const node = getStateTreeNode(target);
  const actions: ISerializedActionCall[] = [];

  const recorder = (action: ISerializedActionCall) => {
    // Only record if node is still alive
    if (node.$isAlive) {
      actions.push(action);
    }
  };

  let recorders = actionRecorders.get(node);
  if (!recorders) {
    recorders = new Set();
    actionRecorders.set(node, recorders);
  }
  recorders.add(recorder);

  return {
    actions,
    stop: () => {
      const currentRecorders = actionRecorders.get(node);
      if (currentRecorders) {
        currentRecorders.delete(recorder);
        // Clean up empty Sets to avoid memory waste
        if (currentRecorders.size === 0) {
          // WeakMap doesn't have delete, but setting to undefined
          // or just leaving empty Set is fine - WeakMap handles GC
        }
      }
    },
    replay: (replayTarget: unknown) => {
      const replayNode = getStateTreeNode(replayTarget);
      for (const action of actions) {
        const instance = replayNode.getInstance() as Record<string, Function>;
        if (typeof instance[action.name] === "function") {
          instance[action.name](...action.args);
        }
      }
    },
  };
}

/**
 * Notify action recorders
 */
export function notifyActionRecorders(
  node: StateTreeNode,
  action: ISerializedActionCall,
): void {
  // Walk up the tree and notify all recorders
  let current: StateTreeNode | null = node;
  while (current) {
    const recorders = actionRecorders.get(current);
    if (recorders) {
      recorders.forEach((recorder) => recorder(action));
    }
    current = current.$parent;
  }
}

// Register the action recorder hook with tree.ts
// This is called at module load time to connect action tracking with recording
registerActionRecorderHook((node: StateTreeNode, call: ActionCall) => {
  const action: ISerializedActionCall = {
    name: call.name,
    path: call.path,
    args: call.args,
  };
  notifyActionRecorders(node, action);
});

// ============================================================================
// Protect / Unprotect (WeakSet - allows GC)
// ============================================================================

const protectedNodes = new WeakSet<StateTreeNode>();

/**
 * Protect a node from direct mutations outside of actions
 */
export function protect(target: unknown): void {
  const node = getStateTreeNode(target);
  protectedNodes.add(node);
}

/**
 * Unprotect a node to allow direct mutations
 */
export function unprotect(target: unknown): void {
  const node = getStateTreeNode(target);
  protectedNodes.delete(node);
}

/**
 * Check if a node is protected
 */
export function isProtected(target: unknown): boolean {
  const node = getStateTreeNode(target);
  return protectedNodes.has(node);
}

/**
 * Check if we can write to a node
 */
export function canWrite(node: StateTreeNode): boolean {
  // If not protected, can always write
  if (!protectedNodes.has(node)) {
    return true;
  }

  // If protected, must be inside an action
  return currentActionContext !== null;
}

// ============================================================================
// Type Checking
// ============================================================================

/**
 * Type check a value against a type, throwing if invalid
 */
export function typecheck<T>(
  type: { is(v: unknown): v is T; name: string },
  value: unknown,
): void {
  if (!type.is(value)) {
    throw new Error(
      `[jotai-state-tree] Value ${JSON.stringify(value)} is not assignable to type '${type.name}'`,
    );
  }
}

/**
 * Try to resolve a value as an instance of a type
 */
export function tryResolve<T>(
  type: { create(s: unknown): T; is(v: unknown): v is T },
  value: unknown,
): T | undefined {
  try {
    if (type.is(value)) {
      return value;
    }
    return type.create(value);
  } catch {
    return undefined;
  }
}

// ============================================================================
// Utility: getType
// ============================================================================

/**
 * Get the type of a state tree node
 */
export function getType(target: unknown): unknown {
  const node = getStateTreeNode(target);
  return node.$type;
}

/**
 * Check if a value is of a specific type
 */
export function isType(
  value: unknown,
  type: { is(v: unknown): boolean },
): boolean {
  return type.is(value);
}

// ============================================================================
// Utility: getChildType
// ============================================================================

/**
 * Get the type of a child property
 */
export function getChildType(target: unknown, propertyName: string): unknown {
  const node = getStateTreeNode(target);
  const type = node.$type as { properties?: Record<string, unknown> };

  if (type.properties && propertyName in type.properties) {
    return type.properties[propertyName];
  }

  throw new Error(
    `[jotai-state-tree] Property '${propertyName}' not found on type '${(type as { name?: string }).name}'`,
  );
}

// ============================================================================
// Apply Action
// ============================================================================

/**
 * Apply an action call to a target
 */
export function applyAction(
  target: unknown,
  action: ISerializedActionCall,
): unknown {
  const node = getStateTreeNode(target);

  // Navigate to the correct node using path
  let currentNode = node;
  if (action.path) {
    const parts = action.path.split("/").filter(Boolean);
    for (const part of parts) {
      const child = currentNode.getChild(part);
      if (!child) {
        throw new Error(
          `[jotai-state-tree] Invalid action path: ${action.path}`,
        );
      }
      currentNode = child;
    }
  }

  const instance = currentNode.getInstance() as Record<string, Function>;
  if (typeof instance[action.name] !== "function") {
    throw new Error(`[jotai-state-tree] Action '${action.name}' not found`);
  }

  return instance[action.name](...action.args);
}

// ============================================================================
// Escaping / Unescaping JSON Pointer
// ============================================================================

/**
 * Escape a JSON pointer segment
 */
export function escapeJsonPath(path: string): string {
  return path.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Unescape a JSON pointer segment
 */
export function unescapeJsonPath(path: string): string {
  return path.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * Split a path into segments
 */
export function splitJsonPath(path: string): string[] {
  return path.split("/").filter(Boolean).map(unescapeJsonPath);
}

/**
 * Join path segments
 */
export function joinJsonPath(parts: string[]): string {
  return parts.map(escapeJsonPath).join("/");
}

// ============================================================================
// Dependency Tracking
// ============================================================================

interface DependencyTracker {
  track(atom: unknown): void;
  getTracked(): Set<unknown>;
}

let currentTracker: DependencyTracker | null = null;

/**
 * Create a dependency tracker
 */
export function createDependencyTracker(): DependencyTracker {
  const tracked = new Set<unknown>();
  return {
    track(atom: unknown) {
      tracked.add(atom);
    },
    getTracked() {
      return tracked;
    },
  };
}

/**
 * Run a function with dependency tracking
 */
export function withDependencyTracking<T>(
  tracker: DependencyTracker,
  fn: () => T,
): T {
  const previous = currentTracker;
  currentTracker = tracker;
  try {
    return fn();
  } finally {
    currentTracker = previous;
  }
}

/**
 * Track a dependency
 */
export function trackDependency(atom: unknown): void {
  currentTracker?.track(atom);
}
