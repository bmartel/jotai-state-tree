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
