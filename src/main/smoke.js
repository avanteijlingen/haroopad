'use strict';
/**
 * Smoke test driver (HAROOPAD_SMOKE=1 electron .).
 * Boots the app, waits for a pad window, drives the editor through
 * webContents.executeJavaScript and exits non-zero on renderer errors.
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const errors = [];
const TIMEOUT = Number(process.env.HAROOPAD_SMOKE_TIMEOUT || 90000);

/* Windows GUI executables have no console attached, so stdout goes nowhere and
 * only the exit code survives. HAROOPAD_SMOKE_OUT=<file> mirrors the report
 * into a file, which makes the run readable on every platform. */
const OUT = process.env.HAROOPAD_SMOKE_OUT;

function say(text) {
  console.log(text);

  if (OUT) {
    try { fs.appendFileSync(OUT, text + os.EOL); } catch (e) { /* best effort */ }
  }
}

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function until(fn, ms, what) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const v = await fn(); if (v) return v; } catch (e) { /* retry */ }
    await wait(150);
  }
  throw new Error('timeout waiting for ' + what);
}

function padWindows(controller) {
  return BrowserWindow.getAllWindows().filter(function (w) {
    return w !== controller && !w.isDestroyed() && /pad\.html/.test(w.webContents.getURL());
  });
}

