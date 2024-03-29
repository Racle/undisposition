if (typeof browser === 'undefined') {
  var browser = chrome
}

function loadData() {
  browser.storage.local.get('blacklist', function (data) {
    if (data.blacklist === undefined) {
      data.blacklist = []
    }
    document.getElementById('blacklist').value = data.blacklist?.join('\n')
  })
}

function _submitHandler() {
  let list = document.getElementById('blacklist').value.split('\n')
  list = list.map(e => trimHost(e))
  list = list.filter(e => e)
  browser.storage.local.set({ blacklist: list })
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
    document.getElementById('testResult').innerHTML = '<br/>Found matches:<br/><br/>' + results.join('<br />\n')
  } else {
    document.getElementById('testResult').innerHTML = '<br/>No matches'
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
