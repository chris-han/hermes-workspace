import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getProfilesRoot,
  isManagedProfile,
  listProfiles,
  readProfile,
} from './profiles-browser'

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
    const hermesHome = '/repo/workspaces/ws-123'

    expect(getProfilesRoot(hermesHome)).toBe(
      '/repo/workspaces/ws-123/profiles',
    )
  })

  it('always includes the default profile even when a named profile is active', () => {
    const hermesRoot = tempHome
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

  it('lists profile identity and prompt fields used by Agent Roster', () => {
    const hermesRoot = tempHome
    const profileRoot = path.join(hermesRoot, 'profiles', 'pc1-coder')

    fs.mkdirSync(profileRoot, { recursive: true })
    fs.writeFileSync(
      path.join(profileRoot, 'config.yaml'),
      [
        'display_name: PC1 Coder',
        'avatar_data_url: data:image/png;base64,avatar',
        'description: Implements focused code changes',
        'system_prompt: Use the profile-specific prompt',
        'model: openai/gpt-5-codex',
        '',
      ].join('\n'),
      'utf-8',
    )

    const profile = listProfiles(hermesRoot).find(
      (entry) => entry.name === 'pc1-coder',
    )

    expect(profile).toMatchObject({
      name: 'pc1-coder',
      displayName: 'PC1 Coder',
      avatarDataUrl: 'data:image/png;base64,avatar',
      description: 'Implements focused code changes',
      systemPrompt: 'Use the profile-specific prompt',
      model: 'openai/gpt-5-codex',
      provider: 'openai',
    })
  })

  it('exposes managed profiles as read-only virtual entries', () => {
    const workspaceHome = path.join(tempHome, 'workspace')
    const managedHome = path.join(tempHome, 'managed')
    const profileRoot = path.join(
      managedHome,
      'profiles',
      'tender-runtime-expert',
    )
    fs.mkdirSync(profileRoot, { recursive: true })
    fs.writeFileSync(
      path.join(profileRoot, 'config.yaml'),
      'display_name: Graph Explorer Runtime Expert\nmodel: openai/test\n',
      'utf-8',
    )
    fs.writeFileSync(
      path.join(profileRoot, 'SOUL.md'),
      'Read-only managed runtime expert.\n',
      'utf-8',
    )

    const summary = listProfiles(workspaceHome, {
      managedHomes: [managedHome],
    }).find((entry) => entry.name === 'tender-runtime-expert')
    expect(summary).toMatchObject({
      path: 'managed://tender-runtime-expert',
      managed: true,
      readOnly: true,
      sessionCount: 0,
      hasEnv: false,
    })

    const detail = readProfile('tender-runtime-expert', workspaceHome, {
      managedHomes: [managedHome],
    })
    expect(detail).toMatchObject({
      path: 'managed://tender-runtime-expert',
      managed: true,
      readOnly: true,
      hasEnv: false,
      soul: 'Read-only managed runtime expert.\n',
    })
    expect(isManagedProfile('tender-runtime-expert', managedHome)).toBe(true)
    expect(isManagedProfile('default', managedHome)).toBe(false)
  })
})
