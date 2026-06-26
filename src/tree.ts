/**
 * Tree node management system
 * Handles tree structure, parent/child relationships, and node lifecycle
 *
 * MEMORY MANAGEMENT:
 * - Uses WeakRef for node registry to allow garbage collection
 * - Uses FinalizationRegistry for automatic cleanup of abandoned nodes
 * - Uses WeakMap where possible to avoid preventing GC
 * - Properly cleans up all registries on node destruction
 */

import { atom, createStore, type WritableAtom, type Atom } from "jotai";
import type {
  IStateTreeNode,
  IType,
  IAnyType,
  IAnyModelType,
  IJsonPatch,
  IReversibleJsonPatch,
  IDisposer,
} from "./types";
// Define global registries on globalThis to ensure request/module safety across bundler & module loader boundaries
const _global = globalThis as any;
if (!_global.__JST_GLOBALS__) {
  _global.__JST_GLOBALS__ = {
    lifecycleHookHandlers: {},
    isApplyingSnapshotOrPatch: false,
    globalStore: createStore(),
    activeStoreResolver: null,
    activeTrackingFn: null,
    activeAtomTrackingFn: null,
    nodeRegistry: new Map(),
    rootNodesRegistry: new Map(),
    activeReactRoots: new Set(),
    activeReactRootsCounts: new Map(),
    identifierRegistry: new Map(),
  };
}

const jstGlobals = _global.__JST_GLOBALS__;

export function setLifecycleHookHandlers(handlers: any) {
  jstGlobals.lifecycleHookHandlers = handlers;
}

export function getIsApplyingSnapshotOrPatch(): boolean {
  return jstGlobals.isApplyingSnapshotOrPatch;
}

export function setIsApplyingSnapshotOrPatch(value: boolean): void {
  jstGlobals.isApplyingSnapshotOrPatch = value;
}

// Re-export IDisposer for convenience
export type { IDisposer };

// ============================================================================
// Global Store & Registry
// ============================================================================

/** Get the global store */
export function getGlobalStore() {
  if (jstGlobals.activeStoreResolver) {
    const resolved = jstGlobals.activeStoreResolver();
    if (resolved) {
      return resolved;
    }
  }
  return jstGlobals.globalStore;
}

/** Set a custom global store (useful for testing) */
export function setGlobalStore(store: ReturnType<typeof createStore>) {
  jstGlobals.globalStore = store;
}

/** Reset the global store (useful for testing) */
export function resetGlobalStore() {
  jstGlobals.globalStore = createStore();
}

/** Set the active store resolver function */
export function setActiveStoreResolver(resolver: (() => ReturnType<typeof createStore> | null) | null) {
  jstGlobals.activeStoreResolver = resolver;
}

/** Get the active tracking function */
export function getActiveTrackingFn(): ((node: StateTreeNode) => void) | null {
  return jstGlobals.activeTrackingFn;
}

/** Set the active tracking function */
export function setActiveTrackingFn(fn: ((node: StateTreeNode) => void) | null) {
  jstGlobals.activeTrackingFn = fn;
}

/** Track access to a state tree node */
export function trackNodeAccess(node: StateTreeNode) {
  if (jstGlobals.activeTrackingFn) {
    jstGlobals.activeTrackingFn(node);
  }
}

/** Get the active atom tracking function */
export function getActiveAtomTrackingFn(): ((atom: any) => void) | null {
  return jstGlobals.activeAtomTrackingFn;
}

/** Set the active atom tracking function */
export function setActiveAtomTrackingFn(fn: ((atom: any) => void) | null) {
  jstGlobals.activeAtomTrackingFn = fn;
}

/** Track access to a Jotai atom */
export function trackAtomAccess(atomVal: any) {
  if (jstGlobals.activeAtomTrackingFn) {
    jstGlobals.activeAtomTrackingFn(atomVal);
  }
}

// ============================================================================
// Node Registry with Weak References
// ============================================================================

interface NodeEntry {
  node: WeakRef<StateTreeNode>;
  instance: WeakRef<object> | null;
}

/**
 * Registry mapping node IDs to their entries using WeakRef
 * This allows nodes to be garbage collected when no longer referenced
 */
export const nodeRegistry: Map<string, NodeEntry> = jstGlobals.nodeRegistry;

/**
 * Registry mapping root node IDs to their WeakRefs.
 * Maintains only root nodes for efficient lookup in DevTools.
 */
export const rootNodesRegistry: Map<string, WeakRef<StateTreeNode>> = jstGlobals.rootNodesRegistry;

/**
 * Registry of root store instances that are currently mounted/active in React.
 * This is used to filter out dangling root stores (e.g. from React StrictMode's discarded first render pass) in DevTools.
 */
export const activeReactRoots: Set<unknown> = jstGlobals.activeReactRoots;
const activeReactRootsCounts: Map<unknown, number> = jstGlobals.activeReactRootsCounts;

export function incrementRootRef(root: unknown): void {
  if (!root) return;
  const count = activeReactRootsCounts.get(root) || 0;
  activeReactRootsCounts.set(root, count + 1);
  activeReactRoots.add(root);
  try {
    const { devtoolsStore } = require("./devtools");
    if (devtoolsStore && typeof devtoolsStore.updateRoots === "function") {
      devtoolsStore.updateRoots();
    }
  } catch (e) {
    // ignore
  }
}

export function decrementRootRef(root: unknown): void {
  if (!root) return;
  const count = activeReactRootsCounts.get(root) || 0;
  if (count <= 1) {
    activeReactRootsCounts.delete(root);
    activeReactRoots.delete(root);
  } else {
    activeReactRootsCounts.set(root, count - 1);
  }
  try {
    const { devtoolsStore } = require("./devtools");
    if (devtoolsStore && typeof devtoolsStore.updateRoots === "function") {
      devtoolsStore.updateRoots();
    }
  } catch (e) {
    // ignore
  }
}

/**
 * FinalizationRegistry for automatic cleanup when nodes are garbage collected
 * This ensures the registries don't accumulate stale entries
 */
