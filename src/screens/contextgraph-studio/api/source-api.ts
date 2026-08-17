import { getJson, isRecord } from './api-client'
export type SourceApiResponse = Record<string, unknown>
const isSourceApiResponse = (value: unknown): value is SourceApiResponse => isRecord(value)
export const fetchSources = (fetcher: typeof fetch = fetch) => getJson(fetcher, '/api/knowledge/builder/sources', {}, isSourceApiResponse)
