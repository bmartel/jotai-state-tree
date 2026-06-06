# Migration from MobX-State-Tree

`jotai-state-tree` is designed to be an API-compatible, drop-in replacement for MobX-State-Tree (MST). For most codebases, migrating is as simple as updating imports.

---

## Why Migrate?

While MobX-State-Tree is powerful, it has several long-standing issues that `jotai-state-tree` resolves:

1. **Memory Safety (No leaks)**: MST is notorious for retaining memory subscriptions, especially inside React render paths, HOC wrappers, or complex computed views. `jotai-state-tree` relies on Jotai's garbage collection model. When components unmount or state tree nodes are dereferenced, subscriptions are garbage collected automatically.
2. **Atomic Performance**: Instead of dirty-checking and traversing large object trees, `jotai-state-tree` uses Jotai atoms. Changes trigger updates only on the specific component/atom that depends on the mutated path, resulting in faster and more predictable re-renders.
3. **TypeScript Inference**: TypeScript support in original MST is complex and often requires casting and circular-type workarounds. `jotai-state-tree` features clean, strict type definitions for snapshots and model builders that require zero hacks or type assertions.
4. **Zero Production Overhead**: Write-protection checks are bypassed entirely when `process.env.NODE_ENV === "production"`, removing the performance tax associated with protection checks in original MST.

---

## Step-by-Step Migration

### 1. Update Packages
Uninstall MobX, MST, and their React bindings, and install `jotai-state-tree` and `jotai`:

```bash
# Uninstall old libraries
npm uninstall mobx-state-tree mobx mobx-react-lite

# Install new libraries
npm install jotai-state-tree jotai
```

### 2. Update Core Imports
Replace `mobx-state-tree` imports with `jotai-state-tree` globally in your codebase:

```typescript
// Before
import { types, getSnapshot, applySnapshot } from 'mobx-state-tree';

// After
import { types, getSnapshot, applySnapshot } from 'jotai-state-tree';
```

### 3. Update React Bindings
Replace `mobx-react-lite` (or `mobx-react`) observer imports with the React bindings from `jotai-state-tree/react`:

```typescript
// Before
import { observer } from 'mobx-react-lite';

// After
import { observer } from 'jotai-state-tree/react';
```

---

## Key Differences & Caveats

While the API compatibility is extremely high, keep the following operational differences in mind:

### 1. Jotai Atoms vs MobX Observables
Original MST uses MobX observables under the hood, whereas `jotai-state-tree` uses Jotai atoms.
- **MobX**: Mutating any field instantly triggers observers synchronously during execution.
- **Jotai**: Updates are batched and scheduled. In React event handlers, multiple mutations are automatically batched, resulting in a single React rendering pass.

### 2. Type Inference Differences
With `jotai-state-tree`, `SnapshotIn<typeof Model>` is strict. If a model property is required (i.e. not wrapped in `types.optional` or `types.maybe`), it **must** be provided in the snapshot at compile time:

```typescript
const User = types.model({
  name: types.string, // Required
  age: types.optional(types.number, 30) // Optional
});

// MST allows this but fails at runtime if not handled:
User.create({}); 

// jotai-state-tree catches this at compile time:
User.create({ name: "Alice" }); // Compiles!
User.create({}); // TypeScript Compiler Error!
```

### 3. Sibling View / Action References
In original MST, sibling actions or views within the same block cannot easily reference each other via `self` without typescript hacks. `jotai-state-tree` supports chaining consecutive blocks (e.g. `.views().views()`) where each subsequent block has full, typed access to all previous properties, views, and actions on `self`.
Alternatively, you can use standard lexical closures inside a single block:

```typescript
// Recommended pattern for sibling actions
const Model = types.model({ count: 0 }).actions((self) => {
  function step1() {
    self.count++;
  }
  function step2() {
    step1(); // Call sibling action directly via closure
    self.count += 2;
  }
  
  return { step1, step2 };
});
```
