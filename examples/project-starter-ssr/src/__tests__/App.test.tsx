import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import { createStoreContext } from 'jotai-state-tree/react';
import { createAppStore, IRootStore } from '../models/RootStore';
import { addTaskAction, toggleTaskAction } from '../App';

const { Provider } = createStoreContext<IRootStore>();

describe('SSR Server Actions Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  test('executes Server Action and applies returned state patches to client tree', async () => {
    const store = createAppStore();
    
    // Check initial state
    expect(store.tasks.items.length).toBe(5); // starter-ssr has 5 initial store tasks
    
    // Mock the fetch call to simulate the server action executing and returning state patches
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { success: true },
        patches: [
          {
            op: 'add',
            path: '/tasks/items/3',
            value: {
              id: 't-new',
              text: 'Write SSR Tests',
              completed: false,
              category: 'QA',
              createdAt: new Date().toISOString()
            }
          }
        ]
      })
    } as any);

    // Call the server action
    const result = await addTaskAction(store, { title: 'Write SSR Tests', category: 'QA' });
    
    expect(result).toEqual({ success: true });
    
    // Assert fetch call details
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/_jst_action');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
    });
    
    const body = JSON.parse(options.body as string);
    expect(body.actionName).toBe('addTask');
    expect(body.args).toEqual({ title: 'Write SSR Tests', category: 'QA' });
    expect(body.clientSnapshot).toBeDefined();

    // Assert that the client tree automatically applied the server patches
    expect(store.tasks.items.length).toBe(6);
    expect(store.tasks.items[3].id).toBe('t-new');
    expect(store.tasks.items[3].text).toBe('Write SSR Tests');
    expect(store.tasks.items[3].completed).toBe(false);
    expect(store.tasks.items[3].category).toBe('QA');
  });

  test('executes toggleTask Server Action and applies patch', async () => {
    const store = createAppStore();
    const taskToToggle = store.tasks.items[0]; // t1 is completed: true
    
    expect(taskToToggle.completed).toBe(true);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { success: true },
        patches: [
          {
            op: 'replace',
            path: `/tasks/items/0/completed`,
            value: false
          }
        ]
      })
    } as any);

    await toggleTaskAction(store, { id: taskToToggle.id });

    // Assert completed status is now false
    expect(taskToToggle.completed).toBe(false);
  });
});
