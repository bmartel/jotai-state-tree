/**
 * Primitive types implementation
 * string, number, boolean, integer, Date, identifier, etc.
 */

import type {
  ISimpleType,
  IType,
  IValidationContext,
  IValidationResult,
  IIdentifierType,
  IIdentifierNumberType,
  ILiteralType,
  IEnumerationType,
  IFrozenType,
} from './types';

// ============================================================================
// Base Simple Type
// ============================================================================

function createSimpleType<T>(
  name: string,
  validator: (value: unknown) => boolean,
  defaultValue?: T
): ISimpleType<T> {
  return {
    name,
    _kind: 'simple',
    _C: undefined as unknown as T,
    _S: undefined as unknown as T,
    _T: undefined as unknown as T,

    create(snapshot?: T): T {
      if (snapshot === undefined) {
        if (defaultValue !== undefined) {
          return defaultValue;
        }
        throw new Error(`[jotai-state-tree] A value of type '${name}' is required`);
      }
      if (!validator(snapshot)) {
        throw new Error(
          `[jotai-state-tree] Value '${String(snapshot)}' is not a valid '${name}'`
        );
      }
      return snapshot;
    },

    is(value: unknown): value is T {
      return validator(value);
    },

    validate(value: unknown, context: IValidationContext[]): IValidationResult {
      if (validator(value)) {
        return { valid: true, errors: [] };
      }
      return {
        valid: false,
        errors: [
          {
            context,
            value,
            message: `Value '${String(value)}' is not a valid '${name}'`,
          },
        ],
      };
    },
  };
}

// ============================================================================
// Primitive Types
// ============================================================================

/** String type */
export const string: ISimpleType<string> = createSimpleType<string>(
  'string',
  (value): value is string => typeof value === 'string'
);

/** Number type (includes floats) */
export const number: ISimpleType<number> = createSimpleType<number>(
  'number',
  (value): value is number => typeof value === 'number' && !isNaN(value)
);

/** Integer type */
export const integer: ISimpleType<number> = createSimpleType<number>(
  'integer',
  (value): value is number =>
    typeof value === 'number' && !isNaN(value) && Number.isInteger(value)
);

/** Boolean type */
export const boolean: ISimpleType<boolean> = createSimpleType<boolean>(
  'boolean',
  (value): value is boolean => typeof value === 'boolean'
);

/** Date type - stores as number, exposes as Date */
export const DatePrimitive: IType<number | Date, number, Date> = {
  name: 'Date',
  _kind: 'simple' as const,
  _C: undefined as unknown as number | Date,
  _S: undefined as unknown as number,
  _T: undefined as unknown as Date,

  create(snapshot?: number | Date): Date {
    if (snapshot === undefined) {
      return new Date();
    }
    if (snapshot instanceof Date) {
      return snapshot;
    }
    if (typeof snapshot === 'number') {
      return new Date(snapshot);
    }
    throw new Error(`[jotai-state-tree] Value is not a valid Date`);
  },

  is(value: unknown): value is Date {
    return value instanceof Date;
  },

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    if (value instanceof Date || typeof value === 'number') {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: [
        {
          context,
          value,
          message: 'Value is not a valid Date',
        },
      ],
    };
  },
};

/** Null type */
export const nullType: ISimpleType<null> = createSimpleType<null>(
  'null',
  (value): value is null => value === null
);

/** Undefined type */
export const undefinedType: ISimpleType<undefined> = createSimpleType<undefined>(
  'undefined',
  (value): value is undefined => value === undefined
);

// ============================================================================
// Identifier Types
// ============================================================================

/** String identifier type */
export const identifier: IIdentifierType = {
  ...createSimpleType<string>(
    'identifier',
    (value): value is string => typeof value === 'string'
  ),
  _kind: 'identifier' as const,
  identifierAttribute: 'id',
};

/** Number identifier type */
export const identifierNumber: IIdentifierNumberType = {
  ...createSimpleType<number>(
    'identifierNumber',
    (value): value is number => typeof value === 'number' && !isNaN(value)
  ),
  _kind: 'identifierNumber' as const,
  identifierAttribute: 'id',
};

// ============================================================================
// Literal Type
// ============================================================================

export function literal<T extends string | number | boolean>(value: T): ILiteralType<T> {
  return {
    name: `literal(${JSON.stringify(value)})`,
    _kind: 'literal',
    _value: value,
    _C: undefined as unknown as T,
    _S: undefined as unknown as T,
    _T: undefined as unknown as T,

    create(snapshot?: T): T {
      if (snapshot === undefined) {
        return value;
      }
      if (snapshot !== value) {
        throw new Error(
          `[jotai-state-tree] Value '${String(snapshot)}' is not the literal '${String(value)}'`
        );
      }
      return snapshot;
    },

    is(v: unknown): v is T {
      return v === value;
    },

    validate(v: unknown, context: IValidationContext[]): IValidationResult {
      if (v === value) {
        return { valid: true, errors: [] };
      }
      return {
        valid: false,
        errors: [
          {
            context,
            value: v,
            message: `Value '${String(v)}' is not the literal '${String(value)}'`,
          },
        ],
      };
    },
  };
}

