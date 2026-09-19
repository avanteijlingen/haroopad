define([
		'txt!tpl/modal-save.html'
	], 
	function(html) {
		$('#dialogs').append(html);

		var tabCnt = 0;
		var View = Backbone.View.extend({
			el: '#save-dialog',

			events: {
				'click ._dont_save': 'dontSaveHandler',
				'click ._save': 'saveHandler',
				'click ._cancel': 'cancelHandler',
				// 'keydown': 'keydownHandler'
			},

			initialize: function() {
				this.$el.i18n();

				/* Every button carries data-dismiss="modal", and Escape or a
				 * click on the backdrop closes the dialog too. Anything that
				 * closes it without the user picking Save or Don't Save is a
				 * cancel, and the window needs to hear about that so it can
				 * drop the close it was holding. */
				this.$el.on('hidden.bs.modal', function() {
					if (this._choice) {
						return;
					}

					this.trigger('cancel');
				}.bind(this));
			},

			show: function() {
				this._choice = null;
				this.$el.modal('show');
				this.$('._save').focus();
			},

			hide: function() {
				this.$el.modal('hide');
			},

			keydownHandler: function(e) {
				if (e.keyCode == 9) {
					tabCnt++;

					switch(tabCnt % 3) {
						case 0 :
							this.$('._dont_save').focus();
						break;
						case 1 :
							this.$('._cancel').focus();
						break;
						case 2 :
							this.$('._save').focus();
						break;
					}

					e.preventDefault();
				}
			},

			saveHandler: function() {
				this._choice = 'save';
				this.trigger('save');
				this.hide();
			},

			cancelHandler: function() {
				/* no _choice, so hiding reports a cancel */
				this.hide();
			},

			dontSaveHandler: function() {
				this._choice = 'dont-save';
				this.trigger('dont-save');
				this.hide();
			}
		});

		return View;
});