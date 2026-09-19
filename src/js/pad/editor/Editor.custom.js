define([
  'editor/Editor.custom.StyleParser'
], function(parse) {
  var fs = require('fs');
  var path = require('path');
  var view, config = store.get('Editor') || {};

  function loadUserCss(userTheme) {
    if (!userTheme) {
      return;
    }

    var themeFile = path.join(gui.App.dataPath, 'Themes', 'editor', userTheme);
    themeFile += '.css';

    try {
      return fs.readFileSync(themeFile, 'utf8');
    } catch (e) {}
  }

  var CustomStyle = Backbone.View.extend({
    el: document.createElement('style'),

    initialize: function() {
      var head = document.getElementsByTagName('head')[0];
      var css = loadUserCss(config.userTheme);
      head.appendChild(this.el);

      if (css) {
        this.updateStyle(css);
      }
    },

    updateStyle: function(css) {
      /* No user theme selected (or the file is gone): clear the override
       * instead of handing undefined to the CSS parser, which threw. */
      if (!css) {
        this.$el.text('');

        if (nw.editor) {
          nw.editor.refresh();
        }

        return;
      }

      try {
        var style = parse(css);
        this.$el.text(style || '');

        if (nw.editor) {
          nw.editor.refresh();
        }
      } catch (e) {
        /* a hand-edited theme with broken CSS must not take the editor down */
        console.error('user editor theme could not be parsed', e);
      }
    },

    changeUserTheme: function(theme) {
      var css = loadUserCss(theme);
      this.updateStyle(css);
    }
  });

  view = new CustomStyle;

  /* exposed so the smoke test can assert theme clearing behaviour */
  window.__customStyleView = view;

  window.parent.ee.on('preferences.editor.userTheme', view.changeUserTheme.bind(view));

  window.ee.on('editor.theme.user', view.changeUserTheme.bind(view));
});