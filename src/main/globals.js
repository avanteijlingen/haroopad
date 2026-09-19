'use strict';
/**
 * Computes everything the NW.js version used to put on the shared Node `global`
 * (PATHS, THEMES, LOCALES, SHORTCUTS ...). Runs once in the main process and is
 * handed to every renderer through a single synchronous IPC call at bootstrap.
 */
const path = require('path');
const fs = require('fs-extra');
const { app } = require('electron');
const minimist = require('minimist');

const APPROOT = path.join(app.getAppPath(), 'src');
const MANIFEST = require(path.join(app.getAppPath(), 'package.json'));

const MDEXTS = ['md', 'mmd', 'markdown', 'mdown', 'markdn', 'mkd', 'mkdn', 'mdwn',
  'mdtxt', 'mdtext', 'mdml'];

const DATETIME = ['l', 'L', 'll', 'LL', 'lll', 'LLL', 'llll', 'LLLL', 'Do MMMM YYYY'];

const EDITOR_THEMES = ['default', '3024-day', '3024-night', 'abcdef', 'ambiance-mobile', 'ambiance',
  'base16-dark', 'base16-light', 'bespin', 'blackboard', 'cobalt', 'colorforth', 'dracula', 'eclipse',
  'elegant', 'erlang-dark', 'hopscotch', 'icecoder', 'isotope', 'lesser-dark', 'liquibyte', 'material',
  'mbo', 'mdn-like', 'midnight', 'monokai', 'neat', 'neo', 'night', 'paraiso-dark', 'paraiso-light',
  'pastel-on-dark', 'railscasts', 'rubyblue', 'seti', 'solarized light', 'solarized dark', 'the-matrix',
  'tomorrow-night-bright', 'tomorrow-night-eighties', 'ttcn', 'twilight', 'vibrant-ink', 'xq-dark',
  'xq-light', 'yeti', 'zenburn'];

const VIEWER_THEMES = ['clearness', 'clearness-dark', 'node-dark', 'github', 'haroopad',
  'solarized-dark', 'solarized-light', 'metro-vibes', 'metro-vibes-dark', 'wood', 'wood-ri'];

