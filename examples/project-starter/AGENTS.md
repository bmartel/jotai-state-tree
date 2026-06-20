# Agentic Instructions: Developer Co-Pilot Guide (Client SPA)

Welcome! This document outlines strict architectural guidelines, design systems, and coding conventions for AI assistants working on this client-side Single Page Application (SPA) codebase.

---

## 🎯 Tech Stack Overview
* **UI & Rendering**: React 19, TypeScript, Vite.
* **Styling**: Tailwind CSS v4 (native theme colors, Outfit/Inter fonts, custom scrollbars, and glassmorphism).
* **State Management**: `jotai-state-tree` (API compatible with MobX-State-Tree, powered by Jotai).
* **Client Routing**: Built-in `createRouter`, `RouterProvider`, and `RouteView` from `jotai-state-tree/react`.
* **Testing Framework**: Vitest & React Testing Library (configured for jsdom).

---

## 📂 Key Folders
* `/.agents/skills`: Local agentic skills (guide references).
* `/src/components`: Reusable presentational or connected components.
* `/src/models`: State models (AuthStore, TaskStore, RootStore). Definitive definitions of actions, views, and schemas.
* `/src/routes`: View components and page controllers corresponding to path names.
* `/src/__tests__`: Automated test files for stores, routing, and React rendering.

---

## 🛠️ Code Conventions & Guardrails

### 1. State Mutation Rule
> [!IMPORTANT]
> **DO NOT** mutate store properties directly inside React components or hooks.
> All modifications to state tree properties (e.g., toggles, pushes, updates) **MUST** be performed by invoking a dedicated action defined inside the model's `.actions()` block.

### 2. React Reactivity (`observer`)
* Every React component that reads/observes properties or computed views from a `jotai-state-tree` model **MUST** be wrapped in `observer` from `jotai-state-tree/react`.
* Failure to do so will result in static UI rendering that does not react to underlying state changes.

### 3. Client Routing Integration
* Navigation transitions should use the `useRouter()` hook's `.push(path)` or `.replace(path)` methods.
* Route views are rendered reactively by mapping route names to components via `<RouteView pages={pages} />`.
* Route authorization/guards are defined centrally in `src/routes/router.ts` inside the `beforeNavigate` callback.

### 4. Type Safety
* Always export the type definition for model instances:
  ```typescript
  export type IMyModel = Instance<typeof MyModel>;
  ```
* Leverage strict TypeScript annotations on all model properties. Use `types.optional` and `types.maybeNull` to prevent null-pointer exceptions.

### 5. Styling System
* Adhere strictly to the preconfigured Tailwind styling. Use CSS variables defined in `src/index.css` for custom transitions, gradients, and backdrop-filters.

---

## 🧠 Local Agent Skills
Always read these instruction files before generating new features or tests:
1. **[Jotai State Tree Guide](file:///.agents/skills/jotai-state-tree-guide/SKILL.md)**: Model, view, action, reference, persistence, and routing API definitions.
2. **[Testing Guide](file:///.agents/skills/testing-guide/SKILL.md)**: Detailed recipes for writing unit and component tests.
