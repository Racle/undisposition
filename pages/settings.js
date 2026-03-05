if (typeof browser === 'undefined') {
  var browser = chrome
}

function getSelectedMode() {
  return document.querySelector('input[name="listMode"]:checked').value
}

function setSelectedMode(mode) {
  var radio = document.querySelector('input[name="listMode"][value="' + mode + '"]')
  if (radio) radio.checked = true
  updateVisibleSection()
}

function updateVisibleSection() {
  var mode = getSelectedMode()
  document.getElementById('blocklist-section').classList.toggle('active', mode === 'blocklist')
  document.getElementById('allowlist-section').classList.toggle('active', mode === 'allowlist')
}

function loadData() {
  browser.storage.local.get(['blacklist', 'allowlist', 'listMode'], function (data) {
    if (data.blacklist === undefined) {
      data.blacklist = []
    }
    if (data.allowlist === undefined) {
      data.allowlist = []
    }
    document.getElementById('blacklist').value = data.blacklist?.join('\n')
    document.getElementById('allowlist').value = data.allowlist?.join('\n')
    setSelectedMode(data.listMode || 'blocklist')
  })
}

function _submitHandler() {
  var mode = getSelectedMode()

  let blacklist = document.getElementById('blacklist').value.split('\n')
  blacklist = blacklist.map(e => trimHost(e))
  blacklist = blacklist.filter(e => e)

  let allowlist = document.getElementById('allowlist').value.split('\n')
  allowlist = allowlist.map(e => trimHost(e))
  allowlist = allowlist.filter(e => e)

  browser.storage.local.set({
    blacklist: blacklist,
    allowlist: allowlist,
    listMode: mode,
  })
  loadData()
}

function _testHandler() {
  var mode = getSelectedMode()
  var list
  if (mode === 'blocklist') {
    list = document.getElementById('blacklist').value.split('\n')
  } else {
    list = document.getElementById('allowlist').value.split('\n')
  }
  list = list.map(e => e.trim())

  let host = trimHost(document.getElementById('test').value)
  host = 'http://' + host

  let results = []

  list.forEach(e => {
    if (host?.includes(e)) {
      results.push(e)
    }
  })

  if (mode === 'blocklist') {
    if (results.length > 0) {
      document.getElementById('testResult').innerHTML = '<br/>Blocked - matches:<br/><br/>' + results.join('<br />\n')
    } else {
      document.getElementById('testResult').innerHTML = '<br/>Not blocked - Undisposition will be active on this domain'
    }
  } else {
    if (results.length > 0) {
      document.getElementById('testResult').innerHTML = '<br/>Allowed - matches:<br/><br/>' + results.join('<br />\n')
    } else {
      document.getElementById('testResult').innerHTML = '<br/>Not allowed - Undisposition will NOT be active on this domain'
    }
  }
}

function trimHost(host) {
  host = host.trim()
  if (host.startsWith('http')) {
    host = host.split('/')[2]
  }
  return host
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('submit').onclick = _submitHandler
  document.getElementById('testButton').onclick = _testHandler

  // Update visible section when mode changes
  var radios = document.querySelectorAll('input[name="listMode"]')
  radios.forEach(function (radio) {
    radio.addEventListener('change', updateVisibleSection)
  })

  loadData()
})
