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
  useAtom,
  useAtomValue,
  useSetAtom,
  type Atom,
  type WritableAtom,
} from "jotai";
import {
  getStateTreeNode,
  hasStateTreeNode,
  onSnapshot,
  getSnapshot,
  onLifecycleChange,
  type IDisposer,
} from "./tree";

// ============================================================================
// Observer Tracking Context
// ============================================================================

type TrackNodeFn = (node: unknown) => void;
const ObserverTrackingContext = React.createContext<TrackNodeFn | null>(null);

/**
 * Hook to get the current observer tracking function.
 * Used by hooks like useStore to register accessed nodes for reactivity.
 */
export function useObserverTracking(): TrackNodeFn | null {
  return React.useContext(ObserverTrackingContext);
}

// ============================================================================
// Observer HOC
// ============================================================================

interface ObserverOptions {
  forwardRef?: boolean;
  /** Enable debug logging to console */
  debug?: boolean;
}

/** Global debug flag for observer - set to true to enable logging */
export let observerDebug = false;

/** Enable/disable observer debug logging globally */
export function setObserverDebug(enabled: boolean) {
  observerDebug = enabled;
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
  const debug = options?.debug || observerDebug;

  const ObserverComponent = memo((props: P) => {
    const [renderCount, forceUpdate] = useState(0);
    const disposersRef = useRef<Set<IDisposer>>(new Set());
    const trackedNodesRef = useRef<Set<unknown>>(new Set());

    if (debug) {
      console.log(`[observer:${displayName}] render #${renderCount + 1}, tracked nodes: ${trackedNodesRef.current.size}, subscriptions: ${disposersRef.current.size}`);
    }

    // Track which state tree nodes are accessed during render
    const trackNode = (node: unknown) => {
      if (debug) {
        console.log(`[observer:${displayName}] trackNode called, hasStateTreeNode: ${hasStateTreeNode(node)}, already tracked: ${trackedNodesRef.current.has(node)}`);
      }
      if (hasStateTreeNode(node) && !trackedNodesRef.current.has(node)) {
        trackedNodesRef.current.add(node);
        if (debug) {
          console.log(`[observer:${displayName}] creating subscription for node`);
        }
        const disposer = onSnapshot(node, () => {
          if (debug) {
            console.log(`[observer:${displayName}] onSnapshot fired, calling forceUpdate`);
          }
          forceUpdate(c => c + 1);
        });
        disposersRef.current.add(disposer);
        if (debug) {
          console.log(`[observer:${displayName}] subscription created, total subscriptions: ${disposersRef.current.size}`);
        }
      }
    };

    // Create a proxy for tracking property access
    const createTrackingProxy = <T extends object>(target: T): T => {
      if (!target || typeof target !== "object") return target;
      if (hasStateTreeNode(target)) {
        trackNode(target);
      }

      return new Proxy(target, {
        get(obj, prop) {
          const value = (obj as Record<string | symbol, unknown>)[prop];
          if (value && typeof value === "object" && hasStateTreeNode(value)) {
            trackNode(value);
            return createTrackingProxy(value as object);
          }
          return value;
        },
      }) as T;
    };

    // Clear old subscriptions on re-render
    useEffect(() => {
      return () => {
        disposersRef.current.forEach((d) => d());
        disposersRef.current.clear();
        trackedNodesRef.current.clear();
      };
    }, []);

    // Wrap props that might be state tree nodes
    const trackedProps = useMemo(() => {
      const tracked: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) {
        if (value && typeof value === "object") {
          tracked[key] = createTrackingProxy(value as object);
        } else {
          tracked[key] = value;
        }
      }
      return tracked as P;
    }, [props]);

    // Provide tracking context so hooks can register their accessed nodes
    return React.createElement(
      ObserverTrackingContext.Provider,
      { value: trackNode },
      React.createElement(Component, trackedProps)
    );
  });

  ObserverComponent.displayName = `Observer(${displayName})`;

  if (options?.forwardRef) {
    const ForwardedComponent = forwardRef<unknown, P>((props, ref) => {
      const propsWithRef = Object.assign({}, props, { ref });
      return React.createElement(
        ObserverComponent as unknown as ComponentType<P>,
        propsWithRef as P,
      );
    });
    ForwardedComponent.displayName = `ForwardRef(${displayName})`;
    return ForwardedComponent as unknown as ComponentType<P>;
  }

  return ObserverComponent as unknown as ComponentType<P>;
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
  const disposersRef = useRef<IDisposer[]>([]);
  const trackedNodes = useRef<Set<unknown>>(new Set());

  // Clear previous subscriptions
  useEffect(() => {
    return () => {
      disposersRef.current.forEach((d) => d());
      disposersRef.current = [];
    };
  }, []);

  // Execute the function and track accessed nodes
  const result = useMemo(() => {
    // Clear previous tracking
    trackedNodes.current.clear();
    disposersRef.current.forEach((d) => d());
    disposersRef.current = [];

    // Execute and capture result
    const value = fn();

    return value;
  }, [fn]);

  return result;
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
  const [, forceUpdate] = useState({});
  const storeRef = useRef<T | null>(null);
  const disposerRef = useRef<IDisposer | null>(null);

  // Initialize store
  if (storeRef.current === null) {
    storeRef.current = initializer();

    // Subscribe to changes
    if (hasStateTreeNode(storeRef.current)) {
      disposerRef.current = onSnapshot(storeRef.current, () => {
        forceUpdate({});
      });
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disposerRef.current?.();
    };
  }, []);

  // Reinitialize if dependencies change
  useEffect(() => {
    if (dependencies.length > 0) {
      disposerRef.current?.();
      storeRef.current = initializer();
      if (hasStateTreeNode(storeRef.current)) {
        disposerRef.current = onSnapshot(storeRef.current, () => {
          forceUpdate({});
        });
      }
    }
  }, dependencies);

  return storeRef.current;
}

