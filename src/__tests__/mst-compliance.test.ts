import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  types,
  getSnapshot,
  applySnapshot,
  onSnapshot,
  onPatch,
  applyPatch,
  getEnv,
  destroy,
  isAlive,
  recordActions,
  applyAction,
  protect,
  unprotect,
  isProtected,
  getParent,
  getRoot,
} from "../index";
import { clearAllRegistries, resetGlobalStore } from "../tree";

describe("MST Drop-in Compliance Suite", () => {
  beforeEach(() => {
    clearAllRegistries();
    resetGlobalStore();
  });

  describe("1. Type & Composite Compliance (types.compose)", () => {
    it("should compose properties, views, and actions from multiple models", () => {
      const ModelA = types
        .model("ModelA", {
          a: types.string,
        })
        .views((self) => ({
          get upperA() {
            return self.a.toUpperCase();
          },
        }))
        .actions((self) => ({
          setA(val: string) {
            self.a = val;
          },
        }));

      const ModelB = types
        .model("ModelB", {
          b: types.number,
        })
        .views((self) => ({
          get doubleB() {
            return self.b * 2;
          },
        }))
        .actions((self) => ({
          setB(val: number) {
            self.b = val;
          },
        }));

      const Composed = types.compose("Composed", ModelA, ModelB);

      const instance = Composed.create({
        a: "hello",
        b: 21,
      });

      // Properties
      expect(instance.a).toBe("hello");
      expect(instance.b).toBe(21);

      // Views
      expect(instance.upperA).toBe("HELLO");
      expect(instance.doubleB).toBe(42);

      // Actions
      instance.setA("world");
      instance.setB(50);
      expect(instance.a).toBe("world");
      expect(instance.b).toBe(50);
    });
  });

  describe("2. Lifecycle Hooks Compliance", () => {
    it("should call hooks in the correct order: afterCreate -> afterAttach", () => {
      const hookOrder: string[] = [];

      const Child = types
        .model("Child", {
          id: types.identifier,
        })
        .actions((self) => ({
          afterCreate() {
            hookOrder.push("child-afterCreate");
          },
          afterAttach() {
            hookOrder.push("child-afterAttach");
          },
          beforeDetach() {
            hookOrder.push("child-beforeDetach");
          },
          beforeDestroy() {
            hookOrder.push("child-beforeDestroy");
          },
        }));

      const Parent = types
        .model("Parent", {
          child: Child,
        })
        .actions((self) => ({
          afterCreate() {
            hookOrder.push("parent-afterCreate");
          },
        }));

      // Instantiating parent with child
      const parent = Parent.create({
        child: { id: "c1" },
      });

      // Verification of creation order
      expect(hookOrder).toContain("child-afterCreate");
      expect(hookOrder).toContain("parent-afterCreate");
      expect(hookOrder).toContain("child-afterAttach");

      // Child afterCreate happens during child instantiation, parent afterCreate during parent.
      // afterAttach happens once the child is fully bound to the parent node.
      expect(hookOrder.indexOf("child-afterCreate")).toBeLessThan(hookOrder.indexOf("child-afterAttach"));

      // Destroy parent
      destroy(parent);
      expect(hookOrder).toContain("child-beforeDestroy");
    });
  });

  describe("3. Environment (getEnv) Cascading", () => {
    it("should cascade environments down to all descendants", () => {
      const Child = types.model("Child", {
        value: types.number,
      });

      const Parent = types.model("Parent", {
        child: Child,
      });

      const env = { api: { fetch: () => "mocked" } };
      const root = Parent.create(
        {
          child: { value: 10 },
        },
        env
      );

      expect(getEnv(root)).toBe(env);
      expect(getEnv(root.child)).toBe(env);
    });
  });

  describe("4. Action Replaying (recordActions & applyAction)", () => {
    it("should record actions and apply them to another instance", () => {
      const Counter = types
        .model("Counter", {
          count: types.number,
        })
        .actions((self) => ({
          increment(amount: number) {
            self.count += amount;
          },
          decrement(amount: number) {
            self.count -= amount;
          },
        }));

      const source = Counter.create({ count: 10 });
      const target = Counter.create({ count: 10 });

      const recorder = recordActions(source);

      source.increment(5);
      source.decrement(2);

      expect(source.count).toBe(13);
      expect(recorder.actions.length).toBe(2);

      // Replay actions on target
      applyAction(target, recorder.actions[0]);
      applyAction(target, recorder.actions[1]);

      expect(target.count).toBe(13);

      recorder.stop();
    });
  });

  describe("5. Volatile State Isolation", () => {
    it("should isolate volatile state per instance and not include it in snapshots", () => {
      const User = types
        .model("User", {
          name: types.string,
        })
        .volatile((self) => ({
          sessionToken: "initial-token",
        }))
        .actions((self) => ({
          setToken(token: string) {
            self.sessionToken = token;
          },
        }));

      const instance1 = User.create({ name: "Bob" });
      const instance2 = User.create({ name: "Alice" });

      expect(instance1.sessionToken).toBe("initial-token");
      expect(instance2.sessionToken).toBe("initial-token");

      // Mutate volatile on one instance
      unprotect(instance1);
      instance1.setToken("token-1");

      expect(instance1.sessionToken).toBe("token-1");
      expect(instance2.sessionToken).toBe("initial-token"); // isolated!

      // Snapshot should NOT include volatile properties
      expect(getSnapshot(instance1)).toEqual({ name: "Bob" });
    });
  });

  describe("6. Reference Compliance", () => {
    it("should resolve identifier-based references", () => {
      const Item = types.model("Item", {
        id: types.identifier,
        name: types.string,
      });

      const itemsById = new Map<string, any>();
      const Folder = types.model("Folder", {
        id: types.identifier,
        selectedItemId: types.safeDynamicReference("Item", {
          get: (id) => itemsById.get(String(id)),
        }),
      });

      const item = Item.create({ id: "item-1", name: "File A" });
      itemsById.set("item-1", item);

      const folder = Folder.create({
        id: "folder-1",
        selectedItemId: "item-1",
      });

      expect(folder.selectedItemId).toBeDefined();
      expect(folder.selectedItemId.name).toBe("File A");

      // If reference targets are missing, safeDynamicReference returns undefined
      const folderEmpty = Folder.create({
        id: "folder-2",
        selectedItemId: "missing-item",
      });
      expect(folderEmpty.selectedItemId).toBeUndefined();

      destroy(item);
      destroy(folder);
      destroy(folderEmpty);
    });
  });
});
