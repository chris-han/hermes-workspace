import { getJson, isRecord } from './api-client'
export type TenderInspectionApiResponse = Record<string, unknown>
const isTenderInspectionApiResponse = (value: unknown): value is TenderInspectionApiResponse => isRecord(value)
export const fetchInspection = (fetcher: typeof fetch = fetch, runId: string) => getJson(fetcher, `/api/tender-document-review/runs/${encodeURIComponent(runId)}`, {}, isTenderInspectionApiResponse)
