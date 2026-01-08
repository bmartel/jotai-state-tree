/**
 * Additional MST compatibility utilities
 * These utilities help with edge cases and compatibility
 */

import type { IAnyType, IType, IAnyModelType, Instance, SnapshotIn } from './types';
import { getStateTreeNode, hasStateTreeNode, getSnapshot, resolveIdentifier } from './tree';

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Check if the given value looks like a type (has the type interface)
 */
export function isType(value: unknown): value is IAnyType {
  return (
    value !== null &&
    typeof value === 'object' &&
    '_kind' in value &&
    'create' in value &&
    'is' in value
  );
}

/**
 * Check if a value is a primitive type
 */
export function isPrimitiveType(type: unknown): boolean {
  return (
    isType(type) &&
    (type._kind === 'simple' ||
      type._kind === 'literal' ||
      type._kind === 'enumeration' ||
      type._kind === 'identifier' ||
      type._kind === 'identifierNumber')
  );
}

/**
 * Get the string name of a type
 */
export function getTypeName(type: IAnyType): string {
  return type.name;
}

// ============================================================================
// Snapshot Utilities
// ============================================================================

/**
 * Check if value could be a valid snapshot for the given type
 */
export function isValidSnapshot<T extends IAnyType>(
  type: T,
  value: unknown
): value is SnapshotIn<T> {
  try {
    const result = type.validate(value, []);
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Get a human-readable validation error message
 */
export function getValidationError(type: IAnyType, value: unknown): string | null {
  const result = type.validate(value, [{ path: '', type, parent: null }]);
  if (result.valid) return null;
  return result.errors.map((e) => e.message).join('; ');
}

// ============================================================================
// Instance Utilities
// ============================================================================

/**
 * Check if value is an instance of a specific model type
 */
export function isInstanceOf<T extends IAnyModelType>(
  value: unknown,
  type: T
): value is Instance<T> {
  if (!hasStateTreeNode(value)) return false;
  const node = getStateTreeNode(value);
  return node.$type === type || node.$type.name === type.name;
}

/**
 * Get the live instance from a snapshot, or create one if needed
 */
export function getOrCreate<T extends IAnyType>(
  type: T,
  snapshotOrInstance: SnapshotIn<T> | Instance<T>,
  env?: unknown
): Instance<T> {
  if (hasStateTreeNode(snapshotOrInstance)) {
    return snapshotOrInstance as Instance<T>;
  }
  return type.create(snapshotOrInstance, env) as Instance<T>;
}

// ============================================================================
// Tree Debugging
// ============================================================================

/**
 * Get a debug-friendly representation of a state tree node
 */
export function getDebugInfo(target: unknown): {
  typeName: string;
  path: string;
  identifier: string | number | null;
  isAlive: boolean;
  snapshot: unknown;
} {
  const node = getStateTreeNode(target);
  return {
    typeName: node.$type.name,
    path: node.$path,
    identifier: node.identifierValue ?? null,
    isAlive: node.$isAlive,
    snapshot: getSnapshot(target),
  };
}

/**
 * Print a tree structure for debugging
 */
export function printTree(target: unknown, indent: number = 0): string {
  const node = getStateTreeNode(target);
  const prefix = '  '.repeat(indent);
  let output = `${prefix}${node.$type.name}`;

  if (node.identifierValue !== undefined) {
    output += ` (${node.identifierValue})`;
  }

  output += '\n';

  for (const [key, child] of node.getChildren()) {
    const childInstance = child.getInstance();
    if (childInstance && hasStateTreeNode(childInstance)) {
      output += `${prefix}  ${key}: ${printTree(childInstance, indent + 2)}`;
    } else {
      output += `${prefix}  ${key}: ${JSON.stringify(child.getValue())}\n`;
    }
  }

  return output;
}

// ============================================================================
// Identifier Utilities
// ============================================================================

/**
 * Check if a model type has an identifier
 */
export function hasIdentifier(type: IAnyModelType): boolean {
  return type.identifierAttribute !== undefined;
}

/**
 * Get the identifier attribute name for a model type
 */
export function getIdentifierAttribute(type: IAnyModelType): string | undefined {
  return type.identifierAttribute;
}

// ============================================================================
// Type Composition Helpers
// ============================================================================

/**
 * Create a type that is a union of all provided types
 * but where null/undefined are always valid
 */
export function nullable<T extends IAnyType>(type: T): IType<
  (T extends IType<infer C, unknown, unknown> ? C : never) | null | undefined,
  (T extends IType<unknown, infer S, unknown> ? S : never) | null | undefined,
  (T extends IType<unknown, unknown, infer I> ? I : never) | null | undefined
> {
  return {
    name: `nullable<${type.name}>`,
    _kind: 'maybe' as const,
    _C: undefined as unknown as (T extends IType<infer C, unknown, unknown> ? C : never) | null | undefined,
    _S: undefined as unknown as (T extends IType<unknown, infer S, unknown> ? S : never) | null | undefined,
    _T: undefined as unknown as (T extends IType<unknown, unknown, infer I> ? I : never) | null | undefined,

    create(snapshot, env) {
      if (snapshot === null || snapshot === undefined) {
        return snapshot as unknown as (T extends IType<unknown, unknown, infer I> ? I : never) | null | undefined;
      }
      return type.create(snapshot, env) as (T extends IType<unknown, unknown, infer I> ? I : never) | null | undefined;
    },

    is(value): value is (T extends IType<unknown, unknown, infer I> ? I : never) | null | undefined {
      return value === null || value === undefined || type.is(value);
    },

    validate(value, context) {
      if (value === null || value === undefined) {
        return { valid: true, errors: [] };
      }
      return type.validate(value, context);
    },
  };
}

// ============================================================================
// Error Helpers
// ============================================================================

/**
 * Create a type error with helpful context
 */
export function createTypeError(
  message: string,
  context: {
    typeName?: string;
    path?: string;
    value?: unknown;
  } = {}
): Error {
  let fullMessage = `[jotai-state-tree] ${message}`;

  if (context.typeName) {
    fullMessage += ` (type: ${context.typeName})`;
  }
  if (context.path) {
    fullMessage += ` (path: ${context.path})`;
  }
  if (context.value !== undefined) {
    fullMessage += ` (value: ${JSON.stringify(context.value)})`;
  }

  return new Error(fullMessage);
}

// ============================================================================
// Frozen Deep Clone
// ============================================================================

/**
 * Deep clone a frozen value
 */
export function cloneFrozen<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(cloneFrozen) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = cloneFrozen(val);
  }
  return result as T;
}

// ============================================================================
// Safe Type Creation
// ============================================================================

/**
 * Safely create an instance, returning undefined on failure
 */
export function safeCreate<T extends IAnyType>(
  type: T,
  snapshot: unknown,
  env?: unknown
): Instance<T> | undefined {
  try {
    return type.create(snapshot, env) as Instance<T>;
  } catch {
    return undefined;
  }
}

/**
 * Create an instance with defaults for missing values
 */
export function createWithDefaults<T extends IAnyType>(
  type: T,
  snapshot: Partial<SnapshotIn<T>> = {},
  env?: unknown
): Instance<T> {
  return type.create(snapshot as SnapshotIn<T>, env) as Instance<T>;
}
