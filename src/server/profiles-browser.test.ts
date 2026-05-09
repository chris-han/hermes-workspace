import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getProfilesRoot, listProfiles } from './profiles-browser'

describe('listProfiles', () => {
  let tempHome: string

  beforeEach(() => {
    tempHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'hermes-workspace-profiles-'),
    )
    vi.spyOn(os, 'homedir').mockReturnValue(tempHome)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(tempHome, { recursive: true, force: true })
  })

  it('reads profiles from the active workspace hermes home', () => {
    const hermesHome = '/repo/workspaces/ws-123/.hermes'

    expect(getProfilesRoot(hermesHome)).toBe(
      '/repo/workspaces/ws-123/.hermes/profiles',
    )
  })

  it('always includes the default profile even when a named profile is active', () => {
    const hermesRoot = path.join(tempHome, '.hermes')
    const profilesRoot = path.join(hermesRoot, 'profiles')
    const namedProfileRoot = path.join(profilesRoot, 'jarvis')

    fs.mkdirSync(namedProfileRoot, { recursive: true })
    fs.writeFileSync(
      path.join(hermesRoot, 'active_profile'),
      'jarvis\n',
      'utf-8',
    )
    fs.writeFileSync(
      path.join(hermesRoot, 'config.yaml'),
      'model: default-model\n',
      'utf-8',
    )
    fs.writeFileSync(
      path.join(namedProfileRoot, 'config.yaml'),
      'model: named-model\n',
      'utf-8',
    )

    const profiles = listProfiles(hermesRoot)
    const names = profiles.map((profile) => profile.name)

    expect(names).toContain('default')
    expect(names).toContain('jarvis')
    expect(profiles.find((profile) => profile.name === 'default')?.active).toBe(
      false,
    )
    expect(profiles.find((profile) => profile.name === 'jarvis')?.active).toBe(
      true,
    )
  })
})
