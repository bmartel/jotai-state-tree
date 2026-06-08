import { describe, it, expect } from 'vitest';
import { types } from '../index';
import { LRUCache } from '../model';

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

  it('frozen type extra features', () => {
    const FrozenWithDefault = types.frozen({ x: 1, list: [2, 3] });
    expect(FrozenWithDefault.is(null)).toBe(true);
    expect(FrozenWithDefault.validate().valid).toBe(true);

    const instance = FrozenWithDefault.create();
    expect(instance).toEqual({ x: 1, list: [2, 3] });
    expect(Object.isFrozen(instance)).toBe(true);
    expect(Object.isFrozen(instance.list)).toBe(true);

    const FrozenNoDefault = types.frozen();
    expect(FrozenNoDefault.create(undefined)).toBeUndefined();
  });

  it('DatePrimitive boundaries', () => {
    // 1. Create with undefined
    const d1 = types.Date.create();
    expect(d1).toBeInstanceOf(Date);

    // 2. Create with Date instance
    const now = new Date();
    const d2 = types.Date.create(now);
    expect(d2.getTime()).toBe(now.getTime());

    // 3. Create with number timestamp
    const ts = 1717800000000;
    const d3 = types.Date.create(ts);
    expect(d3.getTime()).toBe(ts);

    // 4. Create with invalid type
    expect(() => types.Date.create('invalid' as any)).toThrow(
      "[jotai-state-tree] Value is not a valid Date"
    );

    // 5. is and validate
    expect(types.Date.is(now)).toBe(true);
    expect(types.Date.is('invalid')).toBe(false);
    expect(types.Date.validate(now, []).valid).toBe(true);
    expect(types.Date.validate(ts, []).valid).toBe(true);
    expect(types.Date.validate('invalid', []).valid).toBe(false);
  });

  it('null and undefined types is checks', () => {
    expect(types.null.is(null)).toBe(true);
    expect(types.null.is(undefined)).toBe(false);

    expect(types.undefined.is(undefined)).toBe(true);
    expect(types.undefined.is(null)).toBe(false);
  });

  it('identifierNumber validation', () => {
    expect(types.identifierNumber.validate(123, []).valid).toBe(true);
    expect(types.identifierNumber.validate('123', []).valid).toBe(false);
  });

  it('literal creation and validation', () => {
    const One = types.literal(1);
    expect(One.create()).toBe(1);
    expect(One.create(1)).toBe(1);
    expect(() => One.create(2 as any)).toThrow(
      "[jotai-state-tree] Value '2' is not the literal '1'"
    );
    expect(One.is(1)).toBe(true);
    expect(One.is(2)).toBe(false);
    expect(One.validate(1, []).valid).toBe(true);
    expect(One.validate(2, []).valid).toBe(false);
  });

  it('enumeration type checks and validation errors', () => {
    const Color = types.enumeration('Color', ['red', 'green']);
    expect(Color.is('red')).toBe(true);
    expect(Color.is('blue')).toBe(false);
    expect(Color.is(123)).toBe(false); // non-string

    expect(Color.validate('green', []).valid).toBe(true);
    expect(Color.validate('blue', []).valid).toBe(false);
    expect(Color.validate(123, []).valid).toBe(false);
  });

  it('LRUCache unit tests', () => {
    const cache = new LRUCache(2);

    expect(cache.size).toBe(0);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
    expect(cache.has('a')).toBe(true);

    // Get 'a' to make it MRU
    expect(cache.get('a')).toBe(1);

    // Set 'c' which should evict 'b' (oldest since 'a' was touched)
    cache.set('c', 3);
    expect(cache.size).toBe(2);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('c')).toBe(true);

    // Set 'c' again to update value
    cache.set('c', 4);
    expect(cache.get('c')).toBe(4);

    // Clear
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('ModelType named, props and validate boundaries', () => {
    const M1 = types.model('M1', {
      x: types.number,
    });
    
    // named
    const M2 = M1.named('M2');
    expect(M2.name).toBe('M2');

    // props
    const M3 = M1.props({ y: types.string });
    expect(M3.properties.y).toBeDefined();

    // is and validate on non-objects
    expect(M1.is(null)).toBe(false);
    expect(M1.is('string')).toBe(false);
    expect(M1.is(undefined)).toBe(false);

    expect(M1.validate(null, []).valid).toBe(false);
    expect(M1.validate('string', []).valid).toBe(false);
    expect(M1.validate(undefined, []).valid).toBe(false);
  });
});


