if (typeof browser === 'undefined') {
  var browser = chrome
}

// Mirror of globToRegex from background script
function globToRegex(glob) {
  return glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
}

// Mirror of AUTO_CONTENT_TYPES from background script (for =auto testing)
var AUTO_CONTENT_TYPES = {
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
  pdf: 'application/pdf',
  json: 'application/json',
  xml: 'application/xml',
  wasm: 'application/wasm',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  opus: 'audio/opus',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  htm: 'text/html',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
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
  txt: 'text/plain',
  md: 'text/plain',
  rst: 'text/plain',
  log: 'text/plain',
  diff: 'text/plain',
  patch: 'text/plain',
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
  sh: 'text/plain',
  bash: 'text/plain',
  zsh: 'text/plain',
  bat: 'text/plain',
  cmd: 'text/plain',
  ps1: 'text/plain',
  sql: 'text/plain',
  graphql: 'text/plain',
  proto: 'text/plain',
  lock: 'text/plain',
  gradle: 'text/plain',
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
  browser.storage.local.get(['blacklist', 'allowlist', 'listMode', 'customExtensionRules', 'customUrlRules'], function (data) {
    if (data.blacklist === undefined) {
      data.blacklist = []
    }
    if (data.allowlist === undefined) {
      data.allowlist = []
    }
    document.getElementById('blacklist').value = data.blacklist?.join('\n')
    document.getElementById('allowlist').value = data.allowlist?.join('\n')
    setSelectedMode(data.listMode || 'blocklist')

    // Load advanced rules
    var extRules = data.customExtensionRules || []
    var urlRules = data.customUrlRules || []
    document.getElementById('customExtRules').value = extRules.join('\n')
    document.getElementById('customUrlPatternRules').value = urlRules.join('\n')
  })
}

function showToast() {
  var toast = document.getElementById('saveToast')
  toast.classList.add('visible')
  clearTimeout(showToast._timer)
  showToast._timer = setTimeout(function () {
    toast.classList.remove('visible')
  }, 2000)
}

function showAdvancedToast() {
  var toast = document.getElementById('advancedToast')
  toast.classList.add('visible')
  clearTimeout(showAdvancedToast._timer)
  showAdvancedToast._timer = setTimeout(function () {
    toast.classList.remove('visible')
  }, 2000)
}

function _submitHandler() {
  var mode = getSelectedMode()

  let blacklist = document.getElementById('blacklist').value.split('\n')
  blacklist = blacklist.map(e => trimHost(e))
  blacklist = blacklist.filter(e => e)

  let allowlist = document.getElementById('allowlist').value.split('\n')
  allowlist = allowlist.map(e => trimHost(e))
  allowlist = allowlist.filter(e => e)

  browser.storage.local.set(
    {
      blacklist: blacklist,
      allowlist: allowlist,
      listMode: mode,
    },
    function () {
      showToast()
      loadData()
    }
  )
}

