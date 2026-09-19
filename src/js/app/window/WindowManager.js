define([
	'exports',
	'file/File',
	'file/Recents'
], function(exports, File, Recents) {

	var gui = global.gui;
	var win = gui.Window.get();
	var closeAll = false;

	/* windows are keyed by their BrowserWindow id; each entry is a gui.Window
	 * wrapper decorated with the serialisable state the pad reports back:
	 *   fileEntry, pristine (no edits and no file yet), created_at, _args */
	var windows = {},
		openning = false,
		realCount = 0;

	var config = store.get('Window') || {};
	var top = config.y,
		left = config.x;

	//fixed for cmd-q app quit issue
	gui.App.manifest.window.width = config.width;
	gui.App.manifest.window.height = config.height;
	gui.App.manifest.window.frame = true;

	if (process.platform === 'darwin') {
		win.show();

		//CMD+Q app terminate in the hidden window.
	  var shortcut = new gui.Shortcut({
	    key : "Ctrl+Q",
	    active : function() {
	      window.ee.emit('closeAll');
	    }
	  });

	  window.ee.on('focus', function() {
		  gui.App.registerGlobalHotKey(shortcut);
		});

	  window.ee.on('blur', function() {
		  gui.App.unregisterGlobalHotKey(shortcut);
		});
	}

	function _updateStore() {
		config = store.get('Window') || {};
	}

	/**
	 * normalise what callers hand in (path string, { fileEntry, tmp, readOnly }
	 * or nothing) into a plain description the pad window can receive over IPC
	 */
	function describe(file) {
		if (!file) return null;
		if (typeof file === 'string') return { fileEntry: file };
		if (typeof file.toJSON === 'function') file = file.toJSON();
		return {
			fileEntry: file.fileEntry,
			tmp: !!file.tmp,
			readOnly: !!file.readOnly
		};
	}

	function getWindowByFile(name) {
		for (var prop in windows) {
			if (windows[prop].fileEntry && windows[prop].fileEntry == name) {
				return windows[prop];
			}
		}

		return;
	}

	function getLength() {
		return realCount;
	}

	function _add(newWin) {
		exports.actived = windows[newWin.id] = newWin;

		realCount++;

		newWin.on('closed', function() {
			if (!windows[this.id]) return;

			windows[this.id] = null;
			delete windows[this.id];
			realCount--;

			if (exports.actived === this) {
				exports.actived = null;
				// fall back to the most recently created remaining window
				var ids = Object.keys(windows);
				if (ids.length) exports.actived = windows[ids[ids.length - 1]];
			}

			if (!realCount) {
				exports.actived = null;

				if (process.platform !== 'darwin' || closeAll) {
					window.ee.emit('exit');
				}
			}
		});

		/* the pad reports its document state (fileEntry / pristine) */
		newWin.on('file.state', function(state) {
			state = state || {};
			this.fileEntry = state.tmp ? undefined : state.fileEntry;
			if (state.pristine !== undefined) this.pristine = !!state.pristine;
		});

		/* open file requested from the pad (open dialog) */
		newWin.on('file.open', function(fileEntry) {
			open(fileEntry);
			Recents.add(fileEntry);
		});

		newWin.on('file.saved', function(file) {
			this.fileEntry = file.fileEntry;
			this.pristine = false;
			Recents.add(file.fileEntry);
		});

		//window instance delivery to child window
		newWin.once('loaded', function() {
			_updateStore();

			/* initial exec */
			if (!top && !left) {
				this.setPosition('center');
				top = this.y;
				left = this.x;

				return;
			}

			top = top < 20 ? 40 : top;
			left = left < 20 ? 40 : left;

			if (config.height + top > window.screen.height) {
				top = 40;
			}

			if (config.width + left > window.screen.width) {
				left = 40;
			}

			if (realCount > 1) {
				left = left + 20;
				top = top + 20;
			}

			this.moveTo(left, top);
		});
	}

	/**
	 * `openning` debounces double-firing of "new window" (e.g. an accelerator
	 * and a menu click arriving together). It is cleared when the new pad
	 * reports back with `actived`.
	 *
	 * That reply travels over IPC now, so it can be late or, if the window
	 * fails to load, never arrive -- and the NW.js code had no way out of the
	 * latch, which permanently disabled File > New. Time-box it instead.
	 */
	var OPEN_DEBOUNCE_MS = 1500;
	var openningAt = 0;

	function isOpenning() {
		return openning && (Date.now() - openningAt) < OPEN_DEBOUNCE_MS;
	}

	function setOpenning(value) {
		openning = value;
		openningAt = value ? Date.now() : 0;
	}

	function open(file, args) {
		var fileEntry, newWin, existWin, desc;

		if (isOpenning() && !file) {
			return;
		}

		setOpenning(true);
		args = args || {};

		desc = describe(file);
		fileEntry = desc && !desc.tmp && desc.fileEntry;

		//이미 열려 있는 파일 일 경우
		existWin = fileEntry && getWindowByFile(fileEntry);

		if (existWin) {
			existWin.focus();
			setOpenning(false);
			return existWin;
		}

		//if already exist empty window
		if (desc && exports.actived && !exports.actived.fileEntry && exports.actived.pristine) {
			exports.actived.fileEntry = fileEntry || undefined;
			exports.actived.pristine = false;
			exports.actived.emit('file.opened', desc);
			exports.actived.focus();
			setOpenning(false);
			return exports.actived;
		}

		newWin = gui.Window.open('pad.html', _.extend({}, gui.App.manifest.window, {
			args: _.extend({}, args, { file: desc })
		}));
		newWin.parent = window;
		newWin.fileEntry = fileEntry || undefined;
		newWin.pristine = !desc;
		newWin.created_at = new Date().getTime();
		newWin._args = _.extend({}, args, { file: desc });

		_add(newWin);

		return newWin;
	}

	window.ee.on('actived', function(id) {
		var child = windows[id];
		if (!child) return;

		exports.actived = window.activedWindow = child;

		child.show(); //#346

		setOpenning(false);
	});

	window.ee.on('closeAll', function() {
		closeAll = true;
		gui.App.closeAllWindows();
	});

	gui.App.on('reopen', function() {
		if (realCount < 1) {
			open();
		}
	});

	//When quit app using Command+Q short, prevent close major window first.
	win.on('close', function() {
		closeAll = true;

		if (!realCount) {
			window.ee.emit('exit');
		}
	});

	exports.open = open;

	exports.length = getLength;

	exports.get = function(id) { return windows[id]; };

	/* diagnostics for the smoke harness */
	exports._state = function() {
		return { openning: openning, effective: isOpenning(), realCount: realCount, closeAll: closeAll };
	};

	exports.all = function() {
		return Object.keys(windows).map(function(id) { return windows[id]; });
	};

});
