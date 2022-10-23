if (typeof browser === 'undefined') {
  var browser = chrome
}

function loadData() {
  browser.storage.local.get('blacklist', function (data) {
    document.getElementById('blacklist').value = data.blacklist?.join('\n')
  })
}

function _submitHandler() {
  let list = document.getElementById('blacklist').value.split('\n')
  list = list.map(e => trimHost(e))
  browser.storage.local.set({ blacklist: list }, function () {
    // update script rules
    browser.runtime.sendMessage({}, function (response) {
      console.log(response)
    })
  })
  loadData()
}

function _testHandler() {
  let list = document.getElementById('blacklist').value.split('\n')
  list = list.map(e => e.trim())

  let host = trimHost(document.getElementById('test').value)
  host = 'http://' + host

  let results = []

  list.forEach(e => {
    if (host?.includes(e)) {
      results.push(e)
    }
  })

  if (results.length > 0) {
    document.getElementById('testResult').innerHTML = '<br/>' + results.join('<br />\n')
  } else {
    document.getElementById('testResult').innerHTML = '<br/>No match'
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
  loadData()
})
