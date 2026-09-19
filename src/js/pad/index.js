/* globally for window event system */
var gui = require('./js/lib/gui');

window.nw = gui.Window.get();
window.ee = new EventEmitter();
window.parent = nw.parent;

//fixed text.js error on node-webkit
require.nodeRequire = require;

/**
 * require.js 환경 설정
 */
requirejs.config({
  baseUrl: 'js/pad',
  waitSeconds: 30,
  locale: 'ko-kr',
  paths: {
    tpl: '../../tpl',
    vendors: '../vendors',
    txt: '../vendors/text/text',
    /* the document model and markdown parser are shared with the controller
       code base but run inside each pad window */
    file: '../app/file',
    core: '../app/core',
    parse: '../app/core/Parser',
    /* context menus are built and popped inside this window now */
    context: '../app/context',
    /* the pad answers the controller's presentation data requests */
    tools: '../app/tools'
  },
  config: {
    text: { env: 'xhr' },
    txt: { env: 'xhr' }
  }
});


var lng = global.LOCALES._lang.split('-')[0];
i18n.init({
  lng: lng
}, function() {

  i18n.addResourceBundle(lng, 'menu', global.LOCALES['menu']);
  i18n.addResourceBundle(lng, 'pad', global.LOCALES['pad']);

  i18n.setDefaultNamespace('menu');

  if (process.platform != 'darwin') {
    MenuBar();
  }

  /* Every pad window owns its document model. The controller only hands over
     a serialisable description: { fileEntry, tmp, readOnly } */
  requirejs(['file/File.model'], function(FileModel) {
    var info = (nw._args && nw._args.file) || {};

    nw.file = new FileModel({
      fileEntry: info.fileEntry || undefined,
      tmp: info.tmp || undefined,
      readOnly: !!info.readOnly
    });

    function publishState(extra) {
      var f = nw.file;
      nw.emit('file.state', _.extend({
        fileEntry: f.get('fileEntry'),
        basename: f.get('basename'),
        dirname: f.get('dirname'),
        tmp: !!f.get('tmp'),
        readOnly: !!f.get('readOnly')
      }, extra || {}));
    }
    nw.publishState = publishState;

  requirejs([
    'window/Window',
    'editor/Editor',
    'viewer/Viewer',
    'ui/markdown-help/MarkdownHelp',
    'ui/file/File',
    'ui/layout/Layout',
    'ui/footer/Footer',
    'context/Pad',
    'tools/Presentation.pad'
  ], function(Window, Editor, Viewer, /*TOC,*/ MarkdownHelp, File) {
    var _tid_;
    var file = nw.file;

    $('body').i18n();

    function delayChange() {
      window.clearTimeout(_tid_);

      window.ee.emit('change.before.markdown', Editor.getValue());

      _tid_ = setTimeout(function() {
        nw.file.set('markdown', Editor.getValue());
      }, 210);
    }

    nw.on('file.opened', function(file) {
      var opt, doc;

      /* the controller re-uses an empty window by sending a plain description */
      if (!file || typeof file.toJSON !== 'function') {
        var desc = file || {};
        file = nw.file;
        file.set({ tmp: desc.tmp || undefined, readOnly: !!desc.readOnly }, { silent: true });
        file.set({ fileEntry: desc.fileEntry });
        file.load();
      }

      opt = file.toJSON();
      doc = file.doc;
      publishState({ pristine: false });

      Editor.off("change", delayChange);
      Editor.setValue(opt.markdown);
      Editor.getDoc().clearHistory();
      Viewer.init();

      window.ee.emit('file.opened');

      file.doc.trigger('change:html', doc, doc.html());

      if (!opt.readOnly) {
        Editor.on('change', delayChange);
      }

      //temp file
      if (opt.tmp) {
        file.set({
          fileEntry: undefined
        }, {
          silent: true
        });
      }

      /* change by external application */
      nw.file.on('change:mtime', function() {
        window.ee.emit('file.update', nw.file.get('fileEntry'));
      });

      switch (nw._args.mode) {
        case 'view':
          window.ee.emit('menu.view.mode', 'viewer');
          break;
        case 'edit':
          window.ee.emit('menu.view.mode', 'editor');
          break;
      }

      window.ee.once('rendered', function() {
        setTimeout(function() {
          nw.show();
          nw.focus();
          window.parent.ee.emit('actived', nw.id);
        }, 1);
      });
    });


    /* open blank window */
    if (!file.get('fileEntry')) {
      Editor.on("change", delayChange);

      nw.show();
      nw.focus();
      window.parent.ee.emit('actived', nw.id);
      publishState({ pristine: true });

      if (nw._args.forceOpen) {
        window.ee.emit('menu.file.open');
      }
    } else {
      nw.emit('file.opened', file);
    }

    /**
     * change file state by other application
     */
    window.ee.on('reload', function() {
      file.reload({
        silent: true
      });
      Editor.setValue(file.get('markdown'));
      file.trigger('change:markdown');
    });

    file.on('saved', function() {
      var opt = nw.file.toJSON();
      Viewer.init();
      delete opt.markdown;
      nw.emit('file.saved', opt);
      publishState({ pristine: false });
    });

    /* the controller keeps track of which windows are still untouched */
    window.ee.once('change.before.markdown', function() {
      publishState({ pristine: false });
    });

    //run with file open;
    // if (tmp) {
    //   File.openTmp(decodeURIComponent(file), uid);
    // } else {
    //   if (file) {
    //     File.open(decodeURIComponent(file));
    //     Editor.setOption('readOnly', readOnly);
    //   } else {
    //     Editor.on("change", delayChange);
    //   }

    //   File.startAutoSave();
    // }

    nw.on('focus', function() {
      nw.file.refresh();
      nw.file.doc.trigger('change:tasks', nw.file.doc);
      window.parent.ee.emit('actived', nw.id);
    });

    nw.file.doc.bind('change:tasks', function(model) {
      var dTasks;

      tasks = model.get('tasks') || [];

      dTasks = tasks.filter(function(task) {
        return !task.done;
      });
      
      nw.setBadgeLabel(dTasks.length || '');
    });

    window.ee.on('up.to.date.news', function(md) {
      //if already editor has not any contents
      if (!nw.editor.getValue()) {
        Viewer.set(md);
      }
    });

    $(document.body).click(function(e) {
      var el = e.target,
        href;
      var tagName = el.tagName.toUpperCase();

      switch (tagName) {
        case 'A':
          href = el.getAttribute('href');

          if (!href || href === '#') {
            return;
          }

          global.Shell.openExternal(href);
          e.preventDefault();
          break;
      }
    });

    /* control gui editor */
    $('#editControls a').click(function(e) {
      switch ($(this).data('role')) {
        case 'h1':
        case 'h2':
        case 'p':
          document.execCommand('formatBlock', false, '<' + $(this).data('role') + '>');
          break;
        default:
          document.execCommand($(this).data('role'), false, null);
          break;
      }

    });

    //for aside menu
    if (window.gnMenu) {
      new gnMenu(document.getElementById('editControls'));
    }

    window.__padReady = true;
  });
  });

});
