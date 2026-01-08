/**
 * Utility types implementation
 * optional, maybe, maybeNull, union, late, refinement, reference, safeReference
 */

import type {
  IOptionalType,
  IMaybeType,
  IMaybeNullType,
  IUnionType,
  ILateType,
  IRefinementType,
  IReferenceType,
  ISafeReferenceType,
  ReferenceOptions,
  UnionOptions,
  IType,
  IValidationContext,
  IValidationResult,
  IAnyType,
  IAnyModelType,
  Instance,
} from './types';
import { resolveIdentifier, getStateTreeNode, StateTreeNode, $treenode } from './tree';

// ============================================================================
// Optional Type
// ============================================================================

class OptionalType<T extends IAnyType, Default>
  implements IOptionalType<T, Default>
{
  readonly _kind = 'optional' as const;
  readonly _subType: T;
  readonly _defaultValue: Default | (() => Default);
  readonly name: string;

  readonly _C!: (T extends IType<infer C, unknown, unknown> ? C : never) | undefined;
  readonly _S!: T extends IType<unknown, infer S, unknown> ? S : never;
  readonly _T!: T extends IType<unknown, unknown, infer I> ? I : never;

  constructor(subType: T, defaultValue: Default | (() => Default)) {
    this._subType = subType;
    this._defaultValue = defaultValue;
    this.name = `optional<${subType.name}>`;
  }

  create(
    snapshot?: (T extends IType<infer C, unknown, unknown> ? C : never) | undefined,
    env?: unknown
  ): T extends IType<unknown, unknown, infer I> ? I : never {
    if (snapshot === undefined) {
      const defaultVal =
        typeof this._defaultValue === 'function'
          ? (this._defaultValue as () => Default)()
          : this._defaultValue;
      return this._subType.create(defaultVal as unknown, env) as T extends IType<unknown, unknown, infer I> ? I : never;
    }
    return this._subType.create(snapshot, env) as T extends IType<unknown, unknown, infer I> ? I : never;
  }

  is(value: unknown): value is T extends IType<unknown, unknown, infer I> ? I : never {
    return value === undefined || this._subType.is(value);
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    if (value === undefined) {
      return { valid: true, errors: [] };
    }
    return this._subType.validate(value, context);
  }
}

export function optional<T extends IAnyType, D extends T extends IType<infer C, unknown, unknown> ? C : never>(
  type: T,
  defaultValue: D | (() => D)
): IOptionalType<T, D> {
  return new OptionalType(type, defaultValue);
}

// ============================================================================
// Maybe Type (value | undefined)
// ============================================================================

class MaybeType<T extends IAnyType> implements IMaybeType<T> {
  readonly _kind = 'maybe' as const;
  readonly _subType: T;
  readonly name: string;

  readonly _C!: (T extends IType<infer C, unknown, unknown> ? C : never) | undefined;
  readonly _S!: (T extends IType<unknown, infer S, unknown> ? S : never) | undefined;
  readonly _T!: (T extends IType<unknown, unknown, infer I> ? I : never) | undefined;

  constructor(subType: T) {
    this._subType = subType;
    this.name = `maybe<${subType.name}>`;
  }

  create(
    snapshot?: (T extends IType<infer C, unknown, unknown> ? C : never) | undefined,
    env?: unknown
  ): (T extends IType<unknown, unknown, infer I> ? I : never) | undefined {
    if (snapshot === undefined) {
      return undefined;
    }
    return this._subType.create(snapshot, env) as (T extends IType<unknown, unknown, infer I> ? I : never) | undefined;
  }

  is(value: unknown): value is (T extends IType<unknown, unknown, infer I> ? I : never) | undefined {
    return value === undefined || this._subType.is(value);
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    if (value === undefined) {
      return { valid: true, errors: [] };
    }
    return this._subType.validate(value, context);
  }
}

export function maybe<T extends IAnyType>(type: T): IMaybeType<T> {
  return new MaybeType(type);
}

// ============================================================================
// MaybeNull Type (value | null)
// ============================================================================

class MaybeNullType<T extends IAnyType> implements IMaybeNullType<T> {
  readonly _kind = 'maybeNull' as const;
  readonly _subType: T;
  readonly name: string;

  readonly _C!: (T extends IType<infer C, unknown, unknown> ? C : never) | null;
  readonly _S!: (T extends IType<unknown, infer S, unknown> ? S : never) | null;
  readonly _T!: (T extends IType<unknown, unknown, infer I> ? I : never) | null;

  constructor(subType: T) {
    this._subType = subType;
    this.name = `maybeNull<${subType.name}>`;
  }

