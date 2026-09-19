define([
  'viewer/Viewer.userTheme.StyleParser'
], function(parse) {
  var fs = require('fs-extra');
  var path = require('path');
  var view, config = store.get('Viewer') || {};
  var baseDir = path.join(gui.App.dataPath, 'Themes', 'viewer');
  var userCssDir = path.join(baseDir, '.userStyle.css') || '';

  var iframe = $('#viewer iframe')[0];

  function loadUserCss(userTheme) {
    if (!userTheme) {
      return '';
    }

    var themeFile = path.join(baseDir, userTheme);
    themeFile += '.css';

    try {
      return fs.readFileSync(themeFile, 'utf8');
    } catch (e) {}
  }

  var CustomStyle = Backbone.View.extend({
    el: document.createElement('link'),

    initialize: function() {
      var head = iframe.contentDocument.getElementsByTagName('head')[0];
      // var css = loadUserCss(config.userTheme);
      this.el.setAttribute('rel', 'stylesheet');
      this.el.setAttribute('type', 'text/css');
      this.el.setAttribute('href', userCssDir);

      head.appendChild(this.el);

      // if (css) {
      //   this.updateStyle(css);
      // }
    },

    init: function() {
      this.changeUserTheme(config.userTheme);
    },

    updateStyle: function(css) {
      /* No user theme selected (or the file is gone): write an empty
       * stylesheet rather than handing undefined to the CSS parser, so
       * clearing the theme actually removes the previous one. */
      var style = '';

      if (css) {
        try {
          style = parse(css) || '';
        } catch (e) {
          /* a hand-edited theme with broken CSS must not break the preview */
          console.error('user viewer theme could not be parsed', e);
          return;
        }
      }

      try {
        fs.writeFileSync(path.join(baseDir, '.userStyle.css'), style, 'utf8');
        this.el.setAttribute('href', userCssDir +'?'+ new Date().getTime());
      } catch (e) {
        console.error('user viewer theme could not be written', e);
      }
    },

    changeUserTheme: function(theme) {
      var css = loadUserCss(theme);
      this.updateStyle(css);
    }
  });

  view = new CustomStyle;

  window.parent.ee.on('preferences.viewer.userTheme', view.changeUserTheme.bind(view));

  window.ee.on('viewer.theme.user', view.changeUserTheme.bind(view));

  return view;
});