import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { resolveWorkspaceAppStateRoot } from './workspace-root'

const MAX_MESSAGES_PER_SESSION = 500

export type LocalSession = {
  id: string
  title: string | null
  model: string | null
  createdAt: number
  updatedAt: number
  messageCount: number
}

export type LocalMessage = {
  id: string
  role: string
  content: string
  timestamp: number
  toolCalls?: unknown
  toolCallId?: string
  toolName?: string
}

type StoreData = {
  sessions: Record<string, LocalSession>
  messages: Record<string, Array<LocalMessage>>
}

const storeCache = new Map<string, StoreData>()
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

function getSessionsFile(workspaceRoot: string): string {
  return join(
    resolveWorkspaceAppStateRoot(workspaceRoot),
    'local-sessions.json',
  )
}

function loadFromDisk(workspaceRoot: string): StoreData {
  const cached = storeCache.get(workspaceRoot)
  if (cached) return cached

  let store: StoreData = { sessions: {}, messages: {} }
  try {
    const sessionsFile = getSessionsFile(workspaceRoot)
    if (existsSync(sessionsFile)) {
      const raw = readFileSync(sessionsFile, 'utf-8')
      const parsed = JSON.parse(raw) as StoreData
      if (parsed.sessions && parsed.messages) {
        store = parsed
      }
    }
  } catch {
    // ignore corrupt local cache
  }
  storeCache.set(workspaceRoot, store)
  return store
}

function saveToDisk(workspaceRoot: string): void {
  try {
    const dataDir = resolveWorkspaceAppStateRoot(workspaceRoot)
    const sessionsFile = getSessionsFile(workspaceRoot)
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
    const store = loadFromDisk(workspaceRoot)
    writeFileSync(sessionsFile, JSON.stringify(store, null, 2))
  } catch {
    // ignore cache write failures
  }
}

export function listLocalSessions(workspaceRoot: string): Array<LocalSession> {
  const store = loadFromDisk(workspaceRoot)
  return Object.values(store.sessions).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getLocalSession(
  workspaceRoot: string,
  sessionId: string,
): LocalSession | null {
  const store = loadFromDisk(workspaceRoot)
  return store.sessions[sessionId] ?? null
}

export function ensureLocalSession(
  workspaceRoot: string,
  sessionId: string,
  model?: string,
): LocalSession {
  const store = loadFromDisk(workspaceRoot)
  if (!store.sessions[sessionId]) {
    store.sessions[sessionId] = {
      id: sessionId,
      title: null,
      model: model ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    }
    store.messages[sessionId] = []
    saveToDisk(workspaceRoot)
  }
  return store.sessions[sessionId]
}

export function updateLocalSessionTitle(
  workspaceRoot: string,
  sessionId: string,
  title: string,
): void {
  const store = loadFromDisk(workspaceRoot)
  const session = store.sessions[sessionId]
  if (session) {
    session.title = title
    session.updatedAt = Date.now()
    saveToDisk(workspaceRoot)
  }
}

export function touchLocalSession(
  workspaceRoot: string,
  sessionId: string,
): void {
  const store = loadFromDisk(workspaceRoot)
  const session = store.sessions[sessionId]
  if (session) session.updatedAt = Date.now()
}

export function deleteLocalSession(
  workspaceRoot: string,
  sessionId: string,
): void {
  const store = loadFromDisk(workspaceRoot)
  delete store.sessions[sessionId]
  delete store.messages[sessionId]
  saveToDisk(workspaceRoot)
}

export function getLocalMessages(
  workspaceRoot: string,
  sessionId: string,
): Array<LocalMessage> {
  const store = loadFromDisk(workspaceRoot)
  return store.messages[sessionId] ?? []
}

export function appendLocalMessage(
  workspaceRoot: string,
  sessionId: string,
  message: LocalMessage,
): void {
  const store = loadFromDisk(workspaceRoot)
  ensureLocalSession(workspaceRoot, sessionId)
  if (!store.messages[sessionId]) store.messages[sessionId] = []
  store.messages[sessionId].push(message)
  if (store.messages[sessionId].length > MAX_MESSAGES_PER_SESSION) {
    store.messages[sessionId] = store.messages[sessionId].slice(
      -MAX_MESSAGES_PER_SESSION,
    )
  }
  const session = store.sessions[sessionId]
  if (session) {
    session.messageCount = store.messages[sessionId].length
    session.updatedAt = Date.now()
  }
  scheduleSave(workspaceRoot)
}

function scheduleSave(workspaceRoot: string): void {
  const existing = saveTimers.get(workspaceRoot)
  if (existing) return
  const timer = setTimeout(() => {
    saveTimers.delete(workspaceRoot)
    saveToDisk(workspaceRoot)
  }, 2000)
  saveTimers.set(workspaceRoot, timer)
}