let lastNodeRegistryConstructor: any = typeof FinalizationRegistry !== 'undefined' ? FinalizationRegistry : null;
let _nodeFinalizationRegistry: FinalizationRegistry<any> | null = null;
export const getNodeFinalizationRegistry = () => {
  const currentConstructor = typeof FinalizationRegistry !== 'undefined' ? FinalizationRegistry : null;
  if (!_nodeFinalizationRegistry || lastNodeRegistryConstructor !== currentConstructor) {
    lastNodeRegistryConstructor = currentConstructor;
    _nodeFinalizationRegistry = new FinalizationRegistry((nodeId: string) => {
      nodeRegistry.delete(nodeId);
      rootNodesRegistry.delete(nodeId);
    });
  }
  return _nodeFinalizationRegistry;
};

/**
 * Registry for identifier lookups (type -> identifier -> WeakRef<node>)
 * Uses WeakRef to allow garbage collection of nodes
 */
export const identifierRegistry = new Map<
  string,
  Map<string | number, WeakRef<StateTreeNode>>
>();

/**
 * FinalizationRegistry for identifier cleanup
 */
let lastIdentifierRegistryConstructor: any = typeof FinalizationRegistry !== 'undefined' ? FinalizationRegistry : null;
let _identifierFinalizationRegistry: FinalizationRegistry<any> | null = null;
export const getIdentifierFinalizationRegistry = () => {
  const currentConstructor = typeof FinalizationRegistry !== 'undefined' ? FinalizationRegistry : null;
  if (!_identifierFinalizationRegistry || lastIdentifierRegistryConstructor !== currentConstructor) {
    lastIdentifierRegistryConstructor = currentConstructor;
    _identifierFinalizationRegistry = new FinalizationRegistry(
      (info: { typeName: string; identifier: string | number }) => {
        const typeMap = identifierRegistry.get(info.typeName);
        if (typeMap) {
          const ref = typeMap.get(info.identifier);
          if (!ref || ref.deref() === undefined) {
            typeMap.delete(info.identifier);
            if (typeMap.size === 0) {
              identifierRegistry.delete(info.typeName);
            }
          }
        }
      }
    );
  }
  return _identifierFinalizationRegistry;
};

/** Counter for generating unique node IDs */
let nodeIdCounter = 0;

function generateNodeId(): string {
  return `node_${++nodeIdCounter}_${Date.now().toString(36)}`;
}

/** Pre-allocated string representations of integers to avoid string allocations on array hot paths */
const INDEX_STRINGS: string[] = [];
for (let i = 0; i < 10000; i++) {
  INDEX_STRINGS.push(String(i));
}

export function getIndexString(index: number): string {
  if (index >= 0 && index < INDEX_STRINGS.length) {
    return INDEX_STRINGS[index];
  }
  return String(index);
}

// ============================================================================
// Lifecycle Change Listeners (for useIsAlive and other subscribers)
// ============================================================================

/** WeakMap to store lifecycle listeners per node - allows GC of nodes */
const lifecycleListeners = new WeakMap<
  StateTreeNode,
  Set<(isAlive: boolean) => void>
>();

/** Subscribe to lifecycle changes of a node */
export function onLifecycleChange(
  node: StateTreeNode,
  listener: (isAlive: boolean) => void,
): IDisposer {
  let listeners = lifecycleListeners.get(node);
  if (!listeners) {
    listeners = new Set();
    lifecycleListeners.set(node, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners?.delete(listener);
  };
}

/** Notify lifecycle listeners */
function notifyLifecycleChange(node: StateTreeNode, isAlive: boolean) {
  const listeners = lifecycleListeners.get(node);
  if (listeners) {
    listeners.forEach((listener) => listener(isAlive));
  }
}

function cloneAndSerialize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (hasStateTreeNode(value)) {
    return getSnapshotFromNode(getStateTreeNode(value));
  }
  if (Array.isArray(value)) {
    return value.map(cloneAndSerialize);
  }
  if (typeof value === "object") {
    if (value instanceof Map) {
      const res: Record<string, unknown> = {};
      for (const [k, v] of value.entries()) {
        res[k] = cloneAndSerialize(v);
      }
      return res;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto === null || proto === Object.prototype) {
      const res: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        res[k] = cloneAndSerialize(v);
      }
      return res;
    }
  }
  return value;
}

// ============================================================================
// State Tree Node Implementation
// ============================================================================

export class StateTreeNode implements IStateTreeNode {
  readonly $id: string;
  readonly $type: IAnyType;
  $parent: StateTreeNode | null = null;
  $path: string = "";
  cachedPath: string | null = null;
  $env: unknown;
  $isAlive: boolean = true;
  $isApplyingHistory: boolean = false;
  isSyncingChildren: boolean = false;

  /** Child nodes - uses Map but children are explicitly destroyed */
  private children = new Map<string, StateTreeNode>();

  /** Atom storing the raw value/snapshot */
  valueAtom: WritableAtom<unknown, [unknown], void>;

  /** Derived atom representing the snapshot of the entire node subtree */
  snapshotAtom: Atom<unknown>;

  /** Atom tracking the isAlive status */
  isAliveAtom: WritableAtom<boolean, [boolean], void>;

  /** Atom tracking structure and volatile state changes */
  structureVersionAtom: WritableAtom<number, [number], void>;

  /** Snapshot listeners */
  snapshotListeners = new Set<(snapshot: unknown) => void>();

  /** Patch listeners */
  patchListeners = new Set<
    (patch: IJsonPatch, reversePatch: IReversibleJsonPatch) => void
  >();

  /** Action listeners */
  actionListeners = new Set<(call: ActionCall) => void>();

  /** Volatile state (non-serialized) */
  volatileState: Record<string, unknown> = {};

  /** Pre/post process snapshot functions */
  preProcessor?: (snapshot: unknown) => unknown;
  postProcessor?: (snapshot: unknown) => unknown;

  /** Identifier value if this node has one */
  identifierValue?: string | number;

  /** Type name for identifier registry */
  identifierTypeName?: string;

  /** Cached snapshot for structural sharing optimization */
  cachedSnapshot: unknown = undefined;
  isSnapshotDirty = true;

  /** Strong reference to the instance proxy to prevent GC of active nodes */
  private instance: unknown = null;

  invalidateSnapshot() {
    if (this.isSyncingChildren) return;
    if (!this.isSnapshotDirty) {
      this.isSnapshotDirty = true;
      this.cachedSnapshot = undefined;
      if (this.$parent) {
        this.$parent.invalidateSnapshot();
      }
    }
  }

