export type EvidenceResolutionState = 'exact' | 'relocated_exact' | 'normalized_match' | 'ambiguous' | 'unresolved' | 'source_changed'
export type EvidenceLocation = { state: EvidenceResolutionState; blockId?: string; locator?: string }
