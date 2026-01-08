/**
 * Performance and stress tests for jotai-state-tree
 * These tests ensure the library performs well under load and doesn't have memory issues
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  types,
  destroy,
  getSnapshot,
  applySnapshot,
  onSnapshot,
  onPatch,
  clone,
  clearAllRegistries,
  resetGlobalStore,
  getRegistryStats,
} from "../index";

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

// ============================================================================
// Performance Benchmarks
// ============================================================================

describe("Performance", () => {
  describe("Creation Performance", () => {
    it("should create 10,000 simple models efficiently", () => {
      const SimpleModel = types.model("Simple", {
        id: types.identifier,
        name: types.string,
        value: types.number,
      });

      const start = performance.now();

      const instances = Array.from({ length: 10000 }, (_, i) =>
        SimpleModel.create({
          id: `item-${i}`,
          name: `Item ${i}`,
          value: i,
        }),
      );

      const elapsed = performance.now() - start;

      expect(instances.length).toBe(10000);
      // Should complete in reasonable time (less than 5 seconds on most machines)
      expect(elapsed).toBeLessThan(5000);

      // Cleanup
      instances.forEach((i) => destroy(i));
    });

    it("should create deeply nested models efficiently", () => {
      const Leaf = types.model("Leaf", { value: types.number });
      const Branch = types.model("Branch", {
        left: types.maybe(types.late(() => Branch)),
        right: types.maybe(types.late(() => Branch)),
        leaf: types.maybe(Leaf),
      });

      const createTree = (depth: number): any => {
        if (depth === 0) return { leaf: { value: 1 } };
        return {
          left: createTree(depth - 1),
          right: createTree(depth - 1),
        };
      };

      const start = performance.now();
      const tree = Branch.create(createTree(10)); // 2^10 = 1024 leaf nodes
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(5000);

      destroy(tree);
    });

    it("should create large arrays efficiently", () => {
      const Item = types.model("Item", {
        id: types.identifier,
        data: types.string,
      });

      const List = types.model("List", {
        items: types.array(Item),
      });

      const items = Array.from({ length: 10000 }, (_, i) => ({
        id: `id-${i}`,
        data: `data-${i}`,
      }));

      const start = performance.now();
      const list = List.create({ items });
      const elapsed = performance.now() - start;

      expect(list.items.length).toBe(10000);
      expect(elapsed).toBeLessThan(5000);

      destroy(list);
    });
  });

  describe("Update Performance", () => {
    it("should handle rapid updates efficiently", () => {
      const Counter = types
        .model("Counter", {
          value: types.number,
        })
        .actions((self) => ({
          increment() {
            self.value += 1;
          },
        }));

      const counter = Counter.create({ value: 0 });

      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        counter.increment();
      }

      const elapsed = performance.now() - start;

      expect(counter.value).toBe(10000);
      expect(elapsed).toBeLessThan(2000);

      destroy(counter);
    });

    it("should handle array mutations efficiently", () => {
      const Item = types.model("Item", {
        id: types.identifier,
        value: types.number,
      });

      const List = types
        .model("List", {
          items: types.array(Item),
        })
        .actions((self) => ({
          addItem(id: string, value: number) {
            self.items.push({ id, value });
          },
          removeFirst() {
            if (self.items.length > 0) {
              self.items.splice(0, 1);
            }
          },
        }));

      const list = List.create({ items: [] });

      const start = performance.now();

      // Add 1000 items
      for (let i = 0; i < 1000; i++) {
        list.addItem(`id-${i}`, i);
      }

      // Remove 500 items
      for (let i = 0; i < 500; i++) {
        list.removeFirst();
      }

      const elapsed = performance.now() - start;

      expect(list.items.length).toBe(500);
      expect(elapsed).toBeLessThan(5000);

      destroy(list);
    });

    it("should handle applySnapshot efficiently", () => {
      const Model = types.model("Model", {
        items: types.array(
          types.model("Item", {
            id: types.identifier,
            value: types.number,
          }),
        ),
      });

      const instance = Model.create({
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: `id-${i}`,
          value: i,
        })),
      });

      const newSnapshot = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: `id-${i}`,
          value: i * 2,
        })),
      };

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        applySnapshot(instance, newSnapshot);
      }

      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(5000);

      destroy(instance);
    });
  });

  describe("Snapshot Performance", () => {
    it("should generate snapshots efficiently", () => {
      const Item = types.model("Item", {
        id: types.identifier,
        name: types.string,
        value: types.number,
      });

      const Store = types.model("Store", {
        items: types.array(Item),
      });

      const store = Store.create({
        items: Array.from({ length: 5000 }, (_, i) => ({
          id: `id-${i}`,
          name: `Item ${i}`,
          value: i,
        })),
      });

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        getSnapshot(store);
      }

      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(2000);

      destroy(store);
    });
  });

  describe("Listener Performance", () => {
    it("should handle many snapshot listeners efficiently", () => {
      const Model = types
        .model("Model", {
          value: types.number,
        })
        .actions((self) => ({
          setValue(v: number) {
            self.value = v;
          },
        }));

      const instance = Model.create({ value: 0 });

      // Add many listeners
      const disposers: (() => void)[] = [];
      let callCount = 0;

      for (let i = 0; i < 100; i++) {
        disposers.push(
          onSnapshot(instance, () => {
            callCount++;
          }),
        );
      }

      const start = performance.now();

      // Trigger many updates
      for (let i = 0; i < 100; i++) {
        instance.setValue(i);
      }

      const elapsed = performance.now() - start;

      expect(callCount).toBe(10000); // 100 listeners * 100 updates
      expect(elapsed).toBeLessThan(2000);

      // Cleanup
      disposers.forEach((d) => d());
      destroy(instance);
    });

    it("should handle many patch listeners efficiently", () => {
      const Model = types
        .model("Model", {
          value: types.number,
        })
        .actions((self) => ({
          setValue(v: number) {
            self.value = v;
          },
        }));

      const instance = Model.create({ value: 0 });

      const disposers: (() => void)[] = [];
      let patchCount = 0;

      for (let i = 0; i < 100; i++) {
        disposers.push(
          onPatch(instance, () => {
            patchCount++;
          }),
        );
      }

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        instance.setValue(i);
      }

      const elapsed = performance.now() - start;

      expect(patchCount).toBe(10000);
      expect(elapsed).toBeLessThan(2000);

      disposers.forEach((d) => d());
      destroy(instance);
    });
  });

  describe("Clone Performance", () => {
    it("should clone large structures efficiently", () => {
      const Item = types.model("Item", {
        id: types.identifier,
        data: types.string,
      });

      const Store = types.model("Store", {
        items: types.array(Item),
      });

      const original = Store.create({
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: `id-${i}`,
          data: `data-${i}`,
        })),
      });

      const start = performance.now();

      const clones = [];
      for (let i = 0; i < 10; i++) {
        clones.push(clone(original));
      }

      const elapsed = performance.now() - start;

      expect(clones.length).toBe(10);
      expect(elapsed).toBeLessThan(3000);

      // Cleanup
      destroy(original);
      clones.forEach((c) => destroy(c));
    });
  });
});

// ============================================================================
// Stress Tests
// ============================================================================

describe("Stress Tests", () => {
  describe("Memory Stress", () => {
    it("should handle create/destroy cycles without memory growth", () => {
      const Model = types.model("Model", {
        id: types.identifier,
        value: types.number,
      });

      const statsBefore = getRegistryStats();

      // Create and destroy many times
      for (let cycle = 0; cycle < 100; cycle++) {
        const instances = Array.from({ length: 100 }, (_, i) =>
          Model.create({ id: `cycle${cycle}-item${i}`, value: i }),
        );

        instances.forEach((i) => destroy(i));
      }

      const statsAfter = getRegistryStats();

      // Registry should not have grown
      expect(statsAfter.liveNodeCount).toBe(statsBefore.liveNodeCount);
      expect(statsAfter.identifierRegistrySize).toBe(
        statsBefore.identifierRegistrySize,
      );
    });

    it("should handle listener add/remove cycles", () => {
      const Model = types
        .model("Model", {
          value: types.number,
        })
        .actions((self) => ({
          setValue(v: number) {
            self.value = v;
          },
        }));

      const instance = Model.create({ value: 0 });

      // Add and remove listeners many times
      for (let cycle = 0; cycle < 100; cycle++) {
        const disposers: (() => void)[] = [];

        for (let i = 0; i < 50; i++) {
          disposers.push(onSnapshot(instance, () => {}));
          disposers.push(onPatch(instance, () => {}));
        }

        // Trigger some updates
        for (let i = 0; i < 10; i++) {
          instance.setValue(i);
        }

        // Remove all listeners
        disposers.forEach((d) => d());
      }

      // Should complete without issues
      expect(instance.value).toBe(9);

      destroy(instance);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle interleaved operations on multiple stores", () => {
      const Counter = types
        .model("Counter", {
          id: types.identifier,
          value: types.number,
        })
        .actions((self) => ({
          increment() {
            self.value += 1;
          },
        }));

      const counters = Array.from({ length: 100 }, (_, i) =>
        Counter.create({ id: `counter-${i}`, value: 0 }),
      );

      // Interleaved operations
      for (let round = 0; round < 100; round++) {
        counters.forEach((c) => c.increment());
      }

      // Verify all counters have correct value
      counters.forEach((c) => {
        expect(c.value).toBe(100);
      });

      // Cleanup
      counters.forEach((c) => destroy(c));
    });
  });

  describe("Edge Cases Under Load", () => {
    it("should handle rapid snapshot subscriptions during updates", () => {
      const Model = types
        .model("Model", {
          value: types.number,
        })
        .actions((self) => ({
          setValue(v: number) {
            self.value = v;
          },
        }));

      const instance = Model.create({ value: 0 });
      const disposers: (() => void)[] = [];
      let snapshotCount = 0;

      // Add listeners while updating
      for (let i = 0; i < 100; i++) {
        instance.setValue(i);

        if (i % 10 === 0) {
          disposers.push(
            onSnapshot(instance, () => {
              snapshotCount++;
            }),
          );
        }
      }

      // More updates after all listeners added
      for (let i = 100; i < 200; i++) {
        instance.setValue(i);
      }

      expect(snapshotCount).toBeGreaterThan(0);

      disposers.forEach((d) => d());
      destroy(instance);
    });

    it("should handle destroy during iteration", () => {
      const Item = types.model("Item", {
        id: types.identifier,
        value: types.number,
      });

      const List = types
        .model("List", {
          items: types.array(Item),
        })
        .actions((self) => ({
          clearAll() {
            self.items.length = 0;
          },
        }));

      const list = List.create({
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `id-${i}`,
          value: i,
        })),
      });

      // Get items for reference
      const itemsRef = [...list.items];

      // Clear the list
      list.clearAll();

      expect(list.items.length).toBe(0);

      destroy(list);
    });
  });

  describe("Identifier Registry Stress", () => {
    it("should handle massive identifier churn", { timeout: 30000 }, () => {
      const Item = types.model("Item", {
        id: types.identifier,
        value: types.number,
      });

      const List = types
        .model("List", {
          items: types.array(Item),
        })
        .actions((self) => ({
          addItem(id: string, value: number) {
            self.items.push({ id, value });
          },
          removeFirst() {
            self.items.splice(0, 1);
          },
        }));

      const list = List.create({ items: [] });

      // Add and remove many items
      for (let i = 0; i < 5000; i++) {
        list.addItem(`item-${i}`, i);

        // Remove items periodically to test cleanup
        if (i > 100 && i % 2 === 0) {
          list.removeFirst();
        }
      }

      const stats = getRegistryStats();

      // Should have proper cleanup
      expect(stats.identifierRegistrySize).toBeLessThan(5000);

      destroy(list);

      const statsAfter = getRegistryStats();
      expect(statsAfter.identifierRegistrySize).toBe(0);
    });
  });
});

// ============================================================================
// Regression Tests
// ============================================================================

describe("Regression Tests", () => {
  it("should not leak nodes when using maybe types", () => {
    const Child = types.model("Child", { value: types.number });
    const Parent = types
      .model("Parent", {
        child: types.maybe(Child),
      })
      .actions((self) => ({
        setChild(value: number | null) {
          self.child = value !== null ? { value } : undefined;
        },
      }));

    const parent = Parent.create({ child: { value: 1 } });

    const statsBefore = getRegistryStats();

    // Toggle child many times
    for (let i = 0; i < 100; i++) {
      parent.setChild(i % 2 === 0 ? i : null);
    }

    destroy(parent);

    const statsAfter = getRegistryStats();
    expect(statsAfter.liveNodeCount).toBe(0);
  });

  it("should not leak nodes when using late types in arrays", () => {
    const Node = types.model("Node", {
      id: types.identifier,
      children: types.array(types.late(() => Node)),
    });

    const root = Node.create({
      id: "root",
      children: [
        {
          id: "child1",
          children: [
            { id: "grandchild1", children: [] },
            { id: "grandchild2", children: [] },
          ],
        },
        {
          id: "child2",
          children: [],
        },
      ],
    });

    const statsBefore = getRegistryStats();
    expect(statsBefore.liveNodeCount).toBeGreaterThan(0);

    destroy(root);

    const statsAfter = getRegistryStats();
    expect(statsAfter.liveNodeCount).toBe(0);
    expect(statsAfter.identifierRegistrySize).toBe(0);
  });
});
