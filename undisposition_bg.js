var active = true
if (typeof browser === 'undefined') {
  var browser = chrome
}

function loadOptions(callback) {
  browser.storage.local.get('activeStatus', function (data) {
    if (data.activeStatus === undefined) {
      //at first install
      data.activeStatus = true
      saveOptions()
    }
    active = data.activeStatus
    if (callback != null) callback()
  })
}

function saveOptions() {
  browser.storage.local.set({ activeStatus: active })
}

function updateUI() {
  var str = active ? 'Undisposition active, click to deactivate' : 'Undisposition disabled, click to activate'
  browser.action.setTitle({ title: str })
  browser.action.setBadgeText({ text: active ? '⠀' : '⠀' })
  browser.action.setBadgeBackgroundColor({ color: active ? '#5084ee' : '#e91e63' })

  if (active) {
    setDynamicRule()
  } else {
    removeDynamicRules()
  }
}

function ToggleActive() {
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
  // remove all rules
  browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
  })
}

async function setDynamicRule() {
  const headerKey = 'content-disposition'
  let list = await localGetSync('blacklist')
  browser.declarativeNetRequest.updateDynamicRules({
    addRules: [
      {
        id: 1,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            {
              header: headerKey,
              operation: 'remove',
            },
          ],
        },
        condition: {
          resourceTypes: ['main_frame', 'sub_frame', 'script'],
          excludedInitiatorDomains: list,
          excludedRequestDomains: list,
        },
      },
    ],
    removeRuleIds: [1],
  })
}

// init everything
loadOptions(updateUI)
browser.action.onClicked.addListener(ToggleActive)

// set right click menu to extension icon
browser.contextMenus.create({
  id: 'settings',
  title: 'Settings',
  contexts: ['browser_action', 'action'],
})

//handle context menu actions
browser.contextMenus.onClicked.addListener(function (e) {
  if (e.menuItemId == 'settings') {
    browser.tabs.create({
      url: 'pages/settings.html',
    })
  }
})

// handle messages from content scripts
chrome.runtime.onMessage.addListener(function () {
  updateUI()
})
