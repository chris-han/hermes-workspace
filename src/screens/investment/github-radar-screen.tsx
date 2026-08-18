import { Checkbox, Radio } from '@/components/ui/form-controls'

import { Input } from '@/components/ui/input'

import { ExternalLink, Play, Plus, Radar, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { usePageTitle } from '@/hooks/use-page-title'
import { useSemantierAuthStatus } from '@/lib/semantier-auth'

const API = '/api/semantier-proxy/api/plugins/vc-github-opportunity-radar/v1'
type Candidate = Record<string, any>

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new Error(
      payload.detail || payload.error || `HTTP ${response.status}`,
    )
  return payload
}

export function GithubRadarScreen() {
  usePageTitle('GitHub Opportunity Radar')
  const auth = useSemantierAuthStatus()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [repository, setRepository] = useState('fixture/emerging-project')
  const [topic, setTopic] = useState('agentic-ai')
  const [language, setLanguage] = useState('Python')
  const [universeName, setUniverseName] = useState('')
  const [status, setStatus] = useState('Ready')
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [target, setTarget] = useState<Candidate | null>(null)

  const organization =
    auth.data?.organization_name || auth.data?.organization_id || 'Unavailable'
  const workspace = auth.data?.workspace_slug || 'Unavailable'
  const unavailable = auth.isError || auth.data?.authenticated === false

  async function refreshCandidates() {
    try {
      const payload = await request('/candidates')
      setCandidates(payload.candidates || [])
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Candidate list unavailable',
      )
    }
  }
  useEffect(() => {
    void refreshCandidates()
  }, [])

  async function runScan() {
    setStatus('Scanning')
    try {
      const payload = await request('/scan', {
        method: 'POST',
        body: JSON.stringify({
          repositories: repository ? [repository] : [],
          topic,
          language,
          max_targets: 10,
        }),
      })
      setTarget(
        payload.observations?.[0]?.observation ||
          payload.observations?.[0] ||
          null,
      )
      setStatus(payload.scan?.status || 'Completed')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Scan failed')
    }
  }
  async function createUniverse() {
    setStatus('Submitting universe candidate')
    try {
      await request('/universes', {
        method: 'POST',
        body: JSON.stringify({
          name: universeName || 'GitHub Radar',
          scope: 'team',
          source_filters: {
            topics: topic ? [topic] : [],
            languages: language ? [language] : [],
          },
          operational_limits: { max_targets_per_run: 25 },
          intended_use: { advisory_only: true },
        }),
      })
      setStatus('PENDING')
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Universe submission failed',
      )
    }
  }
  async function submitCandidate() {
    if (!target) {
      setStatus('Inspect a target before submitting')
      return
    }
    setStatus('Submitting candidate')
    try {
      const payload = await request('/candidates', {
        method: 'POST',
        body: JSON.stringify({
          candidate_type: 'emerging_project',
          target: {
            github_repository_refs: [target.github_observation?.source_ref],
          },
          detected_at: target.github_observation?.observed_at,
          observation_refs: [target.github_observation?.source_ref],
          scorecard_ref: 'fixture-scorecard',
          signal_claims: [
            {
              claim_type: 'repository_momentum',
              statement: 'Public repository activity was observed.',
              status: 'observed',
              support_refs: [
                target.github_observation?.provenance?.selected_field_hash,
              ],
            },
          ],
          missing_evidence: ['company_identity'],
          proposed_next_actions: ['request founder or company enrichment'],
          justification: {
            observation_refs: [target.github_observation?.source_ref],
            observation_hashes: [
              target.github_observation?.provenance?.selected_field_hash ||
                target.github_observation?.provenance?.response_hash,
            ],
            feature_spec_version: 'vc_github_features_v1',
            scoring_profile_version: 'vc_github_profile_v1',
          },
        }),
      })
      setSelected(payload.candidate)
      setStatus(
        payload.candidate?.candidate?.fact_maturity_stage || 'C1_VALIDATED',
      )
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Candidate submission failed',
      )
    }
  }
  async function reviewCandidate(action_scope: string) {
    const candidateId =
      selected?.candidate_id || selected?.candidate?.candidate_id
    if (!candidateId) {
      setStatus('Submit a candidate first')
      return
    }
    try {
      const payload = await request(`/candidates/${candidateId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action_scope,
          reason: 'Operator review from radar',
        }),
      })
      setSelected(payload.outcome)
      setStatus(
        payload.outcome?.candidate?.fact_maturity_stage || 'C2_APPROVED',
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Review failed')
    }
  }

  const currentState = useMemo(
    () =>
      selected?.candidate?.fact_maturity_stage ||
      selected?.governance_state ||
      'DETECTED',
    [selected],
  )
  return (
    <main
      className="min-h-full bg-primary-50 px-6 py-8 text-primary-950 dark:bg-primary-950 dark:text-primary-50"
      data-testid="vc-radar-page"
    >
      {unavailable ? (
        <div
          data-testid="vc-radar-plugin-unavailable"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900"
        >
          The opportunity radar is unavailable for this session.
        </div>
      ) : null}
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-primary-600">
            <Radar className="size-4" /> Investment intelligence
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            GitHub Opportunity Radar
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-600">
            Public ecosystem signals, transparent scorecards, and governed
            research proposals.
          </p>
        </div>
        <Button onClick={() => void runScan()} data-testid="vc-radar-run-scan">
          <Play className="size-4" /> Run scan
        </Button>
      </header>
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-primary-200 bg-white p-4 dark:border-primary-800 dark:bg-primary-900">
          <div className="text-xs uppercase text-primary-500">Organization</div>
          <div className="mt-2 font-medium" data-testid="vc-radar-organization">
            {organization}
          </div>
        </div>
        <div className="rounded-lg border border-primary-200 bg-white p-4 dark:border-primary-800 dark:bg-primary-900">
          <div className="text-xs uppercase text-primary-500">Workspace</div>
          <div className="mt-2 font-medium" data-testid="vc-radar-workspace">
            {workspace}
          </div>
        </div>
        <div className="rounded-lg border border-primary-200 bg-white p-4 dark:border-primary-800 dark:bg-primary-900">
          <div className="text-xs uppercase text-primary-500">Scan status</div>
          <div className="mt-2 font-medium" data-testid="vc-radar-scan-status">
            {status}
          </div>
        </div>
      </section>
      <section className="mb-6 grid gap-6 lg:grid-cols-[1fr_1.35fr]">
        <div
          className="rounded-lg border border-primary-200 bg-white p-5 dark:border-primary-800 dark:bg-primary-900"
          data-testid="vc-radar-universe-form"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Radar universe</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void createUniverse()}
              data-testid="vc-radar-create-universe"
            >
              <Plus className="size-4" /> Create
            </Button>
          </div>
          <label className="mb-3 block text-sm">
            Active universe
            <DropdownSelect
              className="mt-1 w-full"
              data-testid="vc-radar-universe-selector"
            >
              <option>One-time exploratory scan</option>
            </DropdownSelect>
          </label>
          <label className="mb-3 block text-sm">
            Scope
            <DropdownSelect
              className="mt-1 w-full"
              data-testid="vc-radar-universe-scope"
            >
              <option>team</option>
              <option>user</option>
              <option>organization</option>
            </DropdownSelect>
          </label>
          <label className="mb-3 block text-sm">
            Universe name
            <Input
              value={universeName}
              onChange={(event) => setUniverseName(event.target.value)}
              className="mt-1 w-full rounded-md border border-primary-300 bg-transparent p-2"
              data-testid="vc-radar-universe-name"
            />
          </label>
          <label className="mb-3 block text-sm">
            Topics
            <Input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              className="mt-1 w-full rounded-md border border-primary-300 bg-transparent p-2"
              data-testid="vc-radar-universe-topics"
            />
          </label>
          <label className="mb-3 block text-sm">
            Languages
            <Input
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="mt-1 w-full rounded-md border border-primary-300 bg-transparent p-2"
              data-testid="vc-radar-universe-languages"
            />
          </label>
          <label className="mb-3 block text-sm">
            Max targets
            <Input
              type="number"
              defaultValue={25}
              className="mt-1 w-full rounded-md border border-primary-300 bg-transparent p-2"
              data-testid="vc-radar-universe-max-targets"
            />
          </label>
          <label className="mb-3 block text-sm">
            Repository
            <Input
              value={repository}
              onChange={(event) => setRepository(event.target.value)}
              placeholder="owner/name"
              className="mt-1 w-full rounded-md border border-primary-300 bg-transparent p-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              defaultChecked
              data-testid="vc-radar-universe-advisory-only"
            />{' '}
            Advisory only
          </label>
          <div className="mt-4 flex items-center justify-between text-xs text-primary-500">
            <span data-testid="vc-radar-universe-state">
              {status === 'PENDING' ? 'PENDING' : 'Exploratory'}
            </span>
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                data-testid="vc-radar-universe-request-review"
              >
                Review
              </Button>
              <Button
                size="sm"
                variant="ghost"
                data-testid="vc-radar-universe-activate"
              >
                Activate
              </Button>
              <Button
                size="sm"
                onClick={() => void createUniverse()}
                data-testid="vc-radar-universe-submit"
              >
                Submit candidate
              </Button>
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-primary-200 bg-white p-5 dark:border-primary-800 dark:bg-primary-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Candidates</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void refreshCandidates()}
            >
              <Search className="size-4" /> Refresh
            </Button>
          </div>
          <div className="mb-4 space-y-2" data-testid="vc-radar-target-list">
            <div className="text-xs uppercase text-primary-500">
              Scan targets
            </div>
            {target || repository ? (
              <div
                className="flex items-center justify-between rounded-md border border-primary-200 p-3"
                data-testid="vc-radar-target-row"
                data-target-ref={
                  target?.github_observation?.source_ref || repository
                }
              >
                <span>{repository}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid="vc-radar-target-inspect"
                  onClick={() => {
                    if (target) setSelected(target)
                    else void runScan()
                  }}
                >
                  <Search className="size-4" /> Inspect
                </Button>
              </div>
            ) : (
              <div className="text-sm text-primary-500">
                Enter a repository or run a bounded topic scan.
              </div>
            )}
          </div>
          <div className="space-y-2" data-testid="vc-radar-candidate-row">
            {candidates.length ? (
              candidates.map((candidate, index) => (
                <Button
                  className="flex w-full items-center justify-between rounded-md border border-primary-200 p-3 text-left hover:bg-primary-50 dark:border-primary-800 dark:hover:bg-primary-800"
                  key={candidate.candidate_id || index}
                  onClick={() => setSelected(candidate)}
                >
                  <span>
                    {candidate.candidate_id ||
                      candidate.candidate?.candidate_id ||
                      `Candidate ${index + 1}`}
                  </span>
                  <span
                    className="text-xs text-primary-500"
                    data-testid="vc-radar-candidate-workflow-label"
                  >
                    {candidate.fact_maturity_stage ||
                      candidate.governance_state ||
                      'T6'}
                  </span>
                </Button>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-primary-300 p-6 text-center text-sm text-primary-500">
                No candidates admitted for review.
              </div>
            )}
          </div>
        </div>
      </section>
      <section
        className="rounded-lg border border-primary-200 bg-white p-5 dark:border-primary-800 dark:bg-primary-900"
        data-testid="vc-radar-candidate-inspector"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Candidate inspector</h2>
          {selected ? (
            <span
              className="text-xs text-primary-500"
              data-testid="vc-radar-candidate-state"
            >
              {selected.candidate_id || selected.candidate?.candidate_id
                ? currentState
                : 'DETECTED'}
            </span>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div data-testid="vc-radar-observed-facts">
            <h3 className="text-xs font-semibold uppercase text-primary-500">
              Observed facts
            </h3>
            <pre className="mt-2 max-h-48 overflow-auto text-xs">
              {JSON.stringify(selected?.candidate || selected || {}, null, 2)}
            </pre>
          </div>
          <div data-testid="vc-radar-derived-metrics">
            <h3 className="text-xs font-semibold uppercase text-primary-500">
              Derived metrics
            </h3>
            <p className="mt-2 text-sm text-primary-600">
              Score components and missing evidence remain pinned to the
              observation snapshot.
            </p>
            <div
              data-testid="vc-radar-missing-evidence"
              className="mt-3 text-xs text-primary-500"
            >
              Missing evidence is reported explicitly.
            </div>
          </div>
        </div>
        <div
          data-testid="vc-radar-inferences"
          className="mt-4 text-xs text-primary-500"
        >
          Entity links are hypotheses until governed review.
        </div>
        <div
          data-testid="vc-radar-governance"
          className="mt-2 text-xs text-primary-500"
        >
          Governance state: {currentState}
        </div>
        <div
          data-testid="vc-radar-replay"
          className="mt-2 text-xs text-primary-500"
        >
          Replay references are available from the core service.
        </div>
        <div className="mt-5 grid gap-2 md:grid-cols-2">
          <label className="text-xs text-primary-500">
            Defer reason
            <Input
              className="mt-1 w-full rounded-md border border-primary-300 bg-transparent p-2"
              data-testid="vc-radar-defer-reason"
            />
          </label>
          <label className="text-xs text-primary-500">
            Defer trigger
            <Input
              className="mt-1 w-full rounded-md border border-primary-300 bg-transparent p-2"
              data-testid="vc-radar-defer-trigger"
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void submitCandidate()}
            data-testid="vc-radar-submit-candidate"
          >
            Submit candidate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void reviewCandidate('OPPORTUNITY_QUALIFICATION')}
            data-testid="vc-radar-action-qualify"
          >
            Qualify
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void reviewCandidate('OPPORTUNITY_REJECTION')}
            data-testid="vc-radar-action-reject"
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void reviewCandidate('OPPORTUNITY_DEFERRAL')}
            data-testid="vc-radar-action-defer"
          >
            Defer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="vc-radar-action-assign-owner"
          >
            Assign owner
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="vc-radar-action-enrichment"
          >
            Enrich
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="vc-radar-action-diligence"
          >
            Diligence
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="vc-radar-action-monitor"
          >
            Monitor
          </Button>
          <span
            className="text-xs text-primary-500"
            data-testid="vc-radar-action-authorization-status"
          >
            Authorization is checked by core.
          </span>
          <Button
            size="sm"
            variant="ghost"
            data-testid="vc-radar-export-replay"
          >
            <ExternalLink className="size-4" /> Replay
          </Button>
        </div>
      </section>
      <div className="sr-only" data-testid="vc-radar-status-message">
        {status}
      </div>
    </main>
  )
}
