# Advanced Features

`jotai-state-tree` has built-in support for time-travel, undo/redo histories, action recording/replaying, dynamic model registries (useful for micro-frontends/code-splitting), and middleware hook pipelines.

---

## Undo & Redo History

The Undo Manager tracks JSON patches and handles applying reverse patches automatically to rollback mutations.

```typescript
import { createUndoManager } from 'jotai-state-tree';

const undoManager = createUndoManager(store, {
  maxHistoryLength: 100, // Maximum actions in history
  groupByTime: true,      // Group mutations within a time window
  groupingWindow: 200,    // Time window in ms (defaults to 200)
});

// 1. Basic Undo/Redo
store.setCount(1);
store.setCount(2);

undoManager.undo();      // count is now 1
undoManager.redo();      // count is now 2

// 2. Query Capabilities
console.log(undoManager.canUndo);    // true
console.log(undoManager.canRedo);    // false
console.log(undoManager.undoLevels); // 2

// 3. Custom Grouping
undoManager.startGroup();
store.setX(10);
store.setY(20);
undoManager.endGroup();
// Both setX and setY will undo as a single action

// 4. Bypassing History
undoManager.withoutUndo(() => {
  store.setDebugInfo('running...'); // This mutation will NOT be recorded
});

// 5. Cleanup
undoManager.clear();    // Empty history
undoManager.dispose();  // Stop listening and release memory
```

---

## Time Travel Manager

The Time Travel Manager records complete state tree snapshots periodically or manually, allowing you to slide back and forth through history.

```typescript
import { createTimeTravelManager } from 'jotai-state-tree';

const timeTravel = createTimeTravelManager(store, {
  maxSnapshots: 50,
});

// 1. Record snapshots manually (or listen to snapshots automatically)
store.increment();
timeTravel.record();

store.increment();
timeTravel.record();

// 2. Navigate history
timeTravel.goBack();       // Move 1 step back
timeTravel.goForward();    // Move 1 step forward
timeTravel.goTo(0);        // Jump to first snapshot

// 3. Inspect status
console.log(timeTravel.currentIndex);  // Current history index
console.log(timeTravel.canGoBack);     // true
console.log(timeTravel.getSnapshot(1)); // Fetch specific snapshot at index

timeTravel.dispose();      // Cleanup subscriptions
```

---

## Action Recorder & Replay

Record actions executed on a store, export them to JSON, and replay them on another store instance.

```typescript
import { createActionRecorder } from 'jotai-state-tree';

const recorder = createActionRecorder(store);

// 1. Record
recorder.start();
store.addTodo('1', 'Record video');
store.addTodo('2', 'Edit audio');
recorder.stop();

console.log(recorder.actions);
// [{ name: 'addTodo', args: ['1', 'Record video'] }, ...]

// 2. Replay actions on another store
const freshStore = TodoStore.create({ todos: [] });
recorder.replay(freshStore);

// 3. Serialize & Deserialize actions history
const exportedJson = recorder.export(); // Save to database/file
recorder.import(exportedJson);

recorder.dispose();
```

---

## Model Registry & Dynamic Resolution

Ideal for plugin architectures and lazy-loading parts of the application. You can register model constructors dynamically and reference them by name.

```typescript
import {
  registerModel,
  unregisterModel,
  resolveModel,
  resolveModelAsync,
  lateModel,
  dynamicReference,
} from 'jotai-state-tree';

// 1. Register a model dynamically
registerModel('UserProfile', UserModel);

// 2. Resolve it later
const UserModelRef = resolveModel('UserProfile');

// 3. Async Resolution (waits for registration, e.g. from a chunk build loader)
const Model = await resolveModelAsync('LazyChunkModel', 10000); // 10s timeout

// 4. lateModel(): Resolve reference from registry at instantiation time
const Post = types.model('Post', {
  author: lateModel('UserProfile'), // Resolved by name from registry
});

// 5. dynamicReference(): Resolve references dynamically
const Book = types.model('Book', {
  owner: dynamicReference('UserProfile'),
});
```

---

## Middleware Hook Pipeline

Middleware intercepts and modifies action execution. You can inspect arguments, cancel actions, log results, or inject behaviors.

```typescript
import { addMiddleware } from 'jotai-state-tree';

const dispose = addMiddleware(store, (call, next, abort) => {
  console.log(`Action executing: ${call.name} with args:`, call.args);
  
  // Example: Action interception / guard check
  if (call.name === 'deleteRecord' && call.args[0] === 'protected-id') {
    return abort(new Error('Cannot delete protected record'));
  }
  
  // Proceed with execution
  const result = next(call);
  
  console.log(`Action completed: ${call.name}, returned:`, result);
  return result;
});
```
