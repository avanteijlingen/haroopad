/**
 * Presentation window (the "shower" slide deck), controller side.
 *
 * Under NW.js this reached straight into the child window's JS context:
 *
 *     this.win.window.update(window.ee, doc.toJSON(), file.toJSON())
 *
 * passing a live EventEmitter and Backbone JSON. Neither survives an Electron
 * window boundary, so the contract is now plain data over the window bus:
 *
 *   controller -> pad          'presentation.request'
 *   pad        -> controller   'presentation.data', {html, title}, {dirname, basename}
 *   controller -> deck window  'presentation.update', {html, title}, {dirname, basename}
 *   deck       -> controller   'exit.presentation'
 *
 * The deck page gets a tiny local `ee` shim (src/box/presentation/js/bridge.js)
 * that turns its `ee.emit('exit.presentation')` into that last message.
 */
define(['window/WindowManager'], function(WindowMgr) {

  var PT;
  var View = Backbone.View.extend({
    win: null,
    loaded: false,
    pending: null,

    initialize: function() {},

    start: function() {
      this.loaded = false;
      this.pending = null;

      this.win = global.gui.Window.open('file://' + global.PATHS.boxes + '/presentation/index.html', {
          title: 'Haroopad Presentation',
          toolbar: false,
          show: false,
          width: 800,
          height: 450,
          // icon: "logo.png",
          // resizable: false,
          position: 'center',
          frame: false,
          fullscreen: true
        });

      this.win.on('loaded', function() {
        this.win.removeAllListeners('loaded');
        this.loaded = true;
        if (this.pending) this.push(this.pending);
        this.show();
      }.bind(this));

      this.win.on('close', function() {
        this.hide();
        this.close(true);
      });

      this.win.on('closed', function() {
        PT.win = null;
        PT.loaded = false;
        PT.pending = null;
      });

      this.win.on('leave-fullscreen', function() {
        this.win && this.win.close();
      }.bind(this));

      this.win.on('enter-fullscreen', function() {
      }.bind(this));

      /* ask the active pad for a serialisable snapshot of its document */
      this.request();
    },

    request: function() {
      /* WindowMgr.actived survives window closes; window.activedWindow is only
         refreshed on the 'actived' event and can go stale */
      var child = (WindowMgr && WindowMgr.actived) || window.activedWindow;

      if (child) {
        child.window.ee.emit('presentation.request');
      } else {
        /* no pad is tracked as active: ask every window, whoever owns a
           document answers */
        window.ee.emit('presentation.request');
      }
    },

    /* data is { doc: {html, title}, file: {dirname, basename} } */
    push: function(data) {
      if (!this.win) return;

      if (!this.loaded) {
        this.pending = data;
        return;
      }

      this.win.window.ee.emit('presentation.update', data.doc, data.file);
    },

    show: function() {
      // this.win.maximize();
      this.win.show();
      // this.win.enterFullscreen();
      this.win.focus();
    }
  });

  PT = new View;

  /* the pad's answer, and any later document change while the deck is open */
  window.ee.on('presentation.data', function(doc, file) {
    PT.push({ doc: doc || {}, file: file || {} });
  });

  window.ee.on('menu.view.presentation', function() {
    if (PT.win) {
      PT.win.focus();
      PT.request();
      return;
    }

    PT.start();

  });

  /* Escape inside the deck comes back over the bus */
  window.ee.on('exit.presentation', function() {
    if (PT.win) PT.win.close();
  });

  return PT;
});
