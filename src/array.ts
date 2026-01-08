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
} from "./types";
import {
  StateTreeNode,
  $treenode,
  getStateTreeNode,
  getGlobalStore,
} from "./tree";

// ============================================================================
// MST Array Implementation
// ============================================================================

class MSTArray<T> extends Array<T> implements IMSTArray<T> {
  private node: StateTreeNode;
  private itemType: IAnyType;

  constructor(node: StateTreeNode, itemType: IAnyType, items: T[] = []) {
    super(...items);
    this.node = node;
    this.itemType = itemType;

    // Set prototype correctly for extending Array
    Object.setPrototypeOf(this, MSTArray.prototype);
  }

  replace(items: T[]): void {
    this.length = 0;
    this.push(...items);
    this.syncToNode();
  }

  clear(): void {
    this.length = 0;
    this.syncToNode();
  }

  remove(item: T): boolean {
    const index = this.indexOf(item);
    if (index >= 0) {
      this.splice(index, 1);
      this.syncToNode();
      return true;
    }
    return false;
  }

  spliceWithArray(index: number, deleteCount?: number, newItems?: T[]): T[] {
    const result =
      deleteCount !== undefined
        ? newItems
          ? this.splice(index, deleteCount, ...newItems)
          : this.splice(index, deleteCount)
        : this.splice(index);
    this.syncToNode();
    return result;
  }

  // Override mutating methods to sync
  push(...items: T[]): number {
    const result = super.push(...items);
    this.syncToNode();
    return result;
  }

  pop(): T | undefined {
    const result = super.pop();
    this.syncToNode();
    return result;
  }

  shift(): T | undefined {
    const result = super.shift();
    this.syncToNode();
    return result;
  }

  unshift(...items: T[]): number {
    const result = super.unshift(...items);
    this.syncToNode();
    return result;
  }

  splice(start: number, deleteCount?: number, ...items: T[]): T[] {
    const result =
      deleteCount !== undefined
        ? super.splice(start, deleteCount, ...items)
        : super.splice(start);
    this.syncToNode();
    return result;
  }

  sort(compareFn?: (a: T, b: T) => number): this {
    super.sort(compareFn);
    this.syncToNode();
    return this;
  }

  reverse(): T[] {
    super.reverse();
    this.syncToNode();
    return this;
  }

  fill(value: T, start?: number, end?: number): this {
    super.fill(value, start, end);
    this.syncToNode();
    return this;
  }

  copyWithin(target: number, start: number, end?: number): this {
    super.copyWithin(target, start, end);
    this.syncToNode();
    return this;
  }

  toJSON(): T[] {
    return [...this];
  }

  private syncToNode(): void {
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
        // Try creating an instance - it might be a late/maybe type that creates complex instances
        const instance = this.itemType.create(item);
        if (instance && typeof instance === "object" && $treenode in instance) {
          const childNode = getStateTreeNode(instance);
          newChildren.set(key, childNode);
          keptNodes.add(childNode);
          // Update array with proper instance
          (this as unknown as unknown[])[index] = instance;
        } else {
          // Primitive types - try to find existing node with same value
          let reusedNode: StateTreeNode | null = null;
          for (const existingNode of existingChildNodes) {
            if (
              !keptNodes.has(existingNode) &&
              existingNode.getValue() === item
            ) {
              reusedNode = existingNode;
              break;
            }
          }

          if (reusedNode) {
            newChildren.set(key, reusedNode);
            keptNodes.add(reusedNode);
          } else {
            const childNode = new StateTreeNode(
              this.itemType,
              item,
              this.node.$env,
            );
            newChildren.set(key, childNode);
            keptNodes.add(childNode);
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

    // Update the node's value
    this.node.setValue([...this]);
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
    T extends IType<unknown, unknown, infer I> ? I : never
  >;

  constructor(itemType: T) {
    this._subType = itemType;
    this.name = `array<${itemType.name}>`;
  }

  create(
    snapshot?: Array<T extends IType<infer C, unknown, unknown> ? C : never>,
    env?: unknown,
  ): IMSTArray<T extends IType<unknown, unknown, infer I> ? I : never> {
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
      T extends IType<unknown, unknown, infer I> ? I : never
    >;

    // Add tree node reference
    Object.defineProperty(mstArray, $treenode, {
      value: node,
      writable: false,
      enumerable: false,
    });

    node.setInstance(mstArray);
    node.setValue(instances);

    return mstArray;
  }

  is(
    value: unknown,
  ): value is IMSTArray<
    T extends IType<unknown, unknown, infer I> ? I : never
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
