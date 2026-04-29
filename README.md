# Cairn

Minimal, keyboard-driven todo.txt editor for macOS. Built with Tauri 2 + TypeScript.

## Features

- **Vim-like modal editing**: NORMAL, INSERT, COMMAND modes with modal keybindings
- **todo.txt format**: Full support for priorities, projects (+), contexts (@), due dates (due:YYYY-MM-DD)
- **File-based storage**: Stores tasks in `~/todo.txt` with automatic synchronization
- **Floating window**: Always-on-top window, can be hidden/shown via keyboard (q) or app menu
- **Real-time sync**: File watcher auto-reloads when external changes are made
- **Search & filter**: Quick search (/) and command-line filtering (:filter)
- **Drag-able window**: Move window by dragging the title bar

## Keybindings (NORMAL mode)

**Navigation**
- `j/↓` - Move down
- `k/↑` - Move up
- `gg` - Jump to top
- `G` - Jump to bottom

**Editing**
- `i` - Insert (edit at start)
- `A` - Append (edit at end)
- `o` - New task below
- `O` - New task above
- `x` - Toggle done/undone
- `dd` - Delete task

**Priority & Due Dates**
- `p[A-Z]` - Set priority (A-Z)
- `pp` - Remove priority
- `D` - Set due date (YYYY-MM-DD format)

**Projects & Contexts**
- `+` - Add project
- `@` - Add context

**Commands**
- `:` - Enter command mode
- `/` - Live search (arrow keys to navigate, Enter to confirm, Esc to cancel)
- `?` - Toggle help
- `q` - Hide window
- `Esc` - Cancel/exit modes

**Available Commands**
- `:w` - Save tasks
- `:q` - Quit app
- `:wq` - Save and quit
- `:s` - Revert to original order (from file)
- `:sp` - Sort by priority (A first)
- `:s@` - Sort by context name (alphabetical)
- `:s+` - Sort by project name (alphabetical)
- `:sD` - Sort by due date (nearest first)
- `:sort` - Sort by priority then date
- `:archive` - Archive done tasks to `~/todo.done.txt`

## Build & Run

### Development
```bash
npm install
npm exec tauri dev
```

### Build Release
```bash
npm exec tauri build
```

Output: `/src-tauri/target/release/bundle/macos/Cairn.app`

## Configuration

- **App identifier**: `fr.sylvainclement.cairn`
- **Default file**: `~/todo.txt`
- **Archive file**: `~/todo.done.txt`
- **Window**: 480×600 px, centered, always on top

## Implementation

- **Backend**: Rust + Tauri 2
- **Frontend**: TypeScript + Vite
- **File watching**: `notify` crate v6
- **Parser**: todo.txt format compliance
- **State management**: Reactive store with auto-save
- **UI**: CSS with glassmorphism (macOS vibrancy + backdrop blur)
