/**
 * Controller-side context menu stub.
 *
 * Context menus used to be built here and popped at screen coordinates on
 * behalf of the pad window, because NW.js gave every window one shared JS
 * context. In Electron a popup menu belongs to a window, so the menus moved
 * into the pad (`context/Pad`, loaded by src/js/pad/index.js).
 *
 * The old `popup.context.*` requests are forwarded to the active pad window so
 * anything still emitting them keeps working.
 */
define([], function() {

	window.ee.on('popup.context.editor', function() {
		var child = window.activedWindow;
		if (child) child.window.ee.emit('popup.context.editor', 0, 0);
	});

	window.ee.on('popup.context.viewer', function() {
		var child = window.activedWindow;
		if (child) child.window.ee.emit('popup.context.viewer', 0, 0);
	});

	return {};
});
