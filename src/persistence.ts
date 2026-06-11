import { atom, type WritableAtom } from "jotai";
import type { IDisposer, IJsonPatch, IReversibleJsonPatch } from "./types";
import {
  getSnapshot,
  applySnapshot,
  onPatch,
  getStateTreeNode,
  getGlobalStore,
  applyPatch,
} from "./tree";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface PersistenceStatus {
  isLoading: boolean;
  isFetching: boolean;
  isSyncing: boolean;
  isOffline: boolean;
  pendingSyncCount: number;
  error: Error | null;
}

export interface QueryOptions {
  /** Unique key for query caching/revalidation */
  queryKey: string;
  /** Fetcher function to retrieve remote data */
  queryFn: () => Promise<unknown> | unknown;
  /** Stale time in milliseconds before cache is considered stale (default: 0) */
  staleTime?: number;
  /** Automatically refetch on window focus (default: false) */
  refetchOnWindowFocus?: boolean;
  /** Automatically refetch on reconnect (default: true) */
  refetchOnReconnect?: boolean;
}

export interface MutationOptions {
  /** Function to sync local changes to the API/database */
  syncFn: (snapshot: any, patches: IJsonPatch[]) => Promise<any> | any;
  /** Optional function to determine if a sync error should trigger rollback */
  shouldRollback?: (error: any) => boolean;
  /** Success callback */
  onSuccess?: (data: any) => void;
  /** Error callback */
  onError?: (error: any) => void;
}

export interface PersistenceOptions {
  /** IndexedDB database name (default: 'jotai-state-tree-persistence') */
  dbName?: string;
  /** Key under which the snapshot is stored (defaults to model identifier or 'root') */
  key?: string;
  /** Query configuration for Tanstack Query style revalidation */
  query?: QueryOptions;
  /** Mutation configuration for optimistic UI and sync */
  mutation?: MutationOptions;
  /** Max queue size before compaction is automatically run (default: 20) */
  maxQueueSize?: number;
}

export interface QueuedMutation {
  id?: number;
  key: string;
  patches: IJsonPatch[];
  inversePatches: IReversibleJsonPatch[];
  timestamp: number;
}

// ============================================================================
// Web Worker Inline Code String
// ============================================================================

const workerCode = `
self.onmessage = function(e) {
  const { key, dbName, currentSnapshot } = e.data;
  
  function applyPatch(obj, patch) {
    if (patch.path === "" || patch.path === "/") {
      if (patch.op === "replace") {
        return JSON.parse(JSON.stringify(patch.value));
      }
      return obj;
    }
    
    const parts = patch.path.split("/").filter(Boolean);
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const index = isNaN(part) ? part : Number(part);
      if (current === undefined || current === null) return obj;
      current = current[index];
    }
    if (current === undefined || current === null) return obj;
    
    const lastPart = parts[parts.length - 1];
    const lastKey = isNaN(lastPart) ? lastPart : Number(lastPart);

    if (patch.op === "replace" || patch.op === "add") {
      const val = patch.value !== undefined ? JSON.parse(JSON.stringify(patch.value)) : undefined;
      if (patch.op === "replace") {
        current[lastKey] = val;
      } else {
        if (Array.isArray(current)) {
          current.splice(lastKey, 0, val);
        } else {
          current[lastKey] = val;
        }
      }
    } else if (patch.op === "remove") {
      if (Array.isArray(current)) {
        current.splice(lastKey, 1);
      } else {
        delete current[lastKey];
      }
    }
    return obj;
  }

  const request = indexedDB.open(dbName, 1);
  request.onerror = function() {
    self.postMessage({ error: "Failed to open IndexedDB in worker" });
  };
  request.onsuccess = function() {
    const db = request.result;
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const getReq = store.getAll();
    
    getReq.onerror = function() {
      db.close();
      self.postMessage({ error: "Failed to get queue from store in worker" });
    };
    
    getReq.onsuccess = function() {
      const allItems = getReq.result || [];
      const queue = allItems.filter(item => item.key === key);
      
      if (queue.length <= 1) {
        db.close();
        self.postMessage({ success: true, key, compacted: false });
        return;
      }
      
      // Reconstruct initial snapshot by applying inverse patches in reverse order
      let initialSnapshot = JSON.parse(JSON.stringify(currentSnapshot));
      for (let i = queue.length - 1; i >= 0; i--) {
        const item = queue[i];
        for (let j = item.inversePatches.length - 1; j >= 0; j--) {
          initialSnapshot = applyPatch(initialSnapshot, item.inversePatches[j]);
        }
      }
      
      // Delete old queue items
      let deleteCount = 0;
      let hasError = false;
      
      function checkDone() {
        if (hasError) return;
        if (deleteCount === queue.length) {
          // Add consolidated item
          const addReq = store.add({
            key: key,
            patches: [{ op: "replace", path: "", value: currentSnapshot }],
            inversePatches: [{ op: "replace", path: "", value: initialSnapshot }],
            timestamp: Date.now()
          });
          
          addReq.onerror = function() {
            db.close();
            self.postMessage({ error: "Failed to add consolidated mutation in worker" });
          };
          addReq.onsuccess = function() {
            db.close();
            self.postMessage({ success: true, key, compacted: true });
          };
        }
      }
      
      for (const item of queue) {
        if (item.id !== undefined) {
          const delReq = store.delete(item.id);
          delReq.onerror = function() {
            hasError = true;
            db.close();
            self.postMessage({ error: "Failed to delete queue item in worker" });
          };
          delReq.onsuccess = function() {
            deleteCount++;
            checkDone();
          };
        }
      }
    };
  };
};
`;

