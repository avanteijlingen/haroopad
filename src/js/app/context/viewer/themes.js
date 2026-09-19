define([
    'context/util'
    ], function(util) {

    var gui = require('./js/lib/gui');
    var Menu = new gui.Menu();
    var themes = global.THEMES.viewer;

    function add(item) {
      Menu.append(item);
    }

    themes.forEach(function(theme) {
      add(util.menuItem({
        label: theme,
        click: function() {
          util.emit('viewer.theme', this.label);
        }
      }));
    });

    return Menu;
});