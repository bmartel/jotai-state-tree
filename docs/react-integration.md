# React Integration

`jotai-state-tree` comes with native React bindings that subscribe dynamically and atomically to state tree nodes. Components re-render only when the specific properties they access during rendering are mutated.

---

## The Observer HOC (`observer`)

Wrap components in `observer` to automatically subscribe to any properties or views accessed during component rendering.

```tsx
import React from 'react';
import { observer } from 'jotai-state-tree/react';

// This component will re-render ONLY if store.count changes
export const CounterView = observer(({ store }) => {
  return (
    <div>
      <p>Count: {store.count}</p>
      <button onClick={() => store.increment()}>+</button>
    </div>
  );
});
```

### The `<Observer>` Component
For fine-grained observation in larger non-observed components:

```tsx
import { Observer } from 'jotai-state-tree/react';

function Dashboard({ store }) {
  return (
    <div>
      <h1>System Dashboard</h1>
      {/* Only this part will re-render when store.status changes */}
      <Observer>
        {() => <span>Status: {store.status}</span>}
      </Observer>
    </div>
  );
}
```

---

## Store Context (Recommended Pattern)

Using a React Context Provider is the cleanest way to make your store instances available to nested components, with type safety fully preserved.

```tsx
// store-context.ts
import { createStoreContext } from 'jotai-state-tree/react';
import { TodoStore } from './store';

// 1. Create typed context utilities
export const { Provider, useStore, useStoreSnapshot, useIsAlive } = createStoreContext<typeof TodoStore>();
```

```tsx
// App.tsx
import React from 'react';
import { Provider } from './store-context';
import { TodoStore } from './store';
import { TodoList } from './TodoList';

export function App() {
  const store = TodoStore.create({ todos: [] });
  
  return (
    <Provider value={store}>
      <TodoList />
    </Provider>
  );
}
```

```tsx
// TodoList.tsx
import React from 'react';
import { useStore, useStoreSnapshot } from './store-context';

export function TodoList() {
  // Access store instance
  const store = useStore();
  
  // Selector-based snapshot subscription
  const completedCount = useStoreSnapshot((s) => s.completedCount);

  return (
    <div>
      <h2>Completed Tasks: {completedCount}</h2>
      <button onClick={() => store.addTodo(Date.now().toString(), 'New Task')}>
        Add Task
      </button>
    </div>
  );
}
```

---

## React Hooks

You can import specialized hooks from `jotai-state-tree/react` to subscribe to snapshots, watch paths, or memoize actions:

### `useSnapshot(node)`
Subscribes the component to the full snapshot of a state tree node. Re-renders on any mutation to the node or its descendants.

```typescript
const snapshot = useSnapshot(store);
```

### `useFineSnapshot(node)`
Returns a reactive Proxy of the state tree snapshot. Re-renders the component **only when properties that were accessed during render are mutated** (fine-grained subscription).

```typescript
// Re-renders ONLY if store.name changes. Other mutations (e.g. store.age) will not trigger a re-render.
const snap = useFineSnapshot(store);
return <div>{snap.name}</div>;
```

#### Comparison: `useSnapshot` vs `useFineSnapshot`

| Feature | `useSnapshot` | `useFineSnapshot` |
| :--- | :--- | :--- |
| **Return Type** | Plain JavaScript Object | JavaScript Proxy |
| **Re-render Scope** | Coarse-grained (on any update to target node/descendants) | Fine-grained (only on accessed properties) |
| **Best For** | Serialization (`JSON.stringify`), React `useEffect` dependency arrays, forms/third-party libraries (e.g. Formik). | Maximizing render performance in complex or nested UI components without HOCs. |

#### Why can't we just make `useSnapshot` fine-grained by default?
In MobX-State-Tree, a "snapshot" specifically means a plain, immutable, serializable state tree dump. Returning a Proxy from `useSnapshot` by default would violate this definition and break crucial features:
1. **Third-Party Libraries**: Many UI or form libraries (e.g., Formik or React Hook Form) clone, check prototypes, or iterate properties, which can trigger infinite loops or crash if given a Proxy.
2. **React Dependency Arrays**: Passing a Proxy to `useEffect` or `useMemo` dependency arrays won't trigger updates because the Proxy reference remains stable across renders. A plain snapshot reference updates when its contents change.
3. **Serialization**: Plain objects are instantly serializable, while Proxies require custom unwrapping or serializing in some environments.

