define([
	'ui/dialog/Dialogs',
	'ui/exports/Exports'
], function(Dialogs, Exports) {
	var gui = require('./js/lib/gui');
	var win = gui.Window.get();
	var moment = require('moment');

	var orgTitle = i18n.t('pad:untitled');
	var edited = false,
		delayClose = false;

	var config = store.get('Window') || {};

	if (config.isFullscreen) {
		setTimeout(function() {
			win.enterFullscreen();
		}, 150);
	} else {
		nw.resizeTo(config.width, config.height);
	}

	function close() {
		nw.emit('destory');
		nw.file.trigger('close');

		win.hide();

		if (!win.isFullscreen) {
			config.width = win.width;
			config.height = win.height;
			config.x = win.x;
			config.y = win.y;
		}

		config.zoom = win.zoom;
		config.isFullscreen = win.isFullscreen;
		store.set('Window', config);

		win.setBadgeLabel('');
		win.close(true);
	}

	win.on('close', function() {
		if (edited) {
			/* was a typo (`delyClose`) in the NW.js version, so "Save" from the
			 * close dialog saved the file but never completed the close */
			delayClose = true;
			Dialogs.save.show();
			return;
		} else {
			close();
		}
	});

	Dialogs.save.bind('save', function() {
		delayClose = true;
		window.ee.emit('menu.file.save');
	});

	Dialogs.save.bind('dont-save', function() {
		// nw.file.trigger('close');
		close();
	});

	Dialogs.save.bind('cancel', function() {
		/* The user backed out of closing (Cancel, Escape, or a click outside
		 * the dialog). This latch used to stay set for the life of the window,
		 * so the next successful save -- Ctrl+S minutes later, with no dialog
		 * in sight -- ran close() and the window vanished as if it had crashed. */
		delayClose = false;
	});

	var reloadFile;
	Dialogs.reload.bind('reload', function() {
		window.ee.emit('reload');
		// window.parent.ee.emit('file.reload', reloadFile, function(err, data) {
		// 	window.ee.emit('file.reloaded', data);
		// });
	});

	window.ee.on('file.update', function(file) {
		reloadFile = file;
		Dialogs.reload.show(file);
	});

	window.ee.on('file.close', function() {
		win.emit('close');
	});

	window.ee.on('file.opened', function() {
		var opt = nw.file.toJSON();

		if (opt.tmp) {
			// nw.title = 'Restored (writen at ' + moment(opt.ctime).format('LLL') + ')';
			nw.title = i18n.t('pad:restored-file').replace('{{date}}', moment(opt.ctime).format('LLL'));
		} else {
			nw.title = orgTitle = opt.basename || orgTitle;
		}

		if (opt.readOnly) {
			nw.title += ' ('+ i18n.t('pad:read-only-file') +')';
		}
	});
	// window.ee.on('file.opened', function(opt) {
	// 	win.title = orgTitle = opt.basename || orgTitle;

	// 	if (win._params.readOnly) {
	// 		win.title += ' (read only)';
	// 	}
	//  	});

	nw.on('file.saved', function(opt) {
		win.title = orgTitle = opt.basename;

		if (delayClose) {
			close();
		}

		delayClose = false;
		edited = false;
	});

	window.ee.on('change.before.markdown', function(markdown, html, editor) {
		win.title = orgTitle + ' ('+ i18n.t('pad:modified') +')';
		edited = true;

		/* Editing again means any close we were part way through is stale. The
		 * dialog's own cancel clears the latch; this also covers a save that
		 * threw (a read-only path, a full disk) and so never reported back. */
		delayClose = false;
	});

	window.addEventListener('keydown', function(e) {

		var evt = document.createEvent("Events");
		evt.initEvent("keydown", true, true);

		evt.view = e.view;
		evt.altKey = e.altKey;
		evt.ctrlKey = e.ctrlKey;
		evt.shiftKey = e.shiftKey;
		evt.metaKey = e.metaKey;
		evt.keyCode = e.keyCode;
		evt.charCode = e.charCode;

		window.parent.dispatchEvent(evt);

	}, false);

	/**
	 * Context menus.
	 *
	 * NW.js popped these from the hidden controller window at *screen*
	 * coordinates, which needed per-platform fudge factors. Electron attaches a
	 * popup to a window and takes coordinates relative to it, so the menus are
	 * built and popped right here in the pad, at plain client coordinates.
	 * `ev` is set when the event was delegated out of the viewer iframe.
	 */
	$('#editor').bind('contextmenu', function(e, ev) {
		e.preventDefault();

		requirejs(['context/Pad'], function(Context) {
			if (ev) {
				Context.popupViewer(ev);
			} else {
				Context.popupEditor(e);
			}
		});

		return false;
	});


	var resizeTimeout;
	window.onresize = function(e) {

		clearTimeout(resizeTimeout);

		resizeTimeout = setTimeout(function() {
			config.width = win.width;
			config.height = win.height;
			config.x = win.x;
			config.y = win.y;

			store.set('Window', config);
		}, 250);

	}

	win.on('enter-fullscreen', function() {
		document.querySelector('.CodeMirror-gutters').style.height = '3000px';

	});

	win.on('leave-fullscreen', function() {
		config.isFullscreen = false;
		store.set('Window', config);
	});

	window.ee.on('view.fullscreen', function() {
		var isFull = win.isFullscreen;

		if (isFull) {
			win.leaveFullscreen();
			config.isFullscreen = win.isFullscreen;
			store.set('Window', config);
		} else {
			/* codemirror redraw delay bug */
			// document.querySelector('.CodeMirror-gutters').style.height = '3000px';
			win.enterFullscreen();
		}
	});

	/* update haroopad */
	window.ee.on('update.haroopad', function(currVersion, newVersion, link) {
		Notifier.notify('<a href="http://pad.haroopress.com/page.html?f=release-notes" style="color:yellow">'+ i18n.t('pad:upgrade.note') +'</a>, <a href="http://pad.haroopress.com/user.html#download" style="color:yellow">'+ i18n.t('pad:upgrade.download') +'</a>', i18n.t('pad:upgrade.message') + ' <span style="color:yellow">v' + newVersion +'</span>', undefined, 10000);
		// var noti = NotificationWrapper('Haroopad', i18n.t('pad:upgrade.message') +'\n'+ newVersion);
		
		// noti.addEventListener('click', function() {
		// 	global.Shell.openExternal('http://pad.haroopress.com/user.html#download');
		// });
	});

	/* up to date haroopad */
	window.ee.on('up.to.date.haroopad', function(version) {
		NotificationWrapper('Haroopad', i18n.t('pad:upgrade.uptodate'));
		// Notifier.notify(i18n.t('pad:upgrade.newest'), i18n.t('pad:upgrade.uptodate'), undefined, 5000);
	});

	window.ee.on('print.editor', function() {
		// TODO print after popup window
	});

	keymage('defmod-enter', function() {
		window.ee.emit('view.fullscreen');
	}, { preventDefault: true });

	keymage('defmod-f11', function() {
		window.ee.emit('view.fullscreen');
	}, { preventDefault: true });

	keymage('esc esc', function() {
		if (win.isFullscreen) {
			win.leaveFullscreen();
			config.isFullscreen = win.isFullscreen;
			store.set('Window', config);
		}
	});

	win.on('focus', function() {
		window.parent.ee.emit('focus');
	});
	win.on('blur', function() {
		window.parent.ee.emit('blur');
	});

	window.ondragover = function(e) {
		e.preventDefault();
		return false
	};
	window.ondrop = function(e) {
		e.preventDefault();
		return false
	};
});