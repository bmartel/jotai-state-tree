import { describe, it, expect, vi } from 'vitest';
import { types, addMiddleware, destroy, detach, flow, applyAction } from '../index';
import {
  escapeJsonPath,
  unescapeJsonPath,
  splitJsonPath,
  joinJsonPath,
  createDependencyTracker,
  withDependencyTracking,
  trackDependency,
  registerHooks,
  runAfterCreate,
  getRunningActionContext,
  setRunningActionContext,
  typecheck,
  tryResolve,
  getType,
  isType,
  getChildType,
} from '../lifecycle';
import { $treenode } from '../tree';

describe('Lifecycle & Middleware Extra', () => {
  it('beforeDetach, beforeDestroy, afterAttach lifecycle hooks', () => {
    const afterAttachSpy = vi.fn();
    const beforeDetachSpy = vi.fn();
    const beforeDestroySpy = vi.fn();

    const Child = types.model('Child', {
      id: types.identifier,
    })
    .actions((self) => ({
      afterAttach() {
        afterAttachSpy();
      },
      beforeDetach() {
        beforeDetachSpy();
      },
      beforeDestroy() {
        beforeDestroySpy();
      },
    }));

    const Parent = types.model('Parent', {
      child: types.maybe(Child),
    });

    const child = Child.create({ id: 'child-1' });
    expect(afterAttachSpy).toHaveBeenCalledTimes(0);

    const parent = Parent.create({ child });
    expect(afterAttachSpy).toHaveBeenCalledTimes(1);

    detach(parent.child);
    expect(beforeDetachSpy).toHaveBeenCalledTimes(1);

    destroy(child);
    expect(beforeDestroySpy).toHaveBeenCalledTimes(1);
  });

  it('middlewares chain and aborts', () => {
    const Counter = types.model('Counter', {
      count: types.number,
    })
    .actions((self) => ({
      increment(amount: number) {
        self.count += amount;
        return self.count;
      },
    }));

    const counter = Counter.create({ count: 10 });
    const middlewareLogs: string[] = [];

    // Middleware 1: logs
    const dispose1 = addMiddleware(counter, (call, next) => {
      middlewareLogs.push(`m1-start-${call.name}`);
      const result = next(call);
      middlewareLogs.push(`m1-end-${call.name}-${result}`);
      return result;
    });

    // Middleware 2: aborts if amount is 100
    const dispose2 = addMiddleware(counter, (call, next, abort) => {
      if (call.args[0] === 100) {
        return abort(999);
      }
      return next(call);
    });

    const res1 = counter.increment(5);
    expect(res1).toBe(15);
    expect(counter.count).toBe(15);
    expect(middlewareLogs).toEqual(['m1-start-increment', 'm1-end-increment-15']);

    middlewareLogs.length = 0;
    const res2 = counter.increment(100);
    expect(res2).toBe(999);
    expect(counter.count).toBe(15); // should not have mutated count
    expect(middlewareLogs).toEqual(['m1-start-increment', 'm1-end-increment-999']);

    dispose1();
    dispose2();
  });

  it('flow cancellation when node is destroyed', async () => {
    let promiseResolve: any;
    const delayPromise = new Promise((resolve) => {
      promiseResolve = resolve;
    });

    const AsyncModel = types.model('AsyncModel', {
      status: types.string,
    })
    .actions((self) => ({
      runTask: flow(function* () {
        self.status = 'running';
        try {
          yield delayPromise;
          self.status = 'done';
        } catch (e: any) {
          self.status = 'error: ' + e.message;
          throw e;
        }
      }),
    }));

    const instance = AsyncModel.create({ status: 'idle' });
    const taskPromise = instance.runTask();

    expect(instance.status).toBe('running');

    // Destroy the instance mid-flow
    destroy(instance);

    // Resolve the promise to trigger step continuation
    promiseResolve();

    // The task should reject with FLOW_CANCELLED since node was destroyed
    await expect(taskPromise).rejects.toThrow('FLOW_CANCELLED');
  });

  it('json path conversion helpers', () => {
    // escape / unescape JSON paths
    expect(escapeJsonPath('a/b~c')).toBe('a~1b~0c');
    expect(unescapeJsonPath('a~1b~0c')).toBe('a/b~c');

    // split / join
    expect(splitJsonPath('/a/b/c')).toEqual(['a', 'b', 'c']);
    expect(joinJsonPath(['a', 'b', 'c'])).toBe('a/b/c');
  });

  it('builder-based afterAttach, beforeDetach, beforeDestroy hooks', () => {
    const afterAttachSpy = vi.fn();
    const beforeDetachSpy = vi.fn();
    const beforeDestroySpy = vi.fn();

    const Child = types.model('Child', {
      id: types.identifier,
    })
    .afterAttach((self) => {
      afterAttachSpy();
    })
    .beforeDetach((self) => {
      beforeDetachSpy();
    })
    .beforeDestroy((self) => {
      beforeDestroySpy();
    });

    const Parent = types.model('Parent', {
      child: types.maybe(Child),
    });

    const child = Child.create({ id: 'child-2' });
    const parent = Parent.create({ child });
    expect(afterAttachSpy).toHaveBeenCalledTimes(1);

    detach(parent.child);
    expect(beforeDetachSpy).toHaveBeenCalledTimes(1);

    destroy(child);
    expect(beforeDestroySpy).toHaveBeenCalledTimes(1);
  });

  it('dependency tracking helpers', () => {
    const tracker = createDependencyTracker();
    const atomObj = {};
    withDependencyTracking(tracker, () => {
      trackDependency(atomObj);
    });
    expect(tracker.getTracked().has(atomObj)).toBe(true);
  });

  it('applyAction error cases', () => {
    const Model = types.model({
      value: types.string
    }).actions(self => ({
      setValue(v: string) {
        self.value = v;
      }
    }));
    const instance = Model.create({ value: 'a' });
    expect(() => applyAction(instance, { name: 'nonExistent', path: '', args: [] })).toThrow("Action 'nonExistent' not found");
    expect(() => applyAction(instance, { name: 'setValue', path: '/invalidPath', args: [] })).toThrow("Invalid action path");
  });

  it('registerHooks chain', () => {
    const Child = types.model('Child', {
      id: types.identifier,
    });
    const store = Child.create({ id: 'c-1' });
    const node = store[$treenode];

    const spy1 = vi.fn();
    const spy2 = vi.fn();

    // Register twice to chain hooks
    registerHooks(node, { afterCreate: spy1 });
    registerHooks(node, { afterCreate: spy2 });

    runAfterCreate(node);
    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);
  });

  it('global middlewares and next callback', () => {
    const Counter = types.model('Counter', {
      count: types.number,
    })
    .actions((self) => ({
      increment(amount: number) {
        self.count += amount;
        return self.count;
      },
    }));

    const counter = Counter.create({ count: 10 });
    const globalLogs: string[] = [];

    // Register global middleware (first arg is null/object)
    const disposeGlobal = addMiddleware(null, (call, next) => {
      globalLogs.push(`global-start-${call.name}`);
      // Test next() with callback
      const result = next(call, (res) => {
        globalLogs.push(`callback-${res}`);
        return (res as number) * 2;
      });
      return result;
    });

    const res = counter.increment(5);
    expect(res).toBe(30); // 15 * 2
    expect(globalLogs).toEqual(['global-start-increment', 'callback-15']);

    disposeGlobal();
  });

  it('flow direct execution without node', async () => {
    // 1. Success path
    const successFlow = flow(function* (val: number) {
      const p = yield Promise.resolve(val + 10);
      return p;
    });
    const res = await successFlow(5);
    expect(res).toBe(15);

    // 2. Reject path
    const failFlow = flow(function* () {
      yield Promise.reject(new Error('fail'));
    });
    await expect(failFlow()).rejects.toThrow('fail');
  });

  it('action context getters and setters', () => {
    const orig = getRunningActionContext();
    const mockCtx = {} as any;
    setRunningActionContext(mockCtx);
    expect(getRunningActionContext()).toBe(mockCtx);
    setRunningActionContext(orig); // restore
  });

  it('typecheck and tryResolve utility validation helpers', () => {
    const Child = types.model('Child', {
      id: types.identifier,
    });

    // typecheck
    expect(() => typecheck(types.string, 123)).toThrow("Value 123 is not assignable to type 'string'");
    expect(() => typecheck(types.string, 'abc')).not.toThrow();

    // tryResolve
    expect(tryResolve(types.string, 'abc')).toBe('abc');
    expect(tryResolve(types.string, 123)).toBeUndefined();

    // getType & isType
    const child = Child.create({ id: 'c-1' });
    expect(getType(child)).toBe(Child);
    expect(isType(child, Child)).toBe(true);

    // getChildType
    const ParentModel = types.model('ParentModel', {
      childProp: Child,
    });
    const parent = ParentModel.create({ childProp: { id: 'c-2' } });
    expect(getChildType(parent, 'childProp')).toBe(Child);
    expect(() => getChildType(parent, 'nonExistent')).toThrow("Property 'nonExistent' not found");
  });

  it('applyAction path navigation', () => {
    const Target = types.model('Target', {
      val: types.string,
    }).actions(self => ({
      setVal(v: string) {
        self.val = v;
      }
    }));
    
    const Container = types.model('Container', {
      target: Target,
    });

    const root = Container.create({
      target: { val: 'initial' },
    });

    applyAction(root, {
      name: 'setVal',
      path: '/target',
      args: ['updated'],
    });

    expect(root.target.val).toBe('updated');
  });
});