// ============================================================================
// Storage Class
// ============================================================================

interface IStorage {
  getSnapshot(key: string): Promise<any>;
  setSnapshot(key: string, value: any): Promise<void>;
  clearSnapshots(): Promise<void>;
  getQueue(key: string): Promise<QueuedMutation[]>;
  addQueue(item: Omit<QueuedMutation, "id">): Promise<number>;
  deleteQueue(id: number): Promise<void>;
  clearQueue(key: string): Promise<void>;
}

class IndexedDBStorage implements IStorage {
  private db: IDBDatabase | null = null;
  private dbName: string;

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  async init(): Promise<void> {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(
          new Error(
            "[jotai-state-tree] IndexedDB is not supported in this environment.",
          ),
        );
        return;
      }
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("snapshots")) {
          db.createObjectStore("snapshots");
        }
        if (!db.objectStoreNames.contains("sync_queue")) {
          db.createObjectStore("sync_queue", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getSnapshot(key: string): Promise<any> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("snapshots", "readonly");
      const store = tx.objectStore("snapshots");
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async setSnapshot(key: string, value: any): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("snapshots", "readwrite");
      const store = tx.objectStore("snapshots");
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearSnapshots(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("snapshots", "readwrite");
      const store = tx.objectStore("snapshots");
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getQueue(key: string): Promise<QueuedMutation[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("sync_queue", "readonly");
      const store = tx.objectStore("sync_queue");
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result as QueuedMutation[]).filter(
          (item) => item.key === key,
        );
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async addQueue(item: Omit<QueuedMutation, "id">): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("sync_queue", "readwrite");
      const store = tx.objectStore("sync_queue");
      const req = store.add(item);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteQueue(id: number): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("sync_queue", "readwrite");
      const store = tx.objectStore("sync_queue");
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearQueue(key: string): Promise<void> {
    await this.init();
    const items = await this.getQueue(key);
    if (items.length === 0) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction("sync_queue", "readwrite");
      const store = tx.objectStore("sync_queue");
      let completed = 0;
      let hasError = false;
      for (const item of items) {
        if (item.id !== undefined) {
          const req = store.delete(item.id);
          req.onsuccess = () => {
            completed++;
            if (completed === items.length && !hasError) {
              resolve();
            }
          };
          req.onerror = () => {
            hasError = true;
            reject(req.error);
          };
        }
      }
    });
  }
}

