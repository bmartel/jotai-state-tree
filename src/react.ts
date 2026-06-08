/**
 * React integration for jotai-state-tree
 * Provides observer HOC and hooks
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  forwardRef,
  memo,
  useCallback,
  useSyncExternalStore,
  type ComponentType,
  type ForwardedRef,
  type ReactNode,
  type FC,
} from "react";
import {
  atom,
  useAtom,
  useAtomValue,
  useSetAtom,
  type Atom,
  type WritableAtom,
} from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import {
  getStateTreeNode,
  hasStateTreeNode,
  onSnapshot,
  getSnapshot,
  onLifecycleChange,
  type IDisposer,
  setActiveTrackingFn,
  getActiveTrackingFn,
  onPatch,
  StateTreeNode,
  getGlobalStore,
  applySnapshotToNode,
  getIsApplyingSnapshotOrPatch,
  setIsApplyingSnapshotOrPatch,
} from "./tree";
import {
  createUndoManager,
  createTimeTravelManager,
  getOrCreateHistoryTracker,
  type IUndoManager,
  type ITimeTravelManager,
  type IUndoManagerOptions,
} from "./undo";

import { RouterContext, useRouter } from "./router";

// ============================================================================
// Observer Tracking Context
// ============================================================================

type TrackNodeFn = (node: unknown) => void;
/**
 * Hook to get the current observer tracking function.
 * Used by hooks like useStore to register accessed nodes for reactivity.
 */
export function useObserverTracking(): TrackNodeFn | null {
  const activeFn = getActiveTrackingFn();
  if (activeFn) {
    return (node: unknown) => {
      if (hasStateTreeNode(node)) {
        activeFn(getStateTreeNode(node));
      }
    };
  }

  return null;
}

// ============================================================================
// Observer HOC
// ============================================================================

interface ObserverOptions {
  forwardRef?: boolean;
}

/**
 * Higher-order component that makes a component reactive to state tree changes.
 * Similar to mobx-react-lite's observer.
 */
export function observer<P extends object>(
  Component: ComponentType<P>,
  options?: ObserverOptions,
): ComponentType<P> {
  const displayName = Component.displayName || Component.name || "Component";

  let ObserverComponent: any;

  if (options?.forwardRef) {
    ObserverComponent = memo(forwardRef<unknown, P>((props, ref) => {
      return useObserver(() => {
        if (typeof Component === "function" && !(Component.prototype && Component.prototype.isReactComponent)) {
          return (Component as any)(props, ref);
        }
        return React.createElement(Component, { ...props, ref } as any);
      });
    }));
    ObserverComponent.displayName = `ForwardRef(${displayName})`;
  } else {
    ObserverComponent = memo((props: P) => {
      return useObserver(() => {
        if (typeof Component === "function" && !(Component.prototype && Component.prototype.isReactComponent)) {
          return (Component as any)(props);
        }
        return React.createElement(Component, props);
      });
    });
    ObserverComponent.displayName = `Observer(${displayName})`;
  }

  return ObserverComponent;
}

// ============================================================================
// Observer Component (Render Props)
// ============================================================================

interface ObserverComponentProps {
  children: () => ReactNode;
}

/**
 * Observer component using render props pattern.
 * Useful for inline observation.
 *
 * @example
 * <Observer>
 *   {() => <div>{store.count}</div>}
 * </Observer>
 */
export const Observer: FC<ObserverComponentProps> = observer(({ children }) => {
  return React.createElement(React.Fragment, null, children());
}) as FC<ObserverComponentProps>;

// ============================================================================
// useObserver Hook
// ============================================================================

/**
 * Hook that re-renders the component when any accessed state tree nodes change.
 */
export function useObserver<T>(fn: () => T): T {
  const [, forceUpdate] = useState({});
  const nextTrackedNodesRef = useRef<Set<StateTreeNode>>(new Set());
  const subscriptionsRef = useRef<Map<StateTreeNode, IDisposer>>(new Map());

  // Clear nextTrackedNodesRef at the beginning of this render
  nextTrackedNodesRef.current = new Set();

  // Update subscriptions on every render
  useEffect(() => {
    const nextNodes = nextTrackedNodesRef.current;
    const currentSubscriptions = subscriptionsRef.current;

    // Unsubscribe from nodes no longer accessed
    for (const [node, disposer] of currentSubscriptions.entries()) {
      if (!nextNodes.has(node)) {
        disposer();
        currentSubscriptions.delete(node);
      }
    }

    // Subscribe to newly accessed nodes
    const store = getGlobalStore();
    for (const node of nextNodes) {
      if (!currentSubscriptions.has(node)) {
        const disposer = store.sub(node.valueAtom, () => {
          forceUpdate({});
        });
        currentSubscriptions.set(node, disposer);
      }
    }
  }); // Runs on every render

  // Unsubscribe on unmount
  useEffect(() => {
    return () => {
      for (const disposer of subscriptionsRef.current.values()) {
        disposer();
      }
      subscriptionsRef.current.clear();
    };
  }, []);

  // Execute the function under active tracking
  const prevTrackingFn = getActiveTrackingFn();
  setActiveTrackingFn((node) => {
    nextTrackedNodesRef.current.add(node);
  });

  try {
    return fn();
  } finally {
    setActiveTrackingFn(prevTrackingFn);
  }
}

