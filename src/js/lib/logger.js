/*
 * Crash logger. Loaded after js/lib/gui/bootstrap.js in every window, so
 * global.PATHS (computed by the main process) is already available.
 *
 * Logs land in <userData>/.error/YYYY/MM/DD.log.
 *
 * The old NW.js `process.on('userException')` hook is gone: it was an NW.js-only
 * event that Electron never emits.
 */
;(function() {
  var path = require('path'),
      fs = require('fs-extra'),
      moment = require('moment'),
      logRoot = (global.PATHS && global.PATHS.logs) ||
                path.join(require('./js/lib/gui').App.dataPath, '.error'),
      errDir = path.join(logRoot, moment().format('YYYY/MM')),
      errFile = path.join(errDir, moment().format('DD') + '.log');

  try { fs.mkdirsSync(errDir); } catch (e) {}

  function write(message) {
    try { fs.appendFileSync(errFile, message); } catch (e) {}
  }

  process.on('uncaughtException', function(err) {
    write(
        ' Information | Description \n'
      + '-------------|-----------------------------\n'
      + ' Type        | UncaughtException \n'
      + ' Date        | '+ new Date +'\n'
      + ' Agent       | '+ navigator.userAgent +'\n'
      + ' Stack       | '+ (err && err.stack) +'\n\n'
    );
  });

  process.on('unhandledRejection', function(reason) {
    write(
        ' Information | Description \n'
      + '-------------|-----------------------------\n'
      + ' Type        | UnhandledRejection \n'
      + ' Date        | '+ new Date +'\n'
      + ' Agent       | '+ navigator.userAgent +'\n'
      + ' Stack       | '+ ((reason && reason.stack) || reason) +'\n\n'
    );
  });

  global._tracking = function() {
    window.addEventListener('error', function(err) {
      write(
          ' Information | Description \n'
        + '-------------|-----------------------------\n'
        + ' Type        | Error\n'
        + ' Date        | '+ new Date +'\n'
        + ' Agent       | '+ navigator.userAgent +'\n'
        + ' File        | '+ String(err.filename || '').replace(process.cwd(), '') +'\n'
        + ' Line Number | '+ err.lineno +'\n'
        + ' Message     | '+ err.message +'\n\n'
      );
    }, false);
  }

})(window);