// Default error rollback checker
function defaultShouldRollback(error: any): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false; // Offline - do not rollback, queue for retry
  }
  const errMsg = String(error.message || error).toLowerCase();
  if (
    errMsg.includes("network") ||
    errMsg.includes("fetch") ||
    errMsg.includes("timeout") ||
    errMsg.includes("abort") ||
    errMsg.includes("failed to fetch")
  ) {
    return false; // Network error - keep in queue
  }
  return true; // Server error (like validation / 4xx) - rollback
}

// ============================================================================
// Persistence Manager Class
// ============================================================================

export const activePersistenceManagers = new WeakMap<any, PersistenceManager>();

export class PersistenceManager {
  readonly target: any;
  readonly options: PersistenceOptions;
  readonly statusAtom: WritableAtom<
    PersistenceStatus,
    [
      (
        | PersistenceStatus
        | ((prev: PersistenceStatus) => PersistenceStatus)
      ),
    ],
    void
  >;

  private key: string = "root";
  private storage: IStorage;
  private patchDisposer: IDisposer | null = null;
  private skipSyncing: boolean = false;
  private lastFetchedTime: number = 0;
  private fetchTimeout: any = null;

  // Optimistic & High-Performance Batching State
  private pendingPatches: IJsonPatch[] = [];
  private pendingInversePatches: IReversibleJsonPatch[] = [];
  private batchScheduled: boolean = false;
  private debounceSnapshotTimeout: any = null;
  private lastSnapshotToWrite: any = null;

  // Window Focus and Reconnect Listeners
  private focusListener: (() => void) | null = null;
  private onlineListener: (() => void) | null = null;
  private offlineListener: (() => void) | null = null;

  constructor(target: any, options: PersistenceOptions = {}) {
    this.target = target;
    this.options = options;
    activePersistenceManagers.set(target, this);

    if (typeof indexedDB === "undefined") {
      throw new Error(
        "[jotai-state-tree] IndexedDB is not supported in this environment.",
      );
    }

    // Resolve storage key
    if (options.key) {
      this.key = options.key;
    } else {
      const node = getStateTreeNode(target);
      const idAttribute = node.$type.identifierAttribute;
      if (idAttribute) {
        const idValue = target[idAttribute];
        if (idValue !== undefined && idValue !== null) {
          this.key = String(idValue);
        }
      }
    }

    const dbName = options.dbName ?? "jotai-state-tree-persistence";
    this.storage = new IndexedDBStorage(dbName);

    // Initialize Jotai Atom representing status
    const initialOffline =
      typeof navigator !== "undefined" ? !navigator.onLine : false;
    this.statusAtom = atom<PersistenceStatus>({
      isLoading: true,
      isFetching: false,
      isSyncing: false,
      isOffline: initialOffline,
      pendingSyncCount: 0,
      error: null,
    });
  }