  create(
    snapshot?: (T extends IType<infer C, unknown, unknown> ? C : never) | null,
    env?: unknown
  ): (T extends IType<unknown, unknown, infer I> ? I : never) | null {
    if (snapshot === null || snapshot === undefined) {
      return null;
    }
    return this._subType.create(snapshot, env) as (T extends IType<unknown, unknown, infer I> ? I : never) | null;
  }

  is(value: unknown): value is (T extends IType<unknown, unknown, infer I> ? I : never) | null {
    return value === null || this._subType.is(value);
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    if (value === null) {
      return { valid: true, errors: [] };
    }
    return this._subType.validate(value, context);
  }
}

export function maybeNull<T extends IAnyType>(type: T): IMaybeNullType<T> {
  return new MaybeNullType(type);
}

// ============================================================================
// Union Type
// ============================================================================

class UnionType<Types extends IAnyType[]> implements IUnionType<Types> {
  readonly _kind = 'union' as const;
  readonly _types: Types;
  readonly name: string;
  private dispatcher?: (snapshot: unknown) => IAnyType;
  private eager: boolean;

  readonly _C!: Types[number] extends IType<infer C, unknown, unknown> ? C : never;
  readonly _S!: Types[number] extends IType<unknown, infer S, unknown> ? S : never;
  readonly _T!: Types[number] extends IType<unknown, unknown, infer T> ? T : never;

  constructor(types: Types, options?: UnionOptions) {
    this._types = types;
    this.dispatcher = options?.dispatcher;
    this.eager = options?.eager ?? true;
    this.name = `union(${types.map((t) => t.name).join(' | ')})`;
  }

  create(
    snapshot?: Types[number] extends IType<infer C, unknown, unknown> ? C : never,
    env?: unknown
  ): Types[number] extends IType<unknown, unknown, infer T> ? T : never {
    type ResultType = Types[number] extends IType<unknown, unknown, infer T> ? T : never;
    
    // Use dispatcher if available
    if (this.dispatcher && snapshot !== undefined) {
      const type = this.dispatcher(snapshot);
      return type.create(snapshot, env) as ResultType;
    }

    // Try each type
    for (const type of this._types) {
      try {
        const result = type.validate(snapshot, []);
        if (result.valid) {
          return type.create(snapshot, env) as ResultType;
        }
      } catch {
        // Continue to next type
      }
    }

    throw new Error(
      `[jotai-state-tree] No type in union matched the value: ${JSON.stringify(snapshot)}`
    );
  }

  is(value: unknown): value is Types[number] extends IType<unknown, unknown, infer T> ? T : never {
    return this._types.some((type) => type.is(value));
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    for (const type of this._types) {
      const result = type.validate(value, context);
      if (result.valid) {
        return result;
      }
    }

    return {
      valid: false,
      errors: [
        {
          context,
          value,
          message: `Value does not match any type in union`,
        },
      ],
    };
  }
}

export function union<Types extends IAnyType[]>(
  ...types: Types
): IUnionType<Types>;
export function union<Types extends IAnyType[]>(
  options: UnionOptions,
  ...types: Types
): IUnionType<Types>;
export function union<Types extends IAnyType[]>(
  optionsOrType: UnionOptions | Types[number],
  ...rest: Types
): IUnionType<Types> {
  if (optionsOrType && typeof optionsOrType === 'object' && 'dispatcher' in optionsOrType) {
    return new UnionType(rest as Types, optionsOrType);
  }
  return new UnionType([optionsOrType as Types[number], ...rest] as unknown as Types);
}

// ============================================================================
// Late Type (for recursive/circular types)
// ============================================================================

class LateType<T extends IAnyType> implements ILateType<T> {
  readonly _kind = 'late' as const;
  readonly _definition: () => T;
  readonly name: string;
  private resolvedType?: T;

  readonly _C!: T extends IType<infer C, unknown, unknown> ? C : never;
  readonly _S!: T extends IType<unknown, infer S, unknown> ? S : never;
  readonly _T!: T extends IType<unknown, unknown, infer I> ? I : never;

  constructor(definition: () => T, name?: string) {
    this._definition = definition;
    this.name = name ?? 'late(...)';
  }

  private getType(): T {
    if (!this.resolvedType) {
      this.resolvedType = this._definition();
    }
    return this.resolvedType;
  }

  create(
    snapshot?: T extends IType<infer C, unknown, unknown> ? C : never,
    env?: unknown
  ): T extends IType<unknown, unknown, infer I> ? I : never {
    return this.getType().create(snapshot, env) as T extends IType<unknown, unknown, infer I> ? I : never;
  }

