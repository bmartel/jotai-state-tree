/**
 * Map type implementation
 */

import type {
  IMapType,
  IMSTMap,
  IType,
  IValidationContext,
  IValidationResult,
  IAnyType,
} from './types';
import {
  StateTreeNode,
  $treenode,
  getStateTreeNode,
} from './tree';

// ============================================================================
// MST Map Implementation
// ============================================================================

class MSTMap<V> extends Map<string, V> implements IMSTMap<V> {
  private node!: StateTreeNode;
  private valueType!: IAnyType;
  private initialized = false;

  constructor(node: StateTreeNode, valueType: IAnyType, entries?: [string, V][]) {
    super();
    this.node = node;
    this.valueType = valueType;
    this.initialized = true;
    
    // Add entries after initialization
    if (entries) {
      for (const [key, value] of entries) {
        super.set(key, value);
      }
      this.syncToNode();
    }
  }

  put(value: V): V {
    // Get the identifier from the value if it's a model with identifier
    let key: string;
    if (value && typeof value === 'object' && $treenode in value) {
      const valueNode = getStateTreeNode(value);
      if (valueNode.identifierValue !== undefined) {
        key = String(valueNode.identifierValue);
      } else {
        throw new Error('[jotai-state-tree] Cannot put a value without an identifier into a map');
      }
    } else {
      throw new Error('[jotai-state-tree] Cannot put a non-model value using put()');
    }

    this.set(key, value);
    return value;
  }

  merge(values: Record<string, V> | Map<string, V>): this {
    const entries = values instanceof Map ? values.entries() : Object.entries(values);
    for (const [key, value] of entries) {
      this.set(key, value);
    }
    return this;
  }

  replace(values: Record<string, V> | Map<string, V>): this {
    this.clear();
    return this.merge(values);
  }

  // Override mutating methods to sync
  set(key: string, value: V): this {
    super.set(key, value);
    if (this.initialized) {
      this.syncToNode();
    }
    return this;
  }

  // Override get to return the instance from child node for complex types
  get(key: string): V | undefined {
    if (this.valueType._kind === 'model' || this.valueType._kind === 'array' || this.valueType._kind === 'map') {
      const childNode = this.node.getChild(key);
      if (childNode) {
        return childNode.getInstance() as V;
      }
      return undefined;
    }
    return super.get(key);
  }

  delete(key: string): boolean {
    const result = super.delete(key);
    if (result && this.initialized) {
      this.syncToNode();
    }
    return result;
  }

  clear(): void {
    super.clear();
    if (this.initialized) {
      this.syncToNode();
    }
  }

  toJSON(): Record<string, V> {
    const result: Record<string, V> = {};
    this.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  private syncToNode(): void {
    // Get current children
    const existingChildren = new Map(this.node.getChildren());
    const newChildren = new Map<string, StateTreeNode>();

    // Create new children for each entry
    this.forEach((value, key) => {
      if (this.valueType._kind === 'model' || this.valueType._kind === 'array' || this.valueType._kind === 'map') {
        if (value && typeof value === 'object' && $treenode in value) {
          const childNode = getStateTreeNode(value);
          newChildren.set(key, childNode);
        } else {
          const childInstance = this.valueType.create(value);
          const childNode = getStateTreeNode(childInstance);
          newChildren.set(key, childNode);
          super.set(key, childInstance as V);
        }
      } else {
        const existingChild = existingChildren.get(key);
        if (existingChild && existingChild.getValue() === value) {
          newChildren.set(key, existingChild);
        } else {
          const childNode = new StateTreeNode(this.valueType, value, this.node.$env);
          newChildren.set(key, childNode);
        }
      }
    });

    // Destroy children that are no longer in the map
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

    // Update node value
    this.node.setValue(this.toJSON());
  }
}

// ============================================================================
// Map Type Implementation
// ============================================================================

class MapType<T extends IAnyType> implements IMapType<T> {
  readonly _kind = 'map' as const;
  readonly _subType: T;
  readonly name: string;

  readonly _C!: Record<string, T extends IType<infer C, unknown, unknown> ? C : never>;
  readonly _S!: Record<string, T extends IType<unknown, infer S, unknown> ? S : never>;
  readonly _T!: IMSTMap<T extends IType<unknown, unknown, infer I> ? I : never>;

  constructor(valueType: T) {
    this._subType = valueType;
    this.name = `map<${valueType.name}>`;
  }

  create(
    snapshot?: Record<string, T extends IType<infer C, unknown, unknown> ? C : never>,
    env?: unknown
  ): IMSTMap<T extends IType<unknown, unknown, infer I> ? I : never> {
    const entries = snapshot ?? {};

    // Create tree node
    const node = new StateTreeNode(this, entries, env);

    // Create instances for each entry
    const instanceEntries: [string, unknown][] = Object.entries(entries).map(([key, value]) => {
      const instance = this._subType.create(value, env);

      // Add as child node
      if (this._subType._kind === 'model' || this._subType._kind === 'array' || this._subType._kind === 'map') {
        const childNode = getStateTreeNode(instance);
        node.addChild(key, childNode);
      } else {
        const childNode = new StateTreeNode(this._subType, instance, env, node, key);
        node.addChild(key, childNode);
      }

      return [key, instance];
    });

    // Create the MST map
    const mstMap = new MSTMap(
      node,
      this._subType,
      instanceEntries as [string, T extends IType<unknown, unknown, infer I> ? I : never][]
    ) as IMSTMap<T extends IType<unknown, unknown, infer I> ? I : never>;

    // Add tree node reference
    Object.defineProperty(mstMap, $treenode, {
      value: node,
      writable: false,
      enumerable: false,
    });

    node.setInstance(mstMap);

    return mstMap;
  }

  is(value: unknown): value is IMSTMap<T extends IType<unknown, unknown, infer I> ? I : never> {
    if (!(value instanceof Map)) return false;
    return $treenode in value;
  }

  validate(value: unknown, context: IValidationContext[]): IValidationResult {
    const errors: IValidationResult['errors'] = [];

    if (typeof value !== 'object' || value === null) {
      return {
        valid: false,
        errors: [
          {
            context,
            value,
            message: 'Value is not an object or Map',
          },
        ],
      };
    }

    // Handle both plain objects and Maps
    const entries = value instanceof Map ? Array.from(value.entries()) : Object.entries(value);

    for (const [key, itemValue] of entries) {
      const itemContext: IValidationContext = {
        path: context.length > 0 ? `${context[0].path}/${key}` : `/${key}`,
        type: this._subType,
        parent: value,
      };

      const result = this._subType.validate(itemValue, [...context, itemContext]);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function map<T extends IAnyType>(valueType: T): IMapType<T> {
  return new MapType(valueType);
}
