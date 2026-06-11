import { describe, it, expect, vi } from "vitest";
import { types, onSnapshot, onPatch } from "../index";

describe("JST Views Performance and Caching", () => {
  it("should cache view results and only recompute when dependencies change", () => {
    let recomputeCount = 0;

    const TestModel = types
      .model("TestModel", {
        firstName: types.string,
        lastName: types.string,
        age: types.number,
      })
      .views((self) => ({
        get fullName() {
          recomputeCount++;
          return `${self.firstName} ${self.lastName}`;
        },
      }))
      .actions((self) => ({
        setFirstName(name: string) {
          self.firstName = name;
        },
        setAge(age: number) {
          self.age = age;
        },
      }));

    const instance = TestModel.create({
      firstName: "John",
      lastName: "Doe",
      age: 30,
    });

    // 1. Initial read should compute the value
    expect(instance.fullName).toBe("John Doe");
    expect(recomputeCount).toBe(1);

    // 2. Subsequent reads should be cached (not recomputed)
    expect(instance.fullName).toBe("John Doe");
    expect(instance.fullName).toBe("John Doe");
    expect(recomputeCount).toBe(1);

    // 3. Changing unrelated property (age) should NOT invalidate fullName cache
    instance.setAge(31);
    expect(instance.fullName).toBe("John Doe");
    expect(recomputeCount).toBe(1);

    // 4. Changing a dependency (firstName) should invalidate the cache and trigger recomputation on next read
    instance.setFirstName("Jane");
    expect(recomputeCount).toBe(1); // Lazy: should not recompute until read
    expect(instance.fullName).toBe("Jane Doe");
    expect(recomputeCount).toBe(2);

    // 5. Subsequent reads are cached again
    expect(instance.fullName).toBe("Jane Doe");
    expect(recomputeCount).toBe(2);
  });

  it("should support nested views and propagate invalidations correctly", () => {
    let viewACount = 0;
    let viewBCount = 0;

    const NestedViewModel = types
      .model("NestedViewModel", {
        a: types.number,
        b: types.number,
      })
      .views((self) => ({
        get viewA() {
          viewACount++;
          return self.a * 10;
        },
        get viewB() {
          viewBCount++;
          return self.viewA + self.b;
        },
      }))
      .actions((self) => ({
        setA(val: number) {
          self.a = val;
        },
        setB(val: number) {
          self.b = val;
        },
      }));

    const instance = NestedViewModel.create({ a: 2, b: 5 });

    // Initial read of outer view B
    expect(instance.viewB).toBe(25);
    expect(viewACount).toBe(1);
    expect(viewBCount).toBe(1);

    // Subsequent reads are cached
    expect(instance.viewB).toBe(25);
    expect(viewACount).toBe(1);
    expect(viewBCount).toBe(1);

    // Changing b should only recompute viewB, not viewA
    instance.setB(10);
    expect(instance.viewB).toBe(30);
    expect(viewACount).toBe(1); // viewA remained cached
    expect(viewBCount).toBe(2); // viewB recomputed

    // Changing a should invalidate both viewA and viewB
    instance.setA(3);
    expect(instance.viewB).toBe(40);
    expect(viewACount).toBe(2); // viewA recomputed
    expect(viewBCount).toBe(3); // viewB recomputed
  });

  it("should recompute views when dependent volatile state changes", () => {
    let recomputeCount = 0;

    const VolatileModel = types
      .model("VolatileModel", {
        name: types.string,
      })
      .volatile(() => ({
        greeting: "Hello",
      }))
      .views((self) => ({
        get message() {
          recomputeCount++;
          return `${self.greeting}, ${self.name}!`;
        },
      }))
      .actions((self) => ({
        setGreeting(greet: string) {
          self.greeting = greet;
        },
        setName(name: string) {
          self.name = name;
        },
      }));

    const instance = VolatileModel.create({ name: "World" });

    expect(instance.message).toBe("Hello, World!");
    expect(recomputeCount).toBe(1);

    // Cache works
    expect(instance.message).toBe("Hello, World!");
    expect(recomputeCount).toBe(1);

    // Change volatile state
    instance.setGreeting("Hi");
    expect(instance.message).toBe("Hi, World!");
    expect(recomputeCount).toBe(2);
  });

  it("should recompute views when child nodes are replaced", () => {
    let parentRecomputeCount = 0;

    const ChildModel = types.model("ChildModel", {
      name: types.string,
    });

    const ParentModel = types
      .model("ParentModel", {
        child: ChildModel,
        unrelatedChild: ChildModel,
      })
      .views((self) => ({
        get childName() {
          parentRecomputeCount++;
          return self.child.name;
        },
      }))
      .actions((self) => ({
        setChild(newChild: typeof ChildModel._T) {
          self.child = newChild;
        },
        setUnrelatedChild(newChild: typeof ChildModel._T) {
          self.unrelatedChild = newChild;
        },
      }));

    const instance = ParentModel.create({
      child: { name: "Alice" },
      unrelatedChild: { name: "Bob" },
    });

    expect(instance.childName).toBe("Alice");
    expect(parentRecomputeCount).toBe(1);

    // Change unrelated child node: parent view should NOT recompute
    instance.setUnrelatedChild(ChildModel.create({ name: "Charlie" }));
    expect(instance.childName).toBe("Alice");
    expect(parentRecomputeCount).toBe(1);

    // Replace child node: parent view should recompute
    instance.setChild(ChildModel.create({ name: "Dave" }));
    expect(instance.childName).toBe("Dave");
    expect(parentRecomputeCount).toBe(2);
  });

  it("should batch multiple updates inside an action, triggering snapshot/patch listeners once", () => {
    const BatchModel = types
      .model("BatchModel", {
        a: types.number,
        b: types.number,
        c: types.number,
      })
      .actions((self) => ({
        updateAll(a: number, b: number, c: number) {
          self.a = a;
          self.b = b;
          self.c = c;
        },
      }));

    const instance = BatchModel.create({ a: 1, b: 2, c: 3 });

    const snapshotCalls: any[] = [];
    const patchCalls: any[] = [];

    onSnapshot(instance, (snap) => {
      snapshotCalls.push(snap);
    });

    onPatch(instance, (patch) => {
      patchCalls.push(patch);
    });

    // Run action that modifies three properties
    instance.updateAll(10, 20, 30);

    // Verify snapshots were batched: only 1 snapshot call at the end of the action
    expect(snapshotCalls.length).toBe(1);
    expect(snapshotCalls[0]).toEqual({ a: 10, b: 20, c: 30 });

    // Verify patches: because individual properties were set, we still get all patches
    // but they are emitted in a single batch.
    expect(patchCalls.length).toBe(3);
    expect(patchCalls[0].path).toBe("/a");
    expect(patchCalls[1].path).toBe("/b");
    expect(patchCalls[2].path).toBe("/c");
  });
});
