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
   * Native open dialog. Keeps the old view's public surface:
   * `show()` and the `file.open` event carrying a path.
   */
  var View = Backbone.View.extend({
  	el: '#openFile',

  	initialize: function() {
  	},

  	show: function(dir) {
  	  var files = gui.dialogs.open({
  	    dir: dir,
  	    filters: getFilters()
  	  });

  	  /* cancelled */
  	  if (!files || !files.length) {
  	    return;
  	  }

  	  view.trigger('file.open', files[0]);
  	}
  });

  return view = new View;
});
