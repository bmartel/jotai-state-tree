/**
 * Model Registry for Dynamic Model Registration
 *
 * Enables plugin architectures, code splitting, and lazy loading of models.
 * Models can be registered at runtime and resolved dynamically.
 *
 * @example
 * // In a plugin or lazy-loaded module:
 * registerModel("UserProfile", UserProfileModel);
 *
 * // In main app, before plugin loads:
 * const LazyUserProfile = types.lateModel("UserProfile");
 *
 * // Reference that resolves dynamically:
 * const ref = types.dynamicReference("UserProfile", userId);
 */

import type {
  IAnyType,
  IType,
  IValidationContext,
  IValidationResult,
} from "./types";
import {
  $treenode,
  getStateTreeNode,
  StateTreeNode,
  resolveIdentifier,
} from "./tree";

// ============================================================================
// Model Registry
// ============================================================================

/** Registered model entry */
interface ModelEntry {
  type: IAnyType;
  /** Optional metadata for the model */
  metadata?: Record<string, unknown>;
}

/** Pending resolution callbacks for models not yet registered */
interface PendingResolution {
  resolve: (type: IAnyType) => void;
  reject: (error: Error) => void;
}

/** The global model registry */
const modelRegistry = new Map<string, ModelEntry>();

/** Pending resolutions for models that haven't been registered yet */
const pendingResolutions = new Map<string, PendingResolution[]>();

/** Listeners for model registration events */
const registrationListeners = new Set<(name: string, type: IAnyType) => void>();

/**
 * Register a model type with a name for dynamic resolution.
 *
 * @param name - Unique name for the model
 * @param type - The model type to register
 * @param metadata - Optional metadata to associate with the model
 * @throws Error if a model with the same name is already registered
 *
 * @example
 * const UserModel = types.model("User", { id: types.identifier, name: types.string });
 * registerModel("User", UserModel);
 *
 * // Later, in a plugin:
 * registerModel("UserProfile", types.model("UserProfile", {
 *   user: types.reference(resolveModel("User")),
 *   bio: types.string
 * }));
 */
export function registerModel(
  name: string,
  type: IAnyType,
  metadata?: Record<string, unknown>,
): void {
  if (modelRegistry.has(name)) {
    throw new Error(
      `[jotai-state-tree] Model "${name}" is already registered. ` +
        `Use unregisterModel() first if you want to replace it.`,
    );
  }

  modelRegistry.set(name, { type, metadata });

  // Resolve any pending resolutions
  const pending = pendingResolutions.get(name);
  if (pending) {
    pending.forEach(({ resolve }) => resolve(type));
    pendingResolutions.delete(name);
  }

  // Notify listeners
  registrationListeners.forEach((listener) => listener(name, type));
}

/**
 * Unregister a model type.
 *
 * @param name - Name of the model to unregister
 * @returns true if the model was unregistered, false if it wasn't registered
 *
 * @example
 * unregisterModel("UserProfile");
 */
export function unregisterModel(name: string): boolean {
  return modelRegistry.delete(name);
}

/**
 * Check if a model is registered.
 *
 * @param name - Name of the model to check
 * @returns true if the model is registered
 */
export function isModelRegistered(name: string): boolean {
  return modelRegistry.has(name);
}

/**
 * Resolve a model type by name (synchronous).
 *
 * @param name - Name of the model to resolve
 * @returns The registered model type
 * @throws Error if the model is not registered
 *
 * @example
 * const UserModel = resolveModel("User");
 * const instance = UserModel.create({ id: "1", name: "John" });
 */
export function resolveModel<T extends IAnyType = IAnyType>(name: string): T {
  const entry = modelRegistry.get(name);
  if (!entry) {
    throw new Error(
      `[jotai-state-tree] Model "${name}" is not registered. ` +
        `Make sure to call registerModel("${name}", YourModelType) before resolving.`,
    );
  }
  return entry.type as T;
}

