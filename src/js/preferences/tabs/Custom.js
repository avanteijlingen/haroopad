define([
		'tabs/Custom.opt'
	], function(options) {
		var fs = require('fs');
		var path = require('path');
		var gui = require('./js/lib/gui');

		var config = options.toJSON() || {};

		options.bind('change', function(model) {
			var prop, en,
				data = model.changedAttributes();

			for (prop in data) {
				en = 'preferences.custom.'+ prop;
				window.parent.ee.emit(en, data[prop]);
			}
		});

		/**
		 * Lists the `*.css` files in `dir` keyed by theme name. Replaces the
		 * abandoned `readdir` package: `readdir.readSync(dir, ['*.css'],
		 * ABSOLUTE_PATHS + CASELESS_SORT)` returned absolute file paths sorted
		 * ignoring case, which is what this reproduces.
		 */
		function loadCSSFiles(dir) {
			var name, themes = {};
			var csses;

			try {
				csses = fs.readdirSync(dir).filter(function(f) {
					return /\.css$/i.test(f) && f.charAt(0) !== '.';
				}).sort(function(a, b) {
					return a.toLowerCase().localeCompare(b.toLowerCase());
				}).map(function(f) {
					return path.join(dir, f);
				});
			} catch (e) {
				csses = [];
			}

			csses.forEach(function(css, idx) {
				name = path.basename(css).replace(/\.css$/i,'');
				themes[name] = {
					id: idx,
					name: name,
					path: css
				}
			});

			return themes;
		}

		var ViewerTabView = Backbone.View.extend({
			el: '#custom-tab',

			events: {
				'change select[name=customTheme]': 'changeCustomTheme',
				'click #custom-theme-open': 'openDirWindow',
				'click #custom-theme-reload': 'reloadThemes'
			},

			initialize: function() {
				this.setPath(config.themeDir);
				this.setThemeData(config.themes || []);

				this.$('select[name=customTheme]').select2({
                	placeholder: i18n.t('custom.select-theme')
				}).select2("val", config.theme && config.theme.name);
			},

			clearOptions: function() {
				var blankOpt = $('<option>').text('');
				var clearOpt = $('<option>').attr('name', 'not-select').text('Not Select');
				this.$('select[name=customTheme]').empty().append(blankOpt);
				this.$('select[name=customTheme]').append(clearOpt);
			},

			setPath: function(dir) {
				this.$('#custom-theme-path').val(dir);
				this.$('#custom-theme-path').attr('title', dir);
			},

			setThemeData: function(themes) {
				var prop, option, item;

				this.clearOptions();

				for(prop in themes) {
					items = themes[prop];

					option = $('<option>').attr('value', prop).text(prop);
					this.$('select[name=customTheme]').append(option);
				}

				this.$('select[name=customTheme]').select2({
                	placeholder: "Select Your Theme",
				});
			},

			// native directory chooser replaces the old `<input nwdirectory>`
			openDirWindow: function(e) {
				var dir = gui.dialogs.directory({
					title: i18n.t('custom.select-theme'),
					dir: options.get('themeDir')
				});

				if (!dir) return;

				this.changeDir(dir);
			},

			changeDir: function(dir) {
				var themes;

				themes = loadCSSFiles(dir);
				
				options.set({ themes: themes });
				options.set({ themeDir: dir });

				this.setPath(dir);
				this.setThemeData(themes);
			},

			reloadThemes: function(e) {
				var dir = options.get('themeDir');
				var themes = loadCSSFiles(dir);
				
				options.set({ themes: themes });

				this.setThemeData(themes);
			},

			changeCustomTheme: function(e) {
				var themes = options.get('themes');
				var el = $(e.target);

				//not select theme
				if (el.attr('name') == 'not-select') {
					options.set({ theme: {} });
					return;
				}

				options.set({ theme: themes[e.val] });
			}
		});

		return new ViewerTabView;

});