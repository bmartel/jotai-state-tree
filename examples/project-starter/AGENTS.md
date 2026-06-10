# Agentic Instructions: Developer Co-Pilot Guide

Welcome! This document outlines guidelines and project architectures for AI coding assistants working on this repository.

---

## 🎯 Tech Stack Overview
* **Front-end**: React 18, TypeScript, Vite.
* **Styling**: Tailwind CSS (class-based dark mode, custom Inter/Outfit font pairings, glassmorphism overlays).
* **State Management**: `jotai-state-tree` (API compatible with MobX-State-Tree).
* **Routing**: Built-in `createRouter` and `RouteView` from `jotai-state-tree/react`.

---

## 📂 Key Folders
* `/src/components`: UI elements (pure presentational, or connected via `useAppStore`).
* `/src/models`: State models (AuthStore, TaskStore, RootStore). Define types, views, actions, and references.
* `/src/routes`: Route definitions and views mapping path matching to page elements.
* `/.agents/skills`: Local agent skills for codebase expansion.

---

## 🛠️ Code Conventions

### 1. State Mutation Rule
* **DO NOT** mutate store properties directly from React components. All state modifications must be performed by defining an action in the model's `.actions()` block.
* React components must be wrapped in `observer` from `jotai-state-tree/react` to react to state tree changes.

### 2. Styling System
* Use standard Tailwind CSS utility classes.
* For complex card grids or glassmorphism, refer to CSS variables declared in `src/index.css`.
* Implement responsive designs (mobile-first `sm:`, `md:`, `lg:`, `xl:` prefixes).

### 3. Type-Safety
* Always declare TypeScript Interfaces using `Instance<typeof ModelName>` for store instances.
* Keep models strictly typed; use `types.optional` and `types.maybeNull` where appropriate.

---

## 🧠 Local Agent Skills
Refer to the following skills before making edits:
1. **[Jotai State Tree Guide](file:///.agents/skills/jotai-state-tree-guide/SKILL.md)**: Syntax reference for models, views, actions, references, persistence, and routing.
2. **[Testing Guide](file:///.agents/skills/testing-guide/SKILL.md)**: Instructions and examples for writing unit/integration tests.
