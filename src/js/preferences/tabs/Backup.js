define([
  'tabs/backup/dialog.import',
  'tabs/backup/dialog.export',
], function(dialogImport, dialogExport) {
  var moment = require('moment');
  var fs = require('fs');
  var path = require('path');
  var os = require('os');
  var gui = require('./js/lib/gui');
  var manifest = gui.App.manifest;


  function importJson(res) {
    var view, prop;

    delete res._version;

    for (prop in res) {
      store.set(prop, res[prop]);
    }

    dialogImport.show();
  }

  var BackupTabView = Backbone.View.extend({
    el: '#backup-tab',

    events: {
      'click a[name=export]': 'exportHandler',
      'click a[name=import]': 'importHandler'
    },

    initialize: function() {},

    // native open dialog replaces the old hidden `<input type=file>`
    importHandler: function() {
      var files = gui.dialogs.open({
        title: i18n.t('backup.import'),
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (!files || !files.length) return;

      try {
        var res = JSON.parse(fs.readFileSync(files[0], 'utf8'));
        importJson(res);

      } catch (e) {
        alert('broken setting.json');
      }
    },

    exportHandler: function(e) {
      var config = store.getAll();

      delete config._time;
      delete config.Temporary;
      delete config.Recents;
      delete config.Window;
      delete config.Helper;
      delete config.Markdown.gfm;
      delete config.Markdown.emoji;
      delete config.Markdown.highlight;
      delete config.Markdown.langPrefix;
      delete config.Markdown.headerPrefix;
      delete config.Markdown.pedantic;
      delete config.Markdown.silent;

      config._version = gui.App.manifest.version;

      var text = JSON.stringify(config, null, 2);
      var name = manifest.name + '-' + moment().format('YYYY-MM-DD') + '-setting.json';

      // native save dialog replaces the old Blob + `a.download` download
      var file = gui.dialogs.save({
        title: i18n.t('backup.export'),
        defaultPath: path.join(os.homedir(), name),
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (!file) return;

      try {
        fs.writeFileSync(file, text, 'utf8');
      } catch (err) {
        alert(String(err.message || err));
        return;
      }

      // dialogExport.show();

    }
  });

  dialogImport.on('yes', function() {
    // gui.App.closeAllWindows();
    nw.hide();
    window.parent.ee.emit('closeAll');
  });
  
  return view = new BackupTabView;

});