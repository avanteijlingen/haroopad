'use strict';
/**
 * Haroopad main process.
 *
 * The renderer code was written for NW.js, where every window shared one Node
 * context. Here the main process only does three things:
 *   1. computes the shared globals (globals.js) and serves them over sync IPC,
 *   2. routes events between windows (bus / win channels),
 *   3. owns lifecycle: single instance, file-open requests, quit.
 * All UI logic still lives in the renderer windows, on top of the `gui` shim.
 */
const path = require('path');
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const remoteMain = require('@electron/remote/main');
const globals = require('./globals');

const SMOKE = !!process.env.HAROOPAD_SMOKE;
const DEV = !app.isPackaged;

let controller = null;            // hidden controller window (src/index.html)
const winArgs = new Map();        // BrowserWindow id -> serialisable args set by the opener
const pendingSends = new Map();   // webContents id -> queued messages until did-finish-load
const loaded = new Set();         // webContents ids that finished loading

remoteMain.initialize();

// The original app shipped with --disable-gpu; software rendering is also what
// the smoke test needs on headless/sandboxed machines.
if (SMOKE || process.env.HAROOPAD_DISABLE_GPU) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}

/* ------------------------------------------------------------------ helpers */

function send(wc, channel, ...args) {
  if (!wc || wc.isDestroyed()) return;
  if (!loaded.has(wc.id)) {
    if (!pendingSends.has(wc.id)) pendingSends.set(wc.id, []);
    pendingSends.get(wc.id).push([channel, args]);
    return;
  }
  try { wc.send(channel, ...args); } catch (e) { /* window went away */ }
}

function controllerSend(channel, ...args) {
  if (controller && !controller.isDestroyed()) send(controller.webContents, channel, ...args);
}

function log() {
  if (SMOKE || DEV) console.log.apply(console, ['[main]'].concat([].slice.call(arguments)));
}

/* Relay native window events to (a) the window itself and (b) the controller,
 * using NW.js event names. The `close` event is intercepted: renderer code
 * decides whether the window really closes (save dialogs) and then calls
 * win.close(true). */
function attachWindow(win) {
  const wc = win.webContents;
  const id = win.id;
  win.__forceClose = false;

  const relay = function (nwEvent, ...args) {
    if (!win.isDestroyed()) send(wc, 'win:native', id, nwEvent, args);
    if (controller && win !== controller) controllerSend('win:native', id, nwEvent, args);
  };

  win.on('close', function (e) {
    if (win.__forceClose) return;
    e.preventDefault();
    if (loaded.has(wc.id)) {
      relay('close');
    } else {
      win.__forceClose = true;
      win.close();
    }
  });
  win.on('closed', function () {
    winArgs.delete(id);
    pendingSends.delete(wc.id);
    loaded.delete(wc.id);
    if (controller && !controller.isDestroyed() && win !== controller) {
      controllerSend('win:native', id, 'closed', []);
    }
  });
  win.on('focus', function () { relay('focus'); });
  win.on('blur', function () { relay('blur'); });
  win.on('enter-full-screen', function () { relay('enter-fullscreen'); });
  win.on('leave-full-screen', function () { relay('leave-fullscreen'); });
  win.on('maximize', function () { relay('maximize'); });
  win.on('unmaximize', function () { relay('unmaximize'); });
  win.on('minimize', function () { relay('minimize'); });
  win.on('restore', function () { relay('restore'); });
  win.on('move', function () { relay('move', win.getPosition()[0], win.getPosition()[1]); });
  win.on('resize', function () { relay('resize', win.getSize()[0], win.getSize()[1]); });

  wc.on('did-finish-load', function () {
    loaded.add(wc.id);
    const queue = pendingSends.get(wc.id) || [];
    pendingSends.delete(wc.id);
    queue.forEach(function (m) { try { wc.send(m[0], ...m[1]); } catch (e) { /* ignore */ } });
    relay('loaded');
  });

  wc.on('console-message', function (ev) {
    if (SMOKE || DEV) {
      const level = ev.level, message = ev.message, line = ev.lineNumber, sourceId = ev.sourceId;
      console.log('[' + (win === controller ? 'controller' : 'win' + id) + ':' + level + '] ' + message +
        (sourceId ? '  (' + path.basename(String(sourceId)) + ':' + line + ')' : ''));
    }
  });
  wc.on('render-process-gone', function (e, details) {
    console.error('[main] renderer gone', id, details);
  });

  // Open external links from the viewer in the browser instead of a new Electron window.
  wc.setWindowOpenHandler(function (details) {
    const url = details.url || '';
    if (/^https?:/i.test(url)) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });
}

