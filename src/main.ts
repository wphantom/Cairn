import { state } from './store';
import * as store from './store';
import { render } from './render';
import { handleKeydown } from './vim';
import { api, setupEventListeners } from './api';
import { parse } from './parser';

async function main() {
  await store.initStore();
  render();

  // Enable drag on header
  const header = document.querySelector('.header');
  console.log('[DRAG] Header element:', header);
  console.log('[DRAG] window.__TAURI__ exists:', !!window.__TAURI__);

  if (header) {
    header.addEventListener('mousedown', (e) => {
      console.log('[DRAG] Header mousedown fired', e);
      try {
        if (window.__TAURI__) {
          console.log('[DRAG] Calling startDragging()...');
          (window as any).__TAURI__.window.appWindow.startDragging();
          console.log('[DRAG] startDragging() called successfully');
        } else {
          console.warn('[DRAG] window.__TAURI__ not available');
        }
      } catch (err) {
        console.error('[DRAG] Error calling startDragging():', err);
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    // Block system shortcuts
    if (
      (e.metaKey && (e.key === 'i' || e.key === 'I')) ||
      (e.shiftKey && e.metaKey && e.key === 'I')
    ) {
      return;
    }
    
    // Skip vim handling if input is focused or in COMMAND mode
    if (document.activeElement?.tagName === 'INPUT' || state.mode === 'COMMAND') {
      return;
    }
    handleKeydown(e);
  });

  await setupEventListeners(
    (content) => {
      state.tasks = parse(content);
      store.applyFilterAndSearch();
      render();
    },
    async () => {
      await store.loadTasks();
      render();
    },
    async () => {
      const count = await store.archiveDone();
      render();
    },
    () => {
      api.openInFinder(state.filePath);
    }
  );

  window.addEventListener('beforeunload', async () => {
    await store.saveTasks();
  });

  window.addEventListener('focus', async () => {
    await store.loadTasks();
    render();
  });
}

main().catch(console.error);
