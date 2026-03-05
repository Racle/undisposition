# Undisposition [Racle fork]

## Installation

Chrome: <https://chrome.google.com/webstore/detail/undisposition-racle-fork/bbppejejjfancffmhncgkhjdaikdgagc>
Firefox: <https://addons.mozilla.org/en-US/firefox/addon/undisposition-racle-fork/>

## Description

Removes Content-Disposition: attachment HTTP header to allow view files instead of downloading them. Extension icon acts as toggle.

Removes Content-Disposition: attachment HTTP header to allow view files instead of downloading them.
Sometimes you want to see files in Firefox inline, but Firefox started to download it.
This is quite irritating. This extension relaxes this behavior.
Extension icon acts as quick toggle on/off.

Original extension: Undisposition: https://chrome.google.com/webstore/detail/undisposition/hjfncfijclafkkfifjelofbeclipplfi
Original code: https://github.com/cielavenir/ctouch/tree/master/undisposition
Issue this fork is based on: https://github.com/cielavenir/ctouch/issues/1
(Thanks to GianPaolo70!)

Original description (from chrome extension):

Remove Content-Disposition: attachment HTTP header.
Sometimes you want to see files in Chrome inline, but Chrome started to download it.
This is quite irritating. This extension relaxes this behavior.

## Branches

[master](https://github.com/Racle/undisposition/tree/master): Firefox support

[release/chrome-manifest-v3](https://github.com/Racle/undisposition/tree/release/chrome-manifest-v3): Chrome with manifest V3 support

## Changelog

### Version 0.0.7

New permission required:
The "tabs" permission is used to access tab URLs in order to display per-tab badge indicators showing whether the extension is active or disabled on the current domain.

- Added allowlist mode as alternative to blocklist (Fixes #10, #2)
- Added per-tab badge indicator: blue (active), gray (skipped), pink (disabled) (Fixes #5)
- Smart Content-Disposition handling: preserves header for binary types like zip, rar, exe (Fixes #6)
- Added modern image format support: webp, avif, apng, svg (Fixes #9)
- Rewrite text/csv Content-Type to text/plain for inline display (Fixes #11)
- Default blacklist seeded with googleusercontent.com on first install (Fixes #7)
- Modernized settings page with card layout, segmented control, and save toast
- Improved URL parsing for file extension detection
- Added Makefile with zip, test, and clean targets
- Added local test server for development
- Ported all improvements to Chrome MV3 branch with declarativeNetRequest URL-based Content-Type rewriting

### Version 0.0.6

Blacklist bugfix

### Version 0.0.5

Added blacklist support.
Right click Undisposition icon => Settings to set domains to blacklist.

### Version 0.0.4

Fixed https://github.com/Racle/undisposition/issues/1
PDF and some common file types should be showing up correctly
