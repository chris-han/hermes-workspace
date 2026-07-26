import { describe, expect, it } from 'vitest'
import { syncLocaleFromSettings, t } from './i18n'

describe('workspace i18n', () => {
  it('provides Chinese labels for chat sidebar navigation', () => {
    syncLocaleFromSettings('zh')

    expect(t('chat.search')).toBe('搜索')
    expect(t('chat.newSession')).toBe('新建会话')
    expect(t('chat.startingSession')).toBe('正在创建…')
    expect(t('chat.main')).toBe('主菜单')
    expect(t('chat.knowledge')).toBe('背景信息')
    expect(t('nav.search')).toBe('搜索')
    expect(t('nav.orchestrator')).toBe('指挥中心')
    expect(t('nav.agentRoster')).toBe('组织构建')
    expect(t('nav.database')).toBe('数据库')
    expect(t('nav.effectiveContext')).toBe('有效背景信息')
    expect(t('nav.dataConnections')).toBe('数据连接')
  })

  it('provides Chinese labels for memory screen tabs', () => {
    syncLocaleFromSettings('zh')

    expect(t('memory.tabs.memory')).toBe('记忆')
    expect(t('memory.tabs.knowledge')).toBe('知识')
    expect(t('memory.tabs.governance')).toBe('治理')
  })
})
