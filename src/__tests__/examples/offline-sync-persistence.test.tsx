/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearAllRegistries, resetGlobalStore } from '../../index';
import { App } from '../../../examples/offline-sync-persistence/src/App';

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

// ============================================================================
// Setup / Teardown
// ============================================================================

beforeEach(() => {
  setupIndexedDBMock();
  clearAllRegistries();
  resetGlobalStore();
  // Mock window.alert to prevent blocking dialogs in tests
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
  restoreIndexedDB();
  vi.restoreAllMocks();
});

// ============================================================================
// Test Suite
// ============================================================================

describe('Resilient Task Hub Example App', () => {
  it('should load initial data, support task addition/completion/deletion, offline queueing, and automatic rollback', async () => {
    const user = userEvent.setup();

    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // 1. Initial Seeding Verification
    // Wait for the revalidation query to run and fetch from serverDatabase seed
    expect(await screen.findByDisplayValue('Explore jotai-state-tree persistence')).toBeDefined();
    expect(screen.getByDisplayValue('Simulate network latency or offline mode')).toBeDefined();
    expect(screen.getByDisplayValue('Trigger a server validation error to test rollback')).toBeDefined();

    // Verify initial checkboxes
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.length).toBe(3);
    expect(checkboxes[0].checked).toBe(true); // "Explore jotai-state-tree persistence" completed: true
    expect(checkboxes[1].checked).toBe(false);
    expect(checkboxes[2].checked).toBe(false);

    // Verify sync status is synchronized, pending count is 0
    expect(screen.getByText('0 operations')).toBeDefined();
    expect(screen.getByText('Synchronized')).toBeDefined();

    // 2. Add Task (Online)
    const taskInput = screen.getByPlaceholderText(/Add a new task/);
    const addTaskButton = screen.getByRole('button', { name: 'Add Task' });

    await user.type(taskInput, 'Write example tests');
    await user.click(addTaskButton);

    // Verify task is added to UI immediately (optimistic UI)
    expect(screen.getByDisplayValue('Write example tests')).toBeDefined();

    // Wait for the network mock latency and check that sync is complete
    await waitFor(() => {
      expect(screen.getByText('0 operations')).toBeDefined();
    });

    // 3. Toggle Task (Online)
    const updatedCheckboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    const targetCheckbox = updatedCheckboxes[3]; // the new "Write example tests" todo
    expect(targetCheckbox.checked).toBe(false);

    await user.click(targetCheckbox);
    expect(targetCheckbox.checked).toBe(true);

    // Wait for sync to resolve
    await waitFor(() => {
      expect(screen.getByText('0 operations')).toBeDefined();
    });

    // 4. Simulate Offline Queueing
    const offlineButton = screen.getByRole('button', { name: /OFFLINE/ });
    await user.click(offlineButton);

    // Confirm UI reflects offline state
    expect(screen.getByText('Offline')).toBeDefined();

    // Add another task while offline
    await user.type(taskInput, 'Offline task test');
    await user.click(addTaskButton);

    // Task should display immediately (optimistic UI)
    expect(screen.getByDisplayValue('Offline task test')).toBeDefined();

    // Verify mutation is queued: pending operation count should be 1
    await waitFor(() => {
      expect(screen.getByText('1 operations')).toBeDefined();
    });

    // Toggle another task while offline
    const finalCheckboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    await user.click(finalCheckboxes[1]); // Toggle "Simulate network latency..."

    // Pending operations count should now be 2
    await waitFor(() => {
      expect(screen.getByText('2 operations')).toBeDefined();
    });

    // 5. Restore Connection & Sync
    const onlineButton = screen.getByRole('button', { name: /ONLINE/ });
    await user.click(onlineButton);

    // Wait for queue flush to finish
    await waitFor(() => {
      expect(screen.getByText('0 operations')).toBeDefined();
      expect(screen.getByText('Synchronized')).toBeDefined();
    }, { timeout: 3000 });

    // 6. Test Safe Rollback on Validation Error
    // Type a task title containing a forbidden word to trigger mock API rejection
    await user.type(taskInput, 'This contains forbidden text');
    await user.click(addTaskButton);

    // Optimistically added
    expect(screen.getByDisplayValue('This contains forbidden text')).toBeDefined();

    // The mock server should reject it, triggering a rollback
    // Verify that the task is removed from the UI
    await waitFor(() => {
      expect(screen.queryByDisplayValue('This contains forbidden text')).toBeNull();
    }, { timeout: 3000 });

    // Verify window.alert was triggered
    expect(window.alert).toHaveBeenCalled();

    // 7. Delete Task
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    const initialTaskCount = deleteButtons.length;

    await user.click(deleteButtons[0]);

    // Verify one task is removed
    await waitFor(() => {
      const remainingDeleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      expect(remainingDeleteButtons.length).toBe(initialTaskCount - 1);
    });
  });
});
