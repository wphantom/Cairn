import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const api = {
  getDefaultPath: () => invoke<string>('get_default_path'),
  readFile: (path: string) => invoke<string>('read_file', { path }),
  writeFile: (path: string, content: string) => invoke<void>('write_file', { path, content }),
  archiveDone: (source: string, archive: string) => invoke<number>('archive_done', { source, archive }),
  openInFinder: (path: string) => invoke<void>('open_in_finder', { path }),
  hideWindow: () => invoke<void>('hide_window'),
  showWindow: () => invoke<void>('show_window'),
  toggleWindow: () => invoke<void>('toggle_window'),
  quitApp: () => invoke<void>('quit_app'),
  loadConfig: () => invoke<{ todofile: string | null; commands: string[] }>('load_config'),
};

export async function setupEventListeners(
  onFileChanged: (content: string) => void,
  onReloadRequested: () => void,
  onArchiveRequested: () => void,
  onOpenRequested: () => void
) {
  const unlistenFileChanged = await listen<string>('file-changed', (e) => {
    onFileChanged(e.payload);
  });

  const unlistenReload = await listen('reload-requested', () => {
    onReloadRequested();
  });

  const unlistenArchive = await listen('archive-requested', () => {
    onArchiveRequested();
  });

  const unlistenOpen = await listen('open-in-finder-requested', () => {
    onOpenRequested();
  });

  return { unlistenFileChanged, unlistenReload, unlistenArchive, unlistenOpen };
}
