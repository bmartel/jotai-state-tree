/**
 * Core types for jotai-state-tree
 * These types mirror the MobX-State-Tree API
 */

// ============================================================================
// Snapshot Types
// ============================================================================

export type SnapshotIn<T> = T extends IModelType<infer P, any, any, any>
  ? { [K in keyof P]?: SnapshotInOfProperty<P[K]> }
  : T extends IArrayType<infer I>
    ? SnapshotIn<I>[]
    : T extends IMapType<infer V>
      ? Record<string, SnapshotIn<V>>
      : T extends IReferenceType<any>
        ? string | number
        : T extends IType<infer C, any, any>
          ? C
          : T;

type SnapshotInOfProperty<T> = T extends IType<infer C, any, any> ? C : never;

export type SnapshotOut<T> = T extends IModelType<infer P, any, any, any>
  ? { [K in keyof P]: SnapshotOutOfProperty<P[K]> }
  : T extends IArrayType<infer I>
    ? SnapshotOut<I>[]
    : T extends IMapType<infer V>
      ? Record<string, SnapshotOut<V>>
      : T extends IReferenceType<any>
        ? string | number
        : T extends IType<any, infer S, any>
          ? S
          : T;

type SnapshotOutOfProperty<T> = T extends IType<any, infer S, any> ? S : never;

export type Instance<T> = T extends IType<any, any, infer O> ? O : never;

// ============================================================================
// Base Type Interface
// ============================================================================

export interface IType<C, S, T> {
  /** Name of this type */
  readonly name: string;

  /** The identifier attribute if this type has one */
  readonly identifierAttribute?: string;

  /** Create an instance of this type */
  create(snapshot?: C, env?: unknown): T;

  /** Check if a value is an instance of this type */
  is(value: unknown): value is T;

  /** Validate a value against this type */
  validate(value: unknown, context: IValidationContext[]): IValidationResult;

  /** Type discriminator */
  readonly _kind: string;

  // Phantom types for TypeScript inference
  readonly _C: C;
  readonly _S: S;
  readonly _T: T;
}

export interface IValidationContext {
  path: string;
  type: IType<unknown, unknown, unknown>;
  parent: unknown;
}

export interface IValidationResult {
  valid: boolean;
  errors: IValidationError[];
}

export interface IValidationError {
  context: IValidationContext[];
  value: unknown;
  message: string;
}

// ============================================================================
// Simple/Primitive Types
// ============================================================================

export interface ISimpleType<T> extends IType<T, T, T> {
  readonly _kind: 'simple';
}

// ============================================================================
// Model Types
// ============================================================================

export type ModelProperties = Record<string, IType<unknown, unknown, unknown>>;

export type ModelCreationType<P extends ModelProperties> = {
  [K in keyof P]?: P[K] extends IType<infer C, unknown, unknown> ? C : never;
};

export type ModelSnapshotType<P extends ModelProperties> = {
  [K in keyof P]: P[K] extends IType<unknown, infer S, unknown> ? S : never;
};

export type ModelInstanceType<P extends ModelProperties> = {
  [K in keyof P]: P[K] extends IType<unknown, unknown, infer T> ? T : never;
};

/** Represents a node in the state tree */
export interface IStateTreeNode<S = unknown> {
  readonly $id: string;
  readonly $type: IType<unknown, unknown, unknown>;
  readonly $parent: IStateTreeNode | null;
  readonly $path: string;
  readonly $env: unknown;
  readonly $isAlive: boolean;
}

export type ModelInstance<
  P extends ModelProperties,
  V extends object,
  A extends object,
  Vol extends object,
> = ModelInstanceType<P> & {
  /** Access to the tree node metadata */
  readonly $treenode: IStateTreeNode;
};

export type ModelViews<Self, V> = (self: Self) => V;
export type ModelActions<Self, A> = (self: Self) => A;
export type ModelVolatile<Self, Vol> = (self: Self) => Vol;

export interface IModelType<
  P extends ModelProperties,
  V extends object,
  A extends object,
  Vol extends object,
