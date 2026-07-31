import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  createKnowledgeBuilderDiscoveryRun,
  createCanonicalTermCandidate,
  compileKnowledgeBuilderSensitiveLexicon,
  curateKnowledgeBuilderRelation,
  getKnowledgeBuilderCandidateExplanation,
  getKnowledgeBuilderDiscoveryRun,
  getKnowledgeBuilderRuntimeSemanticIndex,
  listKnowledgeBuilderFeedbackDeltas,
  mergeKnowledgeBuilderClusters,
  promoteKnowledgeBuilderRuntimeSemantics,
  rebuildKnowledgeBuilderReadModels,
  splitKnowledgeBuilderCluster,
} from '../../../server/knowledge-builder'
import {
  createKnowledgeBuilderEvaluationDataset,
  rateKnowledgeBuilderEvaluationResult,
  runKnowledgeBuilderEvaluation,
} from '../../../server/knowledge-builder-evaluation'
import {
  WorkspaceAuthRequiredError,
  resolveActiveWorkspaceRoot,
} from '../../../server/workspace-root'

const createUntypedFileRoute = createFileRoute as unknown as (
  path: string,
) => (options: Record<string, unknown>) => unknown

export const Route = createUntypedFileRoute('/api/knowledge/builder')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          await resolveActiveWorkspaceRoot(request.headers)
          const url = new URL(request.url)
          const runId = url.searchParams.get('runId')
          const candidateId = url.searchParams.get('candidateId')
          if (candidateId) {
            const explanation = await getKnowledgeBuilderCandidateExplanation(
              request.headers,
              candidateId,
            )
            return json({ explanation })
          }
          const authorityVersionId = url.searchParams.get('authorityVersionId')
          if (authorityVersionId) {
            const runtimeSemanticIndex = await getKnowledgeBuilderRuntimeSemanticIndex(
              request.headers,
              authorityVersionId,
            )
            return json({ runtimeSemanticIndex })
          }
          if (url.searchParams.get('feedbackDeltas') === '1') {
            const feedbackDeltas = await listKnowledgeBuilderFeedbackDeltas(
              request.headers,
              runId || undefined,
            )
            return json({ feedbackDeltas })
          }
          if (!runId) {
            return json({ error: 'runId is required' }, { status: 400 })
          }
          const run = await getKnowledgeBuilderDiscoveryRun(request.headers, runId)
          return json({ run })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load Knowledge Builder discovery run',
            },
            { status: 400 },
          )
        }
      },
      POST: async ({ request }: { request: Request }) => {
        try {
          const activeWorkspace = await resolveActiveWorkspaceRoot(
            request.headers,
          )
          const body = await request.json()
          if (body.action === 'compileSensitiveLexicon') {
            const discoveryResult = await compileKnowledgeBuilderSensitiveLexicon(
              request.headers,
              activeWorkspace,
              {
                uploadRef: String(body.uploadRef || body.upload_ref || ''),
                sourceRef: body.sourceRef || body.source_ref,
              },
            )
            return json({ discoveryResult })
          }
          if (body.action === 'curateRelation') {
            const relationCandidate = await curateKnowledgeBuilderRelation(
              request.headers,
              body as Parameters<typeof curateKnowledgeBuilderRelation>[1],
            )
            return json({ relationCandidate })
          }
          if (body.action === 'splitCluster') {
            const curationEvent = await splitKnowledgeBuilderCluster(
              request.headers,
              body as Parameters<typeof splitKnowledgeBuilderCluster>[1],
            )
            return json({ curationEvent })
          }
          if (body.action === 'mergeClusters') {
            const curationEvent = await mergeKnowledgeBuilderClusters(
              request.headers,
              body as Parameters<typeof mergeKnowledgeBuilderClusters>[1],
            )
            return json({ curationEvent })
          }
          if (body.action === 'canonicalTerm') {
            const termCandidate = await createCanonicalTermCandidate(
              request.headers,
              body as Parameters<typeof createCanonicalTermCandidate>[1],
            )
            return json({ termCandidate })
          }
          if (body.action === 'createEvaluationDataset') {
            const evaluationDataset = await createKnowledgeBuilderEvaluationDataset(
              request.headers,
              body as Parameters<typeof createKnowledgeBuilderEvaluationDataset>[1],
            )
            return json({ evaluationDataset })
          }
          if (body.action === 'runEvaluation') {
            const evaluationRun = await runKnowledgeBuilderEvaluation(
              request.headers,
              body as Parameters<typeof runKnowledgeBuilderEvaluation>[1],
            )
            return json({ evaluationRun })
          }
          if (body.action === 'rateEvaluationResult') {
            const evaluationResult = await rateKnowledgeBuilderEvaluationResult(
              request.headers,
              body as Parameters<typeof rateKnowledgeBuilderEvaluationResult>[1],
            )
            return json({ evaluationResult })
          }
          if (body.action === 'promoteRuntimeSemantics') {
            const authorityVersion = await promoteKnowledgeBuilderRuntimeSemantics(
              request.headers,
              body as Parameters<typeof promoteKnowledgeBuilderRuntimeSemantics>[1],
            )
            return json({ authorityVersion })
          }
          if (body.action === 'rebuildReadModels') {
            const readModelRebuild = await rebuildKnowledgeBuilderReadModels(
              request.headers,
              body as Parameters<typeof rebuildKnowledgeBuilderReadModels>[1],
            )
            return json({ readModelRebuild })
          }
          const run = await createKnowledgeBuilderDiscoveryRun(
            request.headers,
            body as Parameters<typeof createKnowledgeBuilderDiscoveryRun>[1],
          )
          return json({ run })
        } catch (error) {
          if (error instanceof WorkspaceAuthRequiredError) {
            return json({ error: error.message }, { status: 401 })
          }
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to create Knowledge Builder discovery run',
            },
            { status: 400 },
          )
        }
      },
    },
  },
})
