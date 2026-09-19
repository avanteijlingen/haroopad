define([
    'context/util'
    ], function(util) {

    var gui = require('./js/lib/gui');
    var Menu = new gui.Menu();

    function add(item) {
      Menu.append(item);
    }

    add(util.menuItem({
      label: i18n.t('HTML'),
      click: function() {
        util.emit('file.exports.html');
      }
    }));

    // add(util.menuItem({
    //   label: i18n.t('PDF'),
    //   click: function() {
    //     util.emit('file.exports.html');
    //   }
    // }));

    // add(util.menuItem({
    //   label: i18n.t('ODT'),
    //   click: function() {
    //     util.emit('file.exports.html');
    //   }
    // }));

    // add(util.menuItem({
    //   label: i18n.t('DOCX'),
    //   click: function() {
    //     util.emit('file.exports.html');
    //   }
    // }));

    // add(util.menuItem({
    //   label: i18n.t('WIKI'),
    //   click: function() {
    //     util.emit('file.exports.html');
    //   }
    // }));

    // add(util.menuItem({
    //   label: i18n.t('RTF'),
    //   click: function() {
    //     util.emit('file.exports.html');
    //   }
    // }));

    // add(util.menuItem({
    //   label: i18n.t('TXT'),
    //   click: function() {
    //     util.emit('file.exports.html');
    //   }
    // }));

    return Menu;
});