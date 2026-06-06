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
