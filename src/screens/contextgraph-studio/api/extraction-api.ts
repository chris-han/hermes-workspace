import { getJson, isRecord } from './api-client'
export type ExtractionApiResponse = Record<string, unknown>
const isExtractionApiResponse = (value: unknown): value is ExtractionApiResponse => isRecord(value)
export const fetchExtraction = (fetcher: typeof fetch = fetch, runId?: string) => getJson(fetcher, `/api/knowledge/builder/extraction-runs${runId ? `/${encodeURIComponent(runId)}` : ''}`, {}, isExtractionApiResponse)
