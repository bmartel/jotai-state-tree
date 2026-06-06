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
