// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { types } from "../index";
import { createPersistenceManager, PersistenceManager } from "../persistence";

import { getSnapshot } from "../tree";

// ============================================================================
// IndexedDB Mock
// ============================================================================

class MockIDBDatabase {
  objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };
  stores = new Map<string, Map<any, any>>();

  constructor() {
    this.stores.set("snapshots", new Map());
    this.stores.set("sync_queue", new Map());
  }

  createObjectStore(name: string) {
    this.stores.set(name, new Map());
  }

  transaction(storeNames: string | string[], mode: string) {
    return {
      objectStore: (name: string) => {
        const store = this.stores.get(name)!;
        return {
          get: (key: any) => {
            const req = {
              onsuccess: null as any,
              onerror: null as any,
              result: store.get(key),
            };
            Promise.resolve().then(() => req.onsuccess && req.onsuccess());
            return req;
          },
          put: (value: any, key: any) => {
            store.set(key, value);
            const req = { onsuccess: null as any, onerror: null as any };
            Promise.resolve().then(() => req.onsuccess && req.onsuccess());
            return req;
          },
          getAll: () => {
            const req = {
              onsuccess: null as any,
              onerror: null as any,
              result: Array.from(store.values()),
            };
            Promise.resolve().then(() => req.onsuccess && req.onsuccess());
            return req;
          },
          add: (value: any) => {
            const id = Math.floor(Math.random() * 1000000);
            const valueWithId = { ...value, id };
            store.set(id, valueWithId);
            const req = {
              onsuccess: null as any,
              onerror: null as any,
              result: id,
            };
            Promise.resolve().then(() => req.onsuccess && req.onsuccess());
            return req;
          },
          delete: (key: any) => {
            store.delete(key);
            const req = { onsuccess: null as any, onerror: null as any };
            Promise.resolve().then(() => req.onsuccess && req.onsuccess());
            return req;
          },
          clear: () => {
            store.clear();
            const req = { onsuccess: null as any, onerror: null as any };
            Promise.resolve().then(() => req.onsuccess && req.onsuccess());
            return req;
          },
        };
      },
    };
  }
}

let dbMock = new MockIDBDatabase();
const originalIndexedDB = globalThis.indexedDB;

function setupIndexedDBMock() {
  dbMock = new MockIDBDatabase();
  globalThis.indexedDB = {
    open: (name: string, version: number) => {
      const request = {
        result: dbMock,
        onupgradeneeded: null as any,
        onsuccess: null as any,
        onerror: null as any,
      };
      Promise.resolve().then(() => {
        if (request.onupgradeneeded) request.onupgradeneeded();
        if (request.onsuccess) request.onsuccess();
      });
      return request as any;
    },
  } as any;
}