// ============================================================================
// useLocalObservable Hook
// ============================================================================

/**
 * Creates a local observable state tree instance.
 * Similar to mobx-react-lite's useLocalObservable.
 */
export function useLocalObservable<T>(
  initializer: () => T,
  dependencies: unknown[] = [],
): T {
  const store = useMemo(initializer, dependencies);
  if (hasStateTreeNode(store)) {
    const node = getStateTreeNode(store);
    useAtomValue(node.snapshotAtom, { store: getGlobalStore() });
  }
  return store;
}

// ============================================================================
// useStore Hook with useSyncExternalStore
// ============================================================================

/**
 * Use a state tree instance with React's useSyncExternalStore.
 * This provides better concurrent mode support.
 */
export function useSyncedStore<T>(store: T): T {
  if (!hasStateTreeNode(store)) {
    return store;
  }
  const node = getStateTreeNode(store);
  useAtomValue(node.snapshotAtom, { store: getGlobalStore() });
  return store;
}

// ============================================================================
// Provider Component - Legacy (untyped)
// ============================================================================

interface StoreContextValue<T> {
  store: T;
}

const StoreContext = React.createContext<StoreContextValue<unknown> | null>(
  null,
);

interface ProviderProps<T> {
  store: T;
  children: ReactNode;
}

/**
 * Provider component for state tree stores.
 * @deprecated Use createStoreContext() for better type inference
 */
export function Provider<T>({
  store,
  children,
}: ProviderProps<T>): JSX.Element {
  const value = useMemo(() => ({ store }), [store]);
  return React.createElement(StoreContext.Provider, { value }, children);
}

/**
 * Hook to access the store from context.
 * @deprecated Use createStoreContext() for better type inference
 */
export function useStore<T>(): T {
  const context = React.useContext(StoreContext);
  if (!context) {
    throw new Error(
      "[jotai-state-tree] useStore must be used within a Provider",
    );
  }
  return context.store as T;
}

/**
 * Hook to access the store with snapshot subscription.
 * @deprecated Use createStoreContext() for better type inference
 */
export function useStoreSnapshot<T>(): T;
export function useStoreSnapshot<T, S>(selector: (store: T) => S): S;
export function useStoreSnapshot<T, S>(selector?: (store: T) => S): T | S {
  const store = useStore<T>();
  if (!hasStateTreeNode(store)) {
    return store;
  }
  const node = getStateTreeNode(store);
  useAtomValue(node.snapshotAtom, { store: getGlobalStore() });
  return selector ? selector(store) : store;
}

// ============================================================================
// Typed Store Context Factory
// ============================================================================

/**
 * Creates a typed store context with Provider and hooks.
 * This provides full type inference without needing to specify generic types.
 *
 * @example
 * const RootStore = types.model("RootStore", {
 *   count: types.number,
 * }).actions(self => ({
 *   increment() { self.count += 1; }
 * }));
 *
 * type RootStoreInstance = Instance<typeof RootStore>;
 *
 * const { Provider, useStore, useStoreSnapshot } = createStoreContext<RootStoreInstance>();
 *
 * // In your app:
 * const store = RootStore.create({ count: 0 });
 * <Provider store={store}>
 *   <App />
 * </Provider>
 *
 * // In components:
 * const store = useStore(); // Fully typed!
 * store.increment(); // Type-safe
 */
