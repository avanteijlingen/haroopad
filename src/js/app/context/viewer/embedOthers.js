define([
    'context/util'
    ], function(util) {

    var gui = require('./js/lib/gui');
    var Menu = new gui.Menu();

    function add(item) {
      Menu.append(item);
    }

    add(util.menuItem({
      label: i18n.t('Tweet'),
      click: function() {
        util.emitParent('context.viewer.embed', this.label);
      }
    }));

    add(util.menuItem({
      label: i18n.t('Wikipedia'),
      click: function() {
        util.emitParent('context.viewer.embed', this.label);
      }
    }));

    add(util.menuItem({
      label: i18n.t('Slideshare.net'),
      click: function() {
        util.emitParent('context.viewer.embed', this.label);
      }
    }));

    add(util.menuItem({
      label: i18n.t('Speakerdeck.com'),
      click: function() {
        util.emitParent('context.viewer.embed', this.label);
      }
    }));

    return Menu;
});