// ============================================================================
// useStore Hook with useSyncExternalStore
// ============================================================================

/**
 * Use a state tree instance with React's useSyncExternalStore.
 * This provides better concurrent mode support.
 */
export function useSyncedStore<T>(store: T): T {
  // Cache the snapshot to provide stable reference for useSyncExternalStore
  const snapshotRef = useRef<unknown>(null);

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!hasStateTreeNode(store)) {
        return () => {};
      }
      return onSnapshot(store, () => {
        // Update cached snapshot on change
        snapshotRef.current = getSnapshot(store);
        callback();
      });
    },
    [store],
  );

  const getSnapshotValue = useCallback(() => {
    if (!hasStateTreeNode(store)) {
      return null;
    }
    // Return cached snapshot for stable reference comparison
    if (snapshotRef.current === null) {
      snapshotRef.current = getSnapshot(store);
    }
    return snapshotRef.current;
  }, [store]);

  useSyncExternalStore(subscribe, getSnapshotValue, getSnapshotValue);

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
  // If inside an observer component, track the store for reactivity
  const trackNode = useObserverTracking();
  if (trackNode && hasStateTreeNode(context.store)) {
    trackNode(context.store);
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
  const [, forceUpdate] = useState({});

  useEffect(() => {
    if (hasStateTreeNode(store)) {
      return onSnapshot(store, () => {
        forceUpdate({});
      });
    }
    return () => {};
  }, [store]);

  if (selector) {
    return selector(store);
  }

  return store;
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
    // If inside an observer component, track the store for reactivity
    const trackNode = useObserverTracking();
    if (trackNode && hasStateTreeNode(store)) {
      trackNode(store);
    }
    return store;
  }

  function useTypedStoreSnapshot(): T;
  function useTypedStoreSnapshot<S>(selector: (store: T) => S): S;
  function useTypedStoreSnapshot<S>(selector?: (store: T) => S): T | S {
    const store = useTypedStore();
    const [, forceUpdate] = useState({});

    useEffect(() => {
      if (hasStateTreeNode(store)) {
        return onSnapshot(store, () => {
          forceUpdate({});
        });
      }
      return () => {};
    }, [store]);

    if (selector) {
      return selector(store);
    }

    return store;
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

/**
 * Hook that returns the current snapshot and re-renders on changes.
 */
export function useSnapshot<T>(target: unknown): T {
  const [snapshot, setSnapshot] = useState<T>(() => getSnapshot(target));

  useEffect(() => {
    const disposer = onSnapshot(target, (newSnapshot) => {
      setSnapshot(newSnapshot as T);
    });
    return disposer;
  }, [target]);

  return snapshot;
}

/**
 * Hook to watch specific paths in a state tree
 */
export function useWatchPath<T>(
  target: unknown,
  path: string,
  defaultValue?: T,
): T {
  const [value, setValue] = useState<T>(() => {
    const snapshot = getSnapshot(target) as Record<string, unknown>;
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

  useEffect(() => {
    const disposer = onSnapshot(target, (newSnapshot) => {
      const snapshot = newSnapshot as Record<string, unknown>;
      const parts = path.split(".");
      let current: unknown = snapshot;
      for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          setValue(defaultValue as T);
          return;
        }
      }
      setValue(current as T);
    });
    return disposer;
  }, [target, path, defaultValue]);

  return value;
}

/**
 * Hook that subscribes to patches on a node.
 */
export function usePatches(
  target: unknown,
  callback: (patch: { op: string; path: string; value?: unknown }) => void,
): void {
  useEffect(() => {
    const { onPatch } = require("./tree");
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
  const [isAlive, setIsAlive] = useState(() => {
    if (!hasStateTreeNode(target)) return false;
    return getStateTreeNode(target).$isAlive;
  });

  useEffect(() => {
    if (!hasStateTreeNode(target)) return;

    const node = getStateTreeNode(target);
    setIsAlive(node.$isAlive);

    // Subscribe to lifecycle changes using proper event system
    // This is much more efficient than polling
    const disposer = onLifecycleChange(node, (alive) => {
      setIsAlive(alive);
    });

    return disposer;
  }, [target]);

  return isAlive;
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
// Re-exports from tree for convenience
// ============================================================================

export { hasStateTreeNode };

// ============================================================================
// Type Exports
// ============================================================================

export type { ObserverOptions };
