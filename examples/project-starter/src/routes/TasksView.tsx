import React, { useState } from 'react';
import { observer } from 'jotai-state-tree/react';
import { useAppStore } from '../App';
import { useToast } from '../components/Toast';

export const TasksView = observer(function TasksView() {
  const store = useAppStore();
  const { showToast } = useToast();
  const [taskText, setTaskText] = useState('');
  const [taskCategory, setTaskCategory] = useState('Engineering');

  const tasksList = store.tasks.filteredTasks;
  const categoriesList = store.tasks.categories;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskText.trim()) return;

    store.tasks.addTask(taskText, taskCategory);
    setTaskText('');
    showToast(`Added task: "${taskText.substring(0, 15)}..."`);
  };

  const handleToggle = (id: string, text: string) => {
    const task = store.tasks.items.find((t) => t.id === id);
    if (task) {
      task.toggle();
      showToast(task.completed ? 'Task completed!' : 'Task active again!');
    }
  };

  const handleDelete = (id: string, text: string) => {
    store.tasks.deleteTask(id);
    showToast(`Deleted task: "${text.substring(0, 15)}..."`, 'info');
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'engineering':
        return 'bg-blue-50 text-blue-600 border border-blue-100/50 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30';
      case 'design':
        return 'bg-pink-50 text-pink-600 border border-pink-100/50 dark:bg-pink-950/20 dark:text-pink-400 dark:border-pink-900/30';
      case 'product':
        return 'bg-purple-50 text-purple-600 border border-purple-100/50 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30';
      case 'docs':
        return 'bg-emerald-50 text-emerald-600 border border-emerald-100/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
      default:
        return 'bg-slate-50 text-slate-600 border border-slate-100/50 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700/30';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-slate-800 dark:text-zinc-100">
            Task Manager
          </h2>
          <p className="text-xs text-slate-400 dark:text-zinc-500">
            Define, filter, and track milestone configurations
          </p>
        </div>
      </div>

      {/* Task creator bar */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 p-6 rounded-2xl shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end md:items-center">
          <div className="flex-1 w-full space-y-1">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block">
              What needs to be done?
            </label>
            <input
              type="text"
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder="e.g. Integrate indexedDB snapshot caching..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-zinc-850 dark:border-zinc-700/80 text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="w-full md:w-48 space-y-1">
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block">
              Category
            </label>
            <select
              value={taskCategory}
              onChange={(e) => setTaskCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-zinc-850 dark:border-zinc-700/80 text-sm text-slate-850 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all appearance-none"
            >
              <option value="Engineering">Engineering</option>
              <option value="Design">Design</option>
              <option value="Product">Product</option>
              <option value="Docs">Docs</option>
              <option value="Operations">Operations</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={!taskText.trim()}
            className="w-full md:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
          >
            Create Task
          </button>
        </form>
      </div>

      {/* Filter settings panel */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        {/* Status filters */}
        <div className="flex bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl w-fit gap-0.5 text-xs font-medium">
          {['All', 'Active', 'Completed'].map((filter) => (
            <button
              key={filter}
              onClick={() => store.tasks.setFilter(filter)}
              className={`px-4 py-2 rounded-lg transition-all ${
                store.tasks.filter === filter
                  ? 'bg-white text-slate-800 dark:bg-zinc-850 dark:text-zinc-100 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400 dark:text-zinc-500 mr-1">Category:</span>
          {categoriesList.map((cat) => (
            <button
              key={cat}
              onClick={() => store.tasks.setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full transition-all border ${
                store.tasks.categoryFilter === cat
                  ? 'bg-slate-900 border-slate-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900 font-semibold'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks display list */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs text-slate-400 dark:text-zinc-500 font-medium px-2">
          <span>Displaying {tasksList.length} tasks</span>
          {store.tasks.completedCount > 0 && (
            <button
              onClick={() => {
                store.tasks.clearCompleted();
                showToast('Cleared completed items!', 'info');
              }}
              className="text-rose-500 hover:underline font-semibold"
            >
              Clear Completed
            </button>
          )}
        </div>

        {tasksList.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 shadow-sm space-y-2">
            <span className="block text-slate-300 dark:text-zinc-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.107c0-1.242-1.008-2.25-2.25-2.25h-1.5a2.25 2.25 0 00-2.25 2.25v12.393A2.25 2.25 0 0018 18.75zm-12 0H6a2.25 2.25 0 01-2.25-2.25V6.107c0-1.242 1.008-2.25 2.25-2.25h1.5a2.25 2.25 0 012.25 2.25v12.393A2.25 2.25 0 016 18.75z" />
              </svg>
            </span>
            <h3 className="font-display font-semibold text-slate-800 dark:text-zinc-200">No tasks found</h3>
            <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-[240px] mx-auto">Adjust filters or create a new milestone above to begin.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tasksList.map((task) => (
              <div
                key={task.id}
                className="bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-4 transition-all duration-200 hover:border-slate-300 dark:hover:border-zinc-700 select-none"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggle(task.id, task.text)}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                      task.completed
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500'
                    }`}
                  >
                    {task.completed && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0 space-y-1">
                    <span
                      onClick={() => handleToggle(task.id, task.text)}
                      className={`block text-sm font-medium transition-all truncate cursor-pointer ${
                        task.completed
                          ? 'text-slate-400 dark:text-zinc-500 line-through'
                          : 'text-slate-800 dark:text-zinc-200'
                      }`}
                    >
                      {task.text}
                    </span>
                    <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded ${getCategoryColor(task.category)}`}>
                      {task.category}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(task.id, task.text)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 dark:text-zinc-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                  title="Delete Task"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
