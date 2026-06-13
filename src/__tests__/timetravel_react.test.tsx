/**
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { types, applySnapshot, getSnapshot, clearAllRegistries, resetGlobalStore } from "../index";
import { observer } from "../react";

beforeEach(() => {
  clearAllRegistries();
  resetGlobalStore();
});

afterEach(() => {
  cleanup();
  clearAllRegistries();
  resetGlobalStore();
});

const Task = types.model("Task", {
  id: types.identifier,
  text: types.string,
  completed: types.boolean,
});

const TaskStore = types
  .model("TaskStore", {
    items: types.array(Task),
  })
  .actions((self) => ({
    addTask(id: string, text: string) {
      self.items.push({ id, text, completed: false });
    },
    deleteTask(id: string) {
      const idx = self.items.findIndex((item) => item.id === id);
      if (idx !== -1) {
        self.items.splice(idx, 1);
      }
    },
  }));

describe("React reactivity on applySnapshot", () => {
  it("should re-render component when snapshot is applied to array", () => {
    const store = TaskStore.create({
      items: [
        { id: "1", text: "Task 1", completed: false },
        { id: "2", text: "Task 2", completed: false },
      ],
    });

    const snap0 = getSnapshot(store);

    // Add task
    store.addTask("3", "Task 3");
    const snap1 = getSnapshot(store);

    // Delete task
    store.deleteTask("2");
    const snap2 = getSnapshot(store);

    const TestComponent = observer(() => {
      return (
        <div>
          <span data-testid="count">{store.items.length}</span>
          <ul>
            {store.items.map((item) => (
              <li key={item.id} data-testid={`item-${item.id}`}>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      );
    });

    console.log("TEST STORE ITEMS:", store.items.toJSON());
    render(<TestComponent />);

    // Initial check (at snap2 state: Task 1 and Task 3)
    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.queryByTestId("item-2")).toBeNull();
    expect(screen.queryByTestId("item-3")).not.toBeNull();

    // Apply snap1 (should restore Task 2 -> length 3)
    act(() => {
      applySnapshot(store, snap1);
    });

    expect(screen.getByTestId("count").textContent).toBe("3");
    expect(screen.queryByTestId("item-2")).not.toBeNull();
    expect(screen.queryByTestId("item-3")).not.toBeNull();

    // Apply snap2 (should delete Task 2 -> length 2)
    act(() => {
      applySnapshot(store, snap2);
    });

    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.queryByTestId("item-2")).toBeNull();
    expect(screen.queryByTestId("item-3")).not.toBeNull();
  });
});
