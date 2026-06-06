# Getting Started with jotai-state-tree

`jotai-state-tree` is a state management library that provides the API and features of MobX-State-Tree (MST) but runs on top of [Jotai](https://jotai.org/)'s atomic state model. It gives you tree-structured state, snapshots, JSON patches, references, and actions, combined with the zero-leak, high-performance, and excellent React integration of Jotai.

---

## Installation

Install `jotai-state-tree` and `jotai` using your package manager of choice:

```bash
# Using npm
npm install jotai-state-tree jotai

# Using yarn
yarn add jotai-state-tree jotai

# Using pnpm
pnpm add jotai-state-tree jotai
```

### Peer Dependencies
- `jotai`: `>=2.0.0`
- `react`: `>=18.0.0` (Optional, only required if you use React bindings)

---

## Core Concepts

If you are coming from MobX-State-Tree, the concepts are identical. If you are new to state tree models:

1. **The State Tree**: Your application state is organized in a tree of models. Every node in the tree is typed and knows its path from the root.
2. **Models**: Models are definitions of state nodes. They specify:
   - **Properties**: Writable fields (primitives, arrays, maps, or other models).
   - **Views**: Computed values derived from properties (re-calculated only when properties change).
   - **Actions**: The only place where state mutations are allowed.
3. **Snapshots**: Immutable, plain JavaScript object representations of the tree's state. You can serialize snapshots to JSON, store them in localStorage, or hot-reload them.
4. **Patches**: JSON-Patch compliant descriptors of changes (e.g. `{ op: "replace", path: "/todos/0/done", value: true }`). Great for undo/redo or syncing over WebSockets.
5. **References**: You can refer to other nodes in the tree by their identifier (e.g. an author ID inside a book node). `jotai-state-tree` resolves these references lazily and safely.

---

## Quick Start

Here is a complete, copy-pasteable example of defining a simple Task Board store.

```typescript
import { types, getSnapshot, applySnapshot, onSnapshot } from 'jotai-state-tree';

// 1. Define the Todo model
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
    setTitle(newTitle: string) {
      self.title = newTitle;
    }
  }));

// 2. Define the TodoStore container model
const TodoStore = types
  .model('TodoStore', {
    todos: types.array(Todo),
  })
  .views((self) => ({
    get completedCount() {
      return self.todos.filter((t) => t.done).length;
    },
    get uncompletedCount() {
      return self.todos.length - self.completedCount;
    }
  }))
  .actions((self) => ({
    addTodo(id: string, title: string) {
      self.todos.push({ id, title });
    },
    removeTodo(id: string) {
      const todo = self.todos.find(t => t.id === id);
      if (todo) {
        self.todos.remove(todo);
      }
    }
  }));

// 3. Instantiate the store
const store = TodoStore.create({
  todos: [
    { id: '1', title: 'Install jotai-state-tree', done: true }
  ]
});

// 4. Listen to snapshot changes (for localStorage persistence)
onSnapshot(store, (snapshot) => {
  console.log('New Snapshot:', JSON.stringify(snapshot, null, 2));
});

// 5. Interact with the store using actions
store.addTodo('2', 'Build an awesome web app');
console.log('Uncompleted tasks:', store.uncompletedCount); // 1

store.todos[1].toggle();
console.log('Uncompleted tasks:', store.uncompletedCount); // 0
```

---

## Next Steps

Now that you have your first store running:
- Learn in-depth about views, actions, and lifecycle hooks in [Models & State](models-and-state.md).
- Explore all types, identifiers, unions, and late definitions in [Types & Composition](types-and-composition.md).
- Integrate your store with React components using hooks in [React Integration](react-integration.md).
