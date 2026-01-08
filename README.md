# jotai-state-tree

A MobX-State-Tree (MST) compatible state management library powered by [Jotai](https://jotai.org/).

## Features

- 🌳 **MST-Compatible API** - Familiar `types.model`, `types.array`, `types.map` and more
- ⚛️ **Powered by Jotai** - Leverages Jotai's atomic state model for performance
- 🔄 **Snapshots & Patches** - Full support for `getSnapshot`, `applySnapshot`, `onPatch`
- 📍 **Tree Navigation** - `getRoot`, `getParent`, `getPath`, `resolvePath`
- 🔗 **References** - Type-safe references with `types.reference` and `types.safeReference`
- ⏪ **Undo/Redo** - Built-in undo manager and time-travel debugging
- ⚛️ **React Integration** - `observer` HOC and hooks for React
- 🔒 **TypeScript** - Full type safety with inference

## Installation

```bash
npm install jotai-state-tree jotai
# or
yarn add jotai-state-tree jotai
# or
pnpm add jotai-state-tree jotai
```

## Quick Start

```typescript
import { types, getSnapshot, applySnapshot } from 'jotai-state-tree';

// Define your models
const Todo = types
  .model('Todo', {
    id: types.identifier,
    title: types.string,
    done: types.optional(types.boolean, false),
  })
  .actions((self) => ({
    toggle() {
      self.done = !self.done;
    },
  }));

const TodoStore = types
  .model('TodoStore', {
    todos: types.array(Todo),
  })
  .views((self) => ({
    get completedCount() {
      return self.todos.filter((t) => t.done).length;
    },
  }))
  .actions((self) => ({
    addTodo(title: string) {
      self.todos.push({ id: `${Date.now()}`, title });
    },
  }));

// Create and use
const store = TodoStore.create({ todos: [] });
store.addTodo('Learn jotai-state-tree');
store.todos[0].toggle();
console.log(getSnapshot(store));
```

## React Integration

```tsx
import { observer, Provider, useStore } from 'jotai-state-tree/react';

const TodoList = observer(({ store }) => (
  <ul>
    {store.todos.map((todo) => (
      <li key={todo.id} onClick={() => todo.toggle()}>
        {todo.done ? '✓' : '○'} {todo.title}
      </li>
    ))}
  </ul>
));
```

## API Reference

### Types

| Type | Description |
|------|-------------|
| `types.string` | String values |
| `types.number` | Number values |
| `types.boolean` | Boolean values |
| `types.integer` | Integer values |
| `types.Date` | Date objects |
| `types.identifier` | String identifier |
| `types.identifierNumber` | Number identifier |
| `types.model(name, props)` | Model type |
| `types.array(type)` | Observable array |
| `types.map(type)` | Observable map |
| `types.optional(type, default)` | Optional with default |
| `types.maybe(type)` | Type or undefined |
| `types.maybeNull(type)` | Type or null |
| `types.union(...types)` | Union type |
| `types.literal(value)` | Literal type |
| `types.enumeration(values)` | Enumeration |
| `types.frozen<T>()` | Frozen immutable |
| `types.late(() => type)` | Lazy/recursive type |
| `types.reference(type)` | Reference to model |
| `types.safeReference(type)` | Safe reference |
| `types.refinement(type, predicate)` | Refined type |

### Tree Utilities

```typescript
getSnapshot(node)           // Get snapshot
applySnapshot(node, snap)   // Apply snapshot
onSnapshot(node, listener)  // Listen to changes
onPatch(node, listener)     // Listen to patches
applyPatch(node, patch)     // Apply patch
getRoot(node)               // Get root
getParent(node)             // Get parent
getPath(node)               // Get path string
getEnv(node)                // Get environment
isAlive(node)               // Check if alive
destroy(node)               // Destroy node
clone(node)                 // Clone node
walk(node, visitor)         // Walk tree
```

### Undo/Redo

```typescript
import { createUndoManager } from 'jotai-state-tree';

const undoManager = createUndoManager(store);
undoManager.undo();
undoManager.redo();
undoManager.startGroup();
undoManager.endGroup();
undoManager.clear();
undoManager.dispose();
```

### Time Travel

```typescript
import { createTimeTravelManager } from 'jotai-state-tree';

const timeTravel = createTimeTravelManager(store);
timeTravel.record();
timeTravel.goBack();
timeTravel.goForward();
timeTravel.goTo(index);
```

## Migration from MST

```typescript
// Before (MST)
import { types } from 'mobx-state-tree';
import { observer } from 'mobx-react-lite';

// After (jotai-state-tree)
import { types } from 'jotai-state-tree';
import { observer } from 'jotai-state-tree/react';
```

## License

MIT
