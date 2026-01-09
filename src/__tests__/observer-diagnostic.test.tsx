/**
 * @vitest-environment jsdom
 */

import React, { useContext, createContext } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor, cleanup } from "@testing-library/react";

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

// Custom context - exactly how gemma-chat does it
const StoreContext = createContext<CounterInstance | null>(null);

function useCustomStore(): CounterInstance {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useCustomStore must be used within StoreProvider");
  }
  // This is what gemma-chat should do - track the node
  const trackNode = useObserverTracking();
  if (trackNode && hasStateTreeNode(ctx)) {
    trackNode(ctx);
  }
  return ctx;
}

// Non-tracking version to compare
function useCustomStoreWithoutTracking(): CounterInstance {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useCustomStore must be used within StoreProvider");
  }
  // NO tracking - this is the broken behavior
  return ctx;
}

describe("Diagnostic: Custom context with observer", () => {
  it("should work when custom useStore calls trackNode", async () => {
    const counter = CounterModel.create({ count: 0 });
    let renderCount = 0;

    const DisplayWithTracking = observer(function DisplayWithTracking() {
      renderCount++;
      const store = useCustomStore(); // Uses tracking
      return <div data-testid="count">{store.count}</div>;
    });

    render(
      <StoreContext.Provider value={counter}>
        <DisplayWithTracking />
      </StoreContext.Provider>
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

  it("should NOT work when custom useStore does NOT call trackNode", async () => {
    const counter = CounterModel.create({ count: 0 });
    let renderCount = 0;

    const DisplayWithoutTracking = observer(function DisplayWithoutTracking() {
      renderCount++;
      const store = useCustomStoreWithoutTracking(); // NO tracking
      return <div data-testid="count">{store.count}</div>;
    });

    render(
      <StoreContext.Provider value={counter}>
        <DisplayWithoutTracking />
      </StoreContext.Provider>
    );

    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(renderCount).toBe(1);

    act(() => {
      counter.increment();
    });

    // Wait a bit
    await new Promise(r => setTimeout(r, 50));

    // Should NOT have re-rendered because there's no tracking!
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(renderCount).toBe(1);
  });

  it("should work for volatile state when custom useStore calls trackNode", async () => {
    const counter = CounterModel.create({ count: 0 });
    let renderCount = 0;

    const VolatileWithTracking = observer(function VolatileWithTracking() {
      renderCount++;
      const store = useCustomStore(); // Uses tracking
      return <div data-testid="loading">{store.isLoading ? "yes" : "no"}</div>;
    });

    render(
      <StoreContext.Provider value={counter}>
        <VolatileWithTracking />
      </StoreContext.Provider>
    );

    expect(screen.getByTestId("loading").textContent).toBe("no");
    expect(renderCount).toBe(1);

    act(() => {
      counter.setLoading(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("yes");
    });

    expect(renderCount).toBeGreaterThanOrEqual(2);
  });
});

describe("Diagnostic: Verify onSnapshot is triggered for volatile changes", () => {
  it("should trigger onSnapshot when volatile state changes", async () => {
    const counter = CounterModel.create({ count: 0 });
    const snapshotCalls: unknown[] = [];

    const dispose = onSnapshot(counter, (snapshot) => {
      snapshotCalls.push(snapshot);
    });

    expect(snapshotCalls.length).toBe(0);

    act(() => {
      counter.setLoading(true);
    });

    // Wait for notification
    await new Promise(r => setTimeout(r, 10));

    expect(snapshotCalls.length).toBe(1);

    act(() => {
      counter.setLoading(false);
    });

    await new Promise(r => setTimeout(r, 10));

    expect(snapshotCalls.length).toBe(2);

    dispose();
  });

  it("should trigger onSnapshot for regular state changes", async () => {
    const counter = CounterModel.create({ count: 0 });
    const snapshotCalls: unknown[] = [];

    const dispose = onSnapshot(counter, (snapshot) => {
      snapshotCalls.push(snapshot);
    });

    act(() => {
      counter.increment();
    });

    await new Promise(r => setTimeout(r, 10));

    expect(snapshotCalls.length).toBe(1);

    dispose();
  });
});

describe("Diagnostic: Verify StateTreeNode.notifyVolatileChange exists and works", () => {
  it("should have notifyVolatileChange method on StateTreeNode", () => {
    const counter = CounterModel.create({ count: 0 });
    const node = getStateTreeNode(counter);

    expect(node).toBeDefined();
    expect(typeof (node as any).notifyVolatileChange).toBe("function");
  });

  it("should call snapshot listeners when notifyVolatileChange is called directly", () => {
    const counter = CounterModel.create({ count: 0 });
    const node = getStateTreeNode(counter);
    let snapshotCalled = false;

    node.onSnapshot(() => {
      snapshotCalled = true;
    });

    (node as any).notifyVolatileChange();

    expect(snapshotCalled).toBe(true);
  });
});
