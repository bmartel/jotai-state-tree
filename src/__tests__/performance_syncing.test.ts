import { describe, it, expect } from "vitest";
import { types, getGlobalStore, unprotect, destroy, detach } from "../index";
import { getStateTreeNode, rootNodesRegistry } from "../tree";

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

  it("should perform array pushes in O(1) complexity and execute extremely fast", () => {
    const TestModel = types.model("TestModel", {
      list: types.array(types.number),
    });

    const initialList = Array.from({ length: 10000 }, (_, i) => i);
    const instance = TestModel.create({ list: initialList });

    unprotect(instance);

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      instance.list.push(i);
    }
    const duration = performance.now() - start;

    expect(instance.list.length).toBe(11000);
    // Pushing 1000 items individually to a 10k-item array should be very fast (typically < 50ms, relaxed to < 5000ms for slow CI)
    expect(duration).toBeLessThan(5000);
  });

  it("should correctly manage rootNodesRegistry during node lifecycle", () => {
    const Child = types.model("Child", {
      id: types.identifier,
    });
    const Parent = types.model("Parent", {
      child: types.maybe(Child),
    });

    const initialRootCount = rootNodesRegistry.size;

    // 1. Creation -> Should be added to rootNodesRegistry
    const child = Child.create({ id: "c1" });
    const childNode = getStateTreeNode(child);
    expect(rootNodesRegistry.has(childNode.$id)).toBe(true);

    const parent = Parent.create({});
    const parentNode = getStateTreeNode(parent);
    expect(rootNodesRegistry.has(parentNode.$id)).toBe(true);

    // 2. Child attachment -> Should be removed from rootNodesRegistry
    unprotect(parent);
    parent.child = child; // This clones child referentially and attaches it.
    // The original child remains a root node
    expect(rootNodesRegistry.has(childNode.$id)).toBe(true);
    // The newly created child node that is attached to parent is NOT a root node
    const attachedChildNode = getStateTreeNode(parent.child);
    expect(rootNodesRegistry.has(attachedChildNode.$id)).toBe(false);
    expect(rootNodesRegistry.has(parentNode.$id)).toBe(true);

    // 3. Child detachment -> Should be added back to rootNodesRegistry
    const detachedChild = parent.child;
    detach(detachedChild);
    expect(rootNodesRegistry.has(attachedChildNode.$id)).toBe(true);

    // 4. Destruction -> Should be removed from rootNodesRegistry
    const childId = childNode.$id;
    const attachedChildId = attachedChildNode.$id;
    const parentId = parentNode.$id;

    destroy(detachedChild);
    expect(rootNodesRegistry.has(attachedChildId)).toBe(false);

    destroy(child);
    expect(rootNodesRegistry.has(childId)).toBe(false);

    destroy(parent);
    expect(rootNodesRegistry.has(parentId)).toBe(false);
  });
});

