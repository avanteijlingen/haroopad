define([
		'file/File.tmp.opt'
	],

	function(TmpOpt) {
		var fs = require('fs-extra'),
			path = require('path');

		var tmp = TmpOpt.get('files') || [];
		var appTmpDataPath = global.PATHS.tmp;

		/* Document models live in the pad windows now; the controller only
		 * passes plain descriptions { fileEntry, tmp, readOnly } around. */
		function checkTemporary() {
			var tmpFile;

			tmp.slice().forEach(function(uid, idx) {
				tmpFile = path.join(appTmpDataPath, uid);
		
				if (fs.existsSync(tmpFile)) {
					window.ee.emit('tmp.file.open', { fileEntry: tmpFile, tmp: true });
				} else {
					TmpOpt.remove(uid);
				}
			});
		}

		var fileApp = {
			open: function(fileEntry) {
				return { fileEntry: fileEntry };
			},

			loadTemporary: function() {
				checkTemporary();
			}
		};

		//disabled last file restore 
		window.ee.on('clear.lastfiles', function() {
			fs.removeSync(appTmpDataPath);
			TmpOpt.clearAll();
		});

		return fileApp;
});