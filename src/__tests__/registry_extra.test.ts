import { describe, it, expect, vi } from 'vitest';
import { types } from '../index';
import {
  registerModel,
  unregisterModel,
  isModelRegistered,
  resolveModel,
  tryResolveModel,
  resolveModelAsync,
  getModelMetadata,
  getRegisteredModelNames,
  onModelRegistered,
  clearModelRegistry,
} from '../registry';
import { getRegistryStats, cleanupStaleEntries, clearAllRegistries } from '../tree';
import * as treeModule from '../tree';

describe('Model Registry & Dynamic References Extra', () => {
  it('register and unregister models', () => {
    clearModelRegistry();

    const TestModel = types.model('RegisteredModel', {
      value: types.string,
    });

    expect(isModelRegistered('RegisteredModel')).toBe(false);
    registerModel('RegisteredModel', TestModel, { version: '1.0' });
    expect(isModelRegistered('RegisteredModel')).toBe(true);

    const resolved = resolveModel('RegisteredModel');
    expect(resolved).toBe(TestModel);

    const tryResolved = tryResolveModel('RegisteredModel');
    expect(tryResolved).toBe(TestModel);

    expect(getRegisteredModelNames()).toContain('RegisteredModel');
    expect(getModelMetadata('RegisteredModel')).toBeDefined();

    unregisterModel('RegisteredModel');
    expect(isModelRegistered('RegisteredModel')).toBe(false);
  });

  it('async model resolution and listeners', async () => {
    clearModelRegistry();
    const registerSpy = vi.fn();

    const disposeListener = onModelRegistered((name, type) => {
      if (name === 'DelayedModel') {
        registerSpy(type);
      }
    });

    const resolvePromise = resolveModelAsync('DelayedModel');

    // Model is not yet registered
    expect(registerSpy).toHaveBeenCalledTimes(0);

    const DelayedModel = types.model('DelayedModel', {});
    registerModel('DelayedModel', DelayedModel);

    // Listener should trigger immediately
    expect(registerSpy).toHaveBeenCalledWith(DelayedModel);

    // Promise should resolve to the model
    const resolved = await resolvePromise;
    expect(resolved).toBe(DelayedModel);

    disposeListener();
  });

  it('registry stats and cleanups', () => {
    clearAllRegistries();
    const stats = getRegistryStats();
    expect(stats.nodeRegistrySize).toBeDefined();

    cleanupStaleEntries(); // should not throw
  });

  it('dynamicReference and safeDynamicReference', () => {
    clearAllRegistries();

    const Target = types.model('TargetModel', {
      id: types.identifier,
      name: types.string,
    });
    registerModel('TargetModel', Target);

    const Container = types.model('Container', {
      targetId: types.string,
      // Resolve target dynamically by type name
      targetRef: types.dynamicReference('TargetModel'),
      safeTargetRef: types.safeDynamicReference('TargetModel'),
    });

    const root = types.model('Root', {
      targets: types.array(Target),
      container: Container,
    }).create({
      targets: [
        { id: 't-1', name: 'target one' },
      ],
      container: {
        targetId: 't-1',
        targetRef: 't-1',
        safeTargetRef: 't-1',
      },
    });

    // Check dynamic reference resolutions
    expect(root.container.targetRef).toBeDefined();
    expect(root.container.targetRef.name).toBe('target one');
    expect(root.container.safeTargetRef?.name).toBe('target one');

    // Test safe dynamic reference when target is missing
    const root2 = types.model('Root2', {
      targets: types.array(Target),
      container: Container,
    }).create({
      targets: [],
      container: {
        targetId: 'missing',
        targetRef: 'missing', // will fail on lookup
        safeTargetRef: 'missing', // will resolve to undefined safely
      },
    });

    expect(root2.container.safeTargetRef).toBeUndefined();
    expect(() => root2.container.targetRef).toThrow(); // throws lookup error

    // Test safeDynamicReference validate() failure with incorrect identifier type (e.g. object)
    const validationResult = Container.validate({
      targetId: 't-1',
      targetRef: 't-1',
      safeTargetRef: {} as any, // should trigger validation error
    }, []);
    expect(validationResult.valid).toBe(false);
    expect(validationResult.errors[0].message).toContain("Reference identifier must be a string, number, or undefined");

    // Test onInvalidated option for safeDynamicReference
    const onInvalidatedSpy = vi.fn().mockReturnValue({ name: 'fallback name' });
    const CustomRefContainer = types.model('CustomRefContainer', {
      targetId: types.string,
      ref: types.safeDynamicReference('TargetModel', {
        onInvalidated: onInvalidatedSpy
      })
    });
    const c = CustomRefContainer.create({
      targetId: 'missing',
      ref: 'missing'
    });
    expect(c.ref?.name).toBe('fallback name');
    expect(onInvalidatedSpy).toHaveBeenCalledWith('missing', null);
  });

  it('async resolution timeout cleanup', async () => {
    clearModelRegistry();
    
    // Request async resolution with very short timeout
    const p = resolveModelAsync('NonExistentModel', 5);
    await expect(p).rejects.toThrow('[jotai-state-tree] Timeout waiting for model "NonExistentModel" to be registered');
  });

  it('lateModel validation and is checks', () => {
    clearModelRegistry();
    const LateType = types.lateModel('LateModelTest');
    
    // 1. is check before registration (should return false or throw resolver error)
    expect(LateType.is({})).toBe(false);
    expect(LateType.validate({}, []).valid).toBe(false);

    // 2. Register model and check
    const Actual = types.model('LateModelTest', { x: types.number });
    registerModel('LateModelTest', Actual);
    
    expect(LateType.is(Actual.create({ x: 5 }))).toBe(true);
    expect(LateType.validate({ x: 5 }, []).valid).toBe(true);
  });

  it('dynamicReference proxy reflection and error boundaries', () => {
    clearAllRegistries();
    const RefType = types.dynamicReference<any>('TargetModel');
    
    // 1. create throws on empty identifier
    expect(() => RefType.create(undefined as any)).toThrow(
      "[jotai-state-tree] Cannot create dynamicReference with undefined/null identifier"
    );

    // 2. Validate fails on incorrect type
    expect(RefType.validate(undefined, []).valid).toBe(false);
    expect(RefType.validate({}, []).valid).toBe(false);

    // 3. Proxy reflection with unresolved reference
    const unresolvedProxy = RefType.create('missing');
    expect(RefType.is('missing')).toBe(true); // identifiers are valid
    expect(RefType.is(123)).toBe(true);
    expect(RefType.is({})).toBe(false); // target model not registered, so false

    expect(Reflect.ownKeys(unresolvedProxy)).toEqual([]);
    expect(Reflect.getOwnPropertyDescriptor(unresolvedProxy, 'name')).toBeUndefined();
    expect('name' in unresolvedProxy).toBe(false);

    // 4. Register and verify reflection succeeds
    const Target = types.model('TargetModel', {
      id: types.identifier,
      name: types.string,
    });
    registerModel('TargetModel', Target);
    
    // Create an instance so resolveIdentifier can find it
    const inst = Target.create({ id: 't-1', name: 'resolved' });
    const resolvedProxy = RefType.create('t-1');
    expect(Reflect.ownKeys(resolvedProxy)).toContain('name');
    expect(Reflect.getOwnPropertyDescriptor(resolvedProxy, 'name')).toBeDefined();
    expect('name' in resolvedProxy).toBe(true);
    expect(resolvedProxy.name).toBe('resolved');

    // 5. SafeDynamicReference validate boundaries
    const SafeRefType = types.safeDynamicReference<any>('TargetModel');
    expect(SafeRefType.validate(undefined, []).valid).toBe(true); // undefined is valid for safe reference
    expect(SafeRefType.validate({}, []).valid).toBe(false);
    expect(SafeRefType.is(undefined)).toBe(true);
    expect(SafeRefType.is({})).toBe(false);

    // Test safeDynamicReference with unresolved target
    const safeUnresolvedProxy = SafeRefType.create('missing');
    expect(safeUnresolvedProxy).toBeUndefined();
  });

  it('registry additional edge cases and branch coverage', async () => {
    // 1. Resolution timeout with multiple pending resolutions
    clearModelRegistry();
    const p1 = resolveModelAsync('DelayedModelMultiple', 10);
    const p2 = resolveModelAsync('DelayedModelMultiple', 10);
    let err1: any;
    let err2: any;
    const c1 = p1.catch(e => { err1 = e; });
    const c2 = p2.catch(e => { err2 = e; });
    await Promise.all([c1, c2]);
    expect(err1).toBeDefined();
    expect(err2).toBeDefined();

    // 2. DynamicReference tryResolve when resolveIdentifier throws
    const Target = types.model('TargetModelReg', {
      id: types.identifier,
      name: types.string,
    });
    registerModel('TargetModelReg', Target);

    const RefType = types.dynamicReference<any>('TargetModelReg');
    const inst = Target.create({ id: 't-1', name: 'target' });

    const spy = vi.spyOn(treeModule, 'resolveIdentifier').mockImplementation(() => {
      throw new Error('mock error');
    });
    const proxy = RefType.create('t-1');
    expect(() => proxy.name).toThrow(); // throws inside tryResolve's get handler
    spy.mockRestore();

    // 3. DynamicReferenceType.is when target type is resolved and checking model instances
    expect(RefType.is(inst)).toBe(true);
    expect(RefType.is({ name: 'not-instance' })).toBe(false);

    // 4. SafeDynamicReferenceType tryResolve when targetType is not resolved
    clearModelRegistry();
    const SafeRefUnresolved = types.safeDynamicReference<any>('TargetModelUnresolved');
    expect(SafeRefUnresolved.create('missing')).toBeUndefined();

    // 5. SafeDynamicReferenceType tryResolve when resolution throws an error (with and without onInvalidated options)
    registerModel('TargetModelReg', Target);
    const SafeRef = types.safeDynamicReference<any>('TargetModelReg');
    const spySafe = vi.spyOn(treeModule, 'resolveIdentifier').mockImplementation(() => {
      throw new Error('mock error');
    });
    expect(SafeRef.create('t-1')).toBeUndefined();

    const onInvalidatedSpy = vi.fn().mockReturnValue('fallback-value');
    const SafeRefInvalidated = types.safeDynamicReference<any>('TargetModelReg', {
      onInvalidated: onInvalidatedSpy
    });
    expect(SafeRefInvalidated.create('t-1')).toBe('fallback-value');
    expect(onInvalidatedSpy).toHaveBeenCalled();
    spySafe.mockRestore();

    // 6. SafeDynamicReferenceType.is when target model is not found, and validation on valid string identifier
    clearModelRegistry();
    const SafeRefNoModel = types.safeDynamicReference<any>('TargetModelNoExist');
    expect(SafeRefNoModel.is({})).toBe(false);
    expect(SafeRefNoModel.is('valid-id')).toBe(true);
    expect(SafeRefNoModel.is(123)).toBe(true);
    expect(SafeRefNoModel.validate('valid-id', []).valid).toBe(true);

    // 7. lateModel memoized resolution call (call getType() twice)
    const LateModelMemo = types.lateModel('MemoModel');
    const ActualMemo = types.model('MemoModel', { val: types.number });
    registerModel('MemoModel', ActualMemo);
    const m1 = LateModelMemo.create({ val: 42 });
    const m2 = LateModelMemo.create({ val: 43 });
    expect(m1.val).toBe(42);
    expect(m2.val).toBe(43);

    // 8. DynamicReference with onInvalidated returning falsy (should throw fallback error)
    const RefTypeFalsy = types.dynamicReference<any>('TargetModelReg', {
      onInvalidated: () => null as any,
    });
    const proxyFalsy = RefTypeFalsy.create('missing');
    expect(() => proxyFalsy.name).toThrow('[jotai-state-tree] Failed to resolve dynamicReference("TargetModelReg") with identifier "missing"');
  });

  it('pending resolutions timeout edge cases', async () => {
    vi.useFakeTimers();
    clearModelRegistry();

    // 1. Test clearModelRegistry with pending resolutions (covers lines 196-197, 280-281)
    const pClear = resolveModelAsync('ClearModelTest', 100);
    clearModelRegistry();
    await expect(pClear).rejects.toThrow('[jotai-state-tree] Model registry was cleared while waiting for "ClearModelTest"');

    // 2. Test timeout when pending is falsy (covers line 203 false branch)
    // Mock clearTimeout to do nothing
    const spyClear = vi.spyOn(global, 'clearTimeout').mockImplementation(() => {});
    
    const p1 = resolveModelAsync('FalsyPendingTest', 100);
    const Actual = types.model('FalsyPendingTest', {});
    registerModel('FalsyPendingTest', Actual); // resolves and deletes FalsyPendingTest from pending
    
    // Now trigger timeout callback
    vi.advanceTimersByTime(100);
    await expect(p1).resolves.toBe(Actual);

    // 3. Test timeout when index < 0 (covers line 205 false branch)
    const p2 = resolveModelAsync('IndexNegativeTest', 100);
    clearModelRegistry(); // Rejects p2, deletes IndexNegativeTest from pending
    
    // Add a new pending to recreate the name entry in Map
    const p3 = resolveModelAsync('IndexNegativeTest', 200);
    p3.catch(() => {});
    
    // Trigger p2's timeout (which was not cleared because of mock)
    vi.advanceTimersByTime(100);
    
    await expect(p2).rejects.toThrow();
    
    spyClear.mockRestore();
    vi.useRealTimers();
  });
});

