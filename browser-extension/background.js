const DEFAULT_PORT = 18792

const BADGE = {
  on: { text: 'ON', color: '#FF5A36' },
  off: { text: '', color: '#000000' },
  connecting: { text: '…', color: '#F59E0B' },
  error: { text: '!', color: '#B91C1C' },
}

/** @type {WebSocket|null} */
let relayWs = null
/** @type {Promise<void>|null} */
let relayConnectPromise = null

let debuggerListenersInstalled = false

let nextSession = 1

/** @type {Map<number, {state:'connecting'|'connected', sessionId?:string, targetId?:string, attachOrder?:number}>} */
const tabs = new Map()
/** @type {Map<string, number>} */
const tabBySession = new Map()
/** @type {Map<string, number>} */
const childSessionToTab = new Map()

/** @type {Map<number, {resolve:(v:any)=>void, reject:(e:Error)=>void}>} */
const pending = new Map()

// Auto-reconnect state
let autoReconnectEnabled = false
let reconnectTimer = null
const RECONNECT_DELAY_MS = 1000

function nowStack() {
  try {
    return new Error().stack || ''
  } catch {
    return ''
  }
}

async function getAutoReconnect() {
  const stored = await chrome.storage.local.get(['autoReconnect'])
  return stored.autoReconnect === true
}

async function getRelayPort() {
  const stored = await chrome.storage.local.get(['relayPort'])
  const raw = stored.relayPort
  const n = Number.parseInt(String(raw || ''), 10)
  if (!Number.isFinite(n) || n <= 0 || n > 65535) return DEFAULT_PORT
  return n
}

async function getGatewayToken() {
  const stored = await chrome.storage.local.get(['gatewayToken'])
  const token = String(stored.gatewayToken || '').trim()
  return token || ''
}

function setBadge(tabId, kind) {
  const cfg = BADGE[kind]
  void chrome.action.setBadgeText({ tabId, text: cfg.text })
  void chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color })
  void chrome.action.setBadgeTextColor({ tabId, color: '#FFFFFF' }).catch(() => {})
}

async function ensureRelayConnection() {
  if (relayWs && relayWs.readyState === WebSocket.OPEN) return
  if (relayConnectPromise) return await relayConnectPromise

  relayConnectPromise = (async () => {
    const port = await getRelayPort()
    const gatewayToken = await getGatewayToken()
    const httpBase = `http://127.0.0.1:${port}`
    const wsUrl = gatewayToken
      ? `ws://127.0.0.1:${port}/extension?token=${encodeURIComponent(gatewayToken)}`
      : `ws://127.0.0.1:${port}/extension`

    // Fast preflight: is the relay server up?
    try {
      await fetch(`${httpBase}/`, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
    } catch (err) {
      throw new Error(`Relay server not reachable at ${httpBase} (${String(err)})`)
    }

    if (!gatewayToken) {
      throw new Error(
        'Missing gatewayToken in extension settings (chrome.storage.local.gatewayToken)',
      )
    }

    const ws = new WebSocket(wsUrl)
    relayWs = ws

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('WebSocket connect timeout')), 5000)
      ws.onopen = () => {
        clearTimeout(t)
        resolve()
      }
      ws.onerror = () => {
        clearTimeout(t)
        reject(new Error('WebSocket connect failed'))
      }
      ws.onclose = (ev) => {
        clearTimeout(t)
        reject(new Error(`WebSocket closed (${ev.code} ${ev.reason || 'no reason'})`))
      }
    })

    ws.onmessage = (event) => void onRelayMessage(String(event.data || ''))
    ws.onclose = () => onRelayClosed('closed')
    ws.onerror = () => onRelayClosed('error')

    if (!debuggerListenersInstalled) {
      debuggerListenersInstalled = true
      chrome.debugger.onEvent.addListener(onDebuggerEvent)
      chrome.debugger.onDetach.addListener(onDebuggerDetach)
    }
  })()

  try {
    await relayConnectPromise
  } finally {
    relayConnectPromise = null
  }
}

