# Types & Composition

`jotai-state-tree` has a rich type system that validates snapshots at runtime and provides perfect compile-time TypeScript inference without requiring type casts.

---

## Type Categories

### 1. Primitive Types

Primitives represent basic data values and are validated at runtime:

| Type | Validates | Creation Type | Output Type |
|------|-----------|---------------|-------------|
| `types.string` | `typeof value === 'string'` | `string` | `string` |
| `types.number` | `typeof value === 'number'` | `number` | `number` |
| `types.integer` | Integer values only | `number` | `number` |
| `types.boolean` | `typeof value === 'boolean'` | `boolean` | `boolean` |
| `types.finite` | Finite numbers (not Infinity or NaN) | `number` | `number` |
| `types.float` | Alias for number | `number` | `number` |
| `types.Date` | Date objects or timestamps (stored as timestamp) | `Date | number` | `number` |
| `types.null` | `value === null` | `null` | `null` |
| `types.undefined` | `value === undefined` | `undefined` | `undefined` |

### 2. Identifier Types

Identifiers uniquely distinguish model instances within a state tree. A model may have at most **one** identifier property.

```typescript
const User = types.model('User', {
  id: types.identifier,          // String identifier
  code: types.identifierNumber,  // Number identifier
});
```

---

## Collection Types

### Arrays (`types.array`)

Represents an array of uniform types. Mutating methods are protected and automatically track changes to generate snapshots/patches.

```typescript
const Store = types.model('Store', {
  items: types.array(types.string),
});

const store = Store.create({ items: ['a', 'b'] });

// Mutating methods (must be run inside actions)
store.items.push('c');             // Add item
store.items.unshift('z');          // Prepend item
store.items.replace(['x', 'y']);   // Replace all items
store.items.remove('x');           // Remove a specific item (returns boolean)
store.items.clear();               // Remove all items
```

### Maps (`types.map`)

Represents an ES6 Map-like structure where keys are always strings.

```typescript
const UserRegistry = types.model('UserRegistry', {
  users: types.map(User),
});

const registry = UserRegistry.create({ users: {} });

// Mutating methods (must be run inside actions)
registry.users.set('1', { id: '1', name: 'Alice' });

// put(): Convenience method that automatically uses the item's identifier as the map key
registry.users.put({ id: '2', name: 'Bob' }); // set at key '2'

// merge(): Merges key-value records into the map
registry.users.merge({
  '3': { id: '3', name: 'Charlie' },
});

registry.users.delete('1');
```

---

## Optionality & Nullability

- `types.optional(type, defaultValue | () => defaultValue)`: Makes a property optional in the input snapshot. If omitted, the default value is used.
- `types.maybe(type)`: Shorthand for `types.union(type, types.undefined)`.
- `types.maybeNull(type)`: Shorthand for `types.union(type, types.null)`.

```typescript
const Profile = types.model('Profile', {
  theme: types.optional(types.string, 'light'),
  counter: types.optional(types.number, () => Math.floor(Math.random() * 100)),
  nickname: types.maybe(types.string),      // string | undefined
  bio: types.maybeNull(types.string),       // string | null | undefined (in snapshot)
});
```

---

## Union & Custom Types

### Unions (`types.union`)

Matches a value against several types in order. You can optionally pass a `dispatcher` option to determine the type dynamically for performance.

```typescript
// Eager union
const Status = types.union(
  types.literal('pending'),
  types.literal('active'),
  types.literal('failed')
);

// Union with dispatcher (highly recommended for performance)
const Shape = types.union(
  { dispatcher: (snapshot: any) => snapshot.type === 'circle' ? Circle : Rectangle },
  Circle,
  Rectangle
);
```

### Late Types (`types.late`)

Defers type resolution to runtime, which is necessary to define recursive or self-referencing models without compiler circularity errors.

```typescript
const Folder = types.model('Folder', {
  name: types.string,
  files: types.array(types.string),
  subfolders: types.array(types.late(() => Folder)), // Recursive
});
```

### Refinement Types (`types.refinement`)

Adds runtime validation constraints on top of an existing type.

```typescript
const PositiveInteger = types.refinement(
  types.integer,
  (val) => val > 0,
  'Value must be a positive integer'
);
```

### Custom Types (`types.custom`)

Create a custom type with custom snapshot serialization/deserialization.

```typescript
import Decimal from 'decimal.js';

const DecimalType = types.custom<string, Decimal>({
  name: 'DecimalType',
  fromSnapshot(value: string) { return new Decimal(value); },
  toSnapshot(value: Decimal) { return value.toString(); },
  isTargetType(value) { return value instanceof Decimal; },
  getValidationMessage(value) { return 'Invalid decimal format'; },
});
```

---

## Reference Types

References allow you to refer to other nodes in the state tree using their identifier value. References are resolved lazily when accessed.

- `types.reference(TargetModel)`: Throws a runtime error when resolved if the target is not found in the tree.
- `types.safeReference(TargetModel)`: Returns `undefined` if the target is not found (great for garbage collection cleanups).

```typescript
const Author = types.model('Author', { id: types.identifier, name: types.string });
const Book = types.model('Book', {
  title: types.string,
  author: types.reference(Author),
  coAuthor: types.safeReference(Author),
});
```

### Custom References
You can customize reference resolution, formatting, and handling of invalidated references:

```typescript
const CustomRef = types.reference(Author, {
  get(identifier, parent) {
    // Resolve reference from a custom database or index
    return resolveAuthorFromGlobalRegistry(identifier);
  },
  set(author) {
    return author.id;
  },
  onInvalidated({ parent, invalidId, replaceRef, removeRef, cause }) {
    console.warn(`Reference ${invalidId} was invalidated due to ${cause}`);
    removeRef(); // Automatically clear reference field
  }
});
```

---

## Model Composition & Mixins

### Model Composition (`types.compose`)

Merges two existing model types into a new model type, combining their properties, views, actions, and volatile state.

```typescript
const Identifiable = types.model({ id: types.identifier });
const Timestamped = types.model({ createdAt: types.number }).actions(self => ({
  touch() { self.createdAt = Date.now(); }
}));

// Composed model has 'id', 'createdAt' and 'touch' action
const UserEntity = types.compose('UserEntity', Identifiable, Timestamped);
```

### Mixins (`types.mixin`)

Define a reusable slice of functionality (views, actions, volatile state) that declares what properties it `requires` from models it is applied to.

```typescript
// Define mixin
const Validatable = types.mixin({
  requires: {
    errors: types.array(types.string),
  },
  views: (self) => ({
    get isValid() { return self.errors.length === 0; }
  }),
  actions: (self) => ({
    addError(err: string) { self.errors.push(err); },
    clearErrors() { self.errors.clear(); }
  })
});

// Apply mixin to a model
const FormModel = types
  .model('FormModel', {
    fields: types.map(types.string),
    errors: types.array(types.string),
  })
  .apply(Validatable); // Item now has isValid, addError, clearErrors
```
