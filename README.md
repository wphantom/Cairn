# Cairn

Minimal, keyboard-driven todo.txt editor for macOS. Built with Tauri 2 + TypeScript.

## Features

- **Vim-like modal editing**: NORMAL, INSERT, COMMAND modes with modal keybindings
- **todo.txt format**: Full support for priorities, projects (+), contexts (@), due dates (due:YYYY-MM-DD) (see [[https://github.com/todotxt/todo.txt]])
- **File-based storage**: Stores tasks in `~/todo.txt` with automatic synchronization (another file can be specified)
- **Floating window**: Always-on-top window, can be hidden/shown via keyboard (q) or app menu
- **Focus indicator**: Header bar highlights with a configurable color when the window has focus
- **Real-time sync**: File watcher auto-reloads when external changes are made
- **Search & filter**: Quick search (/) and command-line filtering (:filter)
- **Drag-able window**: Move window by dragging the title bar
- Menu bar item to toggle window visibility
- config fil tweaks.

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
- `:bgalpha <0-1>` - Set background transparency (0=fully transparent, 1=fully opaque)
- `:textalpha <0-1>` - Set text/UI transparency (0=fully transparent, 1=fully opaque)
- `:fontsize <size>` - Set font size in pixels
- `:bgcolor <#hex>` - Set background color (e.g., `#000000`)
- `:textcolor <#hex>` - Set text color (e.g., `#FFFFFF`)
- `:archive` - Move completed tasks to `~/done.txt`
- `:dragzonecolor <#hex>` - Set the header bar color when the window has focus (e.g., `#0D2D6B`)
- `:selectedcolor <#hex>` - Set the selected task highlight color (e.g., `#007aff`)

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

## Integration with Raycast

Cairn supports URL schemes for integration with [Raycast](https://www.raycast.com/) and other launcher applications.

### Available URL Schemes

- `cairn://toggle` - Toggle window visibility (show if hidden, hide if visible)
- `cairn://show` - Show the window
- `cairn://hide` - Hide the window

### Using with Raycast

The easiest way is to add a **Quicklink** in Raycast:

1. Open Raycast → go to **Extensions → Quicklinks**
2. Click **+** to create a new Quicklink
3. Set **Name**: `Toggle Cairn`
4. Set **Link**: `cairn://toggle`
5. Set **Open With**: `Cairn`
6. Assign a hotkey or search for it by name

That's it — triggering the Quicklink will instantly toggle Cairn's window.

### Using with Alfred or Spotlight

The `cairn://` scheme works with any launcher that supports URL schemes, including:
- **Spotlight**: Press Cmd+Space, type `cairn://toggle`, press Enter
- **Alfred**: Create a Custom URL search
- **Other launchers**: Any app that supports `open` URLs


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

## Config File

At startup, Cairn will look (in this order) for a config file at:

- ~/.cairn.conf
- ~/.config/cairn.conf
- ~/.config/cairn/cairn.conf

If no config file is found it will start with default settings.

Here is the sample-cairn.conf file as an example :
```

# This a sample config file for Cairn todo list app.
#
# Cairn will look in the following folders (in this order) to find the
# cairn.conf file. The first file found will be taken into account :
# - ~/.cairn.conf
# - ~/.config/cairn.conf
# - ~/.config/cairn/cairn.conf
#
#

#####  OPTIONAL SETTINGS
todofile="~/todo.txt"



#####  STARTUP COMMANDS
# Here are commands that will be executed at startup (they can also be used
# directly in the app)
:bgalpha 0.5
:textalpha 1
#:size 600 400  # :size command not implemented yet in cairn
:fontsize 8
:bgcolor #000000
:textcolor #FFFFFF
:dragzonecolor #0D2D6B
:selectedcolor #007aff

```
 