  incrementStructureVersion() {
    if (this.isSyncingChildren) return;
    const store = getGlobalStore();
    try {
      const current = store.get(this.structureVersionAtom);
      store.set(this.structureVersionAtom, current + 1);
    } catch (e) {
      // Ignore store errors during teardown/initialization
    }
  }

  constructor(
    type: IAnyType,
    initialValue: unknown,
    env?: unknown,
    parent?: StateTreeNode,
    pathSegment?: string,
  ) {
    this.$id = generateNodeId();
    this.$type = type;
    this.$env = env ?? parent?.$env;
    this.$parent = parent ?? null;
    this.$path = parent ? `${parent.$path}/${pathSegment}` : "";
    this.cachedPath = this.$path;

    // Create the value atom
    this.valueAtom = atom(initialValue);

    this.isAliveAtom = atom(true);

    this.structureVersionAtom = atom(0);

    this.snapshotAtom = atom((get) => {
      const value = get(this.valueAtom);

      if (this.$type._kind === "model") {
        const res: Record<string, unknown> = {};
        for (const [key, childNode] of this.children.entries()) {
          res[key] = get(childNode.snapshotAtom);
        }
        if (value && typeof value === "object") {
          for (const key of Object.keys(value)) {
            if (!this.children.has(key)) {
              res[key] = (value as Record<string, unknown>)[key];
            }
          }
        }
        return this.postProcessor ? this.postProcessor(res) : res;
      }

      if (this.$type._kind === "array") {
        const res: unknown[] = [];
        const childrenKeys = Array.from(this.children.keys()).sort((a, b) => Number(a) - Number(b));
        for (const key of childrenKeys) {
          const childNode = this.children.get(key)!;
          res.push(get(childNode.snapshotAtom));
        }
        return res;
      }

      if (this.$type._kind === "map") {
        const res: Record<string, unknown> = {};
        for (const [key, childNode] of this.children.entries()) {
          res[key] = get(childNode.snapshotAtom);
        }
        return res;
      }

      return value;
    });

    // Register this node with WeakRef
    nodeRegistry.set(this.$id, { node: new WeakRef(this), instance: null });

    if (!parent) {
      rootNodesRegistry.set(this.$id, new WeakRef(this));
    }

    // Register for automatic cleanup on GC
    getNodeFinalizationRegistry().register(this, this.$id, this);
  }

  /** Set the instance reference */
  setInstance(instance: unknown) {
    this.instance = instance;
    const entry = nodeRegistry.get(this.$id);
    if (entry && instance && typeof instance === "object") {
      entry.instance = new WeakRef(instance as object);
    }
  }

  /** Get the instance */
  getInstance(): unknown {
    return this.instance;
  }

  /** Get current value from atom */
  getValue(): unknown {
    return getGlobalStore().get(this.valueAtom);
  }

  /** Set value on atom */
  setValue(value: unknown) {
    if (!this.$isAlive) {
      throw new Error(
        `[jotai-state-tree] Cannot modify a node that is no longer part of the state tree. ` +
          `(Node type: '${this.$type.name}', Path: '${this.$path}')`,
      );
    }

    const oldValue = this.getValue();
    if (oldValue === value) {
      return;
    }
    getGlobalStore().set(this.valueAtom, value);

    // Notify snapshot listeners (bubble up to root)
    this.notifySnapshotChange();

    // Notify patch listeners
    this.notifyPatch(
      { op: "replace", path: this.$path, value },
      { op: "replace", path: this.$path, value: oldValue, oldValue },
    );
  }

  /** Add a child node */
  addChild(key: string, child: StateTreeNode) {
    child.$parent = this;
    const newPath = `${this.$path}/${key}`;
    if (child.$path !== newPath) {
      this.updatePathRecursively(child, newPath);
    }
    child.$env = child.$env ?? this.$env;
    this.children.set(key, child);
    rootNodesRegistry.delete(child.$id);
    jstGlobals.lifecycleHookHandlers.runAfterAttach?.(child);
    this.invalidateSnapshot();
    this.incrementStructureVersion();
  }

  /** Recursively update the path of a node and all its children */
  private updatePathRecursively(node: StateTreeNode, newPath: string) {
    node.$path = newPath;
    node.cachedPath = newPath;

    // Update all children's paths
    for (const [childKey, childNode] of node.children) {
      const childNewPath = `${newPath}/${childKey}`;
      this.updatePathRecursively(childNode, childNewPath);
    }
  }

  /** Remove a child node */
  removeChild(key: string) {
    const child = this.children.get(key);
    if (child) {
      child.destroy();
      this.children.delete(key);
      this.invalidateSnapshot();
      this.incrementStructureVersion();
    }
  }

  /** Get a child node */
  getChild(key: string): StateTreeNode | undefined {
    return this.children.get(key);
  }

  /** Get all children */
  getChildren(): Map<string, StateTreeNode> {
    return this.children;
  }

  /** Register identifier */
  registerIdentifier(typeName: string, identifier: string | number) {
    this.identifierTypeName = typeName;
    this.identifierValue = identifier;

    let typeMap = identifierRegistry.get(typeName);
    if (!typeMap) {
      typeMap = new Map();
      identifierRegistry.set(typeName, typeMap);
    }
    typeMap.set(identifier, new WeakRef(this));

    // Register for automatic cleanup on GC
    getIdentifierFinalizationRegistry().register(
      this,
      { typeName, identifier },
      this,
    );
  }

  /** Unregister identifier */
  unregisterIdentifier() {
    if (
      this.identifierTypeName !== undefined &&
      this.identifierValue !== undefined
    ) {
      const typeMap = identifierRegistry.get(this.identifierTypeName);
      if (typeMap) {
        typeMap.delete(this.identifierValue);
        // Clean up empty type maps to prevent accumulation
        if (typeMap.size === 0) {
          identifierRegistry.delete(this.identifierTypeName);
        }
      }
      // Unregister from finalization registry
      getIdentifierFinalizationRegistry().unregister(this);
    }
  }

