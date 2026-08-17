import { getJson, isRecord } from './api-client'
export type EvaluationApiResponse = Record<string, unknown>
const isEvaluationApiResponse = (value: unknown): value is EvaluationApiResponse => isRecord(value)
export const fetchEvaluation = (fetcher: typeof fetch = fetch, runId: string) => getJson(fetcher, `/api/contextgraph/evaluation/runs/${encodeURIComponent(runId)}`, {}, isEvaluationApiResponse)
