import { describe, it, expect } from "vitest";
import { types, getGlobalStore, unprotect } from "../index";
import { getStateTreeNode } from "../tree";

describe("Phase 2 Performance: Collection Syncing", () => {
  it("should perform O(1) version increments and updates when splicing arrays", () => {
    const TestModel = types.model("TestModel", {
      list: types.array(types.number),
    });

    // Create a large array of 100 items
    const initialList = Array.from({ length: 100 }, (_, i) => i);
    const instance = TestModel.create({ list: initialList });

    const listNode = getStateTreeNode(instance.list);
    const store = getGlobalStore();

    const initialVersion = store.get(listNode.structureVersionAtom);

    unprotect(instance);

    // Perform a splice that inserts and deletes items
    instance.list.splice(10, 50, 999, 888, 777);

    const afterVersion = store.get(listNode.structureVersionAtom);

    // Verify that the version was incremented exactly once, not for every element recreation
    expect(afterVersion).toBe(initialVersion + 1);
    expect(instance.list.length).toBe(53);
  });

  it("should perform O(1) version increments when modifying maps", () => {
    const TestModel = types.model("TestModel", {
      items: types.map(types.string),
    });

    const initialMap: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      initialMap[`key_${i}`] = `value_${i}`;
    }

    const instance = TestModel.create({ items: initialMap });
    const mapNode = getStateTreeNode(instance.items);
    const store = getGlobalStore();

    const initialVersion = store.get(mapNode.structureVersionAtom);

    unprotect(instance);

    // Modify a map entry and put new entry
    instance.items.set("key_0", "newValue");
    instance.items.set("newKey", "newValue");

    const afterVersion = store.get(mapNode.structureVersionAtom);

    // Each standalone operation (set) is a transaction/action, so it should increment the version by 1
    // (a total of 2 operations -> +2 version updates, not 100+ updates per set!)
    expect(afterVersion).toBe(initialVersion + 2);
  });
});
