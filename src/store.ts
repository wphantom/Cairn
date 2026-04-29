import { Task, Mode, Filter } from './types';
import { parse, serialize } from './parser';
import { api } from './api';

export const state = {
  filePath: '~/todo.txt',
  tasks: [] as Task[],
  filteredTasks: [] as Task[],
  cursor: 0,
  mode: 'NORMAL' as Mode,
  filter: null as Filter | null,
  search: '',
  searchActive: false,
  buffer: '',
  bufferTimer: null as number | null,
  sortMode: 'none' as 'none' | 'priority' | 'context' | 'project' | 'duedate',
};

export async function initStore() {
  const path = await api.getDefaultPath();
  state.filePath = path;
  await loadTasks();
}

export async function loadTasks() {
  const content = await api.readFile(state.filePath);
  state.tasks = parse(content);
  applyFilterAndSearch();
  state.cursor = Math.min(state.cursor, state.filteredTasks.length - 1);
}

export function applyFilterAndSearch() {
  let filtered = state.tasks;

  if (state.search) {
    filtered = filtered.filter(t =>
      t.description.toLowerCase().includes(state.search.toLowerCase())
    );
  }

  if (state.filter) {
    filtered = filtered.filter(t => {
      for (const must of state.filter!.must) {
        if (must.startsWith('+')) {
          if (!t.projects.includes(must.slice(1))) return false;
        } else if (must.startsWith('@')) {
          if (!t.contexts.includes(must.slice(1))) return false;
        } else if (!t.description.includes(must)) {
          return false;
        }
      }

      for (const excl of state.filter!.exclude) {
        if (excl.startsWith('+')) {
          if (t.projects.includes(excl.slice(1))) return false;
        } else if (excl.startsWith('@')) {
          if (t.contexts.includes(excl.slice(1))) return false;
        } else if (t.description.includes(excl)) {
          return false;
        }
      }

      return true;
    });
  }

  state.filteredTasks = filtered;
}

export async function saveTasks() {
  const content = serialize(state.tasks);
  await api.writeFile(state.filePath, content);
}

export async function toggleDone(idx: number) {
  const origIdx = state.tasks.indexOf(state.filteredTasks[idx]);
  const task = state.tasks[origIdx];

  if (task.done) {
    task.done = false;
    task.completionDate = null;
  } else {
    task.done = true;
    const today = new Date().toISOString().split('T')[0];
    task.completionDate = today;
  }

  await saveTasks();
}

export async function deleteTask(idx: number) {
  const origIdx = state.tasks.indexOf(state.filteredTasks[idx]);
  state.tasks.splice(origIdx, 1);
  applyFilterAndSearch();
  if (state.cursor >= state.filteredTasks.length && state.cursor > 0) {
    state.cursor--;
  }
  await saveTasks();
}

export async function addTaskBelow(idx: number) {
  const newTask: Task = {
    raw: '',
    done: false,
    priority: null,
    completionDate: null,
    creationDate: null,
    description: '',
    projects: [],
    contexts: [],
    meta: {},
  };

  const origIdx = state.tasks.indexOf(state.filteredTasks[idx]);
  state.tasks.splice(origIdx + 1, 0, newTask);
  applyFilterAndSearch();
  state.cursor = state.filteredTasks.indexOf(newTask);
}

export async function addTaskAbove(idx: number) {
  const newTask: Task = {
    raw: '',
    done: false,
    priority: null,
    completionDate: null,
    creationDate: null,
    description: '',
    projects: [],
    contexts: [],
    meta: {},
  };

  const origIdx = state.tasks.indexOf(state.filteredTasks[idx]);
  state.tasks.splice(origIdx, 0, newTask);
  applyFilterAndSearch();
  state.cursor = state.filteredTasks.indexOf(newTask);
}

