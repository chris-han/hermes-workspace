export type AssistantContentSummary = {
  hasVisibleText: boolean
  hasGovernedResponse: boolean
  hasSensitiveGovernancePreview: boolean
  hasA2UiContent: boolean
  hasVisibleAttachments: boolean
  hasVisibleInlineImages: boolean
  hasVisibleToolSections: boolean
  hasVisibleLifecycleContent: boolean
  hasVisibleThinkingDisclosure: boolean
  hasVisibleResearchTimeline: boolean
  hasSubstantiveVisibleAssistantContent: boolean
}

export type AssistantContentSummaryInput = Partial<
  Omit<AssistantContentSummary, 'hasSubstantiveVisibleAssistantContent'>
>

const EMPTY_SUMMARY_FLAGS: Omit<
  AssistantContentSummary,
  'hasSubstantiveVisibleAssistantContent'
> = {
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
}

export function createAssistantContentSummary(
  input: AssistantContentSummaryInput = {},
): AssistantContentSummary {
  const flags = {
    ...EMPTY_SUMMARY_FLAGS,
    ...input,
  }
  const hasSubstantiveVisibleAssistantContent = Object.values(flags).some(
    Boolean,
  )

  return {
    ...flags,
    hasSubstantiveVisibleAssistantContent,
  }
}

export function createEmptyAssistantContentSummary(): AssistantContentSummary {
  return createAssistantContentSummary()
}
