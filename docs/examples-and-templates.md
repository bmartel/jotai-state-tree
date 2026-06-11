# Examples & Templates

`jotai-state-tree` comes with a comprehensive, production-ready **Project Starter Template** (pre-configured with routing, Tailwind CSS, local storage persistence, and developer tools) along with 8 specialized, type-safe, and minimalist examples to jump-start your application development.

---

## Scaffolding a New Project from the Starter (Recommended)

You can instantly scaffold a new Vite application from our starter template using `degit`. It downloads a copy of the template folder without its git history, instantly preparing a clean project.

```bash
# 1. Scaffold a project from the Project Starter template
npx degit bmartel/jotai-state-tree/examples/project-starter my-new-app

# 2. Enter the project folder
cd my-new-app

# 3. Update the package.json dependency (see note below)
# Change "jotai-state-tree": "file:../.." to "jotai-state-tree": "^1.14.2"

# 4. Install dependencies
npm install

# 5. Start the development server
npm run dev
```

> [!IMPORTANT]
> **Dependency Update Note**: Because these templates reside inside the library's repository workspace, their `package.json` references a local path: `"jotai-state-tree": "file:../.."`.
> After downloading or copying a template, open its `package.json` and replace it with the latest npm version:
> ```json
> "dependencies": {
>   "jotai": "^2.6.0",
>   "jotai-state-tree": "^1.14.2",
>   "react": "^18.2.0",
>   "react-dom": "^18.3.1"
> }
> ```

### Method 2: Manual Clone & Copy

If you prefer not to use `npx degit`, you can clone the main repository and copy a template directory manually.

```bash
# 1. Clone the repository
git clone https://github.com/bmartel/jotai-state-tree.git

# 2. Copy the desired template folder
cp -r jotai-state-tree/examples/shopping-cart-views my-new-app

# 3. Open my-new-app/package.json and update "jotai-state-tree" to "^1.14.2"
# 4. Run: cd my-new-app && npm install && npm run dev
```

---

## Template Directory Index

### ⭐️ Recommended Project Starter (`./examples/project-starter`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/project-starter?file=src/App.tsx)
- **Key APIs**: Full `jotai-state-tree` lifecycle (`types.model`, `volatile`, `views`, `actions`), routing (`createRouter`, `RouteView`), persistence (`onSnapshot`, `applySnapshot`), history (`createUndoManager`), and JSON Patches (`onPatch`).
- **Focus**: Production-ready skeleton for starting any new application with premium tooling and styling.
- **Features**: Class-based dark mode, preconfigured Tailwind CSS v3, Outfit and Inter Google font pairings, full-featured workspace routing, state persistence in localStorage, dynamic notifications (Toast system), and a premium sliding DevTools inspector panel showcasing live snapshots, patch feeds, undo/redo buffers, and error validation blocks. Includes pre-configured agent assistant guides (`AGENTS.md` and `.agents/skills`).

---

## Example Directory Index

Here is a breakdown of the specialized example templates and what they demonstrate:

### 1. Todo List with Time Travel (`./examples/todo-list-time-travel`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/todo-list-time-travel?file=src/App.tsx)
- **Key APIs**: `types.model`, `types.array`, `createUndoManager`, `createTimeTravelManager` (with `autoRecord: true`).
- **Focus**: State history, undo/redo stacks, and time travel scrubbing.
- **Features**: A clean checklist where additions and toggles trigger snapshot records. Provides an interactive slider allowing users to slide back and forth through history, and an Undo/Redo dashboard with a live JSON patches console feed.

### 2. Collaborative Kanban Board (`./examples/kanban-board-references`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/kanban-board-references?file=src/App.tsx)
- **Key APIs**: `types.reference`, `types.safeReference`, `types.map`, `onPatch`, `applySnapshot`.
- **Focus**: Reference resolution, maps, and snapshot import/export.
- **Features**: A multi-column board where cards link to user profiles in a separate store via type-safe references. Showcases the automatic resolution and cleanup of `safeReference`—deleting a user profile will automatically set the assignee on their task cards to `undefined` safely.

### 3. Shopping Cart with Views (`./examples/shopping-cart-views`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/shopping-cart-views?file=src/App.tsx)
- **Key APIs**: Chained `.views()`, nested models, and asynchronous actions.
- **Focus**: Computed derivations and async checkout flows.
- **Features**: A product catalog and checkout counter. Shows how to chain multiple `.views` blocks so dependent derivations (Subtotal -> Discount -> Tax -> Total) can resolve type-safely in TypeScript. Features simulated payment delays and success/fail toasts.

### 4. Telemetry Monitor Dashboard (`./examples/dashboard-live-telemetry`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/dashboard-live-telemetry?file=src/App.tsx)
- **Key APIs**: `afterCreate` and `beforeDestroy` lifecycle hooks, volatile state, and closure-pattern actions.
- **Focus**: Lifecycles, timer simulations, and internal action calling.
- **Features**: A live hardware metrics display (CPU, RAM, Network). Shows how `afterCreate` registers a timer loop to update statistics and `beforeDestroy` clears it. Uses volatile state to store the timer ID (preventing serialization in snapshots) and closure actions so local methods call each other without `self` type constraints.

### 5. Dynamic Form Builder (`./examples/form-builder-dynamic`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/form-builder-dynamic?file=src/App.tsx)
- **Key APIs**: `types.union`, `types.late` (recursive types), and recursive validation.
- **Focus**: Polymorphic data trees, self-referencing models, and recursive walk validation.
- **Features**: An editor to compile forms dynamically by adding text, number, choice, or toggle questions. Uses a union dispatcher to resolve specialized question sub-models and late binding for recursive section nesting. Includes a live form preview and validation warnings generated via recursive tree-crawling views.

### 6. SSR & Notes Manager (`./examples/note-taking-ssr`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/note-taking-ssr?file=src/App.tsx)
- **Key APIs**: `useHydrateStore`, `setGlobalStore`, `createStoreContext`.
- **Focus**: Server-Side Rendering (SSR) hydration and state isolation.
- **Features**: A notes manager that syncs to localStorage. Illustrates how to call `setGlobalStore` to bind to an isolated Jotai store instance (vital for avoiding state leaks in multi-user Node.js SSR servers) and `useHydrateStore` to pre-seed the client's memory on startup with server-rendered data.

### 7. Multipage Bookstore Router (`./examples/multipage-router`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/multipage-router?file=src/App.tsx)
- **Key APIs**: `createRouter`, `RouteView`, `useRouter`, `beforeNavigate`, `afterNavigate`.
- **Focus**: URL routing, route parameters, wildcards, query parameters, navigation guards, and transition logging.
- **Features**: A multi-page mock bookstore directory. Showcases dynamic parameter routing for book details, query parameters for search/category filters, a wildcard files route, and a secure administration dashboard protected by navigation guards that redirect unauthenticated visits.

### 8. Resilient Task Hub with Persistence (`./examples/offline-sync-persistence`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/offline-sync-persistence?file=src/App.tsx)
- **Key APIs**: `usePersistence`, `usePersistentModel`, `PersistenceManager`.
- **Focus**: IndexedDB state persistence, background sync queue, Web Worker compaction, batching, and safety rollbacks.
- **Features**: A task board that stores state locally inside IndexedDB. Simulates spotty network connections, offline queueing of modifications, background queue compaction on a worker thread, and automatic state rollback on validation/API failures.