  is(value: unknown): value is T extends IType<unknown, unknown, infer I> ? I : never {
    return this.getType().is(value);
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    return this.getType().validate(value, context);
  }
}

export function late<T extends IAnyType>(definition: () => T): ILateType<T>;
export function late<T extends IAnyType>(name: string, definition: () => T): ILateType<T>;
export function late<T extends IAnyType>(
  nameOrDefinition: string | (() => T),
  maybeDefinition?: () => T
): ILateType<T> {
  if (typeof nameOrDefinition === 'string') {
    return new LateType(maybeDefinition!, nameOrDefinition);
  }
  return new LateType(nameOrDefinition);
}

// ============================================================================
// Refinement Type
// ============================================================================

class RefinementType<T extends IAnyType> implements IRefinementType<T> {
  readonly _kind = 'refinement' as const;
  readonly _subType: T;
  readonly _predicate: (value: unknown) => boolean;
  readonly name: string;
  private message: string | ((value: unknown) => string);

  readonly _C!: T extends IType<infer C, unknown, unknown> ? C : never;
  readonly _S!: T extends IType<unknown, infer S, unknown> ? S : never;
  readonly _T!: T extends IType<unknown, unknown, infer I> ? I : never;

  constructor(
    subType: T,
    predicate: (value: unknown) => boolean,
    message?: string | ((value: unknown) => string)
  ) {
    this._subType = subType;
    this._predicate = predicate;
    this.message = message ?? 'Value failed refinement predicate';
    this.name = `refinement<${subType.name}>`;
  }

  create(
    snapshot?: T extends IType<infer C, unknown, unknown> ? C : never,
    env?: unknown
  ): T extends IType<unknown, unknown, infer I> ? I : never {
    const instance = this._subType.create(snapshot, env);
    if (!this._predicate(instance)) {
      const msg = typeof this.message === 'function' ? this.message(instance) : this.message;
      throw new Error(`[jotai-state-tree] ${msg}`);
    }
    return instance as T extends IType<unknown, unknown, infer I> ? I : never;
  }

  is(value: unknown): value is T extends IType<unknown, unknown, infer I> ? I : never {
    return this._subType.is(value) && this._predicate(value);
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    const baseResult = this._subType.validate(value, context);
    if (!baseResult.valid) {
      return baseResult;
    }

    if (!this._predicate(value)) {
      const msg = typeof this.message === 'function' ? this.message(value) : this.message;
      return {
        valid: false,
        errors: [
          {
            context,
            value,
            message: msg,
          },
        ],
      };
    }

    return { valid: true, errors: [] };
  }
}

export function refinement<T extends IAnyType>(
  type: T,
  predicate: (value: T extends IType<unknown, unknown, infer I> ? I : never) => boolean,
  message?: string | ((value: unknown) => string)
): IRefinementType<T> {
  return new RefinementType(type, predicate as (value: unknown) => boolean, message);
}

// ============================================================================
// Reference Type
// ============================================================================

class ReferenceType<T extends IAnyModelType> implements IReferenceType<T> {
  readonly _kind = 'reference' as const;
  readonly _targetType: T;
  readonly name: string;
  private options?: ReferenceOptions<T>;

  readonly _C!: string | number;
  readonly _S!: string | number;
  readonly _T!: Instance<T>;

  constructor(targetType: T, options?: ReferenceOptions<T>) {
    this._targetType = targetType;
    this.options = options;
    this.name = `reference<${targetType.name}>`;
  }

  create(snapshot?: string | number, env?: unknown): Instance<T> {
    if (snapshot === undefined) {
      throw new Error('[jotai-state-tree] Reference requires an identifier');
    }

    // Create a proxy that resolves the reference lazily
    const self = this;
    let resolved: Instance<T> | null = null;

    // Try custom getter first
    if (this.options?.get) {
      const result = this.options.get(snapshot, null);
      if (result) return result;
    }

    // Create reference node that will resolve
    const node = new StateTreeNode(this, snapshot, env);
    node.identifierValue = snapshot;

    const proxy = new Proxy({} as Instance<T>, {
      get(target, prop) {
        // Resolve the reference
        if (!resolved) {
          const targetNode = resolveIdentifier(self._targetType.name, snapshot);
          if (!targetNode) {
            throw new Error(
              `[jotai-state-tree] Failed to resolve reference '${snapshot}' to type '${self._targetType.name}'`
            );
          }
          resolved = targetNode.getInstance() as Instance<T>;
        }

        if (prop === $treenode) {
          return node;
        }

        return (resolved as unknown as Record<string | symbol, unknown>)[prop];
      },
      set(target, prop, value) {
        if (!resolved) {
          const targetNode = resolveIdentifier(self._targetType.name, snapshot);
          if (!targetNode) {
            throw new Error(
              `[jotai-state-tree] Failed to resolve reference '${snapshot}' to type '${self._targetType.name}'`
            );
          }
          resolved = targetNode.getInstance() as Instance<T>;
        }
        (resolved as unknown as Record<string | symbol, unknown>)[prop] = value;
        return true;
      },
      has(target, prop) {
        if (!resolved) {
          const targetNode = resolveIdentifier(self._targetType.name, snapshot);
          if (targetNode) {
            resolved = targetNode.getInstance() as Instance<T>;
          }
        }
        return resolved ? prop in (resolved as object) : false;
      },
    });

    node.setInstance(proxy);
    return proxy;
  }

