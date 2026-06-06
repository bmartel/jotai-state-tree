# Models & State

Models are the building blocks of your state tree. They define the shape of your state, the computed views derived from it, the actions allowed to mutate it, and lifecycle hooks.

---

## Defining Models

A model is created using `types.model`. You can optionally give it a name (highly recommended for debugging and reference resolution):

```typescript
// Named model
const User = types.model('User', {
  name: types.string,
  age: types.number,
});

// Anonymous model
const Coordinate = types.model({
  x: types.number,
  y: types.number,
});
```

You can also extend properties later using `.props()`:

```typescript
const Member = User.props({
  role: types.enumeration('Role', ['admin', 'member']),
});
```

---

## Views

Views are computed properties derived from the model's state. They are cached and only re-calculate when their dependencies change, making them highly performant.

There are two kinds of views:
1. **Getter Views**: Behave like standard object properties.
2. **Method Views**: Accept arguments to perform query-like operations.

```typescript
const Cart = types
  .model('Cart', {
    items: types.array(Item),
    taxRate: types.optional(types.number, 0.05),
  })
  .views((self) => ({
    // Getter view
    get subtotal() {
      return self.items.reduce((sum, item) => sum + item.price, 0);
    },
    // Chained getter view (depends on subtotal)
    get total() {
      return self.subtotal * (1 + self.taxRate);
    },
    // Method view (takes arguments)
    findItemsByCategory(category: string) {
      return self.items.filter((item) => item.category === category);
    }
  }));
```

---

## Actions

Actions are methods where mutations to the state tree properties are allowed. By default, **direct mutations of state outside actions will throw an error**. This enforces predictability and enables reliable snapshotting and patch generation.

```typescript
const Counter = types
  .model('Counter', {
    count: types.optional(types.number, 0),
  })
  .actions((self) => ({
    increment() {
      self.count++; // Allowed inside action
    },
    setCount(val: number) {
      self.count = val; // Allowed inside action
    }
  }));

const inst = Counter.create({});
inst.increment(); // OK
inst.count = 5; // Throws a write protection error in development!
```

### Protection in Production Mode
To ensure the best possible performance, write protection checks are bypassed completely in production build environments (`process.env.NODE_ENV === "production"`). This means:
- **In Development**: Direct mutations throw errors, helping you detect bugs early.
- **In Production**: Checks are skipped, providing **zero runtime overhead** for mutations.

---

## Volatile State

Volatile state represents local, mutable variables that are associated with a model instance but **do not appear in snapshots, patches, or serialization**. This is ideal for managing network loading states, socket connections, intervals, timers, or abort controllers.

```typescript
const NetworkLoader = types
  .model('NetworkLoader', {
    data: types.string,
  })
  .volatile(() => ({
    isLoading: false,
    error: null as string | null,
    timer: null as ReturnType<typeof setInterval> | null,
  }))
  .actions((self) => ({
    startLoading() {
      self.isLoading = true;
      self.error = null;
    },
    setSuccess(data: string) {
      self.isLoading = false;
      self.data = data;
    },
    setError(err: string) {
      self.isLoading = false;
      self.error = err;
    },
    cleanup() {
      if (self.timer) {
        clearInterval(self.timer);
      }
    }
  }));
```

Volatile state is completely isolated per instance.

---

## Lifecycle Hooks

`jotai-state-tree` supports lifecycle hooks on models to react to instantiations, movements inside the tree, or destructions.

- `afterCreate`: Called immediately after the node is instantiated.
- `afterAttach`: Called when the node is attached to a parent node in the tree.
- `beforeDetach`: Called right before the node is detached from its parent.
- `beforeDestroy`: Called right before the node is destroyed.

```typescript
const Todo = types
  .model('Todo', {
    title: types.string,
  })
  .afterCreate((self) => {
    console.log(`Todo "${self.title}" initialized`);
  })
  .afterAttach((self) => {
    console.log(`Attached at path: ${self.$treenode.$path}`);
  })
  .beforeDestroy((self) => {
    console.log('Todo being destroyed, cleaning up...');
  });
```

---

## The Extend Method

The `.extend()` method allows you to define views, actions, and volatile state in a single call, sharing a private lexical scope. This is useful for declaring private variables that shouldn't be accessible on the instance.

```typescript
const Timer = types
  .model('Timer', {
    seconds: types.optional(types.number, 0),
  })
  .extend((self) => {
    // Private state shared across views and actions
    let intervalId: ReturnType<typeof setInterval> | null = null;

    return {
      views: {
        get isRunning() {
          return intervalId !== null;
        }
      },
      actions: {
        start() {
          if (intervalId) return;
          intervalId = setInterval(() => {
            self.tick();
          }, 1000);
        },
        stop() {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        },
        tick() {
          self.seconds++;
        }
      }
    };
  });
```

---

## Snapshot Processing

You can transform input snapshots before instantiation, or output snapshots before serialization, using `preProcessSnapshot` and `postProcessSnapshot`. This is useful for dealing with legacy API schemas.

```typescript
const User = types
  .model('User', {
    name: types.string,
    birthDate: types.Date,
  })
  .preProcessSnapshot((snapshot: any) => {
    // Convert old string date format into Date timestamp
    return {
      name: snapshot.name,
      birthDate: typeof snapshot.dob === 'string' ? new Date(snapshot.dob).getTime() : snapshot.dob,
    };
  })
  .postProcessSnapshot((snapshot) => {
    // Customize outgoing serialization
    return {
      name: snapshot.name.toUpperCase(),
      birthDate: snapshot.birthDate,
    };
  });
```
