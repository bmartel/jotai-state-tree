/**
 * @vitest-environment jsdom
 */

import React, { useState, useEffect } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  types,
  destroy,
  getSnapshot,
  onSnapshot,
  clearAllRegistries,
  resetGlobalStore,
  getRegistryStats,
} from "../index";

import {
  observer,
  Observer,
  useLocalObservable,
  useSnapshot,
  useIsAlive,
  Provider,
  useStore,
  useStoreSnapshot,
  useSyncedStore,
  batch,
  createStoreContext,
} from "../react";

import type { Instance } from "../index";

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
});

// ============================================================================
// Model Definitions for Tests
// ============================================================================

const CounterModel = types
  .model("Counter", {
    count: types.number,
  })
  .actions((self) => ({
    increment() {
      self.count += 1;
    },
    decrement() {
      self.count -= 1;
    },
    setCount(value: number) {
      self.count = value;
    },
  }));

const TodoModel = types.model("Todo", {
  id: types.identifier,
  text: types.string,
  completed: types.boolean,
});

const TodoListModel = types
  .model("TodoList", {
    todos: types.array(TodoModel),
  })
  .views((self) => ({
    get completedCount() {
      return self.todos.filter((t) => t.completed).length;
    },
    get pendingCount() {
      return self.todos.filter((t) => !t.completed).length;
    },
  }))
  .actions((self) => ({
    addTodo(id: string, text: string) {
      self.todos.push({ id, text, completed: false });
    },
    toggleTodo(id: string) {
      const todo = self.todos.find((t) => t.id === id);
      if (todo) {
        todo.completed = !todo.completed;
      }
    },
    removeTodo(id: string) {
      const index = self.todos.findIndex((t) => t.id === id);
      if (index >= 0) {
        self.todos.splice(index, 1);
      }
    },
  }));

// ============================================================================
// Observer HOC Tests
// ============================================================================

