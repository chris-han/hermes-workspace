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
  setRunThinking,
  upsertRunToolCall,
} from './run-store'

describe('run-store', () => {
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
})
