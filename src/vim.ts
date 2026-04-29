import { state } from './store';
import * as store from './store';
import { render } from './render';
import { showPrompt } from './prompt';
import { api } from './api';

let keyBuffer = '';
let bufferTimeout: number | null = null;

const BUFFER_TIMEOUT = 800;

export function handleKeydown(e: KeyboardEvent) {
  if (state.mode === 'INSERT') {
    handleInsertMode(e);
  } else if (state.mode === 'COMMAND') {
    handleCommandMode(e);
  } else {
    handleNormalMode(e);
  }
}

function handleInsertMode(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    exitInsert();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const input = document.querySelector('input[data-task-edit]') as HTMLInputElement;
    if (input) {
      const text = input.value;
      (async () => {
        const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
        await store.editTask(filteredIdx, text);
        await store.addTaskBelow(filteredIdx);
        state.cursor = store.getSortedTasks().length - 1;
        state.mode = 'INSERT';
        render();
        setTimeout(() => {
          const newInput = document.querySelector('input[data-task-edit]') as HTMLInputElement;
          if (newInput) newInput.focus();
        }, 0);
      })();
    }
  }
}

function handleCommandMode(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    state.mode = 'NORMAL';
    render();
  } else if (e.key === 'Enter') {
    // Handled by prompt - just prevent default
    e.preventDefault();
  } else if (e.key === 'Backspace') {
    // Handled by prompt
    e.preventDefault();
  }
  // All other input is handled by prompt input field, not here
}

function handleNormalMode(e: KeyboardEvent) {
  const key = e.key;

  if (e.metaKey && !e.ctrlKey && !e.altKey) {
    return;
  }

  if (e.ctrlKey) {
    return;
  }

  // In search mode, skip navigation only (j/k handled by prompt)
  if (state.searchActive && (key === 'j' || key === 'k' || key === 'ArrowDown' || key === 'ArrowUp')) {
    return;
  }

  // Any other vim action during search exits search mode
  if (state.searchActive) {
    exitSearch();
  }

  keyBuffer += key;
  clearTimeout(bufferTimeout as any);

  let handled = false;
  const sortedTasks = store.getSortedTasks();
  const maxCursor = sortedTasks.length - 1;

  if (key === 'j' || key === 'ArrowDown') {
    e.preventDefault();
    state.cursor = Math.min(state.cursor + 1, maxCursor);
    keyBuffer = '';
    handled = true;
  } else if (key === 'k' || key === 'ArrowUp') {
    e.preventDefault();
    state.cursor = Math.max(state.cursor - 1, 0);
    keyBuffer = '';
    handled = true;
  } else if (keyBuffer === 'gg') {
    e.preventDefault();
    state.cursor = 0;
    keyBuffer = '';
    handled = true;
  } else if (key === 'G') {
    e.preventDefault();
    state.cursor = maxCursor;
    keyBuffer = '';
    handled = true;
  } else if (key === 'o') {
    e.preventDefault();
    (async () => {
      const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
      await store.addTaskBelow(filteredIdx);
      state.cursor = store.getSortedTasks().length - 1;
      state.mode = 'INSERT';
      render();
    })();
    keyBuffer = '';
    handled = true;
  } else if (key === 'O') {
    e.preventDefault();
    (async () => {
      const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
      await store.addTaskAbove(filteredIdx);
      state.mode = 'INSERT';
      render();
    })();
    keyBuffer = '';
    handled = true;
  } else if (key === 'i') {
    e.preventDefault();
    state.mode = 'INSERT';
    keyBuffer = '';
    handled = true;
  } else if (key === 'A') {
    e.preventDefault();
    state.mode = 'INSERT';
    keyBuffer = '';
    handled = true;
  } else if (key === 'x') {
    e.preventDefault();
    (async () => {
      const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
      await store.toggleDone(filteredIdx);
      render();
    })();
    keyBuffer = '';
    handled = true;
  } else if (keyBuffer === 'dd') {
    e.preventDefault();
    (async () => {
      const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
      await store.deleteTask(filteredIdx);
      render();
    })();
    keyBuffer = '';
    handled = true;
  } else if (keyBuffer.match(/^p[a-zA-Z]$/)) {
    e.preventDefault();
    const prio = keyBuffer[1].toUpperCase();
    (async () => {
      const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
      await store.setPriority(filteredIdx, prio);
      render();
    })();
    keyBuffer = '';
    handled = true;
  } else if (keyBuffer === 'pp') {
    e.preventDefault();
    (async () => {
      const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
      await store.setPriority(filteredIdx, null);
      render();
    })();
    keyBuffer = '';
    handled = true;
  } else if (key === 'D') {
    e.preventDefault();
    showPrompt('Due date (YYYY-MM-DD): ', async (date) => {
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
        await store.setDueDate(filteredIdx, date);
        render();
      }
      state.mode = 'NORMAL';
      render();
    });
    state.mode = 'COMMAND';
    keyBuffer = '';
    handled = true;
  } else if (key === '+') {
    e.preventDefault();
    showPrompt('Project name: ', async (name) => {
      if (name) {
        const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
        await store.addProject(filteredIdx, name);
        render();
      }
      state.mode = 'NORMAL';
      render();
    });
    state.mode = 'COMMAND';
    keyBuffer = '';
    handled = true;
  } else if (key === '@') {
    e.preventDefault();
    showPrompt('Context name: ', async (name) => {
      if (name) {
        const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
        await store.addContext(filteredIdx, name);
        render();
      }
      state.mode = 'NORMAL';
      render();
    });
    state.mode = 'COMMAND';
    keyBuffer = '';
    handled = true;
  } else if (key === '/') {
    e.preventDefault();
    state.searchActive = true;
    state.cursor = 0;
    showPrompt(
      'Search: ',
      (term) => {
        state.search = term;
        store.applyFilterAndSearch();
        state.mode = 'NORMAL';
        state.cursor = 0;
        render();
      },
      (term) => {
        state.search = term;
        store.applyFilterAndSearch();
        state.cursor = 0;
        render();
      }
    );
    state.mode = 'COMMAND';
    keyBuffer = '';
    handled = true;
  } else if (key === ':') {
    e.preventDefault();
    showPrompt(': ', async (cmd) => {
      await handleCommand(cmd);
      state.mode = 'NORMAL';
      render();
    });
    state.mode = 'COMMAND';
    keyBuffer = '';
    handled = true;
  } else if (key === '?') {
    e.preventDefault();
    const overlay = document.getElementById('help-overlay');
    if (overlay) {
      overlay.classList.toggle('hidden');
    }
    keyBuffer = '';
    handled = true;
  } else if (key === 'q') {
    e.preventDefault();
    api.hideWindow();
    keyBuffer = '';
    handled = true;
  } else if (key === 'Escape') {
    e.preventDefault();
    keyBuffer = '';
    handled = true;
  } else if (!/^[a-zA-Z0-9!@#$%^&*()_+=\-\[\]{};:'",.<>?/\\|`~]$/.test(key)) {
    keyBuffer = '';
  }

  if (handled) {
    render();
  }

  bufferTimeout = window.setTimeout(() => {
    keyBuffer = '';
  }, BUFFER_TIMEOUT);
}