function _testHandler() {
  var mode = getSelectedMode()
  var list
  if (mode === 'blocklist') {
    list = document.getElementById('blacklist').value.split('\n')
  } else {
    list = document.getElementById('allowlist').value.split('\n')
  }
  list = list.map(e => e.trim()).filter(e => e)

  let host = trimHost(document.getElementById('test').value)
  if (!host) return
  host = 'http://' + host

  let results = []

  list.forEach(e => {
    if (host?.includes(e)) {
      results.push(e)
    }
  })

  var resultEl = document.getElementById('testResult')
  resultEl.classList.add('visible')
  resultEl.classList.remove('blocked', 'active-on')

  function setResultContent(el, strongText, normalText, matchesText) {
    el.textContent = ''
    var strong = document.createElement('strong')
    strong.textContent = strongText
    el.appendChild(strong)
    el.appendChild(document.createTextNode(normalText))
    if (matchesText) {
      el.appendChild(document.createElement('br'))
      el.appendChild(document.createTextNode(matchesText))
    }
  }

  if (mode === 'blocklist') {
    if (results.length > 0) {
      resultEl.classList.add('blocked')
      setResultContent(resultEl, 'Blocked', ' — extension disabled on this domain', 'Matches: ' + results.join(', '))
    } else {
      resultEl.classList.add('active-on')
      setResultContent(resultEl, 'Not blocked', ' — extension will be active on this domain')
    }
  } else {
    if (results.length > 0) {
      resultEl.classList.add('active-on')
      setResultContent(resultEl, 'Allowed', ' — extension will be active on this domain', 'Matches: ' + results.join(', '))
    } else {
      resultEl.classList.add('blocked')
      setResultContent(resultEl, 'Not allowed', ' — extension will NOT be active on this domain')
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

function _advancedTestHandler() {
  var url = document.getElementById('advancedTest').value.trim()
  if (!url) return
  // Normalize: ensure it has a scheme for consistent matching
  if (!url.match(/^https?:\/\//)) url = 'https://' + url

  var resultEl = document.getElementById('advancedTestResult')
  resultEl.classList.add('visible')
  resultEl.classList.remove('blocked', 'active-on')
  resultEl.textContent = ''

  var matches = []

  // Strip query string for extension matching
  var urlNoQuery = url.split('?')[0]

  // Check extension rules from textarea
  var extLines = document.getElementById('customExtRules').value.split('\n')
  extLines = extLines
    .map(function (l) {
      return l.trim()
    })
    .filter(function (l) {
      return l
    })
  for (var i = 0; i < extLines.length; i++) {
    var parts = extLines[i].split('=')
    if (parts.length < 2) continue
    var ext = parts[0].trim().toLowerCase().replace(/^\./, '')
    var mime = parts.slice(1).join('=').trim()
    if (!ext || !mime) continue
    var extRegex = new RegExp('.*\\.' + ext + '$', 'i')
    if (extRegex.test(urlNoQuery)) {
      matches.push({ rule: extLines[i], source: 'Extension rule', mime: mime })
    }
  }

  // Check URL pattern rules from textarea
  var urlLines = document.getElementById('customUrlPatternRules').value.split('\n')
  urlLines = urlLines
    .map(function (l) {
      return l.trim()
    })
    .filter(function (l) {
      return l
    })
  for (var u = 0; u < urlLines.length; u++) {
    var uParts = urlLines[u].split('=')
    if (uParts.length < 2) continue
    var pattern = uParts[0].trim()
    var uMime = uParts.slice(1).join('=').trim().toLowerCase()
    if (!pattern || !uMime) continue

    if (uMime === 'auto') {
      // Check if URL matches pattern + any known extension
      var extMatch = urlNoQuery.match(/\.([a-zA-Z0-9]+)$/)
      if (extMatch) {
        var fileExt = extMatch[1].toLowerCase()
        if (AUTO_CONTENT_TYPES[fileExt]) {
          var autoGlob = pattern
          if (!autoGlob.endsWith('*')) autoGlob += '*'
          autoGlob += '.' + fileExt
          var autoRegex = new RegExp('^' + globToRegex(autoGlob) + '(\\?.*)?$', 'i')
          if (autoRegex.test(url)) {
            matches.push({ rule: urlLines[u], source: 'URL pattern (auto)', mime: AUTO_CONTENT_TYPES[fileExt] })
          }
        }
      }
    } else {
      var patRegex = new RegExp('^' + globToRegex(pattern) + '(\\?.*)?$', 'i')
      if (patRegex.test(url)) {
        matches.push({ rule: urlLines[u], source: 'URL pattern', mime: uMime })
      }
    }
  }

  if (matches.length > 0) {
    resultEl.classList.add('active-on')
    var strong = document.createElement('strong')
    strong.textContent = matches.length === 1 ? '1 rule matches' : matches.length + ' rules match'
    resultEl.appendChild(strong)
    for (var m = 0; m < matches.length; m++) {
      var div = document.createElement('div')
      div.className = 'rule-test-match'
      var sourceSpan = document.createElement('span')
      sourceSpan.className = 'rule-source'
      sourceSpan.textContent = matches[m].source
      var mimeSpan = document.createElement('span')
      mimeSpan.className = 'rule-mime'
      mimeSpan.textContent = matches[m].mime
      div.appendChild(sourceSpan)
      div.appendChild(document.createTextNode(': ' + matches[m].rule + ' → '))
      div.appendChild(mimeSpan)
      resultEl.appendChild(div)
    }
  } else {
    resultEl.classList.add('blocked')
    var noMatch = document.createElement('strong')
    noMatch.textContent = 'No rules match this URL'
    resultEl.appendChild(noMatch)
  }
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('submit').onclick = _submitHandler
  document.getElementById('testButton').onclick = _testHandler

  // Update visible section when mode changes
  var radios = document.querySelectorAll('input[name="listMode"]')
  radios.forEach(function (radio) {
    radio.addEventListener('change', updateVisibleSection)
  })

  // Allow testing by pressing Enter in the input
  document.getElementById('test').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') _testHandler()
  })

  // Advanced Settings — only show on MV3
  var manifest = browser.runtime.getManifest()
  if (manifest.manifest_version === 3) {
    document.getElementById('advancedCard').classList.remove('hidden')
  }

  // Toggle expand/collapse
  document.getElementById('advancedToggle').addEventListener('click', function () {
    var content = document.getElementById('advancedContent')
    var chevron = document.getElementById('advancedChevron')
    content.classList.toggle('open')
    chevron.classList.toggle('open')
  })

  // Save advanced rules
  document.getElementById('advancedSave').addEventListener('click', function () {
    var extLines = document.getElementById('customExtRules').value.split('\n')
    extLines = extLines
      .map(function (l) {
        return l.trim()
      })
      .filter(function (l) {
        return l
      })

    var urlLines = document.getElementById('customUrlPatternRules').value.split('\n')
    urlLines = urlLines
      .map(function (l) {
        return l.trim()
      })
      .filter(function (l) {
        return l
      })

    browser.storage.local.set(
      {
        customExtensionRules: extLines,
        customUrlRules: urlLines,
      },
      function () {
        showAdvancedToast()
      }
    )
  })

  // Example chips — click to insert into target textarea
  var chips = document.querySelectorAll('.example-chip')
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var targetId = chip.getAttribute('data-target')
      var rule = chip.getAttribute('data-rule')
      var textarea = document.getElementById(targetId)
      var current = textarea.value.trim()
      // Check if rule already exists
      var lines = current
        ? current.split('\n').map(function (l) {
            return l.trim()
          })
        : []
      if (lines.indexOf(rule) !== -1) return
      // Append the rule
      textarea.value = current ? current + '\n' + rule : rule
      // Brief visual feedback
      chip.classList.add('added')
      setTimeout(function () {
        chip.classList.remove('added')
      }, 800)
    })
  })

  // MIME types reference toggle
  document.getElementById('mimeToggle').addEventListener('click', function () {
    document.getElementById('mimeContent').classList.toggle('open')
    document.getElementById('mimeChevron').classList.toggle('open')
  })

  // Advanced rule tester
  document.getElementById('advancedTestButton').addEventListener('click', _advancedTestHandler)
  document.getElementById('advancedTest').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') _advancedTestHandler()
  })

  loadData()
})
