import { describe, expect, it } from 'vitest'

import {
  createAssistantContentSummary,
  createEmptyAssistantContentSummary,
} from './assistant-content'
import type { AssistantContentSummaryInput } from './assistant-content'

const POSITIVE_CONTENT_FLAGS = [
  'hasVisibleText',
  'hasGovernedResponse',
  'hasSensitiveGovernancePreview',
  'hasA2UiContent',
  'hasVisibleAttachments',
  'hasVisibleInlineImages',
  'hasVisibleToolSections',
  'hasVisibleLifecycleContent',
  'hasVisibleThinkingDisclosure',
  'hasVisibleResearchTimeline',
] satisfies Array<keyof AssistantContentSummaryInput>

describe('createAssistantContentSummary', () => {
  it('defaults to no substantive visible assistant content', () => {
    expect(createEmptyAssistantContentSummary()).toEqual({
      hasVisibleText: false,
      hasGovernedResponse: false,
      hasSensitiveGovernancePreview: false,
      hasA2UiContent: false,
      hasVisibleAttachments: false,
      hasVisibleInlineImages: false,
      hasVisibleToolSections: false,
      hasVisibleLifecycleContent: false,
      hasVisibleThinkingDisclosure: false,
      hasVisibleResearchTimeline: false,
      hasSubstantiveVisibleAssistantContent: false,
    })
  })

  it.each(POSITIVE_CONTENT_FLAGS)(
    'treats %s as substantive visible assistant content',
    (flag) => {
      expect(
        createAssistantContentSummary({
          [flag]: true,
        }),
      ).toMatchObject({
        [flag]: true,
        hasSubstantiveVisibleAssistantContent: true,
      })
    },
  )

  it('does not infer visible content from omitted raw or hidden data', () => {
    const hiddenStreamingRows = 1
    const rawRejectedPayloads = 1
    const zeroStepResearchTimeline = 0
    const filteredAttachments = 2
    void hiddenStreamingRows
    void rawRejectedPayloads
    void zeroStepResearchTimeline
    void filteredAttachments

    expect(createAssistantContentSummary()).toMatchObject({
      hasSubstantiveVisibleAssistantContent: false,
    })
  })

  it('keeps individual flags available for activity decision tests', () => {
    expect(
      createAssistantContentSummary({
        hasVisibleText: true,
        hasVisibleToolSections: true,
      }),
    ).toEqual({
      hasVisibleText: true,
      hasGovernedResponse: false,
      hasSensitiveGovernancePreview: false,
      hasA2UiContent: false,
      hasVisibleAttachments: false,
      hasVisibleInlineImages: false,
      hasVisibleToolSections: true,
      hasVisibleLifecycleContent: false,
      hasVisibleThinkingDisclosure: false,
      hasVisibleResearchTimeline: false,
      hasSubstantiveVisibleAssistantContent: true,
    })
  })
})