async function scheduleAutoReconnect(tabIdsToReconnect) {
  const enabled = await getAutoReconnect()
  if (!enabled) return
  
  if (reconnectTimer) clearTimeout(reconnectTimer)
  
  reconnectTimer = setTimeout(async () => {
    console.log('[Auto-reconnect] Attempting to reconnect...')
    const attachedTabs = tabIdsToReconnect || Array.from(tabs.keys())
    
    if (attachedTabs.length === 0) {
      console.log('[Auto-reconnect] No tabs were attached, skipping')
      return
    }
    
    try {
      await ensureRelayConnection()
      
      // Re-attach all previously attached tabs
      for (const tabId of attachedTabs) {
        try {
          await attachTab(tabId, { skipAttachedEvent: false })
          console.log(`[Auto-reconnect] Re-attached tab ${tabId}`)
        } catch (err) {
          console.warn(`[Auto-reconnect] Failed to re-attach tab ${tabId}:`, err)
        }
      }
    } catch (err) {
      console.warn('[Auto-reconnect] Reconnection failed:', err)
      // Try again with same tabs
      await scheduleAutoReconnect(attachedTabs)
    }
  }, RECONNECT_DELAY_MS)
}

function onRelayClosed(reason) {
  relayWs = null
  for (const [id, p] of pending.entries()) {
    pending.delete(id)
    p.reject(new Error(`Relay disconnected (${reason})`))
  }

  // Store attached tabs before clearing
  const attachedTabs = Array.from(tabs.keys())

  for (const tabId of tabs.keys()) {
    void chrome.debugger.detach({ tabId }).catch(() => {})
    setBadge(tabId, 'connecting')
    void chrome.action.setTitle({
      tabId,
      title: 'OpenClaw Browser Relay: disconnected (auto-reconnecting...)',
    })
  }
  tabs.clear()
  tabBySession.clear()
  childSessionToTab.clear()
  
  // Schedule auto-reconnect if enabled (pass saved tabs)
  void scheduleAutoReconnect(attachedTabs)
}

function sendToRelay(payload) {
  const ws = relayWs
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Relay not connected')
  }
  ws.send(JSON.stringify(payload))
}

async function maybeOpenHelpOnce() {
  try {
    const stored = await chrome.storage.local.get(['helpOnErrorShown'])
    if (stored.helpOnErrorShown === true) return
    await chrome.storage.local.set({ helpOnErrorShown: true })
    await chrome.runtime.openOptionsPage()
  } catch {
    // ignore
  }
}

function requestFromRelay(command) {
  const id = command.id
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    try {
      sendToRelay(command)
    } catch (err) {
      pending.delete(id)
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}

async function onRelayMessage(text) {
  /** @type {any} */
  let msg
  try {
    msg = JSON.parse(text)
  } catch {
    return
  }

  if (msg && msg.method === 'ping') {
    try {
      sendToRelay({ method: 'pong' })
    } catch {
      // ignore
    }
    return
  }

  if (msg && typeof msg.id === 'number' && (msg.result !== undefined || msg.error !== undefined)) {
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.error) p.reject(new Error(String(msg.error)))
    else p.resolve(msg.result)
    return
  }

  if (msg && typeof msg.id === 'number' && msg.method === 'forwardCDPCommand') {
    try {
      const result = await handleForwardCdpCommand(msg)
      sendToRelay({ id: msg.id, result })
    } catch (err) {
      sendToRelay({ id: msg.id, error: err instanceof Error ? err.message : String(err) })
    }
  }
}

function getTabBySessionId(sessionId) {
  const direct = tabBySession.get(sessionId)
  if (direct) return { tabId: direct, kind: 'main' }
  const child = childSessionToTab.get(sessionId)
  if (child) return { tabId: child, kind: 'child' }
  return null
}

function getTabByTargetId(targetId) {
  for (const [tabId, tab] of tabs.entries()) {
    if (tab.targetId === targetId) return tabId
  }
  return null
}

async function attachTab(tabId, opts = {}) {
  const debuggee = { tabId }
  await chrome.debugger.attach(debuggee, '1.3')
  await chrome.debugger.sendCommand(debuggee, 'Page.enable').catch(() => {})

  const info = /** @type {any} */ (await chrome.debugger.sendCommand(debuggee, 'Target.getTargetInfo'))
  const targetInfo = info?.targetInfo
  const targetId = String(targetInfo?.targetId || '').trim()
  if (!targetId) {
    throw new Error('Target.getTargetInfo returned no targetId')
  }

  const sessionId = `cb-tab-${nextSession++}`
  const attachOrder = nextSession

  tabs.set(tabId, { state: 'connected', sessionId, targetId, attachOrder })
  tabBySession.set(sessionId, tabId)
  void chrome.action.setTitle({
    tabId,
    title: 'OpenClaw Browser Relay: attached (click to detach)',
  })

  if (!opts.skipAttachedEvent) {
    sendToRelay({
      method: 'forwardCDPEvent',
      params: {
        method: 'Target.attachedToTarget',
        params: {
          sessionId,
          targetInfo: { ...targetInfo, attached: true },
          waitingForDebugger: false,
        },
      },
    })
  }

  setBadge(tabId, 'on')
  return { sessionId, targetId }
}

