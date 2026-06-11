/**
 * Array type implementation
 */

import { atom } from "jotai";
import type {
  IArrayType,
  IMSTArray,
  IType,
  IValidationContext,
  IValidationResult,
  IAnyType,
  IJsonPatch,
  IReversibleJsonPatch,
} from "./types";
import {
  StateTreeNode,
  $treenode,
  getStateTreeNode,
  getGlobalStore,
  getSnapshotFromNode,
  applySnapshotToNode,
} from "./tree";
import { canWrite } from "./lifecycle";

// ============================================================================
// MST Array Implementation
// ============================================================================

class MSTArray<T> extends Array<T> implements IMSTArray<T> {
  private node: StateTreeNode;
  private itemType: IAnyType;
  _isMutating = false;

  constructor(node: StateTreeNode, itemType: IAnyType, items: T[] = []) {
    super(...items);
    this.node = node;
    this.itemType = itemType;
    this._isMutating = false;

    // Set prototype correctly for extending Array
    Object.setPrototypeOf(this, MSTArray.prototype);
  }

  private checkWrite(): void {
    if (!this.node.$isAlive) {
      throw new Error("[jotai-state-tree] Cannot modify array - the node is dead.");
    }
    if (!canWrite(this.node)) {
      throw new Error(
        `Cannot modify the array - the parent object is protected and can only be modified inside an action.`
      );
    }
  }

