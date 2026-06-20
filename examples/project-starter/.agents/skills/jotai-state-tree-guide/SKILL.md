---
name: jotai-state-tree-guide
description: |
  Comprehensive instructions for defining models, actions, views, routers, references, and persistence in jotai-state-tree.
---

# Jotai State Tree (MST-compatible) Guide

Use this skill when an AI agent needs to modify, create, or debug application state using `jotai-state-tree`.

---

## 1. Defining Models

Define models using `types.model`. Property types are defined using the `types` object.

```typescript
import { types, Instance } from 'jotai-state-tree';

export const UserProfile = types.model('UserProfile', {
  id: types.identifier,
  name: types.string,
  email: types.maybeNull(types.string),
  age: types.optional(types.number, 18),
  isActive: types.optional(types.boolean, true),
});

// Infer the TypeScript interface:
export type IUserProfile = Instance<typeof UserProfile>;
```

### Supported Types
* **Primitives**: `types.string`, `types.number`, `types.boolean`
* **Containers**: `types.array(Model)`, `types.map(Model)`
* **Nullables**: `types.maybe(Type)` (can be `undefined`), `types.maybeNull(Type)` (can be `null`)
* **Utilities**: `types.optional(Type, defaultValue)`, `types.identifier` (unique key for maps/references), `types.frozen(Type)` (immutable JSON object)

---

## 2. Volatile State

Volatile state is local state that is **not** serialized in snapshots (e.g. timers, web sockets, UI toggles).

```typescript
export const LiveTelemetry = types
  .model('LiveTelemetry', {
    metricName: types.string,
  })
  .volatile((self) => ({
    timerId: null as number | null,
    wsConnection: null as WebSocket | null,
  }))
  .actions((self) => ({
    afterCreate() {
      // Lifecycle hook called automatically after store instantiation
      self.timerId = window.setInterval(() => self.updateMetric(), 1000);
    },
    beforeDestroy() {
      // Lifecycle hook called automatically before cleanup
      if (self.timerId) clearInterval(self.timerId);
    },
    updateMetric() {
      // logic
    }
  }));
```

---

## 3. Computed Views

Views are computed derivations of your state. They are cached and only recalculate when their dependencies change.

```typescript
export const TaskStore = types
  .model('TaskStore', {
    items: types.array(Task),
    filter: types.optional(types.string, 'All'),
  })
  .views((self) => ({
    get completedCount() {
      return self.items.filter(item => item.completed).length;
    },
    get filteredTasks() {
      if (self.filter === 'Active') return self.items.filter(i => !i.completed);
      if (self.filter === 'Completed') return self.items.filter(i => i.completed);
      return self.items;
    },
    // Views that accept arguments are functions rather than getters:
    findTaskById(id: string) {
      return self.items.find(item => item.id === id);
    }
  }));
```

---

## 4. Actions

Actions are the **only** place where state modifications can occur.

```typescript
export const Task = types
  .model('Task', {
    id: types.identifier,
    text: types.string,
    completed: types.optional(types.boolean, false),
  })
  .actions((self) => ({
    toggle() {
      self.completed = !self.completed;
    },
    setText(newText: string) {
      self.text = newText;
    }
  }));
```

---

## 5. References

References link models together using their `types.identifier`.
* `types.reference(Model)`: Throws an error if the referenced object is deleted.
* `types.safeReference(Model)`: Automatically resolves to `undefined` if the referenced object is deleted.

```typescript
export const Project = types.model('Project', {
  id: types.identifier,
  name: types.string,
  // Safe reference resolves by matching ID to a user in UserProfile map/array:
  lead: types.safeReference(UserProfile), 
});
```

---

## 6. Snapshots & Persistence

Snapshots are the serialized state of your tree.
* `getSnapshot(store)`: Returns the plain JSON representation of the store.
* `applySnapshot(store, snapshot)`: Replaces the store's state with the snapshot.
* `onSnapshot(store, (snapshot) => { ... })`: Triggers a callback whenever the store changes.

