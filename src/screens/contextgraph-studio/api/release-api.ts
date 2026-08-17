import { getJson, isRecord } from './api-client'
export type ReleaseApiResponse = Record<string, unknown>
const isReleaseApiResponse = (value: unknown): value is ReleaseApiResponse => isRecord(value)
export const fetchRelease = (fetcher: typeof fetch = fetch, releaseId: string) => getJson(fetcher, `/api/contextgraph/releases/${encodeURIComponent(releaseId)}`, {}, isReleaseApiResponse)