  replace(items: T[]): void {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      this.length = 0;
      this.push(...items);
      this.syncToNode();
    } finally {
      this._isMutating = wasMutating;
    }
  }

  clear(): void {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      this.length = 0;
      this.syncToNode();
    } finally {
      this._isMutating = wasMutating;
    }
  }

  remove(item: T): boolean {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      const index = this.indexOf(item);
      if (index >= 0) {
        this.splice(index, 1);
        this.syncToNode();
        return true;
      }
      return false;
    } finally {
      this._isMutating = wasMutating;
    }
  }

  spliceWithArray(index: number, deleteCount?: number, newItems?: T[]): T[] {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      const result =
        deleteCount !== undefined
          ? newItems
            ? this.splice(index, deleteCount, ...newItems)
            : this.splice(index, deleteCount)
          : this.splice(index);
      this.syncToNode();
      return result;
    } finally {
      this._isMutating = wasMutating;
    }
  }

  // Override mutating methods to sync
  push(...items: T[]): number {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      const result = super.push(...items);
      this.syncToNode();
      return result;
    } finally {
      this._isMutating = wasMutating;
    }
  }

  pop(): T | undefined {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      const result = super.pop();
      this.syncToNode();
      return result;
    } finally {
      this._isMutating = wasMutating;
    }
  }

  shift(): T | undefined {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      const result = super.shift();
      this.syncToNode();
      return result;
    } finally {
      this._isMutating = wasMutating;
    }
  }

  unshift(...items: T[]): number {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      const result = super.unshift(...items);
      this.syncToNode();
      return result;
    } finally {
      this._isMutating = wasMutating;
    }
  }

  splice(start: number, deleteCount?: number, ...items: T[]): T[] {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      const result =
        deleteCount !== undefined
          ? super.splice(start, deleteCount, ...items)
          : super.splice(start);
      this.syncToNode();
      return result;
    } finally {
      this._isMutating = wasMutating;
    }
  }

  sort(compareFn?: (a: T, b: T) => number): this {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      super.sort(compareFn);
      this.syncToNode();
      return this;
    } finally {
      this._isMutating = wasMutating;
    }
  }

  reverse(): T[] {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      super.reverse();
      this.syncToNode();
      return this;
    } finally {
      this._isMutating = wasMutating;
    }
  }

  fill(value: T, start?: number, end?: number): this {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      super.fill(value, start, end);
      this.syncToNode();
      return this;
    } finally {
      this._isMutating = wasMutating;
    }
  }

  copyWithin(target: number, start: number, end?: number): this {
    this.checkWrite();
    const wasMutating = this._isMutating;
    this._isMutating = true;
    try {
      super.copyWithin(target, start, end);
      this.syncToNode();
      return this;
    } finally {
      this._isMutating = wasMutating;
    }
  }

  toJSON(): T[] {
    return [...this];
  }

  private syncToNode(): void {
    const oldArray = (this.node.getValue() as unknown[]) || [];
    const newArray = [...this];

    // Collect snapshots of existing children before we modify the children tree
    const oldSnapshots = new Map<number, unknown>();
    for (let i = 0; i < oldArray.length; i++) {
      const childNode = this.node.getChild(String(i));
      oldSnapshots.set(i, childNode ? getSnapshotFromNode(childNode) : oldArray[i]);
    }

    // Collect existing child nodes for cleanup comparison
    const existingChildNodes = new Set<StateTreeNode>();
    for (const [, child] of this.node.getChildren()) {
      existingChildNodes.add(child);
    }

    const newChildren = new Map<string, StateTreeNode>();
    const keptNodes = new Set<StateTreeNode>();

    // Create new children for each item
    this.forEach((item, index) => {
      const key = String(index);
      // Check if item is a complex type (has tree node) - handles late/maybe wrappers too
      if (item && typeof item === "object" && $treenode in item) {
        const childNode = getStateTreeNode(item);
        newChildren.set(key, childNode);
        keptNodes.add(childNode);
      } else {
        // Check if we can reconcile/reuse an existing complex node in existingChildNodes
        let reusedNode: StateTreeNode | null = null;

        // Helper to resolve actual model type (unwrapping wrappers like optional/late/maybe)
        const resolveActualType = (type: IAnyType): IAnyType => {
          let current = type;
          while (current) {
            if (
              current._kind === "optional" ||
              current._kind === "maybe" ||
              current._kind === "maybeNull" ||
              current._kind === "refinement"
            ) {
              current = (current as any)._subType;
            } else if (current._kind === "late") {
              current = (current as any)._definition();
            } else {
              break;
            }
          }
          return current;
        };

        const actualType = resolveActualType(this.itemType);
        const isComplex =
          actualType._kind === "model" ||
          actualType._kind === "array" ||
          actualType._kind === "map";

        const identifierAttr = (actualType as any).identifierAttribute;

        // Try to find existing node by identifier if the type has one
        if (identifierAttr && item && typeof item === "object") {
          const idValue = (item as any)[identifierAttr];
          if (idValue !== undefined && idValue !== null) {
            for (const existingNode of existingChildNodes) {
              if (
                !keptNodes.has(existingNode) &&
                existingNode.identifierValue === idValue
              ) {
                reusedNode = existingNode;
                break;
              }
            }
          }
        }

        // If no identifier, try to reconcile by index/key (matching type)
        if (!reusedNode && !identifierAttr) {
          const existingNodeAtIndex = this.node.getChild(key);
          if (
            existingNodeAtIndex &&
            !keptNodes.has(existingNodeAtIndex) &&
            existingNodeAtIndex.$type === this.itemType
          ) {
            reusedNode = existingNodeAtIndex;
          }
        }

        if (reusedNode) {
          // Reconcile/apply snapshot to the reused node
          applySnapshotToNode(reusedNode, item);
          
          const instance = isComplex ? reusedNode.getInstance() : reusedNode.getValue();
          newChildren.set(key, reusedNode);
          keptNodes.add(reusedNode);
          
          // Update array with proper instance
          (this as unknown as unknown[])[index] = instance;
          (newArray as any)[index] = instance;
        } else {
          // Try creating an instance - it might be a late/maybe type that creates complex instances
          const instance = this.itemType.create(item);
          if (instance && typeof instance === "object" && $treenode in instance) {
            const childNode = getStateTreeNode(instance);
            newChildren.set(key, childNode);
            keptNodes.add(childNode);
            // Update array with proper instance
            (this as unknown as unknown[])[index] = instance;
            (newArray as any)[index] = instance;
          } else {
            // Primitive types - try to find existing node with same value
            let reusedPrimitiveNode: StateTreeNode | null = null;
            for (const existingNode of existingChildNodes) {
              if (
                !keptNodes.has(existingNode) &&
                existingNode.getValue() === item
              ) {
                reusedPrimitiveNode = existingNode;
                break;
              }
            }

            if (reusedPrimitiveNode) {
              newChildren.set(key, reusedPrimitiveNode);
              keptNodes.add(reusedPrimitiveNode);
              (this as unknown as unknown[])[index] = instance;
              (newArray as any)[index] = instance;
            } else {
              const childNode = new StateTreeNode(
                this.itemType,
                item,
                this.node.$env,
              );
              newChildren.set(key, childNode);
              keptNodes.add(childNode);
              (this as unknown as unknown[])[index] = instance;
              (newArray as any)[index] = instance;
            }
          }
        }
      }
    });

    // Destroy children that are no longer in the array
    for (const existingNode of existingChildNodes) {
      if (!keptNodes.has(existingNode)) {
        existingNode.destroy();
      }
    }

    // Clear and set new children
    this.node.getChildren().clear();
    for (const [key, childNode] of newChildren) {
      this.node.addChild(key, childNode);
    }

    // Determine diff and generate granular patches
    const patches: IJsonPatch[] = [];
    const reversePatches: IReversibleJsonPatch[] = [];

    // Case 1: Simple push (items added at the end)
    if (newArray.length > oldArray.length && oldArray.every((val, idx) => val === newArray[idx])) {
      for (let i = oldArray.length; i < newArray.length; i++) {
        const childNode = this.node.getChild(String(i));
        const valSnap = childNode ? getSnapshotFromNode(childNode) : newArray[i];
        patches.push({
          op: "add",
          path: `${this.node.$path}/${i}`,
          value: valSnap,
        });
        reversePatches.push({
          op: "remove",
          path: `${this.node.$path}/${i}`,
        });
      }
    }
    // Case 2: Simple pop (items removed from the end)
    else if (newArray.length < oldArray.length && newArray.every((val, idx) => val === oldArray[idx])) {
      for (let i = oldArray.length - 1; i >= newArray.length; i--) {
        const oldValSnap = oldSnapshots.get(i);
        patches.push({
          op: "remove",
          path: `${this.node.$path}/${i}`,
        });
        reversePatches.push({
          op: "add",
          path: `${this.node.$path}/${i}`,
          value: oldValSnap,
        });
      }
    }
    // Case 3: Other mutations (fallback to replace array)
    else {
      const oldSnap = oldArray.map((_, idx) => oldSnapshots.get(idx));
      const newSnap = newArray.map((_, idx) => {
        const childNode = this.node.getChild(String(idx));
        return childNode ? getSnapshotFromNode(childNode) : newArray[idx];
      });

      patches.push({
        op: "replace",
        path: this.node.$path,
        value: newSnap,
      });
      reversePatches.push({
        op: "replace",
        path: this.node.$path,
        value: oldSnap,
      });
    }

    // Update the node's value silently
    const store = getGlobalStore();
    store.set(this.node.valueAtom, newArray);
    this.node.notifySnapshotChange();

    // Notify patch listeners
    patches.forEach((patch, idx) => {
      this.node.notifyPatch(patch, reversePatches[idx]);
    });

    // Notify snapshot changes
    this.node.notifyVolatileChange();
  }
}

