---
name: testing-guide
description: |
  Instructions and examples for testing jotai-state-tree models, actions, views, patches, and observer components.
---

# Testing Guide

Use this skill when writing unit and integration tests for state models and React components.

---

## 1. Testing Models

Testing `jotai-state-tree` models is straightforward. You instantiate a store instance using `Model.create()`, call actions, and assert the state changes.

```typescript
import { expect, test, describe } from 'vitest';
import { TaskStore } from './TaskStore';

describe('TaskStore Model', () => {
  test('adds and toggles tasks', () => {
    const store = TaskStore.create({
      items: [],
      filter: 'All',
    });

    expect(store.items.length).toBe(0);

    // Call actions
    store.addTask('Buy groceries');
    expect(store.items.length).toBe(1);
    expect(store.items[0].text).toBe('Buy groceries');
    expect(store.items[0].completed).toBe(false);

    // Toggle completion
    store.items[0].toggle();
    expect(store.items[0].completed).toBe(true);

    // Computed views
    expect(store.completedCount).toBe(1);
  });
});
```

---

## 2. Testing Patches & Undo History

You can test that state history is tracked correctly using undo/redo managers.

```typescript
import { expect, test, describe } from 'vitest';
import { createUndoManager } from 'jotai-state-tree';
import { TaskStore } from './TaskStore';

describe('Undo History', () => {
  test('can undo and redo task additions', () => {
    const store = TaskStore.create({ items: [] });
    const undoManager = createUndoManager(store);

    store.addTask('Laundry');
    expect(store.items.length).toBe(1);

    // Undo the action
    undoManager.undo();
    expect(store.items.length).toBe(0);

    // Redo the action
    undoManager.redo();
    expect(store.items.length).toBe(1);
  });
});
```

---

## 3. Testing React Components

When testing React components that connect to the state tree, wrap the rendering context inside the store provider. Ensure that component observers trigger updates correctly.

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { observer } from 'jotai-state-tree/react';
import { TaskStore } from '../models/TaskStore';
import { StoreContext } from '../App';

// Simple observer component
const TodoList = observer(() => {
  const store = React.useContext(StoreContext);
  return (
    <div>
      <h1 data-testid="count">Count: {store.completedCount}</h1>
      <button onClick={() => store.addTask('New Todo')}>Add</button>
    </div>
  );
});

describe('TodoList Component', () => {
  test('updates UI when store changes', () => {
    const store = TaskStore.create({ items: [] });

    render(
      <StoreContext.Provider value={store}>
        <TodoList />
      </StoreContext.Provider>
    );

    expect(screen.getByTestId('count').textContent).toBe('Count: 0');

    // Click button to add todo
    fireEvent.click(screen.getByText('Add'));

    // Assert that the observer component re-rendered with new state
    expect(screen.getByTestId('count').textContent).toBe('Count: 0'); // (or 1 depending on completion status)
  });
});
```

---

## 4. Testing Routing Guards

Test that navigation guards block routes or redirect to authentication screens appropriately.

```typescript
import { expect, test, describe } from 'vitest';
import { createAppStore } from './RootStore';

describe('Routing Guards', () => {
  test('redirects to login when unauthenticated page is accessed', () => {
    const { store, router } = createAppStore({ isAuthenticated: false });

    // Try to navigate to protected settings
    router.push('/settings');

    // Assert redirect occurred
    expect(router.pathname).toBe('/login');
    expect(router.query.redirect).toBe(encodeURIComponent('/settings'));
  });
});
```
