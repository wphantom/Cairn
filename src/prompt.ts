import { render } from './render';
import { state } from './store';
import * as store from './store';

let promptResolve: ((val: string) => void) | null = null;
let promptInput: HTMLInputElement | null = null;

export function showPrompt(
  prompt: string,
  callback: (result: string) => void | Promise<void>,
  liveCallback?: (result: string) => void
) {
  const statusline = document.querySelector('.statusline');
  if (!statusline) return;

  const existing = document.querySelector('.prompt-container');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.className = 'prompt-container';

  const label = document.createElement('span');
  label.className = 'prompt-label';
  label.textContent = prompt;

  const input = document.createElement('input');
  input.className = 'prompt-input';
  input.type = 'text';
  input.autoFocus = true;

  promptInput = input;

  input.addEventListener('input', (e) => {
    if (liveCallback) {
      liveCallback(input.value);
    }
  });

  input.addEventListener('keydown', async (e) => {
    e.stopPropagation();
    
    // Allow arrow keys only for navigation during live search
    if (liveCallback && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const sortedTasks = store.getSortedTasks();
      const maxCursor = sortedTasks.length - 1;
      
      if (e.key === 'ArrowDown') {
        state.cursor = Math.min(state.cursor + 1, maxCursor);
      } else if (e.key === 'ArrowUp') {
        state.cursor = Math.max(state.cursor - 1, 0);
      }
      render();
      return;
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value;
      container.remove();
      state.searchActive = false;
      await callback(val);
      promptInput = null;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      container.remove();
      promptInput = null;
      state.searchActive = false;
      state.search = '';
      state.cursor = 0;
      store.applyFilterAndSearch();
      state.mode = 'NORMAL';
      render();
    }
  });

  container.appendChild(label);
  container.appendChild(input);

  const statuslineContent = statusline.querySelector('.status');
  if (statuslineContent) {
    statuslineContent.parentNode?.replaceChild(container, statuslineContent);
  } else {
    statusline.appendChild(container);
  }

  input.focus();
}
