'use strict';
/**
 * NW.js-shaped `gui` API implemented on Electron.
 *
 * Haroopad was written against `require('./js/lib/gui')`: Window.get()/open(), Menu,
 * MenuItem, App, Shell, Clipboard, Shortcut. This module reproduces exactly the
 * subset the app uses so the UI code did not have to be rewritten.
 *
 * Cross-window semantics:
 *   - `win.emit(evt)` fires local listeners AND the counterpart side (the opener
 *     for the current window, or the window itself for a wrapper held by the
 *     controller). Arguments must be serialisable.
 *   - `wrapper.window.ee.emit(evt)` from the controller targets that window's
 *     own `window.ee`.
 */
const EventEmitter = require('events');
const path = require('path');
const electron = require('electron');
const remote = require('@electron/remote');

const ipc = electron.ipcRenderer;
const webFrame = electron.webFrame;

const APP_DIR = __dirname.replace(/[\\/]js[\\/]lib[\\/]gui$/, '');

/* ------------------------------------------------------------------ Window */

const registry = {};      // id -> Win
let current = null;

const NATIVE_EVENTS = ['close', 'closed', 'focus', 'blur', 'loaded', 'enter-fullscreen', 'leave-fullscreen',
  'maximize', 'unmaximize', 'minimize', 'restore', 'move', 'resize'];

class Win extends EventEmitter {
  constructor(bw, isCurrent) {
    super();
    this.setMaxListeners(0);
    this._bw = bw;
    this.id = bw.id;
    this._isCurrent = !!isCurrent;
    this._menu = null;
    this._args = isCurrent ? (ipc.sendSync('win:args', this.id) || {}) : {};
    registry[this.id] = this;

    if (isCurrent) {
      this.window = window;
    } else {
      const self = this;
      // Proxy for the other window's DOM window: only the event bus is reachable.
      this.window = {
        ee: {
          emit: function (evt) {
            ipc.send('win:ee', self.id, evt, [].slice.call(arguments, 1));
            return true;
          }
        },
        focus: function () { self.focus(); },
        close: function () { self.close(); }
      };
    }
  }

  /* --- args handed from opener to the new window --- */
  get _args() { return this.__args; }
  set _args(v) {
    this.__args = v || {};
    if (!this._isCurrent) ipc.send('win:set-args', this.id, this.__args);
  }

  /* --- geometry & state --- */
  get x() { return this._bw.getBounds().x; }
  set x(v) { this.moveTo(v, this.y); }
  get y() { return this._bw.getBounds().y; }
  set y(v) { this.moveTo(this.x, v); }
  get width() { return this._bw.getBounds().width; }
  set width(v) { this.resizeTo(v, this.height); }
  get height() { return this._bw.getBounds().height; }
  set height(v) { this.resizeTo(this.width, v); }
  get isFullscreen() { return this._bw.isFullScreen(); }
  get isMaximized() { return this._bw.isMaximized(); }

  get title() { return this._isCurrent ? document.title : this._bw.getTitle(); }
  set title(v) {
    if (this._isCurrent) document.title = v;
    try { this._bw.setTitle(String(v)); } catch (e) { /* ignore */ }
  }

  get zoomLevel() { return this._isCurrent ? webFrame.getZoomLevel() : this._bw.webContents.getZoomLevel(); }
  set zoomLevel(v) {
    if (this._isCurrent) webFrame.setZoomLevel(Number(v) || 0);
    else this._bw.webContents.setZoomLevel(Number(v) || 0);
  }
  get zoom() { return this.zoomLevel; }
  set zoom(v) { this.zoomLevel = v; }

  get menu() { return this._menu; }
  set menu(m) {
    this._menu = m;
    const built = m ? m._build() : null;
    if (process.platform === 'darwin') {
      remote.Menu.setApplicationMenu(built);
    } else {
      this._bw.setMenu(built);
    }
  }