// ============================================================================
// Enumeration Type
// ============================================================================

export function enumeration<E extends string>(
  name: string,
  options: readonly E[]
): IEnumerationType<E>;
export function enumeration<E extends string>(options: readonly E[]): IEnumerationType<E>;
export function enumeration<E extends string>(
  nameOrOptions: string | readonly E[],
  maybeOptions?: readonly E[]
): IEnumerationType<E> {
  const name = typeof nameOrOptions === 'string' ? nameOrOptions : 'enumeration';
  const options = typeof nameOrOptions === 'string' ? maybeOptions! : nameOrOptions;

  const optionSet = new Set(options);

  return {
    name,
    _kind: 'enumeration',
    _options: options,
    _C: undefined as unknown as E,
    _S: undefined as unknown as E,
    _T: undefined as unknown as E,

    create(snapshot?: E): E {
      if (snapshot === undefined) {
        throw new Error(`[jotai-state-tree] A value for enumeration '${name}' is required`);
      }
      if (!optionSet.has(snapshot)) {
        throw new Error(
          `[jotai-state-tree] Value '${snapshot}' is not a valid option for enumeration '${name}'. ` +
          `Expected one of: ${options.join(', ')}`
        );
      }
      return snapshot;
    },

    is(value: unknown): value is E {
      return typeof value === 'string' && optionSet.has(value as E);
    },

    validate(value: unknown, context: IValidationContext[]): IValidationResult {
      if (typeof value === 'string' && optionSet.has(value as E)) {
        return { valid: true, errors: [] };
      }
      return {
        valid: false,
        errors: [
          {
            context,
            value,
            message: `Value '${String(value)}' is not a valid option. Expected one of: ${options.join(', ')}`,
          },
        ],
      };
    },
  };
}

// ============================================================================
// Frozen Type
// ============================================================================

export function frozen<T = unknown>(): IFrozenType<T>;
export function frozen<T>(defaultValue: T): IFrozenType<T>;
export function frozen<T>(defaultValue?: T): IFrozenType<T> {
  return {
    name: 'frozen',
    _kind: 'frozen',
    _C: undefined as unknown as T,
    _S: undefined as unknown as T,
    _T: undefined as unknown as T,

    create(snapshot?: T): T {
      if (snapshot === undefined) {
        if (defaultValue !== undefined) {
          // Deep freeze if object
          return deepFreeze(structuredClone(defaultValue));
        }
        return undefined as T;
      }
      // Deep freeze the snapshot
      return deepFreeze(structuredClone(snapshot));
    },

    is(value: unknown): value is T {
      // Frozen accepts any value
      return true;
    },

    validate(): IValidationResult {
      // Frozen accepts any value
      return { valid: true, errors: [] };
    },
  };
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  Object.freeze(obj);

  if (Array.isArray(obj)) {
    obj.forEach(deepFreeze);
  } else {
    Object.values(obj).forEach(deepFreeze);
  }

  return obj;
}

// ============================================================================
// Custom Type
// ============================================================================

export interface CustomTypeOptions<C, S, T> {
  name: string;
  fromSnapshot(snapshot: S): T;
  toSnapshot(value: T): S;
  isTargetType(value: unknown): value is T;
  getValidationMessage(value: unknown): string;
}

export function custom<C, S, T>(options: CustomTypeOptions<C, S, T>): IType<C, S, T> {
  return {
    name: options.name,
    _kind: 'simple' as const,
    _C: undefined as unknown as C,
    _S: undefined as unknown as S,
    _T: undefined as unknown as T,

    create(snapshot?: C): T {
      if (snapshot === undefined) {
        throw new Error(`[jotai-state-tree] A value for custom type '${options.name}' is required`);
      }
      return options.fromSnapshot(snapshot as unknown as S);
    },

    is(value: unknown): value is T {
      return options.isTargetType(value);
    },

    validate(value: unknown, context: IValidationContext[]): IValidationResult {
      if (options.isTargetType(value)) {
        return { valid: true, errors: [] };
      }
      return {
        valid: false,
        errors: [
          {
            context,
            value,
            message: options.getValidationMessage(value),
          },
        ],
      };
    },
  };
}

// ============================================================================
// Finite Number Type
// ============================================================================

/** Finite number type (excludes Infinity and -Infinity) */
export const finite: ISimpleType<number> = createSimpleType<number>(
  'finite',
  (value): value is number => typeof value === 'number' && isFinite(value)
);

/** Float type (alias for number) */
export const float = number;
