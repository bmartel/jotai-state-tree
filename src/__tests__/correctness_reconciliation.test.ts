import { describe, it, expect } from "vitest";
import { types, applySnapshot, getSnapshot, destroy, isAlive } from "../index";

describe("Phase 1 Correctness: applySnapshot & Reference Lookup", () => {
  it("should restore optional properties to default values when omitted in applySnapshot", () => {
    const TestModel = types.model("TestModel", {
      id: types.string,
      name: types.optional(types.string, "Default Name"),
      count: types.optional(types.number, 10),
    });

    const instance = TestModel.create({ id: "1", name: "Custom Name", count: 42 });
    expect(instance.name).toBe("Custom Name");
    expect(instance.count).toBe(42);

    // Apply snapshot missing name and count
    applySnapshot(instance, { id: "1" });

    // Both should be restored to their defaults defined in schema
    expect(instance.name).toBe("Default Name");
    expect(instance.count).toBe(10);
  });

  it("should ignore missing required properties in applySnapshot", () => {
    const TestModel = types.model("TestModel", {
      id: types.string,
      name: types.string,
    });

    const instance = TestModel.create({ id: "1", name: "Alice" });
    
    // Applying a snapshot missing the required 'name' property should not throw,
    // and 'name' should retain its existing value.
    applySnapshot(instance, { id: "1" } as any);
    expect(instance.name).toBe("Alice");
  });

  it("should re-resolve references when the originally cached target node is destroyed/replaced", () => {
    const Item = types.model("Item", {
      id: types.identifier,
      value: types.string,
    }).actions(self => ({
      setValue(val: string) {
        self.value = val;
      }
    }));

    const Store = types.model("Store", {
      items: types.map(Item),
      currentItem: types.reference(Item),
    }).actions(self => ({
      putItem(item: any) {
        self.items.put(item);
      },
      deleteItem(id: string) {
        self.items.delete(id);
      },
      setCurrentItem(item: any) {
        self.currentItem = item;
      }
    }));

    const store = Store.create({
      items: {
        "1": { id: "1", value: "Original Item" }
      },
      currentItem: "1",
    });

    // 1. Initial resolution of reference
    expect(store.currentItem.value).toBe("Original Item");
    const originalRef = store.currentItem;

    // 2. Destroy the original item node by deleting it from map
    store.deleteItem("1");
    expect(isAlive(originalRef)).toBe(false);

    // 3. Add a new item node with same ID
    store.putItem({ id: "1", value: "New Replaced Item" });

    // 4. Access currentItem (proxy) again. It should re-resolve to the new node
    expect(store.currentItem.value).toBe("New Replaced Item");
  });
});
