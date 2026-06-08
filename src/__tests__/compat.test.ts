import { describe, it, expect } from 'vitest';
import { types, clearAllRegistries, resetGlobalStore } from '../index';
import {
  isType,
  isPrimitiveType,
  getTypeName,
  isValidSnapshot,
  getValidationError,
  isInstanceOf,
  getOrCreate,
  getDebugInfo,
  printTree,
  hasIdentifier,
  getIdentifierAttribute,
  nullable,
  createTypeError,
  cloneFrozen,
  safeCreate,
  createWithDefaults,
} from '../compat';

describe('Compatibility Utilities', () => {
  it('isType', () => {
    expect(isType(types.string)).toBe(true);
    expect(isType(types.model({}))).toBe(true);
    expect(isType(null)).toBe(false);
    expect(isType({})).toBe(false);
    expect(isType(123)).toBe(false);
  });

  it('isPrimitiveType', () => {
    expect(isPrimitiveType(types.string)).toBe(true);
    expect(isPrimitiveType(types.number)).toBe(true);
    expect(isPrimitiveType(types.boolean)).toBe(true);
    expect(isPrimitiveType(types.identifier)).toBe(true);
    expect(isPrimitiveType(types.identifierNumber)).toBe(true);
    expect(isPrimitiveType(types.literal('foo'))).toBe(true);
    expect(isPrimitiveType(types.enumeration(['a', 'b']))).toBe(true);
    expect(isPrimitiveType(types.model({}))).toBe(false);
    expect(isPrimitiveType(types.array(types.string))).toBe(false);
  });

  it('getTypeName', () => {
    expect(getTypeName(types.string)).toBe('string');
    const Model = types.model('TestModel', {});
    expect(getTypeName(Model)).toBe('TestModel');
  });

  it('isValidSnapshot', () => {
    expect(isValidSnapshot(types.string, 'hello')).toBe(true);
    expect(isValidSnapshot(types.string, 123)).toBe(false);
    
    // Test validation throw branch
    const failingType = {
      validate() {
        throw new Error('fail');
      }
    } as any;
    expect(isValidSnapshot(failingType, 'test')).toBe(false);
  });

  it('getValidationError', () => {
    expect(getValidationError(types.string, 'hello')).toBeNull();
    expect(getValidationError(types.string, 123)).toBe("Value '123' is not a valid 'string'");
  });

  it('isInstanceOf', () => {
    const Model = types.model('TestModel', {
      name: types.string,
    });
    const instance = Model.create({ name: 'test' });
    expect(isInstanceOf(instance, Model)).toBe(true);
    expect(isInstanceOf({}, Model)).toBe(false);

    // Same name but different type reference
    const ModelWithSameName = types.model('TestModel', {
      name: types.string,
      other: types.optional(types.number, 0),
    });
    expect(isInstanceOf(instance, ModelWithSameName)).toBe(true);
  });

  it('getOrCreate', () => {
    const Model = types.model('TestModel', {
      name: types.string,
    });
    const instance = Model.create({ name: 'test' });
    expect(getOrCreate(Model, instance)).toBe(instance);
    
    const created = getOrCreate(Model, { name: 'new' });
    expect(created.name).toBe('new');
  });

  it('getDebugInfo', () => {
    const Model = types.model('TestModel', {
      id: types.identifier,
      name: types.string,
    });
    const instance = Model.create({ id: '1', name: 'test' });
    const info = getDebugInfo(instance);
    expect(info.typeName).toBe('TestModel');
    expect(info.path).toBe('');
    expect(info.identifier).toBe('1');
    expect(info.isAlive).toBe(true);
    expect(info.snapshot).toEqual({ id: '1', name: 'test' });

    // Model without identifier
    const SimpleModel = types.model('Simple', { name: types.string });
    const simpleInst = SimpleModel.create({ name: 'hello' });
    const simpleInfo = getDebugInfo(simpleInst);
    expect(simpleInfo.identifier).toBeNull();
  });

  it('printTree', () => {
    const Child = types.model('ChildModel', {
      value: types.number,
    });
    const Parent = types.model('ParentModel', {
      id: types.identifier,
      child: Child,
      label: types.string,
    });

    const instance = Parent.create({
      id: 'parent-1',
      child: { value: 42 },
      label: 'hello',
    });

    const printed = printTree(instance);
    expect(printed).toContain('ParentModel (parent-1)');
    expect(printed).toContain('child:     ChildModel');
    expect(printed).toContain('value: 42');
    expect(printed).toContain('label: "hello"');
  });

  it('hasIdentifier and getIdentifierAttribute', () => {
    const ModelWithId = types.model('WithId', { id: types.identifier });
    const ModelWithoutId = types.model('WithoutId', {});

    expect(hasIdentifier(ModelWithId)).toBe(true);
    expect(hasIdentifier(ModelWithoutId)).toBe(false);

    expect(getIdentifierAttribute(ModelWithId)).toBe('id');
    expect(getIdentifierAttribute(ModelWithoutId)).toBeUndefined();
  });

  it('nullable', () => {
    const nullableString = nullable(types.string);
    expect(nullableString.name).toBe('nullable<string>');
    
    expect(nullableString.create(null)).toBeNull();
    expect(nullableString.create(undefined)).toBeUndefined();
    expect(nullableString.create('hello')).toBe('hello');

    expect(nullableString.is(null)).toBe(true);
    expect(nullableString.is(undefined)).toBe(true);
    expect(nullableString.is('hello')).toBe(true);
    expect(nullableString.is(123)).toBe(false);

    expect(nullableString.validate(null, []).valid).toBe(true);
    expect(nullableString.validate(undefined, []).valid).toBe(true);
    expect(nullableString.validate('hello', []).valid).toBe(true);
    expect(nullableString.validate(123, []).valid).toBe(false);
  });

  it('createTypeError', () => {
    const err1 = createTypeError('Wrong type');
    expect(err1.message).toBe('[jotai-state-tree] Wrong type');

    const err2 = createTypeError('Wrong type', {
      typeName: 'string',
      path: '/name',
      value: 123,
    });
    expect(err2.message).toBe('[jotai-state-tree] Wrong type (type: string) (path: /name) (value: 123)');
  });

  it('cloneFrozen', () => {
    expect(cloneFrozen(null)).toBeNull();
    expect(cloneFrozen(123)).toBe(123);
    expect(cloneFrozen('hello')).toBe('hello');

    const arr = [1, { a: 2 }];
    const clonedArr = cloneFrozen(arr);
    expect(clonedArr).toEqual(arr);
    expect(clonedArr[1]).not.toBe(arr[1]);

    const obj = { a: 1, b: [2, 3], c: { d: 4 } };
    const clonedObj = cloneFrozen(obj);
    expect(clonedObj).toEqual(obj);
    expect(clonedObj.b).not.toBe(obj.b);
    expect(clonedObj.c).not.toBe(obj.c);
  });

  it('safeCreate and createWithDefaults', () => {
    const Model = types.model('TestModel', {
      name: types.optional(types.string, 'default'),
    });

    const instance1 = safeCreate(Model, { name: 'hello' });
    expect(instance1).toBeDefined();
    expect(instance1?.name).toBe('hello');

    const instance2 = safeCreate(Model, { name: 123 }); // validation failure
    expect(instance2).toBeUndefined();

    const instance3 = createWithDefaults(Model);
    expect(instance3.name).toBe('default');
  });
});
