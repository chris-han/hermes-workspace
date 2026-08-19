export const TENDER_EVALUATION_DETECTION_ENDPOINT =
  '/api/tender-document-review/detections'

export function buildTenderEvaluationDetectionRequest({
  fileRef,
  graphVersion,
  acceptedReleaseId,
}: {
  fileRef: string
  graphVersion?: string | null
  acceptedReleaseId?: string | null
}) {
  return {
    fileRef,
    sessionId: 'knowledge-builder',
    requestedRuleFamilies: ['tender_compliance'],
    expectedGraphVersion: graphVersion || undefined,
    expectedAcceptedReleaseId: acceptedReleaseId || graphVersion || undefined,
  }
}