function restoreIndexedDB() {
  globalThis.indexedDB = originalIndexedDB;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// Test Models
// ============================================================================

const Todo = types
  .model("Todo", {
    id: types.identifier,
    title: types.string,
    completed: types.boolean,
  })
  .actions((self) => ({
    setTitle(newTitle: string) {
      self.title = newTitle;
    },
    toggle() {
      self.completed = !self.completed;
    },
  }));

const TodoList = types
  .model("TodoList", {
    todos: types.array(Todo),
  })
  .actions((self) => ({
    addTodo(id: string, title: string) {
      self.todos.push({ id, title, completed: false });
    },
    removeTodo(id: string) {
      const idx = self.todos.findIndex((t) => t.id === id);
      if (idx !== -1) {
        self.todos.splice(idx, 1);
      }
    },
  }));

// ============================================================================
// Test Suite
// ============================================================================

describe("IndexedDB Model Persistence & Sync", () => {
  beforeEach(() => {
    setupIndexedDBMock();
  });

  test("should load cached snapshot from storage on initialization (optimistic UI)", async () => {
    // 1. Seed IndexedDB mock with some data
    const initialSnapshot = {
      todos: [
        { id: "1", title: "Buy Milk", completed: false },
        { id: "2", title: "Walk Dog", completed: true },
      ],
    };
    dbMock.stores.get("snapshots")!.set("todo-list-key", initialSnapshot);

    // 2. Create the model instance
    const store = TodoList.create({ todos: [] });

    // 3. Create and initialize the persistence manager
    const manager = createPersistenceManager(store, {
      key: "todo-list-key",
    });

    await manager.initialize();

    // 4. Verify cached snapshot was applied immediately
    expect(getSnapshot(store)).toEqual(initialSnapshot);
    expect(store.todos.length).toBe(2);
    expect(store.todos[0].title).toBe("Buy Milk");
  });

  test("should trigger background revalidation query and update model and cache", async () => {
    // Seed DB with old data
    const oldSnapshot = {
      todos: [{ id: "1", title: "Old Title", completed: false }],
    };
    dbMock.stores.get("snapshots")!.set("todo-list-key", oldSnapshot);

    const freshSnapshot = {
      todos: [
        { id: "1", title: "Fresh Title", completed: false },
        { id: "2", title: "New Todo", completed: true },
      ],
    };

    const queryFn = vi.fn().mockResolvedValue(freshSnapshot);
    const store = TodoList.create({ todos: [] });

    const manager = createPersistenceManager(store, {
      key: "todo-list-key",
      query: {
        queryKey: "todos",
        queryFn,
      },
    });

    await manager.initialize();

    // Cached data loaded first
    expect(getSnapshot(store)).toEqual(oldSnapshot);

    // Wait for the background query promise to resolve
    await sleep(20);

    // Model and cache should be updated with fresh data
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(getSnapshot(store)).toEqual(freshSnapshot);
    expect(dbMock.stores.get("snapshots")!.get("todo-list-key")).toEqual(
      freshSnapshot,
    );
  });

  test("should handle optimistic updates, save snapshots, and queue mutations", async () => {
    const store = TodoList.create({ todos: [] });
    const syncFn = vi.fn().mockResolvedValue({ success: true });

    const manager = createPersistenceManager(store, {
      key: "todo-list-key",
      mutation: {
        syncFn,
      },
    });

    await manager.initialize();

    // Mutate state tree
    store.addTodo("1", "Clean Room");

    // Wait for the async handlePatch database write to complete
    await sleep(170);

    // Local snapshot should be cached in IndexedDB immediately
    const expectedSnapshot = {
      todos: [{ id: "1", title: "Clean Room", completed: false }],
    };
    expect(dbMock.stores.get("snapshots")!.get("todo-list-key")).toEqual(
      expectedSnapshot,
    );

    // Wait for syncFn promise to resolve
    await sleep(20);

    expect(syncFn).toHaveBeenCalledTimes(1);
    // syncFn should receive current snapshot and patches
    expect(syncFn).toHaveBeenCalledWith(expectedSnapshot, [
      {
        op: "add",
        path: "/todos/0",
        value: { id: "1", title: "Clean Room", completed: false },
      },
    ]);
  });

  test("should queue mutations offline and sync them when online status is restored", async () => {
    // Mock offline status
    vi.stubGlobal("navigator", { onLine: false });

    const store = TodoList.create({ todos: [] });
    const syncFn = vi.fn().mockResolvedValue({ success: true });

    const manager = createPersistenceManager(store, {
      key: "todo-list-key",
      mutation: {
        syncFn,
      },
    });

    await manager.initialize();

    // Mutate state tree while offline
    store.addTodo("1", "Offline Task");

    // Wait for async processing
    await sleep(20);

    // syncFn should not be called while offline
    expect(syncFn).not.toHaveBeenCalled();

    // Mutation queue in DB should contain the offline patch
    const queue = dbMock.stores.get("sync_queue")!;
    expect(queue.size).toBe(1);

    const queuedItem = Array.from(queue.values())[0];
    expect(queuedItem.key).toBe("todo-list-key");
    expect(queuedItem.patches).toEqual([
      {
        op: "add",
        path: "/todos/0",
        value: { id: "1", title: "Offline Task", completed: false },
      },
    ]);

    // Restore online status and trigger online listener
    vi.stubGlobal("navigator", { onLine: true });
    // Simulate window 'online' event dispatch
    const onlineEvent = new Event("online");
    window.dispatchEvent(onlineEvent);

    await sleep(20);

    // Now syncFn should be called
    expect(syncFn).toHaveBeenCalledTimes(1);
    // Queue should be cleared
    expect(queue.size).toBe(0);

    vi.unstubAllGlobals();
  });

  test("should roll back changes using inverse patches when server validation sync fails", async () => {
    const store = TodoList.create({ todos: [] });

    // Server rejects modification with validation error
    const syncFn = vi
      .fn()
      .mockRejectedValue(new Error("Validation failed: Title is inappropriate"));
    const onError = vi.fn();

    const manager = createPersistenceManager(store, {
      key: "todo-list-key",
      mutation: {
        syncFn,
        onError,
        // Trigger rollback for this error
        shouldRollback: () => true,
      },
    });

    await manager.initialize();

    // Add a todo (optimistic UI update)
    store.addTodo("1", "Optimistic Todo");
    expect(store.todos.length).toBe(1);

    // Wait for sync processing
    await sleep(20);

    expect(syncFn).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);

    // Model should have been rolled back to initial state (empty)
    expect(store.todos.length).toBe(0);
    // Local DB snapshot should also be updated to the rolled back state
    expect(dbMock.stores.get("snapshots")!.get("todo-list-key")).toEqual({
      todos: [],
    });
    // Queue should be cleared
    expect(dbMock.stores.get("sync_queue")!.size).toBe(0);
  });

  test("should throw an error loudly during initialization if IndexedDB fails to read snapshots", async () => {
    // Mock getSnapshot to throw an error
    vi.spyOn(dbMock.stores.get("snapshots")!, "get").mockImplementationOnce(() => {
      throw new Error("Disk corruption error");
    });

    const store = TodoList.create({ todos: [] });
    const manager = createPersistenceManager(store, {
      key: "todo-list-key",
    });

    await expect(manager.initialize()).rejects.toThrow("Disk corruption error");
  });

  test("should throw an error loudly during constructor call if IndexedDB is not available", async () => {
    vi.stubGlobal("indexedDB", undefined);

    const store = TodoList.create({ todos: [] });
    expect(() => {
      createPersistenceManager(store, {
        key: "todo-list-key",
      });
    }).toThrow("IndexedDB is not supported in this environment");

    vi.unstubAllGlobals();
  });

  test("should batch synchronous patches occurring in the same tick into a single queued mutation", async () => {
    // Mock offline status to prevent queue from auto-flushing and disappearing
    vi.stubGlobal("navigator", { onLine: false });

    const store = TodoList.create({ todos: [] });
    const syncFn = vi.fn().mockResolvedValue({ success: true });

    const manager = createPersistenceManager(store, {
      key: "todo-list-key",
      mutation: {
        syncFn,
      },
    });

    await manager.initialize();

    // Make multiple synchronous modifications (in the same tick)
    store.addTodo("1", "Task 1");
    store.addTodo("2", "Task 2");
    store.addTodo("3", "Task 3");

    // Wait for the microtask flush to complete
    await sleep(20);

    // Should have only queued exactly 1 mutation item containing all 3 patches
    const queue = dbMock.stores.get("sync_queue")!;
    expect(queue.size).toBe(1);

    const queuedItem = Array.from(queue.values())[0];
    expect(queuedItem.patches.length).toBe(3);
    expect(queuedItem.patches.map((p: any) => p.value.title)).toEqual(["Task 1", "Task 2", "Task 3"]);

    vi.unstubAllGlobals();
  });

  test("should debounce snapshot writes to IndexedDB to avoid excessive disk writes", async () => {
    const store = TodoList.create({ todos: [] });
    const manager = createPersistenceManager(store, {
      key: "todo-list-key",
    });

    await manager.initialize();

    // Clear snapshots store for clean assertions
    dbMock.stores.get("snapshots")!.clear();

    // Make rapid changes
    store.addTodo("1", "Keypress 1");
    await sleep(20);
    store.addTodo("2", "Keypress 2");
    await sleep(20);
    store.addTodo("3", "Keypress 3");

    // Since the debounce timeout is 150ms, no write should have happened yet
    expect(dbMock.stores.get("snapshots")!.get("todo-list-key")).toBeUndefined();

    // Wait for debounce timeout to expire
    await sleep(160);

    // Snapshot should be written now with the final state
    const expectedSnapshot = {
      todos: [
        { id: "1", title: "Keypress 1", completed: false },
        { id: "2", title: "Keypress 2", completed: false },
        { id: "3", title: "Keypress 3", completed: false },
      ]
    };
    expect(dbMock.stores.get("snapshots")!.get("todo-list-key")).toEqual(expectedSnapshot);
  });

  test("should compact queue on the main thread as a fallback if Web Workers are not supported", async () => {
    // Disable Web Worker
    vi.stubGlobal("Worker", undefined);

    // Mock offline status
    vi.stubGlobal("navigator", { onLine: false });

    const store = TodoList.create({ todos: [] });
    const syncFn = vi.fn().mockResolvedValue({ success: true });

    const manager = createPersistenceManager(store, {
      key: "todo-list-key",
      mutation: {
        syncFn,
      },
    });

    await manager.initialize();

    // Make 3 distinct offline modifications (simulating separate tasks/ticks)
    store.addTodo("1", "Buy Apples");
    await sleep(20);
    store.addTodo("2", "Buy Bananas");
    await sleep(20);
    store.addTodo("3", "Buy Cherries");
    await sleep(20);

    const queueStore = dbMock.stores.get("sync_queue")!;
    expect(queueStore.size).toBe(3);

    // Call manual compaction
    await manager.compact();

    // Queue should be compacted to 1 root-level consolidation mutation
    expect(queueStore.size).toBe(1);

    const compactedItem = Array.from(queueStore.values())[0] as any;
    expect(compactedItem.patches).toEqual([
      { op: "replace", path: "", value: { todos: [
        { id: "1", title: "Buy Apples", completed: false },
        { id: "2", title: "Buy Bananas", completed: false },
        { id: "3", title: "Buy Cherries", completed: false },
      ] } }
    ]);
    expect(compactedItem.inversePatches).toEqual([
      { op: "replace", path: "", value: { todos: [] } }
    ]);

    vi.unstubAllGlobals();
  });

  test("should compact queue using a background Web Worker if Web Workers are supported", async () => {
    // Mock Web Worker class to simulate worker thread execution in IndexedDB
    class MockWorker {
      onmessage: any;
      onerror: any;
      constructor(url: string) {}
      postMessage(data: any) {
        setTimeout(async () => {
          // Reconstruct compaction inside IndexedDB mock synchronously to simulate background execution
          const queueStore = dbMock.stores.get("sync_queue")!;
          const queue = Array.from(queueStore.values()).filter(item => item.key === data.key);
          
          if (queue.length > 1) {
            // Consolidated values
            const initialSnapshot = { todos: [] };
            const currentSnapshot = data.currentSnapshot;

            // Delete old items
            for (const item of queue) {
              queueStore.delete(item.id);
            }

            // Add compacted item
            const id = Math.floor(Math.random() * 1000000);
            queueStore.set(id, {
              id,
              key: data.key,
              patches: [{ op: "replace", path: "", value: currentSnapshot }],
              inversePatches: [{ op: "replace", path: "", value: initialSnapshot }],
              timestamp: Date.now()
            });
          }

          if (this.onmessage) {
            this.onmessage({ data: { success: true, compacted: true, key: data.key } });
          }
        }, 10);
      }
      terminate() {}
    }

    vi.stubGlobal("Worker", MockWorker);
    vi.stubGlobal("navigator", { onLine: false });

    const store = TodoList.create({ todos: [] });
    const manager = createPersistenceManager(store, {
      key: "todo-list-key",
      mutation: {
        syncFn: vi.fn(),
      },
    });

    await manager.initialize();

    // Add multiple modifications
    store.addTodo("1", "Worker Task 1");
    await sleep(20);
    store.addTodo("2", "Worker Task 2");
    await sleep(20);

    const queueStore = dbMock.stores.get("sync_queue")!;
    expect(queueStore.size).toBe(2);

    // Compact using the mock worker
    await manager.compact();

    // Verify consolidated queue of size 1
    expect(queueStore.size).toBe(1);
    const compactedItem = Array.from(queueStore.values())[0] as any;
    expect(compactedItem.patches[0].op).toBe("replace");
    expect(compactedItem.patches[0].path).toBe("");

    vi.unstubAllGlobals();
  });

  test("should automatically run compaction when pending queue exceeds maxQueueSize", async () => {
    // Disable Worker to test fallback auto-compaction path easily
    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("navigator", { onLine: false });

    const store = TodoList.create({ todos: [] });
    const manager = createPersistenceManager(store, {
      key: "todo-list-key",
      maxQueueSize: 2, // Set a low threshold of 2 items
      mutation: {
        syncFn: vi.fn(),
      },
    });

    await manager.initialize();

    const queueStore = dbMock.stores.get("sync_queue")!;

    // Perform 3 distinct modifications (each exceeding the batch tick to create separate queue items)
    store.addTodo("1", "Auto Task 1");
    await sleep(20);
    store.addTodo("2", "Auto Task 2");
    await sleep(20);

    // Currently 2 items in queue (exactly maxQueueSize, no compaction yet)
    expect(queueStore.size).toBe(2);

    // Third modification exceeds threshold of 2, triggers auto-compaction
    store.addTodo("3", "Auto Task 3");
    await sleep(20);

    // Queue size should be compacted down to 1
    expect(queueStore.size).toBe(1);
    const compactedItem = Array.from(queueStore.values())[0] as any;
    expect(compactedItem.patches[0].op).toBe("replace");
    expect(compactedItem.patches[0].value.todos.length).toBe(3);

    vi.unstubAllGlobals();
  });
});