/* NW.js style key descriptions; the gui shim converts them to Electron accelerators */
const SHORTCUTS = {
  new_window: { key: 'n', modifiers: 'cmd' },
  save: { key: 's', modifiers: 'cmd' },
  save_as: { key: 's', modifiers: 'cmd-shift' },
  open: { key: 'o', modifiers: 'cmd' },
  send_email: { key: 'e', modifiers: 'cmd-shift' },
  html_copy_to_clip: { key: 'c', modifiers: 'cmd-shift' },
  shtml_copy_to_clip: { key: 'c', modifiers: 'cmd-shift-alt' },
  export_html: { key: 'x', modifiers: 'cmd-shift' },
  close: { key: 'w', modifiers: 'cmd' },
  close_win: { key: 'f4', modifiers: 'cmd' },
  show_preference: { key: ',', modifiers: 'cmd' },
  print: { key: 'p', modifiers: 'cmd' },
  exit: { key: 'q', modifiers: 'cmd' },

  perspective_edit_view: { key: '1', modifiers: 'shift-ctrl' },
  perspective_view_edit: { key: '2', modifiers: 'shift-ctrl' },
  perspective_only_edit: { key: '3', modifiers: 'shift-ctrl' },
  perspective_only_view: { key: '4', modifiers: 'shift-ctrl' },
  perspective_set_default: { key: '\\', modifiers: 'shift-ctrl' },
  perspective_move_right: { key: ']', modifiers: 'shift-ctrl-alt' },
  perspective_move_left: { key: '[', modifiers: 'shift-ctrl-alt' },
  perspective_minus_view: { key: ']', modifiers: 'shift-ctrl' },
  perspective_plus_view: { key: '[', modifiers: 'shift-ctrl' },

  toggle_line_number: { key: 'g', modifiers: 'shift-ctrl' },
  show_markdown_help: { key: 'h', modifiers: 'shift-ctrl' },
  toggle_vim_key_binding: { key: 'y', modifiers: 'shift-ctrl' },
  show_table_of_content: { key: 'u', modifiers: 'shift-ctrl' },
  enter_fullscreen: { key: 'enter', modifiers: 'cmd' },
  enter_fullscreen_win: { key: 'f11', modifiers: 'cmd' },
  escape_fullscreen: { key: 'esc', modifiers: '' },
  enter_presentation: { key: 'p', modifiers: 'cmd-alt' },
  enter_presentation_win: { key: 'p', modifiers: 'cmd-alt' },
  editor_font_size_up: { key: 'up', modifiers: 'alt' },
  editor_font_size_down: { key: 'down', modifiers: 'alt' },
  viewer_font_size_up: { key: 'up', modifiers: 'shift-alt' },
  viewer_font_size_down: { key: 'down', modifiers: 'shift-alt' },

  cut: { key: 'x', modifiers: 'cmd' },
  copy: { key: 'c', modifiers: 'cmd' },
  paste: { key: 'v', modifiers: 'cmd' },
  select_all: { key: 'a', modifiers: 'cmd' },
  delete_line: { key: 'd', modifiers: 'cmd' },
  undo: { key: 'z', modifiers: 'cmd' },
  redo: { key: 'z', modifiers: 'cmd-shift' },
  go_to_doc_start: { key: 'up', modifiers: 'cmd' },
  go_to_doc_end1: { key: 'end', modifiers: 'cmd' },
  go_to_doc_end2: { key: 'down', modifiers: 'cmd' },
  go_to_group_left: { key: 'left', modifiers: 'alt' },
  go_to_group_right: { key: 'right', modifiers: 'alt' },
  go_to_line_start: { key: 'left', modifiers: 'cmd' },
  go_to_line_end: { key: 'right', modifiers: 'cmd' },
  delete_group_before: { key: 'backspace', modifiers: 'alt' },
  delete_group_after1: { key: 'backspace', modifiers: 'ctrl-alt' },
  delete_group_after2: { key: 'delete', modifiers: 'alt' },
  indent_less: { key: '[', modifiers: 'cmd' },
  indent: { key: ']', modifiers: 'cmd' },
  folding: { key: 'q', modifiers: 'ctrl' },

  insert_date_time: { key: 'd', modifiers: 'shift-ctrl' },

  insert_md_header1: { key: '1', modifiers: 'cmd' },
  insert_md_header2: { key: '2', modifiers: 'cmd' },
  insert_md_header3: { key: '3', modifiers: 'cmd' },
  insert_md_header4: { key: '4', modifiers: 'cmd' },
  insert_md_header5: { key: '5', modifiers: 'cmd' },
  insert_md_header6: { key: '6', modifiers: 'cmd' },
  insert_md_bold: { key: 'b', modifiers: 'cmd' },
  insert_md_italic: { key: 'i', modifiers: 'cmd' },
  insert_md_link: { key: 'l', modifiers: 'cmd' },
  insert_md_inline_code: { key: 'k', modifiers: 'cmd' },
  insert_md_embed: { key: 'e', modifiers: 'cmd' },
  insert_md_strike: { key: 'u', modifiers: 'cmd' },
  insert_md_highlight: { key: 't', modifiers: 'cmd' },
  insert_md_fenced_code: { key: '', modifiers: 'cmd' },
  insert_md_task: { key: 'c', modifiers: 'shift-ctrl' },
  insert_md_underline: { key: 'u', modifiers: 'shift-ctrl' },
  insert_md_image: { key: 'i', modifiers: 'shift-ctrl' },
  insert_md_footnotes: { key: 'f', modifiers: 'shift-ctrl' },
  insert_md_footnotes_ref: { key: 'r', modifiers: 'shift-ctrl' },
  insert_md_toc: { key: 't', modifiers: 'shift-ctrl' },
  insert_md_ordered_list: { key: 'o', modifiers: 'shift-ctrl' },
  insert_md_unordered_list: { key: 'l', modifiers: 'shift-ctrl' },
  insert_md_math_inline: { key: 'j', modifiers: 'shift-ctrl' },
  insert_md_math_block: { key: 'm', modifiers: 'shift-ctrl' },
  insert_md_blockquote: { key: 'q', modifiers: 'shift-ctrl' },
  insert_md_section_break: { key: 'enter', modifiers: 'shift-alt' },
  insert_md_page_break: { key: 'enter', modifiers: 'shift-ctrl' },
  insert_md_sentence_break: { key: 'enter', modifiers: 'shift-ctrl-alt' },

  start_search: { key: 'f', modifiers: 'cmd' },
  find_next: { key: 'g', modifiers: 'cmd' },
  find_previous: { key: 'g', modifiers: 'cmd-shift' },
  replace: { key: 'f', modifiers: 'cmd-alt' },
  replace_win: { key: 'f', modifiers: 'shift-ctrl' },
  replace_all: { key: 'f', modifiers: 'cmd-shift-alt' },
  replace_all_win: { key: 'r', modifiers: 'shift-ctrl' },

  'close-preference': { key: 'esc', modifiers: '' }
};

if (process.platform !== 'darwin') {
  Object.keys(SHORTCUTS).forEach(function (id) {
    SHORTCUTS[id].modifiers = SHORTCUTS[id].modifiers.replace('cmd', 'ctrl');
  });
}

function listCss(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(function (f) { return /\.css$/.test(f) && !/\.min\.css$/.test(f) && f.charAt(0) !== '.'; })
      .map(function (f) { return f.replace(/\.css$/, ''); })
      .sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
  } catch (e) {
    return [];
  }
}

