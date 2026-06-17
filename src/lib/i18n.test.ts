import { describe, expect, it } from 'vitest'
import { syncLocaleFromSettings, t } from './i18n'

describe('workspace i18n', () => {
  it('provides Chinese labels for chat sidebar navigation', () => {
    syncLocaleFromSettings('zh')

    expect(t('chat.search')).toBe('搜索')
    expect(t('chat.newSession')).toBe('新建会话')
    expect(t('chat.startingSession')).toBe('正在创建…')
    expect(t('chat.main')).toBe('主菜单')
    expect(t('chat.knowledge')).toBe('知识')
    expect(t('nav.search')).toBe('搜索')
    expect(t('nav.conductor')).toBe('指挥中心')
    expect(t('nav.operations')).toBe('运营')
    expect(t('nav.dataConnections')).toBe('数据连接')
  })
})