```typescript
import { getSnapshot, applySnapshot, onSnapshot } from 'jotai-state-tree';

export function setupPersistence(store: any) {
  // 1. Hydrate from localStorage
  const saved = localStorage.getItem('app-state');
  if (saved) {
    try {
      applySnapshot(store, JSON.parse(saved));
    } catch (e) {
      console.error('Failed to restore snapshot', e);
    }
  }

  // 2. Listen for changes and persist
  onSnapshot(store, (snapshot) => {
    localStorage.setItem('app-state', JSON.stringify(snapshot));
  });
}
```

---

## 7. URL Routing

`jotai-state-tree` supports client-side URL routing integrated directly into the state tree.

```typescript
import { createRouter } from 'jotai-state-tree';

const routes = [
  { path: '/', name: 'home' },
  { path: '/tasks', name: 'tasks', meta: { requiresAuth: true } },
  { path: '/login', name: 'login' },
];

export const router = createRouter({
  routes,
  beforeNavigate: (from, to) => {
    // Return a string path to redirect, true to allow, or false to block
    if (to.currentRouteName === 'tasks' && !store.isAuthenticated) {
      return `/login?redirect=${encodeURIComponent(to.pathname)}`;
    }
    return true;
  },
});
```

To display pages in React, map the route names to components using `RouteView`:

```typescript
import { observer, RouteView } from 'jotai-state-tree/react';
import { HomeView } from './routes/HomeView';
import { TasksView } from './routes/TasksView';
import { LoginView } from './routes/LoginView';

const pages = {
  home: HomeView,
  tasks: TasksView,
  login: LoginView,
};

export const App = observer(() => {
  return (
    <RouteView 
      pages={pages} 
      fallback={<div>Page Not Found</div>}
    />
  );
});
```

---

## 8. Feature Scaffolding Recipe (SPA)

When asked to add a new feature to the SPA starter project, follow this exact step-by-step checklist:

1. **Define the Model**: Create or update the model file under `src/models/` using `types.model` and declare its types, views, and actions.
2. **Register in RootStore**: Open [RootStore.ts](file:///src/models/RootStore.ts) and add the new model as a property of the `RootStore`. Update `createAppStore()` to pass the initial state for the new store property.
3. **Configure the Route**: Open [router.ts](file:///src/routes/router.ts) and add a new route entry (path, name, and any meta requirements like authentication).
4. **Create the View Component**: Add a new view component file in `src/routes/` (e.g. `MyFeatureView.tsx`), wrapping it with `observer`. Connect it to state via `useAppStore()`.
5. **Map pages in App.tsx**: Open [App.tsx](file:///src/App.tsx) and import your view component. Add it to the `pages` map.
6. **Add to Navigation**: Open [Sidebar.tsx](file:///src/components/Sidebar.tsx) and add a new link to the sidebar using `router.push("/your-route")` to make it accessible to users.
7. **Write Tests**: Create a unit test file in `src/__tests__/` to verify the state transitions and components.

---

## 9. Performance Best Practices

To ensure maximum performance and avoid rendering bottlenecks:
* **Fine-Grained Subscriptions**: Prefer creating smaller, focused components wrapped in `observer` rather than one large observer component. Smaller components will re-render in isolation when only their specific models change.
* **Observe dereferenced values**: Inside an `observer` component, reading a property from a model is what registers that component to re-render when that property changes.
* **Keep Views Clean**: Views should be pure derivations of state. Avoid side effects, calculations with high algorithmic complexity, or instantiating new objects inside view getters.
* **Avoid unnecessary array recreation**: Do not call `.map()` or `.filter()` inside React render functions if they can be cached in store `.views()`.

---

## 10. Common Traps & Antipatterns

* ❌ **Direct state mutation inside React components**:
  ```typescript
  // WRONG: Will trigger write protection error in development
  store.tasks.items[0].completed = true;
  ```
  ```typescript
  // CORRECT: Call an action
  store.tasks.items[0].toggle();
  ```
* ❌ **Forgetting the `observer` wrapper**: If you forget to wrap your component in `observer`, it will not re-render when the state tree changes.
* ❌ **SafeReference dereference crash**: Always check if a safe reference is defined before accessing its nested properties:
  ```typescript
  // WRONG: May crash if the lead is deleted (since safeReference becomes undefined)
  const leadName = project.lead.name;
  ```
  ```typescript
  // CORRECT
  const leadName = project.lead ? project.lead.name : 'No Lead';
  ```
