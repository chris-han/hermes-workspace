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

  it('does not auto-inject schema_form for free-form structured prompts (use backend A2UI instead)', () => {
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

    // Auto-synthesis is disabled — forms must come from explicit backend A2UI schemas.
    expect(plan.some((item) => item.kind === 'ui')).toBe(false)
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

  it('does not synthesize a schema_form even when assistant lists labelled fields', () => {
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

    // Auto-synthesis is disabled — even when text reads like a field list,
    // forms must come from an explicit backend A2UI schema.
    expect(plan.some((item) => item.kind === 'ui')).toBe(false)
  })

  it('does not mine markdown tables into form fields when assistant uses conversational closing phrases', () => {
    // Regression: session 64adbd385339 produced a free-text form with garbage
    // labels like "| S&P 500 | 7" because the closing line "...请告诉我您感兴趣的方向"
    // triggered auto-form synthesis that then split the markdown table rows.
    const message: ChatMessage = {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: [
            '## 美股走势概览',
            '',
            '| 指数 | 最新收盘 | 日涨跌 | 月涨跌 | 3 月涨跌 |',
            '|------|----------|--------|--------|----------|',
            '| **S&P 500** | 7,135.95 | -0.04% | +9.30% | +2.29% |',
            '| **NASDAQ** | 24,673.24 | +0.04% | +14.28% | +4.58% |',
            '| **Dow Jones** | 48,861.81 | -0.57% | +5.44% | -1.10% |',
            '',
            '如需查看具体个股走势、行业板块分析或更详细的技术面分析，请告诉我您感兴趣的方向。',
          ].join('\n'),
        },
      ],
      timestamp: Date.now(),
    }

    const plan = buildInlineToolRenderPlan(message, [])

    expect(plan.some((item) => item.kind === 'ui')).toBe(false)
  })
})
