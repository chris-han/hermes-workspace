import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { writeMemoryFile } from './memory-browser'

describe('memory-browser writeMemoryFile', () => {
  const createdRoots: Array<string> = []

  afterEach(() => {
    for (const root of createdRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('appends a new curated memory entry instead of overwriting MEMORY.md', () => {
    const workspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'memory-write-'),
    )
    createdRoots.push(workspaceRoot)

    fs.writeFileSync(path.join(workspaceRoot, 'MEMORY.md'), 'old fact', 'utf-8')

    const savedPath = writeMemoryFile('MEMORY.md', 'new fact', {
      workspaceRoot,
    })

    expect(savedPath).toBe('MEMORY.md')
    expect(
      fs.readFileSync(path.join(workspaceRoot, 'MEMORY.md'), 'utf-8'),
    ).toBe(['old fact', '§', 'new fact'].join('\n'))
  })

  it('formats memories/MEMORY.md as Hermes section-delimited entries', () => {
    const workspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'memory-write-'),
    )
    createdRoots.push(workspaceRoot)

    fs.mkdirSync(path.join(workspaceRoot, 'memories'), { recursive: true })
    fs.writeFileSync(
      path.join(workspaceRoot, 'memories', 'MEMORY.md'),
      ' old fact \n',
      'utf-8',
    )

    const savedPath = writeMemoryFile(
      'memories/MEMORY.md',
      '\n new fact \r\n§\r\n another fact \n',
      {
        workspaceRoot,
      },
    )

    expect(savedPath).toBe('memories/MEMORY.md')
    expect(
      fs.readFileSync(
        path.join(workspaceRoot, 'memories', 'MEMORY.md'),
        'utf-8',
      ),
    ).toBe(['old fact', '§', 'new fact', '§', 'another fact'].join('\n'))
  })

  it('still overwrites MEMORY.md when the payload already contains the existing content', () => {
    const workspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'memory-write-'),
    )
    createdRoots.push(workspaceRoot)

    fs.writeFileSync(path.join(workspaceRoot, 'MEMORY.md'), 'old fact', 'utf-8')

    const nextContent = ['old fact', '§', 'new fact'].join('\n')
    writeMemoryFile('MEMORY.md', nextContent, { workspaceRoot })

    expect(
      fs.readFileSync(path.join(workspaceRoot, 'MEMORY.md'), 'utf-8'),
    ).toBe(nextContent)
  })

  it('replaces curated memory content when replace mode is requested', () => {
    const workspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'memory-write-'),
    )
    createdRoots.push(workspaceRoot)

    fs.writeFileSync(path.join(workspaceRoot, 'MEMORY.md'), 'old fact', 'utf-8')

    writeMemoryFile('MEMORY.md', 'edited fact', {
      workspaceRoot,
      writeMode: 'replace',
    })

    expect(
      fs.readFileSync(path.join(workspaceRoot, 'MEMORY.md'), 'utf-8'),
    ).toBe('edited fact')
  })

  it('does not duplicate content on repeated replace saves', () => {
    const workspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'memory-write-'),
    )
    createdRoots.push(workspaceRoot)

    const editedContent = ['edited fact', '§', 'second fact'].join('\n')
    writeMemoryFile('MEMORY.md', editedContent, {
      workspaceRoot,
      writeMode: 'replace',
    })
    writeMemoryFile('MEMORY.md', editedContent, {
      workspaceRoot,
      writeMode: 'replace',
    })

    expect(
      fs.readFileSync(path.join(workspaceRoot, 'MEMORY.md'), 'utf-8'),
    ).toBe(editedContent)
  })
})
