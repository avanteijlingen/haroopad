'use strict';
/**
 * Per-window bootstrap. Loaded by every HTML entry point before the app code.
 *
 *   require('./js/lib/gui/bootstrap.js').controller()   // src/index.html
 *   require('./js/lib/gui/bootstrap.js').child()        // pad.html, preferences.html, ...
 *
 * Restores what NW.js gave every window for free:
 *   - the shared globals (PATHS, THEMES, LOCALES, ...),
 *   - `window.parent.ee` in child windows, an IPC proxy to the controller's bus,
 *   - `window.ee` broadcast from the controller to all windows.
 */
const EventEmitter = require('events');
const { ipcRenderer } = require('electron');
const gui = require('./index.js');

/* Vendor libraries use UMD detection: when `module`/`exports` exist as page
 * globals (Electron renderer with nodeIntegration) they export to CommonJS
 * instead of attaching to `window`. NW.js did not expose them, so drop them.
 * Node's `require` stays available; require.js only installs itself as the
 * global `require` when none exists, exactly like under NW.js. */
function prelude() {
  try { delete window.module; } catch (e) { window.module = undefined; }
  try { delete window.exports; } catch (e) { window.exports = undefined; }
}

function installGlobals() {
  prelude();
  const G = gui.globals();
  // In Electron's renderer `global` is the window object itself.
  ['PATHS', 'THEMES', 'LANGS', 'LOCALES', 'Manifest', 'SHORTCUTS', 'DATETIME', 'mdexts', 'argv',
    'EXECPATH', 'APPROOT', 'DATAPATH'].forEach(function (k) { global[k] = G[k]; });

  global.gui = gui;
  global.App = gui.App;
  global.Shell = gui.Shell;
  global.Clipboard = gui.Clipboard;
  global.dialogs = gui.dialogs;

  // Google Analytics was removed; keep the call sites harmless.
  global._gaq = { init: function (next) { next && next(null); }, push: function () {} };
  global._tracking = function () {};

  window.gui = gui;
  return G;
}

/* Makes an EventEmitter's emit tolerant of listener exceptions so one broken
 * handler does not kill the whole event chain. */
function safeEmit(ee) {
  const orig = ee.emit;
  ee.emit = function (evt) {
    try { return orig.apply(this, arguments); } catch (err) { console.error('[ee:' + evt + ']', err); return false; }
  };
  return ee;
}

function controller() {
  const G = installGlobals();
  const ee = safeEmit(new EventEmitter());
  ee.setMaxListeners(0);
  const localEmit = ee.emit;

  // Every event on the controller bus is also broadcast to the windows, which
  // is how `window.parent.ee.on('preferences.*')` in pads keeps working.
  //
  // The broadcast deliberately includes the window the event came FROM. Under
  // NW.js all windows shared one JS context, so a pad that emitted
  // `preferences.markdown.change` also ran its own listener for it (that is
  // how the markdown parser inside the pad rebuilds its lexer). Excluding the
  // sender broke that silently. Loops are prevented instead by not
  // re-broadcasting an event that arrived from a window (`__relaying`).
  ee.emit = function (evt) {
    const args = [].slice.call(arguments, 1);
    const relaying = ee.__relaying;
    const handled = localEmit.apply(ee, [evt].concat(args));
    if (!relaying) {
      try { ipcRenderer.send('bus:broadcast', evt, args, 0); } catch (e) { /* not serialisable */ }
    }
    return handled;
  };

  ipcRenderer.on('bus:event', function (e, evt, args, senderId) {
    // Run the controller's own listeners, then fan the event out to every
    // window (including the sender) exactly once.
    ee.__relaying = true;
    try {
      ee.emit.apply(ee, [evt].concat(args || []));
    } finally {
      ee.__relaying = false;
    }
    try { ipcRenderer.send('bus:broadcast', evt, args || [], 0); } catch (e) { /* not serialisable */ }
  });

  ipcRenderer.on('bus:keydown', function (e, init) {
    try { window.dispatchEvent(new KeyboardEvent('keydown', init)); } catch (err) { /* ignore */ }
  });

  window.ee = ee;
  window.nw = gui.Window.get();
  return G;
}

function child() {
  const G = installGlobals();
  const nw = gui.Window.get();

  const local = safeEmit(new EventEmitter());
  local.setMaxListeners(0);

  const parentEE = {
    emit: function (evt) {
      try { ipcRenderer.send('bus:to-controller', evt, [].slice.call(arguments, 1)); } catch (e) { console.error(e); }
      return true;
    },
    on: function (evt, fn) { local.on(evt, fn); return this; },
    once: function (evt, fn) { local.once(evt, fn); return this; },
    off: function (evt, fn) { local.removeListener(evt, fn); return this; },
    removeListener: function (evt, fn) { local.removeListener(evt, fn); return this; },
    addListener: function (evt, fn) { local.on(evt, fn); return this; },
    removeAllListeners: function (evt) { local.removeAllListeners(evt); return this; },
    listeners: function (evt) { return local.listeners(evt); }
  };

  ipcRenderer.on('bus:event', function (e, evt, args) {
    local.emit.apply(local, [evt].concat(args || []));
  });

  // controller -> this window's own bus (`child.window.ee.emit(...)`)
  ipcRenderer.on('win:ee', function (e, evt, args) {
    if (window.ee) window.ee.emit.apply(window.ee, [evt].concat(args || []));
  });

  const parentShim = {
    ee: parentEE,
    dispatchEvent: function (evt) {
      if (!evt) return true;
      try {
        ipcRenderer.send('bus:keydown', {
          key: evt.key, code: evt.code, keyCode: evt.keyCode, which: evt.which,
          altKey: evt.altKey, ctrlKey: evt.ctrlKey, shiftKey: evt.shiftKey, metaKey: evt.metaKey
        });
      } catch (e) { /* ignore */ }
      return true;
    },
    focus: function () {},
    get activedWindow() { return nw; }
  };

  try { window.parent = parentShim; } catch (e) { window.__parent = parentShim; }
  nw.parent = parentShim;
  window.nw = nw;
  return G;
}

module.exports = { controller: controller, child: child, gui: gui };
