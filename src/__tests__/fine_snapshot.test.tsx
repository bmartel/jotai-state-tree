/**
 * @vitest-environment jsdom
 */
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { types } from '../index';
import { useFineSnapshot } from '../react';

describe('useFineSnapshot React integration', () => {
  const Profile = types.model('Profile', {
    city: types.string,
    zip: types.optional(types.string, '12345'),
  }).actions((self) => ({
    setCity(city: string) {
      self.city = city;
    },
    setZip(zip: string) {
      self.zip = zip;
    },
  }));

  const User = types.model('User', {
    id: types.identifier,
    name: types.string,
    age: types.number,
    profile: Profile,
    tags: types.array(types.string),
  }).actions((self) => ({
    setName(name: string) {
      self.name = name;
    },
    setAge(age: number) {
      self.age = age;
    },
    addTag(tag: string) {
      self.tags.push(tag);
    },
    setTag(index: number, val: string) {
      self.tags[index] = val;
    },
  }));

  it('only re-renders when accessed properties are mutated', () => {
    const user = User.create({
      id: '1',
      name: 'Alice',
      age: 30,
      profile: { city: 'New York' },
      tags: ['react', 'jotai'],
    });

    let renderCount = 0;
    const TestComponent = () => {
      const snap = useFineSnapshot(user);
      renderCount++;
      return (
        <div>
          <span data-testid="name">{snap.name}</span>
        </div>
      );
    };

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('name').textContent).toBe('Alice');
    expect(renderCount).toBe(1);

    // Mutate unrelated property: age
    act(() => {
      user.setAge(31);
    });
    expect(renderCount).toBe(1); // Should NOT re-render

    // Mutate accessed property: name
    act(() => {
      user.setName('Bob');
    });
    expect(getByTestId('name').textContent).toBe('Bob');
    expect(renderCount).toBe(2); // Should re-render
  });

  it('handles nested model properties correctly', () => {
    const user = User.create({
      id: '2',
      name: 'Charlie',
      age: 25,
      profile: { city: 'Boston' },
      tags: [],
    });

    let renderCount = 0;
    const TestComponent = () => {
      const snap = useFineSnapshot(user);
      renderCount++;
      return (
        <div>
          <span data-testid="city">{snap.profile.city}</span>
        </div>
      );
    };

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('city').textContent).toBe('Boston');
    expect(renderCount).toBe(1);

    // Mutate unrelated nested property: zip
    act(() => {
      user.profile.setZip('02108');
    });
    expect(renderCount).toBe(1); // Should NOT re-render

    // Mutate accessed nested property: city
    act(() => {
      user.profile.setCity('Cambridge');
    });
    expect(getByTestId('city').textContent).toBe('Cambridge');
    expect(renderCount).toBe(2); // Should re-render
  });

  it('handles array access and updates correctly', () => {
    const user = User.create({
      id: '3',
      name: 'Dave',
      age: 40,
      profile: { city: 'Austin' },
      tags: ['a', 'b'],
    });

    let renderCount = 0;
    const TestComponent = () => {
      const snap = useFineSnapshot(user);
      renderCount++;
      return (
        <div>
          <span data-testid="tag-0">{snap.tags[0]}</span>
        </div>
      );
    };

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('tag-0').textContent).toBe('a');
    expect(renderCount).toBe(1);

    // Mutate tags[1] (unrelated element)
    act(() => {
      user.setTag(1, 'c');
    });
    expect(renderCount).toBe(1); // Should NOT re-render because we only accessed index 0

    // Mutate tags[0] (accessed element)
    act(() => {
      user.setTag(0, 'd');
    });
    expect(getByTestId('tag-0').textContent).toBe('d');
    expect(renderCount).toBe(2); // Should re-render
  });

  it('handles map access and updates correctly', () => {
    const MapModel = types.model('MapModel', {
      items: types.map(types.string),
    }).actions((self) => ({
      set(key: string, value: string) {
        self.items.set(key, value);
      },
    }));

    const model = MapModel.create({
      items: { key1: 'value1', key2: 'value2' },
    });

    let renderCount = 0;
    const TestComponent = () => {
      const snap = useFineSnapshot(model);
      renderCount++;
      return (
        <div>
          <span data-testid="item-1">{snap.items.get('key1')}</span>
        </div>
      );
    };

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('item-1').textContent).toBe('value1');
    expect(renderCount).toBe(1);

    // Mutate unrelated key: key2
    act(() => {
      model.set('key2', 'value2-changed');
    });
    expect(renderCount).toBe(1); // Should NOT re-render

    // Mutate accessed key: key1
    act(() => {
      model.set('key1', 'value1-changed');
    });
    expect(getByTestId('item-1').textContent).toBe('value1-changed');
    expect(renderCount).toBe(2); // Should re-render
  });
});
