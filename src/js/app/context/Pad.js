/**
 * Context menus for the pad window.
 *
 * Under NW.js every window shared one JS context, so the pad asked the hidden
 * controller window to pop a menu up at *screen* coordinates. An Electron menu
 * belongs to a window, so the menus are now built and popped inside the pad
 * itself, at client coordinates (`Menu#popup(x, y)` -> Electron's
 * `menu.popup({ window: currentWindow, x, y })`). That also removes every
 * platform-specific fudge factor the old code carried.
 *
 * The menu items keep emitting exactly the same event names as before; only
 * the bus they are emitted on changed. See `context/util` for the routing.
 */
define([
    'context/Editor',
    'context/Viewer'
  ],
  function(Editor, Viewer) {

    function clientPos(e) {
      if (!e) return { x: 0, y: 0 };
      var x = e.clientX, y = e.clientY;
      if (x == null) x = e.pageX;
      if (y == null) y = e.pageY;
      return { x: x || 0, y: y || 0 };
    }

    /* the preview runs in an iframe, so its client coordinates need the
       iframe's offset inside the pad document added to them */
    function frameOffset() {
      var frame = document.querySelector('#viewer>iframe') ||
                  document.querySelector('iframe');
      if (!frame || !frame.getBoundingClientRect) return { x: 0, y: 0 };
      var box = frame.getBoundingClientRect();
      return { x: box.left, y: box.top };
    }

    var exports = {
      Editor: Editor,
      Viewer: Viewer,

      popupEditor: function(e) {
        var p = clientPos(e);
        Editor.popup(p.x, p.y);
      },

      popupViewer: function(ev) {
        var p = clientPos(ev),
            off = frameOffset();
        Viewer.popup(p.x + off.x, p.y + off.y);
      }
    };

    /* kept for completeness: the old cross-window entry points still work,
       they just pop the menu in this window now */
    window.ee.on('popup.context.editor', function(x, y) {
      Editor.popup(x || 0, y || 0);
    });
    window.ee.on('popup.context.viewer', function(x, y) {
      Viewer.popup(x || 0, y || 0);
    });

    return exports;
  });
