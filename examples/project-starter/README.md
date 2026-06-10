# Jotai State Tree Starter Template

This is a comprehensive, production-ready starter template for building React applications using **Jotai State Tree** (`jotai-state-tree`), React, TypeScript, and Tailwind CSS. It is designed to mirror the structure of frameworks like TanStack Start, Next.js, and RedwoodJS, offering a fully modular structure, built-in URL routing, state persistence, undo/redo managers, and a dark/light mode dashboard.

It also comes pre-configured with first-class support for AI agent assistants (`AGENTS.md` and `.agents/skills`).

---

## Getting Started

### 1. Scaffold the Project
You can instantly download this template without git history using `degit`:
```bash
npx degit bmartel/jotai-state-tree/examples/project-starter my-new-app
cd my-new-app
```

### 2. Update dependencies
Because this template lives inside the main `jotai-state-tree` repository workspace, its `package.json` references local resolution settings. Open `package.json` in your new project and ensure that `jotai-state-tree` is mapped to the standard npm package:

```json
"dependencies": {
  "react": "^18.2.0",
  "react-dom": "^18.3.1",
  "jotai": "^2.6.0",
  "jotai-state-tree": "^1.9.0"
}
```

Then, open `vite.config.ts` and `tsconfig.json` and remove the `paths` and `alias` overrides that map imports back to the library source folders.

### 3. Install and Run
```bash
npm install
npm run dev
```
The app will open at [http://localhost:3000](http://localhost:3000).

---

## Directory Structure

```
├── .agents/               # Guidelines and skills for AI coding assistants
│   └── skills/
│       ├── jotai-state-tree-guide/
│       └── testing-guide/
├── src/
│   ├── main.tsx           # Entry point
│   ├── App.tsx            # Main app container and Providers
│   ├── index.css          # Tailwind CSS styles and themes
│   ├── components/        # Reusable UI elements (Sidebar, Header, Developer Drawer)
│   ├── models/            # State models (AuthStore, TaskStore, RootStore)
│   └── routes/            # Routes & View mapping (Dashboard, Tasks, Settings, Login)
├── tailwind.config.js     # Tailwind CSS setup
├── postcss.config.js      # PostCSS configuration
├── vite.config.ts         # Vite bundler options
└── tsconfig.json          # TypeScript options
```

---

## Features Out of the Box

1. **Preconfigured Tailwind CSS**: Seamless utility-first styling with Outfit and Inter font pairings, dark mode classes, glassmorphism templates, and micro-animations.
2. **Modular State Tree (`src/models`)**: Clear separation of state domains (auth, tasks, settings, logs) under a unified `RootStore`.
3. **URL Routing (`src/routes`)**: Code-based router with path parameters, query state sync, and secure navigation guards blocking unauthenticated pages.
4. **State Persistence**: Configurable synchronization that stores JSON state tree snapshots in `localStorage`.
5. **Developer Inspector Drawer**: Built-in inspector showing live JSON snapshots, real-time JSON Patch logging, and Undo/Redo stack depth controls.
6. **Agentic Coding Assistance**: Built-in `.agents/skills` providing code generation instructions, testing templates, and CLI guides for LLMs helping you build your app.
