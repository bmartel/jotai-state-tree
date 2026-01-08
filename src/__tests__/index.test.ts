/**
 * Tests for jotai-state-tree
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  types,
  getSnapshot,
  applySnapshot,
  onSnapshot,
  onPatch,
  getRoot,
  getParent,
  getEnv,
  isAlive,
  destroy,
  flow,
  clone,
  getPath,
  getPathParts,
  detach,
  walk,
  isStateTreeNode,
  getIdentifier,
  addMiddleware,
  recordActions,
  protect,
  unprotect,
  isProtected,
  applyPatch,
  cast,
  // Advanced tree utilities
  getRelativePath,
  isAncestor,
  findAll,
  getTreeStats,
  cloneDeep,
  // Undo/Time travel
  createUndoManager,
  createTimeTravelManager,
} from "../index";

describe("Primitive Types", () => {
  it("should create string type", () => {
    const StringModel = types.model("StringModel", {
      value: types.string,
    });

    const instance = StringModel.create({ value: "hello" });
    expect(instance.value).toBe("hello");
  });

  it("should create number type", () => {
    const NumberModel = types.model("NumberModel", {
      value: types.number,
    });

    const instance = NumberModel.create({ value: 42 });
    expect(instance.value).toBe(42);
  });

  it("should create boolean type", () => {
    const BoolModel = types.model("BoolModel", {
      value: types.boolean,
    });

    const instance = BoolModel.create({ value: true });
    expect(instance.value).toBe(true);
  });

  it("should create integer type", () => {
    const IntModel = types.model("IntModel", {
      value: types.integer,
    });

    const instance = IntModel.create({ value: 42 });
    expect(instance.value).toBe(42);
  });

  it("should create literal type", () => {
    const LiteralModel = types.model("LiteralModel", {
      status: types.literal("active"),
    });

    const instance = LiteralModel.create({ status: "active" });
    expect(instance.status).toBe("active");
  });

  it("should create enumeration type", () => {
    const Priority = types.enumeration("Priority", ["low", "medium", "high"]);
    const EnumModel = types.model("EnumModel", {
      priority: Priority,
    });

    const instance = EnumModel.create({ priority: "high" });
    expect(instance.priority).toBe("high");
  });
});

describe("Optional Types", () => {
  it("should use default value when not provided", () => {
    const Model = types.model("Model", {
      name: types.optional(types.string, "default"),
    });

    const instance = Model.create({});
    expect(instance.name).toBe("default");
  });

  it("should use provided value over default", () => {
    const Model = types.model("Model", {
      name: types.optional(types.string, "default"),
    });

    const instance = Model.create({ name: "custom" });
    expect(instance.name).toBe("custom");
  });

  it("should handle maybe type", () => {
    const Model = types.model("Model", {
      name: types.maybe(types.string),
    });

    const instance = Model.create({});
    expect(instance.name).toBeUndefined();

    const instance2 = Model.create({ name: "hello" });
    expect(instance2.name).toBe("hello");
  });

  it("should handle maybeNull type", () => {
    const Model = types.model("Model", {
      name: types.maybeNull(types.string),
    });

    const instance = Model.create({});
    expect(instance.name).toBeNull();

    const instance2 = Model.create({ name: "hello" });
    expect(instance2.name).toBe("hello");
  });
});

describe("Model Type", () => {
  it("should create a simple model", () => {
    const User = types.model("User", {
      name: types.string,
      age: types.number,
    });

    const user = User.create({ name: "John", age: 30 });
    expect(user.name).toBe("John");
    expect(user.age).toBe(30);
  });

  it("should support views", () => {
    const User = types
      .model("User", {
        firstName: types.string,
        lastName: types.string,
      })
      .views((self) => ({
        get fullName() {
          return `${self.firstName} ${self.lastName}`;
        },
      }));

    const user = User.create({ firstName: "John", lastName: "Doe" });
    expect(user.fullName).toBe("John Doe");
  });

  it("should support actions", () => {
    const Counter = types
      .model("Counter", {
        count: types.optional(types.number, 0),
      })
      .actions((self) => ({
        increment() {
          self.count++;
        },
        decrement() {
          self.count--;
        },
        setCount(value: number) {
          self.count = value;
        },
      }));

    const counter = Counter.create({});
    expect(counter.count).toBe(0);

    counter.increment();
    expect(counter.count).toBe(1);

    counter.increment();
    expect(counter.count).toBe(2);

    counter.decrement();
    expect(counter.count).toBe(1);

    counter.setCount(10);
    expect(counter.count).toBe(10);
  });

  it("should support volatile state", () => {
    const Form = types
      .model("Form", {
        data: types.frozen<Record<string, string>>(),
      })
      .volatile(() => ({
        isSubmitting: false,
        errors: [] as string[],
      }))
      .actions((self) => ({
        setSubmitting(value: boolean) {
          self.isSubmitting = value;
        },
        addError(error: string) {
          self.errors.push(error);
        },
      }));

    const form = Form.create({ data: {} });
    expect(form.isSubmitting).toBe(false);

    form.setSubmitting(true);
    expect(form.isSubmitting).toBe(true);

    // Volatile state should not be in snapshot
    const snapshot = getSnapshot(form);
    expect("isSubmitting" in snapshot).toBe(false);
  });

  it("should support nested models", () => {
    const Address = types.model("Address", {
      street: types.string,
      city: types.string,
    });

    const Person = types.model("Person", {
      name: types.string,
      address: Address,
    });

    const person = Person.create({
      name: "John",
      address: { street: "123 Main St", city: "Boston" },
    });

    expect(person.name).toBe("John");
    expect(person.address.street).toBe("123 Main St");
    expect(person.address.city).toBe("Boston");
  });
});

describe("Array Type", () => {
  it("should create array of primitives", () => {
    const Model = types.model("Model", {
      items: types.array(types.string),
    });

    const instance = Model.create({ items: ["a", "b", "c"] });
    expect(instance.items.length).toBe(3);
    expect(instance.items[0]).toBe("a");
  });

  it("should create array of models", () => {
    const Item = types.model("Item", {
      id: types.identifier,
      name: types.string,
    });

    const Store = types.model("Store", {
      items: types.array(Item),
    });

    const store = Store.create({
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    });

    expect(store.items.length).toBe(2);
    expect(store.items[0].name).toBe("First");
  });

  it("should support array mutations", () => {
    const Model = types
      .model("Model", {
        items: types.array(types.string),
      })
      .actions((self) => ({
        addItem(item: string) {
          self.items.push(item);
        },
        removeItem(index: number) {
          self.items.splice(index, 1);
        },
      }));

    const instance = Model.create({ items: ["a", "b"] });

    instance.addItem("c");
    expect(instance.items.length).toBe(3);

    instance.removeItem(1);
    expect(instance.items.length).toBe(2);
    expect(instance.items[1]).toBe("c");
  });
});

describe("Map Type", () => {
  it("should create map of primitives", () => {
    const Model = types.model("Model", {
      scores: types.map(types.number),
    });

    const instance = Model.create({
      scores: { alice: 100, bob: 90 },
    });

    expect(instance.scores.get("alice")).toBe(100);
    expect(instance.scores.get("bob")).toBe(90);
  });

  it("should support map mutations", () => {
    const Model = types
      .model("Model", {
        scores: types.map(types.number),
      })
      .actions((self) => ({
        setScore(name: string, score: number) {
          self.scores.set(name, score);
        },
      }));

    const instance = Model.create({ scores: {} });

    instance.setScore("charlie", 85);
    expect(instance.scores.get("charlie")).toBe(85);
  });
});

describe("Snapshots", () => {
  it("should get snapshot", () => {
    const Todo = types.model("Todo", {
      id: types.identifier,
      title: types.string,
      done: types.optional(types.boolean, false),
    });

    const todo = Todo.create({ id: "1", title: "Test" });
    const snapshot = getSnapshot(todo);

    expect(snapshot).toEqual({
      id: "1",
      title: "Test",
      done: false,
    });
  });

  it("should apply snapshot", () => {
    const Counter = types
      .model("Counter", {
        count: types.optional(types.number, 0),
      })
      .actions((self) => ({
        setCount(value: number) {
          self.count = value;
        },
      }));

    const counter = Counter.create({ count: 5 });
    expect(counter.count).toBe(5);

    applySnapshot(counter, { count: 10 });
    expect(counter.count).toBe(10);
  });

  it("should listen to snapshot changes", () => {
    const Counter = types
      .model("Counter", {
        count: types.optional(types.number, 0),
      })
      .actions((self) => ({
        increment() {
          self.count++;
        },
      }));

    const counter = Counter.create({});
    const snapshots: unknown[] = [];

    const disposer = onSnapshot(counter, (snapshot) => {
      snapshots.push(snapshot);
    });

    counter.increment();
    counter.increment();

    expect(snapshots.length).toBeGreaterThan(0);

    disposer();
  });
});

describe("Tree Navigation", () => {
  it("should get root", () => {
    const Child = types.model("Child", {
      name: types.string,
    });

    const Parent = types.model("Parent", {
      child: Child,
    });

    const parent = Parent.create({
      child: { name: "child" },
    });

    const root = getRoot(parent.child);
    expect(root).toBe(parent);
  });

  it("should get parent", () => {
    const Child = types.model("Child", {
      name: types.string,
    });

    const Parent = types.model("Parent", {
      child: Child,
    });

    const parent = Parent.create({
      child: { name: "child" },
    });

    const retrievedParent = getParent(parent.child);
    expect(retrievedParent).toBe(parent);
  });

  it("should pass environment", () => {
    const Model = types
      .model("Model", {
        name: types.string,
      })
      .actions((self) => ({
        getApiUrl() {
          const env = getEnv<{ apiUrl: string }>(self);
          return env.apiUrl;
        },
      }));

    const instance = Model.create(
      { name: "test" },
      { apiUrl: "http://localhost" },
    );
    expect(instance.getApiUrl()).toBe("http://localhost");
  });
});

describe("Lifecycle", () => {
  it("should track alive status", () => {
    const Model = types.model("Model", {
      name: types.string,
    });

    const instance = Model.create({ name: "test" });
    expect(isAlive(instance)).toBe(true);

    destroy(instance);
    expect(isAlive(instance)).toBe(false);
  });

  it("should clone instances", () => {
    const Model = types.model("Model", {
      name: types.string,
      count: types.number,
    });

    const original = Model.create({ name: "test", count: 42 });
    const cloned = clone(original);

    expect(cloned.name).toBe("test");
    expect(cloned.count).toBe(42);
    expect(cloned).not.toBe(original);
  });
});

describe("Async Actions (flow)", () => {
  it("should handle async actions", async () => {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const Model = types
      .model("Model", {
        data: types.maybeNull(types.string),
        loading: types.optional(types.boolean, false),
      })
      .actions((self) => ({
        setData(data: string | null) {
          self.data = data;
        },
        setLoading(loading: boolean) {
          self.loading = loading;
        },
      }))
      .actions((self) => ({
        fetchData: flow(function* () {
          self.setLoading(true);
          yield delay(10);
          self.setData("fetched data");
          self.setLoading(false);
        }),
      }));

    const instance = Model.create({});
    expect(instance.loading).toBe(false);
    expect(instance.data).toBeNull();

    await instance.fetchData();

    expect(instance.loading).toBe(false);
    expect(instance.data).toBe("fetched data");
  });
});

describe("Union Types", () => {
  it("should handle union of literals", () => {
    const Status = types.union(
      types.literal("pending"),
      types.literal("active"),
      types.literal("done"),
    );

    const Task = types.model("Task", {
      status: Status,
    });

    const task = Task.create({ status: "pending" });
    expect(task.status).toBe("pending");
  });

  it("should handle union of models", () => {
    const Circle = types.model("Circle", {
      type: types.literal("circle"),
      radius: types.number,
    });

    const Square = types.model("Square", {
      type: types.literal("square"),
      side: types.number,
    });

    const Shape = types.union(Circle, Square);

    const ShapeContainer = types.model("ShapeContainer", {
      shape: Shape,
    });

    const circleContainer = ShapeContainer.create({
      shape: { type: "circle", radius: 10 },
    });

    expect(circleContainer.shape.type).toBe("circle");
    expect((circleContainer.shape as any).radius).toBe(10);
  });
});

describe("References", () => {
  it("should resolve references", () => {
    const Author = types.model("Author", {
      id: types.identifier,
      name: types.string,
    });

    const Book = types.model("Book", {
      id: types.identifier,
      title: types.string,
      authorId: types.string, // Store as string for now
    });

    const Store = types
      .model("Store", {
        authors: types.array(Author),
        books: types.array(Book),
      })
      .views((self) => ({
        getAuthorById(id: string) {
          return self.authors.find((a) => a.id === id);
        },
      }));

    const store = Store.create({
      authors: [{ id: "a1", name: "John Doe" }],
      books: [{ id: "b1", title: "Great Book", authorId: "a1" }],
    });

    const book = store.books[0];
    const author = store.getAuthorById(book.authorId);

    expect(author?.name).toBe("John Doe");
  });
});

describe("Late Types (Recursive)", () => {
  it("should handle recursive types", () => {
    const TreeNode = types.model("TreeNode", {
      id: types.identifier,
      value: types.string,
      children: types.optional(types.array(types.late(() => TreeNode)), []),
    });

    const tree = TreeNode.create({
      id: "1",
      value: "root",
      children: [
        {
          id: "2",
          value: "child1",
          children: [],
        },
        {
          id: "3",
          value: "child2",
          children: [
            {
              id: "4",
              value: "grandchild",
              children: [],
            },
          ],
        },
      ],
    });

    expect(tree.value).toBe("root");
    expect(tree.children.length).toBe(2);
    expect(tree.children[1].children[0].value).toBe("grandchild");
  });
});

describe("Frozen Type", () => {
  it("should handle frozen objects", () => {
    const Model = types.model("Model", {
      config: types.frozen<{ setting1: boolean; setting2: string }>(),
    });

    const instance = Model.create({
      config: { setting1: true, setting2: "value" },
    });

    expect(instance.config.setting1).toBe(true);
    expect(instance.config.setting2).toBe("value");

    // Frozen objects should be immutable
    expect(() => {
      (instance.config as any).setting1 = false;
    }).toThrow();
  });
});

describe("Patches", () => {
  it("should listen to patches", () => {
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
    const patches: unknown[] = [];

    const disposer = onPatch(instance, (patch) => {
      patches.push(patch);
    });

    instance.setValue(10);

    expect(patches.length).toBeGreaterThan(0);

    disposer();
  });

  it("should apply patches", () => {
    const Model = types.model("Model", {
      value: types.number,
      name: types.string,
    });

    const instance = Model.create({ value: 0, name: "test" });

    applyPatch(instance, { op: "replace", path: "/value", value: 42 });
    expect(instance.value).toBe(42);
  });
});

describe("Lifecycle Hooks", () => {
  it("should call afterCreate hook", () => {
    const afterCreateSpy = vi.fn();

    const Model = types
      .model("Model", {
        name: types.string,
      })
      .afterCreate(afterCreateSpy);

    const instance = Model.create({ name: "test" });

    expect(afterCreateSpy).toHaveBeenCalledTimes(1);
    expect(afterCreateSpy).toHaveBeenCalledWith(instance);
  });

  it("should support chaining lifecycle hooks", () => {
    const afterCreateSpy = vi.fn();

    const Model = types
      .model("Model", {
        name: types.string,
        count: types.optional(types.number, 0),
      })
      .views((self) => ({
        get upperName() {
          return self.name.toUpperCase();
        },
      }))
      .actions((self) => ({
        increment() {
          self.count++;
        },
      }))
      .afterCreate((self) => {
        afterCreateSpy(self.name);
        self.increment();
      });

    const instance = Model.create({ name: "test" });

    expect(afterCreateSpy).toHaveBeenCalledWith("test");
    expect(instance.count).toBe(1);
    expect(instance.upperName).toBe("TEST");
  });
});

describe("Tree Utilities", () => {
  it("should get path", () => {
    const Child = types.model("Child", {
      name: types.string,
    });

    const Parent = types.model("Parent", {
      child: Child,
    });

    const parent = Parent.create({
      child: { name: "child" },
    });

    const path = getPath(parent.child);
    expect(path).toBe("/child");
  });

  it("should get path parts", () => {
    const GrandChild = types.model("GrandChild", {
      value: types.number,
    });

    const Child = types.model("Child", {
      grandChild: GrandChild,
    });

    const Parent = types.model("Parent", {
      child: Child,
    });

    const parent = Parent.create({
      child: { grandChild: { value: 42 } },
    });

    const parts = getPathParts(parent.child.grandChild);
    expect(parts).toEqual(["child", "grandChild"]);
  });

  it("should check if value is state tree node", () => {
    const Model = types.model("Model", {
      name: types.string,
    });

    const instance = Model.create({ name: "test" });

    expect(isStateTreeNode(instance)).toBe(true);
    expect(isStateTreeNode({ name: "test" })).toBe(false);
    expect(isStateTreeNode(null)).toBe(false);
    expect(isStateTreeNode(42)).toBe(false);
  });

  it("should get identifier", () => {
    const Model = types.model("Model", {
      id: types.identifier,
      name: types.string,
    });

    const instance = Model.create({ id: "unique-id", name: "test" });

    expect(getIdentifier(instance)).toBe("unique-id");
  });

  it("should walk tree", () => {
    const Item = types.model("Item", {
      id: types.identifier,
      name: types.string,
    });

    const Container = types.model("Container", {
      items: types.array(Item),
    });

    const container = Container.create({
      items: [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ],
    });

    const visited: string[] = [];
    walk(container, (node) => {
      if (isStateTreeNode(node)) {
        const snapshot = getSnapshot(node);
        if (
          typeof snapshot === "object" &&
          snapshot !== null &&
          "name" in snapshot
        ) {
          visited.push((snapshot as { name: string }).name);
        }
      }
    });

    expect(visited).toContain("First");
    expect(visited).toContain("Second");
  });

  it("should detach node", () => {
    const Child = types.model("Child", {
      name: types.string,
    });

    const Parent = types
      .model("Parent", {
        child: types.maybe(Child),
      })
      .actions((self) => ({
        removeChild() {
          if (self.child) {
            detach(self.child);
          }
        },
      }));

    const parent = Parent.create({
      child: { name: "test" },
    });

    const child = parent.child!;
    detach(child);

    expect(isAlive(child)).toBe(true);
  });
});

describe("Cast Utility", () => {
  it("should cast values", () => {
    const value: unknown = { name: "test", count: 42 };
    const typed = cast<{ name: string; count: number }>(value);

    expect(typed.name).toBe("test");
    expect(typed.count).toBe(42);
  });
});

describe("Refinement Type", () => {
  it("should validate refined types", () => {
    const PositiveNumber = types.refinement(
      types.number,
      (value) => value > 0,
      "Value must be positive",
    );

    const Model = types.model("Model", {
      value: PositiveNumber,
    });

    const instance = Model.create({ value: 10 });
    expect(instance.value).toBe(10);

    expect(() => Model.create({ value: -5 })).toThrow("Value must be positive");
  });
});

describe("Pre/Post Process Snapshot", () => {
  it("should preprocess snapshot", () => {
    const Model = types
      .model("Model", {
        name: types.string,
        createdAt: types.number,
      })
      .preProcessSnapshot((snapshot: { name: string }) => ({
        ...snapshot,
        createdAt: Date.now(),
      }));

    const instance = Model.create({ name: "test" });
    expect(instance.name).toBe("test");
    expect(instance.createdAt).toBeGreaterThan(0);
  });
});

describe("Enumeration", () => {
  it("should create enumeration with name", () => {
    const Status = types.enumeration("Status", ["pending", "active", "done"]);

    const Task = types.model("Task", {
      status: Status,
    });

    const task = Task.create({ status: "active" });
    expect(task.status).toBe("active");
  });

  it("should create enumeration without name", () => {
    const Priority = types.enumeration(["low", "medium", "high"]);

    const Task = types.model("Task", {
      priority: Priority,
    });

    const task = Task.create({ priority: "high" });
    expect(task.priority).toBe("high");
  });

  it("should reject invalid enum values", () => {
    const Status = types.enumeration("Status", ["pending", "active", "done"]);

    const Task = types.model("Task", {
      status: Status,
    });

    expect(() => Task.create({ status: "invalid" as any })).toThrow();
  });
});

describe("Complex Nested Structures", () => {
  it("should handle deeply nested models", () => {
    const Address = types.model("Address", {
      street: types.string,
      city: types.string,
      zip: types.string,
    });

    const Contact = types.model("Contact", {
      email: types.string,
      phone: types.optional(types.string, ""),
      address: Address,
    });

    const User = types.model("User", {
      id: types.identifier,
      name: types.string,
      contact: Contact,
    });

    const user = User.create({
      id: "1",
      name: "John Doe",
      contact: {
        email: "john@example.com",
        address: {
          street: "123 Main St",
          city: "Boston",
          zip: "02101",
        },
      },
    });

    expect(user.id).toBe("1");
    expect(user.name).toBe("John Doe");
    expect(user.contact.email).toBe("john@example.com");
    expect(user.contact.address.city).toBe("Boston");

    const snapshot = getSnapshot(user);
    expect(snapshot).toMatchObject({
      id: "1",
      name: "John Doe",
      contact: {
        email: "john@example.com",
        address: {
          city: "Boston",
        },
      },
    });
  });

  it("should handle arrays of nested models", () => {
    const OrderItem = types.model("OrderItem", {
      id: types.identifier,
      productName: types.string,
      quantity: types.number,
      price: types.number,
    });

    const Order = types
      .model("Order", {
        id: types.identifier,
        items: types.array(OrderItem),
      })
      .views((self) => ({
        get total() {
          return self.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
          );
        },
        get itemCount() {
          return self.items.length;
        },
      }))
      .actions((self) => ({
        addItem(item: {
          id: string;
          productName: string;
          quantity: number;
          price: number;
        }) {
          self.items.push(item);
        },
      }));

    const order = Order.create({
      id: "order-1",
      items: [
        { id: "item-1", productName: "Widget", quantity: 2, price: 10 },
        { id: "item-2", productName: "Gadget", quantity: 1, price: 25 },
      ],
    });

    expect(order.total).toBe(45);
    expect(order.itemCount).toBe(2);

    order.addItem({
      id: "item-3",
      productName: "Doohickey",
      quantity: 3,
      price: 5,
    });

    expect(order.total).toBe(60);
    expect(order.itemCount).toBe(3);
  });
});

describe("Map with Model Values", () => {
  it("should handle map of models", () => {
    const User = types.model("User", {
      id: types.identifier,
      name: types.string,
    });

    const UserStore = types
      .model("UserStore", {
        users: types.map(User),
      })
      .actions((self) => ({
        addUser(id: string, name: string) {
          self.users.set(id, { id, name } as any);
        },
      }));

    const store = UserStore.create({
      users: {
        "user-1": { id: "user-1", name: "Alice" },
      },
    });

    expect(store.users.get("user-1")?.name).toBe("Alice");

    store.addUser("user-2", "Bob");
    expect(store.users.get("user-2")?.name).toBe("Bob");
  });
});

describe("Compose Models", () => {
  it("should compose multiple models", () => {
    const Identifiable = types.model("Identifiable", {
      id: types.identifier,
    });

    const Named = types.model("Named", {
      name: types.string,
    });

    const Timestamped = types.model("Timestamped", {
      createdAt: types.number,
    });

    const Entity = types.compose("Entity", Identifiable, Named);

    const entity = Entity.create({ id: "e-1", name: "Test Entity" });

    expect(entity.id).toBe("e-1");
    expect(entity.name).toBe("Test Entity");
  });
});

describe("Extend Method", () => {
  it("should extend model with views, actions, and volatile state", () => {
    const Counter = types
      .model("Counter", {
        count: types.optional(types.number, 0),
      })
      .extend((self) => {
        let lastModified = Date.now();

        return {
          views: {
            get doubled() {
              return self.count * 2;
            },
          },
          actions: {
            increment() {
              self.count++;
              lastModified = Date.now();
            },
          },
          state: {
            get lastModified() {
              return lastModified;
            },
          },
        };
      });

    const counter = Counter.create({});

    expect(counter.count).toBe(0);
    expect(counter.doubled).toBe(0);

    counter.increment();

    expect(counter.count).toBe(1);
    expect(counter.doubled).toBe(2);
  });
});

describe("Advanced Tree Utilities", () => {
  it("should get relative path between nodes", () => {
    const GrandChild = types.model("GrandChild", {
      name: types.string,
    });

    const Child = types.model("Child", {
      grandChild: GrandChild,
    });

    const Parent = types.model("Parent", {
      childA: Child,
      childB: Child,
    });

    const parent = Parent.create({
      childA: { grandChild: { name: "A" } },
      childB: { grandChild: { name: "B" } },
    });

    const fromNode = parent.childA.grandChild;
    const toNode = parent.childB.grandChild;

    const relativePath = getRelativePath(fromNode, toNode);
    expect(relativePath).toBe("../../childB/grandChild");
  });

  it("should check if node is ancestor", () => {
    const Child = types.model("Child", {
      name: types.string,
    });

    const Parent = types.model("Parent", {
      child: Child,
    });

    const parent = Parent.create({
      child: { name: "test" },
    });

    expect(isAncestor(parent, parent.child)).toBe(true);
    expect(isAncestor(parent.child, parent)).toBe(false);
  });

  it("should find all nodes matching predicate", () => {
    const Item = types.model("Item", {
      value: types.number,
    });

    const Container = types.model("Container", {
      items: types.array(Item),
    });

    const container = Container.create({
      items: [{ value: 1 }, { value: 2 }, { value: 3 }],
    });

    const allNodes = findAll(container, (node: unknown): node is unknown => {
      if (!isStateTreeNode(node)) return false;
      const snapshot = getSnapshot(node);
      return (
        typeof snapshot === "object" && snapshot !== null && "value" in snapshot
      );
    });

    expect(allNodes.length).toBe(3);
  });

  it("should get tree stats", () => {
    const Item = types.model("Item", {
      name: types.string,
    });

    const Container = types.model("Container", {
      items: types.array(Item),
    });

    const container = Container.create({
      items: [{ name: "a" }, { name: "b" }],
    });

    const stats = getTreeStats(container);

    expect(stats.nodeCount).toBeGreaterThan(0);
    expect(stats.depth).toBeGreaterThan(0);
    expect(stats.types).toHaveProperty("Container");
  });

  it("should clone deep", () => {
    const Model = types.model("Model", {
      name: types.string,
      count: types.number,
    });

    const original = Model.create({ name: "test", count: 5 });
    const cloned = cloneDeep(original);

    expect(cloned.name).toBe("test");
    expect(cloned.count).toBe(5);
    expect(cloned).not.toBe(original);
  });
});

describe("Undo Manager", () => {
  it("should track history entries", () => {
    const Counter = types
      .model("Counter", {
        count: types.optional(types.number, 0),
      })
      .actions((self) => ({
        increment() {
          self.count++;
        },
      }));

    const counter = Counter.create({});
    const undoManager = createUndoManager(counter);

    expect(counter.count).toBe(0);
    expect(undoManager.canUndo).toBe(false);
    expect(undoManager.undoLevels).toBe(0);

    counter.increment();
    expect(counter.count).toBe(1);
    expect(undoManager.canUndo).toBe(true);
    expect(undoManager.undoLevels).toBe(1);

    counter.increment();
    expect(counter.count).toBe(2);
    expect(undoManager.undoLevels).toBe(2);

    undoManager.dispose();
  });

  it("should group changes", () => {
    const Counter = types
      .model("Counter", {
        count: types.optional(types.number, 0),
      })
      .actions((self) => ({
        increment() {
          self.count++;
        },
      }));

    const counter = Counter.create({});
    const undoManager = createUndoManager(counter);

    undoManager.startGroup();
    counter.increment();
    counter.increment();
    counter.increment();
    undoManager.endGroup();

    expect(counter.count).toBe(3);
    expect(undoManager.undoLevels).toBe(1);

    undoManager.dispose();
  });

  it("should clear history", () => {
    const Counter = types
      .model("Counter", {
        count: types.optional(types.number, 0),
      })
      .actions((self) => ({
        increment() {
          self.count++;
        },
      }));

    const counter = Counter.create({});
    const undoManager = createUndoManager(counter);

    counter.increment();
    counter.increment();
    expect(undoManager.undoLevels).toBe(2);

    undoManager.clear();
    expect(undoManager.undoLevels).toBe(0);
    expect(undoManager.canUndo).toBe(false);

    undoManager.dispose();
  });
});

describe("Time Travel Manager", () => {
  it("should record and navigate snapshots", () => {
    const Counter = types
      .model("Counter", {
        count: types.optional(types.number, 0),
      })
      .actions((self) => ({
        setCount(n: number) {
          self.count = n;
        },
      }));

    const counter = Counter.create({});
    const timeTravel = createTimeTravelManager(counter);

    counter.setCount(1);
    timeTravel.record();

    counter.setCount(2);
    timeTravel.record();

    counter.setCount(3);
    timeTravel.record();

    expect(counter.count).toBe(3);
    expect(timeTravel.snapshotCount).toBe(4); // Initial + 3 records

    timeTravel.goBack();
    expect(counter.count).toBe(2);

    timeTravel.goBack();
    expect(counter.count).toBe(1);

    timeTravel.goForward();
    expect(counter.count).toBe(2);

    timeTravel.goTo(0);
    expect(counter.count).toBe(0);

    timeTravel.dispose();
  });
});

describe("Mixin Types", () => {
  describe("types.mixin()", () => {
    it("should create a mixin with views", () => {
      const Doubler = types.mixin({
        requires: {
          value: types.number,
        },
        views: (self) => ({
          get doubled() {
            return self.value * 2;
          },
        }),
      });

      const Counter = types
        .model("Counter", {
          value: types.number,
        })
        .apply(Doubler);

      const counter = Counter.create({ value: 5 });

      expect(counter.value).toBe(5);
      expect(counter.doubled).toBe(10);
    });

    it("should create a mixin with actions", () => {
      const Incrementable = types.mixin({
        requires: {
          count: types.number,
        },
        actions: (self) => ({
          increment() {
            self.count++;
          },
          decrement() {
            self.count--;
          },
        }),
      });

      const Counter = types
        .model("Counter", {
          count: types.optional(types.number, 0),
        })
        .apply(Incrementable);

      const counter = Counter.create({});

      expect(counter.count).toBe(0);
      counter.increment();
      expect(counter.count).toBe(1);
      counter.increment();
      expect(counter.count).toBe(2);
      counter.decrement();
      expect(counter.count).toBe(1);
    });

    it("should create a mixin with volatile state", () => {
      const Loadable = types.mixin({
        requires: {},
        volatile: () => ({
          isLoading: false,
          error: null as string | null,
        }),
      });

      const DataModel = types
        .model("DataModel", {
          data: types.optional(types.string, ""),
        })
        .apply(Loadable);

      const model = DataModel.create({});

      expect(model.isLoading).toBe(false);
      expect(model.error).toBe(null);
    });

    it("should create a mixin with views, actions, and volatile", () => {
      const Validatable = types.mixin({
        requires: {
          errors: types.array(types.string),
        },
        views: (self) => ({
          get isValid() {
            return self.errors.length === 0;
          },
          get hasErrors() {
            return self.errors.length > 0;
          },
          get errorCount() {
            return self.errors.length;
          },
        }),
        actions: (self) => ({
          addError(msg: string) {
            self.errors.push(msg);
          },
          clearErrors() {
            self.errors.clear();
          },
        }),
        volatile: () => ({
          lastValidatedAt: null as number | null,
        }),
      });

      const Form = types
        .model("Form", {
          name: types.string,
          errors: types.array(types.string),
        })
        .apply(Validatable);

      const form = Form.create({ name: "Test", errors: [] });

      expect(form.isValid).toBe(true);
      expect(form.hasErrors).toBe(false);
      expect(form.errorCount).toBe(0);

      form.addError("Name is required");
      expect(form.isValid).toBe(false);
      expect(form.hasErrors).toBe(true);
      expect(form.errorCount).toBe(1);

      form.addError("Name must be at least 3 characters");
      expect(form.errorCount).toBe(2);

      form.clearErrors();
      expect(form.isValid).toBe(true);
      expect(form.errorCount).toBe(0);
    });

    it("should allow actions to access views from the same mixin", () => {
      const Counter = types.mixin({
        requires: {
          count: types.number,
        },
        views: (self) => ({
          get doubled() {
            return self.count * 2;
          },
        }),
        actions: (self) => ({
          logDoubled() {
            // Actions receive self with views already added
            return self.doubled;
          },
        }),
      });

      const Model = types
        .model("Model", {
          count: types.optional(types.number, 5),
        })
        .apply(Counter);

      const model = Model.create({});

      expect(model.logDoubled()).toBe(10);
    });

    it("should work with empty requires", () => {
      const Logger = types.mixin({
        volatile: () => ({
          logs: [] as string[],
        }),
        actions: (self) => ({
          log(msg: string) {
            self.logs.push(msg);
          },
        }),
        views: (self) => ({
          get lastLog() {
            return self.logs.length > 0
              ? self.logs[self.logs.length - 1]
              : null;
          },
        }),
      });

      const Model = types
        .model("Model", {
          name: types.string,
        })
        .apply(Logger);

      const model = Model.create({ name: "Test" });

      model.log("Hello");
      model.log("World");

      expect(model.lastLog).toBe("World");
    });
  });

  describe("Model.apply()", () => {
    it("should apply multiple mixins", () => {
      const Identifiable = types.mixin({
        requires: {
          id: types.identifier,
        },
        views: (self) => ({
          get shortId() {
            return self.id.substring(0, 8);
          },
        }),
      });

      const Timestamped = types.mixin({
        requires: {
          createdAt: types.number,
        },
        views: (self) => ({
          get age() {
            return Date.now() - self.createdAt;
          },
        }),
      });

      const Entity = types
        .model("Entity", {
          id: types.identifier,
          name: types.string,
          createdAt: types.number,
        })
        .apply(Identifiable)
        .apply(Timestamped);

      const now = Date.now();
      const entity = Entity.create({
        id: "abcd1234-5678",
        name: "Test Entity",
        createdAt: now - 1000,
      });

      expect(entity.shortId).toBe("abcd1234");
      expect(entity.age).toBeGreaterThanOrEqual(1000);
    });

    it("should preserve existing views and actions when applying mixin", () => {
      const Mixin = types.mixin({
        requires: {
          value: types.number,
        },
        views: (self) => ({
          get mixinView() {
            return self.value * 3;
          },
        }),
      });

      const Model = types
        .model("Model", {
          value: types.number,
        })
        .views((self) => ({
          get doubled() {
            return self.value * 2;
          },
        }))
        .actions((self) => ({
          increment() {
            self.value++;
          },
        }))
        .apply(Mixin);

      const model = Model.create({ value: 10 });

      // Original view should still work
      expect(model.doubled).toBe(20);
      // Mixin view should work
      expect(model.mixinView).toBe(30);
      // Original action should still work
      model.increment();
      expect(model.value).toBe(11);
      expect(model.doubled).toBe(22);
      expect(model.mixinView).toBe(33);
    });
  });

  describe("Enhanced compose()", () => {
    it("should compose models with views", () => {
      const ModelA = types
        .model("ModelA", {
          valueA: types.number,
        })
        .views((self) => ({
          get doubledA() {
            return self.valueA * 2;
          },
        }));

      const ModelB = types
        .model("ModelB", {
          valueB: types.number,
        })
        .views((self) => ({
          get doubledB() {
            return self.valueB * 2;
          },
        }));

      const Combined = types.compose("Combined", ModelA, ModelB);

      const combined = Combined.create({ valueA: 5, valueB: 10 });

      expect(combined.valueA).toBe(5);
      expect(combined.valueB).toBe(10);
      expect(combined.doubledA).toBe(10);
      expect(combined.doubledB).toBe(20);
    });

    it("should compose models with actions", () => {
      const Incrementable = types
        .model("Incrementable", {
          count: types.optional(types.number, 0),
        })
        .actions((self) => ({
          increment() {
            self.count++;
          },
        }));

      const Named = types
        .model("Named", {
          name: types.string,
        })
        .actions((self) => ({
          setName(newName: string) {
            self.name = newName;
          },
        }));

      const Combined = types.compose("Combined", Incrementable, Named);

      const combined = Combined.create({ name: "Test" });

      expect(combined.count).toBe(0);
      expect(combined.name).toBe("Test");

      combined.increment();
      expect(combined.count).toBe(1);

      combined.setName("Updated");
      expect(combined.name).toBe("Updated");
    });

    it("should compose models with volatile state", () => {
      const LoadableModel = types
        .model("LoadableModel", {
          data: types.optional(types.string, ""),
        })
        .volatile(() => ({
          isLoading: false,
        }));

      const SelectableModel = types
        .model("SelectableModel", {
          id: types.identifier,
        })
        .volatile(() => ({
          isSelected: false,
        }));

      const Combined = types.compose(
        "Combined",
        LoadableModel,
        SelectableModel,
      );

      const combined = Combined.create({ id: "test-1", data: "hello" });

      expect(combined.isLoading).toBe(false);
      expect(combined.isSelected).toBe(false);
    });

    it("should compose models with views, actions, and volatile", () => {
      const Counter = types
        .model("Counter", {
          count: types.optional(types.number, 0),
        })
        .views((self) => ({
          get doubled() {
            return self.count * 2;
          },
        }))
        .actions((self) => ({
          increment() {
            self.count++;
          },
        }))
        .volatile(() => ({
          lastUpdated: null as number | null,
        }));

      const Named = types
        .model("Named", {
          name: types.string,
        })
        .views((self) => ({
          get upperName() {
            return self.name.toUpperCase();
          },
        }))
        .actions((self) => ({
          setName(newName: string) {
            self.name = newName;
          },
        }));

      const Combined = types.compose("Combined", Counter, Named);

      const combined = Combined.create({ name: "Test" });

      // Counter functionality
      expect(combined.count).toBe(0);
      expect(combined.doubled).toBe(0);
      combined.increment();
      expect(combined.count).toBe(1);
      expect(combined.doubled).toBe(2);

      // Named functionality
      expect(combined.name).toBe("Test");
      expect(combined.upperName).toBe("TEST");
      combined.setName("Updated");
      expect(combined.name).toBe("Updated");

      // Volatile state
      expect(combined.lastUpdated).toBe(null);
    });
  });

  describe("ModelSelf type utility", () => {
    it("should allow extracting self type from model", () => {
      const User = types
        .model("User", {
          firstName: types.string,
          lastName: types.string,
        })
        .views((self) => ({
          get fullName() {
            return `${self.firstName} ${self.lastName}`;
          },
        }))
        .actions((self) => ({
          setFirstName(name: string) {
            self.firstName = name;
          },
        }));

      // This test verifies the type works at compile time
      // The type should include firstName, lastName, fullName, and setFirstName
      const user = User.create({ firstName: "John", lastName: "Doe" });

      expect(user.firstName).toBe("John");
      expect(user.lastName).toBe("Doe");
      expect(user.fullName).toBe("John Doe");

      user.setFirstName("Jane");
      expect(user.fullName).toBe("Jane Doe");
    });
  });
});
