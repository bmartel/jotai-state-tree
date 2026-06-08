import { describe, it, expect } from 'vitest';
import { types, unprotect } from '../index';
import { createUndoManager, createTimeTravelManager, createActionRecorder } from '../undo';

describe('UndoManager & TimeTravel Extra', () => {
  const User = types.model('User', {
    name: types.string,
  })
  .actions((self) => ({
    setName(name: string) {
      self.name = name;
    },
  }));

  it('undo grouping', () => {
    const user = User.create({ name: 'Alice' });
    const undoManager = createUndoManager(user);

    undoManager.startGroup();
    user.setName('Bob');
    user.setName('Charlie');
    undoManager.endGroup();

    expect(user.name).toBe('Charlie');
    expect(undoManager.undoLevels).toBe(1); // Charlie and Bob should be in one undo entry

    undoManager.undo();
    expect(user.name).toBe('Alice'); // Should revert both Charlie and Bob edits in one go
  });

  it('max history length eviction', () => {
    const user = User.create({ name: 'Alice' });
    const undoManager = createUndoManager(user, { maxHistoryLength: 2 });

    user.setName('Bob');
    user.setName('Charlie');
    user.setName('David');

    expect(undoManager.undoLevels).toBe(2); // David and Charlie entries kept, Bob entry evicted

    undoManager.undo();
    expect(user.name).toBe('Charlie');

    undoManager.undo();
    expect(user.name).toBe('Bob');

    expect(undoManager.canUndo).toBe(false); // cannot undo further because Bob is the oldest remaining entry
  });

  it('withoutUndo execution', () => {
    const user = User.create({ name: 'Alice' });
    const undoManager = createUndoManager(user);

    undoManager.withoutUndo(() => {
      user.setName('Bob');
    });

    expect(user.name).toBe('Bob');
    expect(undoManager.canUndo).toBe(false); // no history entry was recorded for Bob
  });

  it('TimeTravelManager boundaries', () => {
    const user = User.create({ name: 'Alice' });
    const timeTravel = createTimeTravelManager(user, { maxSnapshots: 3, autoRecord: true });

    user.setName('Bob');
    user.setName('Charlie');

    expect(timeTravel.snapshotCount).toBe(3); // Alice, Bob, Charlie
    expect(timeTravel.currentIndex).toBe(2); // Charlie

    timeTravel.goBack();
    expect(user.name).toBe('Bob');

    timeTravel.goBack();
    expect(user.name).toBe('Alice');

    expect(timeTravel.canGoBack).toBe(false);

    timeTravel.goForward();
    expect(user.name).toBe('Bob');

    timeTravel.goTo(2);
    expect(user.name).toBe('Charlie');

    timeTravel.clear();
    expect(timeTravel.snapshotCount).toBe(1); // only current Charlie remains
    expect(timeTravel.currentIndex).toBe(0);

    timeTravel.dispose(); // should clean up cleanly
  });

  it('ActionRecorder extra functionality', () => {
    const Model = types.model({
      value: types.string,
    }).actions((self) => ({
      setValue(val: string) {
        self.value = val;
      },
    }));

    const target1 = Model.create({ value: 'a' });
    const target2 = Model.create({ value: 'a' });

    const recorder = createActionRecorder(target1);
    expect(recorder.isRecording).toBe(false);

    recorder.start();
    expect(recorder.isRecording).toBe(true);

    target1.setValue('b');
    target1.setValue('c');

    recorder.stop();
    expect(recorder.isRecording).toBe(false);

    expect(recorder.actions.length).toBe(2);
    expect(recorder.actions[0].name).toBe('setValue');
    expect(recorder.actions[0].args).toEqual(['b']);

    // Replay on target2
    recorder.replay(target2);
    expect(target2.value).toBe('c');

    // Export/import
    const json = recorder.export();
    const anotherRecorder = createActionRecorder(target1);
    anotherRecorder.import(json);
    expect(anotherRecorder.actions.length).toBe(2);

    expect(() => anotherRecorder.import('invalid-json')).toThrow('Failed to import actions');

    anotherRecorder.clear();
    expect(anotherRecorder.actions.length).toBe(0);

    anotherRecorder.dispose();
    recorder.dispose();
  });

  it('history truncation on new change after undo', () => {
    const user = User.create({ name: 'Alice' });
    const undoManager = createUndoManager(user);

    user.setName('Bob');
    user.setName('Charlie');

    undoManager.undo();
    expect(user.name).toBe('Bob');

    // Make new change, should truncate redo history
    user.setName('David');
    expect(undoManager.canRedo).toBe(false);
    expect(undoManager.undoLevels).toBe(2); // Alice -> Bob -> David
  });

  it('groupByTime window grouping', async () => {
    const user = User.create({ name: 'Alice' });
    unprotect(user);
    const undoManager = createUndoManager(user, {
      groupByTime: true,
      groupingWindow: 200, // 200ms
    });

    user.name = 'Bob';
    // Change name again immediately
    user.name = 'Charlie';

    expect(undoManager.undoLevels).toBe(1); // Grouped together!
    
    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 300));
    user.name = 'David';
    expect(undoManager.undoLevels).toBe(2); // New group
  });


  it('noop undo/redo, and action grouping microtask endGroup', async () => {
    const user = User.create({ name: 'Alice' });
    const undoManager = createUndoManager(user);

    // Call undo when index is -1
    expect(undoManager.canUndo).toBe(false);
    undoManager.undo(); // noop
    expect(user.name).toBe('Alice');

    // Trigger action grouping microtask (which schedules endGroup in a microtask)
    user.setName('Bob');
    // Wait for microtask to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(undoManager.undoLevels).toBe(1);
  });
});

