import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildMemberDefinitions,
  getHermesHome,
  readCronJobCount,
} from './mission-control-status'

describe('crew-status workspace helpers', () => {
  let tempRoot = ''

  afterEach(() => {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true })
      tempRoot = ''
    }
  })

  it('reads crew profiles from the active workspace hermes home', () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crew-status-'))
    const hermesHome = path.join(tempRoot, '.hermes')
    fs.mkdirSync(path.join(hermesHome, 'profiles', 'writer'), { recursive: true })
    fs.mkdirSync(path.join(hermesHome, 'profiles', 'reviewer'), { recursive: true })

    const crew = buildMemberDefinitions(hermesHome)

    expect(crew.map((member) => member.id)).toEqual([
      'workspace',
      'reviewer',
      'writer',
    ])
    expect(getHermesHome(hermesHome, 'writer')).toBe(
      path.join(hermesHome, 'profiles', 'writer'),
    )
  })

  it('reads cron job count from the active workspace hermes home', () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crew-status-'))
    const hermesHome = path.join(tempRoot, '.hermes')
    fs.mkdirSync(path.join(hermesHome, 'cron'), { recursive: true })
    fs.writeFileSync(
      path.join(hermesHome, 'cron', 'jobs.json'),
      JSON.stringify([{ id: 'a' }, { id: 'b' }, { id: 'c' }]),
      'utf-8',
    )

    expect(readCronJobCount(hermesHome)).toBe(3)
  })
})