  async initialize(): Promise<void> {
    const store = getGlobalStore();

    // Errors here will bubble up loudly
    const cachedSnapshot = await this.storage.getSnapshot(this.key);
    let queue = await this.storage.getQueue(this.key);

    if (cachedSnapshot !== undefined && cachedSnapshot !== null) {
      this.skipSyncing = true;
      try {
        applySnapshot(this.target, cachedSnapshot);
      } finally {
        this.skipSyncing = false;
      }
      store.set(this.statusAtom, (prev) => ({
        ...prev,
        isLoading: false,
      }));
    } else {
      // No cache available, will load on fetch
      store.set(this.statusAtom, (prev) => ({
        ...prev,
        isLoading: !!this.options.query?.queryFn,
      }));
    }

    // Run initial compaction if queue exceeds threshold
    const maxQueueSize = this.options.maxQueueSize ?? 20;
    if (queue.length > maxQueueSize) {
      try {
        await this.compact();
        queue = await this.storage.getQueue(this.key);
      } catch (err) {
        console.warn("[jotai-state-tree] Initial compaction failed:", err);
      }
    }

    // Check current sync queue length
    store.set(this.statusAtom, (prev) => ({
      ...prev,
      pendingSyncCount: queue.length,
    }));

    // Start listening to patches for optimistic sync
    if (this.patchDisposer) {
      this.patchDisposer();
    }
    this.patchDisposer = onPatch(this.target, (patch, reversePatch) => {
      this.handlePatch(patch, reversePatch);
    });

    // Set up network listeners
    if (typeof window !== "undefined") {
      this.onlineListener = () => {
        store.set(this.statusAtom, (prev) => ({ ...prev, isOffline: false }));
        this.sync();
        if (this.options.query?.refetchOnReconnect !== false) {
          this.fetch();
        }
      };

      this.offlineListener = () => {
        store.set(this.statusAtom, (prev) => ({ ...prev, isOffline: true }));
      };

      window.addEventListener("online", this.onlineListener);
      window.addEventListener("offline", this.offlineListener);

      // Focus Listener (refetch on window focus)
      if (this.options.query?.refetchOnWindowFocus) {
        this.focusListener = () => {
          this.fetch();
        };
        window.addEventListener("focus", this.focusListener);
      }
    }

    // Initial Fetch / background sync revalidation (non-blocking)
    if (this.options.query?.queryFn) {
      this.fetchTimeout = setTimeout(() => this.fetch(), 0);
    }

    // If there are pending items, flush queue
    if (queue.length > 0) {
      await this.sync();
    }
  }

