import { describe, it, expect } from 'vitest';
import { types } from '../index';

describe('Primitives Extra Boundaries', () => {
  it('custom types', () => {
    // Create a custom Type representing a coordinate pair: string "x,y" <-> { x: number, y: number }
    const CoordType = types.custom<{ x: number; y: number }, string, { x: number; y: number }>({
      name: 'Coord',
      fromSnapshot(snapshot: string) {
        const [x, y] = snapshot.split(',').map(Number);
        return { x, y };
      },
      toSnapshot(value: { x: number; y: number }) {
        return `${value.x},${value.y}`;
      },
      isTargetType(value: unknown): value is { x: number; y: number } {
        return (
          value !== null &&
          typeof value === 'object' &&
          'x' in value &&
          'y' in value &&
          typeof (value as any).x === 'number' &&
          typeof (value as any).y === 'number'
        );
      },
      getValidationMessage(value: unknown) {
        return `Value '${String(value)}' is not a valid Coordinate object`;
      },
    });

    // 1. Creation from snapshot
    const coord = CoordType.create('10,20');
    expect(coord).toEqual({ x: 10, y: 20 });

    // 2. Missing creation snapshot
    expect(() => CoordType.create(undefined)).toThrow(
      "[jotai-state-tree] A value for custom type 'Coord' is required"
    );

    // 3. Typeguard checking
    expect(CoordType.is({ x: 5, y: -5 })).toBe(true);
    expect(CoordType.is('5,-5')).toBe(false);

    // 4. Validation
    const valResultSuccess = CoordType.validate({ x: 1, y: 2 }, []);
    expect(valResultSuccess.valid).toBe(true);

    const valResultFail = CoordType.validate('1,2', []);
    expect(valResultFail.valid).toBe(false);
    expect(valResultFail.errors[0].message).toBe("Value '1,2' is not a valid Coordinate object");
  });

  it('finite number type', () => {
    expect(types.finite.is(10)).toBe(true);
    expect(types.finite.is(Infinity)).toBe(false);
    expect(types.finite.is(-Infinity)).toBe(false);
    expect(types.finite.is(NaN)).toBe(false);

    expect(types.finite.create(4.2)).toBe(4.2);
    expect(() => types.finite.create(Infinity)).toThrow(
      "[jotai-state-tree] Value 'Infinity' is not a valid 'finite'"
    );
  });

  it('missing simple value errors', () => {
    // A primitive with no default value should throw an error when created with undefined
    expect(() => types.string.create(undefined)).toThrow(
      "[jotai-state-tree] A value of type 'string' is required"
    );
    expect(() => types.number.create(undefined)).toThrow(
      "[jotai-state-tree] A value of type 'number' is required"
    );
    expect(() => types.integer.create(undefined)).toThrow(
      "[jotai-state-tree] A value of type 'integer' is required"
    );
    expect(() => types.boolean.create(undefined)).toThrow(
      "[jotai-state-tree] A value of type 'boolean' is required"
    );
    expect(() => types.enumeration(['yes', 'no']).create(undefined)).toThrow(
      "[jotai-state-tree] A value for enumeration 'enumeration' is required"
    );
  });

  it('enumeration invalid option errors', () => {
    const Answer = types.enumeration('Answer', ['yes', 'no']);
    expect(() => Answer.create('maybe' as any)).toThrow(
      "[jotai-state-tree] Value 'maybe' is not a valid option for enumeration 'Answer'. Expected one of: yes, no"
    );
  });
});
