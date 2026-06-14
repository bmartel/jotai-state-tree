import { describe, it, expect, vi } from "vitest";
import React from "react";
import { types, getGlobalStore, applySnapshot, getSnapshot } from "../index";
import {
  runWithStore,
  createSSRStore,
  createSSRHandler,
  createServerAction,
  matchRoute,
} from "../ssr";

// Define a simple test model
const Todo = types
  .model("Todo", {
    id: types.identifier,
    text: types.string,
    completed: types.optional(types.boolean, false),
  })
  .actions((self) => ({
    toggle() {
      self.completed = !self.completed;
    },
    setText(text: string) {
      self.text = text;
    },
  }));

const RootStore = types
  .model("RootStore", {
    todos: types.array(Todo),
  })
  .actions((self) => ({
    addTodo(id: string, text: string) {
      self.todos.push(Todo.create({ id, text }));
    },
  }));

describe("SSR Module", () => {
  it("should isolate stores across concurrent async execution contexts", async () => {
    const storeA = createSSRStore();
    const storeB = createSSRStore();

    let valueInContextA: any;
    let valueInContextB: any;

    const promiseA = runWithStore(storeA, async () => {
      const appStore = RootStore.create({ todos: [] });
      appStore.addTodo("1", "Task A");
      // Yield execution to simulate concurrent async request handling
      await new Promise((r) => setTimeout(r, 50));
      valueInContextA = getSnapshot(appStore);
    });

    const promiseB = runWithStore(storeB, async () => {
      const appStore = RootStore.create({ todos: [] });
      appStore.addTodo("2", "Task B");
      await new Promise((r) => setTimeout(r, 20));
      valueInContextB = getSnapshot(appStore);
    });

    await Promise.all([promiseA, promiseB]);

    // Context A should only have Task A
    expect(valueInContextA.todos).toHaveLength(1);
    expect(valueInContextA.todos[0].text).toBe("Task A");

    // Context B should only have Task B
    expect(valueInContextB.todos).toHaveLength(1);
    expect(valueInContextB.todos[0].text).toBe("Task B");
  });

  it("should match routes correctly with dynamic path parameters", () => {
    const routes = [
      { path: "/" },
      { path: "/tasks" },
      { path: "/tasks/:id" },
      { path: "/settings" },
    ];

    const match1 = matchRoute(routes, "/tasks/123");
    expect(match1).not.toBeNull();
    expect(match1?.route.path).toBe("/tasks/:id");
    expect(match1?.params.id).toBe("123");

    const match2 = matchRoute(routes, "/settings/");
    expect(match2).not.toBeNull();
    expect(match2?.route.path).toBe("/settings");

    const match3 = matchRoute(routes, "/unknown");
    expect(match3).toBeNull();
  });

  it("should run page loaders and inject state into template in createSSRHandler", async () => {
    const routes = [
      {
        path: "/tasks/:id",
        loader: async (store: any, params: any) => {
          store.addTodo(params.id, `Loaded task ${params.id}`);
        },
      },
    ];

    const handler = createSSRHandler({
      createStore: () => RootStore.create({ todos: [] }),
      routes,
      renderApp: async (store) => {
        return `<div>Todos count: ${store.todos.length}</div>`;
      },
      template: "<html><body><!--app-html--><!--app-state--></body></html>",
    });

    const mockReq = {
      url: "/tasks/999",
      headers: { host: "localhost" },
      method: "GET",
    };

    const mockRes = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      end: vi.fn(),
    };

    const handled = await handler(mockReq, mockRes);
    expect(handled).toBe(true);
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.headers["Content-Type"]).toBe("text/html");

    const htmlOutput = mockRes.end.mock.calls[0][0] as string;
    expect(htmlOutput).toContain("<div>Todos count: 1</div>");
    expect(htmlOutput).toContain('window.__JST_DATA__ = {"todos":[{"id":"999","text":"Loaded task 999","completed":false}]};');
  });

  it("should execute server actions and return result + patches", async () => {
    const actions = {
      renameTodo: async (store: any, { id, newText }: { id: string; newText: string }) => {
        const todo = store.todos.find((t: any) => t.id === id);
        if (todo) {
          todo.setText(newText);
          return "success";
        }
        return "not-found";
      },
    };

    const handler = createSSRHandler({
      createStore: () => RootStore.create({ todos: [] }),
      actions,
      renderApp: async () => "",
      template: "",
    });

    // Client state before action
    const clientStore = RootStore.create({
      todos: [{ id: "1", text: "Original Text", completed: false }],
    });

    const mockReq = {
      url: "/api/_jst_action",
      headers: { host: "localhost" },
      method: "POST",
      on(event: string, callback: any) {
        if (event === "data") {
          callback(
            Buffer.from(
              JSON.stringify({
                actionName: "renameTodo",
                args: { id: "1", newText: "Updated Text" },
                clientSnapshot: getSnapshot(clientStore),
              })
            )
          );
        }
        if (event === "end") {
          callback();
        }
      },
    };

    const mockRes = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      end: vi.fn(),
    };

    const handled = await handler(mockReq, mockRes);
    expect(handled).toBe(true);
    expect(mockRes.statusCode).toBe(200);

    const jsonOutput = JSON.parse(mockRes.end.mock.calls[0][0]);
    expect(jsonOutput.result).toBe("success");
    expect(jsonOutput.patches).toHaveLength(1);
    expect(jsonOutput.patches[0]).toEqual({
      op: "replace",
      path: "/todos/0/text",
      value: "Updated Text",
    });
  });
});
