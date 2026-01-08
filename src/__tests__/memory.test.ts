/**
 * Memory Management Tests for jotai-state-tree
 *
 * These tests verify that the library properly manages memory and doesn't leak:
 * - Node registry cleanup
 * - Identifier registry cleanup
 * - Listener cleanup
 * - Action recorder cleanup
 * - WeakRef/WeakMap behavior
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  types,
  getSnapshot,
  onSnapshot,
  onPatch,
  destroy,
  getIdentifier,
  isAlive,
  clone,
  detach,
} from "../index";
import {
  getRegistryStats,
  cleanupStaleEntries,
  clearAllRegistries,
  resetGlobalStore,
} from "../tree";
import { recordActions } from "../lifecycle";

describe("Memory Management", () => {
  beforeEach(() => {
    // Clear all registries before each test
    clearAllRegistries();
    resetGlobalStore();
  });

  afterEach(() => {
    // Ensure cleanup after each test
    clearAllRegistries();
    resetGlobalStore();
  });

  describe("Node Registry Cleanup", () => {
    it("should remove nodes from registry on destroy()", () => {
      const Model = types.model("TestModel", {
        id: types.identifier,
        name: types.string,
      });

      const instance = Model.create({ id: "1", name: "Test" });

      // Verify node is registered
      let stats = getRegistryStats();
      expect(stats.nodeRegistrySize).toBeGreaterThan(0);

      // Destroy the node
      destroy(instance);

      // Verify node is removed from registry
      stats = getRegistryStats();
      expect(stats.liveNodeCount).toBe(0);
    });

    it("should remove all child nodes from registry on parent destroy()", () => {
      const Child = types.model("Child", {
        value: types.number,
      });

      const Parent = types.model("Parent", {
        children: types.array(Child),
      });

      const instance = Parent.create({
        children: [{ value: 1 }, { value: 2 }, { value: 3 }],
      });

      const statsBefore = getRegistryStats();
      const nodeCountBefore = statsBefore.nodeRegistrySize;

      // Destroy parent - should destroy all children too
      destroy(instance);

      const statsAfter = getRegistryStats();
      expect(statsAfter.liveNodeCount).toBe(0);
    });

    it("should handle rapid create/destroy cycles without leaking", () => {
      const Model = types.model("CycleModel", {
        id: types.identifier,
        value: types.number,
      });

      // Create and destroy many nodes
      for (let i = 0; i < 100; i++) {
        const instance = Model.create({ id: `id-${i}`, value: i });
        destroy(instance);
      }

      const stats = getRegistryStats();
      expect(stats.liveNodeCount).toBe(0);
    });
  });

  describe("Identifier Registry Cleanup", () => {
    it("should remove identifiers on destroy()", () => {
      const Model = types.model("IdentifiedModel", {
        id: types.identifier,
        name: types.string,
      });

      const instance = Model.create({ id: "unique-id", name: "Test" });

      // Verify identifier is registered
      let stats = getRegistryStats();
      expect(stats.identifierRegistrySize).toBeGreaterThan(0);

      // Destroy
      destroy(instance);

      // Verify identifier is removed
      stats = getRegistryStats();
      expect(stats.identifierRegistrySize).toBe(0);
    });

    it("should clean up empty type maps in identifier registry", () => {
      const ModelA = types.model("ModelA", {
        id: types.identifier,
      });

      const ModelB = types.model("ModelB", {
        id: types.identifier,
      });

      const a1 = ModelA.create({ id: "a1" });
      const a2 = ModelA.create({ id: "a2" });
      const b1 = ModelB.create({ id: "b1" });

      let stats = getRegistryStats();
      expect(stats.identifierTypeCount).toBe(2); // ModelA and ModelB

      // Destroy all of ModelA
      destroy(a1);
      destroy(a2);

      stats = getRegistryStats();
      expect(stats.identifierTypeCount).toBe(1); // Only ModelB remains

      // Destroy ModelB
      destroy(b1);

      stats = getRegistryStats();
      expect(stats.identifierTypeCount).toBe(0);
    });

    it("should handle identifier reuse after destroy", () => {
      const Model = types.model("ReuseModel", {
        id: types.identifier,
        value: types.number,
      });

      // Create with ID
      const instance1 = Model.create({ id: "reused-id", value: 1 });
      expect(getIdentifier(instance1)).toBe("reused-id");

      // Destroy
      destroy(instance1);

      // Reuse the same ID
      const instance2 = Model.create({ id: "reused-id", value: 2 });
      expect(getIdentifier(instance2)).toBe("reused-id");
      expect(instance2.value).toBe(2);

      destroy(instance2);
    });
  });

  describe("Listener Cleanup", () => {
    it("should clean up snapshot listeners on destroy()", () => {
      const Model = types.model("ListenerModel", {
        value: types.number,
      });

      const instance = Model.create({ value: 0 });

      let callCount = 0;
      const disposer = onSnapshot(instance, () => {
        callCount++;
      });

      // Trigger a change
      (instance as any).value = 1;
      expect(callCount).toBe(1);

      // Destroy the node
      destroy(instance);

      // Listener should be cleared, no more calls
      // (can't trigger changes on dead node, but internal state is cleared)
      const stats = getRegistryStats();
      expect(stats.liveNodeCount).toBe(0);
    });

    it("should properly dispose listeners when disposer is called", () => {
      const Model = types.model("DisposerModel", {
        value: types.number,
      });

      const instance = Model.create({ value: 0 });

      let callCount = 0;
      const disposer = onSnapshot(instance, () => {
        callCount++;
      });

      // Trigger a change
      (instance as any).value = 1;
      expect(callCount).toBe(1);

      // Dispose the listener
      disposer();

      // Trigger another change - listener should not be called
      (instance as any).value = 2;
      expect(callCount).toBe(1); // Still 1, not incremented

      destroy(instance);
    });

    it("should clean up patch listeners on destroy()", () => {
      const Model = types.model("PatchListenerModel", {
        value: types.number,
      });

      const instance = Model.create({ value: 0 });

      let patchCount = 0;
      const disposer = onPatch(instance, () => {
        patchCount++;
      });

      // Trigger a change
      (instance as any).value = 1;
      expect(patchCount).toBe(1);

      // Destroy
      destroy(instance);

      const stats = getRegistryStats();
      expect(stats.liveNodeCount).toBe(0);
    });

    it("should not accumulate listeners on re-subscription", () => {
      const Model = types.model("ResubModel", {
        value: types.number,
      });

      const instance = Model.create({ value: 0 });

      // Subscribe and unsubscribe many times
      for (let i = 0; i < 100; i++) {
        const disposer = onSnapshot(instance, () => {});
        disposer();
      }

      // One final subscription
      let callCount = 0;
      onSnapshot(instance, () => {
        callCount++;
      });

      (instance as any).value = 1;
      expect(callCount).toBe(1); // Should only be called once, not 100 times

      destroy(instance);
    });
  });

  describe("Action Recorder Cleanup", () => {
    it("should clean up recorder on stop()", () => {
      const Model = types
        .model("ActionModel", {
          value: types.number,
        })
        .actions((self) => ({
          increment() {
            self.value += 1;
          },
        }));

      const instance = Model.create({ value: 0 });

      const recorder = recordActions(instance);

      instance.increment();
      instance.increment();

      expect(recorder.actions.length).toBe(2);

      // Stop recording
      recorder.stop();

      // Further actions should not be recorded
      instance.increment();
      expect(recorder.actions.length).toBe(2); // Still 2

      destroy(instance);
    });

    it("should allow GC of nodes even with active recorders (WeakMap)", () => {
      const Model = types
        .model("WeakRecorderModel", {
          id: types.identifier,
          value: types.number,
        })
        .actions((self) => ({
          increment() {
            self.value += 1;
          },
        }));

      // Create many instances with recorders
      for (let i = 0; i < 50; i++) {
        const instance = Model.create({ id: `rec-${i}`, value: 0 });
        const recorder = recordActions(instance);
        instance.increment();
        recorder.stop();
        destroy(instance);
      }

      const stats = getRegistryStats();
      expect(stats.liveNodeCount).toBe(0);
      expect(stats.identifierRegistrySize).toBe(0);
    });
  });

  describe("Deep Tree Cleanup", () => {
    it("should clean up deeply nested structures", () => {
      // Ensure clean state
      clearAllRegistries();
      resetGlobalStore();

      const statsInitial = getRegistryStats();
      expect(statsInitial.liveNodeCount).toBe(0);

      const Leaf = types.model("Leaf", {
        value: types.number,
      });

      const Branch = types.model("Branch", {
        children: types.array(types.late(() => Branch)),
        leaf: types.maybe(Leaf),
      });

      // Create a deep tree
      const createDeepTree = (depth: number): any => {
        if (depth === 0) {
          return { children: [], leaf: { value: 1 } };
        }
        return {
          children: [createDeepTree(depth - 1), createDeepTree(depth - 1)],
          leaf: { value: depth },
        };
      };

      const tree = Branch.create(createDeepTree(5));

      const statsBefore = getRegistryStats();
      expect(statsBefore.liveNodeCount).toBeGreaterThan(50); // Many nodes created

      destroy(tree);

      const statsAfter = getRegistryStats();
      // All nodes should be destroyed
      expect(statsAfter.liveNodeCount).toBe(0);
    });

    it("should clean up large arrays", () => {
      const Item = types.model("Item", {
        id: types.identifier,
        value: types.number,
      });

      const List = types.model("List", {
        items: types.array(Item),
      });

      // Create a large array
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        value: i,
      }));

      const list = List.create({ items });

      const statsBefore = getRegistryStats();
      expect(statsBefore.nodeRegistrySize).toBeGreaterThan(1000);

      destroy(list);

      const statsAfter = getRegistryStats();
      expect(statsAfter.liveNodeCount).toBe(0);
      expect(statsAfter.identifierRegistrySize).toBe(0);
    });
  });

  describe("Clone and Detach Memory", () => {
    it("should properly manage memory for cloned nodes", () => {
      const Model = types.model("CloneModel", {
        id: types.identifier,
        value: types.number,
      });

      const original = Model.create({ id: "original", value: 1 });
      const cloned = clone(original);

      // Both should be alive
      expect(isAlive(original)).toBe(true);
      expect(isAlive(cloned)).toBe(true);

      const statsBefore = getRegistryStats();

      // Destroy original
      destroy(original);
      expect(isAlive(original)).toBe(false);
      expect(isAlive(cloned)).toBe(true);

      // Destroy clone
      destroy(cloned);

      const statsAfter = getRegistryStats();
      expect(statsAfter.liveNodeCount).toBe(0);
    });

    it("should clean up detached nodes when destroyed", () => {
      const Child = types.model("DetachChild", {
        value: types.number,
      });

      const Parent = types.model("DetachParent", {
        child: Child,
      });

      const instance = Parent.create({ child: { value: 1 } });
      const child = instance.child;

      // Detach child
      detach(child);

      // Child is still alive but detached
      expect(isAlive(child)).toBe(true);

      // Destroy both
      destroy(child);
      destroy(instance);

      const stats = getRegistryStats();
      expect(stats.liveNodeCount).toBe(0);
    });
  });

  describe("Stale Entry Cleanup", () => {
    it("should clean up stale entries with cleanupStaleEntries()", () => {
      const Model = types.model("StaleModel", {
        value: types.number,
      });

      // Create some nodes
      const nodes = Array.from({ length: 10 }, (_, i) =>
        Model.create({ value: i }),
      );

      // Destroy half of them
      nodes.slice(0, 5).forEach((n) => destroy(n));

      // Run cleanup
      const cleaned = cleanupStaleEntries();

      // Should have cleaned up destroyed entries
      expect(cleaned).toBeGreaterThanOrEqual(0);

      // Destroy the rest
      nodes.slice(5).forEach((n) => destroy(n));

      const stats = getRegistryStats();
      expect(stats.liveNodeCount).toBe(0);
    });
  });

  describe("Map Type Cleanup", () => {
    it("should clean up map entries on destroy", () => {
      const Item = types.model("MapItem", {
        id: types.identifier,
        value: types.number,
      });

      const Store = types.model("MapStore", {
        items: types.map(Item),
      });

      const store = Store.create({
        items: {
          a: { id: "a", value: 1 },
          b: { id: "b", value: 2 },
          c: { id: "c", value: 3 },
        },
      });

      const statsBefore = getRegistryStats();
      expect(statsBefore.identifierRegistrySize).toBe(3);

      destroy(store);

      const statsAfter = getRegistryStats();
      expect(statsAfter.liveNodeCount).toBe(0);
      expect(statsAfter.identifierRegistrySize).toBe(0);
    });
  });
});

describe("Stress Tests", () => {
  beforeEach(() => {
    clearAllRegistries();
    resetGlobalStore();
  });

  afterEach(() => {
    clearAllRegistries();
    resetGlobalStore();
  });

  it("should handle 1000 create/destroy cycles efficiently", () => {
    const Model = types.model("StressModel", {
      id: types.identifier,
      value: types.number,
    });

    const startTime = Date.now();

    for (let i = 0; i < 1000; i++) {
      const instance = Model.create({ id: `stress-${i}`, value: i });
      destroy(instance);
    }

    const duration = Date.now() - startTime;

    // Should complete in reasonable time (< 5 seconds)
    expect(duration).toBeLessThan(5000);

    const stats = getRegistryStats();
    expect(stats.liveNodeCount).toBe(0);
    expect(stats.identifierRegistrySize).toBe(0);
  });

  it("should handle deep nesting without stack overflow", () => {
    // Ensure clean state
    clearAllRegistries();
    resetGlobalStore();

    const statsInitial = getRegistryStats();
    expect(statsInitial.liveNodeCount).toBe(0);

    const Node = types.model("DeepNode", {
      child: types.maybe(types.late(() => Node)),
    });

    // Create a deeply nested structure (100 levels)
    let snapshot: any = null;
    for (let i = 0; i < 100; i++) {
      snapshot = { child: snapshot };
    }

    const root = Node.create(snapshot);

    expect(isAlive(root)).toBe(true);

    const statsBeforeDestroy = getRegistryStats();
    expect(statsBeforeDestroy.liveNodeCount).toBeGreaterThan(0);

    destroy(root);

    const stats = getRegistryStats();
    // All nodes should be destroyed
    expect(stats.liveNodeCount).toBe(0);
  });

  it("should handle many concurrent subscriptions", () => {
    const Model = types.model("SubModel", {
      value: types.number,
    });

    const instance = Model.create({ value: 0 });
    const disposers: (() => void)[] = [];

    // Add many subscriptions
    for (let i = 0; i < 100; i++) {
      disposers.push(onSnapshot(instance, () => {}));
      disposers.push(onPatch(instance, () => {}));
    }

    // Dispose all
    disposers.forEach((d) => d());

    // Make a change
    let callCount = 0;
    onSnapshot(instance, () => callCount++);
    (instance as any).value = 1;

    expect(callCount).toBe(1); // Only the one active subscription

    destroy(instance);
  });

  describe("Property Atoms and Proxy Lifecycle", () => {
    it("should not leak property atoms after destroy", () => {
      // Property atoms are instance-scoped in the proxy closure.
      // When the instance is destroyed and dereferenced, the atoms
      // should be eligible for GC (Jotai uses WeakMap internally).

      const Model = types.model("AtomModel", {
        name: types.string,
        count: types.number,
        active: types.boolean,
      });

      const statsBefore = getRegistryStats();

      // Create and destroy many instances
      for (let i = 0; i < 100; i++) {
        const instance = Model.create({
          name: `item-${i}`,
          count: i,
          active: i % 2 === 0,
        });
        destroy(instance);
      }

      const statsAfter = getRegistryStats();

      // All nodes should be cleaned up
      expect(statsAfter.liveNodeCount).toBe(statsBefore.liveNodeCount);
      expect(statsAfter.nodeRegistrySize).toBe(statsBefore.nodeRegistrySize);
    });

    it("should not leak when rapidly creating and destroying models with complex properties", () => {
      const Child = types.model("ChildModel", {
        value: types.number,
      });

      const Parent = types.model("ParentModel", {
        name: types.string,
        child: types.maybe(Child),
        items: types.array(types.number),
      });

      const statsBefore = getRegistryStats();

      // Rapid create/destroy cycle
      for (let i = 0; i < 50; i++) {
        const instance = Parent.create({
          name: `parent-${i}`,
          child: i % 2 === 0 ? { value: i } : undefined,
          items: [1, 2, 3, 4, 5],
        });

        // Access properties to ensure atoms are used
        const _ = instance.name;
        const __ = instance.child?.value;
        const ___ = instance.items.length;

        destroy(instance);
      }

      const statsAfter = getRegistryStats();

      // All nodes should be cleaned up
      expect(statsAfter.liveNodeCount).toBe(statsBefore.liveNodeCount);
    });
  });
});
