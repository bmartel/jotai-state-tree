/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { types, unprotect } from "../index";
import { JotaiStateTreeDevtools } from "../devtools";
import { createRouter } from "../react";
import { createPersistenceManager } from "../persistence";

const Todo = types.model("Todo", {
  id: types.identifier,
  text: types.string,
});

const RouterModel = types.model("RouterModel", {
  pathname: types.string,
  search: types.string,
  hash: types.string,
  action: types.string,
  currentRouteName: types.maybeNull(types.string),
  params: types.frozen(),
  query: types.frozen(),
}).actions((self) => ({
  push(path: string) {
    self.pathname = path;
  },
  _setPopStateRef() {},
}));

const RootStore = types
  .model("RootStore", {
    todos: types.array(Todo),
    router: RouterModel,
  })
  .actions((self) => ({
    addTodo(id: string, text: string) {
      self.todos.push(Todo.create({ id, text }));
    },
  }));

describe("DevTools Extra Boundaries", () => {
  let store: any;
  let pm: any;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
    vi.stubGlobal("indexedDB", {} as any);
    store = RootStore.create({
      todos: [],
      router: {
        pathname: "/",
        search: "",
        hash: "",
        action: "POP",
        currentRouteName: null,
        params: {},
        query: {},
      },
    });
    unprotect(store);

    // Create persistence manager
    pm = createPersistenceManager(store, {
      key: "test-devtools-pm-key",
      mutation: {
        syncFn: vi.fn(),
      },
    });
  });

  afterEach(() => {
    if (pm) pm.dispose();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("should support tab switching, manual sync, route simulator, registry stats, maximizing, and resizing", async () => {
    // Mock URL and Blob for export test
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    render(<JotaiStateTreeDevtools store={store} />);

    // Open devtools
    const trigger = screen.getByTitle("Open Jotai State Tree DevTools");
    await act(async () => {
      trigger.click();
    });

    // 1. Time Travel tab interactions
    // Perform an action to populate history
    act(() => {
      store.addTodo("1", "DevTools Action");
    });

    const timeTravelTab = screen.getByText("Actions Timeline");
    await act(async () => {
      timeTravelTab.click();
    });

    // We should see the action in history list
    expect(screen.getAllByText("addTodo").length).toBeGreaterThan(0);

    // Export history test
    const exportButton = screen.getByTitle("Export Timeline History");
    expect(exportButton).toBeInTheDocument();
    await act(async () => {
      exportButton.click();
    });
    expect(createObjectURLMock).toHaveBeenCalled();

    // Import history test
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Mock FileReader
    class MockFileReader {
      onload: any = null;
      readAsText(file: File) {
        if (this.onload) {
          this.onload({
            target: {
              result: JSON.stringify([
                {
                  name: "addTodo",
                  args: ["2", "Imported Action"],
                  path: "",
                  timestamp: Date.now(),
                  snapshot: { todos: [{ id: "2", text: "Imported Action" }] }
                }
              ])
            }
          });
        }
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const file = new File(["{}"], "history.json", { type: "application/json" });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // 2. Patches tab interactions
    const patchesTab = screen.getByText("Patches Feed");
    await act(async () => {
      patchesTab.click();
    });
    expect(screen.getByText("Patches Log")).toBeInTheDocument();

    // Search patches input
    const searchInput = screen.getByPlaceholderText("Search by path...");
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "todos" } });
    });

    // 3. Persistence tab interactions
    const persistenceTab = screen.getByText("Persistence");
    await act(async () => {
      persistenceTab.click();
    });
    expect(screen.getByText("IndexedDB Persistence Manager")).toBeInTheDocument();

    const syncSpy = vi.spyOn(pm, "sync").mockResolvedValue(undefined);
    const fetchSpy = vi.spyOn(pm, "fetch").mockResolvedValue(undefined);
    const compactSpy = vi.spyOn(pm, "compact").mockResolvedValue(undefined);

    const flushButton = screen.getByText("Flush Sync Queue");
    const forceFetchButton = screen.getByText("Force Fetch Revalidate");
    const compactButton = screen.getByText("Compact Storage Queue");

    await act(async () => {
      flushButton.click();
      forceFetchButton.click();
      compactButton.click();
    });

    expect(syncSpy).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(true);
    expect(compactSpy).toHaveBeenCalled();

    // 4. Router tab interactions
    const routerTab = screen.getByText("Router");
    await act(async () => {
      routerTab.click();
    });
    expect(screen.getByText("State Router Info")).toBeInTheDocument();

    // Route Simulator
    const routeInput = screen.getByPlaceholderText("Enter pathname (e.g. /settings)...");
    const navigateButton = screen.getByText("Navigate");

    await act(async () => {
      fireEvent.change(routeInput, { target: { value: "/new-url" } });
    });
    await act(async () => {
      navigateButton.click();
    });
    expect(store.router.pathname).toBe("/new-url");

    // 5. Registry tab interactions
    const registryTab = screen.getByText("Registry");
    await act(async () => {
      registryTab.click();
    });
    expect(screen.getByText("Registry Heap & Statistics")).toBeInTheDocument();

    // 6. Dock layout switches
    const dockRightButton = screen.getByTitle("Dock to Right");
    await act(async () => {
      dockRightButton.click();
    });
    const dockBottomButton = screen.getByTitle("Dock to Bottom");
    await act(async () => {
      dockBottomButton.click();
    });

    // Maximize/Restore
    const maximizeButton = screen.getByTitle("Maximize Panel");
    await act(async () => {
      maximizeButton.click();
    });
    const restoreButton = screen.getByTitle("Minimize Panel");
    await act(async () => {
      restoreButton.click();
    });

    // 7. Resize dragging handlers (bottom dock resizing)
    const bottomResizeHandle = document.querySelector(".jst-resizer-bottom") as HTMLElement;
    expect(bottomResizeHandle).toBeInTheDocument();

    fireEvent.mouseDown(bottomResizeHandle, { clientY: 500 });
    // Mock document events
    const moveEvent = new MouseEvent("mousemove", { clientY: 400 });
    const upEvent = new MouseEvent("mouseup");
    
    act(() => {
      document.dispatchEvent(moveEvent);
    });
    act(() => {
      document.dispatchEvent(upEvent);
    });

    // Switch to right dock resizing
    await act(async () => {
      screen.getByTitle("Dock to Right").click();
    });
    const rightResizeHandle = document.querySelector(".jst-resizer-right") as HTMLElement;
    expect(rightResizeHandle).toBeInTheDocument();
    fireEvent.mouseDown(rightResizeHandle, { clientX: 800 });
    const moveEventX = new MouseEvent("mousemove", { clientX: 600 });
    act(() => {
      document.dispatchEvent(moveEventX);
    });
    act(() => {
      document.dispatchEvent(upEvent);
    });

    // Close
    const closeButton = screen.getByTitle("Close DevTools");
    await act(async () => {
      closeButton.click();
    });

    vi.unstubAllGlobals();
  });
});
