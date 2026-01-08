/**
 * Model type implementation
 * This is the core of jotai-state-tree
 *
 * MEMORY MANAGEMENT:
 * - View and action caches are bounded with LRU eviction
 * - Caches are instance-scoped, so they're GC'd with the instance
 * - No global caches that could accumulate entries
 */

import { atom, type WritableAtom } from "jotai";
import type {
  IModelType,
  ModelProperties,
  ModelCreationType,
  ModelSnapshotType,
  ModelInstance,
  ModelViews,
  ModelActions,
  ModelVolatile,
  IType,
  IValidationContext,
  IValidationResult,
  IAnyType,
} from "./types";
import {
  StateTreeNode,
  $treenode,
  getStateTreeNode,
  trackAction,
  getGlobalStore,
} from "./tree";

// ============================================================================
// LRU Cache Implementation
// ============================================================================

/** Maximum entries in view/action caches per instance */
const MAX_CACHE_SIZE = 100;

/**
 * Simple LRU cache with bounded size
 * When capacity is reached, oldest entries are evicted
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = MAX_CACHE_SIZE) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Delete first if exists to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Model Type Factory
// ============================================================================

interface LifecycleHooks<Self> {
  afterCreate?: (self: Self) => void;
  afterAttach?: (self: Self) => void;
  beforeDetach?: (self: Self) => void;
  beforeDestroy?: (self: Self) => void;
}

interface ModelTypeConfig<
  P extends ModelProperties,
  V extends object,
  A extends object,
  Vol extends object,
> {
  name: string;
  properties: P;
  views: ModelViews<ModelInstance<P, V, A, Vol> & V & A & Vol, V>[];
  actions: ModelActions<ModelInstance<P, V, A, Vol> & V & A & Vol, A>[];
  volatiles: ModelVolatile<ModelInstance<P, V, A, Vol> & V & A & Vol, Vol>[];
  preProcessor?: (snapshot: unknown) => ModelCreationType<P>;
  postProcessor?: (snapshot: ModelSnapshotType<P>) => unknown;
  initializers: Array<
    (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => void
  >;
  hooks: LifecycleHooks<ModelInstance<P, V, A, Vol> & V & A & Vol>;
}

class ModelType<
  P extends ModelProperties,
  V extends object,
  A extends object,
  Vol extends object,
> implements IModelType<P, V, A, Vol>
{
  readonly _kind = "model" as const;
  readonly _C!: ModelCreationType<P>;
  readonly _S!: ModelSnapshotType<P>;
  readonly _T!: ModelInstance<P, V, A, Vol> & V & A & Vol;

  readonly name: string;
  readonly properties: P;
  readonly identifierAttribute?: string;

  private config: ModelTypeConfig<P, V, A, Vol>;

  constructor(config: ModelTypeConfig<P, V, A, Vol>) {
    this.config = config;
    this.name = config.name;
    this.properties = config.properties;

    // Find identifier attribute
    for (const [key, type] of Object.entries(config.properties)) {
      if (
        (type as IAnyType)._kind === "identifier" ||
        (type as IAnyType)._kind === "identifierNumber"
      ) {
        this.identifierAttribute = key;
        break;
      }
    }
  }

  create(
    snapshot?: ModelCreationType<P>,
    env?: unknown,
  ): ModelInstance<P, V, A, Vol> & V & A & Vol {
    // Apply pre-processor if exists
    let processedSnapshot = snapshot ?? {};
    if (this.config.preProcessor) {
      processedSnapshot = this.config.preProcessor(
        processedSnapshot,
      ) as ModelCreationType<P>;
    }

    // Create the tree node
    const node = new StateTreeNode(this, processedSnapshot, env);
    node.preProcessor = this.config.preProcessor as
      | ((snapshot: unknown) => unknown)
      | undefined;
    node.postProcessor = this.config.postProcessor as
      | ((snapshot: unknown) => unknown)
      | undefined;

    // Create property atoms and child nodes
    const propertyAtoms = new Map<
      string,
      WritableAtom<unknown, [unknown], void>
    >();
    const store = getGlobalStore();

    for (const [key, propType] of Object.entries(this.properties)) {
      const type = propType as IAnyType;
      const initialValue = (processedSnapshot as Record<string, unknown>)?.[
        key
      ];

      // Check if this is a complex type that creates its own tree node
      // This includes direct model/array/map, or wrapper types like maybe/late that contain them
      const isComplexType =
        type._kind === "model" ||
        type._kind === "array" ||
        type._kind === "map";

      if (isComplexType) {
        // Complex types create their own nodes
        const childInstance = type.create(initialValue, env);
        const childNode = getStateTreeNode(childInstance);
        node.addChild(key, childNode);
        propertyAtoms.set(key, childNode.valueAtom);
      } else {
        // For wrapper types (maybe, late, optional, etc.), create the value first
        // and check if it has a tree node (meaning it wraps a complex type)
        const value = type.create(initialValue, env);

        // Check if the created value has a tree node (complex type inside wrapper)
        if (value && typeof value === "object" && $treenode in value) {
          const childNode = getStateTreeNode(value);
          node.addChild(key, childNode);
          propertyAtoms.set(key, childNode.valueAtom);
        } else {
          // Simple/primitive types use direct atoms
          const propAtom = atom(value);
          propertyAtoms.set(key, propAtom);

          // Create a "virtual" child node for the property
          const childNode = new StateTreeNode(type, value, env, node, key);
          childNode.valueAtom = propAtom as unknown as WritableAtom<
            unknown,
            [unknown],
            void
          >;
          node.addChild(key, childNode);
        }
      }
    }

    // Build the instance proxy
    const instance = this.createInstanceProxy(node, propertyAtoms, store);

    // Register identifier if present
    if (this.identifierAttribute) {
      const idValue = (processedSnapshot as Record<string, unknown>)?.[
        this.identifierAttribute
      ];
      if (idValue !== undefined) {
        node.registerIdentifier(this.name, idValue as string | number);
      }
    }

    // Set instance on node
    node.setInstance(instance);

    // Run initializers (afterCreate hooks)
    for (const initializer of this.config.initializers) {
      initializer(instance);
    }

    // Run afterCreate lifecycle hook
    if (this.config.hooks.afterCreate) {
      this.config.hooks.afterCreate(instance);
    }

    return instance;
  }

  private createInstanceProxy(
    node: StateTreeNode,
    propertyAtoms: Map<string, WritableAtom<unknown, [unknown], void>>,
    store: ReturnType<typeof getGlobalStore>,
  ): ModelInstance<P, V, A, Vol> & V & A & Vol {
    const self = this;
    // Use bounded LRU caches to prevent unbounded memory growth
    // These caches are instance-scoped and will be GC'd with the instance
    const viewCache = new LRUCache<string, unknown>(MAX_CACHE_SIZE);
    const actionCache = new LRUCache<string, Function>(MAX_CACHE_SIZE);

    // Collect all views
    const allViews: Record<string, PropertyDescriptor> = {};

    // Collect all actions
    const allActions: Record<string, Function> = {};

    // Collect volatile state
    const volatileState: Record<string, unknown> = {};

    // Create base object with tree node reference
    const base = {
      [$treenode]: node,
    };

    // Create the proxy
    const proxy = new Proxy(base, {
      get(target, prop) {
        // Handle symbol access
        if (prop === $treenode) {
          return node;
        }

        // Handle $treenode string access
        if (prop === "$treenode") {
          return node;
        }

        const propStr = String(prop);

        // Check properties first
        if (propertyAtoms.has(propStr)) {
          const childNode = node.getChild(propStr);
          if (childNode) {
            // Check if the child node has an instance (complex types like model, array, map)
            // This handles both direct complex types and wrapper types (maybe, late, optional)
            // that contain complex types
            const instance = childNode.getInstance();
            if (instance !== undefined) {
              // Check if instance is a state tree node (complex type)
              if (
                instance &&
                typeof instance === "object" &&
                $treenode in instance
              ) {
                return instance;
              }
            }
            // For primitive types, get from atom
            return store.get(propertyAtoms.get(propStr)!);
          }
        }

        // Check volatile state
        if (propStr in node.volatileState) {
          return node.volatileState[propStr];
        }

        // Check views
        if (propStr in allViews) {
          const descriptor = allViews[propStr];
          if (descriptor.get) {
            return descriptor.get.call(proxy);
          }
          if (typeof descriptor.value === "function") {
            return descriptor.value.bind(proxy);
          }
          return descriptor.value;
        }

        // Check actions
        if (propStr in allActions) {
          return allActions[propStr];
        }

        return undefined;
      },

      set(target, prop, value) {
        const propStr = String(prop);

        // Check if it's a property
        if (propertyAtoms.has(propStr)) {
          const propType = (self.properties as Record<string, IAnyType>)[
            propStr
          ];
          const existingChildNode = node.getChild(propStr);

          // Handle direct complex types
          if (propType._kind === "model") {
            if (existingChildNode) {
              // For models, apply snapshot
              const { applySnapshotToNode } = require("./tree");
              applySnapshotToNode(existingChildNode, value);
            }
            return true;
          }

          if (propType._kind === "array" || propType._kind === "map") {
            if (existingChildNode) {
              // For arrays/maps, replace content
              existingChildNode.setValue(value);
            }
            return true;
          }

          // Handle wrapper types (maybe, late, optional, etc.) and primitives
          // These may contain complex types that need proper lifecycle management

          // Get old value for patch
          const oldValue = existingChildNode?.getValue();

          // Destroy the old child node if it exists
          if (existingChildNode) {
            existingChildNode.destroy();
            node.getChildren().delete(propStr);
          }

          // Create new value through the type
          const newValue = propType.create(value, node.$env);

          // Check if the new value is a complex type (has tree node)
          if (
            newValue &&
            typeof newValue === "object" &&
            $treenode in newValue
          ) {
            const newChildNode = getStateTreeNode(newValue);
            node.addChild(propStr, newChildNode);
            propertyAtoms.set(propStr, newChildNode.valueAtom);
          } else {
            // Primitive value - create a new child node for it
            const newChildNode = new StateTreeNode(
              propType,
              newValue,
              node.$env,
              node,
              propStr,
            );
            const propAtom = atom(newValue);
            newChildNode.valueAtom = propAtom as unknown as WritableAtom<
              unknown,
              [unknown],
              void
            >;
            node.addChild(propStr, newChildNode);
            propertyAtoms.set(propStr, propAtom);
            store.set(propAtom, newValue);
          }

          // Notify about the change - use node's notification methods
          node.notifyPropertyChange(propStr, newValue, oldValue);

          return true;
        }

        // Check if it's volatile state
        if (propStr in node.volatileState) {
          node.volatileState[propStr] = value;
          return true;
        }

        return false;
      },

      has(target, prop) {
        const propStr = String(prop);
        return (
          prop === $treenode ||
          propertyAtoms.has(propStr) ||
          propStr in allViews ||
          propStr in allActions ||
          propStr in node.volatileState
        );
      },

      ownKeys() {
        return [
          ...propertyAtoms.keys(),
          ...Object.keys(allViews),
          ...Object.keys(allActions),
          ...Object.keys(node.volatileState),
        ];
      },

      getOwnPropertyDescriptor(target, prop) {
        const propStr = String(prop);
        if (
          propertyAtoms.has(propStr) ||
          propStr in allViews ||
          propStr in allActions ||
          propStr in node.volatileState
        ) {
          return {
            configurable: true,
            enumerable: true,
            writable: true,
          };
        }
        return undefined;
      },
    }) as unknown as ModelInstance<P, V, A, Vol> & V & A & Vol;

    // Initialize views
    for (const viewFn of this.config.views) {
      const views = viewFn(proxy);
      for (const [key, value] of Object.entries(
        Object.getOwnPropertyDescriptors(views),
      )) {
        allViews[key] = value;
      }
    }

    // Initialize actions
    for (const actionFn of this.config.actions) {
      const actions = actionFn(proxy);
      for (const [key, value] of Object.entries(actions)) {
        if (typeof value === "function") {
          // Wrap action with tracking
          allActions[key] = (...args: unknown[]) => {
            return trackAction(node, key, args, () => {
              return (value as Function).apply(proxy, args);
            });
          };
        }
      }
    }

    // Initialize volatile state
    for (const volatileFn of this.config.volatiles) {
      const volatile = volatileFn(proxy);
      Object.assign(node.volatileState, volatile);
    }

    return proxy;
  }

  is(value: unknown): value is ModelInstance<P, V, A, Vol> & V & A & Vol {
    if (!value || typeof value !== "object") return false;
    if (!($treenode in value)) return false;
    const node = (value as Record<typeof $treenode, StateTreeNode>)[$treenode];
    return node.$type === this || node.$type.name === this.name;
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    const errors: IValidationResult["errors"] = [];

    if (!value || typeof value !== "object") {
      return {
        valid: false,
        errors: [
          {
            context,
            value,
            message: `Value is not an object`,
          },
        ],
      };
    }

    // Validate each property
    for (const [key, propType] of Object.entries(this.properties)) {
      const propValue = (value as Record<string, unknown>)[key];
      const propContext: IValidationContext = {
        path: context.length > 0 ? `${context[0].path}/${key}` : `/${key}`,
        type: propType as IAnyType,
        parent: value,
      };

      const result = (propType as IAnyType).validate(propValue, [
        ...context,
        propContext,
      ]);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================================
  // Model Modifiers
  // ============================================================================

  named(name: string): IModelType<P, V, A, Vol> {
    return new ModelType({
      ...this.config,
      name,
    });
  }

  props<P2 extends ModelProperties>(
    properties: P2,
  ): IModelType<P & P2, V, A, Vol> {
    return new ModelType({
      ...this.config,
      properties: { ...this.config.properties, ...properties },
    }) as unknown as IModelType<P & P2, V, A, Vol>;
  }

  views<V2 extends object>(
    fn: ModelViews<ModelInstance<P, V, A, Vol> & V & A & Vol, V2>,
  ): IModelType<P, V & V2, A, Vol> {
    return new ModelType({
      ...this.config,
      views: [
        ...this.config.views,
        fn as unknown as ModelViews<
          ModelInstance<P, V, A, Vol> & V & A & Vol,
          V
        >,
      ],
    }) as unknown as IModelType<P, V & V2, A, Vol>;
  }

  actions<A2 extends object>(
    fn: ModelActions<ModelInstance<P, V, A, Vol> & V & A & Vol, A2>,
  ): IModelType<P, V, A & A2, Vol> {
    return new ModelType({
      ...this.config,
      actions: [
        ...this.config.actions,
        fn as unknown as ModelActions<
          ModelInstance<P, V, A, Vol> & V & A & Vol,
          A
        >,
      ],
    }) as unknown as IModelType<P, V, A & A2, Vol>;
  }

  volatile<Vol2 extends object>(
    fn: ModelVolatile<ModelInstance<P, V, A, Vol> & V & A & Vol, Vol2>,
  ): IModelType<P, V, A, Vol & Vol2> {
    return new ModelType({
      ...this.config,
      volatiles: [
        ...this.config.volatiles,
        fn as unknown as ModelVolatile<
          ModelInstance<P, V, A, Vol> & V & A & Vol,
          Vol
        >,
      ],
    }) as unknown as IModelType<P, V, A, Vol & Vol2>;
  }

  preProcessSnapshot<NewC>(
    fn: (snapshot: NewC) => ModelCreationType<P>,
  ): IModelType<P, V, A, Vol> {
    return new ModelType({
      ...this.config,
      preProcessor: fn as unknown as (
        snapshot: unknown,
      ) => ModelCreationType<P>,
    });
  }

  postProcessSnapshot<NewS>(
    fn: (snapshot: ModelSnapshotType<P>) => NewS,
  ): IModelType<P, V, A, Vol> {
    return new ModelType({
      ...this.config,
      postProcessor: fn as unknown as (
        snapshot: ModelSnapshotType<P>,
      ) => unknown,
    });
  }

  extend<
    V2 extends object = object,
    A2 extends object = object,
    Vol2 extends object = object,
  >(
    fn: (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => {
      views?: V2;
      actions?: A2;
      state?: Vol2;
    },
  ): IModelType<P, V & V2, A & A2, Vol & Vol2> {
    // Create wrapper functions for views, actions, and volatile
    const viewsFn = (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => {
      const result = fn(self);
      return (result.views ?? {}) as V2;
    };

    const actionsFn = (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => {
      const result = fn(self);
      return (result.actions ?? {}) as A2;
    };

    const volatileFn = (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => {
      const result = fn(self);
      return (result.state ?? {}) as Vol2;
    };

    return new ModelType({
      ...this.config,
      views: [
        ...this.config.views,
        viewsFn as unknown as ModelViews<
          ModelInstance<P, V, A, Vol> & V & A & Vol,
          V
        >,
      ],
      actions: [
        ...this.config.actions,
        actionsFn as unknown as ModelActions<
          ModelInstance<P, V, A, Vol> & V & A & Vol,
          A
        >,
      ],
      volatiles: [
        ...this.config.volatiles,
        volatileFn as unknown as ModelVolatile<
          ModelInstance<P, V, A, Vol> & V & A & Vol,
          Vol
        >,
      ],
    }) as unknown as IModelType<P, V & V2, A & A2, Vol & Vol2>;
  }

  /**
   * Add afterCreate lifecycle hook
   */
  afterCreate(
    fn: (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => void,
  ): IModelType<P, V, A, Vol> {
    return new ModelType({
      ...this.config,
      hooks: {
        ...this.config.hooks,
        afterCreate: fn,
      },
    });
  }

  /**
   * Add afterAttach lifecycle hook
   */
  afterAttach(
    fn: (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => void,
  ): IModelType<P, V, A, Vol> {
    return new ModelType({
      ...this.config,
      hooks: {
        ...this.config.hooks,
        afterAttach: fn,
      },
    });
  }

  /**
   * Add beforeDetach lifecycle hook
   */
  beforeDetach(
    fn: (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => void,
  ): IModelType<P, V, A, Vol> {
    return new ModelType({
      ...this.config,
      hooks: {
        ...this.config.hooks,
        beforeDetach: fn,
      },
    });
  }

  /**
   * Add beforeDestroy lifecycle hook
   */
  beforeDestroy(
    fn: (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => void,
  ): IModelType<P, V, A, Vol> {
    return new ModelType({
      ...this.config,
      hooks: {
        ...this.config.hooks,
        beforeDestroy: fn,
      },
    });
  }
}

// ============================================================================
// Model Factory Function
// ============================================================================

export function model<P extends ModelProperties>(
  name: string,
  properties: P,
): IModelType<P, object, object, object>;

export function model<P extends ModelProperties>(
  properties: P,
): IModelType<P, object, object, object>;

export function model<P extends ModelProperties>(
  nameOrProperties: string | P,
  maybeProperties?: P,
): IModelType<P, object, object, object> {
  const name =
    typeof nameOrProperties === "string" ? nameOrProperties : "AnonymousModel";
  const properties =
    typeof nameOrProperties === "string" ? maybeProperties! : nameOrProperties;

  return new ModelType({
    name,
    properties,
    views: [],
    actions: [],
    volatiles: [],
    initializers: [],
    hooks: {},
  });
}

// ============================================================================
// Compose Models
// ============================================================================

export function compose<
  PA extends ModelProperties,
  PB extends ModelProperties,
  VA extends object,
  VB extends object,
  AA extends object,
  AB extends object,
  VolA extends object,
  VolB extends object,
>(
  name: string,
  a: IModelType<PA, VA, AA, VolA>,
  b: IModelType<PB, VB, AB, VolB>,
): IModelType<PA & PB, VA & VB, AA & AB, VolA & VolB>;

export function compose<
  PA extends ModelProperties,
  PB extends ModelProperties,
  VA extends object,
  VB extends object,
  AA extends object,
  AB extends object,
  VolA extends object,
  VolB extends object,
>(
  a: IModelType<PA, VA, AA, VolA>,
  b: IModelType<PB, VB, AB, VolB>,
): IModelType<PA & PB, VA & VB, AA & AB, VolA & VolB>;

export function compose(...args: unknown[]): unknown {
  const name = typeof args[0] === "string" ? args[0] : "ComposedModel";
  const types = (
    typeof args[0] === "string" ? args.slice(1) : args
  ) as IModelType<ModelProperties, object, object, object>[];

  // Merge all properties
  const mergedProperties: ModelProperties = {};
  for (const type of types) {
    Object.assign(mergedProperties, type.properties);
  }

  return model(name, mergedProperties);
}
