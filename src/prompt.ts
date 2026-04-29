import { render } from './render';
import { state } from './store';

let promptResolve: ((val: string) => void) | null = null;
let promptInput: HTMLInputElement | null = null;

export function showPrompt(
  prompt: string,
  callback: (result: string) => void | Promise<void>
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

  input.addEventListener('keydown', async (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value;
      container.remove();
      // Restore status span
      const status = document.createElement('span');
      status.className = 'status';
      if (statusline) statusline.appendChild(status);
      await callback(val);
      promptInput = null;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      container.remove();
      // Restore status span
      const status = document.createElement('span');
      status.className = 'status';
      if (statusline) statusline.appendChild(status);
      promptInput = null;
      state.mode = 'NORMAL';
      render();
    }
  });

  container.appendChild(label);
  container.appendChild(input);

  const statuslineContent = statusline.querySelector('.status');
  if (statuslineContent) {
    statuslineContent.parentNode?.replaceChild(container, statuslineContent);
  }

  input.focus();
}
