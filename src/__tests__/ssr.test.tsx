import { describe, it, expect, vi } from "vitest";
import React from "react";
import { types, getGlobalStore, applySnapshot, getSnapshot } from "../index";
import {
  runWithStore,
  createSSRStore,
  createSSRHandler,
  matchRoute,
  startSSRServer,
} from "../ssr";
import { createServerAction } from "../react";

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

  it("should handle custom api routes, template function, unknown action, action error, loader error, and body parse error", async () => {
    const handler = createSSRHandler({
      createStore: () => RootStore.create({ todos: [] }),
      apiRoutes: {
        "/foo": async (req, res) => {
          res.statusCode = 200;
          res.end("api-foo");
        }
      },
      routes: [
        {
          path: "/fail-loader",
          loader: async (store) => {
            throw new Error("Loader Error");
          }
        }
      ],
      actions: {
        failingAction: async () => {
          throw new Error("Action failed");
        }
      },
      renderApp: () => "<div>App</div>",
      template: async ({ html, state }) => `<html>${html}-${state}</html>`
    });

    const mockRes = () => ({
      statusCode: 0,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      end: vi.fn(),
    });

    // 1. Custom API Route
    const resApi = mockRes();
    const handledApi = await handler({ url: "/api/foo", method: "GET", headers: {} }, resApi);
    expect(handledApi).toBe(true);
    expect(resApi.end).toHaveBeenCalledWith("api-foo");

    // 2. Action Not Found (404)
    const res404 = mockRes();
    const req404 = {
      url: "/api/_jst_action",
      method: "POST",
      headers: {},
      on: (event: string, callback: any) => {
        if (event === "data") callback(Buffer.from(JSON.stringify({ actionName: "unknownAction" })));
        if (event === "end") callback();
      }
    };
    const handled404 = await handler(req404, res404);
    expect(handled404).toBe(true);
    expect(res404.statusCode).toBe(404);

    // 3. Action Error (500)
    const res500 = mockRes();
    const req500 = {
      url: "/api/_jst_action",
      method: "POST",
      headers: {},
      on: (event: string, callback: any) => {
        if (event === "data") callback(Buffer.from(JSON.stringify({ actionName: "failingAction" })));
        if (event === "end") callback();
      }
    };
    const handled500 = await handler(req500, res500);
    expect(handled500).toBe(true);
    expect(res500.statusCode).toBe(500);

    // 4. Request Body Parse/Stream Error (rejection)
    const resErr = mockRes();
    const reqErr = {
      url: "/api/_jst_action",
      method: "POST",
      headers: {},
      on: (event: string, callback: any) => {
        if (event === "error") callback(new Error("Stream Error"));
      }
    };
    await expect(handler(reqErr, resErr)).rejects.toThrow("Stream Error");

    // 5. Template as a function and Page Loader Error
    const resLoad = mockRes();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handledLoad = await handler({ url: "/fail-loader", method: "GET", headers: {} }, resLoad);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
    expect(handledLoad).toBe(true);
    expect(resLoad.statusCode).toBe(200);
    expect(resLoad.end.mock.calls[0][0]).toContain("<div>App</div>");

    // 6. Non-matching request returns false
    const resNone = mockRes();
    const handledNone = await handler({ url: "/static/asset.js", method: "GET", headers: {} }, resNone);
    expect(handledNone).toBe(false);
  });

  it("should start and close standalone SSR server", async () => {
    const server = startSSRServer({
      createStore: () => RootStore.create({ todos: [] }),
      renderApp: () => "<div>Server App</div>",
      template: "<html><!--app-html--></html>",
      port: 9888,
    });
    expect(server).toBeDefined();

    // Verify it handles request (port 9888)
    const res = await fetch("http://localhost:9888/");
    const text = await res.text();
    expect(text).toContain("<div>Server App</div>");

    // Verify it handles 404 for unmatched paths
    const res404 = await fetch("http://localhost:9888/static/not-found");
    expect(res404.status).toBe(404);

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    // Verify it handles 500 errors when createStore throws
    const serverErr = startSSRServer({
      createStore: () => { throw new Error("Database offline"); },
      renderApp: () => "<div>Server App</div>",
      template: "<html><!--app-html--></html>",
      port: 9889,
    });
    const resErr = await fetch("http://localhost:9889/");
    expect(resErr.status).toBe(500);
    const textErr = await resErr.text();
    expect(textErr).toBe("Database offline");
    await new Promise<void>((resolve) => {
      serverErr.close(() => resolve());
    });
  });
});

