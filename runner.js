// Pane runner: run one SolidOS pane full-window as an app.
//   runner.html?pane=<pane module URL>&uri=<resource URL>
// Gives the pane what it expects (dom, session.store with a fetcher, getOutliner) and nothing
// else of SolidOS. Public data only for now: login would replace the fetcher's _fetch with an
// authenticated one (see the note at the bottom).

const $rdf = globalThis.$rdf
const app = document.getElementById('app')
const params = new URLSearchParams(location.search)
const paneUrl = params.get('pane')
const uri = params.get('uri')

const el = (tag, cls, text) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}

function message (title, lines, isError) {
  const box = el('div', 'pr-box' + (isError ? ' pr-error' : ''))
  box.appendChild(el('h1', null, title))
  for (const line of lines) box.appendChild(typeof line === 'string' ? el('p', null, line) : line)
  app.replaceChildren(box)
  return box
}

const runnerLink = (pane, resource) => {
  const u = new URL(location.pathname, location.href)
  u.searchParams.set('pane', pane)
  u.searchParams.set('uri', resource)
  return u.href
}

// With no pane given: a small form, so the runner explains itself.
function landing () {
  document.title = 'Pane runner'
  const form = el('form')
  const field = (label, name, value) => {
    const l = el('label', null, label); const i = el('input'); i.name = name; i.type = 'url'; i.required = true; i.value = value || ''
    l.htmlFor = i.id = 'pr-' + name
    form.append(l, i)
  }
  field('Pane module URL', 'pane', paneUrl)
  field('Resource URL', 'uri', uri)
  form.appendChild(el('button', null, 'Run'))
  form.addEventListener('submit', e => {
    e.preventDefault()
    location.assign(runnerLink(form.elements.pane.value, form.elements.uri.value))
  })
  message('Pane runner', ['Runs one SolidOS pane full-window, as an app.', form])
}

// rdflib's long Accept header makes a cross-site read need a CORS preflight, which static hosts
// refuse. On a cross-site GET/HEAD that fails before any answer, ask once more with a short
// Accept and no credentials (the same fallback mashlib.com/dynamic uses).
const PLAIN_ACCEPT = 'text/turtle, application/ld+json;q=0.9, */*;q=0.5'
function installReadFallback (fetcher) {
  let inner = fetcher._fetch
  async function read (input, init = {}) {
    try {
      return await inner.call(this, input, init)
    } catch (error) {
      const method = String(init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase()
      let url
      try { url = new URL(typeof input === 'string' ? input : input.url, location.href) } catch (e) { throw error }
      if (!(error instanceof TypeError) || url.origin === location.origin || (method !== 'GET' && method !== 'HEAD')) throw error
      try {
        return await fetch(url.href, { method, headers: { accept: PLAIN_ACCEPT }, credentials: 'omit', cache: init.cache })
      } catch (e) { throw error }
    }
  }
  Object.defineProperty(fetcher, '_fetch', {
    configurable: true,
    enumerable: true,
    get () { return read },
    set (next) { if (typeof next === 'function' && next !== read) inner = next } // login swaps this in
  })
}

// A pane from another site runs with this page's rights; ask once per site, as the dynamic
// SolidOS page does. This page, localhost and 127.0.0.1 are trusted.
function trusted (origin) {
  const host = new URL(origin).hostname
  if (origin === location.origin || host === '127.0.0.1' || host === 'localhost') return true
  try { return JSON.parse(localStorage.getItem('pane-runner:sites') || '[]').includes(origin) } catch (e) { return false }
}
function askTrust (origin) {
  return new Promise(resolve => {
    const yes = el('button', null, 'Run it')
    yes.addEventListener('click', () => {
      try {
        const list = JSON.parse(localStorage.getItem('pane-runner:sites') || '[]')
        localStorage.setItem('pane-runner:sites', JSON.stringify([...new Set([...list, origin])]))
      } catch (e) {}
      resolve()
    })
    const code = el('p'); code.append('Pane from ', el('code', null, origin))
    message('Run this pane?', [code, 'It will run with this page\'s rights and can read what this page can read.', yes])
  })
}

// Per-pane web app manifest, so the browser offers "Install app". The manifest is a data: URL,
// so its URLs must be absolute. The icon is the pane's own data: icon when it has one.
const FALLBACK_ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#5030b5"/><path d="M6 6h12v12H6z" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M6 10h12" stroke="#fff" stroke-width="1.8"/></svg>')

async function pngIcon (src, size) {
  // Chrome wants a raster icon of 144 px or more to offer install; draw the SVG on a canvas.
  const img = new Image()
  img.src = src
  await img.decode()
  const c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d')
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size)
  const pad = size * 0.14
  g.drawImage(img, pad, pad, size - 2 * pad, size - 2 * pad)
  return c.toDataURL('image/png')
}