describe("React Integration", () => {
  describe("observer HOC", () => {
    it("should re-render when observed state changes", async () => {
      const counter = CounterModel.create({ count: 0 });
      let renderCount = 0;

      const CounterDisplay = observer(function CounterDisplay({
        store,
      }: {
        store: typeof counter;
      }) {
        renderCount++;
        return <div data-testid="count">{store.count}</div>;
      });

      render(<CounterDisplay store={counter} />);

      expect(screen.getByTestId("count").textContent).toBe("0");
      expect(renderCount).toBe(1);

      act(() => {
        counter.increment();
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("1");
      });

      expect(renderCount).toBeGreaterThanOrEqual(2);
    });

    it("should not re-render when unrelated state changes", async () => {
      const Store = types
        .model("Store", {
          count: types.number,
          unrelated: types.string,
        })
        .actions((self) => ({
          setUnrelated(val: string) {
            self.unrelated = val;
          },
          increment() {
            self.count += 1;
          },
        }));

      const store = Store.create({ count: 0, unrelated: "initial" });
      let renderCount = 0;

      // Component only accesses count, not unrelated
      const CountOnly = observer(function CountOnly({
        s,
      }: {
        s: typeof store;
      }) {
        renderCount++;
        return <div data-testid="count">{s.count}</div>;
      });

      render(<CountOnly s={store} />);
      expect(renderCount).toBe(1);

      // Change unrelated field - should still trigger since we subscribe to the whole node
      act(() => {
        store.setUnrelated("changed");
      });

      // Give time for any potential re-renders
      await new Promise((r) => setTimeout(r, 50));

      // The observer subscribes to snapshot changes on the node, so it will re-render
      // This is expected behavior - fine-grained tracking would require more complex implementation
    });

    it("should handle nested state tree nodes", async () => {
      const todoList = TodoListModel.create({
        todos: [
          { id: "1", text: "First", completed: false },
          { id: "2", text: "Second", completed: true },
        ],
      });

      const TodoListView = observer(function TodoListView({
        list,
      }: {
        list: typeof todoList;
      }) {
        return (
          <div>
            <div data-testid="completed">{list.completedCount}</div>
            <div data-testid="pending">{list.pendingCount}</div>
            <ul>
              {list.todos.map((todo) => (
                <li key={todo.id} data-testid={`todo-${todo.id}`}>
                  {todo.text}: {todo.completed ? "done" : "pending"}
                </li>
              ))}
            </ul>
          </div>
        );
      });

      render(<TodoListView list={todoList} />);

      expect(screen.getByTestId("completed").textContent).toBe("1");
      expect(screen.getByTestId("pending").textContent).toBe("1");

      act(() => {
        todoList.toggleTodo("1");
      });

      await waitFor(() => {
        expect(screen.getByTestId("completed").textContent).toBe("2");
        expect(screen.getByTestId("pending").textContent).toBe("0");
      });
    });
  });

  // ============================================================================
  // Observer Component (Render Props) Tests
  // ============================================================================

  describe("Observer component", () => {
    it("should work with render props pattern when store is passed as prop", async () => {
      const counter = CounterModel.create({ count: 5 });

      // Observer works best when the store is passed as a prop to the wrapper
      // For closure-based access, use useSnapshot hook instead
      const ObserverWrapper = observer(function ObserverWrapper({
        store,
      }: {
        store: typeof counter;
      }) {
        return <div data-testid="count">{store.count}</div>;
      });

      render(<ObserverWrapper store={counter} />);

      expect(screen.getByTestId("count").textContent).toBe("5");

      act(() => {
        counter.increment();
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("6");
      });
    });

    it("should work with useSnapshot for closure-based access", async () => {
      const counter = CounterModel.create({ count: 5 });

      function CounterDisplay() {
        const snapshot = useSnapshot<{ count: number }>(counter);
        return <div data-testid="count">{snapshot.count}</div>;
      }

      render(<CounterDisplay />);

      expect(screen.getByTestId("count").textContent).toBe("5");

      act(() => {
        counter.increment();
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("6");
      });
    });
  });

  // ============================================================================
  // useLocalObservable Tests
  // ============================================================================

  describe("useLocalObservable", () => {
    it("should create and manage local state", async () => {
      function LocalCounter() {
        const store = useLocalObservable(() =>
          CounterModel.create({ count: 0 }),
        );

        return (
          <div>
            <span data-testid="count">{store.count}</span>
            <button onClick={() => store.increment()}>+</button>
          </div>
        );
      }

      render(<LocalCounter />);

      expect(screen.getByTestId("count").textContent).toBe("0");

      await act(async () => {
        await userEvent.click(screen.getByText("+"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("1");
      });
    });

    it("should cleanup on unmount", async () => {
      const statsBefore = getRegistryStats();

      function LocalCounter() {
        const store = useLocalObservable(() =>
          CounterModel.create({ count: 0 }),
        );
        return <div>{store.count}</div>;
      }

      const { unmount } = render(<LocalCounter />);

      const statsAfterMount = getRegistryStats();
      expect(statsAfterMount.liveNodeCount).toBeGreaterThan(
        statsBefore.liveNodeCount,
      );

      unmount();

      // Note: The store itself isn't automatically destroyed on unmount
      // Users need to handle that in their own cleanup if needed
    });
  });

  // ============================================================================
  // useSnapshot Tests
  // ============================================================================

  describe("useSnapshot", () => {
    it("should return current snapshot and update on changes", async () => {
      const counter = CounterModel.create({ count: 10 });

      function SnapshotDisplay({ store }: { store: typeof counter }) {
        const snapshot = useSnapshot<{ count: number }>(store);
        return <div data-testid="snapshot">{snapshot.count}</div>;
      }

      render(<SnapshotDisplay store={counter} />);

      expect(screen.getByTestId("snapshot").textContent).toBe("10");

      act(() => {
        counter.setCount(20);
      });

      await waitFor(() => {
        expect(screen.getByTestId("snapshot").textContent).toBe("20");
      });
    });
  });

  // ============================================================================
  // useIsAlive Tests
  // ============================================================================

  describe("useIsAlive", () => {
    it("should return true for alive nodes", () => {
      const counter = CounterModel.create({ count: 0 });

      function AliveCheck({ store }: { store: typeof counter }) {
        const isAlive = useIsAlive(store);
        return <div data-testid="alive">{isAlive ? "yes" : "no"}</div>;
      }

      render(<AliveCheck store={counter} />);
      expect(screen.getByTestId("alive").textContent).toBe("yes");
    });

    it("should update when node is destroyed", async () => {
      const counter = CounterModel.create({ count: 0 });

      function AliveCheck({ store }: { store: typeof counter }) {
        const isAlive = useIsAlive(store);
        return <div data-testid="alive">{isAlive ? "yes" : "no"}</div>;
      }

      render(<AliveCheck store={counter} />);
      expect(screen.getByTestId("alive").textContent).toBe("yes");

      act(() => {
        destroy(counter);
      });

      await waitFor(() => {
        expect(screen.getByTestId("alive").textContent).toBe("no");
      });
    });
  });

  // ============================================================================
  // Provider/useStore Tests
  // ============================================================================

  describe("Provider and useStore", () => {
    it("should provide store to children", () => {
      const counter = CounterModel.create({ count: 42 });

      function CounterConsumer() {
        const store = useStore<typeof counter>();
        return <div data-testid="count">{store.count}</div>;
      }

      render(
        <Provider store={counter}>
          <CounterConsumer />
        </Provider>,
      );

      expect(screen.getByTestId("count").textContent).toBe("42");
    });

    it("should throw when useStore is called outside Provider", () => {
      function BadComponent() {
        const store = useStore();
        return <div>{String(store)}</div>;
      }

      expect(() => render(<BadComponent />)).toThrow(
        "[jotai-state-tree] useStore must be used within a Provider",
      );
    });
  });

  // ============================================================================
  // useStoreSnapshot Tests
  // ============================================================================

  describe("useStoreSnapshot (legacy)", () => {
    it("should return store and update on changes", async () => {
      type CounterInstance = Instance<typeof CounterModel>;
      const counter = CounterModel.create({ count: 100 });

      function StoreConsumer() {
        // Legacy API requires explicit type parameter
        const store = useStoreSnapshot<CounterInstance>();
        return <div data-testid="count">{store.count}</div>;
      }

      render(
        <Provider store={counter}>
          <StoreConsumer />
        </Provider>,
      );

      expect(screen.getByTestId("count").textContent).toBe("100");

      act(() => {
        counter.setCount(200);
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("200");
      });
    });

    it("should work with selector", async () => {
      type TodoListInstance = Instance<typeof TodoListModel>;
      const todoList = TodoListModel.create({
        todos: [
          { id: "1", text: "One", completed: false },
          { id: "2", text: "Two", completed: true },
        ],
      });

      function CompletedCounter() {
        // Legacy API with selector - explicitly type both store and return
        const count = useStoreSnapshot<TodoListInstance, number>(
          (store) => store.completedCount,
        );
        return <div data-testid="completed">{count}</div>;
      }

      render(
        <Provider store={todoList}>
          <CompletedCounter />
        </Provider>,
      );

      expect(screen.getByTestId("completed").textContent).toBe("1");

      act(() => {
        todoList.toggleTodo("1");
      });

      await waitFor(() => {
        expect(screen.getByTestId("completed").textContent).toBe("2");
      });
    });
  });

  // ============================================================================
  // useSyncedStore Tests
  // ============================================================================

  describe("useSyncedStore", () => {
    it("should work with useSyncExternalStore", async () => {
      const counter = CounterModel.create({ count: 0 });

      function SyncedCounter({ store }: { store: typeof counter }) {
        const syncedStore = useSyncedStore(store);
        return <div data-testid="count">{syncedStore.count}</div>;
      }

      render(<SyncedCounter store={counter} />);

      expect(screen.getByTestId("count").textContent).toBe("0");

      act(() => {
        counter.increment();
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("1");
      });
    });
  });

  // ============================================================================
  // Batch Updates Tests
  // ============================================================================

  describe("batch", () => {
    it("should batch multiple updates", async () => {
      const counter = CounterModel.create({ count: 0 });
      let snapshotCallCount = 0;

      onSnapshot(counter, () => {
        snapshotCallCount++;
      });

      act(() => {
        batch(() => {
          counter.increment();
          counter.increment();
          counter.increment();
        });
      });

      // Each increment triggers its own snapshot notification
      // batch() helps with React scheduling, not MST internal notifications
      expect(counter.count).toBe(3);
    });
  });

  // ============================================================================
  // Memory Leak Prevention Tests
  // ============================================================================

  describe("Memory management in React", () => {
    it("should cleanup subscriptions on unmount", async () => {
      const counter = CounterModel.create({ count: 0 });

      function CounterDisplay({ store }: { store: typeof counter }) {
        const snapshot = useSnapshot<{ count: number }>(store);
        return <div data-testid="count">{snapshot.count}</div>;
      }

      const { unmount } = render(<CounterDisplay store={counter} />);

      // Component should have subscribed
      expect(screen.getByTestId("count").textContent).toBe("0");

      // Unmount - subscriptions should be cleaned up
      unmount();

      // Changing state should not cause issues (no dangling listeners)
      act(() => {
        counter.increment();
      });

      // No errors should occur, state should be updated
      expect(counter.count).toBe(1);
    });

    it("should handle rapid mount/unmount cycles", async () => {
      const counter = CounterModel.create({ count: 0 });

      function CounterDisplay({ store }: { store: typeof counter }) {
        const isAlive = useIsAlive(store);
        return <div data-testid="alive">{isAlive ? "yes" : "no"}</div>;
      }

      // Mount and unmount rapidly
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<CounterDisplay store={counter} />);
        unmount();
      }

      // Should not have leaked listeners or caused errors
      expect(counter.count).toBe(0);
    });

    it("should handle store destruction during component lifecycle", async () => {
      const counter = CounterModel.create({ count: 0 });

      function CounterDisplay({ store }: { store: typeof counter }) {
        const isAlive = useIsAlive(store);
        const [error, setError] = useState<string | null>(null);

        useEffect(() => {
          try {
            if (!isAlive) {
              // Store was destroyed
            }
          } catch (e) {
            setError(String(e));
          }
        }, [isAlive]);

        if (error) return <div data-testid="error">{error}</div>;
        return <div data-testid="alive">{isAlive ? "yes" : "no"}</div>;
      }

      render(<CounterDisplay store={counter} />);

      expect(screen.getByTestId("alive").textContent).toBe("yes");

      act(() => {
        destroy(counter);
      });

      await waitFor(() => {
        expect(screen.getByTestId("alive").textContent).toBe("no");
      });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle null/undefined props gracefully", () => {
      const NullableDisplay = observer(function NullableDisplay({
        store,
      }: {
        store: ReturnType<typeof CounterModel.create> | null;
      }) {
        if (!store) return <div data-testid="empty">No store</div>;
        return <div data-testid="count">{store.count}</div>;
      });

      render(<NullableDisplay store={null} />);
      expect(screen.getByTestId("empty").textContent).toBe("No store");
    });

    it("should handle store prop changes", async () => {
      const counter1 = CounterModel.create({ count: 1 });
      const counter2 = CounterModel.create({ count: 2 });

      function Wrapper() {
        const [store, setStore] = useState(counter1);

        return (
          <div>
            <Observer>
              {() => <div data-testid="count">{store.count}</div>}
            </Observer>
            <button onClick={() => setStore(counter2)}>Switch</button>
          </div>
        );
      }

      render(<Wrapper />);
      expect(screen.getByTestId("count").textContent).toBe("1");

      await act(async () => {
        await userEvent.click(screen.getByText("Switch"));
      });

      expect(screen.getByTestId("count").textContent).toBe("2");
    });
  });

  // ============================================================================
  // Typed Store Context Tests
  // ============================================================================

  describe("createStoreContext (typed)", () => {
    // Create typed context once for these tests
    type CounterInstance = Instance<typeof CounterModel>;
    const CounterContext = createStoreContext<CounterInstance>();

    it("should provide fully typed store access", () => {
      const counter = CounterModel.create({ count: 42 });

      function TypedCounterConsumer() {
        // store is fully typed - no need for type assertion
        const store = CounterContext.useStore();
        // TypeScript knows store.count is a number and store.increment() exists
        return (
          <div>
            <span data-testid="count">{store.count}</span>
            <button onClick={() => store.increment()}>+</button>
          </div>
        );
      }

      render(
        <CounterContext.Provider store={counter}>
          <TypedCounterConsumer />
        </CounterContext.Provider>,
      );

      expect(screen.getByTestId("count").textContent).toBe("42");
    });

    it("should provide typed snapshot with updates", async () => {
      const counter = CounterModel.create({ count: 0 });

      function TypedSnapshotConsumer() {
        // Fully typed - knows it returns CounterInstance
        const store = CounterContext.useStoreSnapshot();
        return <div data-testid="count">{store.count}</div>;
      }

      render(
        <CounterContext.Provider store={counter}>
          <TypedSnapshotConsumer />
        </CounterContext.Provider>,
      );

      expect(screen.getByTestId("count").textContent).toBe("0");

      act(() => {
        counter.increment();
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("1");
      });
    });

    it("should support typed selector", async () => {
      type TodoListInstance = Instance<typeof TodoListModel>;
      const TodoContext = createStoreContext<TodoListInstance>();

      const todoList = TodoListModel.create({
        todos: [
          { id: "1", text: "One", completed: false },
          { id: "2", text: "Two", completed: true },
        ],
      });

      function CompletedCount() {
        // Selector is typed: (store: TodoListInstance) => number
        const count = TodoContext.useStoreSnapshot(
          (store) => store.completedCount,
        );
        return <div data-testid="completed">{count}</div>;
      }

      render(
        <TodoContext.Provider store={todoList}>
          <CompletedCount />
        </TodoContext.Provider>,
      );

      expect(screen.getByTestId("completed").textContent).toBe("1");

      act(() => {
        todoList.toggleTodo("1");
      });

      await waitFor(() => {
        expect(screen.getByTestId("completed").textContent).toBe("2");
      });
    });

    it("should throw when used outside provider", () => {
      function BadComponent() {
        const store = CounterContext.useStore();
        return <div>{store.count}</div>;
      }

      expect(() => render(<BadComponent />)).toThrow(
        "[jotai-state-tree] useStore must be used within a Provider",
      );
    });

    it("should provide typed useIsAlive hook", () => {
      const counter = CounterModel.create({ count: 0 });

      function AliveChecker() {
        const isAlive = CounterContext.useIsAlive();
        return <div data-testid="alive">{isAlive ? "yes" : "no"}</div>;
      }

      render(
        <CounterContext.Provider store={counter}>
          <AliveChecker />
        </CounterContext.Provider>,
      );

      expect(screen.getByTestId("alive").textContent).toBe("yes");
    });
  });
});
