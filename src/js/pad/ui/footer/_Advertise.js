define([
	],function() {

	var Adver = Backbone.View.extend({
		el: '#donate-btn',

		events: {
			'click': 'donateHandler'
		},

		initialize: function() {
			/* The popover opens only when the button is clicked; the markup
			 * carries data-trigger="click" and Bootstrap handles the toggle.
			 * It used to additionally pop itself open on a 10s timer (at once
			 * on a fresh profile, then every few hours), which it no longer
			 * does -- the box stays shut until the user asks for it. */
			this.$('button[data-toggle=popover]').popover({
				content: i18n.t('pad:donate.desc'),
				title: i18n.t('pad:donate.title')
			});
		},

		hide: function() {
			this.$('button[data-toggle=popover]').popover('hide');
		},

		donateHandler: function(e) {
			e.preventDefault();

			/* The link inside the popover closes it. preventDefault above also
			 * stops the href from navigating the pad window away from pad.html. */
			if (e.target.id === 'donate-link') {
				this.$('button[data-toggle=popover]').popover('hide');
			}
		}
	});

	return new Adver;

});
