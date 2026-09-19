window.MenuBarToolsSend = function () {
  var gui = require('./js/lib/gui');
  var submenu = new gui.Menu();

  submenu.append(
    new gui.MenuItem({
        label: 'Email',
        click: function() {
          window.parent.ee.emit('tools.send.email');
        }
    })
  );
  submenu.append(
    new gui.MenuItem({
        label: 'Github',
        click: function() {
          window.parent.ee.emit('file.push.gist');
        }
    })
  );

  return submenu;
};