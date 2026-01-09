/**
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  types,
  getSnapshot,
  onSnapshot,
  clearAllRegistries,
  resetGlobalStore,
} from "../index";

import {
  observer,
  Provider,
  useStore,
  createStoreContext,
  useObserverTracking,
  hasStateTreeNode,
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
// Model Definitions
// ============================================================================

const CounterModel = types
  .model("Counter", {
    count: types.number,
  })
  .volatile(() => ({
    isLoading: false,
    error: null as string | null,
  }))
  .actions((self) => ({
    increment() {
      self.count += 1;
    },
    setLoading(value: boolean) {
      self.isLoading = value;
    },
    setError(error: string | null) {
      self.error = error;
    },
  }));

type CounterInstance = Instance<typeof CounterModel>;

// ============================================================================
// Tests for Observer + useStore (hook-based access)
// ============================================================================

describe("Observer tracking with useStore hook", () => {
  describe("Legacy Provider + useStore", () => {
    it("should re-render when store changes (accessed via useStore inside observer)", async () => {
      const counter = CounterModel.create({ count: 0 });
      let renderCount = 0;

      // This is the problematic pattern - store accessed via hook, not prop
      const CounterDisplay = observer(function CounterDisplay() {
        renderCount++;
        const store = useStore<CounterInstance>();
        return <div data-testid="count">{store.count}</div>;
      });

      render(
        <Provider store={counter}>
          <CounterDisplay />
        </Provider>
      );

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

    it("should track store accessed via useStore and re-render on changes", async () => {
      const counter = CounterModel.create({ count: 5 });
      const snapshotChanges: number[] = [];

      // Track snapshot changes
      onSnapshot(counter, (snapshot) => {
        snapshotChanges.push((snapshot as { count: number }).count);
      });

      const CounterWithHook = observer(function CounterWithHook() {
        const store = useStore<CounterInstance>();
        return (
          <div>
            <span data-testid="count">{store.count}</span>
            <button onClick={() => store.increment()}>+</button>
          </div>
        );
      });

      render(
        <Provider store={counter}>
          <CounterWithHook />
        </Provider>
      );

      expect(screen.getByTestId("count").textContent).toBe("5");

      await act(async () => {
        await userEvent.click(screen.getByText("+"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("count").textContent).toBe("6");
      });

      expect(snapshotChanges).toContain(6);
    });
  });

  describe("createStoreContext + observer", () => {
    const CounterContext = createStoreContext<CounterInstance>();

    it("should re-render when store changes (accessed via typed useStore inside observer)", async () => {
      const counter = CounterModel.create({ count: 0 });
      let renderCount = 0;

      const TypedCounterDisplay = observer(function TypedCounterDisplay() {
        renderCount++;
        const store = CounterContext.useStore();
        return <div data-testid="count">{store.count}</div>;
      });

      render(
        <CounterContext.Provider store={counter}>
          <TypedCounterDisplay />
        </CounterContext.Provider>
      );

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
  });

  describe("useObserverTracking context", () => {
    it("should provide tracking function inside observer", () => {
      let capturedTrackFn: ReturnType<typeof useObserverTracking> = null;

      const TestComponent = observer(function TestComponent() {
        capturedTrackFn = useObserverTracking();
        return <div>test</div>;
      });

      render(<TestComponent />);

      expect(capturedTrackFn).not.toBeNull();
      expect(typeof capturedTrackFn).toBe("function");
    });

    it("should return null outside of observer", () => {
      let capturedTrackFn: ReturnType<typeof useObserverTracking> = null;

      function NonObserverComponent() {
        capturedTrackFn = useObserverTracking();
        return <div>test</div>;
      }

      render(<NonObserverComponent />);

      expect(capturedTrackFn).toBeNull();
    });

    it("should track node when trackNode is called", async () => {
      const counter = CounterModel.create({ count: 0 });
      let renderCount = 0;

      const ManualTrackingComponent = observer(function ManualTrackingComponent() {
        renderCount++;
        const trackNode = useObserverTracking();

        // Manually track the counter
        if (trackNode && hasStateTreeNode(counter)) {
          trackNode(counter);
        }

        return <div data-testid="count">{counter.count}</div>;
      });

      render(<ManualTrackingComponent />);

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
  });
});

// ============================================================================
// Tests for Volatile State Reactivity
// ============================================================================

describe("Volatile state reactivity", () => {
  it("should notify snapshot listeners when volatile state changes", async () => {
    const counter = CounterModel.create({ count: 0 });
    const snapshotCalls: unknown[] = [];

    onSnapshot(counter, (snapshot) => {
      snapshotCalls.push(snapshot);
    });

    expect(counter.isLoading).toBe(false);
    expect(snapshotCalls.length).toBe(0);

    act(() => {
      counter.setLoading(true);
    });

    // Give time for notification
    await new Promise(r => setTimeout(r, 10));

    expect(counter.isLoading).toBe(true);
    // Snapshot listener should have been called
    expect(snapshotCalls.length).toBeGreaterThan(0);
  });

  it("should re-render observer component when volatile state changes", async () => {
    const counter = CounterModel.create({ count: 0 });
    let renderCount = 0;

    const VolatileDisplay = observer(function VolatileDisplay({
      store,
    }: {
      store: CounterInstance;
    }) {
      renderCount++;
      return (
        <div>
          <span data-testid="loading">{store.isLoading ? "loading" : "idle"}</span>
          <span data-testid="count">{store.count}</span>
        </div>
      );
    });

    render(<VolatileDisplay store={counter} />);

    expect(screen.getByTestId("loading").textContent).toBe("idle");
    expect(renderCount).toBe(1);

    act(() => {
      counter.setLoading(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("loading");
    });

    expect(renderCount).toBeGreaterThanOrEqual(2);
  });

  it("should re-render when volatile state changes via useStore", async () => {
    const counter = CounterModel.create({ count: 0 });
    let renderCount = 0;

    const VolatileWithHook = observer(function VolatileWithHook() {
      renderCount++;
      const store = useStore<CounterInstance>();
      return (
        <div>
          <span data-testid="loading">{store.isLoading ? "loading" : "idle"}</span>
          <button onClick={() => store.setLoading(true)}>Start Loading</button>
        </div>
      );
    });

    render(
      <Provider store={counter}>
        <VolatileWithHook />
      </Provider>
    );

    expect(screen.getByTestId("loading").textContent).toBe("idle");
    expect(renderCount).toBe(1);

    await act(async () => {
      await userEvent.click(screen.getByText("Start Loading"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("loading");
    });

    expect(renderCount).toBeGreaterThanOrEqual(2);
  });

  it("should not notify when volatile value is set to same value", async () => {
    const counter = CounterModel.create({ count: 0 });
    let snapshotCallCount = 0;

    onSnapshot(counter, () => {
      snapshotCallCount++;
    });

    // Set to same value
    act(() => {
      counter.setLoading(false); // already false
    });

    await new Promise(r => setTimeout(r, 10));

    // Should not have triggered notification since value didn't change
    expect(snapshotCallCount).toBe(0);
  });

  it("should handle rapid volatile state changes", async () => {
    const counter = CounterModel.create({ count: 0 });
    const loadingStates: boolean[] = [];

    const RapidVolatile = observer(function RapidVolatile({
      store,
    }: {
      store: CounterInstance;
    }) {
      loadingStates.push(store.isLoading);
      return <div data-testid="loading">{store.isLoading ? "yes" : "no"}</div>;
    });

    render(<RapidVolatile store={counter} />);

    act(() => {
      counter.setLoading(true);
      counter.setLoading(false);
      counter.setLoading(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("yes");
    });

    expect(counter.isLoading).toBe(true);
  });
});

// ============================================================================
// Combined Tests - Observer + useStore + Volatile
// ============================================================================

describe("Combined: Observer + useStore + Volatile state", () => {
  const CounterContext = createStoreContext<CounterInstance>();

  it("should handle all reactivity scenarios together", async () => {
    const counter = CounterModel.create({ count: 0 });
    let renderCount = 0;

    const FullFeatureComponent = observer(function FullFeatureComponent() {
      renderCount++;
      const store = CounterContext.useStore();

      return (
        <div>
          <span data-testid="count">{store.count}</span>
          <span data-testid="loading">{store.isLoading ? "loading" : "idle"}</span>
          <span data-testid="error">{store.error || "no-error"}</span>
          <button data-testid="inc" onClick={() => store.increment()}>+</button>
          <button data-testid="load" onClick={() => store.setLoading(true)}>Load</button>
          <button data-testid="err" onClick={() => store.setError("oops")}>Error</button>
        </div>
      );
    });

    render(
      <CounterContext.Provider store={counter}>
        <FullFeatureComponent />
      </CounterContext.Provider>
    );

    // Initial state
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(screen.getByTestId("loading").textContent).toBe("idle");
    expect(screen.getByTestId("error").textContent).toBe("no-error");
    const initialRenderCount = renderCount;

    // Test regular state change
    await act(async () => {
      await userEvent.click(screen.getByTestId("inc"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });
    expect(renderCount).toBeGreaterThan(initialRenderCount);

    const afterIncRenderCount = renderCount;

    // Test volatile state change (loading)
    await act(async () => {
      await userEvent.click(screen.getByTestId("load"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("loading");
    });
    expect(renderCount).toBeGreaterThan(afterIncRenderCount);

    const afterLoadRenderCount = renderCount;

    // Test another volatile state change (error)
    await act(async () => {
      await userEvent.click(screen.getByTestId("err"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("oops");
    });
    expect(renderCount).toBeGreaterThan(afterLoadRenderCount);
  });
});
