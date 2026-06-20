---
name: testing-guide
description: |
  Instructions and examples for testing jotai-state-tree models, actions, views, patches, and observer components.
---

# Testing Guide (Client SPA)

Use this skill when writing unit and integration tests for state models and React components.

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

## 2. Testing Models

To test models, instantiate a store using `Model.create()`, call actions, and assert state changes or view output.

```typescript
import { expect, test, describe } from 'vitest';
import { TaskStore } from '../models/TaskStore';

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

    // Assert computed views
    expect(store.completedCount).toBe(1);
  });
});
```

---

## 3. Testing React Components

When testing React components, wrap them in the store provider and verify they reactively update on store state changes.

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { observer, createStoreContext } from 'jotai-state-tree/react';
import { TaskStore } from '../models/TaskStore';

const { Provider, useStore } = createStoreContext<any>();

const TodoList = observer(() => {
  const store = useStore();
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
      <Provider store={store}>
        <TodoList />
      </Provider>
    );

    expect(screen.getByTestId('count').textContent).toBe('Count: 0');

    // Click button to add todo
    fireEvent.click(screen.getByText('Add'));

    // Assert that the observer component re-rendered with new state
    // Note: Since new tasks are active by default, completedCount is still 0
    expect(screen.getByTestId('count').textContent).toBe('Count: 0');
  });
});
```

---

## 4. Testing Routing Guards

Verify navigation guards block routes or redirect to authentication screens appropriately.

```typescript
import { expect, test, describe } from 'vitest';
import { createAppStore } from '../models/RootStore';
import { configureRouter } from '../routes/router';

describe('Routing Guards', () => {
  test('redirects to login when unauthenticated page is accessed', () => {
    const store = createAppStore({ isAuthenticated: false });
    const router = configureRouter(store, '/tasks');

    // Assert router automatically redirected to login with redirect param
    expect(router.pathname).toBe('/login');
    expect(router.query.redirect).toBe('/tasks');
  });
});
```

---

## 5. Feature Testing Recipe

When creating a test file for a new feature, follow this checklist:
1. **Create the test file**: Put the file in `src/__tests__/MyFeature.test.ts` (or `.tsx`).
2. **Write model unit tests**: Test the new model's initial state, actions, and computed views.
3. **Write component integration tests**: Render the React component, wrap it in `<Provider store={store}>`, trigger events using `fireEvent`, and assert the UI updates.
4. **Run and verify**: Run `npm run test` to verify all assertions pass.
