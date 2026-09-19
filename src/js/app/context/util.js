define([ 'module' ], function( module ) {

  var gui = window.gui || require('./js/lib/gui');

  /**
   * Context menus are built inside the pad window now. Two buses are in play:
   *
   *   emit()   -> `window.ee`, the window's own bus. Everything the pad
   *               handles itself (clipboard, themes, exports, e-mail) goes
   *               here directly instead of round-tripping through the
   *               controller and back.
   *   emitParent() -> `window.parent.ee`, the controller's bus (over IPC). Only
   *               for what the controller genuinely owns: the preferences
   *               window and the presentation window.
   *
   * In the controller window `window.parent` is the window itself, so both
   * helpers still reach the controller bus and nothing breaks if these modules
   * are loaded there.
   */
  function emitLocal() {
    var ee = window.ee;
    if (ee) ee.emit.apply(ee, [].slice.call(arguments));
  }

  function emitParent() {
    var ee = (window.parent && window.parent.ee) || window.ee;
    if (ee) ee.emit.apply(ee, [].slice.call(arguments));
  }

  /* controller broadcasts (preferences.*) land on the parent bus in a child
     window and on the local bus in the controller; listen on both, but only
     once if they are the same object. */
  function onPreferences(evt, fn) {
    var parent = window.parent && window.parent.ee;
    if (parent) parent.on(evt, fn);
    if (window.ee && window.ee !== parent) window.ee.on(evt, fn);
  }

  module.exports = {
    menuItem: function(options) {
      return new gui.MenuItem(options);
    },

    sepItem: function() {
      return new gui.MenuItem({
        type: 'separator'
      });
    },

    /* emit on this window's own bus */
    emit: emitLocal,

    /* emit on the controller's bus */
    emitParent: emitParent,

    /* subscribe to a controller broadcast from either window role */
    onPreferences: onPreferences
  }
});