  /** Subscribe to snapshot changes */
  onSnapshot(listener: (snapshot: unknown) => void): IDisposer {
    this.snapshotListeners.add(listener);
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  /** Subscribe to patches */
  onPatch(
    listener: (patch: IJsonPatch, reversePatch: IReversibleJsonPatch) => void,
  ): IDisposer {
    this.patchListeners.add(listener);
    return () => {
      this.patchListeners.delete(listener);
    };
  }



  /** Notify patch listeners */
  notifyPatch(patch: IJsonPatch, reversePatch: IReversibleJsonPatch) {
    const serializedPatch: IJsonPatch = {
      ...patch,
      value: "value" in patch ? cloneAndSerialize(patch.value) : undefined,
    };
    if (!("value" in patch)) {
      delete serializedPatch.value;
    }

    const serializedReversePatch: IReversibleJsonPatch = {
      ...reversePatch,
      value: "value" in reversePatch ? cloneAndSerialize(reversePatch.value) : undefined,
      oldValue: "oldValue" in reversePatch ? cloneAndSerialize((reversePatch as any).oldValue) : undefined,
    };
    if (!("value" in reversePatch)) {
      delete serializedReversePatch.value;
    }
    if (!("oldValue" in reversePatch)) {
      delete (serializedReversePatch as any).oldValue;
    }

    if (notificationBatchDepth > 0) {
      pendingPatches.push({
        node: this,
        patch: serializedPatch,
        reversePatch: serializedReversePatch,
        actionContext: currentAction,
      });
    } else {
      this.patchListeners.forEach((listener) => listener(serializedPatch, serializedReversePatch));
    }

    // Bubble up to parent
    if (this.$parent) {
      this.$parent.notifyPatch(serializedPatch, serializedReversePatch);
    }
  }

  /** Notify snapshot listeners */
  notifySnapshotChange() {
    let current: StateTreeNode | null = this;
    while (current) {
      current.invalidateSnapshot();
      if (notificationBatchDepth > 0) {
        pendingSnapshotNotifications.add(current);
      } else if (current.snapshotListeners.size > 0) {
        const snapshot = getSnapshotFromNode(current);
        current.snapshotListeners.forEach((listener) => listener(snapshot));
      }
      current = current.$parent;
    }
  }

  /** Notify about a property change (for use by model proxy) */
  notifyPropertyChange(propName: string, newValue: unknown, oldValue: unknown) {
    const path = this.$path ? `${this.$path}/${propName}` : `/${propName}`;
    this.notifySnapshotChange();
    this.notifyPatch(
      { op: "replace", path, value: newValue },
      { op: "replace", path, value: oldValue, oldValue },
    );
  }

  /** Notify about a volatile state change (triggers snapshot listeners without patches) */
  notifyVolatileChange() {
    this.incrementStructureVersion();
    this.notifySnapshotChange();
  }

  /** Get root node */
  getRoot(): StateTreeNode {
    let node: StateTreeNode = this;
    while (node.$parent) {
      node = node.$parent;
    }
    return node;
  }

  /** Destroy this node and all children */
  destroy() {
    if (!this.$isAlive) return;

    this.instance = null;

    // Run beforeDestroy hook
    jstGlobals.lifecycleHookHandlers.runBeforeDestroy?.(this);

    // Destroy children first
    this.children.forEach((child) => child.destroy());
    this.children.clear();

    // Unregister identifier
    this.unregisterIdentifier();

    // Mark as dead
    this.$isAlive = false;
    try {
      getGlobalStore().set(this.isAliveAtom, false);
    } catch (e) {
      // Ignore store errors during teardown
    }

    // Notify lifecycle listeners
    notifyLifecycleChange(this, false);

    // Remove from node registry
    nodeRegistry.delete(this.$id);
    rootNodesRegistry.delete(this.$id);

    // Unregister from finalization registry (already destroyed, don't need GC cleanup)
    getNodeFinalizationRegistry().unregister(this);

    // Clear lifecycle listeners WeakMap entry
    lifecycleListeners.delete(this);

    // Notify snapshot listeners before they are cleared to trigger re-renders on components observing this node
    this.snapshotListeners.forEach((listener) => {
      try {
        listener(undefined);
      } catch (e) {
        // Ignore listener errors during destruction
      }
    });

    // Notify atom subscribers of destruction
    try {
      getGlobalStore().set(this.valueAtom, undefined);
    } catch (e) {
      // Ignore store errors during teardown
    }

    // Clear listeners
    this.snapshotListeners.clear();
    this.patchListeners.clear();
    this.actionListeners.clear();
  }

  /** Detach from parent */
  detach() {
    if (this.$parent) {
      // Run beforeDetach hook
      jstGlobals.lifecycleHookHandlers.runBeforeDetach?.(this);

      const parent = this.$parent;
      // Find our key in parent's children
      for (const [key, child] of this.$parent.children) {
        if (child === this) {
          this.$parent.children.delete(key);
          break;
        }
      }
      this.$parent = null;
      this.$path = "";
      this.cachedPath = "";
      rootNodesRegistry.set(this.$id, new WeakRef(this));
      parent.invalidateSnapshot();
    }
  }
}

export interface ActionContext {
  name: string;
  args: unknown[];
  tree: StateTreeNode;
  parent?: ActionContext | null;
}

export interface ActionCall {
  name: string;
  path: string;
  args: unknown[];
}

let currentAction: ActionContext | null = null;

export function getCurrentAction(): ActionContext | null {
  return currentAction;
}

/** Action recorder hooks - set by lifecycle.ts to avoid circular imports */
const actionRecorderHooks: Array<
  (node: StateTreeNode, call: ActionCall) => void
> = [];

/** Register an action recorder hook (called by lifecycle.ts) */
export function registerActionRecorderHook(
  hook: (node: StateTreeNode, call: ActionCall) => void,
): () => void {
  actionRecorderHooks.push(hook);
  return () => {
    const index = actionRecorderHooks.indexOf(hook);
    if (index >= 0) {
      actionRecorderHooks.splice(index, 1);
    }
  };
}

/** Check if an action is currently running */
export function isActionRunning(): boolean {
  return currentAction !== null;
}

let notificationBatchDepth = 0;
const pendingSnapshotNotifications = new Set<StateTreeNode>();
const pendingPatches: {
  node: StateTreeNode;
  patch: IJsonPatch;
  reversePatch: IReversibleJsonPatch;
  actionContext: ActionContext | null;
}[] = [];
const pendingActions: {
  node: StateTreeNode;
  call: ActionCall;
  actionContext: ActionContext | null;
}[] = [];

export function batchNotifications<T>(fn: () => T): T {
  notificationBatchDepth++;
  try {
    return fn();
  } finally {
    notificationBatchDepth--;
    if (notificationBatchDepth === 0) {
      // Trigger snapshot notifications
      const nodesToNotify = Array.from(pendingSnapshotNotifications);
      pendingSnapshotNotifications.clear();
      for (const node of nodesToNotify) {
        if (node.$isAlive) {
          const snapshot = getSnapshotFromNode(node);
          node.snapshotListeners.forEach((listener) => {
            try {
              listener(snapshot);
            } catch (e) {
              console.error(e);
            }
          });
        }
      }

      // Trigger patch notifications
      const patchesToEmit = [...pendingPatches];
      pendingPatches.length = 0;
      const previousGlobalAction = currentAction;
      for (const { node, patch, reversePatch, actionContext } of patchesToEmit) {
        if (node.$isAlive) {
          currentAction = actionContext;
          node.patchListeners.forEach((listener) => {
            try {
              listener(patch, reversePatch);
            } catch (e) {
              console.error(e);
            }
          });
        }
      }
      currentAction = previousGlobalAction;

      // Trigger action notifications
      const actionsToEmit = [...pendingActions];
      pendingActions.length = 0;
      const previousGlobalActionForActions = currentAction;
      for (const { node, call, actionContext } of actionsToEmit) {
        currentAction = actionContext;
        let current: StateTreeNode | null = node;
        while (current) {
          if (current.$isAlive) {
            current.actionListeners.forEach((listener) => {
              try {
                listener(call);
              } catch (e) {
                console.error(e);
              }
            });
          }
          current = current.$parent;
        }
        actionRecorderHooks.forEach((hook) => {
          try {
            hook(node, call);
          } catch (e) {
            console.error(e);
          }
        });
      }
      currentAction = previousGlobalActionForActions;
    }
  }
}

// ============================================================================
// Node Utilities
// ============================================================================

/** Symbol to access the tree node from an instance */
export const $treenode = Symbol.for("jotai-state-tree-node");

/** Get the tree node from an instance */
export function getStateTreeNode(instance: unknown): StateTreeNode {
  if (instance && typeof instance === "object" && $treenode in instance) {
    return (instance as Record<typeof $treenode, StateTreeNode>)[$treenode];
  }
  throw new Error("[jotai-state-tree] Value is not a state tree node");
}

/** Check if value has a tree node */
export function hasStateTreeNode(instance: unknown): boolean {
  return (
    instance !== null && typeof instance === "object" && $treenode in instance
  );
}

/** Get snapshot from a node */
export function getSnapshotFromNode(node: StateTreeNode): unknown {
  if (!node.isSnapshotDirty && node.cachedSnapshot !== undefined) {
    return node.cachedSnapshot;
  }

  const type = node.$type;
  const value = node.getValue();
  let snapshot: unknown;

  // Handle based on type kind
  if (type._kind === "model") {
    const modelSnapshot: Record<string, unknown> = {};
    const children = node.getChildren();

    for (const [key, childNode] of children) {
      modelSnapshot[key] = getSnapshotFromNode(childNode);
    }

    // Apply post processor if exists
    if (node.postProcessor) {
      snapshot = node.postProcessor(modelSnapshot);
    } else {
      snapshot = modelSnapshot;
    }
  } else if (type._kind === "array") {
    const arr = value as unknown[];
    snapshot = arr.map((_, index) => {
      const childNode = node.getChild(getIndexString(index));
      return childNode ? getSnapshotFromNode(childNode) : arr[index];
    });
  } else if (type._kind === "map") {
    const mapSnapshot: Record<string, unknown> = {};
    const children = node.getChildren();
    for (const [key, childNode] of children) {
      mapSnapshot[key] = getSnapshotFromNode(childNode);
    }
    snapshot = mapSnapshot;
  } else if (type._kind === "reference") {
    // Return the identifier, not the resolved value
    snapshot = node.identifierValue ?? value;
  } else {
    // For primitives and frozen, return the value directly
    snapshot = value;
  }

  node.cachedSnapshot = snapshot;
  node.isSnapshotDirty = false;

  return snapshot;
}

/** Apply snapshot to a node */
export function applySnapshotToNode(node: StateTreeNode, snapshot: unknown) {
  return batchNotifications(() => {
    if (!node.$isAlive) {
      throw new Error("[jotai-state-tree] Cannot apply snapshot to a dead node");
    }

    const type = node.$type;

    // Apply pre processor if exists
    if (node.preProcessor) {
      snapshot = node.preProcessor(snapshot);
    }

    if (
      type._kind === "model" &&
      typeof snapshot === "object" &&
      snapshot !== null
    ) {
      const snapshotObj = snapshot as Record<string, unknown>;
      const properties = (type as any).properties || {};

      for (const key of Object.keys(properties)) {
        const childNode = node.getChild(key);
        if (childNode) {
          if (key in snapshotObj) {
            applySnapshotToNode(childNode, snapshotObj[key]);
          } else if (
            childNode.$type._kind === "optional" ||
            childNode.$type._kind === "maybe" ||
            childNode.$type._kind === "maybeNull"
          ) {
            applySnapshotToNode(childNode, undefined);
          }
        }
      }
    } else if (type._kind === "array" && Array.isArray(snapshot)) {
      // For arrays, we need to reconcile
      const mstArray = node.getInstance() as any;
      if (mstArray) {
        mstArray.replace(snapshot);
      } else {
        node.setValue(snapshot);
      }
    } else if (
      type._kind === "map" &&
      typeof snapshot === "object" &&
      snapshot !== null
    ) {
      // For maps, replace all entries
      const mstMap = node.getInstance() as any;
      if (mstMap) {
        mstMap.replace(snapshot);
      } else {
        node.setValue(snapshot);
      }
    } else {
      // For primitives and simple/wrapper types
      if (type && typeof type.create === "function") {
        node.setValue(type.create(snapshot, node.$env));
      } else {
        node.setValue(snapshot);
      }
    }
  });
}

/** Look up a node by identifier */
export function resolveIdentifier(
  typeName: string,
  identifier: string | number,
): StateTreeNode | undefined {
  const weakRef = identifierRegistry.get(typeName)?.get(identifier);
  return weakRef?.deref();
}

/** Get all nodes of a type */
export function getNodesOfType(typeName: string): StateTreeNode[] {
  const typeMap = identifierRegistry.get(typeName);
  if (!typeMap) return [];

  const nodes: StateTreeNode[] = [];
  for (const weakRef of typeMap.values()) {
    const node = weakRef.deref();
    if (node) {
      nodes.push(node);
    }
  }
  return nodes;
}

// ============================================================================
// Registry Statistics (for testing and debugging)
// ============================================================================

/** Get statistics about the registries - useful for debugging memory issues */
export function getRegistryStats(): {
  nodeRegistrySize: number;
  identifierRegistrySize: number;
  identifierTypeCount: number;
  liveNodeCount: number;
  staleNodeCount: number;
} {
  let liveNodeCount = 0;
  let staleNodeCount = 0;

  for (const entry of nodeRegistry.values()) {
    const node = entry.node.deref();
    // A node is "live" if it exists AND $isAlive is true
    if (node && node.$isAlive) {
      liveNodeCount++;
    } else {
      staleNodeCount++;
    }
  }

  let identifierCount = 0;
  for (const typeMap of identifierRegistry.values()) {
    // Only count identifiers that point to live nodes
    for (const weakRef of typeMap.values()) {
      const node = weakRef.deref();
      if (node && node.$isAlive) {
        identifierCount++;
      }
    }
  }

  return {
    nodeRegistrySize: nodeRegistry.size,
    identifierRegistrySize: identifierCount,
    identifierTypeCount: identifierRegistry.size,
    liveNodeCount,
    staleNodeCount,
  };
}

/** Clean up stale entries from registries - call periodically if needed */
export function cleanupStaleEntries(): number {
  let cleaned = 0;

  // Clean stale node entries
  for (const [id, entry] of nodeRegistry.entries()) {
    if (!entry.node.deref()) {
      nodeRegistry.delete(id);
      cleaned++;
    }
  }

  // Clean stale identifier entries
  for (const [typeName, typeMap] of identifierRegistry.entries()) {
    for (const [identifier, weakRef] of typeMap.entries()) {
      if (!weakRef.deref()) {
        typeMap.delete(identifier);
        cleaned++;
      }
    }
    if (typeMap.size === 0) {
      identifierRegistry.delete(typeName);
    }
  }

  return cleaned;
}

/** Clear all registries - useful for testing */
export function clearAllRegistries(): void {
  // First, mark all nodes as dead before clearing
  for (const entry of nodeRegistry.values()) {
    const node = entry.node.deref();
    if (node) {
      node.$isAlive = false;
      try {
        getGlobalStore().set(node.isAliveAtom, false);
      } catch (e) {
        // Ignore store errors during teardown
      }
    }
  }
  nodeRegistry.clear();
  rootNodesRegistry.clear();
  identifierRegistry.clear();
  activeReactRoots.clear();
  activeReactRootsCounts.clear();
  nodeIdCounter = 0;
}

// ============================================================================
// Tree Navigation Functions
// ============================================================================

/** Get the root of the tree */
export function getRoot<T>(target: T): T {
  const node = getStateTreeNode(target);
  const rootNode = node.getRoot();
  return rootNode.getInstance() as T;
}

/** Get the parent of a node */
export function getParent<T = unknown>(target: unknown, depth: number = 1): T {
  let node = getStateTreeNode(target);
  for (let i = 0; i < depth; i++) {
    if (!node.$parent) {
      throw new Error("[jotai-state-tree] Cannot get parent of root node");
    }
    node = node.$parent;
  }
  return node.getInstance() as T;
}

/** Try to get the parent, returns undefined if at root */
export function tryGetParent<T = unknown>(
  target: unknown,
  depth: number = 1,
): T | undefined {
  try {
    return getParent<T>(target, depth);
  } catch {
    return undefined;
  }
}

/** Check if a node has a parent */
export function hasParent(target: unknown, depth: number = 1): boolean {
  let node = getStateTreeNode(target);
  for (let i = 0; i < depth; i++) {
    if (!node.$parent) return false;
    node = node.$parent;
  }
  return true;
}

/** Get parent of specific type */
export function getParentOfType<T extends IAnyModelType>(
  target: unknown,
  type: T,
): T extends IType<unknown, unknown, infer I> ? I : never {
  let node: StateTreeNode | null = getStateTreeNode(target).$parent;

  while (node) {
    if (node.$type === type || node.$type.name === type.name) {
      return node.getInstance() as T extends IType<unknown, unknown, infer I>
        ? I
        : never;
    }
    node = node.$parent;
  }

  throw new Error(`[jotai-state-tree] No parent of type '${type.name}' found`);
}

/** Get the path of a node */
export function getPath(target: unknown): string {
  const node = getStateTreeNode(target);
  return node.cachedPath ?? node.$path;
}

/** Get path parts as array */
export function getPathParts(target: unknown): string[] {
  const path = getPath(target);
  return path ? path.split("/").filter(Boolean) : [];
}

/** Get the environment */
export function getEnv<E = unknown>(target: unknown): E {
  return getStateTreeNode(target).$env as E;
}

/** Check if node is alive */
export function isAlive(target: unknown): boolean {
  try {
    return getStateTreeNode(target).$isAlive;
  } catch {
    return false;
  }
}

/** Check if node is root */
export function isRoot(target: unknown): boolean {
  return getStateTreeNode(target).$parent === null;
}

/** Get the type of a node */
export function getType(target: unknown): IAnyType {
  return getStateTreeNode(target).$type;
}

/** Check if value is a state tree node */
export function isStateTreeNode(value: unknown): boolean {
  return hasStateTreeNode(value);
}

/** Get identifier of a node */
export function getIdentifier(target: unknown): string | number | null {
  const node = getStateTreeNode(target);
  return node.identifierValue ?? null;
}

/** Destroy a node */
export function destroy(target: unknown): void {
  const node = getStateTreeNode(target);
  node.destroy();
}

/** Detach a node from its parent */
export function detach<T>(target: T): T {
  const node = getStateTreeNode(target);
  node.detach();
  return target;
}

/** Clone a node */
export function clone<T>(target: T, keepEnvironment: boolean = true): T {
  const node = getStateTreeNode(target);
  const snapshot = getSnapshotFromNode(node);
  const type = node.$type;
  return type.create(snapshot, keepEnvironment ? node.$env : undefined) as T;
}

// ============================================================================
// Snapshot & Patch Functions
// ============================================================================

/** Get snapshot from an instance */
export function getSnapshot<S>(target: unknown): S {
  const node = getStateTreeNode(target);
  trackNodeAccess(node);
  return getSnapshotFromNode(node) as S;
}

/** Apply snapshot to an instance */
export function applySnapshot<S>(target: unknown, snapshot: S): void {
  const node = getStateTreeNode(target);
  const wasApplying = getIsApplyingSnapshotOrPatch();
  setIsApplyingSnapshotOrPatch(true);
  try {
    applySnapshotToNode(node, snapshot);
  } finally {
    setIsApplyingSnapshotOrPatch(wasApplying);
  }
}

/** Subscribe to snapshots */
export function onSnapshot<S>(
  target: unknown,
  listener: (snapshot: S) => void,
): IDisposer {
  const node = getStateTreeNode(target);
  return node.onSnapshot(listener as (snapshot: unknown) => void);
}

/** Subscribe to patches */
export function onPatch(
  target: unknown,
  listener: (patch: IJsonPatch, reversePatch: IReversibleJsonPatch) => void,
): IDisposer {
  const node = getStateTreeNode(target);
  return node.onPatch(listener);
}

/** Apply a single patch */
export function applyPatch(
  target: unknown,
  patch: IJsonPatch | IJsonPatch[],
): void {
  return batchNotifications(() => {
    const patches = Array.isArray(patch) ? patch : [patch];
    const rootNode = getStateTreeNode(target).getRoot();

    const wasApplying = getIsApplyingSnapshotOrPatch();
    setIsApplyingSnapshotOrPatch(true);
    try {
      for (const p of patches) {
        applyPatchToNode(rootNode, p);
      }
    } finally {
      setIsApplyingSnapshotOrPatch(wasApplying);
    }
  });
}

function applyPatchToNode(rootNode: StateTreeNode, patch: IJsonPatch): void {
  const pathParts = patch.path.split("/").filter(Boolean);
  let node = rootNode;

  // Navigate to the target node
  for (let i = 0; i < pathParts.length - 1; i++) {
    const childNode = node.getChild(pathParts[i]);
    if (!childNode) {
      throw new Error(`[jotai-state-tree] Invalid patch path: ${patch.path}`);
    }
    node = childNode;
  }

  const key = pathParts[pathParts.length - 1];

  switch (patch.op) {
    case "replace": {
      const instance = node.getInstance() as any;
      if (instance && Array.isArray(instance)) {
        const index = parseInt(key, 10);
        instance[index] = patch.value;
      } else if (instance && instance instanceof Map) {
        instance.set(key, patch.value);
      } else {
        const childNode = node.getChild(key);
        if (childNode) {
          applySnapshotToNode(childNode, patch.value);
        } else {
          // Direct value set for primitives
          const currentValue = node.getValue() as Record<string, unknown>;
          currentValue[key] = patch.value;
          node.setValue(currentValue);
        }
      }
      break;
    }
    case "add": {
      const instance = node.getInstance() as any;
      if (instance && Array.isArray(instance)) {
        const index = key === "-" ? instance.length : parseInt(key, 10);
        instance.splice(index, 0, patch.value);
      } else if (instance && instance instanceof Map) {
        instance.set(key, patch.value);
      } else {
        const currentValue = node.getValue();
        if (Array.isArray(currentValue)) {
          const index = key === "-" ? currentValue.length : parseInt(key, 10);
          currentValue.splice(index, 0, patch.value);
          node.setValue([...currentValue]);
        } else if (typeof currentValue === "object" && currentValue !== null) {
          (currentValue as Record<string, unknown>)[key] = patch.value;
          node.setValue({ ...currentValue });
        }
      }
      break;
    }
    case "remove": {
      const instance = node.getInstance() as any;
      if (instance && Array.isArray(instance)) {
        const index = parseInt(key, 10);
        instance.splice(index, 1);
      } else if (instance && instance instanceof Map) {
        instance.delete(key);
      } else {
        const currentValue = node.getValue();
        if (Array.isArray(currentValue)) {
          const index = parseInt(key, 10);
          currentValue.splice(index, 1);
          node.setValue([...currentValue]);
        } else if (typeof currentValue === "object" && currentValue !== null) {
          delete (currentValue as Record<string, unknown>)[key];
          node.setValue({ ...currentValue });
        }
      }
      break;
    }
  }
}

/** Record patches during a function execution */
export function recordPatches(target: unknown): {
  patches: IJsonPatch[];
  inversePatches: IReversibleJsonPatch[];
  stop: () => void;
  resume: () => void;
  replay: (target: unknown) => void;
  undo: (target: unknown) => void;
} {
  const patches: IJsonPatch[] = [];
  const inversePatches: IReversibleJsonPatch[] = [];
  let recording = true;

  const disposer = onPatch(target, (patch, reversePatch) => {
    if (recording) {
      patches.push(patch);
      inversePatches.push(reversePatch);
    }
  });

  return {
    patches,
    inversePatches,
    stop: () => {
      recording = false;
      disposer();
    },
    resume: () => {
      recording = true;
    },
    replay: (t: unknown) => {
      applyPatch(t, patches);
    },
    undo: (t: unknown) => {
      applyPatch(t, inversePatches.slice().reverse());
    },
  };
}

// ============================================================================
// Action Tracking
// ============================================================================

/** Track an action call */
export function trackAction<T>(
  node: StateTreeNode,
  name: string,
  args: unknown[],
  fn: () => T,
): T {
  return batchNotifications(() => {
    const previousAction = currentAction;
    currentAction = { name, args, tree: node, parent: previousAction };

    try {
      const result = fn();

      // Notify action listeners
      const call: ActionCall = {
        name,
        path: node.$path,
        args,
      };
      pendingActions.push({
        node,
        call,
        actionContext: currentAction,
      });

      return result;
    } finally {
      currentAction = previousAction;
    }
  });
}

/** Subscribe to action calls */
export function onAction(
  target: unknown,
  listener: (call: ActionCall) => void,
): IDisposer {
  const node = getStateTreeNode(target);
  node.actionListeners.add(listener);
  return () => {
    node.actionListeners.delete(listener);
  };
}

// ============================================================================
// Utilities
// ============================================================================

/** Walk the tree */
export function walk(target: unknown, visitor: (node: unknown) => void): void {
  const treeNode = getStateTreeNode(target);

  function visitNode(node: StateTreeNode) {
    const instance = node.getInstance();
    if (instance) {
      visitor(instance);
    }
    node.getChildren().forEach(visitNode);
  }

  visitNode(treeNode);
}

/** Get all members (properties) of a node */
export function getMembers(target: unknown): {
  name: string;
  type: "view" | "action" | "property" | "volatile";
  value: unknown;
}[] {
  const result: {
    name: string;
    type: "view" | "action" | "property" | "volatile";
    value: unknown;
  }[] = [];
  const node = getStateTreeNode(target);
  const instance = target as Record<string, unknown>;

  // Get properties from children
  for (const [key] of node.getChildren()) {
    result.push({
      name: key,
      type: "property",
      value: instance[key],
    });
  }

  // Get volatile state
  for (const [key, value] of Object.entries(node.volatileState)) {
    result.push({
      name: key,
      type: "volatile",
      value,
    });
  }

  return result;
}

/** Resolve a path to a node */
export function resolvePath(target: unknown, path: string): unknown {
  const parts = path.split("/").filter(Boolean);
  let node = getStateTreeNode(target);

  for (const part of parts) {
    const child = node.getChild(part);
    if (!child) {
      throw new Error(`[jotai-state-tree] Invalid path: ${path}`);
    }
    node = child;
  }

  return node.getInstance();
}

/** Try to resolve a path */
export function tryResolve(target: unknown, path: string): unknown | undefined {
  try {
    return resolvePath(target, path);
  } catch {
    return undefined;
  }
}

/** Get the relative path from one node to another */
export function getRelativePath(from: unknown, to: unknown): string {
  const fromNode = getStateTreeNode(from);
  const toNode = getStateTreeNode(to);

  const fromParts = fromNode.$path.split("/").filter(Boolean);
  const toParts = toNode.$path.split("/").filter(Boolean);

  // Find common ancestor
  let commonLength = 0;
  for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
    if (fromParts[i] === toParts[i]) {
      commonLength++;
    } else {
      break;
    }
  }

