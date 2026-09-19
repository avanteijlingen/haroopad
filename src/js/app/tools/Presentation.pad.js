/**
 * Pad-side half of the presentation window.
 *
 * The controller owns the presentation BrowserWindow but the document lives
 * here, in the pad. Under NW.js the controller simply reached into the pad's
 * JS context (`window.activedWindow.file.doc`); across an Electron window
 * boundary only plain data may travel, so the controller asks and the pad
 * answers with a serialisable snapshot.
 *
 *   controller -> pad : 'presentation.request'
 *   pad -> controller : 'presentation.data', { doc: {html, title}, file: {dirname, basename} }
 *
 * The pad also pushes a fresh snapshot whenever the rendered HTML changes so
 * the open deck stays in sync.
 */
define([], function() {

  /* true while a deck is open, so we only push updates when they matter */
  var live = false;

  function snapshot() {
    var file = window.nw && window.nw.file;
    if (!file) return null;

    var doc = file.doc;

    return {
      doc: {
        html: (doc && typeof doc.html === 'function' ? doc.html() : '') ||
              (doc && doc.get && doc.get('html')) || '',
        title: (doc && doc.get && doc.get('title')) || file.get('basename') || ''
      },
      file: {
        dirname: file.get('dirname') || '',
        basename: file.get('basename') || ''
      }
    };
  }

  function send() {
    var data = snapshot();
    if (data) window.parent.ee.emit('presentation.data', data.doc, data.file);
  }

  function onRequest() {
    live = true;
    send();
  }

  /* the controller asks when it opens the deck: targeted at this window
     (window.ee) or broadcast to every window (window.parent.ee) */
  window.ee.on('presentation.request', onRequest);
  window.parent.ee.on('presentation.request', onRequest);

  /* stop pushing once the deck is gone */
  window.parent.ee.on('exit.presentation', function() { live = false; });

  /* keep an open deck in sync with the document */
  var file = window.nw && window.nw.file;
  if (file && file.doc) {
    file.doc.on('change:html', function() {
      if (live) send();
    });
  }

  return { snapshot: snapshot, send: send };
});