/* ------------------------------------------------------------------ IPC */

ipcMain.on('haroopad:globals', function (e) {
  e.returnValue = globals.compute();
});

ipcMain.on('haroopad:controller-id', function (e) {
  e.returnValue = controller ? controller.webContents.id : null;
});

/* window args (WindowManager passes file info to the new pad window) */
ipcMain.on('win:set-args', function (e, id, args) { winArgs.set(id, args || {}); });
ipcMain.on('win:args', function (e, id) { e.returnValue = winArgs.get(id) || {}; });

/* window.emit(...) on one side -> counterpart side */
ipcMain.on('win:emit', function (e, id, evt, args) {
  const win = BrowserWindow.fromId(id);
  if (!win || win.isDestroyed()) return;
  if (controller && e.sender === controller.webContents) {
    send(win.webContents, 'win:event', id, evt, args);          // controller -> child
  } else {
    controllerSend('win:event', id, evt, args);                  // child -> controller
  }
});

ipcMain.on('win:force-close', function (e, id) {
  const win = BrowserWindow.fromId(id);
  if (!win || win.isDestroyed()) return;
  win.__forceClose = true;
  win.close();
});

/* child.window.ee.emit(evt) from the controller -> that child's own window.ee */
ipcMain.on('win:ee', function (e, id, evt, args) {
  const win = BrowserWindow.fromId(id);
  if (win && !win.isDestroyed()) send(win.webContents, 'win:ee', evt, args);
});

/* window.parent.ee.emit(evt) from a child -> controller's window.ee */
ipcMain.on('bus:to-controller', function (e, evt, args) {
  controllerSend('bus:event', evt, args, e.sender.id);
});

/* controller re-broadcasts events to every other window (preferences.* fan-out) */
ipcMain.on('bus:broadcast', function (e, evt, args, exceptId) {
  BrowserWindow.getAllWindows().forEach(function (win) {
    if (win.isDestroyed() || win === controller) return;
    if (exceptId && win.webContents.id === exceptId) return;
    send(win.webContents, 'bus:event', evt, args);
  });
});

/* synthetic keydown forwarded from a child to the controller (keymage shortcuts) */
ipcMain.on('bus:keydown', function (e, init) {
  controllerSend('bus:keydown', init);
});

ipcMain.on('app:close-all', function () {
  BrowserWindow.getAllWindows().forEach(function (win) {
    if (win !== controller && !win.isDestroyed()) send(win.webContents, 'win:native', win.id, 'close', []);
  });
});

ipcMain.on('app:quit', function () {
  BrowserWindow.getAllWindows().forEach(function (win) { win.__forceClose = true; });
  app.quit();
});

ipcMain.on('app:set-badge', function (e, count) {
  try { app.setBadgeCount(Number(count) || 0); } catch (err) { /* unsupported desktop */ }
});

/* ------------------------------------------------------------------ lifecycle */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', function (e, argv, cwd) {
    const parsed = globals.parseArgv(argv, cwd);
    if (parsed._.length) {
      controllerSend('app:open', parsed._, { mode: parsed.mode });
    } else {
      controllerSend('app:reopen');
    }
  });

  app.on('open-file', function (e, file) {           // macOS
    e.preventDefault();
    controllerSend('app:open', [file], {});
  });

  app.on('activate', function () {                    // macOS dock click
    controllerSend('app:reopen');
  });

  app.on('web-contents-created', function (e, wc) {
    remoteMain.enable(wc);
  });

  app.on('browser-window-created', function (e, win) {
    attachWindow(win);
  });

  app.on('window-all-closed', function () {
    app.quit();
  });

  app.on('will-quit', function () {
    globalShortcut.unregisterAll();
  });

  app.whenReady().then(function () {
    globals.compute();

    controller = new BrowserWindow({
      show: false,
      width: 400,
      height: 300,
      title: 'Haroopad',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        nodeIntegrationInSubFrames: true,
        sandbox: false,
        webviewTag: false
      }
    });
    controller.__isController = true;
    controller.loadFile(path.join(globals.APPROOT, 'index.html'));

    if (SMOKE) {
      require('./smoke').run({ controller: controller, log: log });
    }
  });
}