/**
 * Try to resolve a model type by name (returns undefined if not registered).
 *
 * @param name - Name of the model to resolve
 * @returns The registered model type or undefined
 *
 * @example
 * const UserModel = tryResolveModel("User");
 * if (UserModel) {
 *   const instance = UserModel.create({ id: "1", name: "John" });
 * }
 */
export function tryResolveModel<T extends IAnyType = IAnyType>(
  name: string,
): T | undefined {
  return modelRegistry.get(name)?.type as T | undefined;
}

/**
 * Resolve a model type by name (asynchronous).
 * Waits for the model to be registered if it isn't already.
 *
 * @param name - Name of the model to resolve
 * @param timeout - Optional timeout in milliseconds (default: 30000)
 * @returns Promise that resolves to the model type
 * @throws Error if timeout is reached
 *
 * @example
 * // Wait for a plugin to register its model
 * const UserProfileModel = await resolveModelAsync("UserProfile");
 */
export function resolveModelAsync<T extends IAnyType = IAnyType>(
  name: string,
  timeout: number = 30000,
): Promise<T> {
  // Check if already registered
  const entry = modelRegistry.get(name);
  if (entry) {
    return Promise.resolve(entry.type as T);
  }

  // Create pending resolution
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      // Remove from pending
      const pending = pendingResolutions.get(name);
      if (pending) {
        const index = pending.findIndex((p) => p.resolve === resolve);
        if (index >= 0) {
          pending.splice(index, 1);
          if (pending.length === 0) {
            pendingResolutions.delete(name);
          }
        }
      }
      reject(
        new Error(
          `[jotai-state-tree] Timeout waiting for model "${name}" to be registered`,
        ),
      );
    }, timeout);

    const wrappedResolve = (type: IAnyType) => {
      clearTimeout(timeoutId);
      resolve(type as T);
    };

    const wrappedReject = (error: Error) => {
      clearTimeout(timeoutId);
      reject(error);
    };

    if (!pendingResolutions.has(name)) {
      pendingResolutions.set(name, []);
    }
    pendingResolutions.get(name)!.push({
      resolve: wrappedResolve,
      reject: wrappedReject,
    });
  });
}

/**
 * Get metadata for a registered model.
 *
 * @param name - Name of the model
 * @returns The metadata or undefined
 */
export function getModelMetadata(
  name: string,
): Record<string, unknown> | undefined {
  return modelRegistry.get(name)?.metadata;
}

/**
 * Get all registered model names.
 *
 * @returns Array of registered model names
 */
export function getRegisteredModelNames(): string[] {
  return Array.from(modelRegistry.keys());
}

/**
 * Listen for model registration events.
 *
 * @param listener - Callback invoked when a model is registered
 * @returns Disposer function to remove the listener
 *
 * @example
 * const disposer = onModelRegistered((name, type) => {
 *   console.log(`Model ${name} was registered`);
 * });
 * // Later:
 * disposer();
 */
export function onModelRegistered(
  listener: (name: string, type: IAnyType) => void,
): () => void {
  registrationListeners.add(listener);
  return () => {
    registrationListeners.delete(listener);
  };
}

/**
 * Clear all registered models.
 * Primarily useful for testing.
 */
export function clearModelRegistry(): void {
  modelRegistry.clear();
  // Reject any pending resolutions
  pendingResolutions.forEach((pending, name) => {
    pending.forEach(({ reject }) => {
      reject(
        new Error(
          `[jotai-state-tree] Model registry was cleared while waiting for "${name}"`,
        ),
      );
    });
  });
  pendingResolutions.clear();
}

// ============================================================================
// Late Model Type (Registry-based lazy resolution)
// ============================================================================

/**
 * Late model type that resolves from the registry.
 * Unlike types.late(), this resolves by name from the global registry,
 * allowing models to be registered after the type is defined.
 */
