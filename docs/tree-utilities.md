# Tree Utilities

`jotai-state-tree` provides a rich set of utility functions to navigate, inspect, mutate, serialize, and manipulate nodes anywhere in the tree.

---

## Snapshots

Snapshots are immutable, plain JavaScript object representations of a state tree node's values.

```typescript
import { getSnapshot, applySnapshot, onSnapshot } from 'jotai-state-tree';

// 1. getSnapshot(): Get a plain JS object of the current state
const currentSnapshot = getSnapshot(store);
console.log(currentSnapshot); // { count: 0, items: [] }

// 2. applySnapshot(): Update the state of a node in-place
applySnapshot(store, { count: 10, items: ['Apple'] });

// 3. onSnapshot(): Listen to all snapshot changes on a node or its descendants (bubbles up)
const dispose = onSnapshot(store, (newSnapshot) => {
  localStorage.setItem('app-state', JSON.stringify(newSnapshot));
});
```

---

## Patches

Patches describe structural changes in the tree using the RFC-6902 JSON-Patch standard.

```typescript
import { onPatch, applyPatch, recordPatches } from 'jotai-state-tree';

// 1. onPatch(): Intercept modifications to the tree
const dispose = onPatch(store, (patch, reversePatch) => {
  console.log('Patch Applied:', patch);
  // { op: 'replace', path: '/count', value: 11 }
  console.log('Reverse Patch (to undo):', reversePatch);
  // { op: 'replace', path: '/count', value: 10 }
});

// 2. applyPatch(): Apply single or multiple patches in-place
applyPatch(store, { op: 'replace', path: '/count', value: 20 });
applyPatch(store, [
  { op: 'add', path: '/items/0', value: 'Banana' },
  { op: 'replace', path: '/count', value: 21 }
]);

// 3. recordPatches(): Start recording patches (ideal for implementing custom undo)
const recorder = recordPatches(store);
store.increment();
store.items.push('Orange');
recorder.stop();

console.log(recorder.patches); // Array of patches recorded
recorder.undo();               // Reverts all changes back
recorder.redo();               // Re-applies changes
```

---

## Tree Navigation

Navigate and query nodes within the hierarchy:

```typescript
import {
  getRoot,
  getParent,
  tryGetParent,
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

// Ancestry Navigation
const root = getRoot(todoItem);             // Get top-most node
const list = getParent(todoItem);             // Get parent node (throws if none)
const maybeList = tryGetParent(todoItem);     // Get parent node (returns undefined if none)
const store = getParentOfType(todoItem, TodoStore); // Find ancestor matching type

// Path Utilities
const path = getPath(todoItem);               // "/todos/0"
const parts = getPathParts(todoItem);         // ["todos", "0"]

// Node Metadata
const env = getEnv(todoItem);                 // Access environment object passed at creation
const modelType = getType(todoItem);         // Access IModelType of the node
const id = getIdentifier(todoItem);           // Access identifier property value

// Status Checks
if (isAlive(todoItem)) { /* Node is still attached and not destroyed */ }
if (isRoot(store)) { /* Node is the root of the tree */ }
if (isStateTreeNode(value)) { /* Value is a jotai-state-tree node */ }
```

---

## Tree Manipulation

Duplicate, remove, traverse, or lock state nodes:

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

// 1. destroy(): Deletes node, clears its references, and removes it from its parent
destroy(todoItem);

// 2. detach(): Detaches node from parent, keeping it alive for attachment elsewhere
const detachedTodo = detach(todoItem);

// 3. clone() / cloneDeep(): Clone node (sharing or copying sub-nodes)
const copiedTodo = clone(todoItem);

// 4. walk(): Depth-first traversal of node and all its children
walk(store, (node) => {
  console.log(`Visiting node at path: ${getPath(node)}`);
});

// 5. findAll() / findFirst(): Query the tree
const doneTodos = findAll(store, (node) => getType(node).name === 'Todo' && node.done);
const firstDone = findFirst(store, (node) => node.done);

// 6. freeze() / unfreeze(): Lock nodes to make them read-only (prevents action mutations)
freeze(store);
console.log(isFrozen(store)); // true
unfreeze(store); // Make writable again
```

---

## Path Resolution

Query nodes relative to paths or identify structures:

```typescript
import {
  resolvePath,
  tryResolve,
  resolveIdentifier,
  getRelativePath,
  isAncestor,
  haveSameRoot,
} from 'jotai-state-tree';

// 1. resolvePath() / tryResolve(): Resolve string paths (e.g. absolute or relative "../")
const target = resolvePath(store, '/todos/1');
const maybeTarget = tryResolve(store, '../../todos/1'); // Returns undefined if unresolved

// 2. resolveIdentifier(): Find node by its unique identifier globally
const userNode = resolveIdentifier(User, store, 'user-id-123');

// 3. getRelativePath(): Calculate path from one node to another
const relPath = getRelativePath(todoNodeA, todoNodeB); // e.g. "../2"

// 4. Ancestry Checks
if (isAncestor(store, todoNode)) { /* store contains todoNode */ }
if (haveSameRoot(todoNode, anotherNode)) { /* both nodes share the same tree root */ }
```
