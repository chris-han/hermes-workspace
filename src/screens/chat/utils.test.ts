/**
 * Regression tests for textFromMessage think-block stripping.
 *
 * Bug: History messages were stored with raw <think>...</think> blocks in their
 * content field. textFromMessage returned the raw text including the think block,
 * while streamed messages had think blocks stripped at the source. This caused
 * dedup in mergeHistoryMessages to fail, showing the assistant reply twice.
 *
 * Fix: textFromMessage now strips <think>/<thinking>/<thought> blocks for
 * assistant messages before returning, so both representations compare equal.
 */
import { describe, expect, it } from 'vitest'

import type { ChatMessage } from './types'
import { textFromMessage } from './utils'

function makeAssistantMsg(text: string): ChatMessage {
  return {
    id: 'a1',
    role: 'assistant',
    content: [{ type: 'text', text }],
    createdAt: Date.now(),
  }
}

describe('textFromMessage — think block stripping (regression #double-reply)', () => {
  it('strips <think> block from assistant message', () => {
    const msg = makeAssistantMsg(
      "<think>\nsome reasoning\n</think>\nHi! I'm ready to help.",
    )
    expect(textFromMessage(msg)).toBe("Hi! I'm ready to help.")
  })

  it('strips <think> block with varied whitespace', () => {
    const msg = makeAssistantMsg(
      '<think>reasoning</think>   Hi! What would you like to work on?',
    )
    expect(textFromMessage(msg)).toBe('Hi! What would you like to work on?')
  })

  it('strips <thinking> block from assistant message', () => {
    const msg = makeAssistantMsg(
      '<thinking>inner thought</thinking>Answer text here.',
    )
    expect(textFromMessage(msg)).toBe('Answer text here.')
  })

  it('strips <thought> block from assistant message', () => {
    const msg = makeAssistantMsg('<thought>inner</thought>Final answer.')
    expect(textFromMessage(msg)).toBe('Final answer.')
  })

  it('strips multiple think blocks', () => {
    const msg = makeAssistantMsg(
      '<think>a</think>Hello<think>b</think> world.',
    )
    expect(textFromMessage(msg)).toBe('Hello world.')
  })

  it('preserves text with no think blocks', () => {
    const msg = makeAssistantMsg("Hi! I'm ready to help. What would you like?")
    expect(textFromMessage(msg)).toBe(
      "Hi! I'm ready to help. What would you like?",
    )
  })

  it('does NOT strip <think> blocks from user messages', () => {
    const msg: ChatMessage = {
      id: 'u1',
      role: 'user',
      content: [{ type: 'text', text: '<think>something</think>my question' }],
      createdAt: Date.now(),
    }
    // User message should not have think-block stripping applied
    expect(textFromMessage(msg)).toBe('<think>something</think>my question')
  })

  it('strips bracketed internal System verification nudges from user messages', () => {
    const msg: ChatMessage = {
      id: 'u2',
      role: 'user',
      content: [
        {
          type: 'text',
          text:
            '[System: You edited code in this turn, but the workspace does not have fresh passing verification evidence yet.\n\n' +
            'Verification status: unverified\n\n' +
            'Changed paths:\n- `/tmp/report.md`]',
        },
      ],
      createdAt: Date.now(),
    }

    expect(textFromMessage(msg)).toBe('')
  })

  it('strips internal document attachment context from user messages', () => {
    const msg: ChatMessage = {
      id: 'u3',
      role: 'user',
      content: [
        {
          type: 'text',
          text:
            "[The user sent a document: 'invoice.pdf'. It is saved at: /home/chris/.hermes/cache/documents/doc.pdf. " +
            'Its text is not inlined here. To read it in a Semantier workspace, pass this saved path to the registered document extraction tool.]',
        },
      ],
      createdAt: Date.now(),
    }

    expect(textFromMessage(msg)).toBe('')
  })
})
