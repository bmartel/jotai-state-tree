import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  types,
  registerModel,
  unregisterModel,
  isModelRegistered,
  resolveModel,
  tryResolveModel,
  resolveModelAsync,
  getModelMetadata,
  getRegisteredModelNames,
  onModelRegistered,
  clearModelRegistry,
  lateModel,
  dynamicReference,
  safeDynamicReference,
  getSnapshot,
  resolveIdentifier,
} from "../index";

describe("Model Registry", () => {
  beforeEach(() => {
    // Clear registry before each test
    clearModelRegistry();
  });

  describe("registerModel / unregisterModel", () => {
    it("should register a model", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);
      expect(isModelRegistered("User")).toBe(true);
    });

    it("should register a model with metadata", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User, { version: "1.0.0", author: "test" });
      expect(isModelRegistered("User")).toBe(true);
      expect(getModelMetadata("User")).toEqual({
        version: "1.0.0",
        author: "test",
      });
    });

    it("should throw when registering duplicate model name", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);
      expect(() => registerModel("User", User)).toThrow(
        'Model "User" is already registered',
      );
    });

    it("should unregister a model", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);
      expect(isModelRegistered("User")).toBe(true);

      const result = unregisterModel("User");
      expect(result).toBe(true);
      expect(isModelRegistered("User")).toBe(false);
    });

    it("should return false when unregistering non-existent model", () => {
      const result = unregisterModel("NonExistent");
      expect(result).toBe(false);
    });
  });

  describe("resolveModel / tryResolveModel", () => {
    it("should resolve a registered model", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);
      const resolved = resolveModel("User");
      expect(resolved).toBe(User);
    });

    it("should throw when resolving non-existent model", () => {
      expect(() => resolveModel("NonExistent")).toThrow(
        'Model "NonExistent" is not registered',
      );
    });

    it("should return undefined with tryResolveModel for non-existent model", () => {
      const result = tryResolveModel("NonExistent");
      expect(result).toBeUndefined();
    });

    it("should return model with tryResolveModel for existing model", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);
      const result = tryResolveModel("User");
      expect(result).toBe(User);
    });
  });

  describe("resolveModelAsync", () => {
    it("should resolve immediately if model is registered", async () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);
      const resolved = await resolveModelAsync("User");
      expect(resolved).toBe(User);
    });

    it("should wait for model to be registered", async () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      // Start waiting, then register after a delay
      const promise = resolveModelAsync("User", 1000);

      setTimeout(() => {
        registerModel("User", User);
      }, 50);

      const resolved = await promise;
      expect(resolved).toBe(User);
    });

    it("should timeout if model is not registered in time", async () => {
      await expect(resolveModelAsync("NonExistent", 100)).rejects.toThrow(
        'Timeout waiting for model "NonExistent" to be registered',
      );
    });
  });

  describe("getRegisteredModelNames", () => {
    it("should return empty array when no models registered", () => {
      expect(getRegisteredModelNames()).toEqual([]);
    });

    it("should return all registered model names", () => {
      const User = types.model("User", { id: types.identifier });
      const Post = types.model("Post", { id: types.identifier });
      const Comment = types.model("Comment", { id: types.identifier });

      registerModel("User", User);
      registerModel("Post", Post);
      registerModel("Comment", Comment);

      const names = getRegisteredModelNames();
      expect(names).toHaveLength(3);
      expect(names).toContain("User");
      expect(names).toContain("Post");
      expect(names).toContain("Comment");
    });
  });

  describe("onModelRegistered", () => {
    it("should call listener when model is registered", () => {
      const listener = vi.fn();
      const unsubscribe = onModelRegistered(listener);

      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("User", User);

      unsubscribe();
    });

    it("should not call listener after unsubscribe", () => {
      const listener = vi.fn();
      const unsubscribe = onModelRegistered(listener);

      unsubscribe();

      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);

      expect(listener).not.toHaveBeenCalled();
    });

    it("should support multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      onModelRegistered(listener1);
      onModelRegistered(listener2);

      const User = types.model("User", { id: types.identifier });
      registerModel("User", User);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe("clearModelRegistry", () => {
    it("should clear all registered models", () => {
      const User = types.model("User", { id: types.identifier });
      const Post = types.model("Post", { id: types.identifier });

      registerModel("User", User);
      registerModel("Post", Post);

      expect(getRegisteredModelNames()).toHaveLength(2);

      clearModelRegistry();

      expect(getRegisteredModelNames()).toHaveLength(0);
      expect(isModelRegistered("User")).toBe(false);
      expect(isModelRegistered("Post")).toBe(false);
    });
  });

  describe("types.lateModel", () => {
    it("should resolve registered model lazily", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      // Create a model that uses lateModel before User is registered
      const Post = types.model("Post", {
        id: types.identifier,
        title: types.string,
        author: lateModel("User"),
      });

      // Register User after Post is defined
      registerModel("User", User);

      // Create instances
      const user = User.create({ id: "user-1", name: "Alice" });
      const post = Post.create({
        id: "post-1",
        title: "Hello",
        author: { id: "user-2", name: "Bob" },
      });

      expect(post.author.name).toBe("Bob");
    });

    it("should throw when model is not registered at creation time", () => {
      const Post = types.model("Post", {
        id: types.identifier,
        author: lateModel("NonExistent"),
      });

      expect(() =>
        Post.create({
          id: "post-1",
          author: { id: "user-1" },
        }),
      ).toThrow('Model "NonExistent" is not registered');
    });
  });

  describe("types.dynamicReference", () => {
    it("should create dynamic reference type with custom resolver", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);

      // Create a simple lookup map
      const usersById = new Map<string, unknown>();
      const user1 = User.create({ id: "user-1", name: "Alice" });
      const user2 = User.create({ id: "user-2", name: "Bob" });
      usersById.set("user-1", user1);
      usersById.set("user-2", user2);

      // Test that dynamic reference type is valid
      const refType = dynamicReference("User", {
        get: (identifier) => usersById.get(String(identifier)),
      });

      expect(refType).toBeDefined();
      expect(refType.name).toBe('dynamicReference("User")');
    });

    it("should support custom get resolver", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);

      const usersById = new Map<string, unknown>();

      const Post = types.model("Post", {
        id: types.identifier,
        authorId: dynamicReference("User", {
          get: (identifier) => usersById.get(String(identifier)),
        }),
      });

      const user = User.create({ id: "user-1", name: "Alice" });
      usersById.set("user-1", user);

      const post = Post.create({
        id: "post-1",
        authorId: "user-1",
      });

      // Access through the dynamic reference proxy
      expect(post.authorId).toBeDefined();
    });

    it("should call onInvalidated when reference cannot be resolved", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);

      const onInvalidated = vi
        .fn()
        .mockReturnValue({ id: "fallback", name: "Fallback User" });

      const Post = types.model("Post", {
        id: types.identifier,
        authorId: dynamicReference("User", {
          get: () => undefined, // Always return undefined
          onInvalidated,
        }),
      });

      const post = Post.create({
        id: "post-1",
        authorId: "non-existent",
      });

      // Access the reference - should trigger onInvalidated
      const name = post.authorId.name;
      expect(onInvalidated).toHaveBeenCalled();
      expect(name).toBe("Fallback User");
    });
  });

  describe("types.safeDynamicReference", () => {
    it("should return undefined for unresolved reference", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);

      const Post = types.model("Post", {
        id: types.identifier,
        authorId: safeDynamicReference("User", {
          get: () => undefined, // Always return undefined
        }),
      });

      const post = Post.create({
        id: "post-1",
        authorId: "non-existent",
      });

      expect(post.authorId).toBeUndefined();
    });

    it("should resolve when reference exists", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);

      const usersById = new Map<string, unknown>();

      const Post = types.model("Post", {
        id: types.identifier,
        authorId: safeDynamicReference("User", {
          get: (identifier) => usersById.get(String(identifier)),
        }),
      });

      const user = User.create({ id: "user-1", name: "Alice" });
      usersById.set("user-1", user);

      const post = Post.create({
        id: "post-1",
        authorId: "user-1",
      });

      expect(post.authorId).toBeDefined();
    });

    it("should allow undefined in create", () => {
      const User = types.model("User", {
        id: types.identifier,
        name: types.string,
      });

      registerModel("User", User);

      const Post = types.model("Post", {
        id: types.identifier,
        authorId: safeDynamicReference("User"),
      });

      const post = Post.create({
        id: "post-1",
        authorId: undefined,
      });

      expect(post.authorId).toBeUndefined();
    });
  });

  describe("Integration: Plugin Architecture", () => {
    it("should support lazy-loading plugin models", async () => {
      // Core model defined upfront
      const CoreStore = types.model("CoreStore", {
        name: types.string,
        plugins: types.array(types.string),
      });

      // Create store before plugins are loaded
      const store = CoreStore.create({
        name: "MyApp",
        plugins: [],
      });

      expect(store.name).toBe("MyApp");

      // Simulate plugin loading
      const loadPlugin = async (pluginName: string) => {
        // Simulate async module loading
        await new Promise((resolve) => setTimeout(resolve, 10));

        if (pluginName === "UserPlugin") {
          const UserPlugin = types.model("UserPlugin", {
            id: types.identifier,
            users: types.array(
              types.model({
                id: types.identifier,
                name: types.string,
              }),
            ),
          });
          registerModel("UserPlugin", UserPlugin);
          return UserPlugin;
        }

        throw new Error(`Unknown plugin: ${pluginName}`);
      };

      // Load plugin dynamically
      await loadPlugin("UserPlugin");

      // Verify plugin is now available
      expect(isModelRegistered("UserPlugin")).toBe(true);
      const UserPlugin = resolveModel("UserPlugin");
      expect(UserPlugin).toBeDefined();

      // Create plugin instance
      const pluginInstance = UserPlugin.create({
        id: "user-plugin-1",
        users: [{ id: "user-1", name: "Alice" }],
      });

      expect(getSnapshot(pluginInstance)).toMatchObject({
        id: "user-plugin-1",
        users: [{ id: "user-1", name: "Alice" }],
      });
    });

    it("should handle multiple dependent plugins", async () => {
      // Register base model
      const BaseEntity = types.model("BaseEntity", {
        id: types.identifier,
        createdAt: types.optional(types.string, () => new Date().toISOString()),
      });
      registerModel("BaseEntity", BaseEntity);

      // Plugin A depends on BaseEntity
      const PluginA = types.compose(
        "PluginA",
        resolveModel("BaseEntity"),
        types.model({
          pluginAData: types.string,
        }),
      );
      registerModel("PluginA", PluginA);

      // Plugin B also depends on BaseEntity
      const PluginB = types.compose(
        "PluginB",
        resolveModel("BaseEntity"),
        types.model({
          pluginBData: types.number,
        }),
      );
      registerModel("PluginB", PluginB);

      // Create instances
      const instanceA = resolveModel("PluginA").create({
        id: "a-1",
        pluginAData: "hello",
      });

      const instanceB = resolveModel("PluginB").create({
        id: "b-1",
        pluginBData: 42,
      });

      expect(instanceA.pluginAData).toBe("hello");
      expect(instanceB.pluginBData).toBe(42);
      expect(instanceA.id).toBe("a-1");
      expect(instanceB.id).toBe("b-1");
    });

    it("should support code splitting with resolveModelAsync", async () => {
      // Start waiting for a model that will be "loaded" later
      const modelPromise = resolveModelAsync("LazyLoadedModel", 5000);

      // Simulate code splitting / dynamic import
      setTimeout(() => {
        const LazyModel = types.model("LazyLoadedModel", {
          id: types.identifier,
          data: types.frozen(),
        });
        registerModel("LazyLoadedModel", LazyModel);
      }, 50);

      // Wait for the model to be available
      const LazyModel = await modelPromise;

      expect(LazyModel).toBeDefined();
      const instance = LazyModel.create({
        id: "lazy-1",
        data: { foo: "bar" },
      });

      expect(instance.data).toEqual({ foo: "bar" });
    });
  });

  describe("Registry with types namespace", () => {
    it("should have lateModel available on types namespace", () => {
      expect(types.lateModel).toBe(lateModel);
    });

    it("should have dynamicReference available on types namespace", () => {
      expect(types.dynamicReference).toBe(dynamicReference);
    });

    it("should have safeDynamicReference available on types namespace", () => {
      expect(types.safeDynamicReference).toBe(safeDynamicReference);
    });
  });
});
