import { state } from './store';
import * as store from './store';
import { render } from './render';
import { handleKeydown } from './vim';
import { handleCommand } from './vim';
import { api, setupEventListeners } from './api';
import { parse } from './parser';

async function main() {
  // Load config file first
  try {
    const config = await api.loadConfig();
    
    // Determine which todo file to load
    if (config.todofile) {
      state.filePath = config.todofile;
    } else {
      const defaultPath = await api.getDefaultPath();
      state.filePath = defaultPath;
    }
    
    // Load tasks
    await store.loadTasks();
    render();
    
    // Restore persisted settings
    const savedBgAlpha = localStorage.getItem('cairn:bgalpha');
    if (savedBgAlpha) {
      document.documentElement.style.setProperty('--bg-alpha', savedBgAlpha);
    }

    const savedTextAlpha = localStorage.getItem('cairn:textalpha');
    if (savedTextAlpha) {
      document.documentElement.style.setProperty('--text-alpha', savedTextAlpha);
    }

    const savedFontSize = localStorage.getItem('cairn:fontsize');
    if (savedFontSize) {
      const fontSize = parseInt(savedFontSize);
      (window as any).__TARGET_FONTSIZE = fontSize;
    }

    const savedBgColor = localStorage.getItem('cairn:bgcolor');
    if (savedBgColor) {
      const r = parseInt(savedBgColor.slice(1, 3), 16);
      const g = parseInt(savedBgColor.slice(3, 5), 16);
      const b = parseInt(savedBgColor.slice(5, 7), 16);
      document.documentElement.style.setProperty('--bg-r', r.toString());
      document.documentElement.style.setProperty('--bg-g', g.toString());
      document.documentElement.style.setProperty('--bg-b', b.toString());
    }

    const savedTextColor = localStorage.getItem('cairn:textcolor');
    if (savedTextColor) {
      document.documentElement.style.color = savedTextColor;
    }

    const savedSize = localStorage.getItem('cairn:size');
    if (savedSize) {
      // TODO: size restoration disabled pending permission fixes
    }
    
    // Execute config commands
    for (const cmd of config.commands) {
      try {
        await handleCommand(cmd.slice(1)); // Remove leading ':'
        render();
      } catch (e) {
        store.setStatusError(`Command error: ${cmd}`);
        console.error('Config command error:', cmd, e);
      }
    }
    
  } catch (e) {
    console.error('Config loading error:', e);
  }

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
    
    // Skip vim handling if task-edit input is focused (it handles its own keydown)
    const activeEl = document.activeElement as HTMLElement;
    if (activeEl?.className === 'task-edit') {
      return;
    }
    
    // Skip vim handling if other input is focused or in COMMAND mode (unless in active search)
    if (activeEl?.tagName === 'INPUT') {
      return;
    }
    if (state.mode === 'COMMAND' && !state.searchActive) {
      return;
    }
    handleKeydown(e);
  }, true); // true = capture phase to intercept before input element

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
