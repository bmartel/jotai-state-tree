import { describe, it, expect, vi } from 'vitest';
import { types, unprotect, destroy } from '../index';
import { createUndoManager, createTimeTravelManager, createActionRecorder, historyTrackersRegistry } from '../undo';
import * as treeModule from '../tree';

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
    // Modify User model definition to add a nested action
    const UserNested = types.model('UserNested', {
      name: types.string,
    })
    .actions((self) => ({
      setName(name: string) {
        self.name = name;
      },
      setNameNested(name: string) {
        (self as any).setName(name);
      },
    }));

    const user = UserNested.create({ name: 'Alice' });
    const undoManager = createUndoManager(user);

    // Call undo when index is -1
    expect(undoManager.canUndo).toBe(false);
    undoManager.undo(); // noop
    expect(user.name).toBe('Alice');

    // Trigger action grouping microtask (which schedules endGroup in a microtask)
    user.setNameNested('Bob');
    // Wait for microtask to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(undoManager.undoLevels).toBe(1);
  });

  it('undo and time travel extra edge cases and branch coverage', async () => {
    const user = User.create({ name: 'Alice' });
    unprotect(user);
    const undoManager = createUndoManager(user, { maxHistoryLength: 2 });

    // 1. redo noop when nothing to redo
    expect(undoManager.canRedo).toBe(false);
    undoManager.redo(); // noop
    expect(user.name).toBe('Alice');

    // 2. recordPatch trim history (unprotected mutations)
    user.name = 'Bob';
    user.name = 'Charlie';
    user.name = 'David';
    expect(undoManager.undoLevels).toBe(2); // David and Charlie entries kept, Bob evicted

    // 3. double endGroup noop
    undoManager.endGroup(); // noop

    // 4. UndoManager getters (redoLevels, history, historyIndex)
    expect(undoManager.redoLevels).toBe(0);
    expect(undoManager.history.length).toBe(2);
    expect(undoManager.historyIndex).toBe(1);

    // 5. TimeTravelManager record trim history and invalid snapshot index throws
    const timeTravel = createTimeTravelManager(user, { maxSnapshots: 2 });
    timeTravel.record();
    timeTravel.record();
    timeTravel.record();
    expect(timeTravel.snapshotCount).toBe(3);
    expect(timeTravel.canGoForward).toBe(false);

    expect(() => timeTravel.getSnapshot(-1)).toThrow('[jotai-state-tree] Invalid snapshot index: -1');
    expect(() => timeTravel.getSnapshot(100)).toThrow('[jotai-state-tree] Invalid snapshot index: 100');

    // 6. goTo out of bounds noop
    timeTravel.goTo(-5);
    timeTravel.goTo(100);

    // 7. ActionRecorder double start and nested path replay / warning
    const ChildModel = types.model('ChildModel', {
      value: types.string,
    }).actions(self => ({
      setValue(v: string) {
        self.value = v;
      }
    }));
    const ParentModel = types.model('ParentModel', {
      child: ChildModel,
    });

    const parent1 = ParentModel.create({ child: { value: 'a' } });
    const parent2 = ParentModel.create({ child: { value: 'a' } });

    const recorder = createActionRecorder(parent1);
    recorder.start();
    recorder.start(); // double start noop
    expect(recorder.isRecording).toBe(true);

    parent1.child.setValue('b');
    recorder.stop();

    // Replay on parent2 (nested path)
    recorder.replay(parent2);
    expect(parent2.child.value).toBe('b');

    // Replay on target without path (should warn)
    const spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const targetNoChild = ChildModel.create({ value: 'a' });
    recorder.replay(targetNoChild);
    expect(spyWarn).toHaveBeenCalledWith(expect.stringContaining('[jotai-state-tree] Could not find path:'));
    spyWarn.mockRestore();

    recorder.dispose();

    // 8. Multiple trackers on same tree (child tracker hits root.$isApplyingHistory)
    const Child = types.model('Child', { val: types.string }).actions(self => ({
      setVal(v: string) { self.val = v; }
    }));
    const Parent = types.model('Parent', { child: Child });
    const pInst = Parent.create({ child: { val: 'a' } });
    unprotect(pInst);

    const parentUndo = createUndoManager(pInst);
    const childUndo = createUndoManager(pInst.child);

    pInst.child.setVal('b');
    expect(parentUndo.undoLevels).toBe(1);
    expect(childUndo.undoLevels).toBe(1);

    parentUndo.undo();
    expect(pInst.child.val).toBe('a');
    expect(childUndo.undoLevels).toBe(1); // child tracker did not record the undo patch
  });

  it('undo additional coverage edge cases', async () => {
    const user = User.create({ name: 'Alice' });
    unprotect(user);
    const undoManager = createUndoManager(user);

    // 1. endGroup triggered via scheduled microtask by mocking isActionRunning to return true inside a mutation outside a real action
    const spy = vi.spyOn(treeModule, 'isActionRunning').mockReturnValue(true);
    user.name = 'Bob'; // triggers recordPatch, starts action grouping, schedules microtask
    spy.mockRestore();
    expect(undoManager.undoLevels).toBe(0); // still grouping
    // Wait for microtask to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(undoManager.undoLevels).toBe(1); // ended group and committed!

    // 2. TimeTravelManager goBack / goForward boundaries
    const user2 = User.create({ name: 'Alice' });
    unprotect(user2);
    const timeTravel = createTimeTravelManager(user2, { maxSnapshots: 5 });
    // goBack when currentIndex <= 0 (noop)
    expect(timeTravel.canGoBack).toBe(false);
    timeTravel.goBack();

    user2.name = 'Bob';
    timeTravel.record(); // snapshot 1 (Bob)
    expect(timeTravel.canGoForward).toBe(false);
    timeTravel.goForward(); // goForward when currentIndex is at end (noop)

    // 3. TimeTravelManager record after goBack (truncating redo history)
    timeTravel.goBack(); // go back to Alice
    expect(user2.name).toBe('Alice');
    timeTravel.record(); // record new change, should truncate Bob entry
    expect(timeTravel.snapshotCount).toBe(2);

    // 4. TimeTravelManager getSnapshot(1) (false path of ternary)
    expect(timeTravel.getSnapshot(1)).toBeDefined();

    // 5. startGroup then immediately endGroup without changes (currentGroup.length === 0 path)
    undoManager.startGroup();
    undoManager.endGroup();

    // 6. ActionRecorder replay action that is not a function on the target
    const recorder = createActionRecorder(user);
    recorder.start();
    user.setName('Dave');
    recorder.stop();
    // Manually import action containing non-function name to test the branch
    recorder.import(JSON.stringify([
      { name: 'nonExistentAction', args: [], path: '', timestamp: Date.now() }
    ]));
    expect(() => recorder.replay(user)).not.toThrow();

    // 7. Direct mutation outside action to cover recordPatch truncation (line 200 of undo.ts)
    const userMut = User.create({ name: 'Alice' });
    unprotect(userMut);
    const um = createUndoManager(userMut);
    userMut.name = 'Bob';
    userMut.name = 'Charlie';
    um.undo();
    userMut.name = 'David'; // direct mutation outside action!
    expect(um.canRedo).toBe(false);
    expect(um.undoLevels).toBe(2);

    // 8. history tracker auto-disposal when the target node is destroyed (line 169 of undo.ts)
    const userDispose = User.create({ name: 'Alice' });
    createUndoManager(userDispose);
    expect(historyTrackersRegistry.has(userDispose)).toBe(true);
    destroy(userDispose);
    expect(historyTrackersRegistry.has(userDispose)).toBe(false);
  });
});

