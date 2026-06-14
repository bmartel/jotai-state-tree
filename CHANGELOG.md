## [1.15.1](https://github.com/bmartel/jotai-state-tree/compare/v1.15.0...v1.15.1) (2026-06-14)

# [1.15.0](https://github.com/bmartel/jotai-state-tree/compare/v1.14.15...v1.15.0) (2026-06-14)


### Features

* **react:** add activeReactRoots filtering and lifecycle Provider/RouterProvider props with recreation warnings ([723d5e9](https://github.com/bmartel/jotai-state-tree/commit/723d5e92b3190a5a05797bce41b0bfc2edc76bb3))

## [1.14.15](https://github.com/bmartel/jotai-state-tree/compare/v1.14.14...v1.14.15) (2026-06-14)


### Performance Improvements

* optimize property atom allocations and fix memory leaks in PersistenceManager, HistoryTracker, and DevTools ([2d6db44](https://github.com/bmartel/jotai-state-tree/commit/2d6db44742400ff9c3e50b4685b1d33c2b60e65a))

## [1.14.14](https://github.com/bmartel/jotai-state-tree/compare/v1.14.13...v1.14.14) (2026-06-13)

## [1.14.13](https://github.com/bmartel/jotai-state-tree/compare/v1.14.12...v1.14.13) (2026-06-13)


### Bug Fixes

* resolve memory leaks in undoManager and router popstate listener ([a2c80f7](https://github.com/bmartel/jotai-state-tree/commit/a2c80f76a808d0eeae9a032145379157150d5e13))


### Performance Improvements

* optimize MSTArray reconciliation, caching, and string conversions ([7eea13e](https://github.com/bmartel/jotai-state-tree/commit/7eea13ea5b9eb8430cba66960319866b92a74a00))

## [1.14.12](https://github.com/bmartel/jotai-state-tree/compare/v1.14.11...v1.14.12) (2026-06-13)


### Bug Fixes

* **react:** track view atom dependencies to resolve time-travel reactivity cache issue ([ae23af1](https://github.com/bmartel/jotai-state-tree/commit/ae23af1929091112e086df2560be6ab4443bea4e))

## [1.14.11](https://github.com/bmartel/jotai-state-tree/compare/v1.14.10...v1.14.11) (2026-06-13)


### Bug Fixes

* **devtools:** fix activeStore reference mismatch during HMR and remounts ([c392116](https://github.com/bmartel/jotai-state-tree/commit/c3921164868077d7377c77ff4178e87d0dfd660b))

## [1.14.10](https://github.com/bmartel/jotai-state-tree/compare/v1.14.9...v1.14.10) (2026-06-13)


### Bug Fixes

* **devtools:** fix timeline snapshot corruption on item deletion and avoid undomanager pollution ([92785f1](https://github.com/bmartel/jotai-state-tree/commit/92785f1a62dded6bcd19cc88ffbd04f6d4ec470f))

## [1.14.9](https://github.com/bmartel/jotai-state-tree/compare/v1.14.8...v1.14.9) (2026-06-12)


### Bug Fixes

* **devtools:** filter out logPatch and clearPatchLogs actions from timeline to prevent cluttering time travel history ([e598591](https://github.com/bmartel/jotai-state-tree/commit/e5985916964e73c9bdbb909bb82f67907ea09200))

## [1.14.8](https://github.com/bmartel/jotai-state-tree/compare/v1.14.7...v1.14.8) (2026-06-12)


### Bug Fixes

* **examples:** restore tailwind css v4 vite plugin in project-starter ([d55e9db](https://github.com/bmartel/jotai-state-tree/commit/d55e9db10d582f026484c3fd6496ac52fdd1b012))

## [1.14.7](https://github.com/bmartel/jotai-state-tree/compare/v1.14.6...v1.14.7) (2026-06-12)


### Bug Fixes

* **examples:** pin jotai-state-tree to 1.14.6 in project-starter to bust StackBlitz cache ([9743e42](https://github.com/bmartel/jotai-state-tree/commit/9743e429b2962954677ceb452631f09a6de6f3c8))

## [1.14.6](https://github.com/bmartel/jotai-state-tree/compare/v1.14.5...v1.14.6) (2026-06-11)


### Bug Fixes

* **devtools:** define JotaiStateTreeDevtools as const component to prevent ESM assignment crashes ([217c7f3](https://github.com/bmartel/jotai-state-tree/commit/217c7f3918738d19aa6c2bf533c12cc6e4c3acd4))

## [1.14.5](https://github.com/bmartel/jotai-state-tree/compare/v1.14.4...v1.14.5) (2026-06-11)


### Bug Fixes

* **examples:** migrate project-starter to @tailwindcss/postcss to support StackBlitz WebContainers ([a6d7353](https://github.com/bmartel/jotai-state-tree/commit/a6d7353132affd30865621a55dbe2077d46862a9))

## [1.14.4](https://github.com/bmartel/jotai-state-tree/compare/v1.14.3...v1.14.4) (2026-06-11)


### Bug Fixes

* **devtools:** safeguard process.env checks in browser environments ([7bda8dc](https://github.com/bmartel/jotai-state-tree/commit/7bda8dc4af9e487c8152a85269b9a02fdf084dba))

## [1.14.3](https://github.com/bmartel/jotai-state-tree/compare/v1.14.2...v1.14.3) (2026-06-11)


### Bug Fixes

* **examples:** correct path aliases on StackBlitz for project-starter template ([90e0af9](https://github.com/bmartel/jotai-state-tree/commit/90e0af9e33b7b9983c1035f2f1f36c109f93a712))

## [1.14.2](https://github.com/bmartel/jotai-state-tree/compare/v1.14.1...v1.14.2) (2026-06-11)


### Bug Fixes

* **examples:** resolve duplicate React 19 instance issue in project-starter template ([e5a0364](https://github.com/bmartel/jotai-state-tree/commit/e5a03649b0e168d2aa93c38f08c4260b4146ccea))

## [1.14.1](https://github.com/bmartel/jotai-state-tree/compare/v1.14.0...v1.14.1) (2026-06-11)


### Bug Fixes

* **examples:** resolve StackBlitz white-screen by checking root node_modules for local mode ([085dd67](https://github.com/bmartel/jotai-state-tree/commit/085dd67a90ba416a7ba4624c48363e094d7df3e5))

# [1.14.0](https://github.com/bmartel/jotai-state-tree/compare/v1.13.1...v1.14.0) (2026-06-11)


### Features

* implement granular computed views memoization, caching and notification batching ([de0150e](https://github.com/bmartel/jotai-state-tree/commit/de0150edb34f2d8c387df9b04c259b99689a6425))

## [1.13.1](https://github.com/bmartel/jotai-state-tree/compare/v1.13.0...v1.13.1) (2026-06-11)

# [1.13.0](https://github.com/bmartel/jotai-state-tree/compare/v1.12.1...v1.13.0) (2026-06-11)


### Bug Fixes

* **release:** pull latest origin/main before running semantic-release ([bc8b34f](https://github.com/bmartel/jotai-state-tree/commit/bc8b34f26393b4a0511a992b35e54dbfab0a2557))


### Features

* implement jotai-state-tree-devtools with production tree-shaking support ([f076cb7](https://github.com/bmartel/jotai-state-tree/commit/f076cb76b3d64428f323537e00f8bc001bbe26a9))

## [1.12.1](https://github.com/bmartel/jotai-state-tree/compare/v1.12.0...v1.12.1) (2026-06-11)


### Bug Fixes

* **project-starter:** resolve theme toggling, invalid tailwind colors, and sidebar layout shift ([414dd8f](https://github.com/bmartel/jotai-state-tree/commit/414dd8f852f71649d86d8f513bbda8da2610c984))

# [1.12.0](https://github.com/bmartel/jotai-state-tree/compare/v1.11.0...v1.12.0) (2026-06-11)


### Features

* configure semantic-release to automatically update jotai-state-tree version in all examples package.json files on release ([57eaf83](https://github.com/bmartel/jotai-state-tree/commit/57eaf83b8679b28d7cd0583ab0d7555f03813e06))
* upgrade project-starter typescript to 6.0.3 and add vite-env.d.ts declarations ([51e89dc](https://github.com/bmartel/jotai-state-tree/commit/51e89dc0c6138608b4adc90d3321c75dd115a0d3))

# [1.11.0](https://github.com/bmartel/jotai-state-tree/compare/v1.10.1...v1.11.0) (2026-06-11)


### Features

* upgrade project-starter to latest dependencies (React 19, Jotai 2.11, Vite 8, Tailwind v4) ([7556cf7](https://github.com/bmartel/jotai-state-tree/commit/7556cf7a1d725064d7a94c118df7d625e7ab5d6b))

## [1.10.1](https://github.com/bmartel/jotai-state-tree/compare/v1.10.0...v1.10.1) (2026-06-10)


### Bug Fixes

* change project-starter vite version to ^6.0.0 to resolve install peer dependency error ([7edc92e](https://github.com/bmartel/jotai-state-tree/commit/7edc92ec7212286a8b2680d09a89957ad8d4db84))

# [1.10.0](https://github.com/bmartel/jotai-state-tree/compare/v1.9.1...v1.10.0) (2026-06-10)


### Features

* add premium project starter template with Tailwind and Agentic configurations ([37066c5](https://github.com/bmartel/jotai-state-tree/commit/37066c5a5e0eaa11c4fb5da3d35d9f492175f04e))

## [1.9.1](https://github.com/bmartel/jotai-state-tree/compare/v1.9.0...v1.9.1) (2026-06-09)


### Bug Fixes

* prevent duplicate patch listener registration when initialize() is called multiple times ([0d6dd1c](https://github.com/bmartel/jotai-state-tree/commit/0d6dd1c06f8d044188e6849c5e378c6d9c97d464))

# [1.9.0](https://github.com/bmartel/jotai-state-tree/compare/v1.8.0...v1.9.0) (2026-06-09)


### Features

* add fully interactive IndexedDB persistence & offline sync example ([aa5dae4](https://github.com/bmartel/jotai-state-tree/commit/aa5dae4c9cb09ee8c2e49523e8d57469abfe2c26))
* add optional IndexedDB persistence with microtask batching, debouncing, and worker-based compaction ([5b4c26f](https://github.com/bmartel/jotai-state-tree/commit/5b4c26f2f39df40715ac532d6411dec26f7365c6))

# [1.8.0](https://github.com/bmartel/jotai-state-tree/compare/v1.7.5...v1.8.0) (2026-06-09)


### Features

* add React Native compatibility and in-memory history stack to state router ([87022e5](https://github.com/bmartel/jotai-state-tree/commit/87022e5796dd077efe54abbb9d8071477501e77e))

## [1.7.5](https://github.com/bmartel/jotai-state-tree/compare/v1.7.4...v1.7.5) (2026-06-09)

## [1.7.4](https://github.com/bmartel/jotai-state-tree/compare/v1.7.3...v1.7.4) (2026-06-08)

## [1.7.3](https://github.com/bmartel/jotai-state-tree/compare/v1.7.2...v1.7.3) (2026-06-08)

## [1.7.2](https://github.com/bmartel/jotai-state-tree/compare/v1.7.1...v1.7.2) (2026-06-08)

## [1.7.1](https://github.com/bmartel/jotai-state-tree/compare/v1.7.0...v1.7.1) (2026-06-08)


### Bug Fixes

* remove examples package-lock.json files to avoid symlink locking on StackBlitz ([80eb213](https://github.com/bmartel/jotai-state-tree/commit/80eb213731d3d69864048dc126369be4240e5e0e))

# [1.7.0](https://github.com/bmartel/jotai-state-tree/compare/v1.6.0...v1.7.0) (2026-06-08)


### Features

* add multipage router example template and integration tests ([36e4452](https://github.com/bmartel/jotai-state-tree/commit/36e4452b320c0a73b920139dd013539814d3514a))

# [1.6.0](https://github.com/bmartel/jotai-state-tree/compare/v1.5.0...v1.6.0) (2026-06-08)


### Features

* improve MST public API compatibility and document tradeoffs ([b527fd3](https://github.com/bmartel/jotai-state-tree/commit/b527fd39f5097d146473ab2ded057524078c2e9d))

# [1.5.0](https://github.com/bmartel/jotai-state-tree/compare/v1.4.4...v1.5.0) (2026-06-08)


### Features

* **router:** Adding a data driven router ([3e57a94](https://github.com/bmartel/jotai-state-tree/commit/3e57a9491a6f6047f7de4e8aaf497dcc14999f55))

## [1.4.4](https://github.com/bmartel/jotai-state-tree/compare/v1.4.3...v1.4.4) (2026-06-07)

## [1.4.3](https://github.com/bmartel/jotai-state-tree/compare/v1.4.2...v1.4.3) (2026-06-07)

## [1.4.2](https://github.com/bmartel/jotai-state-tree/compare/v1.4.1...v1.4.2) (2026-06-07)


### Bug Fixes

* synchronize UndoManager and TimeTravelManager indexes to prevent broken states on time travel ([bf4fa1f](https://github.com/bmartel/jotai-state-tree/commit/bf4fa1fe3181283deaca002d0f3308bedd2bc352))

## [1.4.1](https://github.com/bmartel/jotai-state-tree/compare/v1.4.0...v1.4.1) (2026-06-06)


### Bug Fixes

* **timetravel:** Undo/redo was not recording history correctly ([6d70799](https://github.com/bmartel/jotai-state-tree/commit/6d70799d3af3856f7abfea9ced6fc027d7d2b0ad))

# [1.4.0](https://github.com/bmartel/jotai-state-tree/compare/v1.3.7...v1.4.0) (2026-06-06)


### Features

* add useUndoManager and useTimeTravelManager hooks, and clean up todo example app ([eee722c](https://github.com/bmartel/jotai-state-tree/commit/eee722c6e17733b33fa94aca8ac3e10c2df11058))

## [1.3.7](https://github.com/bmartel/jotai-state-tree/compare/v1.3.6...v1.3.7) (2026-06-06)


### Bug Fixes

* implement action grouping in TimeTravelManager to prevent intermediate state recording ([17c3479](https://github.com/bmartel/jotai-state-tree/commit/17c3479d84eb9c539fb66e0793cde2d7de8db06b))

## [1.3.6](https://github.com/bmartel/jotai-state-tree/compare/v1.3.5...v1.3.6) (2026-06-06)


### Bug Fixes

* resolve snapshot cache invalidation timing bug during patch notifications ([a9b992f](https://github.com/bmartel/jotai-state-tree/commit/a9b992fdf644fc5c5650f8cdef1490440bcffcd8))

## [1.3.5](https://github.com/bmartel/jotai-state-tree/compare/v1.3.4...v1.3.5) (2026-06-06)


### Bug Fixes

* resolve undo/redo array reconciliation, history manager coordination, and action grouping bugs ([cc45e16](https://github.com/bmartel/jotai-state-tree/commit/cc45e162d582ec417551276b3b01aec1d66363cf))

## [1.3.4](https://github.com/bmartel/jotai-state-tree/compare/v1.3.3...v1.3.4) (2026-06-06)


### Bug Fixes

* resolve StrictMode time-travel bugs and emit granular array patches ([2110242](https://github.com/bmartel/jotai-state-tree/commit/2110242ae4c1819e0b41e76c85c72374f1cbc8dc))

## [1.3.3](https://github.com/bmartel/jotai-state-tree/compare/v1.3.2...v1.3.3) (2026-06-06)


### Bug Fixes

* resolve runtime crashes by reading views directly from store instance instead of snapshot ([6039cfd](https://github.com/bmartel/jotai-state-tree/commit/6039cfd2838ae0fa84aa530e30f2f6abec9a1626))

## [1.3.2](https://github.com/bmartel/jotai-state-tree/compare/v1.3.1...v1.3.2) (2026-06-06)


### Bug Fixes

* remove examples package-lock.json to avoid symlink locking on StackBlitz ([c7dbcd6](https://github.com/bmartel/jotai-state-tree/commit/c7dbcd63661c660513c26a7c5505e809910317b0))

## [1.3.1](https://github.com/bmartel/jotai-state-tree/compare/v1.3.0...v1.3.1) (2026-06-06)


### Bug Fixes

* make example config aliases conditional and add fallback path mappings for StackBlitz compatibility ([9b641c2](https://github.com/bmartel/jotai-state-tree/commit/9b641c28611aae325227dafc616c8b6e559cd201))

# [1.3.0](https://github.com/bmartel/jotai-state-tree/compare/v1.2.1...v1.3.0) (2026-06-06)


### Features

* implement comprehensive support for async actions (flow) and middleware scoping/tracing ([4b55264](https://github.com/bmartel/jotai-state-tree/commit/4b55264cfbd5d92bc7228acf47e877f78c8b3232))

## [1.2.1](https://github.com/bmartel/jotai-state-tree/compare/v1.2.0...v1.2.1) (2026-06-06)


### Performance Improvements

* optimize snapshot generation with structural sharing ([5292a49](https://github.com/bmartel/jotai-state-tree/commit/5292a49552221da21888c74213321b144d5de3c5))

# [1.2.0](https://github.com/bmartel/jotai-state-tree/compare/v1.1.2...v1.2.0) (2026-06-06)


### Bug Fixes

* resolve CI test timeout and clean up documentation warnings ([7445053](https://github.com/bmartel/jotai-state-tree/commit/744505305ca703570b334151a60132dd30508f10))


### Features

* implement precision property-level granular updates for model properties ([efd2784](https://github.com/bmartel/jotai-state-tree/commit/efd27845441b06d757f4d32a136b8080ccd891af))
* implement production-optimized protection checks, memory safety tests, and performance benchmarks ([53b7900](https://github.com/bmartel/jotai-state-tree/commit/53b7900f7a44a18efcd99b029d302fac4435093a))
* **react:** implement useHydrateStore hook utilizing Jotai's useHydrateAtoms ([707935c](https://github.com/bmartel/jotai-state-tree/commit/707935c8b05e2e536cf086adbf09dfc4f3574589))
* **types:** implement perfect TypeScript typing support without hacks ([b7d1c74](https://github.com/bmartel/jotai-state-tree/commit/b7d1c74a8f060d511346091ebc0b5c637bb0c16a))
* use precise non-bubbling store.sub in useObserver and add deep list over-render tests ([36a5166](https://github.com/bmartel/jotai-state-tree/commit/36a5166fbd0a623e0294a1192ddd9ffc91a5b523))

## [1.1.2](https://github.com/bmartel/jotai-state-tree/compare/v1.1.1...v1.1.2) (2026-01-09)


### Bug Fixes

* Add observer tracking for nodes accessed via hooks ([#12](https://github.com/bmartel/jotai-state-tree/issues/12)) ([6b933b3](https://github.com/bmartel/jotai-state-tree/commit/6b933b3c872ccd00cb19889b0c4730475f6ae1d6))

## [1.1.1](https://github.com/bmartel/jotai-state-tree/compare/v1.1.0...v1.1.1) (2026-01-09)


### Bug Fixes

* Notify snapshot listeners when volatile state changes ([#11](https://github.com/bmartel/jotai-state-tree/issues/11)) ([93e4f74](https://github.com/bmartel/jotai-state-tree/commit/93e4f7496fd27bb77c6b7f670b7166129953618a))

# [1.1.0](https://github.com/bmartel/jotai-state-tree/compare/v1.0.3...v1.1.0) (2026-01-08)


### Features

* Adding full typing support for self with a new mixin type and updates to compose ([e72c659](https://github.com/bmartel/jotai-state-tree/commit/e72c6596dde2b064d88ca7d1663248e1c2f23119))

## [1.0.3](https://github.com/bmartel/jotai-state-tree/compare/v1.0.2...v1.0.3) (2026-01-08)

## [1.0.2](https://github.com/bmartel/jotai-state-tree/compare/v1.0.1...v1.0.2) (2026-01-08)

## [1.0.1](https://github.com/bmartel/jotai-state-tree/compare/v1.0.0...v1.0.1) (2026-01-08)

# 1.0.0 (2026-01-08)


### Features

* initial release of jotai-state-tree ([c27d031](https://github.com/bmartel/jotai-state-tree/commit/c27d031cca49edf4c4a9f3c19796d76728fe37bf))