export function createStoreContext<T>() {
  const Context = React.createContext<T | null>(null);

  function StoreProvider({
    store,
    children,
  }: {
    store: T;
    children: ReactNode;
  }): JSX.Element {
    return React.createElement(Context.Provider, { value: store }, children);
  }

  function useTypedStore(): T {
    const store = React.useContext(Context);
    if (store === null) {
      throw new Error(
        "[jotai-state-tree] useStore must be used within a Provider",
      );
    }
    return store;
  }

  function useTypedStoreSnapshot(): T;
  function useTypedStoreSnapshot<S>(selector: (store: T) => S): S;
  function useTypedStoreSnapshot<S>(selector?: (store: T) => S): T | S {
    const store = useTypedStore();
    if (!hasStateTreeNode(store)) {
      return store;
    }
    const node = getStateTreeNode(store);
    useAtomValue(node.snapshotAtom, { store: getGlobalStore() });
    return selector ? selector(store) : store;
  }

  /**
   * Hook that returns whether the store is alive.
   */
  function useTypedIsAlive(): boolean {
    const store = useTypedStore();
    return useIsAlive(store);
  }

  return {
    Provider: StoreProvider,
    useStore: useTypedStore,
    useStoreSnapshot: useTypedStoreSnapshot,
    useIsAlive: useTypedIsAlive,
    Context,
  };
}

// ============================================================================
// Snapshot Hooks
// ============================================================================

export function useSnapshot<T>(target: unknown): T {
  if (!hasStateTreeNode(target)) {
    return target as T;
  }
  const node = getStateTreeNode(target);
  return useAtomValue(node.snapshotAtom, { store: getGlobalStore() }) as T;
}

/**
 * Hook to watch specific paths in a state tree
 */
export function useWatchPath<T>(
  target: unknown,
  path: string,
  defaultValue?: T,
): T {
  if (!hasStateTreeNode(target)) {
    return defaultValue as T;
  }
  const node = getStateTreeNode(target);
  const pathAtom = useMemo(() => {
    return atom((get) => {
      const snapshot = get(node.snapshotAtom) as Record<string, unknown>;
      const parts = path.split(".");
      let current: unknown = snapshot;
      for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return defaultValue as T;
        }
      }
      return current as T;
    });
  }, [node, path, defaultValue]);

  return useAtomValue(pathAtom, { store: getGlobalStore() });
}

/**
 * Hook that subscribes to patches on a node.
 */
export function usePatches(
  target: unknown,
  callback: (patch: { op: string; path: string; value?: unknown }) => void,
): void {
  useEffect(() => {
    const disposer = onPatch(target, callback);
    return disposer;
  }, [target, callback]);
}

// ============================================================================
// Action Hooks
// ============================================================================

/**
 * Hook that returns an action bound to a store.
 * Useful for passing actions to child components.
 */
export function useAction<T extends (...args: unknown[]) => unknown>(
  action: T,
): T {
  return useMemo(() => action, [action]);
}

/**
 * Hook that returns multiple actions bound to a store.
 */
export function useActions<
  T extends Record<string, (...args: unknown[]) => unknown>,
>(actions: T): T {
  return useMemo(() => actions, [actions]);
}

// ============================================================================
// Observer Batching
// ============================================================================

let batchDepth = 0;
let pendingUpdates: Set<() => void> = new Set();

/**
 * Batch multiple state updates to trigger a single re-render.
 */
export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0 && pendingUpdates.size > 0) {
      const updates = pendingUpdates;
      pendingUpdates = new Set();
      updates.forEach((update) => update());
    }
  }
}

/**
 * Schedule an update, batching if we're inside a batch() call.
 */