  /* --- actions --- */
  show() { this._bw.show(); }
  hide() { this._bw.hide(); }
  focus() { this._bw.focus(); if (this._isCurrent) window.focus(); }
  blur() { this._bw.blur(); }
  minimize() { this._bw.minimize(); }
  maximize() { this._bw.maximize(); }
  unmaximize() { this._bw.unmaximize(); }
  restore() { this._bw.restore(); }
  enterFullscreen() { this._bw.setFullScreen(true); }
  leaveFullscreen() { this._bw.setFullScreen(false); }
  toggleFullscreen() { this._bw.setFullScreen(!this._bw.isFullScreen()); }
  enterKioskMode() { this._bw.setKiosk(true); }
  leaveKioskMode() { this._bw.setKiosk(false); }
  moveTo(x, y) { this._bw.setPosition(Math.round(x), Math.round(y)); }
  moveBy(dx, dy) { this.moveTo(this.x + dx, this.y + dy); }
  resizeTo(w, h) { if (w > 0 && h > 0) this._bw.setSize(Math.round(w), Math.round(h)); }
  resizeBy(dw, dh) { this.resizeTo(this.width + dw, this.height + dh); }
  setPosition(pos) { if (pos === 'center') this._bw.center(); }
  setMinimumSize(w, h) { this._bw.setMinimumSize(w, h); }
  setMaximumSize(w, h) { this._bw.setMaximumSize(w, h); }
  setResizable(b) { this._bw.setResizable(!!b); }
  setAlwaysOnTop(b) { this._bw.setAlwaysOnTop(!!b); }
  setShowInTaskbar(b) { this._bw.setSkipTaskbar(!b); }
  requestAttention(b) { this._bw.flashFrame(!!b); }
  setBadgeLabel(label) { ipc.send('app:set-badge', label === '' ? 0 : Number(label) || 0); }
  showDevTools() { this._bw.webContents.openDevTools({ mode: 'detach' }); }
  closeDevTools() { this._bw.webContents.closeDevTools(); }
  reload() { this._bw.webContents.reload(); }
  reloadIgnoringCache() { this._bw.webContents.reloadIgnoringCache(); }
  print(opts) { this._bw.webContents.print(opts || {}); }
  capturePage(cb) { this._bw.webContents.capturePage().then(function (img) { cb(img.toDataURL()); }); }

  /**
   * NW.js semantics: close() fires the `close` event so listeners can veto;
   * close(true) really closes the window.
   */
  close(force) {
    if (force) {
      ipc.send('win:force-close', this.id);
    } else if (this.listenerCount('close') > 0) {
      this._dispatch('close');
    } else {
      ipc.send('win:force-close', this.id);
    }
  }

  /* local-only dispatch (used when an event arrives from the other side) */
  _dispatch(evt) {
    const args = [].slice.call(arguments, 1);
    return EventEmitter.prototype.emit.apply(this, [evt].concat(args));
  }

  /* emit locally and on the counterpart side */
  emit(evt) {
    const args = [].slice.call(arguments, 1);
    const handled = this._dispatch.apply(this, [evt].concat(args));
    if (NATIVE_EVENTS.indexOf(evt) > -1 && evt !== 'close') return handled;
    try {
      ipc.send('win:emit', this.id, evt, args);
    } catch (e) {
      /* non-serialisable payload stays local */
    }
    return handled;
  }

  static get() {
    if (current) return current;
    current = new Win(remote.getCurrentWindow(), true);
    return current;
  }

  /**
   * Open a new window. Accepts the NW.js manifest-style options object.
   * Returns synchronously, like NW.js 0.12.
   */
  static open(url, opts) {
    opts = opts || {};
    const width = opts.width > 0 ? opts.width : 1000;
    const height = opts.height > 0 ? opts.height : 700;

    const bw = new remote.BrowserWindow({
      show: false,
      width: width,
      height: height,
      minWidth: opts.min_width || 0,
      minHeight: opts.min_height || 0,
      resizable: opts.resizable !== false,
      frame: opts.frame !== false,
      fullscreen: !!opts.fullscreen,
      title: opts.title || 'Haroopad',
      icon: path.join(APP_DIR, opts.icon || 'logo.png'),
      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        nodeIntegrationInSubFrames: true,
        sandbox: false,
        spellcheck: false
      }
    });

    if (opts.position === 'center') bw.center();

    // remove any default menu until the window installs its own
    if (process.platform !== 'darwin') bw.setMenu(null);

    const wrapper = new Win(bw, false);
    if (opts.args) wrapper._args = opts.args;

    const href = /^[a-z]+:/i.test(url) ? url : new URL(url, window.location.href).href;
    bw.loadURL(href);

    if (opts.show !== false) bw.show();
    return wrapper;
  }

  static getAll() {
    return Object.keys(registry).map(function (id) { return registry[id]; });
  }
}

