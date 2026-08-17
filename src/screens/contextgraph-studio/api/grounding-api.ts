import { getJson, isRecord } from './api-client'
export type GroundingApiResponse = Record<string, unknown>
const isGroundingApiResponse = (value: unknown): value is GroundingApiResponse => isRecord(value)
export const fetchGrounding = (fetcher: typeof fetch = fetch, candidateId: string) => getJson(fetcher, `/api/knowledge/builder/assertion-candidates/${encodeURIComponent(candidateId)}`, {}, isGroundingApiResponse)
