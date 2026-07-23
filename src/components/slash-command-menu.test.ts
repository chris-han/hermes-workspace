import { describe, expect, it } from 'vitest'

import {
  commandForSkillName,
  mergeInstalledSkillCommands,
  SLASH_COMMANDS,
} from './slash-command-menu'

describe('slash command menu skill commands', () => {
  it('registers the sensitive governance demo as a discoverable WebUI command', () => {
    expect(SLASH_COMMANDS).toContainEqual({
      command: '/sensitive-governance-demo',
      description: 'Run the sensitive information governance demo',
    })
  })

  it('normalizes skill names using the same command shape as the CLI', () => {
    expect(commandForSkillName('llm-wiki')).toBe('/llm-wiki')
    expect(commandForSkillName('My_Skill+Tool')).toBe('/my-skilltool')
    expect(commandForSkillName('  Research Agent  ')).toBe('/research-agent')
  })

  it('adds installed skill commands after built-ins', () => {
    const commands = mergeInstalledSkillCommands(
      [{ command: '/skills', description: 'Browse and manage skills' }],
      [
        {
          name: 'llm-wiki',
          description: 'Research with LLM wiki',
          installed: true,
          enabled: true,
        },
        {
          name: 'disabled-skill',
          description: 'Hidden',
          installed: true,
          enabled: false,
        },
        {
          name: 'skills',
          description: 'Duplicate built-in',
          installed: true,
          enabled: true,
        },
      ],
    )

    expect(commands).toEqual([
      { command: '/skills', description: 'Browse and manage skills' },
      { command: '/llm-wiki', description: 'Research with LLM wiki' },
    ])
  })
})
