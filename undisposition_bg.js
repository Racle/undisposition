var active = true
if (typeof browser === 'undefined') {
  var browser = chrome
}

function loadOptions(callback) {
  browser.storage.local.get(['activeStatus', 'blacklist', 'listMode', 'allowlist'], function (data) {
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
    var reason = listMode === 'blocklist'
      ? 'Undisposition skipped (domain is blocklisted)'
      : 'Undisposition skipped (domain not in allowlist)'
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
  if (area === 'local' && (changes.blacklist || changes.allowlist || changes.listMode)) {
    refreshActiveTabBadge()
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

function removeDynamicRules() {
  // remove all rules (IDs 1 through 50 to cover all content-type rewrite rules)
  var ids = []
  for (var i = 1; i <= 50; i++) ids.push(i)
  browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ids,
  })
}

// Content-Type rewrite rules keyed by URL file extension
// MV3 can't inspect response headers, so we match on URL pattern instead
var CONTENT_TYPE_REWRITES = {
  // Images
  gif: 'image/gif',
  jpg: 'image/jpg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tiff: 'image/tiff',
  webp: 'image/webp',
  avif: 'image/avif',
  apng: 'image/apng',
  svg: 'image/svg+xml',
  // Application types
  pdf: 'application/pdf',
  json: 'application/json',
  xml: 'application/xml',
  ogg: 'application/ogg',
  // Text
  csv: 'text/plain',
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
      removeDynamicRules()
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

  // Rules 2+: Rewrite Content-Type based on URL file extension
  var ruleId = 2
  var extensions = Object.keys(CONTENT_TYPE_REWRITES)
  for (var i = 0; i < extensions.length; i++) {
    var ext = extensions[i]
    var mimeType = CONTENT_TYPE_REWRITES[ext]
    var extCondition = Object.assign({}, baseCondition, {
      regexFilter: '.*\\.' + ext + '(\\?.*)?$',
    })
    rules.push({
      id: ruleId,
      priority: 2,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          {
            header: 'content-type',
            operation: 'set',
            value: mimeType,
          },
        ],
      },
      condition: extCondition,
    })
    ruleId++
  }

  // Collect all rule IDs to remove before adding
  var removeIds = []
  for (var j = 1; j <= ruleId; j++) removeIds.push(j)

  browser.declarativeNetRequest.updateDynamicRules({
    addRules: rules,
    removeRuleIds: removeIds,
  })
}

// init everything
loadOptions(updateUI)
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
