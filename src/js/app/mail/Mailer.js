define([
	], function() {

	var nodemailer = require("nodemailer");

	var _glo = {
		getEmailAdvertisementHTML: function() {
			return ''
				// + '<hr>'
				+ '<p style="display: block; width: 99.6%; line-height:1.6em; /*text-align: center; */padding: 5px 0; font-size:1em; border: 1px solid #e5e5e5;/* background-color:rgb(253,246,227);*/ border-radius: 3px;">'
				+ '	<span>'
				+ '   <img src="http://pad.haroopress.com/assets/images/logo-small.png" align="absmiddle" width="40" height="40" style="float:left; margin:0 10px;"/>'
				+ '   Sent from My <strong><a href="http://pad.haroopress.com/" target="_blank">Haroopad</a></strong> <br/>'
				+ '   The Next Document processor based on Markdown '
	 			+ '	- <a href="http://pad.haroopress.com/user.html#download" target="_blank">Download</a>'
				+ ' </span>'
				+ '</p>';
		},

		getEmailAdvertisementMD: function() {
			return ''
				+ '\n* * * * * * * *  \n'
				+ '\t> Sent from My **[Haroopad](http://pad.haroopress.com)**  \n'
				+ '\t> The Next Document processor based on Markdown  \n'
				+ '\t> [Download Haroopad](http://pad.haroopress.com/user.html#download)  \n';
		}
	}

	// create reusable transport method (opens pool of SMTP connections)
	var email, transport, tid;

	// setup e-mail data with unicode symbols
	var mailOptions = {
	    from: "", // sender address
	    to: "", // list of receivers
	    subject: "", // Subject line
	    text: ""/*, // plaintext body
	    html: "<b>Hello world ✔</b>" // html body*/
	}

	function closeTransport() {
		window.clearTimeout(tid);

		if (!transport) {
			return;
		}

		try {
			transport.close();
		} catch (e) {
			// nodemailer throws nothing here normally; be defensive anyway
		}

		transport = null;
	}

	function createTransport(email, password, service) {
		// create reusable transport method (opens a pool of SMTP connections)
		// nodemailer >= 2 still resolves well-known providers from `service`
		closeTransport();

		transport = nodemailer.createTransport({
		    service: service || "Gmail",
		    pool: true,
		    auth: {
		        user: email,
		        pass: password
		    }
		});
	}

	function send(cb) {
		if (!transport) {
			cb(new Error('No mail transport configured. Call setCredential() first.'));
			return;
		}

		// nodemailer >= 2 returns a promise from sendMail but still honours a callback
		transport.sendMail(mailOptions, function(error, response) {
			cb(error, response);

			if (error) {
				closeTransport();
				return;
			}

		    window.clearTimeout(tid);
		    tid = window.setTimeout(function() {
		    	closeTransport(); // shut down the connection pool, no more messages
		    }, 1000 * 60 * 10);
		});

	}

	window.ee.on('cancel.send.email', function() {
		closeTransport();
	});

	return {
		setCredential: function(mailInfo) {
			createTransport(mailInfo.from, mailInfo.password);
		},

		send: function(mailInfo, fileInfo, next) {
			// mailInfo.title, fileInfo.markdown, fileInfo.emailHTML, mailInfo.to, mailInfo.mode, fileInfo.attachments
			var subject = mailInfo.title;
			var to = mailInfo.to;
			var mode = mailInfo.mode;
			var html = fileInfo.emailHTML;
			var text = fileInfo.markdown;

			if (to.indexOf('@tumblr.com') > -1) {
				if (mode == 'md') {
					subject = '!m '+ subject;
				}
				
			} else {
				html += _glo.getEmailAdvertisementHTML();
				text += _glo.getEmailAdvertisementMD();
			}

			if (mode == 'html') {
				delete mailOptions.text;
				mailOptions.html = html || '';
			} else {
				delete mailOptions.html;
				mailOptions.text = text || '';
			}

			mailOptions.from = mailInfo.from;
			mailOptions.to = to;
			mailOptions.subject = subject;
			// nodemailer >= 2 expects { filename, path, cid } and no `attachments`
			// key at all when there is nothing to attach
			if (fileInfo.attachments && fileInfo.attachments.length) {
				mailOptions.attachments = fileInfo.attachments;
			} else {
				delete mailOptions.attachments;
			}

			send(next);
		}
	}

});