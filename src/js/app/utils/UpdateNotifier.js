/*
 * Update notifier.
 *
 * Historically this polled http://pad.haroopress.com/upgrade.json, a domain that no
 * longer exists. It now queries the GitHub releases API (the URL comes from the root
 * package.json as `app.upgrade` and is surfaced as global.Manifest.app.upgrade) and
 * compares the release `tag_name` against the running version.
 *
 * Every failure path (offline, rate limited, 404, bad JSON) is swallowed silently:
 * an update check must never produce a dialog, a console error or an unhandled
 * rejection.
 */
define([
    'utils/NewsNotifier'
  ], function(News) {
	var gui = require('./js/lib/gui'),

		manifest = global.Manifest,
		url = (manifest.app && manifest.app.upgrade) || '',
		currVersion = manifest.version,

		/* populated from the latest successful check */
		serverInfo = {};

	/* "v0.14.0" / "0.14.0-beta.1" -> [0, 14, 0] */
	function parseVersion(version) {
		var parts = String(version || '')
			.replace(/^[vV]/, '')
			.split('-')[0]
			.split('.');

		return [0, 1, 2].map(function(i) {
			var n = parseInt(parts[i], 10);
			return isNaN(n) ? 0 : n;
		});
	}

	/* true when a is strictly newer than b */
	function isNewer(a, b) {
		var left = parseVersion(a),
			right = parseVersion(b);

		for (var i = 0; i < 3; i++) {
			if (left[i] > right[i]) return true;
			if (left[i] < right[i]) return false;
		}

		return false;
	}

	function updateCheck(newVersion, force) {
		if (!newVersion || !isNewer(newVersion, currVersion)) {
			if (force) window.ee.emit('up.to.date.haroopad', currVersion);
			return;
		}

		window.ee.emit('update.haroopad', currVersion, newVersion);
	}

	function check(force) {
		if (!url) {
			if (force) window.ee.emit('up.to.date.haroopad', currVersion);
			return;
		}

		/* GitHub rejects requests without a User-Agent with 403 */
		fetch(url, {
			headers: {
				'Accept': 'application/vnd.github+json',
				'User-Agent': 'haroopad/' + currVersion
			}
		}).then(function(res) {
			if (!res.ok) throw new Error('HTTP ' + res.status);
			return res.json();
		}).then(function(release) {
			serverInfo = {
				version: release.tag_name,
				release: release.html_url,
				download: {}
			};

			manifest.app.info = serverInfo;

			updateCheck(serverInfo.version, force);
		}).catch(function() {
			/* silent by design - see the header comment */
		});
	}

	window.ee.on('check.version', function(force) {
		try { check(force); } catch (e) {}
	});

	window.ee.on('download.haroopad', function() {
		var link = serverInfo.release || manifest.homepage;
		if (link) gui.Shell.openExternal(link);
	});

	window.ee.on('release.note.haroopad', function() {
		if (serverInfo.release) gui.Shell.openExternal(serverInfo.release);
	});

});
