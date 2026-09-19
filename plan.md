# Haroopad modernization plan

Goal: keep Haroopad's functionality, remove the dead runtime and dead dependencies,
and produce a Linux executable (this PC: x86_64 Arch/EndeavourOS) and a Windows .exe
from a modern, maintainable code base.

## 1. What the scan found

**Runtime.** Haroopad 0.13.3 is an NW.js 0.12.3 app (2015 Chromium 41 / Node 0.12).
That runtime is what links against `libgconf-2-4`, `libudev0` and friends. The app
itself never calls gconf; the dependency disappears when the runtime is replaced.

**Shape of the code** (13.6k lines of app JS, 181 files, plus 204 MB of vendored libs):

| Window | Entry | Role |
|---|---|---|
| controller | `src/index.html` -> `js/app/*` | hidden window: menu factory, WindowManager, Recents, temp-file restore, Mailer, update check, presentation launcher, context menus |
| pad | `src/pad.html` -> `js/pad/*` | one per document: CodeMirror editor + `viewer.html` iframe preview, dialogs, export |
| preferences | `src/preferences.html` -> `js/preferences/*` | settings tabs, backup/restore, language pack |
| viewer | `src/viewer.html` -> `js/viewer/main.js` | iframe inside pad: markdown HTML, MathJax, highlight.js, mermaid, oEmbed |
| presentation | `src/box/presentation` | fullscreen slide window |

Cross-window coupling relies on NW.js's single shared JS context:

