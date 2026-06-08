import { describe, it, expect } from 'vitest';
import {
  types,
  cast,
  castToSnapshot,
  castToReferenceSnapshot,
  isIdentifierType,
  isModelType,
  isArrayType,
  isMapType,
  isReferenceType,
  isUnionType,
  isOptionalType,
  isLateType,
  isFrozenType,
  isLiteralType,
  typecheck,
} from '../index';

describe('Index Utilities', () => {
  it('casting helpers', () => {
    // cast
    const val: any = 'test';
    const casted = cast<string>(val);
    expect(casted).toBe('test');

    // castToSnapshot
    expect(castToSnapshot(val)).toBe('test');

    // castToReferenceSnapshot
    const Model = types.model('Item', { id: types.identifier });
    const instance = Model.create({ id: 'item-1' });
    expect(castToReferenceSnapshot(instance)).toBe('item-1');
    expect(castToReferenceSnapshot('simple-id')).toBe('simple-id');

    const ModelNoId = types.model('ItemNoId', { name: types.string });
    const instanceNoId = ModelNoId.create({ name: 'test' });
    expect(castToReferenceSnapshot(instanceNoId)).toBe(instanceNoId);
  });

  it('typecheck helper', () => {
    expect(() => typecheck(types.string, 'hello')).not.toThrow();
    expect(() => typecheck(types.string, 123)).toThrow('[jotai-state-tree] Value does not match type');
  });

  it('type guards and assertions', () => {
    // isIdentifierType
    expect(isIdentifierType(types.identifier)).toBe(true);
    expect(isIdentifierType(types.identifierNumber)).toBe(true);
    expect(isIdentifierType(types.string)).toBe(false);
    expect(isIdentifierType(null)).toBe(false);

    // isModelType
    expect(isModelType(types.model({}))).toBe(true);
    expect(isModelType(types.string)).toBe(false);
    expect(isModelType(null)).toBe(false);

    // isArrayType
    expect(isArrayType(types.array(types.string))).toBe(true);
    expect(isArrayType(types.string)).toBe(false);
    expect(isArrayType(null)).toBe(false);

    // isMapType
    expect(isMapType(types.map(types.string))).toBe(true);
    expect(isMapType(types.string)).toBe(false);
    expect(isMapType(null)).toBe(false);

    // isReferenceType
    const TargetModel = types.model('Target', { id: types.identifier });
    expect(isReferenceType(types.reference(TargetModel))).toBe(true);
    expect(isReferenceType(types.safeReference(TargetModel))).toBe(true);
    expect(isReferenceType(types.string)).toBe(false);
    expect(isReferenceType(null)).toBe(false);

    // isUnionType
    expect(isUnionType(types.union(types.string, types.number))).toBe(true);
    expect(isUnionType(types.string)).toBe(false);
    expect(isUnionType(null)).toBe(false);

    // isOptionalType
    expect(isOptionalType(types.optional(types.string, ''))).toBe(true);
    expect(isOptionalType(types.maybe(types.string))).toBe(true);
    expect(isOptionalType(types.maybeNull(types.string))).toBe(true);
    expect(isOptionalType(types.string)).toBe(false);
    expect(isOptionalType(null)).toBe(false);

    // isLateType
    expect(isLateType(types.late(() => types.string))).toBe(true);
    expect(isLateType(types.string)).toBe(false);
    expect(isLateType(null)).toBe(false);

    // isFrozenType
    expect(isFrozenType(types.frozen())).toBe(true);
    expect(isFrozenType(types.string)).toBe(false);
    expect(isFrozenType(null)).toBe(false);

    // isLiteralType
    expect(isLiteralType(types.literal('val'))).toBe(true);
    expect(isLiteralType(types.string)).toBe(false);
    expect(isLiteralType(null)).toBe(false);
  });
});
