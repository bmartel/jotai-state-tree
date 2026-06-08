import { describe, it, expect, vi } from 'vitest';
import {
  types,
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
    registerModel(TestModel);
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

    const disposeListener = onModelRegistered('DelayedModel', registerSpy);

    const resolvePromise = resolveModelAsync('DelayedModel');

    // Model is not yet registered
    expect(registerSpy).toHaveBeenCalledTimes(0);

    const DelayedModel = types.model('DelayedModel', {});
    registerModel(DelayedModel);

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
    expect(stats.totalNodes).toBeDefined();

    cleanupStaleEntries(); // should not throw
  });

  it('dynamicReference and safeDynamicReference', () => {
    clearAllRegistries();

    const Target = types.model('TargetModel', {
      id: types.identifier,
      name: types.string,
    });
    registerModel(Target);

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
  });
});