async function detachTab(tabId, reason) {
  const tab = tabs.get(tabId)
  if (tab?.sessionId && tab?.targetId) {
    try {
      sendToRelay({
        method: 'forwardCDPEvent',
        params: {
          method: 'Target.detachedFromTarget',
          params: { sessionId: tab.sessionId, targetId: tab.targetId, reason },
        },
      })
    } catch {
      // ignore
    }
  }

  if (tab?.sessionId) tabBySession.delete(tab.sessionId)
  tabs.delete(tabId)

  for (const [childSessionId, parentTabId] of childSessionToTab.entries()) {
    if (parentTabId === tabId) childSessionToTab.delete(childSessionId)
  }

  try {
    await chrome.debugger.detach({ tabId })
  } catch {
    // ignore
  }

  setBadge(tabId, 'off')
  void chrome.action.setTitle({
    tabId,
    title: 'OpenClaw Browser Relay (click to attach/detach)',
  })
}

async function connectOrToggleForActiveTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = active?.id
  if (!tabId) return

  const existing = tabs.get(tabId)
  if (existing?.state === 'connected') {
    await detachTab(tabId, 'toggle')
    return
  }

  tabs.set(tabId, { state: 'connecting' })
  setBadge(tabId, 'connecting')
  void chrome.action.setTitle({
    tabId,
    title: 'OpenClaw Browser Relay: connecting to local relay…',
  })

  try {
    await ensureRelayConnection()
    await attachTab(tabId)
  } catch (err) {
    tabs.delete(tabId)
    setBadge(tabId, 'error')
    void chrome.action.setTitle({
      tabId,
      title: 'OpenClaw Browser Relay: relay not running (open options for setup)',
    })
    void maybeOpenHelpOnce()
    // Extra breadcrumbs in chrome://extensions service worker logs.
    const message = err instanceof Error ? err.message : String(err)
    console.warn('attach failed', message, nowStack())
  }
}

async function handleForwardCdpCommand(msg) {
  const method = String(msg?.params?.method || '').trim()
  const params = msg?.params?.params || undefined
  const sessionId = typeof msg?.params?.sessionId === 'string' ? msg.params.sessionId : undefined

  // Map command to tab
  const bySession = sessionId ? getTabBySessionId(sessionId) : null
  const targetId = typeof params?.targetId === 'string' ? params.targetId : undefined
  const tabId =
    bySession?.tabId ||
    (targetId ? getTabByTargetId(targetId) : null) ||
    (() => {
      // No sessionId: pick the first connected tab (stable-ish).
      for (const [id, tab] of tabs.entries()) {
        if (tab.state === 'connected') return id
      }
      return null
    })()

  if (!tabId) throw new Error(`No attached tab for method ${method}`)

  /** @type {chrome.debugger.DebuggerSession} */
  const debuggee = { tabId }

  if (method === 'Runtime.enable') {
    try {
      await chrome.debugger.sendCommand(debuggee, 'Runtime.disable')
      await new Promise((r) => setTimeout(r, 50))
    } catch {
      // ignore
    }
    return await chrome.debugger.sendCommand(debuggee, 'Runtime.enable', params)
  }

  if (method === 'Target.createTarget') {
    const url = typeof params?.url === 'string' ? params.url : 'about:blank'
    const tab = await chrome.tabs.create({ url, active: false })
    if (!tab.id) throw new Error('Failed to create tab')
    await new Promise((r) => setTimeout(r, 100))
    const attached = await attachTab(tab.id)
    return { targetId: attached.targetId }
  }

  if (method === 'Target.closeTarget') {
    const target = typeof params?.targetId === 'string' ? params.targetId : ''
    const toClose = target ? getTabByTargetId(target) : tabId
    if (!toClose) return { success: false }
    try {
      await chrome.tabs.remove(toClose)
    } catch {
      return { success: false }
    }
    return { success: true }
  }

  if (method === 'Target.activateTarget') {
    const target = typeof params?.targetId === 'string' ? params.targetId : ''
    const toActivate = target ? getTabByTargetId(target) : tabId
    if (!toActivate) return {}
    const tab = await chrome.tabs.get(toActivate).catch(() => null)
    if (!tab) return {}
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {})
    }
    await chrome.tabs.update(toActivate, { active: true }).catch(() => {})
    return {}
  }

  const tabState = tabs.get(tabId)
  const mainSessionId = tabState?.sessionId
  const debuggerSession =
    sessionId && mainSessionId && sessionId !== mainSessionId
      ? { ...debuggee, sessionId }
      : debuggee

  return await chrome.debugger.sendCommand(debuggerSession, method, params)
}