/* Events coming from the main process: native window events and cross-window emits. */
ipc.on('win:native', function (e, id, evt, args) {
  const w = registry[id];
  if (!w) return;
  if (evt === 'close') {
    if (w._isCurrent) {
      if (w.listenerCount('close') > 0) w._dispatch('close');
      else w.close(true);
    }
    // a wrapper in the controller does not act on native close; it waits for `closed`
    return;
  }
  w._dispatch.apply(w, [evt].concat(args || []));
  if (evt === 'closed') delete registry[id];
});

ipc.on('win:event', function (e, id, evt, args) {
  const w = registry[id];
  if (w) w._dispatch.apply(w, [evt].concat(args || []));
});

/* ------------------------------------------------------------------ Menu */

const KEY_MAP = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', end: 'End', home: 'Home',
  enter: 'Return', 'return': 'Return', esc: 'Escape', escape: 'Escape', backspace: 'Backspace',
  'delete': 'Delete', del: 'Delete', tab: 'Tab', space: 'Space', pageup: 'PageUp', pagedown: 'PageDown',
  insert: 'Insert'
};

function toAccelerator(key, modifiers) {
  if (!key) return undefined;
  const mods = String(modifiers || '').split('-').filter(Boolean).map(function (m) {
    switch (m.toLowerCase()) {
      case 'cmd': case 'command': return 'CommandOrControl';
      case 'ctrl': case 'control': return 'Ctrl';
      case 'shift': return 'Shift';
      case 'alt': case 'option': return 'Alt';
      case 'super': case 'meta': return 'Super';
      default: return null;
    }
  }).filter(Boolean);

  const k = String(key);
  const name = KEY_MAP[k.toLowerCase()] || (/^f\d{1,2}$/i.test(k) ? k.toUpperCase() : (k.length === 1 ? k.toUpperCase() : null));
  if (!name) return undefined;
  // a bare printable key or Escape as an app-wide accelerator would swallow typing
  if (!mods.length && !/^F\d{1,2}$/.test(name)) return undefined;
  return mods.concat([name]).join('+');
}

class MenuItem {
  constructor(opts) {
    opts = opts || {};
    this.type = opts.type || 'normal';
    this.label = opts.label;
    this.icon = opts.icon;
    this.tooltip = opts.tooltip;
    this.click = opts.click;
    this.enabled = opts.enabled !== false;
    this.checked = !!opts.checked;
    this.submenu = opts.submenu || null;
    this.key = opts.key;
    this.modifiers = opts.modifiers;
  }

  _template() {
    if (this.type === 'separator') return { type: 'separator' };
    const self = this;
    const t = {
      label: this.label == null ? '' : String(this.label),
      enabled: this.enabled,
      accelerator: toAccelerator(this.key, this.modifiers)
    };
    if (this.type === 'checkbox' || this.type === 'radio') {
      t.type = this.type;
      t.checked = this.checked;
    }
    if (this.submenu) {
      t.submenu = this.submenu._template();
    } else if (typeof this.click === 'function') {
      t.click = function (item) {
        if (item && (self.type === 'checkbox' || self.type === 'radio')) self.checked = !!item.checked;
        try { self.click(); } catch (err) { console.error(err); }
      };
    }
    return t;
  }
}

class Menu {
  constructor(opts) {
    this.type = (opts && opts.type) || 'contextmenu';
    this.items = [];
    this._macBuiltin = null;
  }
  append(item) { this.items.push(item); }
  insert(item, idx) { this.items.splice(idx, 0, item); }
  remove(item) { const i = this.items.indexOf(item); if (i > -1) this.items.splice(i, 1); }
  removeAt(i) { this.items.splice(i, 1); }
  createMacBuiltin(appName, opts) {
    this._macBuiltin = { appName: appName, opts: opts || {} };
    // Application menu + Edit menu + Window menu, like NW.js did.
    this.items.push(new MenuItem({ label: appName, submenu: Menu._fromTemplate([
      { role: 'about' }, { type: 'separator' }, { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }
    ]) }));
    if (!opts || !opts.hideEdit) {
      this.items.push(new MenuItem({ label: 'Edit', submenu: Menu._fromTemplate([
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]) }));
    }
    if (!opts || !opts.hideWindow) {
      this.items.push(new MenuItem({ label: 'Window', submenu: Menu._fromTemplate([
        { role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }
      ]) }));
    }
  }
  static _fromTemplate(tpl) {
    const m = new Menu();
    m._raw = tpl;
    return m;
  }
  _template() {
    if (this._raw) return this._raw;
    return this.items.map(function (i) { return i._template(); });
  }
  _build() { return remote.Menu.buildFromTemplate(this._template()); }