  // Build relative path
  const upCount = fromParts.length - commonLength;
  const downParts = toParts.slice(commonLength);

  const parts: string[] = [];
  for (let i = 0; i < upCount; i++) {
    parts.push("..");
  }
  parts.push(...downParts);

  return parts.join("/") || ".";
}

/** Check if a node is an ancestor of another */
export function isAncestor(ancestor: unknown, descendant: unknown): boolean {
  const ancestorNode = getStateTreeNode(ancestor);
  let currentNode: StateTreeNode | null = getStateTreeNode(descendant);

  while (currentNode) {
    if (currentNode === ancestorNode) {
      return true;
    }
    currentNode = currentNode.$parent;
  }

  return false;
}

/** Check if two nodes share a common root */
export function haveSameRoot(a: unknown, b: unknown): boolean {
  return getRoot(a) === getRoot(b);
}

/** Get all nodes of a specific type in the tree */
export function findAll<T>(
  target: unknown,
  predicate: (node: unknown) => node is T,
): T[] {
  const results: T[] = [];

  walk(target, (node) => {
    if (predicate(node)) {
      results.push(node);
    }
  });

  return results;
}

/** Get the first node matching a predicate */
export function findFirst<T>(
  target: unknown,
  predicate: (node: unknown) => node is T,
): T | undefined {
  let result: T | undefined;

  walk(target, (node) => {
    if (!result && predicate(node)) {
      result = node;
    }
  });

  return result;
}

