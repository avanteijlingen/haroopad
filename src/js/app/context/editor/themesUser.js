define([
    'context/util'
    ], function(util) {

    var gui = require('./js/lib/gui');
    var Menu = new gui.Menu();

    function add(item) {
      Menu.append(item);
    }

    function removeAll() {
      var len = Menu.items.length;
      for (var i = 0; i < len; i++) {
        Menu.removeAt(0);
      }
    }

    function gen(themes) {
      themes.forEach(function(theme) {
        add(util.menuItem({
          label: theme,
          click: function() {
            util.emit('editor.theme.user', this.label);
          }
        }));
      });
    }

    gen(global.THEMES.user.editor);

    /* preferences broadcasts arrive on the parent (controller) bus in a
       child window, and on the local bus in the controller itself */
    function refresh() {
      removeAll();
      gen(global.THEMES.user.editor);
    }

    util.onPreferences('preferences.editor.userTheme', refresh);

    return Menu;
});
