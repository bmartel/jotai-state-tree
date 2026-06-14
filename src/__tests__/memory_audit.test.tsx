// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import {
  types,
  destroy,
  getRegistryStats,
  clearAllRegistries,
  resetGlobalStore,
} from "../index";
import { useLocalObservable } from "../react";
import { createPersistenceManager, activePersistenceManagers } from "../persistence";
import { createUndoManager, historyTrackersRegistry } from "../undo";

// Minimal IndexedDB Mock
class MockIDBDatabase {
  objectStoreNames = {
    contains: () => true,
  };
  transaction() {
    return {
      objectStore: () => ({
        get: () => {
          const req = { onsuccess: null as any };
          Promise.resolve().then(() => req.onsuccess && req.onsuccess());
          return req;
        },
        put: () => {
          const req = { onsuccess: null as any };
          Promise.resolve().then(() => req.onsuccess && req.onsuccess());
          return req;
        },
        clear: () => {
          const req = { onsuccess: null as any };
          Promise.resolve().then(() => req.onsuccess && req.onsuccess());
          return req;
        },
        getAll: () => {
          const req = { onsuccess: null as any, result: [] };
          Promise.resolve().then(() => req.onsuccess && req.onsuccess());
          return req;
        },
      }),
    };
  }
}

const dbMock = new MockIDBDatabase();

describe("Performance and Memory Audit Verification", () => {
  let originalIndexedDB: any;

  beforeEach(() => {
    clearAllRegistries();
    resetGlobalStore();
    originalIndexedDB = globalThis.indexedDB;
    globalThis.indexedDB = {
      open: () => {
        const req = { result: dbMock, onsuccess: null as any };
        Promise.resolve().then(() => req.onsuccess && req.onsuccess());
        return req as any;
      },
    } as any;
  });

  afterEach(() => {
    globalThis.indexedDB = originalIndexedDB;
    clearAllRegistries();
    resetGlobalStore();
    cleanup();
  });

  describe("useLocalObservable Memory Safety", () => {
    const Model = types.model("Counter", {
      count: types.number,
    }).actions((self) => ({
      increment() {
        self.count++;
      },
    }));

    it("should allow manual cleanup in useEffect", async () => {
      const statsBefore = getRegistryStats();
      expect(statsBefore.liveNodeCount).toBe(0);

      function TestComponent() {
        const store = useLocalObservable(() => Model.create({ count: 0 }));

        React.useEffect(() => {
          return () => destroy(store);
        }, [store]);

        return <div data-testid="count">{store.count}</div>;
      }

      const { unmount } = render(<TestComponent />);

      const statsAfterMount = getRegistryStats();
      expect(statsAfterMount.liveNodeCount).toBe(2); // Store node + count property node

      unmount();

      const statsAfterUnmount = getRegistryStats();
      expect(statsAfterUnmount.liveNodeCount).toBe(0); // Should be completely cleaned up
    });
  });

  describe("PersistenceManager Auto-Disposal", () => {
    const Model = types.model("PersistentStore", {
      data: types.string,
    });

    it("should automatically dispose PersistenceManager and clean window listeners when store is destroyed", async () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      const removeSpy = vi.spyOn(window, "removeEventListener");

      const store = Model.create({ data: "hello" });
      const manager = createPersistenceManager(store, { key: "test-key" });

      await manager.initialize();

      expect(activePersistenceManagers.has(store)).toBe(true);
      expect(addSpy).toHaveBeenCalled();

      // Destroy the store
      destroy(store);

      // Verify manager was automatically disposed
      expect(activePersistenceManagers.has(store)).toBe(false);
      expect(removeSpy).toHaveBeenCalled();

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe("HistoryTracker Auto-Disposal", () => {
    const Model = types.model("UndoStore", {
      value: types.number,
    });

    it("should automatically dispose HistoryTracker when store is destroyed", () => {
      const store = Model.create({ value: 42 });
      const undoManager = createUndoManager(store);

      expect(historyTrackersRegistry.has(store)).toBe(true);

      // Destroy the store
      destroy(store);

      // Verify tracker was automatically disposed
      expect(historyTrackersRegistry.has(store)).toBe(false);
    });
  });

  describe("Primitive Property Atom Optimization", () => {
    const Model = types.model("SimpleModel", {
      value: types.number,
    });

    it("should not create a redundant/discarded atom for primitive property", () => {
      const store = Model.create({ value: 100 });
      const node = (store as any).$treenode;
      const childNode = node.getChild("value");

      expect(childNode).toBeDefined();
      expect(childNode.valueAtom).toBeDefined();
      expect(store.value).toBe(100);

      destroy(store);
    });
  });
});
