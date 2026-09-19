define([
		'context/util',
		// 'context/format/Text',
		'context/search/Search',
		'context/editor/themes',
		'context/editor/themesUser'
	],
	function(util, Search, Themes, ThemesUser) {

		var gui = require('./js/lib/gui');
		var Context = new gui.Menu();

		function add(item) {
			Context.append(item);
		}

		/* clipboard commands: handled by the pad's own editor
		   (src/js/pad/editor/Editor.js listens on window.ee) */
		add(util.menuItem({
			label: i18n.t('edit.cut'),
			click: function() {
				util.emit('context.cut');
			}
		}));

		add(util.menuItem({
			label: i18n.t('edit.copy'),
			click: function() {
				util.emit('context.copy');
			}
		}));

		add(util.menuItem({
			label: i18n.t('edit.paste'),
			click: function() {
				util.emit('context.paste');
			}
		}));

		add(util.menuItem({
			label: i18n.t('edit.delete'),
			click: function() {
				util.emit('context.delete');
			}
		}));

		add(util.menuItem({
			label: i18n.t('edit.select-all'),
			click: function() {
				util.emit('context.selectall');
			}
		}));

		add(util.sepItem());

		// Do not support!!!
		// add(util.menuItem({
		// 	label: i18n.t('Format'),
		// 	enabled: false,
		// 	submenu: TextFormatMenu
		// }));
		
		// add(util.sepItem());

		// add(util.menuItem({
		// 	label: i18n.t('edit.services'),
		// 	enabled: false,
		// 	submenu: Search
		// }));

		add(util.menuItem({
			label: i18n.t('view.editor.theme'),
			submenu: Themes
		}));

		add(util.menuItem({
			label: i18n.t('view.editor.theme-user'),
			submenu: ThemesUser
		}));
		
		add(util.sepItem());

		/* the preferences window belongs to the controller */
		add(util.menuItem({
			label: i18n.t('file.preferences'),
			click: function() {
				util.emitParent('context.preferences');
			}
		}));

		return Context;
	});
