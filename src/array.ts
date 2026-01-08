/**
 * Array type implementation
 */

import { atom } from 'jotai';
import type {
  IArrayType,
  IMSTArray,
  IType,
  IValidationContext,
  IValidationResult,
  IAnyType,
} from './types';
import {
  StateTreeNode,
  $treenode,
  getStateTreeNode,
  getGlobalStore,
} from './tree';

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
    const result = deleteCount !== undefined
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
    const result = deleteCount !== undefined
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
    // Get current children
    const existingChildren = new Map(this.node.getChildren());
    const newChildren = new Map<string, StateTreeNode>();

    // Create new children for each item
    this.forEach((item, index) => {
      const key = String(index);
      if (this.itemType._kind === 'model' || this.itemType._kind === 'array' || this.itemType._kind === 'map') {
        // Complex types should already have tree nodes
        if (item && typeof item === 'object' && $treenode in item) {
          const childNode = getStateTreeNode(item);
          newChildren.set(key, childNode);
        } else {
          // Create new instance
          const childInstance = this.itemType.create(item);
          const childNode = getStateTreeNode(childInstance);
          newChildren.set(key, childNode);
          // Update array with proper instance
          (this as unknown as unknown[])[index] = childInstance;
        }
      } else {
        // Primitive types
        const existingChild = existingChildren.get(key);
        if (existingChild && existingChild.getValue() === item) {
          // Reuse existing node
          newChildren.set(key, existingChild);
        } else {
          const childNode = new StateTreeNode(this.itemType, item, this.node.$env);
          newChildren.set(key, childNode);
        }
      }
    });

    // Remove children that are no longer needed
    for (const [key, child] of existingChildren) {
      if (!newChildren.has(key)) {
        child.destroy();
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
  readonly _kind = 'array' as const;
  readonly _subType: T;
  readonly name: string;

  readonly _C!: Array<T extends IType<infer C, unknown, unknown> ? C : never>;
  readonly _S!: Array<T extends IType<unknown, infer S, unknown> ? S : never>;
  readonly _T!: IMSTArray<T extends IType<unknown, unknown, infer I> ? I : never>;

  constructor(itemType: T) {
    this._subType = itemType;
    this.name = `array<${itemType.name}>`;
  }

  create(
    snapshot?: Array<T extends IType<infer C, unknown, unknown> ? C : never>,
    env?: unknown
  ): IMSTArray<T extends IType<unknown, unknown, infer I> ? I : never> {
    const items = snapshot ?? [];
    
    // Create tree node
    const node = new StateTreeNode(this, items, env);

    // Create instances for each item
    const instances = items.map((item, index) => {
      const instance = this._subType.create(item, env);
      
      // If complex type, add as child node
      if (this._subType._kind === 'model' || this._subType._kind === 'array' || this._subType._kind === 'map') {
        const childNode = getStateTreeNode(instance);
        node.addChild(String(index), childNode);
      } else {
        // Primitive - create a child node for it
        const childNode = new StateTreeNode(this._subType, instance, env, node, String(index));
        node.addChild(String(index), childNode);
      }

      return instance;
    });

    // Create the MST array
    const mstArray = new MSTArray(
      node,
      this._subType,
      instances
    ) as IMSTArray<T extends IType<unknown, unknown, infer I> ? I : never>;

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

  is(value: unknown): value is IMSTArray<T extends IType<unknown, unknown, infer I> ? I : never> {
    if (!Array.isArray(value)) return false;
    // Check if it has our tree node
    return $treenode in value;
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    const errors: IValidationResult['errors'] = [];

    if (!Array.isArray(value)) {
      return {
        valid: false,
        errors: [
          {
            context,
            value,
            message: 'Value is not an array',
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
