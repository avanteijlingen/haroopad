window.MenuBarToolsPost = function () {
  var gui = require('./js/lib/gui');
  var submenu = new gui.Menu();

  submenu.append(
    new gui.MenuItem({
        label: 'Tumblr',
        click: function() {
          window.parent.ee.emit('tools.post.tumblr');
        }
    })
  );
  submenu.append(
    new gui.MenuItem({
        label: 'Wordpress',
        click: function() {
          window.parent.ee.emit('tools.post.wordpress');
        }
    })
  );

  return submenu;
};