function onDebuggerEvent(source, method, params) {
  const tabId = source.tabId
  if (!tabId) return
  const tab = tabs.get(tabId)
  if (!tab?.sessionId) return

  if (method === 'Target.attachedToTarget' && params?.sessionId) {
    childSessionToTab.set(String(params.sessionId), tabId)
  }

  if (method === 'Target.detachedFromTarget' && params?.sessionId) {
    childSessionToTab.delete(String(params.sessionId))
  }

  try {
    sendToRelay({
      method: 'forwardCDPEvent',
      params: {
        sessionId: source.sessionId || tab.sessionId,
        method,
        params,
      },
    })
  } catch {
    // ignore
  }
}

function onDebuggerDetach(source, reason) {
  const tabId = source.tabId
  if (!tabId) return
  if (!tabs.has(tabId)) return
  
  // Store tab info before detaching
  const wasAttached = tabs.has(tabId)
  
  // Always log detach events for debugging
  console.log(`[Debug] Tab ${tabId} detached, reason: ${reason}`)
  
  void detachTab(tabId, reason)
  
  // Auto-reattach if enabled and detach wasn't intentional
  // Exclude only 'toggle' (user manually detached)
  // For 'target_closed', we'll check if tab still exists before reattaching
  if (wasAttached && reason !== 'toggle') {
    void (async () => {
      const enabled = await getAutoReconnect()
      if (!enabled) {
        console.log(`[Auto-reconnect] Disabled, skipping reconnect for tab ${tabId}`)
        return
      }
      
      console.log(`[Auto-reconnect] Tab ${tabId} detached (${reason}), attempting to re-attach...`)
      
      setTimeout(async () => {
        try {
          // Check if tab still exists
          const tab = await chrome.tabs.get(tabId).catch(() => null)
          if (!tab) {
            console.log(`[Auto-reconnect] Tab ${tabId} no longer exists (closed), skipping`)
            return
          }
          
          console.log(`[Auto-reconnect] Tab ${tabId} still exists, reconnecting...`)
          await ensureRelayConnection()
          await attachTab(tabId)
          console.log(`[Auto-reconnect] Successfully re-attached tab ${tabId}`)
        } catch (err) {
          console.warn(`[Auto-reconnect] Failed to re-attach tab ${tabId}:`, err)
        }
      }, RECONNECT_DELAY_MS)
    })()
  } else {
    console.log(`[Auto-reconnect] Skipping reconnect for tab ${tabId} (reason: ${reason}, wasAttached: ${wasAttached})`)
  }
}

chrome.action.onClicked.addListener(() => void connectOrToggleForActiveTab())

chrome.runtime.onInstalled.addListener(() => {
  // Useful: first-time instructions.
  void chrome.runtime.openOptionsPage()
})

// Listen for tab navigation (refresh, URL change)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only handle when navigation is committed (page starts loading)
  if (changeInfo.status !== 'loading') return
  
  // Check if this tab was attached
  const wasAttached = tabs.has(tabId)
  if (!wasAttached) return
  
  const enabled = await getAutoReconnect()
  if (!enabled) return
  
  console.log(`[Auto-reconnect] Tab ${tabId} is navigating (refresh/URL change), will re-attach...`)
  
  // When page navigates, target ID changes, so we need to re-attach
  // Properly detach first to notify relay
  await detachTab(tabId, 'navigation')
  
  // Wait a bit for page to start loading
  setTimeout(async () => {
    try {
      await ensureRelayConnection()
      await attachTab(tabId)
      console.log(`[Auto-reconnect] Successfully re-attached tab ${tabId} after navigation`)
    } catch (err) {
      console.warn(`[Auto-reconnect] Failed to re-attach tab ${tabId} after navigation:`, err)
    }
  }, RECONNECT_DELAY_MS)
})
