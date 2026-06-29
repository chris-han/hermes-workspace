import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  appendRunText,
  createPersistedRun,
  getActiveRunForSession,
  getPersistedRun,
  markRunStatus,
  persistRunTrajectory,
  setRunThinking,
  upsertRunToolCall,
} from './run-store'

describe('run-store', () => {
  it('writes run state under the canonical session runs directory', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-store-'))

    try {
      await createPersistedRun({
        workspaceRoot: root,
        sessionKey: 'session-a',
        runId: 'run-a',
      })

      expect(
        fs.existsSync(
          path.join(root, 'sessions', 'session-a', 'runs', 'run-a.json'),
        ),
      ).toBe(true)
      expect(
        fs.existsSync(
          path.join(
            root,
            '.hermes-workspace',
            'runs',
            'session-a',
            'run-a.json',
          ),
        ),
      ).toBe(false)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('normalizes workspace-prefixed session keys for run directories', async () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), '3f40097f9d46422a8a56609334c5fb4a-'),
    )
    const workspaceRoot = path.join(root, '3f40097f9d46422a8a56609334c5fb4a')
    const sessionKey = '3f40097f9d46422a8a56609334c5fb4a:session-a'

    try {
      await createPersistedRun({
        workspaceRoot,
        sessionKey,
        runId: 'run-a',
      })

      expect(
        fs.existsSync(
          path.join(
            workspaceRoot,
            'sessions',
            'session-a',
            'runs',
            'run-a.json',
          ),
        ),
      ).toBe(true)
      expect(
        fs.existsSync(
          path.join(
            workspaceRoot,
            'sessions',
            encodeURIComponent(sessionKey),
            'runs',
            'run-a.json',
          ),
        ),
      ).toBe(false)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('reads legacy app-state runs and rewrites updates canonically', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-store-'))
    const legacyDir = path.join(root, '.hermes-workspace', 'runs', 'session-a')
    const legacyRun = {
      runId: 'run-a',
      sessionKey: 'session-a',
      friendlyId: 'session-a',
      status: 'active' as const,
      createdAt: 1,
      updatedAt: 1,
      lastEventAt: 1,
      assistantText: 'legacy',
      thinkingText: '',
      toolCalls: [],
      lifecycleEvents: [],
    }

    try {
      fs.mkdirSync(legacyDir, { recursive: true })
      fs.writeFileSync(
        path.join(legacyDir, 'run-a.json'),
        `${JSON.stringify(legacyRun, null, 2)}\n`,
        'utf8',
      )

      expect(
        (await getPersistedRun(root, 'session-a', 'run-a'))?.assistantText,
      ).toBe('legacy')

      await appendRunText(root, 'session-a', 'run-a', ' promoted')

      const canonicalRunPath = path.join(
        root,
        'sessions',
        'session-a',
        'runs',
        'run-a.json',
      )
      expect(fs.existsSync(canonicalRunPath)).toBe(true)
      expect(
        JSON.parse(fs.readFileSync(canonicalRunPath, 'utf8')).assistantText,
      ).toBe('legacy promoted')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps active runs isolated by session key', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-store-'))

    try {
      await createPersistedRun({
        workspaceRoot: root,
        sessionKey: 'session-a',
        runId: 'run-a',
      })
      await createPersistedRun({
        workspaceRoot: root,
        sessionKey: 'session-b',
        runId: 'run-b',
      })
      await markRunStatus(root, 'session-a', 'run-a', 'complete')

      const activeA = await getActiveRunForSession(root, 'session-a')
      const activeB = await getActiveRunForSession(root, 'session-b')

      expect(activeA).toBeNull()
      expect(activeB?.runId).toBe('run-b')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not reactivate a terminal run after late per-session writes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-store-'))
    const sessionKey = 'session-a'
    const runId = 'run-a'

    try {
      await createPersistedRun({ workspaceRoot: root, sessionKey, runId })
      await appendRunText(root, sessionKey, runId, 'final text')
      await markRunStatus(root, sessionKey, runId, 'complete')

      await appendRunText(root, sessionKey, runId, ' late text')
      await setRunThinking(root, sessionKey, runId, 'late thinking')
      await upsertRunToolCall(root, sessionKey, runId, {
        id: 'tool-1',
        name: 'governed_query',
        phase: 'complete',
      })
      await markRunStatus(root, sessionKey, runId, 'active')

      const run = await getPersistedRun(root, sessionKey, runId)
      expect(run?.status).toBe('complete')
      expect(run?.assistantText).toBe('final text late text')
      expect(run?.thinkingText).toBe('late thinking')
      expect(await getActiveRunForSession(root, sessionKey)).toBeNull()
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('persists a trajectory jsonl record on completed runs with model', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-store-'))
    const sessionKey = 'session_abc123'
    const runId = 'run-trajectory-a'

    try {
      await createPersistedRun({
        workspaceRoot: root,
        sessionKey,
        runId,
        model: 'qwen3.5-plus',
      })
      await setRunThinking(root, sessionKey, runId, 'thinking step')
      await appendRunText(root, sessionKey, runId, 'final answer')
      await markRunStatus(root, sessionKey, runId, 'complete')

      const wrote = await persistRunTrajectory(root, sessionKey, runId)
      expect(wrote).toBe(true)

      const trajectoryPath = path.join(
        root,
        'sessions',
        sessionKey,
        'logs',
        `${sessionKey}.trajectory.jsonl`,
      )
      expect(fs.existsSync(trajectoryPath)).toBe(true)

      const lines = fs
        .readFileSync(trajectoryPath, 'utf8')
        .split('\n')
        .filter((line) => line.trim().length > 0)
      expect(lines.length).toBe(1)

      const payload = JSON.parse(lines[0]) as {
        runId: string
        sessionKey: string
        model: string
        completed: boolean
        conversations: Array<{ from: string; value: string }>
        timestamp: string
      }
      expect(payload.runId).toBe(runId)
      expect(payload.sessionKey).toBe(sessionKey)
      expect(payload.model).toBe('qwen3.5-plus')
      expect(payload.completed).toBe(true)
      expect(payload.conversations.length).toBe(2)
      expect(payload.timestamp.endsWith('Z')).toBe(true)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not append duplicate trajectory records for the same run', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-store-'))
    const sessionKey = 'session_dup1'
    const runId = 'run-dup-a'

    try {
      await createPersistedRun({ workspaceRoot: root, sessionKey, runId })
      await appendRunText(root, sessionKey, runId, 'done')
      await markRunStatus(root, sessionKey, runId, 'complete')

      expect(await persistRunTrajectory(root, sessionKey, runId)).toBe(true)
      expect(await persistRunTrajectory(root, sessionKey, runId)).toBe(false)

      const trajectoryPath = path.join(
        root,
        'sessions',
        sessionKey,
        'logs',
        `${sessionKey}.trajectory.jsonl`,
      )
      const lines = fs
        .readFileSync(trajectoryPath, 'utf8')
        .split('\n')
        .filter((line) => line.trim().length > 0)
      expect(lines.length).toBe(1)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
