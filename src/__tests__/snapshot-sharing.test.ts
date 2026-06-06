import { describe, it, expect } from "vitest";
import { types, getSnapshot, applySnapshot } from "../index";

describe("Snapshot Structural Sharing", () => {
  it("should reuse snapshot references if nothing changes", () => {
    const Child = types.model("Child", {
      id: types.identifier,
      value: types.string,
    });

    const Root = types.model("Root", {
      child1: Child,
      child2: Child,
    });

    const root = Root.create({
      child1: { id: "1", value: "A" },
      child2: { id: "2", value: "B" },
    });

    const snap1 = getSnapshot<any>(root);
    const snap2 = getSnapshot<any>(root);

    // If no changes occurred, snapshot references should be identical
    expect(snap1).toBe(snap2);
    expect(snap1.child1).toBe(snap2.child1);
    expect(snap1.child2).toBe(snap2.child2);
  });

  it("should share unmodified branch references when a sub-branch changes", () => {
    const Child = types
      .model("Child", {
        id: types.identifier,
        value: types.string,
      })
      .actions((self) => ({
        setValue(val: string) {
          self.value = val;
        },
      }));

    const Root = types.model("Root", {
      child1: Child,
      child2: Child,
    });

    const root = Root.create({
      child1: { id: "1", value: "A" },
      child2: { id: "2", value: "B" },
    });

    const snap1 = getSnapshot<any>(root);

    // Modify child1
    root.child1.setValue("A-modified");

    const snap2 = getSnapshot<any>(root);

    // The root and child1 snapshots should be new objects
    expect(snap2).not.toBe(snap1);
    expect(snap2.child1).not.toBe(snap1.child1);
    expect(snap2.child1.value).toBe("A-modified");

    // The child2 snapshot should be exactly the same object reference!
    expect(snap2.child2).toBe(snap1.child2);
    expect(snap2.child2.value).toBe("B");
  });

  it("should perform structural sharing with arrays", () => {
    const Item = types
      .model("Item", {
        id: types.identifier,
        name: types.string,
      })
      .actions((self) => ({
        setName(name: string) {
          self.name = name;
        },
      }));

    const Root = types.model("Root", {
      items: types.array(Item),
    });

    const root = Root.create({
      items: [
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" },
      ],
    });

    const snap1 = getSnapshot<any>(root);

    // Modify Item 2
    root.items[1].setName("Item 2-modified");

    const snap2 = getSnapshot<any>(root);

    expect(snap2).not.toBe(snap1);
    expect(snap2.items).not.toBe(snap1.items);
    
    // Unmodified Item 1 snapshot should have identical reference
    expect(snap2.items[0]).toBe(snap1.items[0]);
    // Modified Item 2 snapshot should have a new reference
    expect(snap2.items[1]).not.toBe(snap1.items[1]);
  });

  it("should perform structural sharing with maps", () => {
    const Item = types
      .model("Item", {
        id: types.identifier,
        name: types.string,
      })
      .actions((self) => ({
        setName(name: string) {
          self.name = name;
        },
      }));

    const Root = types.model("Root", {
      items: types.map(Item),
    });

    const root = Root.create({
      items: {
        a: { id: "1", name: "Item A" },
        b: { id: "2", name: "Item B" },
      },
    });

    const snap1 = getSnapshot<any>(root);

    // Modify Item B
    root.items.get("b")!.setName("Item B-modified");

    const snap2 = getSnapshot<any>(root);

    expect(snap2).not.toBe(snap1);
    expect(snap2.items).not.toBe(snap1.items);

    // Unmodified Item A snapshot should have identical reference
    expect(snap2.items.a).toBe(snap1.items.a);
    // Modified Item B snapshot should have a new reference
    expect(snap2.items.b).not.toBe(snap1.items.b);
  });

  it("should handle applySnapshot and correctly update caching", () => {
    const Child = types.model("Child", {
      value: types.string,
    });

    const Root = types.model("Root", {
      child1: Child,
      child2: Child,
    });

    const root = Root.create({
      child1: { value: "A" },
      child2: { value: "B" },
    });

    const snap1 = getSnapshot<any>(root);

    // Apply snapshot updating only child1
    applySnapshot(root, {
      child1: { value: "A-updated" },
      child2: { value: "B" },
    });

    const snap2 = getSnapshot<any>(root);

    expect(snap2).not.toBe(snap1);
    expect(snap2.child1).not.toBe(snap1.child1);
    expect(snap2.child1.value).toBe("A-updated");

    // child2 was not modified, so it should keep the same reference
    expect(snap2.child2).toBe(snap1.child2);
  });
});