### `useWatchPath(node, path, defaultValue?)`
Subscribes to changes at a specific absolute path in the tree. Highly performant because re-renders are triggered only when that exact path value changes.

```typescript
// Re-renders only if /todos/0/done changes
const isDone = useWatchPath(store, '/todos/0/done', false);
```

### `usePatches(node, callback)`
Execute a callback whenever a patch is applied to the specified node or its descendants.

```typescript
usePatches(store, (patch) => {
  console.log('Patch applied:', patch);
});
```

### `useAction(actionFn)` / `useActions(actionMap)`
Returns memoized versions of actions, preventing unnecessary re-renders of child components that receive callbacks as props.

```typescript
const increment = useAction(store.increment);
const actions = useActions({
  add: store.add,
  remove: store.remove,
});
```

### `useLocalObservable(initializer)`
Creates a local state tree model instance that lives for the lifetime of the component.

```tsx
const store = useLocalObservable(() => 
  types.model({ count: 0 }).actions(self => ({
    increment() { self.count++; }
  })).create({})
);
```

### `useHydrateStore(store, initialSnapshot, options?)`
Hydrates a state tree store (and all its nested properties) with a provided snapshot using Jotai's underlying `useHydrateAtoms` utility. Crucial for React Server-Side Rendering (SSR) hydration mismatch prevention.

```tsx
import { useHydrateStore } from 'jotai-state-tree/react';

function HydratedComponent({ initialSnapshot }) {
  // Hydrates the store's atoms on the client before first render (matches server state)
  useHydrateStore(store, initialSnapshot);

  return <div>{store.title}</div>;
}
```

You can optionally pass a custom Jotai store option in `options?: { store?: ReturnType<typeof getGlobalStore> }` if you are using scoped Jotai stores.

For a comprehensive guide on setting up Server-Side Rendering, request context isolation, and Server Actions (RPC), see the dedicated [Server-Side Rendering](server-side-rendering.md) guide.

---

## Batching Updates

When performing multiple mutations consecutively outside of actions (e.g. in React event handlers when `unprotect` is enabled), wrap them in `batch()` to trigger a single React update/re-render.

> [!NOTE]
> Mutations performed inside model actions are **automatically batched**. You only need to use `batch()` for consecutive calls or asynchronous responses outside of actions.

```typescript
import { batch } from 'jotai-state-tree/react';

function handleBulkUpdates() {
  batch(() => {
    store.increment();
    store.setTheme('dark');
    store.items.push('New Item');
  }); // Component only re-renders once here
}
```

---

## Integrating with Jotai's Store & Provider Architecture

`jotai-state-tree` maintains and reads/writes all state tree values inside a Jotai store. By default, it uses a single global store, but you can configure it to use any custom Jotai store (e.g., for Server-Side Rendering (SSR) or multi-tenant micro-frontend isolation).

### 1. Model Instance Context vs Jotai State Provider
- **Model Instance Context (`createStoreContext`)**: Propagates the actual typed model instance object (its properties, views, and actions API) down the React tree. This is standard React Context propagating a JavaScript object reference.
- **Jotai State Provider (`<Provider>` from `'jotai'`)**: Manages the underlying atom key-value state store.

### 2. Binding to a Custom Jotai Store
If your React application uses Jotai's custom stores or `<Provider>` components for SSR or state isolation:

```tsx
import React, { useMemo } from 'react';
import { Provider as JotaiProvider, useStore as useJotaiStore } from 'jotai';
import { setGlobalStore } from 'jotai-state-tree';
import { createStoreContext } from 'jotai-state-tree/react';
import { TodoStore } from './store';

const { Provider: ModelProvider } = createStoreContext<typeof TodoStore>();

function CustomApp() {
  return (
    <JotaiProvider>
      <AppContent />
    </JotaiProvider>
  );
}

function AppContent() {
  // 1. Get the React-scoped Jotai store instance from the Jotai Provider
  const jotaiStore = useJotaiStore();

  // 2. Bind jotai-state-tree to this Jotai store instance
  useMemo(() => {
    setGlobalStore(jotaiStore);
  }, [jotaiStore]);

  // 3. Create model using this store's scope
  const store = useMemo(() => TodoStore.create({ todos: [] }), []);

  return (
    <ModelProvider store={store}>
      <TodoList />
    </ModelProvider>
  );
}
```