class LateModelType<T extends IAnyType>
  implements
    IType<
      T extends IType<infer C, unknown, unknown> ? C : unknown,
      T extends IType<unknown, infer S, unknown> ? S : unknown,
      T extends IType<unknown, unknown, infer I> ? I : unknown
    >
{
  readonly _kind = "lateModel" as const;
  readonly _modelName: string;
  readonly name: string;

  readonly _C!: T extends IType<infer C, unknown, unknown> ? C : unknown;
  readonly _S!: T extends IType<unknown, infer S, unknown> ? S : unknown;
  readonly _T!: T extends IType<unknown, unknown, infer I> ? I : unknown;

  private _resolvedType?: T;

  constructor(modelName: string) {
    this._modelName = modelName;
    this.name = `lateModel("${modelName}")`;
  }

  private getType(): T {
    if (!this._resolvedType) {
      this._resolvedType = resolveModel<T>(this._modelName);
    }
    return this._resolvedType;
  }

  create(
    snapshot?: T extends IType<infer C, unknown, unknown> ? C : unknown,
    env?: unknown,
  ): T extends IType<unknown, unknown, infer I> ? I : unknown {
    return this.getType().create(snapshot, env) as T extends IType<
      unknown,
      unknown,
      infer I
    >
      ? I
      : unknown;
  }

  is(
    value: unknown,
  ): value is T extends IType<unknown, unknown, infer I> ? I : unknown {
    return this.getType().is(value);
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    return this.getType().validate(value, context);
  }
}

/**
 * Create a late-resolving type that looks up the model from the registry.
 * This allows you to reference models that may not be registered yet.
 *
 * @param modelName - Name of the model in the registry
 * @returns A type that resolves from the registry when used
 *
 * @example
 * // Define a type that references a model not yet registered
 * const PostStore = types.model("PostStore", {
 *   posts: types.array(types.lateModel("Post")),
 *   author: types.reference(types.lateModel("User"))
 * });
 *
 * // Later, register the models (e.g., from a plugin)
 * registerModel("Post", PostModel);
 * registerModel("User", UserModel);
 *
 * // Now PostStore.create() will work
 */
export function lateModel<T extends IAnyType = IAnyType>(
  modelName: string,
): IType<
  T extends IType<infer C, unknown, unknown> ? C : unknown,
  T extends IType<unknown, infer S, unknown> ? S : unknown,
  T extends IType<unknown, unknown, infer I> ? I : unknown
> {
  return new LateModelType<T>(modelName);
}

// ============================================================================
// Dynamic Reference Type (with custom resolvers)
// ============================================================================

/** Options for dynamic references */
export interface DynamicReferenceOptions<T extends IAnyType> {
  /**
   * Custom getter to resolve the reference.
   * If not provided, uses the default identifier-based resolution.
   *
   * @param identifier - The stored identifier value
   * @param parent - The parent node containing the reference
   * @returns The resolved instance or undefined
   */
  get?: (
    identifier: string | number,
    parent: unknown,
  ) => (T extends IType<unknown, unknown, infer I> ? I : unknown) | undefined;

  /**
   * Custom setter to extract the identifier from a value.
   * If not provided, uses the identifier property of the value.
   *
   * @param value - The value being set
   * @param parent - The parent node containing the reference
   * @returns The identifier to store
   */
  set?: (
    value: T extends IType<unknown, unknown, infer I> ? I : unknown,
    parent: unknown,
  ) => string | number;

  /**
   * Called when resolution fails.
   * Can return a fallback value or throw an error.
   */
  onInvalidated?: (
    identifier: string | number,
    parent: unknown,
  ) => (T extends IType<unknown, unknown, infer I> ? I : unknown) | undefined;
}

/**
 * Dynamic reference type with custom resolution logic.
 */
