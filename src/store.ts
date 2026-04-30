import { Task, Mode, Filter } from './types';
import { parse, serialize } from './parser';
import { api } from './api';
import { render } from './render';

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

function regenerateTaskRaw(task: Task) {
  // Rebuild task.raw and task.description from task object fields
  let raw = '';
  if (task.done) {
    raw = 'x';
    if (task.completionDate) raw += ` ${task.completionDate}`;
    if (task.creationDate) raw += ` ${task.creationDate}`;
  } else {
    if (task.priority) raw += `(${task.priority}) `;
    if (task.creationDate) raw += `${task.creationDate} `;
  }
  
  raw += task.description;
  
  for (const proj of task.projects) {
    if (!raw.includes(`+${proj}`)) raw += ` +${proj}`;
  }
  for (const ctx of task.contexts) {
    if (!raw.includes(`@${ctx}`)) raw += ` @${ctx}`;
  }
  for (const [key, val] of Object.entries(task.meta)) {
    if (key !== 'pri' && key !== 'due') {
      if (!raw.includes(`${key}:${val}`)) raw += ` ${key}:${val}`;
    }
  }
  if (task.priority) {
    if (!raw.includes(`pri:${task.priority}`)) raw += ` pri:${task.priority}`;
  }
  if (task.meta.due) {
    if (!raw.includes(`due:${task.meta.due}`)) raw += ` due:${task.meta.due}`;
  }
  
  task.raw = raw.trim();
  // Update description to include projects/contexts for rendering
  task.description = task.description;
  // Rebuild description by removing metadata but keeping @/+
  let desc = task.raw;
  if (task.done) {
    desc = desc.replace(/^x\s+/, '');
    if (task.completionDate) desc = desc.replace(/^\d{4}-\d{2}-\d{2}\s+/, '');
    if (task.creationDate) desc = desc.replace(/^\d{4}-\d{2}-\d{2}\s+/, '');
  } else {
    if (task.priority) desc = desc.replace(/^\([A-Z]\)\s+/, '');
    if (task.creationDate) desc = desc.replace(/^\d{4}-\d{2}-\d{2}\s+/, '');
  }
  // Remove non-@ non-+ metadata
  desc = desc.replace(/\s+[^@+\s]\S*:\S+/g, '').trim();
  task.description = desc;
}

export async function setDueDate(idx: number, date: string) {
  const origIdx = state.tasks.indexOf(state.filteredTasks[idx]);
  const task = state.tasks[origIdx];
  task.meta.due = date;
  regenerateTaskRaw(task);
  applyFilterAndSearch();
  await saveTasks();
  // Regenerate task.raw
  const serialized = serializeTask(task);
  const reparsed = parse(serialized)[0];
  task.raw = reparsed.raw;
}

export async function addProject(idx: number, name: string) {
  const origIdx = state.tasks.indexOf(state.filteredTasks[idx]);
  const task = state.tasks[origIdx];
  if (!task.projects.includes(name)) {
    task.projects.push(name);
    const proj = `+${name}`;
    if (!task.description.includes(proj)) {
      task.description += ` ${proj}`;
    }
  }
  regenerateTaskRaw(task);
  applyFilterAndSearch();
  await saveTasks();
  // Regenerate task.raw
  const serialized = serializeTask(task);
  const reparsed = parse(serialized)[0];
  task.raw = reparsed.raw;
  // Force immediate render before returning
  render();
}

export async function addContext(idx: number, name: string) {
  const origIdx = state.tasks.indexOf(state.filteredTasks[idx]);
  const task = state.tasks[origIdx];
  if (!task.contexts.includes(name)) {
    task.contexts.push(name);
    const ctx = `@${name}`;
    if (!task.description.includes(ctx)) {
      task.description += ` ${ctx}`;
    }
  }
  regenerateTaskRaw(task);
  applyFilterAndSearch();
  await saveTasks();
  // Regenerate task.raw from serialized form
  const serialized = serializeTask(task);
  const reparsed = parse(serialized)[0];
  task.raw = reparsed.raw;
  // Force immediate render before returning
  render();
}

function serializeTask(task: Task): string {
  if (task.done) {
    let line = 'x';
    if (task.completionDate) line += ` ${task.completionDate}`;
    if (task.creationDate) line += ` ${task.creationDate}`;
    line += ` ${task.description}`;

    for (const [key, val] of Object.entries(task.meta)) {
      if (key !== 'pri') {
        line += ` ${key}:${val}`;
      }
    }

    if (task.priority) {
      line += ` pri:${task.priority}`;
    }

    for (const proj of task.projects) {
      if (!line.includes(`+${proj}`)) line += ` +${proj}`;
    }

    for (const ctx of task.contexts) {
      if (!line.includes(`@${ctx}`)) line += ` @${ctx}`;
    }

    return line.trim();
  } else {
    let line = '';
    if (task.priority) line += `(${task.priority}) `;
    if (task.creationDate) line += `${task.creationDate} `;

    line += task.description;

    for (const proj of task.projects) {
      if (!line.includes(`+${proj}`)) line += ` +${proj}`;
    }

    for (const ctx of task.contexts) {
      if (!line.includes(`@${ctx}`)) line += ` @${ctx}`;
    }

    for (const [key, val] of Object.entries(task.meta)) {
      if (key !== 'pri' && key !== 'due') {
        if (!line.includes(`${key}:${val}`)) line += ` ${key}:${val}`;
      }
    }

    if (task.meta.due) {
      if (!line.includes(`due:${task.meta.due}`)) line += ` due:${task.meta.due}`;
    }

    return line.trim();
  }
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
