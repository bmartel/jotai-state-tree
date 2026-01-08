/**
 * jotai-state-tree
 * MobX-State-Tree API compatible library powered by Jotai
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core types
  IType,
  ISimpleType,
  IModelType,
  IArrayType,
  IMapType,
  IOptionalType,
  IMaybeType,
  IMaybeNullType,
  IReferenceType,
  ISafeReferenceType,
  IUnionType,
  ILiteralType,
  IEnumerationType,
  IFrozenType,
  ILateType,
  IRefinementType,
  IIdentifierType,
  IIdentifierNumberType,

  // Instance types
  IStateTreeNode,
  IMSTArray,
  IMSTMap,
  ModelInstance,
  ModelProperties,

  // Utility types
  SnapshotIn,
  SnapshotOut,
  Instance,
  IAnyType,
  IAnyModelType,
  IAnyComplexType,

  // Patch types
  IJsonPatch,
  IReversibleJsonPatch,

  // Validation types
  IValidationContext,
  IValidationResult,
  IValidationError,

  // Options types
  ReferenceOptions,
  UnionOptions,
  CustomTypeOptions,

  // Disposer
  IDisposer,
} from "./types";

// ============================================================================
// Primitive Types
// ============================================================================

import {
  string,
  number,
  integer,
  boolean,
  DatePrimitive,
  nullType,
  undefinedType,
  identifier,
  identifierNumber,
  literal,
  enumeration,
  frozen,
  custom,
  finite,
  float,
} from "./primitives";

// ============================================================================
// Model Type
// ============================================================================

import { model, compose } from "./model";

// ============================================================================
// Collection Types
// ============================================================================

import { array } from "./array";
import { map } from "./map";

// ============================================================================
// Utility Types
// ============================================================================

import {
  optional,
  maybe,
  maybeNull,
  union,
  late,
  refinement,
  reference,
  safeReference,
  snapshotProcessor,
} from "./utilities";

// ============================================================================
// Model Registry (Dynamic Model Registration)
// ============================================================================

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
  lateModel,
  dynamicReference,
  safeDynamicReference,
  type DynamicReferenceOptions,
} from "./registry";

// ============================================================================
// Types Namespace (MST Compatible)
// ============================================================================

/**
 * The `types` namespace contains all type constructors.
 * This matches the MobX-State-Tree API.
 */
export const types = {
  // Primitives
  string,
  number,
  integer,
  boolean,
  Date: DatePrimitive,
  null: nullType,
  undefined: undefinedType,
  finite,
  float,

  // Identifiers
  identifier,
  identifierNumber,

  // Literals & Enums
  literal,
  enumeration,

  // Frozen
  frozen,

  // Custom
  custom,

  // Model
  model,
  compose,

  // Collections
  array,
  map,

  // Optionality
  optional,
  maybe,
  maybeNull,

  // Union & Late
  union,
  late,

  // References
  reference,
  safeReference,

  // Refinement
  refinement,

  // Snapshot processing
  snapshotProcessor,

  // Registry-based types (for dynamic model registration)
  lateModel,
  dynamicReference,
  safeDynamicReference,
};

// Also export types directly for destructuring
export {
  // Primitives
  string,
  number,
  integer,
  boolean,
  DatePrimitive as Date,
  nullType,
  undefinedType,
  finite,
  float,

  // Identifiers
  identifier,
  identifierNumber,

  // Literals & Enums
  literal,
  enumeration,

  // Frozen
  frozen,

  // Custom
  custom,

  // Model
  model,
  compose,

  // Collections
  array,
  map,

  // Optionality
  optional,
  maybe,
  maybeNull,

  // Union & Late
  union,
  late,

  // References
  reference,
  safeReference,

  // Refinement
  refinement,

  // Snapshot processing
  snapshotProcessor,

  // Registry-based types (for dynamic model registration)
  lateModel,
  dynamicReference,
  safeDynamicReference,
};

// Also export registry functions directly
export {
  // Model registry
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
} from "./registry";

export type { DynamicReferenceOptions } from "./registry";

// ============================================================================
// Tree Utilities
// ============================================================================

export {
  // Core utilities
  getSnapshot,
  applySnapshot,
  onSnapshot,
  onPatch,
  applyPatch,
  recordPatches,
  onAction,

  // Tree navigation
  getRoot,
  getParent,
  tryGetParent,
  hasParent,
  getParentOfType,
  getPath,
  getPathParts,
  getEnv,
  getType,
  getIdentifier,

  // Node state
  isAlive,
  isRoot,
  isStateTreeNode,

  // Tree manipulation
  destroy,
  detach,
  clone,
  walk,

  // Resolution
  resolvePath,
  tryResolve,
  resolveIdentifier,

  // Members
  getMembers,

  // Store management
  getGlobalStore,
  setGlobalStore,
  resetGlobalStore,

  // Advanced tree utilities
  getRelativePath,
  isAncestor,
  haveSameRoot,
  findAll,
  findFirst,
  isValidReference,
  getTreeStats,
  cloneDeep,
  getOrCreatePath,
  freeze,
  isFrozen,
  unfreeze,

  // Registry utilities (for testing and debugging)
  getRegistryStats,
  cleanupStaleEntries,
  clearAllRegistries,

  // Lifecycle subscriptions
  onLifecycleChange,
} from "./tree";

// ============================================================================
// Lifecycle & Middleware
// ============================================================================

export {
  // Middleware
  addMiddleware,

  // Action recording/replay
  recordActions,
  applyAction,

  // Protection
  protect,
  unprotect,
  isProtected,

  // Path utilities
  escapeJsonPath,
  unescapeJsonPath,
  splitJsonPath,
  joinJsonPath,
} from "./lifecycle";

