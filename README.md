# jotai-state-tree

A MobX-State-Tree (MST) compatible state management library powered by [Jotai](https://jotai.org/).

## Features

- **MST-Compatible API** - Familiar `types.model`, `types.array`, `types.map` and more
- **Powered by Jotai** - Leverages Jotai's atomic state model for performance
- **Snapshots & Patches** - Full support for `getSnapshot`, `applySnapshot`, `onPatch`
- **Tree Navigation** - `getRoot`, `getParent`, `getPath`, `resolvePath`
- **References** - Type-safe references with `types.reference` and `types.safeReference`
- **Undo/Redo** - Built-in undo manager and time-travel debugging
- **React Integration** - `observer` HOC and hooks for React
- **Mixins** - Reusable, type-safe mixins with `types.mixin` and `.apply()`
- **Model Registry** - Dynamic model registration and resolution
- **TypeScript** - Full type safety with inference

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

## Table of Contents

- [Types](#types)
  - [Primitive Types](#primitive-types)
  - [Identifier Types](#identifier-types)
  - [Collection Types](#collection-types)
  - [Optional & Nullable Types](#optional--nullable-types)
  - [Union & Composition Types](#union--composition-types)
  - [Reference Types](#reference-types)
  - [Other Types](#other-types)
- [Models](#models)
  - [Defining Models](#defining-models)
  - [Views](#views)
  - [Actions](#actions)
  - [Volatile State](#volatile-state)
  - [Lifecycle Hooks](#lifecycle-hooks)
  - [Extend Method](#extend-method)
  - [Snapshot Processing](#snapshot-processing)
- [Mixins](#mixins)
- [Model Composition](#model-composition)
- [Tree Utilities](#tree-utilities)
- [React Integration](#react-integration)
- [Undo/Redo & Time Travel](#undoredo--time-travel)
- [Model Registry](#model-registry)
- [Middleware](#middleware)
- [Flow (Async Actions)](#flow-async-actions)
- [Type Utilities](#type-utilities)
- [Migration from MST](#migration-from-mst)

---

## Types

### Primitive Types

| Type | Description |
|------|-------------|
| `types.string` | String values |
| `types.number` | Number values (floats) |
| `types.integer` | Integer values only |
| `types.boolean` | Boolean values |
| `types.finite` | Finite numbers (excludes Infinity) |
| `types.float` | Alias for number |
| `types.Date` | Date objects (stored as timestamp) |
| `types.null` | Null values |
| `types.undefined` | Undefined values |

### Identifier Types

```typescript
const User = types.model('User', {
  id: types.identifier,           // String identifier
  numericId: types.identifierNumber,  // Number identifier
});
```

### Collection Types

**Array Type:**

```typescript
const TodoList = types.model('TodoList', {
  items: types.array(Todo),
});

// Array methods
list.items.push({ id: '1', title: 'New' });
list.items.replace([...]); // Replace all items
list.items.clear();        // Remove all items
list.items.remove(item);   // Remove specific item
```

**Map Type:**

```typescript
const UserStore = types.model('UserStore', {
  users: types.map(User),
});

// Map methods
store.users.set('user-1', { id: 'user-1', name: 'John' });
store.users.put({ id: 'user-2', name: 'Jane' }); // Uses identifier as key
store.users.merge({ 'user-3': { id: 'user-3', name: 'Bob' } });
store.users.delete('user-1');
```

### Optional & Nullable Types

```typescript
types.optional(types.string, '')      // Default value when undefined
types.optional(types.number, () => Date.now()) // Factory default

types.maybe(types.string)             // string | undefined
types.maybeNull(types.string)         // string | null
```

### Union & Composition Types

```typescript
// Union type
const Status = types.union(
  types.literal('pending'),
  types.literal('done'),
  types.literal('error')
);

// Union with dispatcher
const Shape = types.union(
  { dispatcher: (snapshot) => snapshot.type === 'circle' ? Circle : Rectangle },
  Circle,
  Rectangle
);

// Late type (for recursive/circular references)
const TreeNode = types.model('TreeNode', {
  value: types.string,
  children: types.array(types.late(() => TreeNode)),
});

// Refinement type
const PositiveNumber = types.refinement(
  types.number,
  (value) => value > 0,
  'Value must be positive'
);

// Literal type
const Direction = types.literal('north');

// Enumeration
const Color = types.enumeration('Color', ['red', 'green', 'blue']);
```

### Reference Types

```typescript
const Author = types.model('Author', {
  id: types.identifier,
  name: types.string,
});

const Book = types.model('Book', {
  title: types.string,
  author: types.reference(Author),           // Throws if not found
  editor: types.safeReference(Author),       // Returns undefined if not found
});

// Custom reference options
const customRef = types.reference(Author, {
  get(identifier, parent) {
    return resolveAuthor(identifier);
  },
  set(author) {
    return author.id;
  },
  onInvalidated({ parent, invalidId, replaceRef, removeRef, cause }) {
    removeRef(); // or replaceRef(newAuthor)
  },
});
```

### Other Types

```typescript
// Frozen (immutable deep objects)
const Config = types.model('Config', {
  settings: types.frozen<{ theme: string; debug: boolean }>(),
});

// Custom type
const CustomDate = types.custom<string, Date>({
  name: 'CustomDate',
  fromSnapshot(value: string) { return new Date(value); },
  toSnapshot(value: Date) { return value.toISOString(); },
  isTargetType(value) { return value instanceof Date; },
  getValidationMessage(value) { return 'Invalid date'; },
});

// Snapshot processor
const ProcessedModel = types.snapshotProcessor(BaseModel, {
  preProcessor(snapshot) {
    return { ...snapshot, version: snapshot.version ?? 1 };
  },
  postProcessor(snapshot) {
    return { ...snapshot, exported: true };
  },
});
```

---

## Models

### Defining Models

```typescript
const User = types.model('User', {
  id: types.identifier,
  name: types.string,
  age: types.optional(types.number, 0),
});

// Anonymous model
const Point = types.model({
  x: types.number,
  y: types.number,
});

// Add properties later
const ExtendedUser = User.props({
  email: types.string,
});
```

### Views

Views are computed properties derived from state:

```typescript
const User = types
  .model('User', {
    firstName: types.string,
    lastName: types.string,
  })
  .views((self) => ({
    // Getter view
    get fullName() {
      return `${self.firstName} ${self.lastName}`;
    },
    // Method view
    getGreeting(prefix: string) {
      return `${prefix} ${self.fullName}!`;
    },
  }));
```

### Actions

Actions are methods that modify state:

```typescript
const Counter = types
  .model('Counter', {
    count: types.optional(types.number, 0),
  })
  .actions((self) => ({
    increment() {
      self.count++;
    },
    decrement() {
      self.count--;
    },
    setCount(value: number) {
      self.count = value;
    },
  }));
```

### Volatile State

Non-serialized state that doesn't appear in snapshots:

```typescript
const FormModel = types
  .model('FormModel', {
    data: types.string,
  })
  .volatile(() => ({
    isLoading: false,
    error: null as string | null,
    abortController: null as AbortController | null,
  }))
  .actions((self) => ({
    async fetchData() {
      self.isLoading = true;
      self.abortController = new AbortController();
      try {
        const result = await fetch('/api/data', { 
          signal: self.abortController.signal 
        });
        self.data = await result.text();
      } catch (e) {
        self.error = e.message;
      } finally {
        self.isLoading = false;
      }
    },
  }));
```

### Lifecycle Hooks

```typescript
const Model = types
  .model('Model', { value: types.string })
  .afterCreate((self) => {
    console.log('Created:', self.value);
  })
  .afterAttach((self) => {
    console.log('Attached to tree');
  })
  .beforeDetach((self) => {
    console.log('About to detach');
  })
  .beforeDestroy((self) => {
    console.log('About to be destroyed');
  });
```

### Extend Method

Combine views, actions, and volatile in one call with shared closure:

```typescript
const Counter = types
  .model('Counter', {
    count: types.optional(types.number, 0),
  })
  .extend((self) => {
    // Private closure state
    let lastModified = Date.now();
    
    return {
      views: {
        get doubled() {
          return self.count * 2;
        },
        get lastModified() {
          return lastModified;
        },
      },
      actions: {
        increment() {
          self.count++;
          lastModified = Date.now();
        },
      },
      state: {
        isEditing: false,
      },
    };
  });
```

### Snapshot Processing

Transform snapshots during creation and serialization:

```typescript
const Model = types
  .model('Model', {
    data: types.string,
    version: types.number,
  })
  .preProcessSnapshot((snapshot) => ({
    ...snapshot,
    version: snapshot.version ?? 1, // Add defaults
  }))
  .postProcessSnapshot((snapshot) => ({
    ...snapshot,
    exportedAt: Date.now(), // Add metadata
  }));
```

---

## Mixins

Create reusable, type-safe mixins that can be applied to models:

```typescript
// Define a mixin with requirements
const Validatable = types.mixin({
  requires: {
    errors: types.array(types.string),
  },
  views: (self) => ({
    get isValid() {
      return self.errors.length === 0;
    },
    get hasErrors() {
      return self.errors.length > 0;
    },
  }),
  actions: (self) => ({
    addError(msg: string) {
      self.errors.push(msg);
    },
    clearErrors() {
      self.errors.clear();
    },
  }),
  volatile: () => ({
    lastValidatedAt: null as number | null,
  }),
});

// Apply mixin to a model
const Form = types
  .model('Form', {
    name: types.string,
    email: types.string,
    errors: types.array(types.string),
  })
  .apply(Validatable);

// Now Form has isValid, hasErrors, addError, clearErrors
const form = Form.create({ name: '', email: '', errors: [] });
form.addError('Name is required');
console.log(form.isValid); // false
```

**Mixin with empty requirements:**

```typescript
const Loadable = types.mixin({
  volatile: () => ({
    isLoading: false,
    error: null as Error | null,
  }),
  actions: (self) => ({
    setLoading(loading: boolean) {
      self.isLoading = loading;
    },
    setError(error: Error | null) {
      self.error = error;
    },
  }),
});

// Can be applied to any model
const DataModel = types
  .model('DataModel', { data: types.string })
  .apply(Loadable);
```

**Applying multiple mixins:**

```typescript
const Entity = types
  .model('Entity', {
    id: types.identifier,
    createdAt: types.number,
    errors: types.array(types.string),
  })
  .apply(Identifiable)
  .apply(Timestamped)
  .apply(Validatable);
```

---

## Model Composition

Compose multiple models into one, merging properties, views, actions, and volatile state:

```typescript
const Identifiable = types
  .model('Identifiable', {
    id: types.identifier,
  })
  .views((self) => ({
    get shortId() {
      return self.id.substring(0, 8);
    },
  }));

const Timestamped = types
  .model('Timestamped', {
    createdAt: types.number,
    updatedAt: types.number,
  })
  .actions((self) => ({
    touch() {
      self.updatedAt = Date.now();
    },
  }));

// Compose models
const Entity = types.compose('Entity', Identifiable, Timestamped);

// Entity has: id, createdAt, updatedAt, shortId (view), touch (action)
const entity = Entity.create({
  id: 'abc123',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
```

---

## Tree Utilities

### Snapshots

```typescript
import { getSnapshot, applySnapshot, onSnapshot } from 'jotai-state-tree';

// Get current state as plain object
const snapshot = getSnapshot(store);

// Apply snapshot to update state
applySnapshot(store, { todos: [...] });

// Subscribe to snapshot changes
const dispose = onSnapshot(store, (snapshot) => {
  localStorage.setItem('store', JSON.stringify(snapshot));
});
```

### Patches

```typescript
import { onPatch, applyPatch, recordPatches } from 'jotai-state-tree';

// Subscribe to JSON patches
const dispose = onPatch(store, (patch, reversePatch) => {
  console.log('Change:', patch);
  // { op: 'replace', path: '/todos/0/done', value: true }
});

// Apply patches
applyPatch(store, { op: 'replace', path: '/count', value: 5 });
applyPatch(store, [patch1, patch2, patch3]); // Multiple patches

// Record patches for undo
const recorder = recordPatches(store);
store.doSomething();
recorder.stop();
recorder.undo(); // Reverts changes
```

### Tree Navigation

```typescript
import {
  getRoot,
  getParent,
  tryGetParent,
  hasParent,
  getParentOfType,
  getPath,
  getPathParts,
  getEnv,
  getType,
  getIdentifier,
  isAlive,
  isRoot,
  isStateTreeNode,
} from 'jotai-state-tree';

// Navigation
const root = getRoot(todo);
const parent = getParent(todo);
const maybeParent = tryGetParent(todo); // undefined if no parent
const store = getParentOfType(todo, TodoStore);

// Path information
const path = getPath(todo);           // "/todos/0"
const parts = getPathParts(todo);     // ["todos", "0"]

// Metadata
const env = getEnv(todo);             // Environment object
const type = getType(todo);           // TodoModel type
const id = getIdentifier(todo);       // "todo-1" or undefined

// Status checks
if (isAlive(todo)) { /* still exists */ }
if (isRoot(store)) { /* is root node */ }
if (isStateTreeNode(value)) { /* is tree node */ }
```

### Tree Manipulation

```typescript
import {
  destroy,
  detach,
  clone,
  cloneDeep,
  walk,
  findAll,
  findFirst,
  freeze,
  isFrozen,
  unfreeze,
} from 'jotai-state-tree';

// Destroy node (removes from tree)
destroy(todo);

// Detach from parent (keeps node alive)
const detached = detach(todo);

// Clone node
const cloned = clone(todo);
const deepCloned = cloneDeep(todo);

// Walk entire tree
walk(store, (node) => {
  console.log(getPath(node));
});

// Find nodes
const allTodos = findAll(store, (node) => getType(node).name === 'Todo');
const firstDone = findFirst(store, (node) => node.done === true);

// Freeze/unfreeze
freeze(store);        // Make read-only
isFrozen(store);      // true
unfreeze(store);      // Make writable again
```

### Path Resolution

```typescript
import {
  resolvePath,
  tryResolve,
  resolveIdentifier,
  getRelativePath,
  isAncestor,
  haveSameRoot,
} from 'jotai-state-tree';

// Resolve path
const todo = resolvePath(store, '/todos/0');
const maybeTodo = tryResolve(store, '/todos/0'); // undefined if not found

// Resolve by identifier
const user = resolveIdentifier(User, store, 'user-123');

// Relative paths
const relativePath = getRelativePath(todoA, todoB);
// "../../todos/1"

// Ancestry checks
isAncestor(store, todo);  // true
haveSameRoot(todoA, todoB); // true
```

---

## React Integration

### Observer HOC

```tsx
import { observer } from 'jotai-state-tree/react';

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

### Observer Component

```tsx
import { Observer } from 'jotai-state-tree/react';

function App({ store }) {
  return (
    <div>
      <Observer>
        {() => <span>Count: {store.count}</span>}
      </Observer>
    </div>
  );
}
```

### Store Context (Recommended)

```tsx
import { createStoreContext } from 'jotai-state-tree/react';

// Create typed context
const { Provider, useStore, useStoreSnapshot, useIsAlive } = createStoreContext<typeof TodoStore>();

function App() {
  const store = TodoStore.create({ todos: [] });
  
  return (
    <Provider value={store}>
      <TodoList />
    </Provider>
  );
}

function TodoList() {
  const store = useStore();
  const snapshot = useStoreSnapshot((s) => s.todos);
  const isAlive = useIsAlive();
  
  return (
    <ul>
      {store.todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

### Hooks

```tsx
import {
  useSnapshot,
  useWatchPath,
  usePatches,
  useAction,
  useActions,
  useLocalObservable,
  useObserver,
} from 'jotai-state-tree/react';

function Component({ store }) {
  // Subscribe to snapshot
  const snapshot = useSnapshot(store);
  
  // Watch specific path
  const count = useWatchPath(store, 'count', 0);
  
  // Subscribe to patches
  usePatches(store, (patch) => {
    console.log('Change:', patch);
  });
  
  // Memoized actions
  const increment = useAction(store.increment);
  const { add, remove } = useActions({
    add: store.add,
    remove: store.remove,
  });
  
  // Local observable state
  const localStore = useLocalObservable(() => ({
    count: 0,
    increment() { this.count++; },
  }));
  
  // Manual observation
  const view = useObserver(() => (
    <span>{store.count}</span>
  ));
}
```

### Batching Updates

```tsx
import { batch } from 'jotai-state-tree/react';

function handleBulkUpdate() {
  batch(() => {
    store.item1.update();
    store.item2.update();
    store.item3.update();
    // Single re-render after all updates
  });
}
```

---

## Undo/Redo & Time Travel

### Undo Manager

```typescript
import { createUndoManager } from 'jotai-state-tree';

const undoManager = createUndoManager(store, {
  maxHistoryLength: 100,
  groupByTime: true,
  groupingWindow: 200, // ms
});

// Undo/redo
store.increment();
store.increment();
undoManager.undo();  // count = 1
undoManager.redo();  // count = 2

// Check capabilities
undoManager.canUndo;     // boolean
undoManager.canRedo;     // boolean
undoManager.undoLevels;  // number
undoManager.redoLevels;  // number

// Group changes
undoManager.startGroup();
store.increment();
store.increment();
store.increment();
undoManager.endGroup();
// All three increments undo as one

// Execute without recording
undoManager.withoutUndo(() => {
  store.resetToDefaults();
});

// Clear history
undoManager.clear();

// Cleanup
undoManager.dispose();
```

### Time Travel Manager

```typescript
import { createTimeTravelManager } from 'jotai-state-tree';

const timeTravel = createTimeTravelManager(store, {
  maxSnapshots: 50,
});

// Record snapshots manually
store.doSomething();
timeTravel.record();

store.doSomethingElse();
timeTravel.record();

// Navigate history
timeTravel.goBack();
timeTravel.goForward();
timeTravel.goTo(0);  // Go to first snapshot

// Inspect
timeTravel.currentIndex;   // Current position
timeTravel.snapshotCount;  // Total snapshots
timeTravel.canGoBack;
timeTravel.canGoForward;
timeTravel.getSnapshot(2); // Get specific snapshot

// Cleanup
timeTravel.dispose();
```

### Action Recorder

```typescript
import { createActionRecorder } from 'jotai-state-tree';

const recorder = createActionRecorder(store);

// Record actions
recorder.start();
store.addTodo('Task 1');
store.addTodo('Task 2');
store.todos[0].toggle();
recorder.stop();

// Get recorded actions
console.log(recorder.actions);
// [{ name: 'addTodo', args: ['Task 1'] }, ...]

// Replay on another store
const newStore = TodoStore.create({ todos: [] });
recorder.replay(newStore);

// Export/import
const json = recorder.export();
recorder.import(json);

// Cleanup
recorder.dispose();
```

---

## Model Registry

Dynamic model registration for plugin architectures and code splitting:

```typescript
import {
  registerModel,
  unregisterModel,
  resolveModel,
  tryResolveModel,
  resolveModelAsync,
  isModelRegistered,
  getRegisteredModelNames,
  onModelRegistered,
  lateModel,
  dynamicReference,
  safeDynamicReference,
} from 'jotai-state-tree';

// Register models
registerModel('User', UserModel, { version: '1.0' });
registerModel('Post', PostModel);

// Check registration
isModelRegistered('User'); // true
getRegisteredModelNames();  // ['User', 'Post']

// Resolve models
const User = resolveModel('User');
const MaybePost = tryResolveModel('Post');

// Async resolution (waits for registration)
const Model = await resolveModelAsync('LazyModel', 5000);

// Listen for registrations
const dispose = onModelRegistered((name, type, metadata) => {
  console.log(`Model registered: ${name}`);
});

// Late-resolving model type
const Comment = types.model('Comment', {
  author: lateModel('User'),  // Resolved from registry
});

// Dynamic references
const Post = types.model('Post', {
  author: dynamicReference('User'),
  editor: safeDynamicReference('User'),
});

// Unregister
unregisterModel('User');
```

---

## Middleware

Intercept and control action execution:

```typescript
import { addMiddleware, protect, unprotect, isProtected } from 'jotai-state-tree';

// Add middleware
const dispose = addMiddleware(store, (call, next, abort) => {
  console.log(`Action: ${call.name}`, call.args);
  
  // Validate
  if (call.name === 'delete' && !canDelete()) {
    return abort('Not authorized');
  }
  
  // Proceed
  const result = next(call);
  
  console.log(`Result:`, result);
  return result;
});

// Protection (prevent direct mutations)
protect(store);
store.count = 5; // Throws error!
store.increment(); // OK - through action

unprotect(store);
store.count = 5; // OK now

isProtected(store); // false
```

### Action Tracking

```typescript
import { onAction, recordActions, applyAction } from 'jotai-state-tree';

// Subscribe to actions
const dispose = onAction(store, (call) => {
  console.log(`${call.name}(${call.args.join(', ')})`);
});

// Record actions
const recorder = recordActions(store);
store.addTodo('Task 1');
store.todos[0].toggle();
const actions = recorder.actions;
recorder.stop();

// Replay actions
recorder.replay(anotherStore);

// Apply single action
applyAction(store, { name: 'addTodo', args: ['New Task'] });
```

---

## Flow (Async Actions)

```typescript
import { types, flow } from 'jotai-state-tree';

const UserStore = types
  .model('UserStore', {
    users: types.array(User),
    isLoading: false,
  })
  .actions((self) => ({
    fetchUsers: flow(function* () {
      self.isLoading = true;
      try {
        const response = yield fetch('/api/users');
        const data = yield response.json();
        self.users.replace(data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        self.isLoading = false;
      }
    }),
  }));

// Usage
await store.fetchUsers();
```

---

## Type Utilities

### Type Extraction

```typescript
import type { 
  Instance, 
  SnapshotIn, 
  SnapshotOut,
  ModelSelf,
} from 'jotai-state-tree';

const Todo = types.model('Todo', { ... }).views(...).actions(...);

type TodoInstance = Instance<typeof Todo>;
type TodoSnapshot = SnapshotIn<typeof Todo>;
type TodoOutput = SnapshotOut<typeof Todo>;
type TodoSelf = ModelSelf<typeof Todo>; // Full self type with views/actions
```

### Type Checking Functions

```typescript
import {
  isType,
  isPrimitiveType,
  isModelType,
  isArrayType,
  isMapType,
  isReferenceType,
  isUnionType,
  isOptionalType,
  isLateType,
  isFrozenType,
  isLiteralType,
  isIdentifierType,
  getTypeName,
  typecheck,
} from 'jotai-state-tree';

// Check type kinds
isModelType(Todo);        // true
isArrayType(types.array(types.string)); // true
getTypeName(Todo);        // 'Todo'

// Runtime type checking
typecheck(Todo, value);   // Throws if invalid
```

### Validation

```typescript
import { isValidSnapshot, getValidationError } from 'jotai-state-tree';

if (isValidSnapshot(Todo, data)) {
  const todo = Todo.create(data);
}

const error = getValidationError(Todo, invalidData);
if (error) {
  console.error(error);
}
```

### Casting Utilities

```typescript
import { cast, castToSnapshot, castToReferenceSnapshot } from 'jotai-state-tree';

// Type casting helpers
const value = cast<Todo>(unknownValue);
const snapshot = castToSnapshot(todo);
const refId = castToReferenceSnapshot(user); // Gets identifier
```

---

## Migration from MST

```typescript
// Before (MST)
import { types } from 'mobx-state-tree';
import { observer } from 'mobx-react-lite';

// After (jotai-state-tree)
import { types } from 'jotai-state-tree';
import { observer } from 'jotai-state-tree/react';
```

Most MST code works with minimal changes. Key differences:

1. Import from `jotai-state-tree` instead of `mobx-state-tree`
2. React bindings from `jotai-state-tree/react` instead of `mobx-react-lite`
3. Uses Jotai atoms internally instead of MobX observables

---

## License

MIT
