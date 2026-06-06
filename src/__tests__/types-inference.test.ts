import { describe, it, expect } from "vitest";
import { types } from "../index";
import type { Instance, SnapshotIn, SnapshotOut } from "../index";

describe("TypeScript Type Inference", () => {
  // Define models for testing
  const User = types.model("User", {
    id: types.identifier,
    name: types.string,
    age: types.optional(types.number, 30),
    email: types.maybe(types.string),
  });

  type UserIn = SnapshotIn<typeof User>;
  type UserOut = SnapshotOut<typeof User>;
  type UserInstance = Instance<typeof User>;

  it("should compile snapshot types correctly", () => {
    // These should compile successfully
    const validIn1: UserIn = {
      id: "1",
      name: "Alice",
    };

    const validIn2: UserIn = {
      id: "1",
      name: "Alice",
      age: 25,
      email: "alice@example.com",
    };

    expect(validIn1.id).toBe("1");
    expect(validIn2.age).toBe(25);

    // @ts-expect-error - id is required, should not be omittable
    const invalidIn1: UserIn = {
      name: "Alice",
    };

    // @ts-expect-error - name is required, should not be omittable
    const invalidIn2: UserIn = {
      id: "1",
    };

    // @ts-expect-error - invalid property type
    const invalidIn3: UserIn = {
      id: 123,
      name: "Alice",
    };

    // @ts-expect-error - age is required in SnapshotOut
    const invalidOut: UserOut = {
      id: "1",
      name: "Alice",
      email: undefined,
    };

    const validOut: UserOut = {
      id: "1",
      name: "Alice",
      age: 30,
      email: undefined,
    };

    expect(validOut.age).toBe(30);
  });

  it("should enforce strict types on create() method", () => {
    // These should compile successfully
    const u1 = User.create({ id: "1", name: "Alice" });
    const u2 = User.create({ id: "1", name: "Alice", age: 25 });

    expect(u1.name).toBe("Alice");
    expect(u2.age).toBe(25);

    // @ts-expect-error - missing required property 'name'
    expect(() => User.create({ id: "1" })).toThrow();

    // @ts-expect-error - missing required property 'id'
    expect(() => User.create({ name: "Alice" })).toThrow();

    // @ts-expect-error - age is invalid type
    expect(() => User.create({ id: "1", name: "Alice", age: "thirty" })).toThrow();
  });

  it("should isolate volatile state from snapshots", () => {
    const VolatileModel = types
      .model("VolatileModel", {
        id: types.identifier,
        name: types.string,
      })
      .volatile(() => ({
        tempToken: "secret",
      }));

    type VolatileOut = SnapshotOut<typeof VolatileModel>;
    type VolatileInstance = Instance<typeof VolatileModel>;

    const inst = VolatileModel.create({ id: "1", name: "Test" });
    const token: string = inst.tempToken;
    expect(token).toBe("secret");

    // @ts-expect-error - tempToken is volatile and should NOT exist in output snapshot
    const invalidSnapshot: VolatileOut = {
      id: "1",
      name: "Test",
      tempToken: "secret",
    };
  });

  it("should resolve recursive types recursively", () => {
    const Node = types.model("Node", {
      id: types.identifier,
      children: types.array(types.late(() => Node)),
    });

    type NodeInstance = Instance<typeof Node>;

    const node = Node.create({
      id: "1",
      children: [
        {
          id: "2",
          children: [
            {
              id: "3",
              children: [],
            },
          ],
        },
      ],
    });

    const firstChild: NodeInstance = node.children[0];
    const grandchild: NodeInstance = firstChild.children[0];
    expect(firstChild.id).toBe("2");
    expect(grandchild.id).toBe("3");
  });

  it("should compile consecutive views and actions without losing self type info", () => {
    const ChainedModel = types
      .model("ChainedModel", {
        x: types.number,
      })
      .views((self) => ({
        get doubleX() {
          return self.x * 2;
        },
      }))
      .views((self) => ({
        get quadrupleX() {
          return self.doubleX * 2; // doubleX must be correctly inferred on self
        },
      }))
      .actions((self) => ({
        setX(val: number) {
          self.x = val;
        },
      }))
      .actions((self) => ({
        reset() {
          self.setX(0); // setX must be correctly inferred on self
        },
      }));

    const inst = ChainedModel.create({ x: 5 });
    expect(inst.doubleX).toBe(10);
    expect(inst.quadrupleX).toBe(20);

    inst.reset();
    expect(inst.x).toBe(0);
  });

  it("should compile types.compose correctly and preserve self in chained views/actions", () => {
    const ModelA = types
      .model("ModelA", {
        aProp: types.string,
      })
      .views((self) => ({
        get doubleA() {
          return self.aProp + self.aProp;
        },
      }))
      .actions((self) => ({
        setA(val: string) {
          self.aProp = val;
        },
      }));

    const ModelB = types
      .model("ModelB", {
        bProp: types.number,
      })
      .views((self) => ({
        get doubleB() {
          return self.bProp * 2;
        },
      }))
      .actions((self) => ({
        setB(val: number) {
          self.bProp = val;
        },
      }));

    const ComposedModel = types.compose("ComposedModel", ModelA, ModelB)
      .views((self) => ({
        get combinedView() {
          // self must have access to both ModelA and ModelB props and views
          const a: string = self.doubleA;
          const b: number = self.doubleB;
          return `${a}-${b}`;
        },
      }))
      .actions((self) => ({
        setBoth(a: string, b: number) {
          // self must have access to both ModelA and ModelB actions
          self.setA(a);
          self.setB(b);
        },
      }));

    const inst = ComposedModel.create({
      aProp: "hello",
      bProp: 42,
    });

    expect(inst.combinedView).toBe("hellohello-84");
    inst.setBoth("world", 10);
    expect(inst.aProp).toBe("world");
    expect(inst.bProp).toBe(10);
    expect(inst.combinedView).toBe("worldworld-20");
  });

  it("should compile mixins correctly and preserve self in chained views/actions", () => {
    const Timestamped = types.mixin({
      requires: {
        createdAt: types.number,
      },
      views: (self) => ({
        get formattedDate() {
          return new Date(self.createdAt).toISOString();
        },
      }),
      actions: (self) => ({
        updateCreatedAt(val: number) {
          self.createdAt = val;
        },
      }),
    });

    const ItemModel = types
      .model("ItemModel", {
        name: types.string,
        createdAt: types.number,
      })
      .apply(Timestamped)
      .views((self) => ({
        get description() {
          // self must have access to model properties AND mixin views
          return `${self.name} created at ${self.formattedDate}`;
        },
      }))
      .actions((self) => ({
        resetCreationDate() {
          // self must have access to mixin actions
          self.updateCreatedAt(0);
        },
      }));

    const inst = ItemModel.create({
      name: "Widget",
      createdAt: 1000,
    });

    expect(inst.formattedDate).toBe(new Date(1000).toISOString());
    expect(inst.description).toBe(`Widget created at ${new Date(1000).toISOString()}`);
    inst.resetCreationDate();
    expect(inst.createdAt).toBe(0);
  });
});
