define([
    'context/util'
    ], function(util) {

    var gui = require('./js/lib/gui');
    var Menu = new gui.Menu();

    function add(item) {
      Menu.append(item);
    }

    add(util.menuItem({
      label: i18n.t('Youtube'),
      click: function() {
        util.emitParent('context.viewer.embed', this.label);
      }
    }));

    add(util.menuItem({
      label: i18n.t('Vimeo'),
      click: function() {
        util.emitParent('context.viewer.embed', this.label);
      }
    }));

    add(util.menuItem({
      label: i18n.t('Ted.com'),
      click: function() {
        util.emitParent('context.viewer.embed', this.label);
      }
    }));

    return Menu;
});