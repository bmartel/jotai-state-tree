# Agentic Instructions: Developer Co-Pilot Guide (Server-Side Rendered SSR)

Welcome! This document outlines strict architectural guidelines, design systems, and coding conventions for AI assistants working on this Server-Side Rendered (SSR) React codebase.

---

## 🎯 Tech Stack Overview
* **UI & Rendering**: React 19 (Server-Side Rendering + Client Hydration).
* **Server**: Express Node.js application (`server.js`) serving both page rendering and JSON Patch RPC synchronization.
* **Styling**: Tailwind CSS v4 (native theme colors, Outfit/Inter fonts, custom scrollbars, and glassmorphism).
* **State Management**: `jotai-state-tree` (API compatible with MobX-State-Tree, powered by Jotai).
* **Client & SSR Routing**: Built-in `createRouter`, `RouterProvider`, and `RouteView` with SSR config in `src/routes/router.ts`.
* **Testing Framework**: Vitest & React Testing Library (configured for jsdom).

---

## 📂 Key Folders & Files
* `/server.js`: Node.js Express server defining SSR middleware, route routing configurations, and remote Server Actions handlers.
* `/src/entry-server.tsx`: SSR string-rendering entry point (runs on Node server).
* `/src/entry-client.tsx`: Hydration mounting entry point (runs in client browser).
* `/src/components`: Reusable presentational or connected components.
* `/src/models`: State models (AuthStore, TaskStore, RootStore). Definitive definitions of actions, views, and schemas.
* `/src/routes`: View components and page controllers corresponding to path names, plus API routes (`api.ts`).
* `/src/__tests__`: Automated test files for stores, hydration, and Server Actions.

---

## 🛠️ Code Conventions & Guardrails

### 1. State Mutation & Server Actions Rule
> [!IMPORTANT]
> **DO NOT** mutate server-persisted state tree properties directly inside React components or client-side only code.
> Any persistent state changes (e.g., adding/deleting/toggling tasks) **MUST** go through remote Server Actions:
> 1. Define the action on the client via `export const myAction = createServerAction(...)`.
> 2. Register and implement the action handler in the `createSSRHandler` options inside `/server.js`.
> 3. Invoke `await myAction(store, args)` from components. The server will execute the action, generate JSON patches, and sync them back to the client tree automatically.
> Local store actions should only be used for client-only state (e.g., UI toggles, theme changes, dev logs).

### 2. Request-Scoped Store Isolation (No Singleton Stores on Server)
* **DO NOT** import or use global/singleton store instances on the server. Doing so will leak state across concurrent user requests.
* Always instantiate stores dynamically per request (using `createAppStore()` inside `createSSRHandler`).
* React components access the store via `useStore()` from the React context provider.

### 3. Client Hydration (`useAutoHydrate`)
* The store state rendered on the server is automatically serialized into `window.__JST_DATA__`.
* On mounting, the client MUST call `useAutoHydrate(store)` (already handled in `AppWithRouter` in `src/App.tsx`) to hydrate client memory and prevent UI flicker or hydration mismatch errors.

### 4. React Reactivity (`observer`)
* Every React component that reads/observes properties or computed views from a `jotai-state-tree` model **MUST** be wrapped in `observer` from `jotai-state-tree/react`.

---

## 🧠 Local Agent Skills
Always read these instruction files before generating new features or tests:
1. **[Jotai State Tree Guide](file:///.agents/skills/jotai-state-tree-guide/SKILL.md)**: Model, views, actions, routing, hydration, and Server Actions API definitions.
2. **[Testing Guide](file:///.agents/skills/testing-guide/SKILL.md)**: Detailed recipes for testing SSR models, mock server action payloads, and hydration.
