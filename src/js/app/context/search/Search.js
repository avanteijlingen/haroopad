define([
		'context/search/Google'
	],
	function(Google) {

		var gui = require('./js/lib/gui'),
	        win = gui.Window.get();
		var Search = new gui.Menu();

		Search.append(Google);

		return Search;
	});