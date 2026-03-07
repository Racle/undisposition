var active = true
chrome.webRequest.onHeadersReceived.addListener(
  async function (details) {
    // console.log('details', details)
    // console.log('filetype', details.url.substring(details.url.length - 3))

    // check if host is allowed/blocked based on list mode
    const host = extractHostname(details.url)
    if (!host) return
    const listMode = (await localGetSync('listMode')) || 'blocklist'
    var skipped = false

    if (listMode === 'blocklist') {
      let blacklist = (await localGetSync('blacklist')) || []
      blacklist.forEach(e => {
        if (domainMatches(host, e)) {
          skipped = true
        }
      })
    } else {
      // allowlist mode: only act on listed domains
      let allowlist = (await localGetSync('allowlist')) || []
      var allowed = false
      allowlist.forEach(e => {
        if (domainMatches(host, e)) {
          allowed = true
        }
      })
      if (!allowed) skipped = true
    }

    if (skipped) return

    var headers = details.responseHeaders
    if (active) {
      // Collect Content-Type first to make smart decisions
      var contentType = ''
      for (var k = 0; k < headers.length; k++) {
        if (headers[k].name.toLowerCase() == 'content-type') {
          contentType = headers[k].value.split(';')[0].trim().toLowerCase()
          break
        }
      }

      // Binary types where Content-Disposition should be preserved
      // (removing it would lose the server-provided filename)
      var binaryTypes = [
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        'application/gzip',
        'application/x-xz',
        'application/x-debian-package',
        'application/x-rpm',
        'application/vnd.android.package-archive',
        'application/x-apple-diskimage',
        'application/x-msdownload',
        'application/x-msi',
        'application/x-tar',
        'application/x-bzip2',
        'application/x-iso9660-image',
      ]

      // Only remove Content-Disposition if Content-Type is not a known binary type
      if (!binaryTypes.includes(contentType)) {
        for (var i = 0; i < headers.length; i++) {
          if (headers[i].name.toLowerCase() == 'content-disposition') {
            if (headers[i].value.indexOf('attachment') == 0) {
              headers.splice(i, 1)
            }
            break
          }
        }
      }

      for (var j = 0; j < headers.length; j++) {
        if (headers[j].name.toLowerCase() == 'content-type') {
          var ctValue = headers[j].value.split(';')[0].trim()
          if (ctValue == 'application/octet-stream' || ctValue == 'application/x-download') {
            // get filetype from url (use URL parser to handle query strings)
            var ft = ''
            try {
              var urlPath = new URL(details.url).pathname
              ft = urlPath.split('.').pop().toLowerCase()
            } catch (e) {
              ft = ''
            }
            //
            //skip and fix popular filetypes
            var skip = ['exe', 'dmg', 'deb', 'rpm', 'apk', 'zip', 'rar', '7z', 'gz', 'xz']
            var fixApplication = ['pdf', 'json', 'xml', 'ogg']
            var fixImage = ['gif', 'jpg', 'jpeg', 'png', 'tiff', 'webp', 'avif', 'apng']

            // if exe/dmg/deb etc., keep original header
            // if pdf/jpeg/jpg/png etc., view file normally
            if (skip.includes(ft)) {
              continue
            } else if (fixApplication.includes(ft)) {
              headers[j].value = 'application/' + ft
            } else if (fixImage.includes(ft)) {
              headers[j].value = 'image/' + ft
            } else if (ft === 'svg') {
              headers[j].value = 'image/svg+xml'
            } else {
              headers[j].value = 'text/plain' //I hope Chrome is wise enough
            }
          } else if (ctValue == 'text/csv') {
            headers[j].value = 'text/plain'
          }
          break
        }
      }
    }
    return { responseHeaders: headers }
  },
  {
    urls: ['<all_urls>'],
    types: ['main_frame', 'sub_frame'],
  },
  ['blocking', 'responseHeaders']
)

function loadOptions(callback) {
  chrome.storage.local.get(['activeStatus', 'blacklist', 'listMode', 'allowlist'], function (data) {
    if (data.activeStatus === undefined) {
      //at first install
      data.activeStatus = true
      // Seed default blacklist on first install
      if (!data.blacklist || data.blacklist.length === 0) {
        chrome.storage.local.set({
          blacklist: ['googleusercontent.com'],
        })
      }
      saveOptions()
    }
    // Ensure listMode defaults to blocklist for existing users
    if (!data.listMode) {
      chrome.storage.local.set({ listMode: 'blocklist' })
    }
    if (!data.allowlist) {
      chrome.storage.local.set({ allowlist: [] })
    }
    active = data.activeStatus
    if (callback != null) callback()
  })
}

function saveOptions() {
  chrome.storage.local.set({ activeStatus: active })
}

function updateUI() {
  // Set global defaults (used for tabs without per-tab overrides)
  var str = active ? 'Undisposition active, click to deactivate' : 'Undisposition disabled, click to activate'
  chrome.browserAction.setTitle({ title: str })
  chrome.browserAction.setBadgeText({ text: active ? '' : '⠀' })
  if (!active) {
    chrome.browserAction.setBadgeBackgroundColor({ color: '#e91e63' })
  }

  // Refresh all visible tabs so per-tab badges/titles update immediately
  chrome.tabs.query({}, function (tabs) {
    tabs.forEach(function (tab) {
      updateTabBadge(tab.id, tab.url)
    })
  })
}