> extends IType<
    ModelCreationType<P>,
    ModelSnapshotType<P>,
    ModelInstance<P, V, A, Vol> & V & A & Vol
  > {
  readonly _kind: 'model';
  readonly properties: P;

  /** Create a new model type with a different name */
  named(name: string): IModelType<P, V, A, Vol>;

  /** Add properties to the model */
  props<P2 extends ModelProperties>(properties: P2): IModelType<P & P2, V, A, Vol>;

  /** Add computed views to the model */
  views<V2 extends object>(
    fn: ModelViews<ModelInstance<P, V, A, Vol> & V & A & Vol, V2>
  ): IModelType<P, V & V2, A, Vol>;

  /** Add actions to the model */
  actions<A2 extends object>(
    fn: ModelActions<ModelInstance<P, V, A, Vol> & V & A & Vol, A2>
  ): IModelType<P, V, A & A2, Vol>;

  /** Add volatile (non-serialized) state */
  volatile<Vol2 extends object>(
    fn: ModelVolatile<ModelInstance<P, V, A, Vol> & V & A & Vol, Vol2>
  ): IModelType<P, V, A, Vol & Vol2>;

  /** Transform snapshot before creating instance */
  preProcessSnapshot<NewC>(
    fn: (snapshot: NewC) => ModelCreationType<P>
  ): IModelType<P, V, A, Vol>;

  /** Transform snapshot after getting it */
  postProcessSnapshot<NewS>(
    fn: (snapshot: ModelSnapshotType<P>) => NewS
  ): IModelType<P, V, A, Vol>;

  /** Extend the model with views, actions, and state in one call */
  extend<V2 extends object = object, A2 extends object = object, Vol2 extends object = object>(
    fn: (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => {
      views?: V2;
      actions?: A2;
      state?: Vol2;
    }
  ): IModelType<P, V & V2, A & A2, Vol & Vol2>;

  /** Add afterCreate lifecycle hook */
  afterCreate(
    fn: (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => void
  ): IModelType<P, V, A, Vol>;

  /** Add afterAttach lifecycle hook (called when node is attached to tree) */
  afterAttach(
    fn: (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => void
  ): IModelType<P, V, A, Vol>;

  /** Add beforeDetach lifecycle hook (called before node is detached from tree) */
  beforeDetach(
    fn: (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => void
  ): IModelType<P, V, A, Vol>;

  /** Add beforeDestroy lifecycle hook (called before node is destroyed) */
  beforeDestroy(
    fn: (self: ModelInstance<P, V, A, Vol> & V & A & Vol) => void
  ): IModelType<P, V, A, Vol>;
}

// ============================================================================
// Array Type
// ============================================================================

export interface IMSTArray<T> extends Array<T> {
  /** Replace all items */
  replace(items: T[]): void;
  /** Remove all items */
  clear(): void;
  /** Remove a specific item */
  remove(item: T): boolean;
  /** Splice with array argument */
  spliceWithArray(index: number, deleteCount?: number, newItems?: T[]): T[];
  /** Convert to JSON */
  toJSON(): T[];
}

export interface IArrayType<T extends IType<unknown, unknown, unknown>>
  extends IType<
    Array<T extends IType<infer C, unknown, unknown> ? C : never>,
    Array<T extends IType<unknown, infer S, unknown> ? S : never>,
    IMSTArray<T extends IType<unknown, unknown, infer I> ? I : never>
  > {
  readonly _kind: 'array';
  readonly _subType: T;
}

// ============================================================================
// Map Type
// ============================================================================

export interface IMSTMap<V> extends Map<string, V> {
  /** Put a value, returning it */
  put(value: V): V;
  /** Merge values into the map */
  merge(values: Record<string, V> | Map<string, V>): this;
  /** Replace all values */
  replace(values: Record<string, V> | Map<string, V>): this;
  /** Convert to JSON */
  toJSON(): Record<string, V>;
}

export interface IMapType<T extends IType<unknown, unknown, unknown>>
  extends IType<
    Record<string, T extends IType<infer C, unknown, unknown> ? C : never>,
    Record<string, T extends IType<unknown, infer S, unknown> ? S : never>,
    IMSTMap<T extends IType<unknown, unknown, infer I> ? I : never>
  > {
  readonly _kind: 'map';
  readonly _subType: T;
}

// ============================================================================
// Optional Type
// ============================================================================

export interface IOptionalType<T extends IType<unknown, unknown, unknown>, Default>
  extends IType<
    (T extends IType<infer C, unknown, unknown> ? C : never) | undefined,
    T extends IType<unknown, infer S, unknown> ? S : never,
    T extends IType<unknown, unknown, infer I> ? I : never
  > {
  readonly _kind: 'optional';
  readonly _subType: T;
  readonly _defaultValue: Default | (() => Default);
}

// ============================================================================
// Maybe Types
// ============================================================================

export interface IMaybeType<T extends IType<unknown, unknown, unknown>>
  extends IType<
    (T extends IType<infer C, unknown, unknown> ? C : never) | undefined,
    (T extends IType<unknown, infer S, unknown> ? S : never) | undefined,
    (T extends IType<unknown, unknown, infer I> ? I : never) | undefined
  > {
  readonly _kind: 'maybe';
  readonly _subType: T;
}

export interface IMaybeNullType<T extends IType<unknown, unknown, unknown>>
  extends IType<
    (T extends IType<infer C, unknown, unknown> ? C : never) | null,
    (T extends IType<unknown, infer S, unknown> ? S : never) | null,
    (T extends IType<unknown, unknown, infer I> ? I : never) | null
  > {
  readonly _kind: 'maybeNull';
  readonly _subType: T;
}

// ============================================================================
// Reference Type
// ============================================================================

export interface IReferenceType<T extends IAnyModelType>
  extends IType<string | number, string | number, Instance<T>> {
  readonly _kind: 'reference';
  readonly _targetType: T;
}

export interface ReferenceOptions<T extends IAnyModelType> {
  get?(identifier: string | number, parent: unknown): Instance<T> | undefined;
  set?(value: Instance<T>, parent: unknown): string | number;
  onInvalidated?: (event: {
    parent: unknown;
    invalidId: string | number;
    replaceRef: (newRef: Instance<T> | null) => void;
    removeRef: () => void;
    cause: 'destroy' | 'invalidSnapshotReference' | 'detach';
  }) => void;
}

export interface ISafeReferenceType<T extends IAnyModelType>
  extends IType<string | number | undefined, string | number | undefined, Instance<T> | undefined> {
  readonly _kind: 'safeReference';
  readonly _targetType: T;
}

// ============================================================================
// Union Type
// ============================================================================

export type UnionOptions = {
  dispatcher?: (snapshot: unknown) => IType<unknown, unknown, unknown>;
  eager?: boolean;
};

export interface IUnionType<Types extends IType<unknown, unknown, unknown>[]>
  extends IType<
    Types[number] extends IType<infer C, unknown, unknown> ? C : never,
    Types[number] extends IType<unknown, infer S, unknown> ? S : never,
    Types[number] extends IType<unknown, unknown, infer T> ? T : never
  > {
  readonly _kind: 'union';
  readonly _types: Types;
}

// ============================================================================
// Literal Type
// ============================================================================

export interface ILiteralType<T extends string | number | boolean>
  extends IType<T, T, T> {
  readonly _kind: 'literal';
  readonly _value: T;
}

// ============================================================================
// Enumeration Type
// ============================================================================

export interface IEnumerationType<E extends string>
  extends IType<E, E, E> {
  readonly _kind: 'enumeration';
  readonly _options: readonly E[];
}

// ============================================================================
// Frozen Type
// ============================================================================

export interface IFrozenType<T> extends IType<T, T, T> {
  readonly _kind: 'frozen';
}

// ============================================================================
// Late Type
// ============================================================================

export interface ILateType<T extends IType<unknown, unknown, unknown>>
  extends IType<
    T extends IType<infer C, unknown, unknown> ? C : never,
    T extends IType<unknown, infer S, unknown> ? S : never,
    T extends IType<unknown, unknown, infer I> ? I : never
  > {
  readonly _kind: 'late';
  readonly _definition: () => T;
}

// ============================================================================
// Refinement Type
// ============================================================================

export interface IRefinementType<T extends IType<unknown, unknown, unknown>>
  extends IType<
    T extends IType<infer C, unknown, unknown> ? C : never,
    T extends IType<unknown, infer S, unknown> ? S : never,
    T extends IType<unknown, unknown, infer I> ? I : never
  > {
  readonly _kind: 'refinement';
  readonly _subType: T;
  readonly _predicate: (value: unknown) => boolean;
}

// ============================================================================
// Custom Type
// ============================================================================

export interface CustomTypeOptions<C, S, T> {
  name: string;
  fromSnapshot(snapshot: S): T;
  toSnapshot(value: T): S;
  isTargetType(value: unknown): boolean;
  getValidationMessage(value: unknown): string;
}

// ============================================================================
// Identifier Types
// ============================================================================

export interface IIdentifierType extends IType<string, string, string> {
  readonly _kind: 'identifier';
  readonly identifierAttribute: string;
}

export interface IIdentifierNumberType extends IType<number, number, number> {
  readonly _kind: 'identifierNumber';
  readonly identifierAttribute: string;
}

// ============================================================================
// Patch Types
// ============================================================================

export interface IJsonPatch {
  op: 'replace' | 'add' | 'remove';
  path: string;
  value?: unknown;
}

export interface IReversibleJsonPatch extends IJsonPatch {
  oldValue?: unknown;
}

// ============================================================================
// Helper Types
// ============================================================================

export type IAnyType = IType<unknown, unknown, unknown>;

export type IAnyModelType = IModelType<
  ModelProperties,
  object,
  object,
  object
>;

export type IAnyComplexType = IAnyModelType | IArrayType<IAnyType> | IMapType<IAnyType>;

/** Extract the creation type from a type */
export type CreationType<T extends IAnyType> = T extends IType<infer C, unknown, unknown> ? C : never;

/** Extract the snapshot type from a type */  
export type SnapshotType<T extends IAnyType> = T extends IType<unknown, infer S, unknown> ? S : never;

/** Extract the instance type from a type */
export type InstanceType<T extends IAnyType> = T extends IType<unknown, unknown, infer I> ? I : never;

// ============================================================================
// Tree Navigation Types
// ============================================================================

export type LivelinessMode = 'warn' | 'error' | 'ignore';

export interface IDisposer {
  (): void;
}