async function setManifest (pane, label, subject) {
  const name = label || pane.name || 'Pane'
  const icon = typeof pane.icon === 'string' && pane.icon.startsWith('data:') ? pane.icon : FALLBACK_ICON
  const icons = []
  try { icons.push({ src: await pngIcon(icon, 512), sizes: '512x512', type: 'image/png', purpose: 'any' }) } catch (e) {}
  if (icon.startsWith('data:image/svg')) icons.push({ src: icon, sizes: 'any', type: 'image/svg+xml' })
  const start = runnerLink(paneUrl, subject.uri)
  const manifest = {
    name: name + ' (' + (pane.name || 'pane') + ')',
    short_name: name,
    id: runnerLink(paneUrl, ''), // one app per pane, whatever it opens
    start_url: start,
    scope: new URL('./', location.href).href,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons
  }
  document.getElementById('manifest').href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest))
  let fav = document.querySelector('link[rel=icon]')
  if (!fav) { fav = el('link'); fav.rel = 'icon'; document.head.appendChild(fav) }
  fav.href = icon
}

async function run () {
  if (!paneUrl || !uri) return landing()
  if (!$rdf) return message('rdflib did not load', ['vendor/rdflib-2.4.1/rdflib.min.js is missing.'], true)

  let paneHref, subject
  try {
    paneHref = new URL(paneUrl, location.href).href
    subject = $rdf.sym(new URL(uri, location.href).href)
  } catch (e) { return message('Bad link', ['The pane or uri parameter is not a URL.'], true) }

  const origin = new URL(paneHref).origin
  if (!trusted(origin)) await askTrust(origin)
  message('Loading…', [subject.uri])

  // The store: one rdflib graph with a fetcher (and an updater, for panes that write).
  const store = $rdf.graph()
  const fetcher = new $rdf.Fetcher(store, { timeout: 30000 })
  store.fetcher = fetcher
  try { store.updater = new $rdf.UpdateManager(store) } catch (e) {}
  installReadFallback(fetcher)
  globalThis.SolidLogic = globalThis.SolidLogic || { store } // panes may reach it in shouldGetFocus

  // The outliner shim: going somewhere reloads the runner on the new resource, same pane.
  const outliner = {
    GotoSubject (node) { location.assign(runnerLink(paneHref, node.uri || node.value || String(node))) },
    showDashboard () {}
  }
  const context = {
    dom: document,
    session: { store, paneRegistry: { list: [], byName: () => null } },
    getOutliner: () => outliner
  }

  let pane
  try {
    const mod = await import(paneHref)
    pane = mod.default || mod.pane || mod
  } catch (e) {
    return message('The pane did not load', [paneHref, String(e.message || e)], true)
  }
  if (!pane || typeof pane.render !== 'function') {
    return message('Not a pane', [paneHref, 'The module has no default export with a render() function.'], true)
  }

  // Load the resource first, so panes that decide from its triples (chess) can. A file rdflib
  // cannot parse (Markdown, a picture) is fine: the pane reads it itself.
  try { await fetcher.load(subject.doc()) } catch (e) {}

  let label = null
  try { label = typeof pane.label === 'function' ? pane.label(subject, context) : null } catch (e) {
    return message('The pane failed', [pane.name || paneHref, 'label(): ' + (e.message || e)], true)
  }
  if (!label) {
    const back = el('a', null, 'Choose another pane or resource'); back.href = location.pathname
    back.addEventListener('click', e => { e.preventDefault(); landing() })
    const what = el('p'); what.append((pane.name || 'The pane') + ' said no to ', el('code', null, subject.uri))
    return message('This pane does not open this resource', [what, back], true)
  }

  document.title = label + ' – ' + decodeURIComponent(subject.uri.replace(/\/$/, '').split('/').pop() || subject.uri)
  setManifest(pane, label, subject)

  try {
    const view = pane.render(subject, context)
    if (!(view instanceof Node)) throw new Error('render() did not return a DOM element')
    app.replaceChildren(view)
  } catch (e) {
    message('The pane failed', [pane.name || paneHref, 'render(): ' + (e.message || e)], true)
  }
}

run()

// Login (not in this prototype): add a "Log in" control that uses solid-client-authn-browser
// (or the lighter oidc client mashlib.com/dynamic uses), then set fetcher._fetch = session.fetch.
// The read fallback above keeps working because it wraps whatever _fetch is set to.