- children read `global.PATHS / THEMES / LOCALES / LANGS / Manifest / SHORTCUTS ...` set by the controller;
- children call `window.parent.ee.emit(...)` (controller's EventEmitter) and listen on it for `preferences.*` broadcasts;
- the controller attaches a Backbone `File` model to the child's `gui.Window` object (`newWin.file`) and calls `child.window.ee.emit(...)` directly;
- menus are built per window with `gui.Menu`/`gui.MenuItem` and their click handlers emit on `window.parent.ee`.

NW.js API surface actually used (so the port is bounded): `Window.get/open`, window props
`title x y width height isFullscreen zoomLevel menu`, methods `show hide focus close(force)
maximize enterFullscreen leaveFullscreen moveTo resizeTo setPosition setBadgeLabel showDevTools`,
events `close closed loaded focus blur enter-fullscreen leave-fullscreen`; `Menu`, `MenuItem`
(label, click, key, modifiers, submenu, separator, enabled); `App.manifest dataPath argv
closeAllWindows quit on('open'|'reopen') registerGlobalHotKey`; `Shortcut`; `Shell.openExternal/openItem/showItemInFolder`;
`Clipboard.get().set/get`; file inputs with `nwsaveas / nwworkingdir / nwdirectory`; `File.path` on drops.

**Dead or obsolete dependencies**

| Item | Problem | Replacement |
|---|---|---|
| NW.js 0.12.3 (gconf, libudev0) | dead runtime | Electron (current stable) |
| Grunt 0.4 + bower + `nwjc` snapshots + `*.bin.html` concat pipeline | dead toolchain, Mac-only paths hard-coded | npm scripts + electron-builder |
| `optimist` | abandoned | `minimist` |
| `readdir` 0.0.13 | abandoned | `fs.readdirSync` helper |
| `fs-extra` 0.12 | ancient | `fs-extra` 11 |
| `nodemailer` 1.3 | old API | `nodemailer` 7 |
| `pouchdb` 3 + `leveldown` native (needs nw-gyp) | never used (`db/DB` is commented out) | remove |
| `download-github-repo` | abandoned | remove; locales are bundled |
| `base62`, `humanize`, `mime` 1.2, `css` 2.1, `clean-css` 2.2, `moment` 2.8, `semver` 5 | old | small local helpers / current versions |
| `marked` (rhiokim fork) | custom syntax lives here | vendor the fork into `src/js/vendors/marked` (it is the product) |
| MathJax 2.4 (175 MB checked in) | bloat | prune to the files the viewer loads |
| highlight.js `build/highlight.pack.js` | missing from checkout | `highlight.js` 11 from npm + updated call sites |
| git submodules (locales, gemoji, ionicons, google-picker) | pinned to commits that no longer exist / unused | bundle locales into `src/locales`, drop the rest |
| Google Analytics iframe (`_gaq`), `pad.haroopress.com` update feed | dead endpoints, tracking | remove analytics; update check points at GitHub releases and fails silently |

## 2. Target architecture (Electron)

```
package.json            electron, @electron/remote, electron-builder, npm scripts
src/main/               main process
  main.js               lifecycle, single instance, argv, open-file, creates controller window
  globals.js            computes PATHS/THEMES/LOCALES/LANGS/SHORTCUTS once, serves them over sync IPC
  bus.js                IPC event bus: child -> controller, controller -> children (broadcast)
  smoke.js              HAROOPAD_SMOKE=1: log renderer console, run assertions, exit non-zero on errors
src/js/lib/gui/         "@haroopad/gui" local package: NW.js-shaped API over Electron
  index.js              Window.get/open, Menu, MenuItem, App, Shell, Clipboard, Shortcut
  bootstrap.js          loaded first in every HTML: sets global.*, window.parent shim, window.ee
src/index.html          controller (hidden BrowserWindow, nodeIntegration on)
src/pad.html            pad window (owns its File model now)
src/preferences.html    preferences window
src/viewer.html         unchanged iframe
src/locales/            bundled from haroopad-locales
```

Key design changes (everything else stays as it is):

1. **`require('nw.gui')` -> `require('@haroopad/gui')`** everywhere. The shim reproduces the
   NW.js surface listed above on top of `@electron/remote`, so menus, windows, clipboard and
   shell calls need no rewrite.
2. **Shared globals** are computed in the main process and pulled by every renderer with one
   sync IPC call at bootstrap. `global._gaq` becomes a no-op.
3. **Event bus**: `window.parent.ee` in children is an IPC proxy to the controller's `window.ee`.
   The controller re-broadcasts every event it receives to all other windows, which preserves
   the `preferences.*` fan-out. `controller -> one child` (`child.window.ee.emit`) goes over
   `webContents.send`.
4. **File model moves into the pad window.** WindowManager passes serialisable args
   (`fileEntry`, `tmp`, `readOnly`, `mode`, `forceOpen`); the pad constructs `File`/`Doc`/`Parser`
   itself and reports `file.opened / file.saved / file.changed` back with plain JSON. The
   parser (`core/*`) is loaded by the pad via a requirejs path alias.
5. **Native dialogs** replace `nwsaveas`/`nwworkingdir` file inputs (open, save, save-as, export HTML, custom theme dir).
6. **Dropped files** use `webUtils.getPathForFile`.
7. **Context menus** are built and popped in the pad window (client coordinates), not the controller.
8. **Presentation** window receives `{doc, file}` JSON over IPC and live updates via the bus.

## 3. Work breakdown

Phase 0 - scaffolding  **DONE**
- [x] root `package.json` (electron 44, @electron/remote, electron-builder, minimist, fs-extra, nodemailer 7, moment, clean-css 5, css 3, mime 3, highlight.js 11)
- [x] `src/main/{main,globals,smoke}.js`, `src/js/lib/gui/{index,bootstrap}.js`, bootstrap wiring in all four HTML pages
- [x] `require('nw.gui')` codemod across 78 call sites
- [x] locales bundled to `src/locales`, marked fork vendored to `src/js/vendors/marked`
- [x] verified end to end by `./scripts/smoke.sh`: pad opens, CodeMirror editor live,
      viewer renders (headings, bold, highlight.js, tasklist, MathJax), save to disk,
      preferences window opens and its changes reach the pad, menu bar built

Phase 1 - port  **DONE** (six parallel agents + integration)
- [x] A. WindowManager / controller <-> pad contract; document model moved into the pad window
- [x] B. Native file dialogs (open/save/save-as/export) replacing the NW.js `nwsaveas` file inputs; drops use `webUtils.getPathForFile`
- [x] C. Preferences window: `readdir` dropped, Backup export/import on native dialogs, language-pack downloader retired
- [x] D. Dependency swaps: nodemailer 7, mime 3, css 3, clean-css 5, fs-extra 11, moment 2.31; `base62`/`humanize`/`optimist`/`readdir` replaced with local helpers; pouchdb + the dead `app/ui` prototype removed
- [x] E. Context menus rebuilt and popped inside the pad window (all platform coordinate fudging gone); presentation window fed serialisable data over IPC
- [x] F. Update check moved to the GitHub releases API and fails silently; news feed and Google Analytics removed (60 call sites)
- [x] G. Grunt/bower/`*.bin.*`/`Info.plist` deleted, four submodules deregistered, locales bundled, MathJax pruned 175 MB -> 9.3 MB, emoji images vendored

Phase 2 - verification  **DONE**
- [x] `./scripts/smoke.sh` drives the real app through 16 assertions and fails on any renderer error
- [x] Passes in dev mode, from the packaged directory, and from the AppImage
- [x] Passes on a **fresh user profile** as well as a warm one (this is what caught the first-run bugs below)
- [x] `TESTING.md` lists what still needs a human (native dialogs, real drag & drop, printing, email)

Phase 3 - packaging  **DONE**
- [x] electron-builder config; Linux AppImage + tar.gz built and verified on this machine
- [x] `.github/workflows/build.yml` builds Linux and Windows and runs the smoke test under xvfb
- [x] Windows `.exe` built locally after all, via `npm run dist:win:docker` (electronuserland/builder:wine); produces the NSIS installer and the portable exe, both verified as PE32+ x86-64 binaries
- [ ] pacman target dropped: electron-builder's bundled fpm needs `libcrypt.so.1`, which current Arch does not ship (`libxcrypt-compat` would fix it)
- [ ] The Windows build has not been *run* anywhere; that needs a Windows machine (see `TESTING.md`)

## 3b. Bugs found and fixed along the way

These were latent in the NW.js code or introduced by the runtime change. Each is
now covered by an assertion in the smoke test.

| Bug | Effect | Where |
|---|---|---|
| `src/node_modules` shadowed the new dependencies | the renderer silently loaded 2015-era nodemailer/fs-extra/clean-css/css/mime/moment | removed the vendored tree |
| Renderer options never refreshed | fenced code kept the `lang-` class, so highlight.js never matched a language and **no code was ever highlighted on a fresh profile** | `core/Parser.js` |
| A partial preference broadcast replaced the whole option set | changing one markdown setting dropped the others | `core/Parser.js` |
| Parser captured settings at load | on first run the settings are written later, so math/tasks/highlighting stayed off for the session | `core/Parser.js` |
| Bus never echoed to the sending window | a pad that emitted `preferences.markdown.change` did not update its own parser (NW.js shared one context, so it used to) | `js/lib/gui/bootstrap.js` |
| `openning` latch never cleared | if the `actived` reply was late or lost, **File > New stopped working permanently** | `app/window/WindowManager.js` |
| `delyClose` typo | "Save" when closing an edited document saved but left the window open | `pad/window/Window.js` |
| Clearing a user theme passed `undefined` to the CSS parser | threw, leaving the old theme applied | `pad/editor/Editor.custom.js`, `pad/viewer/Viewer.userTheme.js` |
| 59 unguarded `WindowMgr.actived.window.ee.emit(...)` | a menu accelerator with no document open threw | `app/window/Window.js` |
| Email attachment keys were nodemailer 0.x names | inline images would never embed | `pad/viewer/Viewer.inlineStyleForEmail.js` |
| Emoji images were missing entirely | every `:smile:` rendered as a broken image | vendored into `src/img/emoji` |

## 4. Out of scope for this pass (follow-ups)
- Replacing vendored jQuery/Backbone/underscore/CodeMirror 4 with npm versions (pure JS, works as is)
- Newer mermaid / MathJax 3 (rendering behaviour changes)
- macOS packaging (electron-builder supports it; not tested here)
