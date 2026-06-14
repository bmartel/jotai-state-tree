/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { types, clearAllRegistries, resetGlobalStore, isAlive } from '../index';
import {
  usePatches,
  useCleanup,
  useHydrateStore,
  Provider,
  useStore,
  useStoreSnapshot,
  observer,
  useTimeTravelManager,
  RouteView,
  RouterContext,
  useSyncedStore,
  useLocalObservable,
  useSnapshot,
  useIsAlive,
  useWatchPath,
  useAction,
  useActions,
  batch,
  scheduleUpdate,
  useUndoManager,
  useObserverTracking,
  createStoreContext,
  RouterProvider,
} from '../react';
import { $treenode } from '../tree';

describe('React Extra Hooks & Bindings', () => {
  const Todo = types.model('Todo', {
    id: types.identifier,
    text: types.string,
    done: types.optional(types.boolean, false),
  })
  .actions((self) => ({
    toggle() {
      self.done = !self.done;
    },
    setText(text: string) {
      self.text = text;
    },
  }));

  it('usePatches hook', async () => {
    const todo = Todo.create({ id: '1', text: 'Task' });
    const patchCallback = vi.fn();

    const TestComponent = () => {
      usePatches(todo, patchCallback);
      return <div>Test</div>;
    };

    const { unmount } = render(<TestComponent />);

    act(() => {
      todo.toggle();
    });

    expect(patchCallback).toHaveBeenCalled();
    expect(patchCallback.mock.calls[0][0].op).toBe('replace');
    expect(patchCallback.mock.calls[0][0].path).toBe('/done');

    unmount();
  });

  it('useCleanup hook', () => {
    const cleanupSpy = vi.fn();

    const TestComponent = () => {
      useCleanup(cleanupSpy);
      return <div>Test</div>;
    };

    const { unmount } = render(<TestComponent />);
    expect(cleanupSpy).not.toHaveBeenCalled();

    unmount();
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it('useHydrateStore SSR hydration hook', () => {
    const store = Todo.create({ id: '1', text: 'Initial' });

    const HydratedComponent = observer(() => {
      // Hydrate with different text
      useHydrateStore(store, { id: '1', text: 'Hydrated', done: true });
      return <div data-testid="text">{store.text} - {store.done ? 'done' : 'pending'}</div>;
    });

    render(<HydratedComponent />);
    expect(screen.getByTestId('text').textContent).toBe('Hydrated - done');
  });

  it('deprecated Provider and useStore hooks', () => {
    const store = Todo.create({ id: '1', text: 'Root' });

    // Should throw if used outside Provider
    const BadComponent = () => {
      useStore();
      return null;
    };
    expect(() => render(<BadComponent />)).toThrow('[jotai-state-tree] useStore must be used within a Provider');
    cleanup(); // clear error boundary logs

    // Should work inside Provider
    const GoodComponent = observer(() => {
      const s = useStore<any>();
      const snapshot = useStoreSnapshot<any>();
      return <div data-testid="store">{s.text} - {snapshot.text}</div>;
    });

    render(
      <Provider store={store}>
        <GoodComponent />
      </Provider>
    );

    expect(screen.getByTestId('store').textContent).toBe('Root - Root');
  });

  it('useTimeTravel React hook', async () => {
    const store = Todo.create({ id: '1', text: 'Root' });

    const TestComponent = observer(() => {
      const controller = useTimeTravelManager(store, { maxSnapshots: 5, autoRecord: true });
      return (
        <div>
          <button data-testid="undo" onClick={() => controller.goBack()} disabled={!controller.canGoBack}>Undo</button>
          <button data-testid="redo" onClick={() => controller.goForward()} disabled={!controller.canGoForward}>Redo</button>
        </div>
      );
    });

    render(<TestComponent />);
    expect((screen.getByTestId('undo') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('redo') as HTMLButtonElement).disabled).toBe(true);

    // Trigger state change and wait for action grouping microtask
    await act(async () => {
      store.toggle();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    // Can undo now
    expect((screen.getByTestId('undo') as HTMLButtonElement).disabled).toBe(false);
  });

  it('RouteView component rendering', () => {
    const Home = ({ id, query }: any) => <div data-testid="home">Home Page: {id} - {query.q}</div>;
    const About = () => <div data-testid="about">About Page</div>;
    const pages = { home: Home, about: About };

    const mockRouter = {
      currentRouteName: 'home',
      params: { id: '123' },
      query: { q: 'search' },
    };

    // Test with explicit router prop
    const { rerender } = render(<RouteView router={mockRouter} pages={pages} />);
    expect(screen.getByTestId('home').textContent).toBe('Home Page: 123 - search');

    // Test fallback when route not found
    const emptyRouter = {
      currentRouteName: 'unknown',
      params: {},
      query: {},
    };
    rerender(<RouteView router={emptyRouter} pages={pages} fallback={<div data-testid="fallback">Not Found</div>} />);
    expect(screen.getByTestId('fallback').textContent).toBe('Not Found');

    // Test with RouterContext
    render(
      <RouterContext.Provider value={mockRouter}>
        <RouteView pages={pages} />
      </RouterContext.Provider>
    );
    expect(screen.getByTestId('home').textContent).toBe('Home Page: 123 - search');

    // Test error when no router in context
    const BadRouteView = () => <RouteView pages={pages} />;
    expect(() => render(<BadRouteView />)).toThrow("RouteView must be provided a router prop or used within a RouterContext.Provider");
    cleanup();
  });

  it('hooks with non-node targets', () => {
    const nonNode = { x: 1 };
    
    // useSyncedStore
    const TestSynced = () => {
      const res = useSyncedStore(nonNode);
      return <div data-testid="synced">{res.x}</div>;
    };
    render(<TestSynced />);
    expect(screen.getByTestId('synced').textContent).toBe('1');
    cleanup();

    // useSnapshot
    const TestSnap = () => {
      const res = useSnapshot(nonNode);
      return <div data-testid="snap">{res.x}</div>;
    };
    render(<TestSnap />);
    expect(screen.getByTestId('snap').textContent).toBe('1');
    cleanup();

    // useIsAlive
    const TestAlive = () => {
      const alive = useIsAlive(nonNode);
      return <div data-testid="alive">{alive ? 'yes' : 'no'}</div>;
    };
    render(<TestAlive />);
    expect(screen.getByTestId('alive').textContent).toBe('no');
    cleanup();

    // useHydrateStore (should not throw)
    const TestHydrate = () => {
      useHydrateStore(nonNode, { x: 2 });
      return <div>Hydrate</div>;
    };
    expect(() => render(<TestHydrate />)).not.toThrow();
    cleanup();
  });

  it('useWatchPath fallback behaviors', () => {
    const nonNode = { x: 1 };

    // 1. Non-node target returns default value
    const TestNonNode = () => {
      const val = useWatchPath(nonNode, 'x', 999);
      return <div data-testid="val">{val}</div>;
    };
    render(<TestNonNode />);
    expect(screen.getByTestId('val').textContent).toBe('999');
    cleanup();

    // 2. StateTree target, watch existing and missing paths
    const store = Todo.create({ id: '1', text: 'Task' });
    const TestWatch = observer(() => {
      const textVal = useWatchPath(store, 'text', 'fallback');
      const missingVal = useWatchPath(store, 'nested.prop', 'missing_fallback');
      return <div data-testid="vals">{textVal} - {missingVal}</div>;
    });
    render(<TestWatch />);
    expect(screen.getByTestId('vals').textContent).toBe('Task - missing_fallback');
    cleanup();
  });

  it('useAction and useActions hooks', () => {
    const actFn = () => {};
    const actionsObj = { a: actFn };

    const TestHooks = () => {
      const single = useAction(actFn);
      const multiple = useActions(actionsObj);
      expect(single).toBe(actFn);
      expect(multiple).toBe(actionsObj);
      return <div>Hooks</div>;
    };
    render(<TestHooks />);
    cleanup();
  });

  it('batch updates and scheduleUpdate', () => {
    const spy = vi.fn();
    
    // Direct scheduleUpdate runs immediately when not batching
    scheduleUpdate(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    // Batch buffers updates
    const spy2 = vi.fn();
    batch(() => {
      scheduleUpdate(spy2);
      scheduleUpdate(spy2);
      expect(spy2).not.toHaveBeenCalled();
    });
    expect(spy2).toHaveBeenCalledTimes(1); // called once at the end of batch
  });

  it('observer forwardRef support', () => {
    const ForwardedComponent = observer(
      React.forwardRef((props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({ test: 'ok' }));
        return <div data-testid="forward">Forwarded</div>;
      }),
      { forwardRef: true }
    );

    const ref = React.createRef<any>();
    render(<ForwardedComponent ref={ref} />);
    expect(screen.getByTestId('forward').textContent).toBe('Forwarded');
    expect(ref.current.test).toBe('ok');
    cleanup();
  });

  it('useUndoManager / useTimeTravelManager throwing and method validation', () => {
    const BadUndo = () => {
      useUndoManager('not_object');
      return null;
    };
    const BadTime = () => {
      useTimeTravelManager('not_object');
      return null;
    };

    expect(() => render(<BadUndo />)).toThrow();
    cleanup();
    expect(() => render(<BadTime />)).toThrow();
    cleanup();


    const store = Todo.create({ id: '1', text: 'Initial' });
    const TestComponent = observer(() => {
      const undoMgr = useUndoManager(store);
      const timeTravelMgr = useTimeTravelManager(store, { autoRecord: true });

      // Run some of the helper methods/accessors to trigger coverage
      const triggerMethods = () => {
        undoMgr.startGroup();
        store.setText('Change 1');
        undoMgr.endGroup();

        undoMgr.withoutUndo(() => {
          store.setText('Change 2');
        });

        undoMgr.undo();
        undoMgr.redo();
        undoMgr.clear();
        undoMgr.dispose();

        timeTravelMgr.record();
        const snap = timeTravelMgr.getSnapshot(0);
        expect(snap).toBeDefined();
        timeTravelMgr.goTo(0);
        timeTravelMgr.clear();
        timeTravelMgr.dispose();
      };

      return (
        <div>
          <button data-testid="trigger" onClick={triggerMethods}>Trigger</button>
          <div data-testid="stats">
            {undoMgr.undoLevels} - {undoMgr.redoLevels} - {timeTravelMgr.currentIndex} - {timeTravelMgr.snapshotCount}
          </div>
        </div>
      );
    });

    render(<TestComponent />);
    expect(screen.getByTestId('stats').textContent).toBe('0 - 0 - 0 - 1');
    act(() => {
      screen.getByTestId('trigger').click();
    });
    cleanup();
  });

  it('react additional edge cases and branch coverage', () => {
    // 1. useObserverTracking within an observer component
    const Child = types.model({ name: types.string });
    const inst = Child.create({ name: 'alice' });
    let trackFn: any = null;
    const TestTracking = observer(() => {
      trackFn = useObserverTracking();
      return null;
    });
    render(<TestTracking />);
    expect(trackFn).toBeTypeOf('function');
    trackFn(inst);
    cleanup();

    // 2. Provider plain object context and useStoreSnapshot / useTypedStoreSnapshot
    const plainStore = { text: 'plain' };
    const TestPlainSnap = () => {
      const snap = useStoreSnapshot<any>();
      return <div data-testid="plain-snap">{snap.text}</div>;
    };
    render(
      <Provider store={plainStore}>
        <TestPlainSnap />
      </Provider>
    );
    expect(screen.getByTestId('plain-snap').textContent).toBe('plain');
    cleanup();

    const { Provider: TypedProvider, useStoreSnapshot: useTypedSnapshot } = createStoreContext<any>();
    const TestTypedPlainSnap = () => {
      const snap = useTypedSnapshot();
      return <div data-testid="typed-plain-snap">{snap.text}</div>;
    };
    render(
      <TypedProvider store={plainStore}>
        <TestTypedPlainSnap />
      </TypedProvider>
    );
    expect(screen.getByTestId('typed-plain-snap').textContent).toBe('plain');
    cleanup();

    // 3. observer HOC called with a class component
    const ClassComponent = class extends React.Component<any> {
      render() {
        return <div data-testid="class-comp">{this.props.name}</div>;
      }
    };
    const ObservedClass = observer(ClassComponent);
    render(<ObservedClass name="test-class" />);
    expect(screen.getByTestId('class-comp').textContent).toBe('test-class');
    cleanup();

    // 4. useHydrateStore missing properties and non-StateTreeNode target
    const ModelHydrate = types.model({
      child: types.model({ name: types.string }),
    });
    const instHydrate = ModelHydrate.create({ child: { name: 'alice' } });
    const HydrateMissingComp = observer(() => {
      useHydrateStore(instHydrate, {});
      return null;
    });
    render(<HydrateMissingComp />);
    cleanup();

    const mockRootNodeObj = {
      $isAlive: true,
      $path: '',
      $type: { name: 'RootType' },
      getInstance: () => instMock,
      setValue: vi.fn(),
    } as any;
    const instMock = {
      [$treenode]: mockRootNodeObj,
    };
    const HydrateMockComp = observer(() => {
      useHydrateStore(instMock, { val: 1 });
      return null;
    });
    render(<HydrateMockComp />);
    cleanup();

    // 5. getters on UndoManager and TimeTravelManager
    const storeUndo = Todo.create({ id: '1', text: 'Initial' });
    const TestUndoGetters = observer(() => {
      const undoMgr = useUndoManager(storeUndo);
      const timeTravelMgr = useTimeTravelManager(storeUndo);
      return (
        <div data-testid="getters">
          {undoMgr.historyIndex} - {undoMgr.history.length} - {timeTravelMgr.canGoForward ? 'yes' : 'no'} - {timeTravelMgr.getSnapshot(0) !== undefined ? 'yes' : 'no'}
        </div>
      );
    });
    render(<TestUndoGetters />);
    expect(screen.getByTestId('getters').textContent).toContain('-1 - 0 - no - yes');
    cleanup();

    // 6. RouteView without fallback renders null
    const pagesRoute = { home: () => <div>Home</div> };
    const mockRouterNoRoute = {
      currentRouteName: 'unknown',
      params: {},
      query: {},
    };
    const { container } = render(<RouteView router={mockRouterNoRoute} pages={pagesRoute} />);
    expect(container.firstChild).toBeNull();
    cleanup();

    // 7. useObserverTracking non-node call
    let trackFnMock: any = null;
    const TestTrackingNonNode = observer(() => {
      trackFnMock = useObserverTracking();
      return null;
    });
    render(<TestTrackingNonNode />);
    expect(trackFnMock).toBeTypeOf('function');
    expect(() => trackFnMock(null)).not.toThrow();
    cleanup();

    // 8. observer with functional component with forwardRef true option
    const ForwardRefFunc = observer((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ inner: 'val' }));
      return <div data-testid="fr-func">FR Func</div>;
    }, { forwardRef: true });
    const refFunc = React.createRef<any>();
    render(<ForwardRefFunc ref={refFunc} />);
    expect(screen.getByTestId('fr-func').textContent).toBe('FR Func');
    expect(refFunc.current.inner).toBe('val');
    cleanup();

    // 9. useLocalObservable with plain object
    const TestLocalPlain = () => {
      const res = useLocalObservable(() => ({ x: 42 }));
      return <div data-testid="local-plain">{res.x}</div>;
    };
    render(<TestLocalPlain />);
    expect(screen.getByTestId('local-plain').textContent).toBe('42');
    cleanup();

    // 10. useObserverTracking outside observer context returns null
    const TestTrackingOutside = () => {
      const track = useObserverTracking();
      expect(track).toBeNull();
      return <div data-testid="outside">outside</div>;
    };
    render(<TestTrackingOutside />);
    cleanup();

    // 11. observer HOC called with Class component and forwardRef: true option
    class LegacyClassComp extends React.Component<any> {
      render() {
        return <div data-testid="legacy">{this.props.name}</div>;
      }
    }
    const ObservedLegacy = observer(LegacyClassComp, { forwardRef: true });
    const refLegacy = React.createRef<any>();
    render(<ObservedLegacy name="legacy-val" ref={refLegacy} />);
    expect(screen.getByTestId('legacy').textContent).toBe('legacy-val');
    cleanup();

    // 12. createStoreContext Provider with createStore prop
    const SimpleModel = types.model('SimpleModel', {
      value: types.string,
    });
    const { Provider: SimpleProvider, useStore: useSimpleStore } = createStoreContext<any>();
    
    let renderedStore: any = null;
    const TestComp = () => {
      renderedStore = useSimpleStore();
      return <div data-testid="val">{renderedStore.value}</div>;
    };

    let storeCreatedCount = 0;
    const createFn = () => {
      storeCreatedCount++;
      return SimpleModel.create({ value: 'hello' });
    };

    const { unmount } = render(
      <SimpleProvider createStore={createFn}>
        <TestComp />
      </SimpleProvider>
    );

    expect(screen.getByTestId('val').textContent).toBe('hello');
    expect(storeCreatedCount).toBe(1);
    expect(isAlive(renderedStore)).toBe(true);

    unmount();
    expect(isAlive(renderedStore)).toBe(true); // Not destroyed on unmount anymore for StrictMode compatibility
    cleanup();

    // 13. Provider and RouterProvider recreation warnings
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const TestRecreation = ({ step }: { step: number }) => {
      const currentStore = SimpleModel.create({ value: `val-${step}` });
      return (
        <SimpleProvider store={currentStore}>
          <div>test</div>
        </SimpleProvider>
      );
    };

    const { rerender } = render(<TestRecreation step={1} />);
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    rerender(<TestRecreation step={2} />);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Warning: A new store instance was passed to <Provider> on render")
    );
    consoleWarnSpy.mockRestore();
    cleanup();
  });
});


