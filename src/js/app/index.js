var fs = require('fs'),
    path = require('path');

var gui = window.gui;

//fixed text.js error on node-webkit
require.nodeRequire = require;

/**
 * require.js 환경 설정
 */
requirejs.config({
  baseUrl: 'js/app',
  waitSeconds: 30,
  locale: 'ko-kr',
  paths: {
    tpl: '../../tpl',
    vendors: '../vendors',
    parse: 'core/Parser'
  },
  config: {
    text: { env: 'xhr' },
    txt: { env: 'xhr' }
  }
});

var lng = global.LOCALES._lang.split('-')[0];
i18n.init({
  lng: lng
}, function() {
  i18n.addResourceBundle(lng, 'menu', global.LOCALES['menu']);
  i18n.setDefaultNamespace('menu');

  MenuBar();

  requirejs.onError = function (e) {
    console.log(e.stack)
    console.error('requirejs error', e.requireModules, e.stack);
  };

  requirejs([
    'context/Context',
    'mail/Mailer',
    'file/File',
    'tools/Tools',
    'window/Window',
    'window/WindowManager',
    'utils/UpdateNotifier'
  ], function(/*DB,*/ Context, Mailer, FileMgr, Tools, Window, WindowMgr, Updater) {

    // window.ee.on('change.markdown', function(md, options, cb) {
    //   cb = typeof options === 'function' ? options : cb;
    //   options = typeof options === 'object' ? options : undefined;
      
    //   var html = Parser(md, options);

    window.ee.on('send.email', function(fileInfo, mailInfo) {
      var child = WindowMgr.actived;
      var Emails = store.get('Emails') || {};
      var addrs = Emails.addrs || [];

      Mailer.setCredential(mailInfo);
      Mailer.send(mailInfo, fileInfo, function(err, response) {

        if (err) {
          child.window.ee.emit('fail.send.email', err);
          return;
        }

        if (mailInfo.remember) {
          addrs.push(mailInfo.to);
          addrs = _.uniq(addrs);

          store.set('Emails', {
            to: mailInfo.to,
            from: mailInfo.from,
            mode: mailInfo.mode,
            addrs: addrs,
            remember: mailInfo.remember
          });
        }

        child.window.ee.emit('sent.email');
      });
    })
    
    /* files handed over by a second instance or the OS (open-with) */
    gui.App.on('open', function(file, opts) {
      WindowMgr.open(file, { mode: opts && opts.mode });
    });

    /* load temporary files */
    FileMgr.loadTemporary();

    //open file with commend line
    if (global.argv._.length > 0) {
      global.argv._.forEach(function(f) {
        var f = path.resolve(f);
        var ext = path.extname(f).replace('.', '');
        ext = ext.toLowerCase();

        if (global.mdexts.indexOf(ext) > -1 && fs.existsSync(f)) {
          WindowMgr.open(f, {
            mode: global.argv.mode
          });
        }
      });
    }

    if (WindowMgr.length() < 1) {
      WindowMgr.open();
    }

    //TODO not perfect
    //update check logic
    window.setTimeout(function() {
      window.ee.emit('check.version');
    }, 2000);

  });

});
