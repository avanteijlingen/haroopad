# Haroopad-fork

I just like Haroopad but its not been updated in over 10 years.

So i set LLM's on the task to make it into what I want from it.


# Haroopad

**Haroopad** is a markdown enabled document processor for creating web-friendly documents.

You can author professional-looking documents of various formats: blog posts, slides, presentations, reports, email and more.

Haroopad gives you the same editing experience regardless of the platform you are working on. It runs on all three major operating systems—Windows, Mac OS X, and Linux.

![haroopad icon](http://pad.haroopress.com/assets/images/logo-small.png)

### New Features (v0.13.2)

* New Features
  - Presentation Mode - [reference](http://pad.haroopress.com/page.html?f=how-to-write-presentation)
  - Drawing Diagram (flowchart, Sequence Diagram) - [reference](http://pad.haroopress.com/page.html?f=how-to-draw-diagram)
* New Syntax
  - Tasklist(GFM) - [reference](http://pad.haroopress.com/page.html?f=how-to-manage-tasklist)
* Added new code language & themes - [reference](http://pad.haroopress.com/page.html?f=how-to-write-fenced-code-block)
  - total 112 languages(swift, gradle ...) and 49 themes

### More changelog

* Bugs
  - Fixed No confirm save in Windows on close Window with [X]
  - Fixed The file path can't contain space in Windows
* Enhancements
  - Update Codemirror Editor v4.8
  - Support Font in Math
  - Support \left and \right in Math
  - Support custom gfm code block delimiters
  - Enhance GFM tabls's column width issue
  - Enhance Two subsequent tables are rendered with no space
  - Enhance Equation rendering issues

### Main Features

* Support cross platform
  - Window
  - Mac OS X
  - Linux 32/64
* Theme for editing
  - Themes for editor 30 styles
  - Syntax highlighting in fenced code block on editor
  - Ruby, Python, PHP, Javascript, C, HTML, CSS
  - based on CodeMirror
* Live Preview themes
  - 7 themes based [markdown-css](https://github.com/rhiokim/markdown-css)
* Syntax Highlighting
  - 71 languages & 44 styles based on highlight.js
* Custom Theme
  - Style based on CSS(Cascading Style Sheet)
* Font Size
  - Editor and Viewer font size control using Preference Window & Shortcuts
* Embedding Rich Media Contents - v0.8
  - Video, Audio, 3D, Text, Open Graph and oEmbed
  - About 100 Major Internet Services(Youtube, SoundCloud, Flickr...) Support
  - Drag & Drop support
* Display Mode - v0.8
  - Default(Editor:Viewer), Reverse(Viewer:Editor), Only Editor, Only Viewer (View > Mode)
* Insert Current Date & Time - v0.8
  - Various Format support (Insert > Date & Time)
* HTML to Markdown - v0.8
  - Drag & Drop your selected text on Web Browser
* Options for markdown parsing
* CLI(Command Line Interface) - v0.12.1
  - `$ haroopad -f [ /path/to/a.md ./path/to/b.md ]`: files
  - `$ haroopad --mode`: only view or edit mode
    + `$ haroopad --mode view`: view mode
    + `$ haroopad --mode edit`: edit mode
* Outline View
* Vim Key-binding
* Export to PDF, HTML
* Styled HTML copy to clipboard for WYSIWYG editors
* Auto Save & Restore
* Document state information
* Tab or Spaces for Indentation
* Colum(Single, Two and Three) Layout View
* Markdown Syntax Help Dialog
* Markdown Folding
* Import and Export settings

### Internationalization

- English
- Korea (한국어)
- Spanish (Español) - [davegomez](https://github.com/davegomez)
- Chinese Simplified (中文) - [toiletfreak](https://github.com/toiletfreak)
- German (Deutsch) - [Tobias Mücksch](https://github.com/tobiasmuecksch)
- Vietnamese (Tiếng Việt) - [nguyenkinh](https://github.com/nguyenkinh)
- Russian (Русский) - [aprilix](https://github.com/aprilix)
- Greek (Ελληνικά) - [pdudis](https://github.com/pdudis)
- Portuguese (Portuguesa) - [alexandre mbm](https://github.com/alexandre-mbm)
- Japanese (日本語) - [Toshiyuki Tega](https://github.com/Toshiyuki-Tega)
- Italy (Italiano) - [Daniele Pitrolo](https://github.com/Zeriuno)
- Indonesia (Bahasa Indonesia) - [Reza Faiz A. Rahman](https://github.com/rezafaizarahman)
- Turkey  (Türkçe) - [Eray AYDIN](https://github.com/erayaydin)
- French (Français) - [MarcBoyer](https://github.com/MarcBoyer), [Daniel Ménard](https://github.com/daniel-menard)

### Enhanced Markdown Syntax

* Added `[TOC]` Syntax
  - Now you can easily embed table of content in documents.
  - Left Align: `[TOC "float:left"]`
  - Right Align: `[TOC "float:right"]`
* `![]()` Extended image syntax
  - `![alt text](url "title" "css")`
* [Gitub Flavored Markdown](http://github.github.com/github-flavored-markdown/) & extensions
  - Syntax highlighting
  - Table
  - URL autolinking
  - Strikethrough
  - Smartypants
* Mathematics Expression
  - Inline Expression: `$$$...$$$`
  - Block Expression: `$$...$$`
  - Added Option inline mathematics expression (**$**, $$$)
* Added Superscript, Subscript
  - `Sup^superscript^`, `Sub~subscript~`
* Extended Image Syntax
  - If `![](path/*.mp3)` then `<audio>` / extensions mp3, ogg
  - If `![](path/*.mp4)` then `<video>` / extensions mp4, ogv, webm
* Footnote
  - Footnote: `[^identity]`
  - Footnote Reference: `[^identity]: text`
* Tasklist
  - Task: `- [ ]`
  - Task (Done): `- [x]`

### Building from source

Haroopad runs on [Electron](https://www.electronjs.org/). The old NW.js / Grunt /
bower toolchain has been removed; everything is driven by npm scripts.

**Prerequisites**

* [Node.js](https://nodejs.org/) 18 or newer (20 LTS recommended)
* npm 9 or newer (ships with Node)

No native compilation is required, so there is no need for `nw-gyp`, `gconf`,
Python or a C++ toolchain.

**Install**

```sh
npm install
```

**Run**

```sh
npm start
```

**Automated check**

```sh
npm run smoke
```

The smoke run launches the app headlessly, opens a pad window, types markdown,
verifies the live preview (highlight.js, tasklists, MathJax), saves a file, opens
the Preferences window and checks that a changed setting reaches the pad. It
prints a `SMOKE_REPORT` and exits non-zero if any renderer error was logged.

**Packaging**

The quickest route is the build script at the repo root, which builds both
platforms and picks Wine or Docker automatically for the Windows target:

```sh
./build.sh            # Linux + Windows
./build.sh linux      # Linux only
./build.sh win        # Windows only
./build.sh clean      # wipe dist/ first, then build everything
```

The underlying npm scripts are also available directly:

```sh
npm run dist:linux        # AppImage + tar.gz
npm run dist:win          # Windows installer + portable .exe (needs Wine)
npm run dist:win:docker   # the same, in a container that already has Wine
npm run dist              # both platforms
```

Packaging uses [electron-builder](https://www.electron.build/) and writes to
`dist/`:

| file                           | what it is                               |
| ------------------------------ | ---------------------------------------- |
| `Haroopad-<version>.AppImage`  | portable Linux build, `chmod +x` and run |
| `haroopad-<version>.tar.gz`    | the same build as a plain archive        |
| `Haroopad Setup <version>.exe` | Windows installer (NSIS, per-user)       |
| `Haroopad <version>.exe`       | Windows portable executable              |

Building the Windows target on Linux needs Wine. If you would rather not
install it, `npm run dist:win:docker` runs the build inside
`electronuserland/builder:wine`; it only needs Docker. The GitHub Actions
workflow in `.github/workflows/build.yml` builds both platforms on every push
and uploads the artifacts.

Two notes for Linux packagers:

* The `pacman` target is not enabled. electron-builder's bundled `fpm` needs
  `libcrypt.so.1`, which current Arch no longer ships; install
  `libxcrypt-compat` if you want to add it back.
* `./scripts/smoke.sh` accepts the same environment variables as `npm run
  smoke` and additionally prints the report after killing the app, which is
  handy in CI.

**Manual testing**

`TESTING.md` lists the things the automated smoke run cannot cover, such as the
native file dialogs, drag and drop, printing and sending email.

### TODO

* Plugin System
* Integrating with cloud environments

### And more?

* Official site : [http://pad.haroopress.com][haroopad]
* Blog & Manual : [http://pad.haroopress.com/page.html][blog]
* User echo : [http://haroopad.userecho.com][userecho]

Don't forget to check Preferences, lots of useful options are there.

Follow official social account [@haroopad](https://twitter.com/haroopad) and developer [@rhiokim](https://twitter.com/rhiokim) on Twitter for the latest news.

For feedback, use the menu `Help` - `User Echo`

[haroopad]: http://pad.haroopress.com
[blog]: http://pad.haroopress.com/page.html
[userecho]: http://haroopad.userecho.com

### [LICENSE](https://github.com/rhiokim/haroopad/blob/develop/LICENSE)
