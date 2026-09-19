/**
 * Presentation window <-> controller bridge.
 *
 * Under NW.js the controller handed this page its own live EventEmitter:
 *
 *     presentationWindow.window.update(controllerEE, doc.toJSON(), file.toJSON())
 *
 * An Electron window cannot receive another window's objects, so the deck now
 * gets plain data over the window bus and this shim stands in for `window.ee`:
 *
 *   controller -> here : 'presentation.update', { html, title }, { dirname, basename }
 *   here -> controller : 'exit.presentation'   (Escape in list mode)
 *
 * Everything else in the deck (shower) is untouched: `window.update(ee, data,
 * file)` is still what renders the slides.
 */
(function () {
  'use strict';

  var ipc = null;
  try {
    ipc = require('electron').ipcRenderer;
  } catch (e) {
    /* opened outside Electron (plain browser preview): stay inert */
  }

  /* Same trick as src/js/lib/gui/bootstrap.js: with nodeIntegration on, the
     page has `module`/`exports` globals, so UMD libraries (jQuery, underscore,
     Backbone, shower) would export to CommonJS instead of attaching to
     `window`. NW.js never exposed them, so drop them before the deck's own
     scripts run. */
  try { delete window.module; } catch (e) { window.module = undefined; }
  try { delete window.exports; } catch (e) { window.exports = undefined; }

  /* Minimal EventEmitter with one special case: `exit.presentation` is
     forwarded to the controller instead of (only) staying local. */
  var listeners = {};

  var ee = {
    on: function (evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
      return this;
    },
    off: function (evt, fn) {
      var l = listeners[evt] || [];
      var i = l.indexOf(fn);
      if (i > -1) l.splice(i, 1);
      return this;
    },
    emit: function (evt) {
      var args = [].slice.call(arguments, 1);
      (listeners[evt] || []).slice().forEach(function (fn) {
        try { fn.apply(null, args); } catch (err) { console.error(err); }
      });
      if (ipc) {
        try { ipc.send('bus:to-controller', evt, args); } catch (err) { console.error(err); }
      }
      return true;
    }
  };
  ee.addListener = ee.on;
  ee.removeListener = ee.off;

  window.ee = ee;

  function render(doc, file) {
    doc = doc || {};
    file = file || {};

    if (typeof window.update !== 'function') {
      /* the deck script has not finished loading yet */
      window.__presentationPending = [doc, file];
      return;
    }

    window.update(ee, { html: doc.html || '', title: doc.title || '' },
                      { dirname: file.dirname || '', basename: file.basename || '' });
  }

  window.__presentationRender = render;

  if (ipc) {
    /* controller -> this window (gui shim: wrapper.window.ee.emit(...)) */
    ipc.on('win:ee', function (e, evt, args) {
      args = args || [];
      if (evt === 'presentation.update') {
        render(args[0], args[1]);
        return;
      }
      (listeners[evt] || []).slice().forEach(function (fn) {
        try { fn.apply(null, args); } catch (err) { console.error(err); }
      });
    });

    /* controller broadcasts */
    ipc.on('bus:event', function (e, evt, args) {
      args = args || [];
      if (evt === 'presentation.update') {
        render(args[0], args[1]);
        return;
      }
      (listeners[evt] || []).slice().forEach(function (fn) {
        try { fn.apply(null, args); } catch (err) { console.error(err); }
      });
    });
  }

  /* if data arrived before the deck script defined window.update, replay it */
  window.addEventListener('load', function () {
    var pending = window.__presentationPending;
    if (pending && typeof window.update === 'function') {
      window.__presentationPending = null;
      render(pending[0], pending[1]);
    }
  });
}());
