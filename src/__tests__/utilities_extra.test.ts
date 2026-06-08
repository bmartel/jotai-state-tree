import { describe, it, expect } from 'vitest';
import { types, getSnapshot, unprotect } from '../index';
import { createRouter } from '../router';

describe('Utility Types Extra', () => {
  it('maybe and maybeNull type validations', () => {
    const MaybeString = types.maybe(types.string);
    expect(MaybeString.create(undefined)).toBeUndefined();
    expect(MaybeString.create('test')).toBe('test');
    expect(MaybeString.is(undefined)).toBe(true);
    expect(MaybeString.is('test')).toBe(true);
    expect(MaybeString.is(123)).toBe(false);

    const MaybeNullString = types.maybeNull(types.string);
    expect(MaybeNullString.create(null)).toBeNull();
    expect(MaybeNullString.create('test')).toBe('test');
    expect(MaybeNullString.is(null)).toBe(true);
    expect(MaybeNullString.is('test')).toBe(true);
    expect(MaybeNullString.is(123)).toBe(false);
  });

  it('refinement type validations', () => {
    // Refinement type checking for odd numbers
    const OddNumber = types.refinement(
      types.number,
      (val): val is number => typeof val === 'number' && val % 2 !== 0
    );

    expect(OddNumber.name).toBe('refinement<number>');
    expect(OddNumber.create(3)).toBe(3);
    expect(() => OddNumber.create(4)).toThrow(
      "failed refinement predicate"
    );

    expect(OddNumber.is(3)).toBe(true);
    expect(OddNumber.is(4)).toBe(false);

    const resultSuccess = OddNumber.validate(5, []);
    expect(resultSuccess.valid).toBe(true);

    const resultFail = OddNumber.validate(6, []);
    expect(resultFail.valid).toBe(false);
  });

  it('snapshotProcessor conversions', () => {
    const ProcessedModel = types.snapshotProcessor(
      types.model('ProcessedModel', {
        name: types.string,
      }),
      {
        preProcessor(sn: { _name: string }) {
          return {
            name: sn._name,
          };
        },
      }
    );

    // 1. Create with snapshot processor
    const instance = ProcessedModel.create({ _name: 'Alice' } as any);
    expect(instance.name).toBe('Alice');

    // 2. Validate and check is() for snapshotProcessor
    expect(ProcessedModel.is(instance)).toBe(true);
    expect(ProcessedModel.validate({ _name: 'Alice' }, []).valid).toBe(true);
  });

  it('safeReference validations', () => {
    const Target = types.model('RefModel', { id: types.identifier });
    const RefType = types.safeReference(Target, {
      onInvalidated() {
        return undefined;
      }
    });
    expect(RefType.is(undefined)).toBe(true);
    expect(RefType.validate(undefined, []).valid).toBe(true);
    expect(RefType.validate(123, []).valid).toBe(true); // string or number is valid identifier
    expect(RefType.validate({}, []).valid).toBe(false); // object is not a valid identifier

    // Create safeReference with missing identifier
    expect(RefType.create(undefined)).toBeUndefined();
    // Create safeReference with missing target
    expect(RefType.create('missing')).toBeUndefined();
  });

  it('OptionalType boundaries', () => {
    const OptStr = types.optional(types.string, 'default');
    
    // is check
    expect(OptStr.is(undefined)).toBe(true);
    expect(OptStr.is('abc')).toBe(true);
    expect(OptStr.is(123)).toBe(false);

    // validate
    expect(OptStr.validate(undefined, []).valid).toBe(true);
    expect(OptStr.validate('abc', []).valid).toBe(true);
    expect(OptStr.validate(123, []).valid).toBe(false);
  });

  it('refinement custom error message formats', () => {
    // 1. Custom string message
    const PosNum = types.refinement(
      types.number,
      (v) => v > 0,
      'Must be positive'
    );
    expect(() => PosNum.create(-5)).toThrow('[jotai-state-tree] Must be positive');
    expect(PosNum.validate(-5, []).errors[0].message).toBe('Must be positive');

    // 2. Custom function message
    const CustomMsgNum = types.refinement(
      types.number,
      (v) => v > 0,
      (v) => `Value ${v} is not positive`
    );
    expect(() => CustomMsgNum.create(-10)).toThrow('[jotai-state-tree] Value -10 is not positive');
    expect(CustomMsgNum.validate(-10, []).errors[0].message).toBe('Value -10 is not positive');
  });

  it('ReferenceType proxy boundaries and error validation', () => {
    const Target = types.model('RefTarget', {
      id: types.identifier,
      name: types.string,
    }).actions(self => ({
      setName(name: string) {
        self.name = name;
      }
    }));
    
    // Reference without identifier should throw on creation
    const Ref = types.reference(Target);
    expect(() => Ref.create(undefined as any)).toThrow('[jotai-state-tree] Reference requires an identifier');

    // Reference validation checks
    expect(Ref.validate(123, []).valid).toBe(true);
    expect(Ref.validate({}, []).valid).toBe(false);

    // Create reference proxy
    const refProxy = Ref.create('r-1');

    // Try accessing property before it exists in identifier registry -> throws
    expect(() => refProxy.name).toThrow("[jotai-state-tree] Failed to resolve reference 'r-1' to type 'RefTarget'");
    expect(() => { refProxy.name = 'test'; }).toThrow("[jotai-state-tree] Failed to resolve reference 'r-1' to type 'RefTarget'");
    expect('name' in refProxy).toBe(false);

    // Create target instance
    const inst = Target.create({ id: 'r-1', name: 'target' });
    unprotect(inst);

    // Now accesses succeed
    expect(refProxy.name).toBe('target');
    expect('name' in refProxy).toBe(true);

    refProxy.setName('updated');
    expect(inst.name).toBe('updated');

    refProxy.name = 'direct-updated';
    expect(inst.name).toBe('direct-updated');
  });

  it('model preProcessSnapshot and postProcessSnapshot builders', () => {
    const Model = types.model('ProcessedModelBuilder', {
      name: types.string,
    })
    .preProcessSnapshot((sn: any) => {
      return {
        name: sn._name,
      };
    })
    .postProcessSnapshot((sn) => {
      return {
        ...sn,
        name: sn.name.toUpperCase(),
      };
    });

    const instance = Model.create({ _name: 'Alice' } as any);
    expect(instance.name).toBe('Alice');
    expect(getSnapshot(instance)).toEqual({ name: 'ALICE' });
  });

  it('additional type validations, union, late, refinement, reference and safereference checks', () => {
    // 1. Maybe and MaybeNull validation
    const MaybeString = types.maybe(types.string);
    expect(MaybeString.validate(undefined, []).valid).toBe(true);
    expect(MaybeString.validate('test', []).valid).toBe(true);
    expect(MaybeString.validate(123, []).valid).toBe(false);

    const MaybeNullString = types.maybeNull(types.string);
    expect(MaybeNullString.validate(null, []).valid).toBe(true);
    expect(MaybeNullString.validate('test', []).valid).toBe(true);
    expect(MaybeNullString.validate(123, []).valid).toBe(false);

    // 2. Union
    const UnionType = types.union(types.string, types.number);
    expect(UnionType.create('abc')).toBe('abc');
    expect(() => UnionType.create(true)).toThrow("No type in union matched the value: true");
    expect(UnionType.is('abc')).toBe(true);
    expect(UnionType.is(123)).toBe(true);
    expect(UnionType.is(true)).toBe(false);
    expect(UnionType.validate('abc', []).valid).toBe(true);
    expect(UnionType.validate(true, []).valid).toBe(false);

    // 3. Late
    const LateString = types.late('LateString', () => types.string);
    expect(LateString.name).toBe('LateString');
    expect(LateString.is('abc')).toBe(true);
    expect(LateString.validate('abc', []).valid).toBe(true);

    // 4. Refinement base failure
    const OddNumber = types.refinement(
      types.number,
      (val): val is number => typeof val === 'number' && val % 2 !== 0
    );
    expect(OddNumber.validate('not-a-number', []).valid).toBe(false);

    // 5. Reference custom getter
    const Child = types.model('ChildRefTest', {
      id: types.identifier,
      name: types.string,
    });
    const CustomRef = types.reference(Child, {
      get(identifier, parent) {
        return Child.create({ id: String(identifier), name: 'CustomName' });
      },
      set(value) {
        return value.id;
      }
    });
    const refInstance = CustomRef.create('c-1');
    expect(refInstance.name).toBe('CustomName');

    // 6. ReferenceType.is and set handler on unresolved proxy
    const NormalRef = types.reference(Child);
    const childInst = Child.create({ id: 'c-99', name: 'bob' });
    expect(NormalRef.is(childInst)).toBe(true);

    const refProxy = NormalRef.create('c-99');
    unprotect(childInst);
    refProxy.name = 'new-bob';
    expect(childInst.name).toBe('new-bob');

    // 7. SafeReference invalid target resolve with no handler
    const SafeRefNoHandler = types.safeReference(Child);
    expect(SafeRefNoHandler.create('non-existent')).toBeUndefined();

    // 8. SafeReference.is with undefined and instance
    expect(SafeRefNoHandler.is(undefined)).toBe(true);
    expect(SafeRefNoHandler.is(childInst)).toBe(true);
    expect(SafeRefNoHandler.is('not-an-instance')).toBe(false);

    // 9. Reference custom get handler returning falsy
    const RefWithFalsyGet = types.reference(Child, {
      get(identifier) {
        return null as any;
      },
      set(value) {
        return value.id;
      }
    });
    expect(() => RefWithFalsyGet.create('c-999').name).toThrow();

    // 10. SnapshotProcessor without preProcessor (only postProcessor)
    const OnlyPostProcessor = types.snapshotProcessor(
      types.model('PostOnly', { name: types.string }),
      {
        postProcessor(sn) {
          return {
            ...sn,
            upperName: sn.name.toUpperCase(),
          };
        }
      }
    );
    const postInst = OnlyPostProcessor.create({ name: 'alice' });
    expect(postInst.name).toBe('alice');
    expect(OnlyPostProcessor.validate({ name: 'bob' }, []).valid).toBe(true);
  });

  it('router in node environment (window undefined branches)', () => {
    const r = createRouter({
      routes: [{ path: '/', name: 'home' }],
    });
    expect(r.pathname).toBe('/');
    expect(() => r.syncLocation('/about', '', '', 'PUSH')).not.toThrow();
    expect(() => r.go(1)).not.toThrow();
    expect(() => r.goBack()).not.toThrow();
    expect(() => r.goForward()).not.toThrow();
  });
});