  async fetch(force: boolean = false): Promise<void> {
    const query = this.options.query;
    if (!query?.queryFn) return;

    const store = getGlobalStore();
    const status = store.get(this.statusAtom);

    // Skip if already fetching
    if (status.isFetching) return;

    // Check staleTime
    if (!force && query.staleTime !== undefined) {
      const now = Date.now();
      if (now - this.lastFetchedTime < query.staleTime) {
        return;
      }
    }

    store.set(this.statusAtom, (prev) => ({
      ...prev,
      isFetching: true,
    }));

    try {
      const data = await query.queryFn();
      if (data !== undefined && data !== null) {
        this.skipSyncing = true;
        try {
          applySnapshot(this.target, data);
        } finally {
          this.skipSyncing = false;
        }
        this.lastSnapshotToWrite = data;
        await this.storage.setSnapshot(this.key, data);
      }

      this.lastFetchedTime = Date.now();
      store.set(this.statusAtom, (prev) => ({
        ...prev,
        isFetching: false,
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      store.set(this.statusAtom, (prev) => ({
        ...prev,
        isFetching: false,
        isLoading: false,
        error,
      }));
      throw error;
    }
  }

  private handlePatch(
    patch: IJsonPatch,
    reversePatch: IReversibleJsonPatch,
  ): void {
    if (this.skipSyncing) return;

    this.pendingPatches.push(patch);
    this.pendingInversePatches.push(reversePatch);

    // Schedule batch execution on microtask to collapse rapid updates into one transaction
    if (!this.batchScheduled) {
      this.batchScheduled = true;
      Promise.resolve().then(() => {
        this.flushBatch();
      });
    }
  }

  private async flushBatch(): Promise<void> {
    this.batchScheduled = false;
    const patches = [...this.pendingPatches];
    const inversePatches = [...this.pendingInversePatches];
    this.pendingPatches = [];
    this.pendingInversePatches = [];

    if (patches.length === 0) return;

    const currentSnapshot = getSnapshot(this.target);
    this.lastSnapshotToWrite = currentSnapshot;

    // 1. Debounce the snapshot write to avoid disk thrashing on rapid input (150ms)
    if (this.debounceSnapshotTimeout) {
      clearTimeout(this.debounceSnapshotTimeout);
    }
    this.debounceSnapshotTimeout = setTimeout(async () => {
      if (this.lastSnapshotToWrite) {
        await this.storage.setSnapshot(this.key, this.lastSnapshotToWrite);
      }
    }, 150);

    // 2. Queue mutation if syncFn is configured
    if (this.options.mutation?.syncFn) {
      await this.storage.addQueue({
        key: this.key,
        patches,
        inversePatches,
        timestamp: Date.now(),
      });

      const store = getGlobalStore();
      let queue = await this.storage.getQueue(this.key);

      // Auto-compact queue if it exceeds maxQueueSize
      const maxQueueSize = this.options.maxQueueSize ?? 20;
      if (queue.length > maxQueueSize) {
        try {
          await this.compact();
          queue = await this.storage.getQueue(this.key);
        } catch (err) {
          console.warn("[jotai-state-tree] Auto-compaction failed:", err);
        }
      }

      store.set(this.statusAtom, (prev) => ({
        ...prev,
        pendingSyncCount: queue.length,
      }));

      // Trigger queue processing (errors are handled by mutation.onError)
      try {
        await this.sync();
      } catch (err) {
        // Ignored here to prevent unhandled rejections during automatic sync
      }
    }
  }

  /**
   * Compacts the queue by squashing multiple mutations into a single root replacement patch.
   * Runs in a background Web Worker if supported, falling back to main-thread execution.
   */
  async compact(): Promise<void> {
    const store = getGlobalStore();
    const currentSnapshot = getSnapshot(this.target);
    const dbName = this.options.dbName ?? "jotai-state-tree-persistence";

    const isWorkerSupported =
      typeof Worker !== "undefined" &&
      typeof Blob !== "undefined" &&
      typeof URL !== "undefined";

    if (isWorkerSupported) {
      return new Promise((resolve, reject) => {
        try {
          const blob = new Blob([workerCode], {
            type: "application/javascript",
          });
          const workerUrl = URL.createObjectURL(blob);
          const worker = new Worker(workerUrl);

          worker.onmessage = async (e) => {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);

            if (e.data.error) {
              reject(new Error(e.data.error));
            } else {
              const queue = await this.storage.getQueue(this.key);
              store.set(this.statusAtom, (prev) => ({
                ...prev,
                pendingSyncCount: queue.length,
              }));
              resolve();
            }
          };

          worker.onerror = (err) => {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            reject(err);
          };

          worker.postMessage({
            key: this.key,
            dbName,
            currentSnapshot,
          });
        } catch (err) {
          reject(err);
        }
      });
    } else {
      // Main-thread fallback compaction
      const queue = await this.storage.getQueue(this.key);
      if (queue.length <= 1) return;

      // Reconstruct initial snapshot by applying inverse patches in reverse order
      this.skipSyncing = true;
      try {
        for (let i = queue.length - 1; i >= 0; i--) {
          const item = queue[i];
          for (let j = item.inversePatches.length - 1; j >= 0; j--) {
            applyPatch(this.target, item.inversePatches[j]);
          }
        }
      } finally {
        this.skipSyncing = false;
      }

      const initialSnapshot = getSnapshot(this.target);

      // Restore target to current snapshot
      this.skipSyncing = true;
      try {
        applySnapshot(this.target, currentSnapshot);
      } finally {
        this.skipSyncing = false;
      }

      // Clear old queue and write consolidated mutation
      await this.storage.clearQueue(this.key);
      await this.storage.addQueue({
        key: this.key,
        patches: [{ op: "replace", path: "", value: currentSnapshot }],
        inversePatches: [{ op: "replace", path: "", value: initialSnapshot }],
        timestamp: Date.now(),
      });

      const newQueue = await this.storage.getQueue(this.key);
      store.set(this.statusAtom, (prev) => ({
        ...prev,
        pendingSyncCount: newQueue.length,
      }));
    }
  }

  async sync(): Promise<void> {
    const mutation = this.options.mutation;
    if (!mutation?.syncFn) return;

    const store = getGlobalStore();
    const status = store.get(this.statusAtom);

    // Skip if already syncing or offline
    if (status.isSyncing || status.isOffline) return;

    store.set(this.statusAtom, (prev) => ({ ...prev, isSyncing: true }));

    try {
      let queue = await this.storage.getQueue(this.key);

      while (queue.length > 0) {
        // Double check network state
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          store.set(this.statusAtom, (prev) => ({ ...prev, isOffline: true }));
          break;
        }

        const item = queue[0];
        try {
          const currentSnapshot = getSnapshot(this.target);
          const syncResult = await mutation.syncFn(
            currentSnapshot,
            item.patches,
          );

          // Remove mutation from queue on success
          if (item.id !== undefined) {
            await this.storage.deleteQueue(item.id);
          }

          if (mutation.onSuccess) {
            mutation.onSuccess(syncResult);
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          const shouldRollback =
            mutation.shouldRollback ?? defaultShouldRollback;

          if (shouldRollback(error)) {
            // Server error / validation error: Apply rollback using inverse patches
            this.skipSyncing = true;
            try {
              // Rollback in reverse order
              for (let i = item.inversePatches.length - 1; i >= 0; i--) {
                applyPatch(this.target, item.inversePatches[i]);
              }
              // Save rolled-back snapshot to local cache
              const currentSnapshot = getSnapshot(this.target);
              this.lastSnapshotToWrite = currentSnapshot;
              await this.storage.setSnapshot(this.key, currentSnapshot);
            } finally {
              this.skipSyncing = false;
            }

            // Remove failed mutation from queue since it was rolled back
            if (item.id !== undefined) {
              await this.storage.deleteQueue(item.id);
            }

            if (mutation.onError) {
              mutation.onError(error);
            }
            throw error; // Raise error loudly
          } else {
            // Temporary network/timeout error: Keep in queue, set sync error and stop processing
            store.set(this.statusAtom, (prev) => ({ ...prev, error }));
            if (mutation.onError) {
              mutation.onError(error);
            }
            break;
          }
        }

        // Fetch remaining queue items
        queue = await this.storage.getQueue(this.key);
        store.set(this.statusAtom, (prev) => ({
          ...prev,
          pendingSyncCount: queue.length,
        }));
      }

      const finalQueue = await this.storage.getQueue(this.key);
      store.set(this.statusAtom, (prev) => ({
        ...prev,
        isSyncing: false,
        pendingSyncCount: finalQueue.length,
        error: finalQueue.length === 0 ? null : prev.error,
      }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      store.set(this.statusAtom, (prev) => ({
        ...prev,
        isSyncing: false,
        error,
      }));
      throw error;
    }
  }

  async clear(): Promise<void> {
    await this.storage.clearSnapshots();
    await this.storage.clearQueue(this.key);

    const store = getGlobalStore();
    store.set(this.statusAtom, (prev) => ({
      ...prev,
      pendingSyncCount: 0,
      error: null,
    }));
  }

  dispose(): void {
    activePersistenceManagers.delete(this.target);
    if (this.fetchTimeout) {
      clearTimeout(this.fetchTimeout);
      this.fetchTimeout = null;
    }

    if (this.debounceSnapshotTimeout) {
      clearTimeout(this.debounceSnapshotTimeout);
      this.debounceSnapshotTimeout = null;
    }

    if (this.patchDisposer) {
      this.patchDisposer();
      this.patchDisposer = null;
    }

    if (typeof window !== "undefined") {
      if (this.onlineListener) {
        window.removeEventListener("online", this.onlineListener);
        this.onlineListener = null;
      }
      if (this.offlineListener) {
        window.removeEventListener("offline", this.offlineListener);
        this.offlineListener = null;
      }
      if (this.focusListener) {
        window.removeEventListener("focus", this.focusListener);
        this.focusListener = null;
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPersistenceManager(
  target: any,
  options?: PersistenceOptions,
): PersistenceManager {
  return new PersistenceManager(target, options);
}