/** Check if a value is a valid reference target */
export function isValidReference(
  target: unknown,
  identifier: string | number,
): boolean {
  if (!hasStateTreeNode(target)) return false;

  try {
    const node = getStateTreeNode(target);
    const typeName = node.$type.name;
    const resolved = resolveIdentifier(typeName, identifier);
    return resolved !== undefined;
  } catch {
    return false;
  }
}

/** Get statistics about the tree */
export function getTreeStats(target: unknown): {
  nodeCount: number;
  depth: number;
  types: Record<string, number>;
} {
  let nodeCount = 0;
  let maxDepth = 0;
  const types: Record<string, number> = {};

  walk(target, (node) => {
    if (!hasStateTreeNode(node)) return;

    const stateNode = getStateTreeNode(node);
    nodeCount++;

    const depth = stateNode.$path.split("/").filter(Boolean).length;
    maxDepth = Math.max(maxDepth, depth);

    const typeName = stateNode.$type.name;
    types[typeName] = (types[typeName] || 0) + 1;
  });

  return {
    nodeCount,
    depth: maxDepth,
    types,
  };
}

/** Create a deep observable copy of a tree */
export function cloneDeep<T>(target: T): T {
  const snapshot = getSnapshot(target);
  const node = getStateTreeNode(target);
  return node.$type.create(snapshot, node.$env) as T;
}

