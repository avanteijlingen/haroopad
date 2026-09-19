/*
 * News notifier - DISABLED.
 *
 * This used to fetch a markdown "news" document from pad.haroopress.com (advertised
 * by the same upgrade.json feed the update notifier polled) and push it into empty
 * editors via the `up.to.date.news` event.
 *
 * That server is gone and there is no replacement service, so the feature is a no-op.
 * The module is kept so requirejs still resolves `utils/NewsNotifier` (UpdateNotifier
 * depends on it) and so the `up.to.date.news` listeners in src/js/app/window/Window.js
 * and src/js/pad/index.js simply never fire.
 *
 * If a news feed is ever reintroduced, implement it here: emit
 * `window.ee.emit('up.to.date.news', markdownString)`.
 */
define([], function() {
  return function news() {
    /* intentionally empty */
  };
});
