/**
 * @vitest-environment jsdom
 */

import React, { useContext, createContext, useState } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  types,
  onSnapshot,
  clearAllRegistries,
  resetGlobalStore,
} from "../index";

import { getStateTreeNode } from "../tree";

import {
  observer,
  useObserverTracking,
  hasStateTreeNode,
} from "../react";

import type { Instance } from "../index";

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
});

const CounterModel = types
  .model("Counter", {
    count: types.number,
  })
  .volatile(() => ({
    isLoading: false,
  }))
  .actions((self) => ({
    increment() {
      self.count += 1;
    },
    setLoading(value: boolean) {
      self.isLoading = value;
    },
  }));

type CounterInstance = Instance<typeof CounterModel>;

describe("Debug: Detailed observer tracking", () => {
  it("should verify onSnapshot subscription is created and fires", async () => {
    const counter = CounterModel.create({ count: 0 });

    const subscriptionLog: string[] = [];
    let subscriptionCreated = false;
    let snapshotCallCount = 0;

    // Manually verify onSnapshot works
    const dispose = onSnapshot(counter, () => {
      snapshotCallCount++;
      subscriptionLog.push(`snapshot-${snapshotCallCount}`);
    });

    subscriptionCreated = true;

    act(() => {
      counter.increment();
    });

    await new Promise(r => setTimeout(r, 50));

    expect(subscriptionCreated).toBe(true);
    expect(snapshotCallCount).toBe(1);
    expect(subscriptionLog).toContain("snapshot-1");

    dispose();
  });

  it("should verify trackNode creates subscription inside observer", async () => {
    const counter = CounterModel.create({ count: 0 });

    const debugLog: string[] = [];
    let trackNodeCalled = false;
    let trackNodeValue: unknown = null;

    const DebugComponent = observer(function DebugComponent() {
      debugLog.push("render-start");

      const trackNode = useObserverTracking();
      debugLog.push(`trackNode-is-${trackNode ? 'function' : 'null'}`);

      if (trackNode) {
        trackNodeCalled = true;
        trackNodeValue = trackNode;
        debugLog.push("calling-trackNode");
        trackNode(counter);
        debugLog.push("trackNode-called");
      }

      debugLog.push(`render-end-count-${counter.count}`);
      return <div data-testid="count">{counter.count}</div>;
    });

    render(<DebugComponent />);

    expect(trackNodeCalled).toBe(true);
    expect(trackNodeValue).not.toBeNull();
    expect(debugLog).toContain("trackNode-is-function");
    expect(debugLog).toContain("calling-trackNode");
    expect(debugLog).toContain("trackNode-called");

    const initialRenderCount = debugLog.filter(l => l.startsWith("render-start")).length;
    expect(initialRenderCount).toBe(1);

    // Now mutate and check for re-render
    debugLog.length = 0; // Clear log

    act(() => {
      counter.increment();
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });

    // Should have re-rendered
    const reRenderCount = debugLog.filter(l => l.startsWith("render-start")).length;
    expect(reRenderCount).toBeGreaterThanOrEqual(1);
  });

  it("should verify props-based tracking works", async () => {
    const counter = CounterModel.create({ count: 0 });

    const debugLog: string[] = [];

    const PropsComponent = observer(function PropsComponent({
      store
    }: {
      store: CounterInstance
    }) {
      debugLog.push(`render-count-${store.count}`);
      return <div data-testid="count">{store.count}</div>;
    });

    render(<PropsComponent store={counter} />);

    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(debugLog).toContain("render-count-0");

    debugLog.length = 0;

    act(() => {
      counter.increment();
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });

    expect(debugLog).toContain("render-count-1");
  });

  it("should work with context-based store access", async () => {
    const counter = CounterModel.create({ count: 0 });
    const StoreContext = createContext<CounterInstance | null>(null);

    const debugLog: string[] = [];

    function useStore(): CounterInstance {
      const ctx = useContext(StoreContext);
      if (!ctx) throw new Error("No store");

      const trackNode = useObserverTracking();
      debugLog.push(`useStore-trackNode-${trackNode ? 'exists' : 'null'}`);

      if (trackNode && hasStateTreeNode(ctx)) {
        debugLog.push("useStore-tracking");
        trackNode(ctx);
      }

      return ctx;
    }

    const ContextComponent = observer(function ContextComponent() {
      debugLog.push("render-start");
      const store = useStore();
      debugLog.push(`render-count-${store.count}`);
      return <div data-testid="count">{store.count}</div>;
    });

    render(
      <StoreContext.Provider value={counter}>
        <ContextComponent />
      </StoreContext.Provider>
    );

    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(debugLog).toContain("useStore-trackNode-exists");
    expect(debugLog).toContain("useStore-tracking");

    debugLog.length = 0;

    act(() => {
      counter.increment();
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });

    expect(debugLog).toContain("render-start");
    expect(debugLog).toContain("render-count-1");
  });

  it("should work with volatile state via context", async () => {
    const counter = CounterModel.create({ count: 0 });
    const StoreContext = createContext<CounterInstance | null>(null);

    const debugLog: string[] = [];

    function useStore(): CounterInstance {
      const ctx = useContext(StoreContext);
      if (!ctx) throw new Error("No store");

      const trackNode = useObserverTracking();
      if (trackNode && hasStateTreeNode(ctx)) {
        trackNode(ctx);
      }

      return ctx;
    }

    const VolatileComponent = observer(function VolatileComponent() {
      const store = useStore();
      debugLog.push(`render-loading-${store.isLoading}`);
      return <div data-testid="loading">{store.isLoading ? "yes" : "no"}</div>;
    });

    render(
      <StoreContext.Provider value={counter}>
        <VolatileComponent />
      </StoreContext.Provider>
    );

    expect(screen.getByTestId("loading").textContent).toBe("no");

    debugLog.length = 0;

    act(() => {
      counter.setLoading(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("yes");
    });

    expect(debugLog).toContain("render-loading-true");
  });

  it("should handle button click triggering state change", async () => {
    const counter = CounterModel.create({ count: 0 });
    const StoreContext = createContext<CounterInstance | null>(null);

    function useStore(): CounterInstance {
      const ctx = useContext(StoreContext);
      if (!ctx) throw new Error("No store");

      const trackNode = useObserverTracking();
      if (trackNode && hasStateTreeNode(ctx)) {
        trackNode(ctx);
      }

      return ctx;
    }

    const InteractiveComponent = observer(function InteractiveComponent() {
      const store = useStore();
      return (
        <div>
          <span data-testid="count">{store.count}</span>
          <button onClick={() => store.increment()}>+</button>
        </div>
      );
    });

    render(
      <StoreContext.Provider value={counter}>
        <InteractiveComponent />
      </StoreContext.Provider>
    );

    expect(screen.getByTestId("count").textContent).toBe("0");

    await act(async () => {
      await userEvent.click(screen.getByText("+"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });
  });

  it("should handle multiple rapid state changes", async () => {
    const counter = CounterModel.create({ count: 0 });
    const StoreContext = createContext<CounterInstance | null>(null);

    function useStore(): CounterInstance {
      const ctx = useContext(StoreContext);
      if (!ctx) throw new Error("No store");

      const trackNode = useObserverTracking();
      if (trackNode && hasStateTreeNode(ctx)) {
        trackNode(ctx);
      }

      return ctx;
    }

    const RapidComponent = observer(function RapidComponent() {
      const store = useStore();
      return <div data-testid="count">{store.count}</div>;
    });

    render(
      <StoreContext.Provider value={counter}>
        <RapidComponent />
      </StoreContext.Provider>
    );

    act(() => {
      counter.increment();
      counter.increment();
      counter.increment();
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("3");
    });
  });
});

describe("Debug: Check observer subscription lifecycle", () => {
  it("should maintain subscription across re-renders", async () => {
    const counter = CounterModel.create({ count: 0 });

    let renderCount = 0;

    const RerenderComponent = observer(function RerenderComponent({
      store
    }: {
      store: CounterInstance
    }) {
      renderCount++;
      return <div data-testid="count">{store.count}</div>;
    });

    const { rerender } = render(<RerenderComponent store={counter} />);

    expect(renderCount).toBe(1);

    // Force a re-render without state change
    rerender(<RerenderComponent store={counter} />);

    // memo should prevent unnecessary re-render when props are same object
    // But let's verify state changes still work

    act(() => {
      counter.increment();
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });
  });

  it("should work when store is passed via props and context simultaneously", async () => {
    const counter = CounterModel.create({ count: 0 });
    const StoreContext = createContext<CounterInstance | null>(null);

    function useStore(): CounterInstance {
      const ctx = useContext(StoreContext);
      if (!ctx) throw new Error("No store");

      const trackNode = useObserverTracking();
      if (trackNode && hasStateTreeNode(ctx)) {
        trackNode(ctx);
      }

      return ctx;
    }

    // Component uses both props AND context
    const DualComponent = observer(function DualComponent({
      propStore
    }: {
      propStore: CounterInstance
    }) {
      const contextStore = useStore();

      // Both should be the same store
      return (
        <div>
          <span data-testid="prop-count">{propStore.count}</span>
          <span data-testid="context-count">{contextStore.count}</span>
        </div>
      );
    });

    render(
      <StoreContext.Provider value={counter}>
        <DualComponent propStore={counter} />
      </StoreContext.Provider>
    );

    expect(screen.getByTestId("prop-count").textContent).toBe("0");
    expect(screen.getByTestId("context-count").textContent).toBe("0");

    act(() => {
      counter.increment();
    });

    await waitFor(() => {
      expect(screen.getByTestId("prop-count").textContent).toBe("1");
      expect(screen.getByTestId("context-count").textContent).toBe("1");
    });
  });
});