function run(ctx) {
  const controller = ctx.controller;

  app.on('web-contents-created', function (e, wc) {
    wc.on('console-message', function (ev) {
      const level = ev.level !== undefined ? ev.level : arguments[1];
      const message = ev.message !== undefined ? ev.message : arguments[2];
      if (level === 'error' || level === 3) errors.push(message);
    });
    wc.on('render-process-gone', function (e, d) { errors.push('renderer gone: ' + JSON.stringify(d)); });
  });

  (async function () {
    const report = {};
    try {
      const pad = await until(function () { return padWindows(controller)[0]; }, 20000, 'pad window');
      report.padOpened = true;

      await until(function () {
        return pad.webContents.executeJavaScript('!!(window.__padReady && window.nw && window.nw.editor && window.nw.file)');
      }, 30000, 'editor ready');
      report.editorReady = true;

      // math rendering is a preference (off by default); turn it on the way the
      // preferences window does: persist it, then broadcast the new option set
      // Wait for the preferences defaults to be persisted first: on a fresh
      // profile they are written shortly after startup, and broadcasting a
      // partial option set before that would drop the other settings.
      await until(function () {
        return pad.webContents.executeJavaScript('!!store.get("Markdown")');
      }, 15000, 'markdown settings to be stored').catch(function () { return false; });

      await pad.webContents.executeJavaScript(
        '(function(){var o=Object.assign({}, store.get("Markdown")||{}, {mathjax:true});' +
        'store.set("Markdown", o); window.parent.ee.emit("preferences.markdown.change", o); return true})()');
      await wait(600);

      // block math is its own paragraph ($$..$$); inline math is $$$..$$$
      const md = '# Smoke Title\n\nHello **world** $$$a+b$$$\n\n$$\nx^2\n$$\n\n- [ ] task\n\n```js\nvar a = 1;\n```\n';
      await pad.webContents.executeJavaScript('window.nw.editor.setValue(' + JSON.stringify(md) + '); true');

      const html = await until(function () {
        return pad.webContents.executeJavaScript(
          '(function(){var f=document.querySelector("#viewer iframe");var b=f&&f.contentDocument&&f.contentDocument.getElementById("root");return b&&/Smoke Title/.test(b.innerHTML)?b.innerHTML:""})()');
      }, 30000, 'viewer render');
      report.viewerRendered = /<h1/.test(html) && /<strong>world<\/strong>/.test(html);

      /* These three are produced by separate asynchronous passes over the
       * rendered document (highlight.js, the task-list renderer, MathJax), so
       * poll for each rather than sampling one snapshot. */
      function viewerHas(selectorOrRe) {
        return pad.webContents.executeJavaScript(
          '(function(){var f=document.querySelector("#viewer iframe");' +
          'var b=f&&f.contentDocument&&f.contentDocument.getElementById("root");' +
          'return b ? ' + selectorOrRe + ' : false})()');
      }

      report.codeHighlighted = await until(function () {
        return viewerHas('!!b.querySelector("pre.hljs, .hljs, span[class^=hljs-]")');
      }, 15000, 'syntax highlighting').catch(function () { return false; });

      report.taskList = await until(function () {
        return viewerHas('!!b.querySelector("input.task-list-item")');
      }, 15000, 'task list checkboxes').catch(function () { return false; });
      report.mathRendered = await until(function () {
        return pad.webContents.executeJavaScript(
          '(function(){var f=document.querySelector("#viewer iframe");var b=f&&f.contentDocument&&f.contentDocument.getElementById("root");return !!(b&&b.querySelector(".MathJax, .MathJax_Display, .mjx-chtml, mjx-container"))})()');
      }, 15000, 'MathJax typeset').catch(function () { return false; });

      const tmpFile = path.join(os.tmpdir(), 'haroopad-smoke-' + Date.now() + '.md');
      await pad.webContents.executeJavaScript('window.nw.file.save(' + JSON.stringify(tmpFile) + '); true');
      await wait(300);
      report.saved = fs.existsSync(tmpFile) && /Smoke Title/.test(fs.readFileSync(tmpFile, 'utf8'));
      report.titleUpdated = await pad.webContents.executeJavaScript('document.title').then(function (t) { return /haroopad-smoke/.test(t); });
      try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }

      // preferences window opens and applies a change to the pad
      controller.webContents.send('bus:event', 'menu.preferences.show', [], 0);
      const pref = await until(function () {
        return BrowserWindow.getAllWindows().filter(function (w) { return /preferences\.html/.test(w.webContents.getURL()); })[0];
      }, 10000, 'preferences window');
      await until(function () { return pref.webContents.executeJavaScript('!!(window.nw && document.querySelector("#editor-tab"))'); }, 10000, 'preferences ready');
      report.preferencesOpened = true;

      await pref.webContents.executeJavaScript('window.parent.ee.emit("preferences.editor.fontSize", 21); true');
      report.preferenceApplied = await until(function () {
        return pad.webContents.executeJavaScript('document.querySelector(".CodeMirror").style.fontSize === "21px"');
      }, 5000, 'font size change to reach the pad').catch(function () { return false; });

      // Clearing a user theme (none selected) must not throw in the pad and
      // must actually clear the previous override. loadUserCss returns
      // undefined in that case and the CSS parser threw on it.
      report.emptyUserThemeSafe = await pad.webContents.executeJavaScript(
        '(function(){' +
        '  var mod = requirejs("editor/Editor.custom");' +
        '  var view = window.__customStyleView;' +
        '  if (!view) return "no view";' +
        '  view.updateStyle("editor { color: #123456; }");' +
        '  var applied = view.$el.text().length > 0;' +
        '  try { view.changeUserTheme(undefined); } catch (e) { return "threw: " + e.message; }' +
        '  return applied && view.$el.text() === "";' +
        '})()');

      // recents / open menu plumbing
      const menuOk = await pad.webContents.executeJavaScript('!!(window.MenuBar && window.MenuBar._systemMenu && window.MenuBar._systemMenu.items.length >= 5)');
      report.menuBuilt = menuOk;

      // multi-window: File > New must open a second pad, and the controller
      // must track it as the active window (the controller <-> pad contract)
      controller.webContents.send('bus:event', 'menu.file.new', [], 0);
      const pads = await until(function () {
        const list = padWindows(controller);
        return list.length >= 2 ? list : null;
      }, 15000, 'second pad window').catch(function () { return null; });
      report.secondPadOpened = !!pads;

      if (pads) {
        const pad2 = pads.filter(function (w) { return w !== pad; })[0];
        await until(function () { return pad2.webContents.executeJavaScript('!!window.__padReady'); }, 20000, 'second pad ready');

        report.activeWindowTracked = await until(function () {
          return controller.webContents.executeJavaScript(
            '(function(){var m=requirejs("window/WindowManager");return !!(m.actived && m.length() === 2)})()');
        }, 8000, 'controller to track 2 windows').catch(function () { return false; });

        // each pad owns an independent document model
        await pad2.webContents.executeJavaScript('window.nw.editor.setValue("# Second Window"); true');
        await wait(600);
        report.independentDocuments = await pad.webContents.executeJavaScript(
          'nw.file.get("markdown").indexOf("Second Window") === -1 && nw.file.get("markdown").indexOf("Smoke Title") > -1');

        // closing it must unregister it in the controller
        pad2.webContents.executeJavaScript('window.nw.close(true); true').catch(function () {});
        report.closeTracked = await until(function () {
          return controller.webContents.executeJavaScript(
            '(function(){var m=requirejs("window/WindowManager");return m.length() === 1})()');
        }, 10000, 'controller to drop closed window').catch(function () { return false; });
      }
    } catch (err) {
      errors.push(String(err && err.stack || err));
      try {
        report.controllerState = await controller.webContents.executeJavaScript(
          '(function(){var c=window.requirejs&&requirejs.s.contexts._;return JSON.stringify({i18n:typeof i18n,ee:!!window.ee,menu:!!(window.MenuBar&&MenuBar._systemMenu),locales:!!window.LOCALES,lang:window.LOCALES&&LOCALES._lang,defined:c?Object.keys(c.defined):null,registry:c?Object.keys(c.registry):null,windows:window.gui?gui.Window.getAll().length:null})})()');
      } catch (e2) { report.controllerState = String(e2); }
      try {
        const pad = padWindows(controller)[0];
        if (pad) report.padState = await pad.webContents.executeJavaScript(
          '(function(){var c=window.requirejs&&requirejs.s.contexts._;return JSON.stringify({module:typeof module,exports:typeof exports,define:typeof define,CodeMirror:typeof CodeMirror,jq:typeof $,us:typeof _,Backbone:typeof Backbone,i18n:typeof i18n,store:typeof store,nwfile:!!(window.nw&&nw.file),editor:!!(window.nw&&nw.editor),registry:c?Object.keys(c.registry):null})})()');
      } catch (e3) { report.padState = String(e3); }
      try {
        const pad = padWindows(controller)[0];
        if (pad) report.viewerState = await pad.webContents.executeJavaScript(
          '(function(){var f=document.querySelector("#viewer iframe");var w=f&&f.contentWindow;var d=f&&f.contentDocument;return JSON.stringify({md:nw.file.get("markdown").length,html:(nw.file.doc.get("html")||"").length,root:d&&d.getElementById("root")?d.getElementById("root").innerHTML.length:null,MathJax:w&&typeof w.MathJax,mermaid:w&&typeof w.mermaid,hljs:w&&typeof w.hljs,jq:w&&typeof w.$,update:w&&typeof w.update,body:d&&d.body.className,readyState:d&&d.readyState})})()');
      } catch (e4) { report.viewerState = String(e4); }
      if (process.env.HAROOPAD_SMOKE_EVAL_PREF) {
        try {
          const pref = BrowserWindow.getAllWindows().filter(function (w) { return /preferences\.html/.test(w.webContents.getURL()); })[0];
          report.evalPref = pref ? await pref.webContents.executeJavaScript(process.env.HAROOPAD_SMOKE_EVAL_PREF) : 'no preferences window';
        } catch (e6) { report.evalPref = String(e6); }
      }
      if (process.env.HAROOPAD_SMOKE_EVAL_CTRL) {
        try {
          report.evalCtrl = await controller.webContents.executeJavaScript(process.env.HAROOPAD_SMOKE_EVAL_CTRL);
        } catch (e9) { report.evalCtrl = String(e9); }
      }
      if (process.env.HAROOPAD_SMOKE_EVAL) {
        try {
          const pad = padWindows(controller)[0];
          report.eval = await (pad || controller).webContents.executeJavaScript(process.env.HAROOPAD_SMOKE_EVAL);
        } catch (e5) { report.eval = String(e5); }
      }
    }

    if (process.env.HAROOPAD_SMOKE_EVAL_CTRL && report.evalCtrl === undefined) {
      try {
        report.evalCtrl = await controller.webContents.executeJavaScript(process.env.HAROOPAD_SMOKE_EVAL_CTRL);
      } catch (e10) { report.evalCtrl = String(e10); }
    }
    if (process.env.HAROOPAD_SMOKE_EVAL && report.eval === undefined) {
      try {
        const pad = padWindows(controller)[0];
        report.eval = await (pad || controller).webContents.executeJavaScript(process.env.HAROOPAD_SMOKE_EVAL);
      } catch (e7) { report.eval = String(e7); }
    }
    if (process.env.HAROOPAD_SMOKE_EVAL_PREF && report.evalPref === undefined) {
      try {
        const pref = BrowserWindow.getAllWindows().filter(function (w) { return /preferences\.html/.test(w.webContents.getURL()); })[0];
        report.evalPref = pref ? await pref.webContents.executeJavaScript(process.env.HAROOPAD_SMOKE_EVAL_PREF) : 'no preferences window';
      } catch (e8) { report.evalPref = String(e8); }
    }
    report.errors = errors.slice(0, 30);
    /* Every assertion must be exactly true. Checking only for `false` let a
     * probe that returned a diagnostic string (e.g. "threw: ...") pass. Keys
     * used for diagnostics rather than assertions are excluded by name. */
    const DIAGNOSTIC_KEYS = ['errors', 'eval', 'evalPref', 'evalCtrl', 'controllerState', 'padState', 'viewerState'];
    const failures = Object.keys(report).filter(function (k) {
      return DIAGNOSTIC_KEYS.indexOf(k) === -1 && report[k] !== true;
    });
    if (failures.length) report.failedAssertions = failures;
    const failed = errors.length > 0 || failures.length > 0;
    say('SMOKE_REPORT ' + JSON.stringify(report, null, 2));
    say(failed ? 'SMOKE_FAIL' : 'SMOKE_PASS');
    BrowserWindow.getAllWindows().forEach(function (w) { w.__forceClose = true; });
    app.exit(failed ? 1 : 0);
  })();

  setTimeout(function () {
    say('SMOKE_REPORT ' + JSON.stringify({ timeout: true, errors: errors.slice(0, 30) }, null, 2));
    say('SMOKE_FAIL');
    app.exit(3);
  }, TIMEOUT);
}

module.exports = { run: run };