// ============================================================================
// Array Type Implementation
// ============================================================================

class ArrayType<T extends IAnyType> implements IArrayType<T> {
  readonly _kind = "array" as const;
  readonly _subType: T;
  readonly name: string;

  readonly _C!: Array<T extends IType<infer C, unknown, unknown> ? C : never>;
  readonly _S!: Array<T extends IType<unknown, infer S, unknown> ? S : never>;
  readonly _T!: IMSTArray<
    T extends IType<unknown, unknown, infer I> ? I : never,
    T extends IType<infer C, unknown, unknown> ? C : never
  >;

  constructor(itemType: T) {
    this._subType = itemType;
    this.name = `array<${itemType.name}>`;
  }

  create(
    snapshot?: Array<T extends IType<infer C, unknown, unknown> ? C : never>,
    env?: unknown,
  ): IMSTArray<
    T extends IType<unknown, unknown, infer I> ? I : never,
    T extends IType<infer C, unknown, unknown> ? C : never
  > {
    const items = snapshot ?? [];

    // Create tree node
    const node = new StateTreeNode(this, items, env);

    // Create instances for each item
    const instances = items.map((item, index) => {
      const instance = this._subType.create(item, env);

      // Check if the instance has a tree node (complex type, including via late/maybe wrappers)
      if (instance && typeof instance === "object" && $treenode in instance) {
        const childNode = getStateTreeNode(instance);
        node.addChild(String(index), childNode);
      } else {
        // Primitive - create a child node for it
        const childNode = new StateTreeNode(
          this._subType,
          instance,
          env,
          node,
          String(index),
        );
        node.addChild(String(index), childNode);
      }

      return instance;
    });

    // Create the MST array
    const mstArray = new MSTArray(node, this._subType, instances) as IMSTArray<
      T extends IType<unknown, unknown, infer I> ? I : never,
      T extends IType<infer C, unknown, unknown> ? C : never
    >;

    // Add tree node reference
    Object.defineProperty(mstArray, $treenode, {
      value: node,
      writable: false,
      enumerable: false,
    });

    const proxy = new Proxy(mstArray, {
      get(target, prop, receiver) {
        if (prop === $treenode) {
          return node;
        }
        if (!node.$isAlive) {
          if (prop === "then" || prop === "toJSON" || typeof prop === "symbol") {
            return undefined;
          }
          throw new Error("[jotai-state-tree] Cannot access array - the node is dead.");
        }
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value) {
        const propStr = String(prop);
        const isIndex = /^\d+$/.test(propStr);
        if (isIndex || propStr === "length") {
          if (!node.$isAlive) {
            throw new Error("[jotai-state-tree] Cannot modify array - the node is dead.");
          }
          if (!canWrite(node)) {
            throw new Error(
              `Cannot modify the array - the parent object is protected and can only be modified inside an action.`
            );
          }
          (target as any)[prop] = value;
          if (!(target as any)._isMutating) {
            (target as any).syncToNode();
          }
          return true;
        }
        (target as any)[prop] = value;
        return true;
      },
    }) as any;

    node.setInstance(proxy);
    node.setValue(instances);

    return proxy;
  }

  is(
    value: unknown,
  ): value is IMSTArray<
    T extends IType<unknown, unknown, infer I> ? I : never,
    T extends IType<infer C, unknown, unknown> ? C : never
  > {
    if (!Array.isArray(value)) return false;
    // Check if it has our tree node
    return $treenode in value;
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    const errors: IValidationResult["errors"] = [];

    if (!Array.isArray(value)) {
      return {
        valid: false,
        errors: [
          {
            context,
            value,
            message: "Value is not an array",
          },
        ],
      };
    }

    // Validate each item
    value.forEach((item, index) => {
      const itemContext: IValidationContext = {
        path: context.length > 0 ? `${context[0].path}/${index}` : `/${index}`,
        type: this._subType,
        parent: value,
      };

      const result = this._subType.validate(item, [...context, itemContext]);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function array<T extends IAnyType>(itemType: T): IArrayType<T> {
  return new ArrayType(itemType);
}