export async function editTask(idx: number, text: string) {
  const origIdx = state.tasks.indexOf(state.filteredTasks[idx]);
  if (text.trim() === '') {
    state.tasks.splice(origIdx, 1);
  } else {
    const parsed = parse(text)[0];
    state.tasks[origIdx] = { ...parsed, raw: text };
  }
  applyFilterAndSearch();
  await saveTasks();
}

export async function setPriority(idx: number, prio: string | null) {
  const origIdx = state.tasks.indexOf(state.filteredTasks[idx]);
  const task = state.tasks[origIdx];

  if (prio === null) {
    task.priority = null;
    delete task.meta.pri;
  } else {
    task.priority = prio.toUpperCase() as any;
  }

  applyFilterAndSearch();
  await saveTasks();
}

export async function setDueDate(idx: number, date: string) {
  const origIdx = state.tasks.indexOf(state.filteredTasks[idx]);
  const task = state.tasks[origIdx];
  task.meta.due = date;
  applyFilterAndSearch();
  await saveTasks();
}

export async function addProject(idx: number, name: string) {
  const origIdx = state.tasks.indexOf(state.filteredTasks[idx]);
  const task = state.tasks[origIdx];
  if (!task.projects.includes(name)) {
    task.projects.push(name);
  }
  applyFilterAndSearch();
  await saveTasks();
}

export async function addContext(idx: number, name: string) {
  const origIdx = state.tasks.indexOf(state.filteredTasks[idx]);
  const task = state.tasks[origIdx];
  if (!task.contexts.includes(name)) {
    task.contexts.push(name);
  }
  applyFilterAndSearch();
  await saveTasks();
}

export async function applyFilter(expr: string) {
  const tokens = expr.trim().split(/\s+/);
  const must: string[] = [];
  const exclude: string[] = [];

  for (const tok of tokens) {
    if (tok.startsWith('!')) {
      exclude.push(tok.slice(1));
    } else {
      must.push(tok);
    }
  }

  state.filter = must.length > 0 || exclude.length > 0 ? { must, exclude } : null;
  applyFilterAndSearch();
}

export function clearFilter() {
  state.filter = null;
  state.search = '';
  applyFilterAndSearch();
}

export async function archiveDone() {
  let archive = state.filePath.replace(/\.txt$/, '') + '.done.txt';
  const count = await api.archiveDone(state.filePath, archive);
  if (count > 0) {
    await loadTasks();
  }
  return count;
}

export function setSortMode(mode: 'none' | 'priority' | 'context' | 'project' | 'duedate') {
  state.sortMode = mode;
}

export function getSortedTasks(): Task[] {
  let sorted = [...state.filteredTasks];

  if (state.sortMode === 'none') {
    return sorted;
  }

  if (state.sortMode === 'priority') {
    sorted.sort((a, b) => {
      const aPrio = a.priority || 'Z';
      const bPrio = b.priority || 'Z';
      return aPrio.localeCompare(bPrio);
    });
  } else if (state.sortMode === 'context') {
    sorted.sort((a, b) => {
      const aCtx = a.contexts[0] || '';
      const bCtx = b.contexts[0] || '';
      return aCtx.localeCompare(bCtx);
    });
  } else if (state.sortMode === 'project') {
    sorted.sort((a, b) => {
      const aProj = a.projects[0] || '';
      const bProj = b.projects[0] || '';
      return aProj.localeCompare(bProj);
    });
  } else if (state.sortMode === 'duedate') {
    sorted.sort((a, b) => {
      const aDue = a.meta.due || '9999-12-31';
      const bDue = b.meta.due || '9999-12-31';
      return aDue.localeCompare(bDue);
    });
  }

  return sorted;
}

export function getFilteredIndexFromSortedCursor(sortedIdx: number): number {
  const sorted = getSortedTasks();
  if (sortedIdx < 0 || sortedIdx >= sorted.length) return sortedIdx;
  const task = sorted[sortedIdx];
  return state.filteredTasks.indexOf(task);
}
