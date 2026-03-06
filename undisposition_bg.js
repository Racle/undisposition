var active = true
if (typeof browser === 'undefined') {
  var browser = chrome
}

function loadOptions(callback) {
  browser.storage.local.get(['activeStatus', 'blacklist', 'listMode', 'allowlist', 'customUrlRules'], function (data) {
    if (data.activeStatus === undefined) {
      //at first install
      data.activeStatus = true
      // Seed default blacklist on first install
      if (!data.blacklist || data.blacklist.length === 0) {
        browser.storage.local.set({
          blacklist: ['googleusercontent.com'],
        })
      }
      saveOptions()
    }
    // Ensure listMode defaults to blocklist for existing users
    if (!data.listMode) {
      browser.storage.local.set({ listMode: 'blocklist' })
    }
    if (!data.allowlist) {
      browser.storage.local.set({ allowlist: [] })
    }
    // Seed default URL pattern rules if not yet set
    if (!data.customUrlRules) {
      browser.storage.local.set({
        customUrlRules: ['*gitlab.com*/artifacts/raw/*=auto'],
      })
    }
    active = data.activeStatus
    if (callback != null) callback()
  })
}

function saveOptions() {
  browser.storage.local.set({ activeStatus: active })
}

function updateUI() {
  // Set global defaults (used for tabs without per-tab overrides)
  var str = active ? 'Undisposition active, click to deactivate' : 'Undisposition disabled, click to activate'
  browser.action.setTitle({ title: str })
  browser.action.setBadgeText({ text: active ? '' : '\u2800' })
  if (!active) {
    browser.action.setBadgeBackgroundColor({ color: '#e91e63' })
  }

  if (active) {
    setDynamicRule()
  } else {
    removeDynamicRules()
  }

  // Refresh all visible tabs so per-tab badges/titles update immediately
  browser.tabs.query({}, function (tabs) {
    tabs.forEach(function (tab) {
      updateTabBadge(tab.id, tab.url)
    })
  })
}

async function updateTabBadge(tabId, url) {
  if (!active) {
    // Globally disabled: pink badge, click to activate
    browser.action.setTitle({ tabId: tabId, title: 'Undisposition disabled, click to activate' })
    browser.action.setBadgeText({ tabId: tabId, text: '\u2800' })
    browser.action.setBadgeBackgroundColor({ tabId: tabId, color: '#e91e63' })
    return
  }

  // Internal pages (chrome:, chrome-extension:, etc.) — no badge, no toggle
  if (!url || !url.startsWith('http')) {
    browser.action.setTitle({ tabId: tabId, title: 'Undisposition' })
    browser.action.setBadgeText({ tabId: tabId, text: '' })
    return
  }

  var host
  try {
    host = new URL(url).hostname
  } catch (e) {
    browser.action.setTitle({ tabId: tabId, title: 'Undisposition' })
    browser.action.setBadgeText({ tabId: tabId, text: '' })
    return
  }

  var skipped = false
  var listMode = (await localGetSync('listMode')) || 'blocklist'

  if (listMode === 'blocklist') {
    var blacklist = (await localGetSync('blacklist')) || []
    blacklist.forEach(function (e) {
      if (host.includes(e)) {
        skipped = true
      }
    })
  } else {
    var allowlist = (await localGetSync('allowlist')) || []
    var allowed = false
    allowlist.forEach(function (e) {
      if (host.includes(e)) {
        allowed = true
      }
    })
    if (!allowed) skipped = true
  }

  if (skipped) {
    // Skipped domain: gray badge
    var reason = listMode === 'blocklist' ? 'Undisposition skipped (domain is blocklisted)' : 'Undisposition skipped (domain not in allowlist)'
    browser.action.setTitle({ tabId: tabId, title: reason })
    browser.action.setBadgeText({ tabId: tabId, text: '\u2800' })
    browser.action.setBadgeBackgroundColor({ tabId: tabId, color: '#555555' })
  } else {
    // Active domain: blue badge, click to deactivate
    browser.action.setTitle({ tabId: tabId, title: 'Undisposition active, click to deactivate' })
    browser.action.setBadgeText({ tabId: tabId, text: '\u2800' })
    browser.action.setBadgeBackgroundColor({ tabId: tabId, color: '#5084ee' })
  }
}

function refreshActiveTabBadge() {
  browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs[0]) {
      updateTabBadge(tabs[0].id, tabs[0].url)
    }
  })
}

// Update badge when navigating within a tab
browser.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateTabBadge(tabId, tab.url)
  }
})

