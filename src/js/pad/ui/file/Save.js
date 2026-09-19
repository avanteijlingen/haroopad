define(function() {
  var view;
  var gui = require('./js/lib/gui');

  function getFilters() {
    var exts = global.mdexts || ['md', 'markdown', 'txt'];

    return [
      { name: 'Markdown', extensions: exts },
      { name: 'All Files', extensions: ['*'] }
    ];
  }

  /**
   * Native save dialog. Keeps the old view's public surface:
   * `setDefault(file)`, `show(dir, file)` and the `file.save` event.
   */
  var View = Backbone.View.extend({
  	el: '#saveFile',

  	initialize: function() {
  	  this.defaultName = null;
  	},

    setDefault: function(file) {
      file = file || ( nw.file.get('title') || i18n.t('pad:untitled') ) + '.md';

      this.defaultName = file;

      return file;
    },

  	show: function(dir, file) {
      var name = this.setDefault(file);

  	  var chosen = gui.dialogs.save({
  	    dir: dir,
  	    name: name,
  	    filters: getFilters()
  	  });

      /* cancelled */
      if (!chosen) {
        return;
      }

  	  view.trigger('file.save', chosen);
  	}
  });

  return view = new View;
});
