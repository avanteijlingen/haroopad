define([
    'context/util'
    ], function(util) {

    var gui = require('./js/lib/gui');
    var Menu = new gui.Menu();
    var themes = global.THEMES.editor;

    function add(item) {
      Menu.append(item);
    }

    themes.forEach(function(theme) {
      add(util.menuItem({
        label: theme,
        click: function() {
          util.emit('editor.theme', this.label);
        }
      }));
    });

    return Menu;
});