// Update badge when switching tabs
browser.tabs.onActivated.addListener(function (activeInfo) {
  browser.tabs.get(activeInfo.tabId, function (tab) {
    if (tab) {
      updateTabBadge(tab.id, tab.url)
    }
  })
})

// Refresh badges when settings change
browser.storage.onChanged.addListener(function (changes, area) {
  if (area === 'local') {
    if (changes.blacklist || changes.allowlist || changes.listMode) {
      refreshActiveTabBadge()
    }
    // Rebuild declarativeNetRequest rules when custom rules or list settings change
    if (changes.blacklist || changes.allowlist || changes.listMode || changes.customExtensionRules || changes.customUrlRules) {
      if (active) setDynamicRule()
    }
  }
})

function ToggleActive(tab) {
  // Ignore clicks on non-HTTP tabs (chrome:, extensions, etc.)
  if (!tab.url || !tab.url.startsWith('http')) return

  active = !active
  saveOptions()
  updateUI()
}

async function localGetSync(key) {
  return new Promise((resolve, reject) => {
    try {
      browser.storage.local.get(key, function (value) {
        resolve(value[key])
      })
    } catch (ex) {
      reject(ex)
    }
  })
}

async function removeDynamicRules() {
  var existing = await new Promise(function (resolve) {
    browser.declarativeNetRequest.getDynamicRules(resolve)
  })
  if (existing.length > 0) {
    var ids = existing.map(function (r) {
      return r.id
    })
    await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids })
  }
}

// Built-in Content-Type rewrites — images only.
// These are safe to apply globally because URLs ending in image extensions
// are almost always actual image files, not HTML pages.
var CONTENT_TYPE_REWRITES = {
  gif: 'image/gif',
  jpg: 'image/jpg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tiff: 'image/tiff',
  webp: 'image/webp',
  avif: 'image/avif',
  apng: 'image/apng',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
}

// Comprehensive type map used for =auto expansion in custom URL rules.
// These are only applied to URLs matching a user-specified pattern,
// so they won't break unrelated pages.
var AUTO_CONTENT_TYPES = {
  // Images
  gif: 'image/gif',
  jpg: 'image/jpg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  webp: 'image/webp',
  avif: 'image/avif',
  apng: 'image/apng',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  // Application
  pdf: 'application/pdf',
  json: 'application/json',
  xml: 'application/xml',
  wasm: 'application/wasm',
  // Audio
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  opus: 'audio/opus',
  m4a: 'audio/mp4',
  // Video
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  // Web
  htm: 'text/html',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  // Data / config
  csv: 'text/plain',
  tsv: 'text/plain',
  yaml: 'text/plain',
  yml: 'text/plain',
  toml: 'text/plain',
  ini: 'text/plain',
  cfg: 'text/plain',
  conf: 'text/plain',
  env: 'text/plain',
  properties: 'text/plain',
  // Documentation / text
  txt: 'text/plain',
  md: 'text/plain',
  rst: 'text/plain',
  log: 'text/plain',
  diff: 'text/plain',
  patch: 'text/plain',
  // Programming languages
  py: 'text/plain',
  rb: 'text/plain',
  pl: 'text/plain',
  php: 'text/plain',
  java: 'text/plain',
  kt: 'text/plain',
  scala: 'text/plain',
  c: 'text/plain',
  h: 'text/plain',
  cpp: 'text/plain',
  hpp: 'text/plain',
  cc: 'text/plain',
  cs: 'text/plain',
  go: 'text/plain',
  rs: 'text/plain',
  swift: 'text/plain',
  r: 'text/plain',
  lua: 'text/plain',
  dart: 'text/plain',
  ts: 'text/plain',
  tsx: 'text/plain',
  jsx: 'text/plain',
  // Shell / scripting
  sh: 'text/plain',
  bash: 'text/plain',
  zsh: 'text/plain',
  bat: 'text/plain',
  cmd: 'text/plain',
  ps1: 'text/plain',
  // Build / misc
  sql: 'text/plain',
  graphql: 'text/plain',
  proto: 'text/plain',
  lock: 'text/plain',
  gradle: 'text/plain',
}

// Convert a user-friendly glob pattern to a regex string.
// Escapes regex special chars, then replaces * with .*
function globToRegex(glob) {
  return glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
}

