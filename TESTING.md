# Manual test checklist

`./scripts/smoke.sh` covers the automated path (see the list at the bottom).
On Windows run `build.bat smoke` instead; the packaged app has no console there,
so set `HAROOPAD_SMOKE_OUT=<file>` to read the report. Clear `ELECTRON_RUN_AS_NODE`
before any smoke run: with it set the app starts as plain Node and exits 0, which
looks exactly like a pass. `build.bat` and `smoke.sh` both clear it for you.
Everything below needs a human, mostly because it opens a native modal dialog
or depends on real input devices or network services.

Run the app with `npm start`.

## File handling
- [ ] **Open** (Ctrl+O): native dialog appears, markdown filter is sensible, chosen file opens in a window.
- [ ] Opening a file that is **already open** focuses the existing window instead of opening a second one.
- [ ] Opening a file from an **empty, untouched** window re-uses that window rather than opening a new one.
- [ ] **Save** (Ctrl+S) on a new document prompts for a path; on an existing document writes silently.
- [ ] **Save As** (Ctrl+Shift+S) pre-fills `<name> copy.md` and starts in the document's directory.
- [ ] Closing a **modified** document offers Save / Don't Save / Cancel, and "Save" both saves *and* closes.
      (The NW.js version had a typo here that left the window open.)
- [ ] **Recent files** menu lists previously opened documents and opens them.
- [ ] Crash/quit with unsaved content, restart: the document is **restored** from the temp store.
- [ ] Launch from a terminal with a file argument: `haroopad README.md`.
- [ ] Launch a **second instance** while one is running: the file opens in the existing instance.

## Editor and preview
- [ ] Typing updates the preview live.
- [ ] Syntax highlighting in fenced code blocks (highlight.js 11 replaced the 2015 build).
- [ ] Math: `$$$inline$$$` and a `$$ ... $$` block, with **Markdown > Math** enabled in preferences.
- [ ] Mermaid diagrams (flowchart, sequence).
- [ ] Task lists: clicking a checkbox in the preview edits the markdown source.
- [ ] Table of contents / outline view.
- [ ] Vim key bindings toggle.
- [ ] Editor and viewer font size shortcuts.
- [ ] Sync scrolling between editor and preview.

## Drag and drop  (`File.path` was removed by Chromium; now uses `webUtils.getPathForFile`)
- [ ] Drop an **image** into the editor: inserts markdown with a path relative to the document.
- [ ] Drop a **.md/.txt** file: opens it in a window.
- [ ] Drop a PDF or other file type.
- [ ] Drop **selected text from a browser**: converts HTML to markdown.

## Export and sharing
- [ ] **Export HTML**: dialog appears, output is a standalone styled file. Check a document
      with images, embedded media and a code block. (clean-css went 2.x -> 5.x, whose
      `.minify()` returns an object; a regression here shows up as *unstyled* output.)
- [ ] **Print** the preview.
- [ ] Copy as **plain HTML** and as **styled HTML** to the clipboard, pasted into a rich text editor.
- [ ] **Email**: needs real SMTP credentials. Note that Gmail now requires an
      **App Password** (Google removed "less secure app access" in 2022), so an
      ordinary account password will fail regardless of this port.
      Check inline images embed (`cid:` attachments).

## Windows, menus, preferences
- [ ] Right-click in the **editor**: context menu appears at the pointer with cut/copy/paste/themes.
- [ ] Right-click in the **preview**: its own context menu.
- [ ] Preferences: each tab applies immediately to open documents.
- [ ] Preferences > Backup: **export** settings to JSON and **import** them back.
- [ ] User themes: drop a `.css` into the themes folder, hit Reload, select it, see it applied.
      Then clear it again (this used to throw).
- [ ] "Open theme folder" reveals the file in the system file manager.
- [ ] Presentation mode (Tools > Presentation), including Escape to exit.
- [ ] Fullscreen enter/exit, and that window size/position persist across restarts.
- [ ] Multiple windows: each has an independent document.

## Packaging
- [ ] `npm run dist:linux` then run the AppImage on a clean machine.
- [ ] Double-click a `.md` file in a file manager: opens in Haroopad (file association).
- [ ] `npm run dist:win` (or the CI artifact): installer runs, app launches, uninstaller works.

## What the automated smoke test already covers
`padOpened`, `editorReady`, `viewerRendered`, `codeHighlighted`, `taskList`,
`mathRendered`, `saved`, `titleUpdated`, `preferencesOpened`, `preferenceApplied`,
`emptyUserThemeSafe`, `menuBuilt`, `secondPadOpened`, `activeWindowTracked`,
`independentDocuments`, `closeTracked`, `mermaidRendered`, plus "no renderer errors in any window".

`node scripts/check-packaged-assets.js` is a separate check, run by `build.bat`
after each build: it fails if any file an HTML page loads was dropped from the
asar by the packaging globs. That failure mode is invisible at startup and cost
a long hunt once already.
