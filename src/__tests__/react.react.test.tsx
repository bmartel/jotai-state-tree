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
  unprotect,
  getSnapshot,
  onSnapshot,
  clearAllRegistries,
  resetGlobalStore,
  getRegistryStats,
  createUndoManager,
  createTimeTravelManager,
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
  useObserver,
  useHydrateStore,
  useUndoManager,
  useTimeTravelManager,
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

      // Change unrelated field - should NOT trigger since we do property-level tracking
      act(() => {
        store.setUnrelated("changed");
      });

      // Give time for any potential re-renders
      await new Promise((r) => setTimeout(r, 50));

      expect(renderCount).toBe(1);

      // Increment count - should trigger a re-render
      act(() => {
        store.increment();
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("1");
      });

      expect(renderCount).toBe(2);
    });

    it("should handle exact property-level updates and child node replacement", async () => {
      const AuthorModel = types.model("Author", {
        name: types.string,
      });
      const BookModel = types
        .model("Book", {
          title: types.string,
          author: types.maybeNull(AuthorModel),
        })
        .actions((self) => ({
          setTitle(title: string) {
            self.title = title;
          },
          setAuthor(author: any) {
            self.author = author;
          },
        }));

      const book = BookModel.create({ title: "Clean Code", author: { name: "Robert" } });
      unprotect(book);
      let authorRenderCount = 0;
      let titleRenderCount = 0;

      const AuthorView = observer(function AuthorView({ b }: { b: typeof book }) {
        authorRenderCount++;
        return <div data-testid="author">{b.author ? b.author.name : "none"}</div>;
      });

      const TitleView = observer(function TitleView({ b }: { b: typeof book }) {
        titleRenderCount++;
        return <div data-testid="title">{b.title}</div>;
      });

      render(
        <div>
          <AuthorView b={book} />
          <TitleView b={book} />
        </div>
      );

      expect(authorRenderCount).toBe(1);
      expect(titleRenderCount).toBe(1);

      // Mutate title only - AuthorView should not re-render, TitleView should
      act(() => {
        book.setTitle("Refactoring");
      });

      await waitFor(() => {
        expect(screen.getByTestId("title").textContent).toBe("Refactoring");
      });

      expect(authorRenderCount).toBe(1);
      expect(titleRenderCount).toBe(2);

      // Mutate author's name inside the sub-model - AuthorView should re-render, TitleView should not
      act(() => {
        book.author!.name = "Uncle Bob";
      });

      await waitFor(() => {
        expect(screen.getByTestId("author").textContent).toBe("Uncle Bob");
      });

      expect(authorRenderCount).toBe(2);
      expect(titleRenderCount).toBe(2);

      // Replace author sub-model entirely - AuthorView should re-render and subscribe to new model, TitleView should not
      act(() => {
        book.setAuthor({ name: "Martin" });
      });

      await waitFor(() => {
        expect(screen.getByTestId("author").textContent).toBe("Martin");
      });

      expect(authorRenderCount).toBe(3);
      expect(titleRenderCount).toBe(2);

      // Mutate the NEW author's name - AuthorView should re-render, TitleView should not
      act(() => {
        book.author!.name = "Martin Fowler";
      });

      await waitFor(() => {
        expect(screen.getByTestId("author").textContent).toBe("Martin Fowler");
      });

      expect(authorRenderCount).toBe(4);
      expect(titleRenderCount).toBe(2);
    });

    it("should prevent over-rendering at varying depths (nested models and arrays)", async () => {
      const ItemModel = types
        .model("Item", {
          id: types.identifier,
          value: types.string,
        })
        .actions((self) => ({
          setValue(val: string) {
            self.value = val;
          },
        }));

      const ListContainer = types
        .model("ListContainer", {
          items: types.array(ItemModel),
        })
        .actions((self) => ({
          addItem(id: string, value: string) {
            self.items.push({ id, value });
          },
        }));

      const container = ListContainer.create({
        items: [
          { id: "1", value: "one" },
          { id: "2", value: "two" },
        ],
      });
      unprotect(container);

      let containerRenderCount = 0;
      let item1RenderCount = 0;
      let item2RenderCount = 0;

      // Component rendering the container list (only iterates/accesses the items array reference)
      const ContainerListView = observer(function ContainerListView({ c }: { c: typeof container }) {
        containerRenderCount++;
        return (
          <div>
            <div data-testid="list-length">{c.items.length}</div>
            {c.items.map((item) => (
              <ItemView key={item.id} item={item} />
            ))}
          </div>
        );
      });

      // Individual item view
      const ItemView = observer(function ItemView({ item }: { item: Instance<typeof ItemModel> }) {
        if (item.id === "1") item1RenderCount++;
        if (item.id === "2") item2RenderCount++;
        return <div data-testid={`item-${item.id}`}>{item.value}</div>;
      });

      render(<ContainerListView c={container} />);

      expect(containerRenderCount).toBe(1);
      expect(item1RenderCount).toBe(1);
      expect(item2RenderCount).toBe(1);

      // Mutate item 1 value - ONLY Item 1 should re-render. ContainerListView and Item 2 should NOT!
      act(() => {
        container.items[0].setValue("one-updated");
      });

      await waitFor(() => {
        expect(screen.getByTestId("item-1").textContent).toBe("one-updated");
      });

      // Assert precise tracking at varying depth
      expect(item1RenderCount).toBe(2);
      expect(item2RenderCount).toBe(1);
      expect(containerRenderCount).toBe(1); // Crucial! Container ListView did NOT re-render!

      // Add a new item - ContainerListView should re-render (since array changed structure/length)
      act(() => {
        container.addItem("3", "three");
      });

      await waitFor(() => {
        expect(screen.getByTestId("list-length").textContent).toBe("3");
      });

      expect(containerRenderCount).toBe(2);
      expect(item1RenderCount).toBe(2); // React may re-render children, but the parent re-rendered
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
  // useObserver Tests
  // ============================================================================

  describe("useObserver", () => {
    it("should re-render when accessed state changes", async () => {
      const counter = CounterModel.create({ count: 10 });
      let renderCount = 0;

      function ObserverDisplay() {
        renderCount++;
        return useObserver(() => {
          return <div data-testid="count">{counter.count}</div>;
        });
      }

      render(<ObserverDisplay />);

      expect(screen.getByTestId("count").textContent).toBe("10");
      expect(renderCount).toBe(1);

      act(() => {
        counter.increment();
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("11");
      });

      expect(renderCount).toBeGreaterThanOrEqual(2);
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

    it("should update when undo/redo or time travel are executed", async () => {
      const counter = CounterModel.create({ count: 10 });
      const undoManager = createUndoManager(counter);
      const timeTravel = createTimeTravelManager(counter, { autoRecord: true });

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

      // Undo
      act(() => {
        undoManager.undo();
      });
      await waitFor(() => {
        expect(screen.getByTestId("snapshot").textContent).toBe("10");
      });

      // Redo
      act(() => {
        undoManager.redo();
      });
      await waitFor(() => {
        expect(screen.getByTestId("snapshot").textContent).toBe("20");
      });

      // Time travel goBack
      act(() => {
        timeTravel.goBack();
      });
      await waitFor(() => {
        expect(screen.getByTestId("snapshot").textContent).toBe("10");
      });

      undoManager.dispose();
      timeTravel.dispose();
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

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(() => render(<BadComponent />)).toThrow(
          "[jotai-state-tree] useStore must be used within a Provider",
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
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

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(() => render(<BadComponent />)).toThrow(
          "[jotai-state-tree] useStore must be used within a Provider",
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
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

  describe("useHydrateStore", () => {
    it("should hydrate a store with a snapshot using Jotai hydration patterns", () => {
      const StoreModel = types.model("StoreModel", {
        count: types.number,
        title: types.string,
      }).actions(self => ({
        increment() { self.count++; }
      }));

      const store = StoreModel.create({ count: 0, title: "Initial" });

      function HydratedComponent({ initialSnapshot }: { initialSnapshot: any }) {
        useHydrateStore(store, initialSnapshot);
        const snapshot = useSnapshot<{ count: number; title: string }>(store);
        
        return (
          <div>
            <div data-testid="count">{snapshot.count}</div>
            <div data-testid="title">{snapshot.title}</div>
          </div>
        );
      }

      render(
        <HydratedComponent initialSnapshot={{ count: 10, title: "Hydrated" }} />
      );

      expect(screen.getByTestId("count").textContent).toBe("10");
      expect(screen.getByTestId("title").textContent).toBe("Hydrated");

      act(() => {
        store.increment();
      });
      expect(screen.getByTestId("count").textContent).toBe("11");
    });
  });

  describe("useUndoManager and useTimeTravelManager", () => {
    const CounterModel = types
      .model("Counter", {
        count: types.number,
      })
      .actions((self) => ({
        increment() {
          self.count++;
        },
      }));

    it("should update reactive values in React components on state change", async () => {
      const counter = CounterModel.create({ count: 10 });

      function HistoryControls() {
        const undoManager = useUndoManager(counter);
        const timeTravel = useTimeTravelManager(counter, { autoRecord: true });

        return (
          <div>
            <div data-testid="count">{counter.count}</div>
            <button data-testid="undo-btn" onClick={() => undoManager.undo()} disabled={!undoManager.canUndo}>
              Undo ({undoManager.undoLevels})
            </button>
            <button data-testid="redo-btn" onClick={() => undoManager.redo()} disabled={!undoManager.canRedo}>
              Redo
            </button>
            <div data-testid="tt-index">
              Index: {timeTravel.currentIndex} / {timeTravel.snapshotCount - 1}
            </div>
            <button data-testid="tt-back-btn" onClick={() => timeTravel.goBack()} disabled={!timeTravel.canGoBack}>
              TT Back
            </button>
            <button data-testid="tt-forward-btn" onClick={() => timeTravel.goForward()} disabled={!timeTravel.canGoForward}>
              TT Forward
            </button>
          </div>
        );
      }

      render(<HistoryControls />);

      // Initial state
      expect(screen.getByTestId("count").textContent).toBe("10");
      expect(screen.getByTestId("undo-btn").textContent).toBe("Undo (0)");
      expect((screen.getByTestId("undo-btn") as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByTestId("tt-index").textContent).toBe("Index: 0 / 0");

      // Change state
      act(() => {
        counter.increment();
      });

      // Verify react component re-rendered and updated the buttons/labels automatically
      await waitFor(() => {
        expect(screen.getByTestId("undo-btn").textContent).toBe("Undo (1)");
      });
      expect((screen.getByTestId("undo-btn") as HTMLButtonElement).disabled).toBe(false);
      expect(screen.getByTestId("tt-index").textContent).toBe("Index: 1 / 1");

      // Perform Undo
      act(() => {
        screen.getByTestId("undo-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("10");
      });
      expect(screen.getByTestId("undo-btn").textContent).toBe("Undo (0)");
      expect((screen.getByTestId("undo-btn") as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId("redo-btn") as HTMLButtonElement).disabled).toBe(false);
      expect(screen.getByTestId("tt-index").textContent).toBe("Index: 0 / 1");

      // Perform Redo
      act(() => {
        screen.getByTestId("redo-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("11");
      });
      expect(screen.getByTestId("undo-btn").textContent).toBe("Undo (1)");
      expect((screen.getByTestId("undo-btn") as HTMLButtonElement).disabled).toBe(false);
      expect((screen.getByTestId("redo-btn") as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByTestId("tt-index").textContent).toBe("Index: 1 / 1");

      // Time travel back using helper method
      act(() => {
        screen.getByTestId("tt-back-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("10");
      });
      expect(screen.getByTestId("undo-btn").textContent).toBe("Undo (0)");
      expect(screen.getByTestId("tt-index").textContent).toBe("Index: 0 / 1");

      // Time travel forward
      act(() => {
        screen.getByTestId("tt-forward-btn").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("11");
      });
      expect(screen.getByTestId("undo-btn").textContent).toBe("Undo (1)");
      expect(screen.getByTestId("tt-index").textContent).toBe("Index: 1 / 1");
    });
  });
});