async function setDynamicRule() {
  var listMode = (await localGetSync('listMode')) || 'blocklist'
  var baseCondition = {
    resourceTypes: ['main_frame', 'sub_frame', 'script'],
  }

  if (listMode === 'blocklist') {
    var blacklist = (await localGetSync('blacklist')) || []
    if (blacklist.length > 0) {
      baseCondition.excludedInitiatorDomains = blacklist
      baseCondition.excludedRequestDomains = blacklist
    }
  } else {
    var allowlist = (await localGetSync('allowlist')) || []
    if (allowlist.length > 0) {
      baseCondition.initiatorDomains = allowlist
      baseCondition.requestDomains = allowlist
    } else {
      // Allowlist mode with empty list: no domains allowed, remove rules
      await removeDynamicRules()
      return
    }
  }

  var rules = []

  // Rule 1: Remove Content-Disposition header
  rules.push({
    id: 1,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      responseHeaders: [
        {
          header: 'content-disposition',
          operation: 'remove',
        },
      ],
    },
    condition: baseCondition,
  })

  // Rules 2–50: Built-in image extension rules
  var ruleId = 2
  var builtinExts = Object.keys(CONTENT_TYPE_REWRITES)
  for (var i = 0; i < builtinExts.length; i++) {
    var ext = builtinExts[i]
    rules.push({
      id: ruleId,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [{ header: 'content-type', operation: 'set', value: CONTENT_TYPE_REWRITES[ext] }],
      },
      condition: Object.assign({}, baseCondition, {
        regexFilter: '.*\\.' + ext + '(\\?.*)?$',
      }),
    })
    ruleId++
  }

  // Rules 100+: Custom extension rules from user settings
  ruleId = 100
  var customExtRules = (await localGetSync('customExtensionRules')) || []
  for (var ce = 0; ce < customExtRules.length; ce++) {
    var parts = customExtRules[ce].split('=')
    if (parts.length < 2) continue
    var custExt = parts[0].trim().toLowerCase().replace(/^\./, '')
    var custMime = parts.slice(1).join('=').trim()
    if (!custExt || !custMime) continue
    rules.push({
      id: ruleId,
      priority: 2,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [{ header: 'content-type', operation: 'set', value: custMime }],
      },
      condition: Object.assign({}, baseCondition, {
        regexFilter: '.*\\.' + custExt + '(\\?.*)?$',
      }),
    })
    ruleId++
  }

  // Rules 200+: Custom URL pattern rules from user settings
  ruleId = 200
  var customUrlRules = (await localGetSync('customUrlRules')) || []
  for (var cu = 0; cu < customUrlRules.length; cu++) {
    var uParts = customUrlRules[cu].split('=')
    if (uParts.length < 2) continue
    var pattern = uParts[0].trim()
    var mime = uParts.slice(1).join('=').trim().toLowerCase()
    if (!pattern || !mime) continue

    if (mime === 'auto') {
      // Expand =auto into one rule per known file type
      var autoExts = Object.keys(AUTO_CONTENT_TYPES)
      for (var ae = 0; ae < autoExts.length; ae++) {
        // Append the extension to the glob: *gitlab.com*/raw/* becomes *gitlab.com*/raw/*.yml
        var autoGlob = pattern
        if (!autoGlob.endsWith('*')) autoGlob += '*'
        autoGlob += '.' + autoExts[ae]
        rules.push({
          id: ruleId,
          priority: 3,
          action: {
            type: 'modifyHeaders',
            responseHeaders: [{ header: 'content-type', operation: 'set', value: AUTO_CONTENT_TYPES[autoExts[ae]] }],
          },
          condition: Object.assign({}, baseCondition, {
            regexFilter: globToRegex(autoGlob) + '(\\?.*)?$',
          }),
        })
        ruleId++
      }
    } else {
      // Single URL pattern rule with explicit mime type
      rules.push({
        id: ruleId,
        priority: 3,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [{ header: 'content-type', operation: 'set', value: mime }],
        },
        condition: Object.assign({}, baseCondition, {
          regexFilter: globToRegex(pattern) + '(\\?.*)?$',
        }),
      })
      ruleId++
    }
  }

  // Remove all existing rules then add new ones
  await removeDynamicRules()
  browser.declarativeNetRequest.updateDynamicRules({
    addRules: rules,
  })
}

// init everything — clear all stale dynamic rules first
browser.declarativeNetRequest.getDynamicRules(function (rules) {
  if (rules.length > 0) {
    var ids = rules.map(function (r) {
      return r.id
    })
    browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids })
  }
  loadOptions(updateUI)
})
browser.action.onClicked.addListener(ToggleActive)

// set right click menu to extension icon
browser.contextMenus.create({
  id: 'settings',
  title: 'Settings',
  contexts: ['action'],
})

// handle context menu actions
browser.contextMenus.onClicked.addListener(function (e) {
  if (e.menuItemId == 'settings') {
    browser.tabs.create({
      url: 'pages/settings.html',
    })
  }
})

// handle messages from settings page (refresh rules after save)
chrome.runtime.onMessage.addListener(function () {
  updateUI()
})
