# jotai-state-tree

A MobX-State-Tree (MST) compatible state management library powered by [Jotai](https://jotai.org/).

[![npm version](https://img.shields.io/npm/v/jotai-state-tree.svg)](https://www.npmjs.com/package/jotai-state-tree)
[![CI](https://github.com/bmartel/jotai-state-tree/actions/workflows/release.yml/badge.svg)](https://github.com/bmartel/jotai-state-tree/actions/workflows/release.yml)
[![coverage](.github/badges/coverage.svg)](https://github.com/bmartel/jotai-state-tree/actions/workflows/release.yml)
[![license](https://img.shields.io/github/license/bmartel/jotai-state-tree.svg)](LICENSE)

`jotai-state-tree` combines the transactional, tree-structured state model of MobX-State-Tree with the lightweight, zero-leak, high-performance atomic updates of Jotai. It is designed to be an API-compatible, drop-in replacement for MobX-State-Tree, featuring perfect TypeScript type safety out of the box.

---

## Features

- **MST-Compatible API** - Familiar `types.model`, `types.array`, `types.map` and more
- **Powered by Jotai** - Leverages Jotai's atomic state model for high performance
- **No Memory Leaks** - Relies on Jotai's garbage collection model (no dangling subscriptions)
- **Snapshots & Patches** - Full support for `getSnapshot`, `applySnapshot`, `onPatch`
- **Tree Navigation** - `getRoot`, `getParent`, `getPath`, `resolvePath`
- **References** - Type-safe references with `types.reference` and `types.safeReference`
- **React Integration** - Fine-grained reactive observers and hooks
- **Zero Production Overhead** - Write protection checks are bypassed completely in production
- **Mixins & Composition** - Reusable, type-safe mixins with `types.mixin` and `.apply()`
- **Advanced Utilities** - Built-in undo managers, time travel, and action recorders

---

## Installation

```bash
npm install jotai-state-tree jotai
```

---

## React Native Compatibility

`jotai-state-tree` is fully compatible with React Native projects. 

### Prerequisites & JS Engine
- **React Native Version**: `>= 0.70` is required.
- **JavaScript Engine**: The library relies on native ES2021 `WeakRef` and `FinalizationRegistry` features for memory management. If you use the Hermes engine (default since React Native 0.70), it must be version `0.12.0` or newer.

### Using the Router in React Native
When running in React Native (or any non-browser environment), the built-in state router automatically disables DOM/browser integration and behaves as a fully-featured **in-memory router**. It maintains a navigation history stack internally, enabling you to use:
- `push(path)` / `replace(path)`
- `go(delta)` / `goBack()` / `goForward()`
- `RouteView` to reactively render screen components based on the active path

This allows you to manage native navigation state trees with full time-travel, middleware, and action recording support!

---

## Quick Start

```typescript
import { types, getSnapshot } from 'jotai-state-tree';

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

const store = Todo.create({ id: '1', title: 'Learn jotai-state-tree' });
store.toggle();
console.log(getSnapshot(store)); // { id: '1', title: 'Learn jotai-state-tree', done: true }
```

---

## Documentation Guides

Explore our detailed, exhaustive guides to master `jotai-state-tree`:

1. **[Getting Started](docs/getting-started.md)** - Installation, core architecture concepts, and a complete quickstart application.
2. **[Models & State](docs/models-and-state.md)** - Defining models, views, actions, protection rules, volatile states, lifecycle hooks, and snapshot processing.
3. **[Types & Composition](docs/types-and-composition.md)** - Exhaustive list of primitives, identifiers, collections, union types, recursive structures (`types.late`), references, composition, and mixins.
4. **[Tree Utilities](docs/tree-utilities.md)** - Serialization (snapshots & patches), hierarchy navigation, traversal (`walk`, `find`), and relative path resolution.
5. **[React Integration](docs/react-integration.md)** - Observables HOCs, typed context Providers, hooks (`useSnapshot`, `useWatchPath`), and update batching.
6. **[Advanced Features](docs/advanced-features.md)** - Undo/Redo managers, Time Travel, Action recorders, dynamic plugins/registry, and middleware pipelines.
7. **[Migration from MobX-State-Tree](docs/mst-migration.md)** - Step-by-step replacement guide, performance comparisons, and key differences.
8. **[Examples & Templates](docs/examples-and-templates.md)** - 7 pre-configured Vite starter templates, features breakdown, and project scaffolding instructions.

---

## License

MIT
