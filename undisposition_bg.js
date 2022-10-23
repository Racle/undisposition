var active = true
chrome.webRequest.onHeadersReceived.addListener(
  async function (details) {
    // console.log('details', details)
    // console.log('filetype', details.url.substring(details.url.length - 3))

    // check if blacklist contains host
    const host = details.url.split('/')[2]
    let blacklist = []
    blacklist = (await localGetSync('blacklist')) || []
    let found = false
    blacklist.forEach(e => {
      if (host.includes(e)) {
        found = true
      }
    })
    if (found) return

    var headers = details.responseHeaders
    if (active) {
      for (var i = 0; i < headers.length; i++) {
        if (headers[i].name.toLowerCase() == 'content-disposition') {
          if (headers[i].value.indexOf('attachment') == 0) {
            headers.splice(i, 1)
          }
          break
        }
      }
      for (var j = 0; j < headers.length; j++) {
        if (headers[j].name.toLowerCase() == 'content-type') {
          if (headers[j].value == 'application/octet-stream' || headers[j].value == 'application/x-download') {
            // get filetype from url,
            var ft = details.url ? details.url.substring(details.url.length - 5).toLowerCase() : ''
            ft = ft.split('.').pop()
            //
            //skip and fix popular filetypes
            var skip = ['exe', 'dmg', 'deb', 'rpm', 'apk', 'zip', 'rar', '7z', 'gz', 'xz']
            var fixApplication = ['pdf', 'json', 'xml', 'ogg']
            var fixImage = ['gif', 'jpg', 'jpeg', 'png', 'tiff']

            // if exe/dmg/deb etc., keep original header
            // if pdf/jpeg/jpg/png etc., view file normally
            if (skip.includes(ft)) {
              continue
            } else if (fixApplication.includes(ft)) {
              headers[j].value = 'application/' + ft
            } else if (fixImage.includes(ft)) {
              headers[j].value = 'image/' + ft
            } else {
              headers[j].value = 'text/plain' //I hope Chrome is wise enough
            }
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
  chrome.storage.local.get('activeStatus', function (data) {
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
  chrome.storage.local.set({ activeStatus: active })
}

function updateUI() {
  var str = active ? 'Undisposition active, click to deactivate' : 'Undisposition disabled, click to activate'
  chrome.browserAction.setTitle({ title: str })
  chrome.browserAction.setBadgeText({ text: active ? '⠀' : '⠀' })
  chrome.browserAction.setBadgeBackgroundColor({ color: active ? '#5084ee' : '#e91e63' })
}

function ToggleActive() {
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
