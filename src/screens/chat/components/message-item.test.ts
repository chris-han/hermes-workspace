import { describe, expect, it } from 'vitest'

import { buildInlineToolRenderPlan } from './message-item'
import type { ChatMessage } from '../types'

describe('buildInlineToolRenderPlan', () => {
  it('preserves tool-call position from assistant content order', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Before tool. ' },
        {
          type: 'toolCall',
          id: 'tc-1',
          name: 'browser_snapshot',
          arguments: { full: false },
        },
        { type: 'text', text: 'After tool.' },
      ],
      timestamp: Date.now(),
    }

    const plan = buildInlineToolRenderPlan(message, [
      {
        key: 'tc-1',
        type: 'browser_snapshot',
        preview: '📸 Snapshot',
        outputText: '',
        state: 'input-available',
      },
    ])

    expect(plan).toEqual([
      { kind: 'text', text: 'Before tool. ' },
      {
        kind: 'tool',
        section: {
          key: 'tc-1',
          type: 'browser_snapshot',
          preview: '📸 Snapshot',
          outputText: '',
          state: 'input-available',
        },
      },
      { kind: 'text', text: 'After tool.' },
    ])
  })

  it('auto-injects generic schema_form for structured assistant prompt', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: '请提供以下信息：项目名称、目标用户、上线时间、项目描述。',
        },
      ],
      timestamp: Date.now(),
    }

    const plan = buildInlineToolRenderPlan(message, [])

    expect(plan.some((item) => item.kind === 'ui')).toBe(true)
    expect(plan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'text' }),
        expect.objectContaining({
          kind: 'ui',
          schema: expect.objectContaining({
            root: expect.objectContaining({
              component: 'schema_form',
              props: expect.objectContaining({
                fields: expect.arrayContaining([
                  expect.objectContaining({ label: '项目名称' }),
                  expect.objectContaining({ label: '目标用户' }),
                  expect.objectContaining({ label: '上线时间' }),
                  expect.objectContaining({ label: '项目描述' }),
                ]),
              }),
            }),
          }),
        }),
      ]),
    )
  })

  it('does not inject generic form when assistant text is not requesting fields', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: '我已经完成联系人搜索并准备创建会议。' }],
      timestamp: Date.now(),
    }

    const plan = buildInlineToolRenderPlan(message, [])

    expect(plan.some((item) => item.kind === 'ui')).toBe(false)
  })

  it('filters instruction lines and marks optional fields as not required', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: [
            '请补充以下信息：',
            '会议主题**是什么',
            '会议时间**（哪天几点？）',
            '参会人员**有哪些？（可选）',
            '如果没有就不填',
            '提供这些信息后',
            '我就可以帮你创建飞书会议了',
          ].join('\n'),
        },
      ],
      timestamp: Date.now(),
    }

    const plan = buildInlineToolRenderPlan(message, [])
    const uiItem = plan.find((item) => item.kind === 'ui') as
      | Extract<(typeof plan)[number], { kind: 'ui' }>
      | undefined

    expect(uiItem).toBeDefined()
    const root = uiItem?.schema.root as {
      component?: string
      props?: { fields?: Array<{ label?: string; required?: boolean }> }
    }
    expect(root.component).toBe('schema_form')
    const fields = root.props?.fields || []

    const topicField = fields.find((field) =>
      (field.label || '').includes('会议主题'),
    )
    const timeField = fields.find((field) =>
      (field.label || '').includes('会议时间'),
    )
    const attendeeField = fields.find((field) =>
      (field.label || '').includes('参会人员'),
    )

    expect(topicField).toBeDefined()
    expect(topicField?.required).toBe(true)
    expect(timeField).toBeDefined()
    expect(timeField?.required).toBe(true)
    expect(attendeeField).toBeDefined()
    expect(attendeeField?.required).toBe(false)

    expect(fields.some((field) => field.label === '如果没有就不填')).toBe(false)
    expect(fields.some((field) => field.label === '提供这些信息后')).toBe(false)
    expect(fields.some((field) => field.label === '我就可以帮你创建飞书会议了')).toBe(false)
  })
})