class DynamicReferenceType<T extends IAnyType>
  implements
    IType<
      string | number,
      string | number,
      T extends IType<unknown, unknown, infer I> ? I : unknown
    >
{
  readonly _kind = "dynamicReference" as const;
  readonly _modelName: string;
  readonly _options: DynamicReferenceOptions<T>;
  readonly name: string;

  readonly _C!: string | number;
  readonly _S!: string | number;
  readonly _T!: T extends IType<unknown, unknown, infer I> ? I : unknown;

  constructor(modelName: string, options: DynamicReferenceOptions<T> = {}) {
    this._modelName = modelName;
    this._options = options;
    this.name = `dynamicReference("${modelName}")`;
  }

  create(
    snapshot?: string | number,
    env?: unknown,
  ): T extends IType<unknown, unknown, infer I> ? I : unknown {
    if (snapshot === undefined || snapshot === null) {
      throw new Error(
        `[jotai-state-tree] Cannot create dynamicReference with undefined/null identifier`,
      );
    }

    // Create a proxy that resolves the reference on access
    const self = this;

    // For dynamic references, we return a getter-based proxy
    // The actual resolution happens when properties are accessed
    type InstanceType =
      T extends IType<unknown, unknown, infer I> ? I : unknown;
    const referenceProxy = new Proxy({} as object, {
      get(_target, prop) {
        // Resolve the actual target
        const resolved = self.resolveReference(snapshot, null);
        if (!resolved) {
          if (self._options.onInvalidated) {
            const fallback = self._options.onInvalidated(snapshot, null);
            if (fallback) {
              return (fallback as Record<string | symbol, unknown>)[prop];
            }
          }
          throw new Error(
            `[jotai-state-tree] Failed to resolve dynamicReference("${self._modelName}") with identifier "${snapshot}"`,
          );
        }
        return (resolved as Record<string | symbol, unknown>)[prop];
      },
      has(_target, prop) {
        const resolved = self.resolveReference(snapshot, null);
        if (!resolved) return false;
        return prop in (resolved as object);
      },
      ownKeys(_target) {
        const resolved = self.resolveReference(snapshot, null);
        if (!resolved) return [];
        return Reflect.ownKeys(resolved as object);
      },
      getOwnPropertyDescriptor(_target, prop) {
        const resolved = self.resolveReference(snapshot, null);
        if (!resolved) return undefined;
        return Object.getOwnPropertyDescriptor(resolved as object, prop);
      },
    });

    return referenceProxy as InstanceType;
  }

  private resolveReference(
    identifier: string | number,
    parent: unknown,
  ): (T extends IType<unknown, unknown, infer I> ? I : unknown) | undefined {
    // Use custom getter if provided
    if (this._options.get) {
      return this._options.get(identifier, parent);
    }

    // Default: resolve from identifier registry
    try {
      const targetType = tryResolveModel(this._modelName);
      if (!targetType) {
        return undefined;
      }
      return resolveIdentifier(this._modelName, identifier) as T extends IType<
        unknown,
        unknown,
        infer I
      >
        ? I
        : unknown;
    } catch {
      return undefined;
    }
  }

  is(
    value: unknown,
  ): value is T extends IType<unknown, unknown, infer I> ? I : unknown {
    if (typeof value === "string" || typeof value === "number") {
      return true; // Identifiers are valid
    }
    // Check if it's an instance of the target type
    const targetType = tryResolveModel(this._modelName);
    if (targetType) {
      return targetType.is(value);
    }
    return false;
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    if (value === undefined || value === null) {
      return {
        valid: false,
        errors: [
          {
            context,
            value,
            message: "Reference identifier cannot be undefined or null",
          },
        ],
      };
    }

    if (typeof value !== "string" && typeof value !== "number") {
      return {
        valid: false,
        errors: [
          {
            context,
            value,
            message: "Reference identifier must be a string or number",
          },
        ],
      };
    }

    return { valid: true, errors: [] };
  }
}

