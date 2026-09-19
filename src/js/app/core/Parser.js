define([
    'core/Lexer',
    'core/InlineLexer',
    'core/Renderer',
    'core/plugins/TOC',
    'core/plugins/Tasklist'
  ],
  function(Lexer, InlineLexer, Renderer, TOC, Tasklist) {

    // preference changes arrive on the controller bus (window.parent.ee in a
    // pad window); the parser itself runs inside the pad window.
    var bus = (window.parent && window.parent.ee) || window.ee;

    var marked = require('./js/vendors/marked');
    /* `stored` is null until the preferences window writes its defaults,
     * which on a first run happens after this module loads. */
    var stored = store.get('Markdown');
    var options = stored || {
          breaks: true,
          smartLists: true,
          langPrefix: '',
          smartypants: true
    };

    /**
     * Build the full option set the lexer/parser need.
     *
     * `renderer` MUST be re-applied every time: a preference change used to
     * call `Lexer(options)` with just the stored markdown settings, which
     * dropped the custom renderer and silently turned task lists back into
     * literal "[ ]" text and broke the other custom nodes.
     */
    function buildOptions(opts) {
      return merge({}, marked.defaults, opts || {}, { renderer: Renderer });
    }

    var defaults = buildOptions(options);

    var current = merge({}, options);

    Renderer.options = defaults;

    var lexer = Lexer(defaults);
    marked.InlineLexer = InlineLexer(defaults);
    // marked.setOptions(defaults);
    
    var parse = window.marked = function(src) {
      var tokens = lexer.lex(src);
      // var toc = TOC(tokens);
      var tasks = Tasklist(tokens);
      // var title = toc.tokens[0] && toc.tokens[0].heading;
      var res = {};

      // res.title = title || i18n.t('untitled');

      // if (toc) {
      //   res.toc = toc;
      // }

      if (tasks.length) {
        res.tasks = tasks;
      }

      res.tokens = tokens;  //parser 에 의해서 tokens 유실됨
      res.html = marked.parser(tokens, lexer.options);

      Renderer.finish();
      return res;
    }

    /**
     * `opts` may be a partial set: the preferences tabs broadcast individual
     * properties as they change. Layer it over the settings we already have
     * so an update never silently drops the others (dropping `langPrefix`
     * put the "lang-" class back on fenced code and broke highlighting).
     */
    function applyOptions(opts) {
      current = merge({}, current, opts || {});

      var next = buildOptions(current);

      /* `new marked.Renderer()` captured marked's built-in defaults when the
       * Renderer module loaded, and marked's own `code()` reads
       * `this.options.langPrefix` from that snapshot. Without refreshing it
       * the fenced-code class stayed "lang-js" instead of "js", and the
       * viewer's highlighter (which matches the class against
       * hljs.listLanguages()) silently gave up. */
      Renderer.options = next;

      lexer = Lexer(next);
      marked.InlineLexer = InlineLexer(next);
    }

    bus.on('preferences.markdown.change', function(options) {
      applyOptions(options);

      window.ee.emit('preferences.markdown.change.after');
    });

    /* The stored markdown settings may not exist yet when this module loads:
     * on a first run the preferences window writes them slightly later. The
     * parser would then keep marked's built-in defaults for the whole session
     * (langPrefix "lang-", so highlight.js never matched a language, and the
     * custom math/task rules stayed off).
     *
     * Poll briefly for the key to appear and adopt it once it does. */
    var settleTries = 0;
    var settle = setInterval(function() {
      var settled = store.get('Markdown');

      if (settled) {
        clearInterval(settle);

        /* Adopt the persisted settings if they differ from what this module
         * captured at load time. */
        if (JSON.stringify(settled) !== JSON.stringify(stored)) {
          applyOptions(settled);
          window.ee.emit('preferences.markdown.change.after');
        }

        return;
      }

      if (++settleTries > 40) clearInterval(settle);
    }, 100);

    return parse;
});