# Spec — Application "todo.txt modal" pour macOS

> **Usage :** ce document est conçu pour être donné tel quel à Claude Code, Cursor ou GitHub Copilot Chat comme prompt initial / contexte projet. Il contient tout ce qu'il faut pour implémenter l'application sans questions de cadrage.
>
> **Si tu es l'agent qui code** : lis le document en entier avant d'écrire la moindre ligne. Respecte les versions exactes indiquées (Tauri 2.x change beaucoup par rapport à 1.x — ne mélange pas). Si un point te paraît ambigu, applique l'option la plus simple et signale-le en commentaire `// TODO(spec)`.

---

## 1. Objectif et philosophie

Construire **une petite application de bureau pour macOS uniquement** qui édite et affiche un fichier texte au format [todo.txt](https://github.com/todotxt/todo.txt) (par défaut `~/todo.txt`).

Trois principes directeurs, dans cet ordre :

1. **Le fichier texte est la source de vérité.** L'app n'a aucun stockage interne, aucune base de données, aucun cache persistant. Toute modification est immédiatement écrite dans `~/todo.txt`. Si l'utilisateur édite le fichier dans un autre éditeur pendant que l'app tourne, les modifs apparaissent dans l'app.
2. **Tout au clavier, style Vim modal.** L'app est utilisable en pratique sans souris (sauf pour déplacer la fenêtre). Pas de menus contextuels, pas de boutons, pas de glisser-déposer.
3. **Discrète et toujours accessible.** Petite fenêtre flottante toujours au-dessus, masquable d'un raccourci global, persiste en barre de menu.

---

## 2. Stack technique imposée

| Élément | Choix | Version |
|---|---|---|
| Runtime app | Tauri | **2.x** (stable, pas v1) |
| Backend | Rust | edition 2021, MSRV 1.77 |
| Frontend | TypeScript + Vite (vanilla, **pas de framework**) | TS 5.6+, Vite 5.4+ |
| Plugin Tauri | `tauri-plugin-global-shortcut` | 2.x |
| Effet vibrancy macOS | crate `window-vibrancy` | 0.5+ |
| Watcher fichier | crate `notify` | 6.x |
| Cible | macOS uniquement | Apple Silicon + Intel |

**Pourquoi Tauri 2 et pas v1** : v1 est en fin de vie, l'API tray a été entièrement repensée en v2 (`tauri::tray::TrayIconBuilder` au lieu de `SystemTray`), et le plugin global-shortcut n'est plus dans le core. Ne PAS suivre les tutos v1 trouvés sur internet.

**Pourquoi vanilla TS et pas React/Svelte** : l'UI est triviale (une `<ul>` + un statusline), un framework serait du poids inutile. Le bundle final doit rester < 200 KB côté frontend.

---

## 3. Format todo.txt — rappel rapide

Référence complète : voir le fichier `Règles_rédactiondes_fichiers_todo.txt` joint au projet. En résumé :

**Tâche en cours** : `[(PRIO)] [DATE_CRÉATION] description [+projet] [@contexte] [clé:valeur]`
- Priorité optionnelle : une majuscule entre parenthèses suivie d'une espace, en début de ligne. Ex : `(A) `
- Date de création optionnelle : juste après la priorité (ou au tout début si pas de priorité), format `YYYY-MM-DD`
- Projets : `+NomDeProjet` n'importe où après la priorité/date
- Contextes : `@nomDeContexte` n'importe où après la priorité/date
- Métadonnées : `clé:valeur` (ni clé ni valeur ne contiennent d'espace ni de `:`). Ex : `due:2026-05-15`

**Tâche complétée** : `x DATE_COMPLÉTION [DATE_CRÉATION] description...`
- Commence par `x` minuscule + espace
- Date de complétion obligatoire après le `x`
- Si la tâche avait une priorité, elle est remplacée par `pri:X` en métadonnée pour la conserver

**Exemples valides** :
```
(A) 2026-04-28 Appeler Maman @phone +Famille
2026-04-28 Documenter le format todo.txt
Acheter du pain @courses
x 2026-04-27 2026-04-25 Relire le PR de Tim +Projet pri:B
```

---

## 4. Comportement de l'application

### 4.1 Fenêtre

- **Taille initiale** : 480 × 600 px, position centrée à droite de l'écran principal.
- **Bordures** : pas de barre de titre native (`decorations: false`). L'utilisateur peut déplacer la fenêtre en cliquant-glissant sur la barre du haut (drag region).
- **Toujours au-dessus** : `alwaysOnTop: true`. La fenêtre flotte au-dessus de toutes les autres applications.
- **Visible sur tous les espaces** : la fenêtre suit l'utilisateur quand il change de Space (`setVisibleOnAllWorkspaces(true)`).
- **Transparence + vibrancy** : fond translucide avec effet "frosted glass" macOS. Utiliser `window-vibrancy` avec `NSVisualEffectMaterial::HudWindow` (ou `Sidebar` si HudWindow rend trop sombre).
- **Visible au lancement** : oui, par défaut.
- **Pas dans le Dock** : `activationPolicy: "accessory"` côté macOS — l'app n'apparaît pas dans le Dock ni avec ⌘-Tab, seulement en barre de menu.
- **Redimensionnable** : oui, garder min `360 × 400`, max libre.

### 4.2 Barre de menu (tray)

- Icône PNG monochrome **template** (variant noir, macOS l'inverse automatiquement en mode sombre).
- Clic gauche : toggle visibilité de la fenêtre.
- Clic droit : menu contextuel avec :
  - "Afficher / Masquer la fenêtre"
  - "Recharger depuis le disque"
  - "Ouvrir todo.txt dans Finder"
  - "Archiver les tâches terminées" (déplace les `x ...` vers `~/done.txt`)
  - "Quitter"

### 4.3 Raccourci global système

- Par défaut : **`⌥⌘T`** (Option + Cmd + T) pour montrer/masquer la fenêtre depuis n'importe où.
- Doit être configurable plus tard (pour l'instant, en dur dans le code, mais isolé dans une constante).
- Quand on rappelle la fenêtre via le raccourci, elle reprend le focus immédiatement.

### 4.4 Persistance et synchronisation fichier

- Fichier par défaut : `~/todo.txt`. Si absent, le créer vide au premier lancement.
- **Sauvegarde** : à chaque modification de la liste (toggle done, edit, ajout, suppression, changement de priorité, archivage). Pas de débounce nécessaire pour un fichier aussi petit, écrire de manière synchrone.
- **Reload externe** : surveiller le fichier avec `notify`. Si modifié de l'extérieur (autre éditeur, sync iCloud, etc.), recharger le contenu et rafraîchir l'UI. **Attention** : ignorer l'événement déclenché par sa propre écriture (comparer le contenu, ou utiliser un flag "dirty from us" pendant 200 ms après chaque write).
- **Reload aussi sur focus de la fenêtre** : par sécurité, recharger quand la fenêtre devient active.

---

## 5. Modes et raccourcis (spec complète)

L'app a **trois modes** comme Vim. Le mode courant est affiché dans le statusline en bas (`NORMAL`, `INSERT`, `COMMAND`).

### 5.1 Mode NORMAL (par défaut)

| Touche | Action |
|---|---|
| `j` / `↓` | Déplacer le curseur vers le bas |
| `k` / `↑` | Déplacer le curseur vers le haut |
| `g` `g` | Aller en haut de liste |
| `G` | Aller en bas de liste |
| `o` | Créer une nouvelle tâche **en dessous** du curseur, passer en INSERT |
| `O` | Créer une nouvelle tâche **au-dessus** du curseur, passer en INSERT |
| `i` | Éditer la tâche courante au début, passer en INSERT |
| `A` | Éditer la tâche courante à la fin, passer en INSERT |
| `x` | Toggle "fait" sur la tâche courante (ajoute/retire le `x ` initial et la date du jour) |
| `d` `d` | Supprimer la tâche courante |
| `p` `A`…`Z` | Définir la priorité (lettre majuscule). Ex : `pA` = priorité A. Accepter aussi minuscules et les remapper en majuscules. |
| `p` `p` | Retirer la priorité |
| `D` | Ouvrir un mini-prompt pour saisir la date d'échéance, l'ajoute comme `due:YYYY-MM-DD` |
| `+` | Ouvrir un mini-prompt pour ajouter un projet à la tâche courante (auto-préfixe avec `+`) |
| `@` | Idem pour un contexte |
| `/` | Mode recherche live (filtre l'affichage en tapant) |
| `:` | Entrer en mode COMMAND |
| `?` | Toggle l'overlay d'aide |
| `q` | Cacher la fenêtre (revient en barre de menu) |
| `Esc` | Annule une combinaison en cours / efface filtre / ferme overlay |

**Combinaisons multi-touches** : `gg`, `dd`, `pp`, `pA`…`pZ`. Implémenter avec un buffer de touches qui se reset après 800 ms d'inactivité ou après une touche non valide.

### 5.2 Mode INSERT

- Entrée via `o`, `O`, `i`, `A`.
- Saisie de texte standard. La ligne en cours d'édition est rendue comme un `<input>` ou un `<span contenteditable>` ; les autres restent en lecture seule.
- **`Esc`** : sortir d'INSERT, **sauvegarder automatiquement** la modification dans `~/todo.txt`, retour en NORMAL. Si la ligne est vide, supprimer la tâche.
- **`Enter`** : équivalent à `Esc` puis `o` (valide et crée une nouvelle ligne en dessous, reste en INSERT).
- **`Cmd+Z` / `Cmd+Shift+Z`** : undo / redo de la frappe (comportement natif suffit).
- Ne PAS gérer les raccourcis NORMAL pendant qu'on est en INSERT (sauf `Esc`).

### 5.3 Mode COMMAND (`:`)

Affichage d'un mini-buffer en bas (style Vim), saisie d'une commande, validation par `Enter`, annulation par `Esc`.

| Commande | Action |
|---|---|
| `:w` | Forcer la sauvegarde (sans effet utile vu l'auto-save, mais accepté pour l'habitude) |
| `:q` | Cacher la fenêtre |
| `:wq` | Sauvegarder + cacher |
| `:Q` | Quitter complètement l'app |
| `:archive` | Déplacer toutes les tâches `x ...` vers `~/done.txt` (à créer si absent), retirer du fichier courant |
| `:sort` | Trier : priorisées d'abord (A → Z), puis non priorisées par date de création décroissante, puis terminées en bas |
| `:filter <expr>` | Filtrer la vue. `expr` peut contenir plusieurs tokens : `@phone +Projet` filtre les tâches qui contiennent ces deux. `!@phone` exclut. |
| `:clear` | Efface le filtre actif |
| `:open` | Ouvre `~/todo.txt` dans Finder |
| `:help` | Toggle overlay d'aide |
| `:set file <chemin>` | Change le fichier source (persisté en config, voir §7.3) |

### 5.4 Mini-prompt

Pour `D`, `+`, `@`, `/`, et le mode COMMAND : afficher un input dans le statusline en bas. La saisie est isolée (pas de raccourci NORMAL pendant la saisie).

---

## 6. Architecture du projet

```
todo-modal/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/                          # Frontend TypeScript
│   ├── main.ts                   # Bootstrap + binding DOM
│   ├── style.css                 # Styles (transparence, layout)
│   ├── types.ts                  # Types Task, Mode, etc.
│   ├── parser.ts                 # parse() / serialize() todo.txt
│   ├── store.ts                  # État réactif + actions (toggleDone, addTask, etc.)
│   ├── vim.ts                    # Machine d'état modal + dispatcher de touches
│   ├── render.ts                 # Rendu DOM de la liste + statusline
│   ├── prompt.ts                 # Mini-prompt en bas (helper async)
│   └── api.ts                    # Bridge vers les commandes Tauri
├── src-tauri/                    # Backend Rust
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── icons/                    # icon.icns, tray-icon.png (template)
│   ├── capabilities/
│   │   └── default.json          # Permissions Tauri v2
│   └── src/
│       ├── main.rs               # Entry point (mince, appelle lib)
│       ├── lib.rs                # Setup Tauri, plugins, tray, hotkey, vibrancy
│       ├── commands.rs           # #[tauri::command] read_file, write_file, archive, open_in_finder
│       └── watcher.rs            # File watcher (notify) qui émet un event front
└── README.md
```

---

## 7. Spec backend Rust (détaillée)

### 7.1 `src-tauri/Cargo.toml`

```toml
[package]
name = "todo-modal"
version = "0.1.0"
edition = "2021"
rust-version = "1.77"

[lib]
name = "todo_modal_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["macos-private-api", "tray-icon", "image-png"] }
tauri-plugin-global-shortcut = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
dirs = "5"
notify = "6"
window-vibrancy = "0.5"

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```

### 7.2 `src-tauri/tauri.conf.json` — points clés

- `productName: "todo"` (ou autre)
- `identifier: "com.<toi>.todo-modal"` — à choisir, pas de mots réservés Apple.
- `app.macOSPrivateApi: true` — nécessaire pour la transparence/vibrancy.
- `app.windows[0]` :
  - `width: 480, height: 600, minWidth: 360, minHeight: 400`
  - `transparent: true`
  - `decorations: false`
  - `alwaysOnTop: true`
  - `visibleOnAllWorkspaces: true` (clé Tauri : `visible_on_all_workspaces` côté Rust API)
  - `titleBarStyle: "Overlay"`
  - `hiddenTitle: true`
  - `resizable: true`
  - `center: false` — on positionne à droite manuellement au setup
  - `url: "index.html"`, `label: "main"`
- `bundle.icon: ["icons/icon.icns"]`
- `bundle.macOS.minimumSystemVersion: "12.0"`

### 7.3 `src-tauri/src/lib.rs` — squelette

Fonction `pub fn run()` qui :
1. Crée le `tauri::Builder::default()`.
2. Enregistre le plugin global-shortcut avec un handler qui toggle la fenêtre sur `⌥⌘T`.
3. Dans le `setup` :
   - Récupère la window principale.
   - Applique `apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)`.
   - Sur macOS, configure la window comme "panel" (level `NSFloatingWindowLevel`) si nécessaire pour qu'elle reste au-dessus même quand l'app perd le focus. Tauri 2 a `set_always_on_top(true)` qui devrait suffire — vérifier ; sinon, passer par `objc2` directement avec `setLevel:`.
   - Configure `setActivationPolicy(NSApplicationActivationPolicyAccessory)` pour ne pas apparaître dans le Dock. En Tauri 2, c'est `app.set_activation_policy(tauri::ActivationPolicy::Accessory)`.
   - Construit le tray icon avec `TrayIconBuilder::new()...build(app)?` et son menu (cf. §4.2).
   - Démarre le file watcher (cf. `watcher.rs`) qui émet un event `"file-changed"` au front quand `~/todo.txt` est modifié de l'extérieur.
   - Positionne la fenêtre à droite de l'écran principal (récupérer `current_monitor`, calculer x/y).
4. `.invoke_handler(tauri::generate_handler![...])` avec les commandes de `commands.rs`.
5. `.run(tauri::generate_context!())`.

### 7.4 `src-tauri/src/commands.rs` — API exposée au front

Toutes signées `#[tauri::command]`, retour `Result<T, String>` :

- `get_default_path() -> String` → renvoie `~/todo.txt` résolu.
- `read_file(path: String) -> String` → lit le fichier UTF-8. Si absent, le crée vide et renvoie `""`.
- `write_file(path: String, content: String) -> ()` → écrit atomiquement (écrire dans `<path>.tmp` puis `rename`).
- `archive_done(source: String, archive: String) -> usize` → déplace les lignes commençant par `x ` du `source` vers `archive`, renvoie le nombre archivé.
- `open_in_finder(path: String) -> ()` → exécute `open -R <path>` (révèle dans Finder).
- `hide_window(window: tauri::Window) -> ()` / `show_window` / `toggle_window` → contrôlent la visibilité.
- `quit_app(app: tauri::AppHandle) -> ()`.

### 7.5 `src-tauri/src/watcher.rs`

- Lance un thread avec un `RecommendedWatcher` de `notify` qui surveille `~/todo.txt`.
- Sur événement `Modify`, lit le fichier et emit `app.emit("file-changed", content)` au front.
- **Anti-boucle** : maintenir un `AtomicU64` "last_self_write_at_ms". Avant d'émettre vers le front, vérifier que `now - last_self_write < 500ms` ⇒ ignorer. Mettre à jour ce timestamp dans `write_file`.

### 7.6 `src-tauri/capabilities/default.json`

Permissions minimales :
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "core:window:allow-set-always-on-top",
    "global-shortcut:default"
  ]
}
```

---

## 8. Spec frontend TypeScript (détaillée)

### 8.1 `src/types.ts`

```ts
export type Priority = 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J'|'K'|'L'|'M'|'N'|'O'|'P'|'Q'|'R'|'S'|'T'|'U'|'V'|'W'|'X'|'Y'|'Z';

export interface Task {
  raw: string;            // ligne brute originelle
  done: boolean;
  priority: Priority | null;
  completionDate: string | null; // YYYY-MM-DD
  creationDate: string | null;   // YYYY-MM-DD
  description: string;           // texte sans tags ni dates ni priorité
  projects: string[];            // sans le '+'
  contexts: string[];            // sans le '@'
  meta: Record<string, string>;  // due:..., pri:... etc
}

export type Mode = 'NORMAL' | 'INSERT' | 'COMMAND';
```

### 8.2 `src/parser.ts`

Deux fonctions pures :
- `parse(text: string): Task[]` — split par lignes (trim, ignore lignes vides), parse ligne par ligne selon les 5 règles du format (cf. §3 et fichier joint).
- `serialize(tasks: Task[]): string` — reconstruit le texte. **Important** : si la ligne brute n'a pas changé sémantiquement, garder `raw` tel quel pour préserver la mise en forme exacte de l'utilisateur.

Tests unitaires recommandés (à écrire) couvrant les exemples du fichier joint, notamment les cas "ce N'EST PAS une priorité / date / x".

### 8.3 `src/store.ts`

État global simple, pas de lib :
```ts
const state = {
  filePath: '~/todo.txt',
  tasks: [] as Task[],
  cursor: 0,                  // index dans tasks (après filtre)
  mode: 'NORMAL' as Mode,
  filter: null as Filter | null,
  search: '',
  buffer: '',                 // touches en attente (gg, dd, pA...)
  bufferTimer: null,
};
```
Et des actions : `toggleDone(idx)`, `addTaskBelow(idx)`, `addTaskAbove(idx)`, `deleteTask(idx)`, `setPriority(idx, p)`, `setDue(idx, date)`, `addProject(idx, name)`, `addContext(idx, name)`, `editLine(idx, newText)`, `archiveDone()`, `applyFilter(expr)`, `clearFilter()`.

Chaque action :
1. Modifie `state.tasks`.
2. Appelle `api.writeFile(state.filePath, serialize(state.tasks))`.
3. Appelle `render()`.

### 8.4 `src/vim.ts`

Une fonction `handleKey(e: KeyboardEvent)` qui dispatche selon `state.mode` :
- En NORMAL : implémente la table §5.1, gère le buffer multi-touches.
- En INSERT : laisse passer le texte ; intercepte `Esc` pour valider/sauver et `Enter` pour valider+nouvelle ligne.
- En COMMAND : gère la saisie du `:` puis parse et exécute la commande sur `Enter`.

Branche `keydown` au `document` (pas à un input spécifique) avec `preventDefault` quand on consomme la touche en NORMAL/COMMAND.

### 8.5 `src/render.ts`

`render()` :
- Vide la `<ul>`.
- Pour chaque tâche visible (après filtre/recherche), ajoute un `<li>` avec :
  - Classes CSS : `.done`, `.prio-a` à `.prio-z`, `.has-due-soon` (due dans les 3 jours), `.overdue` (due passée).
  - Le texte de la tâche, avec coloration des `+projet`, `@contexte`, `due:...` via des `<span>`.
  - Si c'est la ligne sous le curseur : classe `.cursor`.
  - Si on est en INSERT et que c'est la ligne courante : remplacer le span par un `<input>` (valeur = ligne brute, focus auto).
- Met à jour le statusline (mode, message, compteur "3/12").
- Met à jour l'indicateur de filtre dans le header s'il y en a un.

### 8.6 `src/api.ts`

Wrapper minimal autour de `@tauri-apps/api/core` `invoke()` :
```ts
export const api = {
  getDefaultPath: () => invoke<string>('get_default_path'),
  readFile: (path: string) => invoke<string>('read_file', { path }),
  writeFile: (path: string, content: string) => invoke<void>('write_file', { path, content }),
  archiveDone: (source: string, archive: string) => invoke<number>('archive_done', { source, archive }),
  openInFinder: (path: string) => invoke<void>('open_in_finder', { path }),
  hideWindow: () => invoke<void>('hide_window'),
  quitApp: () => invoke<void>('quit_app'),
};
```

Et écouter l'event `file-changed` :
```ts
import { listen } from '@tauri-apps/api/event';
listen<string>('file-changed', (e) => { state.tasks = parse(e.payload); render(); });
```

### 8.7 `src/style.css` — points clés

- `body` : fond `transparent`, pas de marge.
- Container principal : `background: rgba(28, 28, 30, 0.55)`, `backdrop-filter: blur(20px)` (au cas où vibrancy ne s'applique pas), `border-radius: 12px`, `border: 1px solid rgba(255,255,255,0.08)`.
- `header` : 32px de haut, `data-tauri-drag-region` côté HTML pour le déplacement, contient le titre.
- Police : `ui-monospace, 'SF Mono', monospace`, taille 13px.
- Couleurs des priorités : A rouge, B orange, C jaune, D vert, E+ gris. Gardable simple, paramétrable plus tard.
- Tâches `done` : opacité 0.4, `text-decoration: line-through`.
- `+projet` en bleu clair, `@contexte` en violet clair, `due:` en magenta.
- Statusline : 22px de haut, font 11px, fond `rgba(0,0,0,0.3)`.

---

## 9. Pièges connus / gotchas

### Tauri 2 vs documentation v1
- L'API `SystemTray` n'existe plus → utiliser `tauri::tray::TrayIconBuilder`.
- Les capabilities (permissions) sont obligatoires en v2, dans `src-tauri/capabilities/*.json`.
- L'invocation des commandes côté JS : `import { invoke } from '@tauri-apps/api/core'` (pas `'@tauri-apps/api/tauri'` qui est v1).
- Le plugin global-shortcut n'est plus dans le core, c'est `tauri-plugin-global-shortcut`.

### macOS — fenêtre flottante et activation policy
- Pour qu'une window reste au-dessus même quand l'app perd le focus : `set_always_on_top(true)` suffit en général. Si insuffisant, passer par `objc2` pour `setLevel: NSFloatingWindowLevel`.
- `ActivationPolicy::Accessory` cache l'icône du Dock. Doit être appliqué au tout début du setup.
- Pour que `Cmd+Tab` ne switche pas vers l'app, c'est l'`Accessory` qui s'en charge.

### Vibrancy
- `apply_vibrancy` doit être appelé **après** que la window soit créée et **avant** qu'elle soit affichée pour le rendu initial. Sinon, flash blanc.
- Nécessite `transparent: true` ET `macOSPrivateApi: true`.
- `NSVisualEffectMaterial::HudWindow` est sombre. `Sidebar` ou `WindowBackground` plus neutres.

### Drag region
- Côté HTML : `data-tauri-drag-region` sur l'élément. Tauri intercepte les clics dessus pour drag la fenêtre.
- **Conflit** : si tu mets ça sur tout le `body`, plus aucun clic ne passe sur les éléments enfants. Mets-le **uniquement** sur le header.
- Les `<input>` à l'intérieur d'un drag-region ne reçoivent pas de focus au clic. Donc : header drag-region OK, statusline non drag-region.

### Watcher `notify` et boucle de feedback
- L'écriture de l'app déclenche elle-même un événement `Modify`. Sans précaution, on a une boucle ou un re-render parasite.
- Solution simple : timestamp `last_self_write` côté Rust. Ignorer les events `< 500ms` après une écriture.
- Solution plus robuste : comparer le contenu lu avec celui qu'on vient d'écrire ; si identique, ignorer.

### Auto-save sur Esc
- L'utilisateur quitte INSERT par `Esc`. Il faut :
  1. Valider la valeur de l'input dans le state.
  2. Re-sérialiser et écrire le fichier.
  3. Re-rendre la liste.
  4. Repasser en NORMAL avec le curseur sur la même ligne.
- Si la ligne est vide après édition, supprimer la tâche (cohérent avec le format : pas de ligne vide stockée).

### Combinaisons multi-touches
- `gg` et `dd` impliquent un timeout. 800 ms est confortable. Reset le buffer sur n'importe quelle touche non valide ou sur `Esc`.

### Recherche (`/`) et filtre (`:filter`)
- Différence : recherche est temporaire et live, filtre est persistant jusqu'à `:clear`. Ne pas confondre dans le state.
- L'index `cursor` est sur la liste filtrée, pas sur `state.tasks` brut. Bien gérer la traduction d'index lors des actions.

---

## 10. Critères d'acceptation (à vérifier à la livraison)

L'app est considérée fonctionnelle quand **tous** les points suivants passent :

1. `pnpm install && pnpm tauri dev` lance l'app sans erreur.
2. La fenêtre apparaît centrée à droite, transparente avec effet blur, sans barre de titre native.
3. La fenêtre reste au-dessus de toutes les autres apps quand on clique ailleurs.
4. L'icône apparaît en barre de menu macOS (en haut à droite), pas dans le Dock.
5. `⌥⌘T` masque/affiche la fenêtre depuis n'importe quelle app.
6. Au lancement, le contenu de `~/todo.txt` (ou un fichier vide créé) s'affiche comme une liste.
7. `j`/`k` déplace le curseur. `gg`/`G` saute en haut/bas.
8. `o` crée une nouvelle ligne en INSERT, `Esc` la valide et l'écrit dans `~/todo.txt`.
9. `x` toggle le statut "fait" en ajoutant/retirant `x YYYY-MM-DD ` au début, sauvegarde immédiate.
10. `pA`…`pZ` change la priorité. `pp` la retire.
11. `dd` supprime la ligne sous le curseur.
12. `:archive` déplace les `x ...` vers `~/done.txt`.
13. `:filter @phone` filtre, `:clear` réinitialise.
14. Modifier `~/todo.txt` dans un autre éditeur (Vim, VS Code) met à jour la fenêtre dans la seconde.
15. La modif ne re-trigger PAS de boucle infinie dans le watcher.
16. `q` (en NORMAL) ou `:q` cache la fenêtre, qu'on peut rouvrir via raccourci ou clic sur l'icône menu bar.
17. `?` ouvre l'overlay d'aide listant tous les raccourcis.

---

## 11. Hors scope (v1)

Pour cadrer : ne PAS implémenter dans cette première version :
- Multi-fichiers / onglets.
- Édition multi-lignes (chaque tâche = une ligne).
- Synchronisation iCloud/Dropbox au-delà de "le fichier vit où l'utilisateur le pose".
- Notifications push pour les `due:`.
- Graphiques / statistiques.
- Mode sombre/clair distinct (le vibrancy s'adapte automatiquement à macOS).
- Configuration GUI (un fichier `~/.config/todo-modal/config.json` simple ira si besoin de persister le chemin du fichier).

---

## 12. Prompts de démarrage suggérés

### Pour Claude Code (à coller en premier message)

> Lis attentivement le fichier `SPEC.md` à la racine du projet. Tu vas implémenter cette application en respectant strictement la stack technique imposée (Tauri 2 + TS vanilla), la structure de fichiers (§6), et les comportements décrits. Commence par `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, puis le backend Rust complet (`src-tauri/`), enfin le frontend (`src/`). Avant chaque fichier, dis en une phrase ce que tu vas y mettre. Utilise `pnpm` comme gestionnaire de paquets. Quand le projet compile, lance `pnpm tauri dev` et corrige les erreurs jusqu'à ce que les critères §10 passent.

### Pour Copilot Chat

> @workspace J'ai un fichier `SPEC.md` qui décrit une app Tauri 2 + TS. Génère-moi les fichiers dans cet ordre : 1) configs racine, 2) `src-tauri/Cargo.toml` et `tauri.conf.json`, 3) `src-tauri/src/{main.rs,lib.rs,commands.rs,watcher.rs}`, 4) `src/{types.ts,parser.ts,store.ts,vim.ts,render.ts,prompt.ts,api.ts,main.ts,style.css}`. Pour chaque fichier, suis exactement les sections correspondantes de la spec.