/* copy bundled editor/viewer themes into the user's data dir once (users may edit them) */
function copyThemes(src, dest) {
  fs.mkdirpSync(dest);
  listCss(src).forEach(function (name) {
    const target = path.join(dest, name + '.css');
    if (!fs.existsSync(target)) {
      try { fs.copySync(path.join(src, name + '.css'), target); } catch (e) { /* ignore */ }
    }
  });
}

function parseArgv(argv, cwd) {
  // packaged: [exe, ...args]   dev: [electron, ., ...args]
  const raw = app.isPackaged ? argv.slice(1) : argv.slice(2);
  const parsed = minimist(raw.filter(function (a) { return !/^--(no-sandbox|inspect|remote-debugging-port|enable-logging)/.test(a); }), { boolean: ['f'] });
  const files = (parsed._ || []).concat(parsed.f && typeof parsed.f === 'string' ? [parsed.f] : [])
    .map(String)
    .map(function (f) { return path.resolve(cwd || process.cwd(), f); })
    .filter(function (f) {
      const ext = path.extname(f).replace('.', '').toLowerCase();
      return MDEXTS.indexOf(ext) > -1 && fs.existsSync(f);
    });
  return { _: files, mode: parsed.mode };
}

function loadLocales(localesDir, requested) {
  const LANGS = fs.readJsonSync(path.join(localesDir, 'locales.json'));
  const available = fs.readdirSync(localesDir).filter(function (d) {
    return fs.existsSync(path.join(localesDir, d, 'menu.json'));
  });
  const byLower = {};
  available.forEach(function (d) { byLower[d.toLowerCase()] = d; });

  const locale = String(requested || 'en').toLowerCase();
  const prefix = locale.split('-')[0];
  const pick = byLower[locale] || byLower[prefix] || 'en';

  const LOCALES = { _lang: pick };
  ['menu', 'pad', 'preference'].forEach(function (ns) {
    LOCALES[ns] = fs.readJsonSync(path.join(localesDir, pick, ns + '.json'));
  });
  return { LANGS: LANGS, LOCALES: LOCALES };
}

let cache = null;

function compute() {
  if (cache) return cache;

  const dataPath = app.getPath('userData');
  const hljsStyles = path.join(path.dirname(require.resolve('highlight.js/package.json')), 'styles');

  const PATHS = {
    app: APPROOT,
    locales: path.join(APPROOT, 'locales'),
    docs: path.join(APPROOT, 'docs'),
    css_code: hljsStyles,
    js: path.join(APPROOT, 'js', 'vendors'),
    boxes: path.join(APPROOT, 'box'),
    theme_res_editor: path.join(APPROOT, 'js', 'vendors', 'haroopad-theme', 'editor'),
    theme_res_viewer: path.join(APPROOT, 'js', 'vendors', 'haroopad-theme', 'viewer'),
    theme_dest_editor: path.join(dataPath, 'Themes', 'editor'),
    theme_dest_viewer: path.join(dataPath, 'Themes', 'viewer'),
    db: path.join(dataPath, 'LevelDB'),
    tmp: path.join(dataPath, '.tmp'),
    logs: path.join(dataPath, '.error')
  };

  fs.mkdirpSync(PATHS.tmp);
  copyThemes(PATHS.theme_res_editor, PATHS.theme_dest_editor);
  copyThemes(PATHS.theme_res_viewer, PATHS.theme_dest_viewer);

  const THEMES = {
    editor: EDITOR_THEMES,
    viewer: VIEWER_THEMES,
    code: listCss(hljsStyles),
    user: {
      editor: listCss(PATHS.theme_dest_editor),
      viewer: listCss(PATHS.theme_dest_viewer)
    }
  };

  const locales = loadLocales(PATHS.locales, app.getLocale());

  const Manifest = {
    name: MANIFEST.productName || MANIFEST.name,
    version: MANIFEST.version,
    description: MANIFEST.description,
    app: MANIFEST.app || {},
    window: {
      icon: 'logo.png',
      toolbar: false,
      show: false,
      width: 0,
      height: 0,
      min_width: 700,
      min_height: 350,
      frame: true
    },
    maintainers: MANIFEST.maintainers || [],
    bugs: MANIFEST.bugs
  };

  cache = {
    EXECPATH: path.dirname(process.execPath),
    APPROOT: APPROOT,
    DATAPATH: dataPath,
    PATHS: PATHS,
    THEMES: THEMES,
    LANGS: locales.LANGS,
    LOCALES: locales.LOCALES,
    Manifest: Manifest,
    SHORTCUTS: SHORTCUTS,
    DATETIME: DATETIME,
    mdexts: MDEXTS,
    argv: parseArgv(process.argv, process.cwd()),
    platform: process.platform
  };
  return cache;
}

module.exports = { compute: compute, parseArgv: parseArgv, APPROOT: APPROOT, MDEXTS: MDEXTS };
