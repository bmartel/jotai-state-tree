# jotai-state-tree Examples & Templates

This directory contains 6 distinct, ready-to-run Vite + React + TypeScript starter templates designed to showcase the features of `jotai-state-tree`. 

Each template demonstrates specific parts of the library, ranging from basic models to advanced features like references, time travel, undo histories, dynamic forms, and SSR hydration. They are structured as self-contained projects that can be copied and used as the foundation for your own applications.

---

## The Examples

### 1. Todo List with Time Travel (`./todo-list-time-travel`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/todo-list-time-travel?file=src/App.tsx)
- **Core Focus**: Basic models, arrays, actions, views, and state history navigation.
- **Key APIs**: `types.model`, `types.array`, `createUndoManager`, `createTimeTravelManager`.
- **Description**: A minimalist, clean task manager where you can add/toggle/delete tasks, view a historical changes log, and use a Time Travel slider or Undo/Redo buttons to navigate your application's state timeline.

### 2. Collaborative Kanban Board (`./kanban-board-references`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/kanban-board-references?file=src/App.tsx)
- **Core Focus**: Safe references, map keys, volatile state, and patches.
- **Key APIs**: `types.reference`, `types.map`, `onPatch`, `applySnapshot`.
- **Description**: A multi-column Kanban board. Drag/click cards to move them between columns, assign tasks to members in a central team store using type-safe references, view a scrolling sidebar of real-time JSON patches, and export/import state snapshots.

### 3. Shopping Cart & Checkout (`./shopping-cart-views`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/shopping-cart-views?file=src/App.tsx)
- **Core Focus**: Computed views, nested models, and asynchronous flow actions.
- **Key APIs**: `self.views`, nested models, actions, custom toast notifications.
- **Description**: A catalog browsing and checkout application. Demonstrates reactive views for calculating line items, totals, discounts, and taxes automatically. Features simulated asynchronous API checkout calls with loading indicators.

### 4. Live Telemetry Dashboard (`./dashboard-live-telemetry`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/dashboard-live-telemetry?file=src/App.tsx)
- **Core Focus**: Lifecycle hooks, asynchronous actions, and volatile state.
- **Key APIs**: `afterCreate`, `beforeDestroy`, volatile property bindings, status alarms.
- **Description**: A real-time hardware telemetry monitor (CPU, Memory, Network). Uses lifecycle hooks to start/stop data generation loops, keeps interval handlers in local volatile properties, and highlights system warnings when metrics cross threshold alarms.

### 5. Dynamic Form Builder (`./form-builder-dynamic`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/form-builder-dynamic?file=src/App.tsx)
- **Core Focus**: Union types, recursive structure composition, and path validation.
- **Key APIs**: `types.union`, `types.late`, recursive models, validation views.
- **Description**: A builder interface for surveys and questionnaires. Add different input fields dynamically (Text, Number, Select, Toggle) that map to specialized models. Features recursive section nesting and automated tree-wide schema validation.

### 6. SSR & Hydrated Notes (`./note-taking-ssr`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/note-taking-ssr?file=src/App.tsx)
- **Core Focus**: Client-side hydration, custom Jotai store isolation, and localStorage persistence.
- **Key APIs**: `useHydrateStore`, `setGlobalStore`, LocalStorage syncing.
- **Description**: A note-taking application designed for Server-Side Rendering (SSR) environments. Shows how to prevent hydration mismatches and isolate state tree instances using scoped Jotai stores (vital for multi-user pages or micro-frontends).

### 7. Multipage Bookstore Router (`./multipage-router`) [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/bmartel/jotai-state-tree/tree/main/examples/multipage-router?file=src/App.tsx)
- **Core Focus**: URL routing, route parameters, wildcards, query parameters, navigation guards, and transition logging.
- **Key APIs**: `createRouter`, `RouteView`, `useRouter`, `beforeNavigate`, `afterNavigate`.
- **Description**: A multi-page mock bookstore directory. Showcases dynamic parameter routing for book details, query parameters for search/category filters, a wildcard file page, and a secure administration dashboard protected by navigation guards that redirect unauthenticated visits.

---

## Quick Start

### 1. Build the library
Before running any example, compile the main `jotai-state-tree` package in the root directory:
```bash
npm run build
```

### 2. Install dependencies for all examples
Run the following script in the root directory to install dependencies across all example folders:
```bash
npm run examples:install
```

### 3. Launch an example
You can start any of the templates directly using the top-level scripts in the root directory:
```bash
# Todo List with Time Travel
npm run example:todo

# Collaborative Kanban Board
npm run example:kanban

# Shopping Cart with Views
npm run example:cart

# Live Telemetry Dashboard
npm run example:telemetry

# Dynamic Form Builder
npm run example:form

# SSR Notes App
npm run example:notes

# Multipage Bookstore Router
npm run example:router
```

---

## Design and Aesthetic System
All templates are built using a unified, minimalist, and highly professional design system:
- **Styling**: Vanilla CSS utilizing CSS variables for theme stability.
- **Palette**: Clean shades of gray/slate/white with a single professional Indigo primary color (`#4f46e5`) for accents, focus states, and button controls.
- **Assets**: Inline SVGs are used for all icons to guarantee zero dependencies and instant rendering.
