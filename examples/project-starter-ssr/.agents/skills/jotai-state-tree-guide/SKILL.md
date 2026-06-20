---
name: jotai-state-tree-guide
description: |
  Comprehensive instructions for defining models, actions, views, routers, references, and server-side rendering (SSR) in jotai-state-tree.
---

# Jotai State Tree (MST-compatible) SSR Guide

Use this skill when an AI agent needs to modify, create, or debug application state or routing in a Server-Side Rendered (SSR) setup using `jotai-state-tree`.

---

## 1. Request-Scoped Store Isolation

In an SSR environment (like an Express, Next.js, or TanStack Start server), multiple requests are processed concurrently by the same Node.js process.
> [!IMPORTANT]
> **NEVER** use global, singleton store instances on the server. Doing so will leak private user data and state between requests.
> Stores must be instantiated dynamically for each request, rendered to HTML, and disposed of.

Inside [server.js](file:///server.js), `createSSRHandler` manages request isolation. It instantiates the store dynamically per-request:
```javascript
const handler = createSSRHandler({
  createStore: createAppStore, // returns a new store instance per request
  renderApp,                   // calls renderToString with the request-scoped store
  // ...
});
```

On the client, the React Context Provider binds the hydrated request-scoped store:
```typescript
const { Provider, useStore } = createStoreContext<IRootStore>();

export const App = observer(function App({ store }: { store?: IRootStore }) {
  return (
    <Provider store={store} createStore={store ? undefined : () => createAppStore()}>
      <AppWithRouter />
    </Provider>
  );
});
```

---

## 2. Server Hydration & `useAutoHydrate`

Hydration is the process of initializing client-side state so it matches the server-rendered HTML exactly.
1. The server renders the app and serializes the store snapshot as stringified JSON:
   ```html
   <script>window.__JST_DATA__ = { "tasks": { ... } }</script>
   ```
2. The client loads the script and calls `useAutoHydrate(store)` on startup:
   ```typescript
   const store = useAppStore();
   useAutoHydrate(store); // automatically pulls window.__JST_DATA__ and applies it to the store
   ```
This prevents UI flickers and guarantees that the client's virtual DOM matches the server's markup.

---

## 3. Server Actions & RPC Patch Sync

To mutate state that persists on the database/server, use `createServerAction`.
1. **Define Action** in client-side code:
   ```typescript
   import { createServerAction } from 'jotai-state-tree/react';
   export const addTaskAction = createServerAction<{ title: string, category: string }, { success: boolean }>('addTask');
   ```
2. **Register Action** in [server.js](file:///server.js):
   ```javascript
   const handler = createSSRHandler({
     // ...
     actions: {
       addTask: async (store, { title, category }) => {
         store.tasks.addTask(title, category);
         return { success: true };
       }
     }
   });
   ```
3. **Execute Action** inside React components:
   ```typescript
   await addTaskAction(store, { title: 'Do Laundry', category: 'Home' });
   ```
### How it works:
When the client calls `addTaskAction`, the library sends a POST request containing:
- The current client-side state tree snapshot.
- The action argument payload.
The server reconstructs the store using the snapshot, runs the server action handler, computes the resulting JSON patches representing the mutation, and sends the patches back to the client. The client automatically applies the patches, synchronizing the client-side state tree.

---

## 4. Client Actions vs. Server Actions

* **Client Actions**: Standard store actions (e.g. `toggleTheme`, `setSearchQuery`). Use these for volatile UI state, themes, and client-only logic that does not need to persist.
* **Server Actions**: Asynchronous RPC actions (defined via `createServerAction`). Use these for persistent database mutations (e.g. creating tasks, logging in, updating profile settings).

---

## 5. Volatile State in SSR

Volatile properties are not serialized in snapshots.
> [!WARNING]
> Do not register timers, global event listeners, or open WebSockets in `afterCreate()` of models during server-side execution.
> Check that code runs only in the browser:
> ```typescript
> .actions((self) => ({
>   afterCreate() {
>     if (typeof window !== 'undefined') {
>       self.socket = new WebSocket('ws://...');
>     }
>   }
> }))
> ```

---

## 6. Feature Scaffolding Recipe (SSR)

When asked to add a new feature to the SSR starter project, follow this exact step-by-step checklist:

1. **Define the Model**: Create or update the model file under `src/models/` (e.g. `src/models/MyStore.ts`) using `types.model`.
2. **Register in RootStore**: Open [RootStore.ts](file:///src/models/RootStore.ts), add the model property, and update `createAppStore()`.
3. **Define Server Action**: Open [App.tsx](file:///src/App.tsx) and define a server action via `export const myAction = createServerAction(...)`.
4. **Register in server.js**: Open [server.js](file:///server.js) and register your action handler in the `actions` config of `createSSRHandler`. Implement any database/persistence logic here.
5. **Configure Route**: Open [router.ts](file:///src/routes/router.ts) and add the route metadata.
6. **Create View Component**: Create the view component in `src/routes/`, wrap it in `observer`, read the store via `useAppStore()`, and trigger state mutations by awaiting `myAction(store, payload)`.
7. **Map pages in App.tsx**: Import and map your view component to pages.
8. **Add to Navigation**: Open [Sidebar.tsx](file:///src/components/Sidebar.tsx) and add your link.
9. **Write Tests**: Verify server actions, model mutations, and hydration using tests in `src/__tests__/`.

---

## 7. Performance Best Practices

* **Minimize Hydration Size**: Do not store massive, transient datasets in the serializable state tree. Use volatile state or fetch client-side for log feeds/telemetry to avoid bloating `window.__JST_DATA__`.
* **Wrap components in `observer`**: Ensure components reading dynamic store values are observer wrapped.
* **Cache derived views**: View calculations (e.g. searching, sorting arrays) should be encapsulated in `.views()` rather than computed inline during React renders.

---

## 8. Common SSR Traps

* ❌ **State Leakage (Singleton stores)**:
  ```typescript
  // WRONG (Leaks state across users on server):
  export const globalStore = RootStore.create(); 
  ```
  ```typescript
  // CORRECT (Request-scoped Context):
  const store = useAppStore(); // reads from context provider
  ```
* ❌ **Hydration Mismatches**: Accessing browser-only APIs (`window`, `localStorage`, `document`) during initial render will output different HTML on server vs client.
  ```typescript
  // WRONG: Causes hydration mismatch
  const width = typeof window !== 'undefined' ? window.innerWidth : 800;
  ```
  ```typescript
  // CORRECT: Run browser checks in useEffect
  useEffect(() => { setWidth(window.innerWidth); }, []);
  ```
* ❌ **Mutating state directly on client instead of server actions**: Mutating persistent properties directly on the client bypasses the server database, causing client and server database states to diverge.
