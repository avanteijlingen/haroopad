define([
    'window/Window.opt',
    'window/WindowManager',
    'window/Window.preferences',
    // 'window/Window.presentation',
    'window/Window.dragdrop',
    'file/File',
    'file/Recents'
], function(Options, WindowMgr, /*Help,*/ Preferences, /*Presentation,*/ DragDrop, File, Recents) {
	var gui = require('./js/lib/gui');
	var win = gui.Window.get(),
		subWin;

  var fs = require('fs'),
      path = require('path');

  var pathDocs = getDocsPath();

  /**
   * Forward an event to the pad window that currently has focus.
   *
   * Under NW.js every window shared one JS context and there was always a
   * window around, so the old code did `toActive(...)`
   * unguarded. In Electron the controller is a real (hidden) window that
   * outlives every pad, so a menu accelerator pressed with no document open
   * would throw. Silently ignoring the event is the correct behaviour: the
   * menu item simply does nothing.
   */
  function toActive(evt) {
    var actived = WindowMgr.actived;
    if (!actived) return false;

    var args = Array.prototype.slice.call(arguments);
    actived.window.ee.emit.apply(actived.window.ee, args);
    return true;
  }

  window.ee.on('tmp.file.open', function(file) {
    WindowMgr.open(file);
  });
  
  window.ee.on('drop.file.open', function(file) {
    WindowMgr.open(file);
  });

  window.ee.on('menu.file.new', function() {
    WindowMgr.open();
  });

  window.ee.on('menu.file.open', function() {
    if (!WindowMgr.actived) {
      WindowMgr.open(undefined, { forceOpen: true });
      return;
    }

    toActive('menu.file.open');
  });

  window.ee.on('menu.file.recents', function(file) {
    Recents.add(file);
    WindowMgr.open(file);
  });

  window.ee.on('menu.file.recents.clear', function() {
    Recents.clearAll();
  });

  window.ee.on('menu.file.save', function() {
    toActive('menu.file.save');
  });

  window.ee.on('menu.file.save.as', function() {
    toActive('menu.file.save.as');
  });

  window.ee.on('menu.file.close', function() {
    toActive('file.close');
  });

  window.ee.on('menu.file.exports.clipboard.plain', function() {
    toActive('menu.file.exports.clipboard.plain');
  });

  window.ee.on('menu.file.exports.clipboard.styled', function() {
    toActive('menu.file.exports.clipboard.styled');
  });

  // window.ee.on('menu.file.exports.clipboard.haroopad', function() {
  //   toActive('menu.file.exports.clipboard.haroopad');
  // });

  window.ee.on('menu.file.exports.html', function() {
    toActive('file.exports.html');
  });

  window.ee.on('menu.file.send.email', function() {
    toActive('menu.file.send.email');
  });
  
  window.ee.on('menu.print.editor', function() {
    toActive('print.editor');
  });

  window.ee.on('menu.print.viewer', function() {
    toActive('print.viewer');
  });

  window.ee.on('menu.preferences.show', function() {
    Preferences.show();
  });


  /**
   * edit
   */
  window.ee.on('menu.edit.undo', function() {
    toActive('menu.edit.undo');
  });
  window.ee.on('menu.edit.redo', function() {
    toActive('menu.edit.redo');
  });
  window.ee.on('menu.edit.cut', function() {
    toActive('menu.edit.cut');
  });
  window.ee.on('menu.edit.copy', function() {
    toActive('menu.edit.copy');
  });
  window.ee.on('menu.edit.paste', function() {
    toActive('menu.edit.paste');
  });
  window.ee.on('menu.edit.delete', function() {
    toActive('menu.edit.delete');
  });
  window.ee.on('menu.edit.selectall', function() {
    toActive('menu.edit.selectall');
  });


  /**
   * tools menu event
   */
  // window.ee.on('tools.presentation', function(theme) {
    // Presentation.show(theme);
  // });


  // window.ee.on('menu.view.mode.toggle', function() {
  //   toActive('view.mode.toggle');
  // });

  window.ee.on('menu.view.mode', function(layout) {
    toActive('menu.view.mode', layout);
  });

  window.ee.on('menu.show.toggle.linenum', function() {
    toActive('show.toggle.linenum');
  });

  window.ee.on('menu.show.toggle.markdown.help', function() {
    toActive('toggle.syntax.help');
  });

  window.ee.on('menu.view.toggle.vim', function() {
    toActive('menu.view.toggle.vim');
  });

  window.ee.on('menu.view.toggle.toc', function() {
    toActive('menu.view.toggle.toc');
  });

  window.ee.on('menu.view.plus5.width', function() {
    toActive('view.plus5.width');
  });

  window.ee.on('menu.view.minus5.width', function() {
    toActive('view.minus5.width');
  });

  window.ee.on('menu.view.doc.outline', function() {
    toActive('menu.view.doc.outline');
  });

  window.ee.on('menu.view.editor.font.size', function(value) {
    toActive('menu.view.editor.font.size', value);
  });
  window.ee.on('menu.view.viewer.font.size', function(value) {
    toActive('menu.view.viewer.font.size', value);
  });

  window.ee.on('menu.view.fullscreen', function() {
    toActive('view.fullscreen');
  });
  

  /**
   * insert menu
   */
  window.ee.on('menu.insert.markdown', function(tag) {
    toActive('menu.insert.markdown', tag);
  });
  // window.ee.on('menu.insert.page.break', function() {
  //   toActive('insert.page.break');
  // });
  // window.ee.on('menu.insert.section.break', function() {
  //   toActive('insert.section.break');
  // });
  window.ee.on('menu.insert.toc', function() {
    toActive('insert.toc');
  });
  window.ee.on('menu.insert.date', function(format) {
    toActive('insert.date', format);
  });
  window.ee.on('menu.insert.filename', function() {
    toActive('insert.filename');
  });

  /**
   * find menu
   */
  window.ee.on('menu.find.start', function() {
    toActive('find.start');
  });
  window.ee.on('menu.find.next', function() {
    toActive('find.next');
  });
  window.ee.on('menu.find.previous', function() {
    toActive('find.previous');
  });
  window.ee.on('menu.find.replace', function() {
    toActive('find.replace');
  });
  window.ee.on('menu.find.replace.all', function() {
    toActive('find.replace.all');
  });

  /**
   * help menu
   */
  
  window.ee.on('menu.help.doc', function(doc) {
    var file;

    switch(doc) {
      case 'about':
        file = pathDocs +'/about.md';
      break;
      case 'shortcut':
        file = pathDocs +'/shortcut.md';
      break;
      case 'acknowledgements':
        file = pathDocs +'/../acknowledgements.md';
      break;
    } 

    WindowMgr.open({ fileEntry: file, readOnly: true });
  });
  window.ee.on('menu.help.syntax', function() {
    toActive('menu.help.syntax');
  });

  window.ee.on('exit', function() {
    gui.App.quit();
  });

  /**
   * context function
   */
  window.ee.on('context.cut', function(e) {
    toActive('context.cut', e);
  });
  window.ee.on('context.copy', function(e) {
    toActive('context.copy');
  });
  window.ee.on('context.paste', function(e) {
    toActive('context.paste');
  });
  window.ee.on('context.delete', function(e) {
    toActive('context.delete');
  });
  window.ee.on('context.selectall', function(e) {
    toActive('context.selectall');
  });
  window.ee.on('context.preferences', function(e) {
    Preferences.show();
  });
  window.ee.on('context.copy', function(e) {
    toActive('context.copy');
  });
  window.ee.on('context.copy.html', function(e) {
    toActive('menu.file.exports.clipboard.plain');
  });

  /* context event */
  window.ee.on('context.editor.theme', function(theme) {
    toActive('editor.theme', theme);
  });
  window.ee.on('context.editor.theme.user', function(theme) {
    toActive('editor.theme.user', theme);
  });
  window.ee.on('context.viewer.theme', function(theme) {
    toActive('viewer.theme', theme);
  });
  window.ee.on('context.viewer.theme.code', function(theme) {
    toActive('viewer.theme.code', theme);
  });
  window.ee.on('context.viewer.theme.user', function(theme) {
    toActive('viewer.theme.user', theme);
  });
  window.ee.on('context.viewer.export', function(format) {
    toActive('file.exports.html');
  });
  window.ee.on('context.viewer.publish', function(service) {
    toActive('menu.file.send.email');
  });


  /* process event */
  window.ee.on('update.haroopad', function(currVersion, newVersion) {
    toActive('update.haroopad', currVersion, newVersion);
  });
  window.ee.on('up.to.date.haroopad', function(currVersion) {
    toActive('up.to.date.haroopad', currVersion);
  });
  window.ee.on('up.to.date.news', function(contents) {
    toActive('up.to.date.news', contents);
  });

  // keymage(__key('new-window'), function() {
  //   WindowMgr.open();
  // });

  // keymage(__key('exit'), function() {
  //   gui.App.quit();
  // });

  // keymage(__key('show-preference'), function() {
  //   Preferences.show();
  // });

});