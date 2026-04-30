import { state } from './store';
import * as store from './store';
import { render } from './render';
import { showPrompt } from './prompt';
import { api } from './api';

let keyBuffer = '';
let bufferTimeout: number | null = null;
let targetFontSize = 13; // Global target fontsize (default 13px)

const BUFFER_TIMEOUT = 800;

export function handleKeydown(e: KeyboardEvent) {
  if (state.mode === 'INSERT') {
    // Input element handles Escape/Enter, don't process here
    return;
  } else if (state.mode === 'COMMAND') {
    handleCommandMode(e);
  } else {
    handleNormalMode(e);
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

  // In search mode, skip arrow key navigation only
  if (state.searchActive && (key === 'ArrowDown' || key === 'ArrowUp')) {
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
      state.searchActive = false;
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
        await store.setDueDate(filteredIdx, date);
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
      state.searchActive = false;
      if (name) {
        const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
        await store.addProject(filteredIdx, name);
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
      state.searchActive = false;
      if (name) {
        const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
        await store.addContext(filteredIdx, name);
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
      try {
        await handleCommand(cmd);
      } catch (err) {
        console.error('Command error:', err);
      }
      state.searchActive = false;
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
      const filteredIdx = store.getFilteredIndexFromSortedCursor(state.cursor);
      await store.editTask(filteredIdx, text);
      state.mode = 'NORMAL';
      state.buffer = '';
      render();
    })();
  } else {
    state.mode = 'NORMAL';
    render();
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
      // Default sort: none
      store.setSortMode('none');
      render();
      break;
    case 'alpha':
      const opacity = parseFloat(parts[1]);
      if (opacity >= 0 && opacity <= 1) {
        const app = document.getElementById('app') as HTMLElement;
        if (app) {
          app.style.opacity = opacity.toString();
          localStorage.setItem('cairn:opacity', opacity.toString());
        }
      }
      break;
    case 'fontsize':
      const fontSize = parseInt(parts[1]);
      if (fontSize > 0) {
        targetFontSize = fontSize;
        (window as any).__TARGET_FONTSIZE = fontSize;
        localStorage.setItem('cairn:fontsize', fontSize.toString());
        render();
      }
      break;
    case 'bgcolor':
      const bgColor = parts[1];
      if (bgColor && bgColor.match(/^#[0-9a-fA-F]{6}$/)) {
        const app = document.getElementById('app') as HTMLElement;
        if (app) {
          app.style.backgroundColor = bgColor;
          localStorage.setItem('cairn:bgcolor', bgColor);
        }
      }
      break;
    case 'textcolor':
      const textColor = parts[1];
      if (textColor && textColor.match(/^#[0-9a-fA-F]{6}$/)) {
        document.documentElement.style.color = textColor;
        localStorage.setItem('cairn:textcolor', textColor);
      }
      break;
    case 'size':
      // TODO: size command requires Tauri permission flags in Cargo.toml
      // For now, manual window resize via system
      break;
  }

  // Handle sort short commands (s, sp, s@, s+, sD)
  if (command.startsWith('s') && command !== 'set' && command !== 'size') {
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
  }
}
