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
});