/** Get or create a node by path */
export function getOrCreatePath(
  target: unknown,
  path: string,
  creator: () => unknown,
): unknown {
  const parts = path.split("/").filter(Boolean);
  let node = getStateTreeNode(target);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    let child = node.getChild(part);

    if (!child && i === parts.length - 1) {
      // Last part - create if needed
      const instance = creator();
      if (hasStateTreeNode(instance)) {
        child = getStateTreeNode(instance);
        node.addChild(part, child);
      } else {
        throw new Error(
          "[jotai-state-tree] Creator must return a state tree node",
        );
      }
    }

    if (!child) {
      throw new Error(`[jotai-state-tree] Invalid path: ${path}`);
    }

    node = child;
  }

  return node.getInstance();
}

/** Freeze a node, making it read-only */
export function freeze(target: unknown): void {
  const node = getStateTreeNode(target);
  // Mark node as frozen by setting a flag in volatile state
  node.volatileState.$frozen = true;

  // Freeze all children
  for (const [, child] of node.getChildren()) {
    const instance = child.getInstance();
    if (instance && hasStateTreeNode(instance)) {
      freeze(instance);
    }
  }
}

/** Check if a node is frozen */
export function isFrozen(target: unknown): boolean {
  const node = getStateTreeNode(target);
  return node.volatileState.$frozen === true;
}

/** Unfreeze a node */
export function unfreeze(target: unknown): void {
  const node = getStateTreeNode(target);
  delete node.volatileState.$frozen;

  // Unfreeze all children
  for (const [, child] of node.getChildren()) {
    const instance = child.getInstance();
    if (instance && hasStateTreeNode(instance)) {
      unfreeze(instance);
    }
  }
}
