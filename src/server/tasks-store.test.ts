import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  moveTask,
  updateTask,
} from './tasks-store'

describe('tasks-store', () => {
  it('stores tasks separately per workspace Hermes home', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-store-'))
    const homeA = path.join(root, 'home-a')
    const homeB = path.join(root, 'home-b')

    try {
      const created = createTask(homeA, { title: 'Workspace A task' })

      expect(getTask(homeA, created.id)?.title).toBe('Workspace A task')
      expect(getTask(homeB, created.id)).toBeNull()
      expect(listTasks(homeA)).toHaveLength(1)
      expect(listTasks(homeB)).toHaveLength(0)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('updates, moves, and deletes tasks within one workspace home', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-store-'))
    const home = path.join(root, 'home-c')

    try {
      const created = createTask(home, { title: 'Initial task' })

      expect(
        updateTask(home, created.id, { title: 'Updated task' })?.title,
      ).toBe('Updated task')
      expect(moveTask(home, created.id, 'done')?.column).toBe('done')
      expect(deleteTask(home, created.id)).toBe(true)
      expect(getTask(home, created.id)).toBeNull()
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
