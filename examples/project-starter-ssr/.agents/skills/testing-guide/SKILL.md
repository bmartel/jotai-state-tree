---
name: testing-guide
description: |
  Instructions and examples for testing jotai-state-tree models, actions, views, patches, and observer components.
---

# Testing Guide (Server-Side Rendered SSR)

Use this skill when writing unit and integration tests for state models and React components in the SSR starter.

---

## 1. Running Tests

The project is preconfigured with Vitest. Run the following commands to execute tests:
```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch
```

---

## 2. Testing Request-Isolated Models

To test model logic without side effects, instantiate a store using `Model.create()` inside test blocks.

```typescript
import { expect, test, describe } from 'vitest';
import { TaskStore } from '../models/TaskStore';

describe('TaskStore Model (SSR)', () => {
  test('adds and deletes tasks locally', () => {
    const store = TaskStore.create();
    
    store.addTask('Local SSR Task', 'QA');
    expect(store.items.length).toBe(1);
    expect(store.items[0].text).toBe('Local SSR Task');
    expect(store.items[0].category).toBe('QA');

    store.deleteTask(store.items[0].id);
    expect(store.items.length).toBe(0);
  });
});
```

---

## 3. Testing Server Actions & Hydration

When testing components that call `createServerAction`, you must mock the global `fetch` handler to simulate server responses (including JSON Patches representing mutations).

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, vi, describe, beforeEach } from 'vitest';
import { createStoreContext } from 'jotai-state-tree/react';
import { createAppStore } from '../models/RootStore';
import { useStore } from '../App'; // or context useStore
import { addTaskAction } from '../App';

const { Provider } = createStoreContext<any>();

// Mock component triggering Server Action
const AddTaskComponent = () => {
  const store = useStore();
  const handleAdd = async () => {
    // Calling the server action
    await addTaskAction(store, { title: 'Fetch Milk', category: 'Dev' });
  };
  return <button onClick={handleAdd}>Add Task via Server</button>;
};

describe('Server Actions Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  test('calls remote Server Action and applies returned JSON patches', async () => {
    const store = createAppStore();
    
    // Simulate server returning action result and mutations (patches)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { success: true },
        patches: [
          {
            op: 'add',
            path: '/tasks/items/0',
            value: { id: 'srv-1', text: 'Fetch Milk', completed: false, category: 'Dev', createdAt: new Date().toISOString() }
          }
        ]
      })
    } as any);

    render(
      <Provider store={store}>
        <AddTaskComponent />
      </Provider>
    );

    const button = screen.getByText('Add Task via Server');
    fireEvent.click(button);

    // Verify fetch endpoint called with snapshot and action name
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/_jst_action', expect.any(Object));
    });

    // Verify that the server action applied returned patches to client store
    expect(store.tasks.items.length).toBe(6); // 5 initial mock tasks + 1 new task
    expect(store.tasks.items[5].id).toBe('srv-1');
    expect(store.tasks.items[5].text).toBe('Fetch Milk');
  });
});
```

---

## 4. Testing Hydration Flow

Verify that the store hydrates correctly from window snapshots on startup:
```typescript
import { expect, test, describe } from 'vitest';
import { applySnapshot } from 'jotai-state-tree';
import { createAppStore } from '../models/RootStore';

describe('SSR Hydration Flow', () => {
  test('hydrates client store state from snapshot', () => {
    const store = createAppStore();
    const serverSnapshot = {
      theme: 'dark',
      persistenceEnabled: false,
      auth: { isAuthenticated: true, currentUser: { id: 'u1', name: 'Alice' } },
      tasks: { items: [], filter: 'All', searchQuery: '', categoryFilter: 'All' }
    };

    applySnapshot(store, serverSnapshot);

    expect(store.theme).toBe('dark');
    expect(store.auth.isAuthenticated).toBe(true);
    expect(store.tasks.items.length).toBe(0);
  });
});
```

---

## 5. SSR Feature Testing Recipe

When creating a test file for a new SSR feature, follow this checklist:
1. **Create the test file**: Put the file in `src/__tests__/MyFeature.test.tsx`.
2. **Write model unit tests**: Assert local store properties, actions, and views.
3. **Mock fetch**: Stub global `fetch` to return success results and patches.
4. **Render component & fire action**: Wrap with `<Provider store={store}>`, trigger the action, await completion, and assert that client state tree reflects patches returned by the server.
5. **Run tests**: Run `npm run test`.
