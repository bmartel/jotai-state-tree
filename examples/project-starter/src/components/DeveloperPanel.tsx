import React, { useState } from 'react';
import { observer, useRouter } from 'jotai-state-tree/react';
import { getSnapshot, applySnapshot } from 'jotai-state-tree';
import { useAppStore } from '../App';
import { useToast } from './Toast';

interface DeveloperPanelProps {
  undoManager: {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  };
}

export const DeveloperPanel = observer(function DeveloperPanel({
  undoManager,
}: DeveloperPanelProps) {
  const store = useAppStore();
  const router = useRouter();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'state' | 'patches' | 'router'>('state');

  // Trigger state modification to show live JSON Patches in action
  const handleCorruptState = () => {
    store.tasks.addTask(
      `Simulated Chaos Task ${Math.floor(Math.random() * 100)}`,
      'DevOps'
    );
    showToast('Simulated State Patch fired!', 'info');
  };

  const handleApplyInvalidState = () => {
    try {
      // Intentionally applying invalid state structure to verify runtime error checking
      applySnapshot(store, {
        ...(getSnapshot(store) as any),
        tasks: {
          items: [
            // missing 'text' property (which is required by the Task schema)
            { id: 'corrupt-1', completed: false } as any,
          ],
        },
      });
    } catch (err: any) {
      console.warn(err);
      showToast(`State Tree Validation Blocked Invalid Input!`, 'error');
    }
  };

  return (
    <aside className="w-80 border-l border-slate-200/60 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-950 flex flex-col h-screen select-none overflow-hidden">
      {/* DevPanel Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-zinc-900 bg-white dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          <span className="font-display font-bold text-slate-800 dark:text-zinc-100 text-sm">
            State Tree DevTools
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 text-xs font-medium">
        {(['state', 'patches', 'router'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-center capitalize border-b-2 transition-all ${
              activeTab === tab
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'state' && (
          <div className="space-y-4 h-full flex flex-col">
            {/* Undo Manager Controls */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-100 dark:border-zinc-800/80 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                Undo Stack
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    undoManager.undo();
                    showToast('Undone last action');
                  }}
                  disabled={!undoManager.canUndo}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:pointer-events-none dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  &larr; Undo
                </button>
                <button
                  onClick={() => {
                    undoManager.redo();
                    showToast('Redone action');
                  }}
                  disabled={!undoManager.canRedo}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:pointer-events-none dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Redo &rarr;
                </button>
              </div>
            </div>

            {/* Quick Simulation Buttons */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-100 dark:border-zinc-800/80 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                Simulations
              </h4>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleCorruptState}
                  className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100/80 text-indigo-600 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 dark:text-indigo-400 transition-colors"
                >
                  ⚡ Fire Random Patch Action
                </button>
                <button
                  onClick={handleApplyInvalidState}
                  className="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100/80 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 transition-colors"
                >
                  ⚠️ Test Schema Validation Error
                </button>
              </div>
            </div>

            {/* JSON State Tree Snapshot */}
            <div className="flex-1 flex flex-col min-h-[250px]">
              <div className="flex justify-between items-center mb-1">
                <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                  JSON Snapshot
                </h4>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(getSnapshot(store), null, 2)
                    );
                    showToast('Snapshot copied to clipboard!');
                  }}
                  className="text-[10px] text-indigo-500 hover:underline"
                >
                  Copy
                </button>
              </div>
              <pre className="flex-1 text-[10px] font-mono p-3 bg-zinc-900 text-zinc-300 rounded-xl overflow-auto border border-zinc-800 select-text leading-relaxed">
                {JSON.stringify(getSnapshot(store), null, 2)}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'patches' && (
          <div className="space-y-3 h-full flex flex-col">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                JSON Patches Feed
              </h4>
              {store.patchLogs.length > 0 && (
                <button
                  onClick={() => store.clearPatchLogs()}
                  className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                >
                  Clear
                </button>
              )}
            </div>

            {store.patchLogs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                <span className="text-xs text-slate-400 dark:text-zinc-500 text-center">
                  Fired operations and JSON Patches will stream here in real-time.
                </span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[calc(100vh-180px)]">
                {store.patchLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/80 rounded-xl shadow-sm space-y-2"
                  >
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-semibold text-slate-400 dark:text-zinc-500">
                        {log.timestamp}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono font-bold capitalize ${
                          log.patch.op === 'add'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                            : log.patch.op === 'replace'
                            ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400'
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                        }`}
                      >
                        {log.patch.op}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono space-y-1">
                      <div>
                        <span className="text-slate-400 dark:text-zinc-500">path:</span>{' '}
                        <code className="text-indigo-500 dark:text-indigo-400 font-semibold">
                          {log.patch.path}
                        </code>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-zinc-500 block">
                          value:
                        </span>
                        <pre className="p-1.5 mt-0.5 bg-zinc-950 text-zinc-300 rounded overflow-x-auto text-[9px] border border-zinc-900 max-h-32">
                          {JSON.stringify(log.patch.value, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'router' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
              Router State Tree
            </h4>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-100 dark:border-zinc-800/80 shadow-sm space-y-3 font-mono text-[11px]">
              <div>
                <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-sans font-bold">
                  Pathname
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                  {router.pathname}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-sans font-bold">
                  Action
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                  {router.action}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-sans font-bold">
                  Query Parameters
                </span>
                <pre className="p-2 mt-1 bg-zinc-950 text-zinc-300 rounded border border-zinc-900 overflow-x-auto text-[10px]">
                  {JSON.stringify(router.query, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-sans font-bold">
                  Route Parameters
                </span>
                <pre className="p-2 mt-1 bg-zinc-950 text-zinc-300 rounded border border-zinc-900 overflow-x-auto text-[10px]">
                  {JSON.stringify(router.params, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
});
