/**
 * Language-pack updater — intentionally a no-op.
 *
 * Haroopad used to download the `haroopad-locales` repository at runtime with the
 * abandoned `download-github-repo` package, driven by an update feed on
 * `pad.haroopress.com`. That endpoint is dead and the package is unmaintained, so
 * there is no backing service for the feature any more.
 *
 * Locales are now BUNDLED with the application (`global.PATHS.locales`,
 * `src/locales`) and ship with each release, which is what the download used to
 * provide. The module is kept so the requirejs dependency list in
 * `js/preferences/index.js` still resolves; it never shows its dialog.
 */
define([], function() {
  return {
    /** kept for API compatibility with the old updater; does nothing */
    check: function() {},
    update: function() {}
  };
});