  /** popup at client coordinates of the current window */
  popup(x, y) {
    const built = this._build();
    built.popup({ window: remote.getCurrentWindow(), x: Math.round(x), y: Math.round(y) });
  }
}

/* ------------------------------------------------------------------ App / Shell / Clipboard */

let globalsCache = null;
function G() {
  if (!globalsCache) globalsCache = ipc.sendSync('haroopad:globals');
  return globalsCache;
}

class Shortcut extends EventEmitter {
  constructor(opts) {
    super();
    this.key = opts.key;
    this.active = opts.active;
    this.failed = opts.failed;
  }
}

const App = {
  get manifest() { return G().Manifest; },
  get dataPath() { return G().DATAPATH; },
  get argv() { return G().argv._; },
  get fullArgv() { return G().argv; },
  closeAllWindows: function () { ipc.send('app:close-all'); },
  quit: function () { ipc.send('app:quit'); },
  on: function (evt, cb) {
    if (evt === 'open') {
      ipc.on('app:open', function (e, files, opts) { (files || []).forEach(function (f) { cb(f, opts || {}); }); });
    } else if (evt === 'reopen') {
      ipc.on('app:reopen', function () { cb(); });
    }
  },
  registerGlobalHotKey: function (sc) {
    try {
      const acc = String(sc.key).replace(/\+/g, '+');
      remote.globalShortcut.register(acc, function () { sc.active && sc.active(); });
    } catch (e) { sc.failed && sc.failed(String(e)); }
  },
  unregisterGlobalHotKey: function (sc) {
    try { remote.globalShortcut.unregister(String(sc.key)); } catch (e) { /* ignore */ }
  },
  clearCache: function () { remote.getCurrentWebContents().session.clearCache(); }
};

const Shell = {
  openExternal: function (url) { return electron.shell.openExternal(url); },
  openItem: function (p) { return electron.shell.openPath(p); },
  showItemInFolder: function (p) { electron.shell.showItemInFolder(p); }
};

const Clipboard = {
  get: function () {
    return {
      set: function (data, type) {
        if (type === 'html') electron.clipboard.writeHTML(String(data));
        else electron.clipboard.writeText(String(data));
      },
      get: function (type) {
        return type === 'html' ? electron.clipboard.readHTML() : electron.clipboard.readText();
      },
      clear: function () { electron.clipboard.clear(); }
    };
  }
};

/* Native dialogs replacing NW.js `nwsaveas` / `nwworkingdir` file inputs. */
const dialogs = {
  /** returns the chosen path or undefined */
  save: function (opts) {
    opts = opts || {};
    return remote.dialog.showSaveDialogSync(remote.getCurrentWindow(), {
      title: opts.title,
      defaultPath: opts.defaultPath || (opts.dir && opts.name ? path.join(opts.dir, opts.name) : opts.dir),
      filters: opts.filters
    });
  },
  /** returns an array of paths (possibly empty) */
  open: function (opts) {
    opts = opts || {};
    const props = opts.properties || ['openFile'];
    if (opts.multiple && props.indexOf('multiSelections') < 0) props.push('multiSelections');
    return remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
      title: opts.title,
      defaultPath: opts.defaultPath || opts.dir,
      filters: opts.filters,
      properties: props
    }) || [];
  },
  directory: function (opts) {
    opts = opts || {};
    return (remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
      title: opts.title,
      defaultPath: opts.defaultPath || opts.dir,
      properties: ['openDirectory', 'createDirectory']
    }) || [])[0];
  },
  message: function (opts) {
    return remote.dialog.showMessageBoxSync(remote.getCurrentWindow(), opts || {});
  }
};

/** path of a dropped File (File.path was removed from Chromium) */
function pathForFile(file) {
  try { return electron.webUtils.getPathForFile(file); } catch (e) { return file && file.path; }
}

module.exports = {
  Window: Win,
  Menu: Menu,
  MenuItem: MenuItem,
  Shortcut: Shortcut,
  App: App,
  Shell: Shell,
  Clipboard: Clipboard,
  dialogs: dialogs,
  pathForFile: pathForFile,
  toAccelerator: toAccelerator,
  globals: G,
  APP_DIR: APP_DIR
};