function exitInsert() {
  const input = document.querySelector('input[data-task-edit]') as HTMLInputElement;
  if (input) {
    const text = input.value;
    (async () => {
      await store.editTask(state.cursor, text);
      state.mode = 'NORMAL';
      state.buffer = '';
      render();
    })();
  }
}

function exitSearch() {
  state.searchActive = false;
  state.mode = 'NORMAL';
  // Keep search active for filtering but remove prompt
  const promptContainer = document.querySelector('.prompt-container');
  if (promptContainer) {
    promptContainer.remove();
    const statusline = document.querySelector('.statusline');
    const status = document.createElement('span');
    status.className = 'status';
    if (statusline) statusline.appendChild(status);
  }
}

async function handleCommand(cmd: string) {
  const parts = cmd.trim().split(/\s+/);
  const command = parts[0];

  if (command.startsWith('s')) {
    // Sort command: :s, :sp, :s@, :s+, :sD
    const sortArg = command.slice(1);
    if (sortArg === '') {
      store.setSortMode('none');
    } else if (sortArg === 'p') {
      store.setSortMode('priority');
    } else if (sortArg === '@') {
      store.setSortMode('context');
    } else if (sortArg === '+') {
      store.setSortMode('project');
    } else if (sortArg === 'D') {
      store.setSortMode('duedate');
    }
    render();
    return;
  }

  switch (command) {
    case 'w':
      await store.saveTasks();
      break;
    case 'q':
      api.hideWindow();
      break;
    case 'wq':
      await store.saveTasks();
      api.hideWindow();
      break;
    case 'Q':
      api.quitApp();
      break;
    case 'archive':
      const count = await store.archiveDone();
      render();
      break;
    case 'sort':
      state.tasks.sort((a, b) => {
        if (a.priority && !b.priority) return -1;
        if (!a.priority && b.priority) return 1;
        if (a.priority && b.priority) {
          return a.priority.localeCompare(b.priority);
        }
        const aDate = a.creationDate || '9999-12-31';
        const bDate = b.creationDate || '9999-12-31';
        if (!a.done && !b.done) return bDate.localeCompare(aDate);
        if (a.done && !b.done) return 1;
        if (!a.done && b.done) return -1;
        return 0;
      });
      store.applyFilterAndSearch();
      await store.saveTasks();
      render();
      break;
    case 'filter':
      const expr = parts.slice(1).join(' ');
      await store.applyFilter(expr);
      render();
      break;
    case 'clear':
      store.clearFilter();
      render();
      break;
    case 'open':
      api.openInFinder(state.filePath);
      break;
    case 'help':
    case '?':
      const overlay = document.getElementById('help-overlay');
      if (overlay) {
        overlay.classList.toggle('hidden');
      }
      break;
    case 'set':
      if (parts[1] === 'file') {
        const newPath = parts.slice(2).join(' ');
        state.filePath = newPath;
        await store.loadTasks();
        render();
      }
      break;
  }
}