export function scheduleUpdate(update: () => void): void {
  if (batchDepth > 0) {
    pendingUpdates.add(update);
  } else {
    update();
  }
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook that returns whether a node is alive.
 * Uses proper subscription instead of polling for better performance.
 */
export function useIsAlive(target: unknown): boolean {
  if (!hasStateTreeNode(target)) return false;
  const node = getStateTreeNode(target);
  return useAtomValue(node.isAliveAtom, { store: getGlobalStore() });
}

/**
 * Hook that ensures cleanup when a component unmounts
 */
export function useCleanup(cleanupFn: () => void): void {
  const cleanupRef = useRef(cleanupFn);
  cleanupRef.current = cleanupFn;

  useEffect(() => {
    return () => {
      cleanupRef.current();
    };
  }, []);
}

// ============================================================================
// Hydration Hooks
// ============================================================================

function getValueAtPath(obj: any, path: string): any {
  if (path === "") return obj;
  const parts = path.split("/").filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Hydrates a state tree node (and all its sub-nodes/properties)
 * with a provided snapshot using Jotai's useHydrateAtoms.
 * Crucial for React SSR hydration mismatch prevention.
 */
export function useHydrateStore(
  target: unknown,
  snapshot: unknown,
  options?: { store?: ReturnType<typeof getGlobalStore> }
): void {
  if (!hasStateTreeNode(target) || !snapshot) {
    return;
  }

  const node = getStateTreeNode(target);

  // Apply the snapshot structure to the tree first so that child nodes exist
  useMemo(() => {
    const wasApplying = getIsApplyingSnapshotOrPatch();
    setIsApplyingSnapshotOrPatch(true);
    try {
      applySnapshotToNode(node, snapshot);
    } finally {
      setIsApplyingSnapshotOrPatch(wasApplying);
    }
  }, [node, snapshot]);

  const pairs = useMemo(() => {
    const collectedPairs: [WritableAtom<any, any[], any>, unknown][] = [];
    
    function collect(n: any) {
      const val = getValueAtPath(snapshot, n.$path);
      if (val !== undefined && n.valueAtom) {
        collectedPairs.push([n.valueAtom, val]);
      }
      if (n instanceof StateTreeNode) {
        for (const child of (n as any).children.values()) {
          collect(child);
        }
      }
    }

    collect(node);
    return collectedPairs;
  }, [node, snapshot]);

  if (pairs.length > 0) {
    useHydrateAtoms(pairs, { store: options?.store ?? getGlobalStore() });
  }
}

// ============================================================================
// Re-exports from tree for convenience
// ============================================================================

export { hasStateTreeNode };

// ============================================================================
// Undo/Redo & Time Travel Hooks
// ============================================================================

/**
 * Hook to create and use an UndoManager.
 * Automatically handles the subscription lifecycle and triggers re-renders on changes.
 */
export function useUndoManager(
  target: unknown,
  options?: IUndoManagerOptions,
): IUndoManager {
  if (!target || typeof target !== "object") {
    throw new Error("[jotai-state-tree] target must be an object");
  }

  const tracker = getOrCreateHistoryTracker(target, options);
  tracker.autoRecord = true; // UndoManager always auto-records
  const historyState = useAtomValue(tracker.historyAtom, { store: getGlobalStore() });

  return useMemo(() => {
    return {
      get canUndo() {
        return historyState.currentIndex >= 0;
      },
      get canRedo() {
        return historyState.currentIndex < historyState.entries.length - 1;
      },
      get undoLevels() {
        return historyState.currentIndex + 1;
      },
      get redoLevels() {
        return historyState.entries.length - historyState.currentIndex - 1;
      },
      get history() {
        return historyState.entries;
      },
      get historyIndex() {
        return historyState.currentIndex;
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
  }, [tracker, historyState]);
}

/**
 * Hook to create and use a TimeTravelManager.
 * Automatically handles the subscription lifecycle and triggers re-renders on changes.
 */
export function useTimeTravelManager(
  target: unknown,
  options?: {
    maxSnapshots?: number;
    autoRecord?: boolean;
  },
): ITimeTravelManager {
  if (!target || typeof target !== "object") {
    throw new Error("[jotai-state-tree] target must be an object");
  }

  const tracker = getOrCreateHistoryTracker(target, options);
  if (options?.autoRecord) {
    tracker.autoRecord = true;
  }
  const historyState = useAtomValue(tracker.historyAtom, { store: getGlobalStore() });

  return useMemo(() => {
    const snapshotsCount = historyState.entries.length + 1;
    const currentSnapshotIndex = historyState.currentIndex + 1;

    return {
      get currentIndex() {
        return currentSnapshotIndex;
      },
      get snapshotCount() {
        return snapshotsCount;
      },
      get canGoBack() {
        return currentSnapshotIndex > 0;
      },
      get canGoForward() {
        return currentSnapshotIndex < snapshotsCount - 1;
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
  }, [tracker, historyState]);
}

// ============================================================================
// State Router Bindings
// ============================================================================

export { RouterContext, useRouter };

interface RouteViewProps {
  router?: any;
  pages: Record<string, React.ComponentType<any>>;
  fallback?: React.ReactNode;
}

export const RouteView = observer(function RouteView({ router, pages, fallback }: RouteViewProps) {
  const activeRouter = router || React.useContext(RouterContext);
  if (!activeRouter) {
    throw new Error("[jotai-state-tree] RouteView must be provided a router prop or used within a RouterContext.Provider");
  }
  
  const routeName = activeRouter.currentRouteName;
  if (!routeName || !pages[routeName]) {
    return fallback !== undefined ? React.createElement(React.Fragment, null, fallback) : null;
  }
  
  const Component = pages[routeName];
  const props = {
    ...activeRouter.params,
    query: activeRouter.query,
  };
  
  return React.createElement(Component, props);
});

// ============================================================================
// Type Exports
// ============================================================================

export type { ObserverOptions, RouteViewProps };