export type {
  IMiddlewareEvent,
  IMiddlewareHandler,
  ISerializedActionCall,
} from "./lifecycle";

// ============================================================================
// Compatibility Utilities
// ============================================================================

export {
  // Type checking
  isType,
  isPrimitiveType,
  getTypeName,

  // Snapshot utilities
  isValidSnapshot,
  getValidationError,

  // Instance utilities
  isInstanceOf,
  getOrCreate,

  // Debugging
  getDebugInfo,
  printTree,

  // Identifier utilities
  hasIdentifier,
  getIdentifierAttribute,

  // Type composition
  nullable,

  // Safe creation
  safeCreate,
  createWithDefaults,

  // Frozen clone
  cloneFrozen,
} from "./compat";

// ============================================================================
// Flow (Async Actions)
// ============================================================================

/**
 * Creates an async action (generator function) that can be yielded.
 * Compatible with MST's flow().
 */
export function flow<Args extends unknown[], R>(
  generator: (...args: Args) => Generator<Promise<unknown>, R, unknown>,
): (...args: Args) => Promise<R> {
  return function flowAction(...args: Args): Promise<R> {
    const gen = generator(...args);

    function step(
      nextFn: () => IteratorResult<Promise<unknown>, R>,
    ): Promise<R> {
      let result: IteratorResult<Promise<unknown>, R>;
      try {
        result = nextFn();
      } catch (e) {
        return Promise.reject(e);
      }

      if (result.done) {
        return Promise.resolve(result.value);
      }

      return Promise.resolve(result.value).then(
        (value) => step(() => gen.next(value)),
        (error) => step(() => gen.throw(error)),
      );
    }

    return step(() => gen.next(undefined));
  };
}

/**
 * Cast a value to a different type.
 * Useful for working around TypeScript limitations.
 */
export function cast<T>(value: unknown): T {
  return value as T;
}

/**
 * Cast a value to a snapshot type.
 */
export function castToSnapshot<T>(value: T): T {
  return value;
}

/**
 * Cast a value to a reference snapshot (identifier).
 */
export function castToReferenceSnapshot<T>(value: T): string | number {
  const { getIdentifier } = require("./tree");
  return getIdentifier(value) ?? (value as unknown as string | number);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a value is a valid identifier.
 */
export function isIdentifierType(
  type: unknown,
): type is typeof identifier | typeof identifierNumber {
  return (
    type !== null &&
    typeof type === "object" &&
    "_kind" in type &&
    ((type as { _kind: string })._kind === "identifier" ||
      (type as { _kind: string })._kind === "identifierNumber")
  );
}

/**
 * Check if a type is a model type.
 */
export function isModelType(type: unknown): boolean {
  return (
    type !== null &&
    typeof type === "object" &&
    "_kind" in type &&
    (type as { _kind: string })._kind === "model"
  );
}

/**
 * Check if a type is an array type.
 */
export function isArrayType(type: unknown): boolean {
  return (
    type !== null &&
    typeof type === "object" &&
    "_kind" in type &&
    (type as { _kind: string })._kind === "array"
  );
}

/**
 * Check if a type is a map type.
 */
export function isMapType(type: unknown): boolean {
  return (
    type !== null &&
    typeof type === "object" &&
    "_kind" in type &&
    (type as { _kind: string })._kind === "map"
  );
}

/**
 * Check if a type is a reference type.
 */
export function isReferenceType(type: unknown): boolean {
  return (
    type !== null &&
    typeof type === "object" &&
    "_kind" in type &&
    ((type as { _kind: string })._kind === "reference" ||
      (type as { _kind: string })._kind === "safeReference")
  );
}

/**
 * Check if a type is a union type.
 */
export function isUnionType(type: unknown): boolean {
  return (
    type !== null &&
    typeof type === "object" &&
    "_kind" in type &&
    (type as { _kind: string })._kind === "union"
  );
}

/**
 * Check if a type is an optional type.
 */
export function isOptionalType(type: unknown): boolean {
  return (
    type !== null &&
    typeof type === "object" &&
    "_kind" in type &&
    ((type as { _kind: string })._kind === "optional" ||
      (type as { _kind: string })._kind === "maybe" ||
      (type as { _kind: string })._kind === "maybeNull")
  );
}

/**
 * Check if a type is a late type.
 */
export function isLateType(type: unknown): boolean {
  return (
    type !== null &&
    typeof type === "object" &&
    "_kind" in type &&
    (type as { _kind: string })._kind === "late"
  );
}

/**
 * Check if a type is a frozen type.
 */
export function isFrozenType(type: unknown): boolean {
  return (
    type !== null &&
    typeof type === "object" &&
    "_kind" in type &&
    (type as { _kind: string })._kind === "frozen"
  );
}

/**
 * Check if a type is a literal type.
 */
export function isLiteralType(type: unknown): boolean {
  return (
    type !== null &&
    typeof type === "object" &&
    "_kind" in type &&
    (type as { _kind: string })._kind === "literal"
  );
}

/**
 * Get the type of a value, or undefined if not a state tree node.
 */
export function typecheck<T>(
  type: { is(v: unknown): v is T },
  value: unknown,
): void {
  if (!type.is(value)) {
    throw new Error(`[jotai-state-tree] Value does not match type`);
  }
}

// ============================================================================
// Undo/Redo & Time Travel
// ============================================================================

export {
  createUndoManager,
  createTimeTravelManager,
  createActionRecorder,
} from "./undo";

export type {
  IUndoManager,
  IUndoManagerOptions,
  IHistoryEntry,
  ITimeTravelManager,
  IActionRecorder,
  IActionRecording,
} from "./undo";

// ============================================================================
// Re-export for convenience
// ============================================================================

// Default export for convenient import
export default types;