/**
 * Create a dynamic reference that resolves from the model registry.
 * Supports custom get/set resolvers for advanced use cases like API fetching.
 *
 * @param modelName - Name of the model in the registry
 * @param options - Optional custom resolution options
 * @returns A reference type
 *
 * @example
 * // Basic usage - resolves from registry
 * const PostStore = types.model("PostStore", {
 *   author: types.dynamicReference("User")
 * });
 *
 * // With custom resolver (e.g., API fetching)
 * const PostStore = types.model("PostStore", {
 *   author: types.dynamicReference("User", {
 *     get(id, parent) {
 *       return userCache.get(id) ?? fetchUserSync(id);
 *     },
 *     set(user) {
 *       return user.id;
 *     },
 *     onInvalidated(id) {
 *       console.warn(`User ${id} not found`);
 *       return undefined;
 *     }
 *   })
 * });
 */
export function dynamicReference<T extends IAnyType = IAnyType>(
  modelName: string,
  options: DynamicReferenceOptions<T> = {},
): IType<
  string | number,
  string | number,
  T extends IType<unknown, unknown, infer I> ? I : unknown
> {
  return new DynamicReferenceType<T>(modelName, options);
}

// ============================================================================
// Safe Dynamic Reference Type
// ============================================================================

/**
 * Safe dynamic reference that returns undefined instead of throwing.
 */
class SafeDynamicReferenceType<T extends IAnyType>
  implements
    IType<
      string | number | undefined,
      string | number | undefined,
      (T extends IType<unknown, unknown, infer I> ? I : unknown) | undefined
    >
{
  readonly _kind = "safeDynamicReference" as const;
  readonly _modelName: string;
  readonly _options: DynamicReferenceOptions<T>;
  readonly name: string;

  readonly _C!: string | number | undefined;
  readonly _S!: string | number | undefined;
  readonly _T!:
    | (T extends IType<unknown, unknown, infer I> ? I : unknown)
    | undefined;

  constructor(modelName: string, options: DynamicReferenceOptions<T> = {}) {
    this._modelName = modelName;
    this._options = options;
    this.name = `safeDynamicReference("${modelName}")`;
  }

  create(
    snapshot?: string | number,
    env?: unknown,
  ): (T extends IType<unknown, unknown, infer I> ? I : unknown) | undefined {
    if (snapshot === undefined || snapshot === null) {
      return undefined;
    }

    // Try to resolve, return undefined if not found
    try {
      if (this._options.get) {
        return this._options.get(snapshot, null);
      }

      const targetType = tryResolveModel(this._modelName);
      if (!targetType) {
        return undefined;
      }
      return resolveIdentifier(this._modelName, snapshot) as T extends IType<
        unknown,
        unknown,
        infer I
      >
        ? I
        : unknown;
    } catch {
      if (this._options.onInvalidated) {
        return this._options.onInvalidated(snapshot, null);
      }
      return undefined;
    }
  }

  is(
    value: unknown,
  ): value is
    | (T extends IType<unknown, unknown, infer I> ? I : unknown)
    | undefined {
    if (value === undefined) return true;
    if (typeof value === "string" || typeof value === "number") return true;
    const targetType = tryResolveModel(this._modelName);
    if (targetType) {
      return targetType.is(value);
    }
    return false;
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    if (value === undefined || value === null) {
      return { valid: true, errors: [] };
    }

    if (typeof value !== "string" && typeof value !== "number") {
      return {
        valid: false,
        errors: [
          {
            context,
            value,
            message:
              "Reference identifier must be a string, number, or undefined",
          },
        ],
      };
    }

    return { valid: true, errors: [] };
  }
}

/**
 * Create a safe dynamic reference that returns undefined instead of throwing.
 *
 * @param modelName - Name of the model in the registry
 * @param options - Optional custom resolution options
 * @returns A safe reference type
 */
export function safeDynamicReference<T extends IAnyType = IAnyType>(
  modelName: string,
  options: DynamicReferenceOptions<T> = {},
): IType<
  string | number | undefined,
  string | number | undefined,
  (T extends IType<unknown, unknown, infer I> ? I : unknown) | undefined
> {
  return new SafeDynamicReferenceType<T>(modelName, options);
}

// ============================================================================
// Type Exports
// ============================================================================

export type { ModelEntry };
