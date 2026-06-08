import { describe, it, expect, vi } from 'vitest';
import { types, addMiddleware, destroy, detach } from '../index';
import {
  escapeJsonPath,
  unescapeJsonPath,
  splitJsonPath,
  joinJsonPath,
} from '../lifecycle';

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
      runTask: types.flow(function* () {
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
});