  is(value: unknown): value is Instance<T> {
    return this._targetType.is(value);
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    if (typeof value === 'string' || typeof value === 'number') {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: [
        {
          context,
          value,
          message: 'Reference must be a string or number identifier',
        },
      ],
    };
  }
}

export function reference<T extends IAnyModelType>(
  targetType: T,
  options?: ReferenceOptions<T>
): IReferenceType<T> {
  return new ReferenceType(targetType, options);
}

// ============================================================================
// Safe Reference Type (returns undefined instead of throwing)
// ============================================================================

class SafeReferenceType<T extends IAnyModelType> implements ISafeReferenceType<T> {
  readonly _kind = 'safeReference' as const;
  readonly _targetType: T;
  readonly name: string;
  private options?: ReferenceOptions<T> & { acceptsUndefined?: boolean };

  readonly _C!: string | number | undefined;
  readonly _S!: string | number | undefined;
  readonly _T!: Instance<T> | undefined;

  constructor(
    targetType: T,
    options?: ReferenceOptions<T> & { acceptsUndefined?: boolean }
  ) {
    this._targetType = targetType;
    this.options = options;
    this.name = `safeReference<${targetType.name}>`;
  }

  create(snapshot?: string | number | undefined, env?: unknown): Instance<T> | undefined {
    if (snapshot === undefined) {
      return undefined;
    }

    const targetNode = resolveIdentifier(this._targetType.name, snapshot);
    if (!targetNode) {
      if (this.options?.onInvalidated) {
        // Let caller handle invalid reference
        return undefined;
      }
      return undefined;
    }

    return targetNode.getInstance() as Instance<T>;
  }

  is(value: unknown): value is Instance<T> | undefined {
    return value === undefined || this._targetType.is(value);
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    if (value === undefined) {
      return { valid: true, errors: [] };
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: [
        {
          context,
          value,
          message: 'Safe reference must be a string, number, or undefined',
        },
      ],
    };
  }
}

export function safeReference<T extends IAnyModelType>(
  targetType: T,
  options?: ReferenceOptions<T> & { acceptsUndefined?: boolean }
): ISafeReferenceType<T> {
  return new SafeReferenceType(targetType, options);
}

// ============================================================================
// SnapshotProcessor Type
// ============================================================================

export function snapshotProcessor<
  IT extends IAnyType,
  CustomC = IT extends IType<infer C, unknown, unknown> ? C : never,
  CustomS = IT extends IType<unknown, infer S, unknown> ? S : never,
>(
  type: IT,
  processors: {
    preProcessor?: (snapshot: CustomC) => IT extends IType<infer C, unknown, unknown> ? C : never;
    postProcessor?: (
      snapshot: IT extends IType<unknown, infer S, unknown> ? S : never
    ) => CustomS;
  }
): IType<CustomC, CustomS, IT extends IType<unknown, unknown, infer T> ? T : never> {
  type ResultType = IT extends IType<unknown, unknown, infer T> ? T : never;
  
  return {
    name: `snapshotProcessor<${type.name}>`,
    _kind: 'simple' as const,
    _C: undefined as unknown as CustomC,
    _S: undefined as unknown as CustomS,
    _T: undefined as unknown as ResultType,

    create(snapshot?: CustomC, env?: unknown): ResultType {
      const processed = processors.preProcessor
        ? processors.preProcessor(snapshot as CustomC)
        : snapshot;
      return type.create(processed, env) as ResultType;
    },

    is(value: unknown): value is ResultType {
      return type.is(value);
    },

    validate(value: unknown, context: IValidationContext[]): IValidationResult {
      return type.validate(value, context);
    },
  };
}