async function updateTabBadge(tabId, url) {
  if (!active) {
    // Globally disabled: pink badge, click to activate
    chrome.browserAction.setTitle({ tabId: tabId, title: 'Undisposition disabled, click to activate' })
    chrome.browserAction.setBadgeText({ tabId: tabId, text: '⠀' })
    chrome.browserAction.setBadgeBackgroundColor({ tabId: tabId, color: '#e91e63' })
    return
  }

  // Internal pages (about:, moz-extension:, chrome:, etc.) — no badge, no toggle
  if (!url || !url.startsWith('http')) {
    chrome.browserAction.setTitle({ tabId: tabId, title: 'Undisposition' })
    chrome.browserAction.setBadgeText({ tabId: tabId, text: '' })
    return
  }

  var host
  try {
    host = extractHostname(url)
    if (!host) throw new Error('invalid hostname')
  } catch (e) {
    chrome.browserAction.setTitle({ tabId: tabId, title: 'Undisposition' })
    chrome.browserAction.setBadgeText({ tabId: tabId, text: '' })
    return
  }

  var skipped = false
  var listMode = (await localGetSync('listMode')) || 'blocklist'

  if (listMode === 'blocklist') {
    var blacklist = (await localGetSync('blacklist')) || []
    blacklist.forEach(function (e) {
      if (domainMatches(host, e)) {
        skipped = true
      }
    })
  } else {
    var allowlist = (await localGetSync('allowlist')) || []
    var allowed = false
    allowlist.forEach(function (e) {
      if (domainMatches(host, e)) {
        allowed = true
      }
    })
    if (!allowed) skipped = true
  }

  if (skipped) {
    // Skipped domain: gray badge, no toggle
    var reason = listMode === 'blocklist' ? 'Undisposition skipped (domain is blocklisted)' : 'Undisposition skipped (domain not in allowlist)'
    chrome.browserAction.setTitle({ tabId: tabId, title: reason })
    chrome.browserAction.setBadgeText({ tabId: tabId, text: '⠀' })
    chrome.browserAction.setBadgeBackgroundColor({ tabId: tabId, color: '#555555' })
  } else {
    // Active domain: blue badge, click to deactivate
    chrome.browserAction.setTitle({ tabId: tabId, title: 'Undisposition active, click to deactivate' })
    chrome.browserAction.setBadgeText({ tabId: tabId, text: '⠀' })
    chrome.browserAction.setBadgeBackgroundColor({ tabId: tabId, color: '#5084ee' })
  }
}

function refreshActiveTabBadge() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs[0]) {
      updateTabBadge(tabs[0].id, tabs[0].url)
    }
  })
}

// Update badge when navigating within a tab
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateTabBadge(tabId, tab.url)
  }
})

// Update badge when switching tabs
chrome.tabs.onActivated.addListener(function (activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function (tab) {
    if (tab) {
      updateTabBadge(tab.id, tab.url)
    }
  })
})

// Refresh badges when settings change
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === 'local' && (changes.blacklist || changes.allowlist || changes.listMode)) {
    refreshActiveTabBadge()
  }
})

function ToggleActive(tab) {
  // Only allow toggle on active (blue) or disabled (pink) states
  // Ignore clicks on non-HTTP tabs (about:, moz-extension:, etc.)
  if (!tab.url || !tab.url.startsWith('http')) return

  active = !active
  saveOptions()
  updateUI()
}

loadOptions(updateUI)
chrome.browserAction.onClicked.addListener(ToggleActive)

async function localGetSync(key) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(key, function (value) {
        resolve(value[key])
      })
    } catch (ex) {
      reject(ex)
    }
  })
}

function normalizeHost(host) {
  if (!host) return ''
  var cleaned = String(host).trim().toLowerCase()
  if (!cleaned) return ''
  if (cleaned.endsWith('.')) cleaned = cleaned.slice(0, -1)
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    cleaned = cleaned.slice(1, -1)
  }
  if (cleaned.includes(':') && !cleaned.includes(']')) {
    var maybeHost = cleaned.split(':')[0]
    // Preserve plain IPv6 without brackets (contains multiple colons)
    if ((cleaned.match(/:/g) || []).length <= 1) {
      cleaned = maybeHost
    }
  }
  return cleaned
}

function extractHostname(rawUrl) {
  try {
    return normalizeHost(new URL(rawUrl).hostname)
  } catch (e) {
    return ''
  }
}

function domainMatches(host, rule) {
  var normalizedHost = normalizeHost(host)
  var normalizedRule = normalizeHost(rule)

  if (!normalizedHost || !normalizedRule) return false
  if (normalizedHost === normalizedRule) return true
  return normalizedHost.endsWith('.' + normalizedRule)
}

browser.contextMenus.create({
  id: 'log-selection',
  title: 'Settings',
  contexts: ['browser_action'],
  onclick: (info, tab) => {
    chrome.tabs.create({
      url: 'pages/settings.html',
    })
  },
})
