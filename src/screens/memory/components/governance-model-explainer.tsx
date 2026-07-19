import { BookOpen01Icon, ShieldKeyIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export const GOVERNANCE_EXPLAINER_TITLE = 'Governance Model'
export const GOVERNANCE_EXPLAINER_POINTS = [
  'T6 suggestions are conversational and non-authoritative until they are materialized into governed artifacts.',
  'T5 scoped preferences may optimize local behavior but cannot weaken T4, T3, or T2 obligations.',
  'T4, T3, T2, and T1 require governed approval and activation in Semantier core.',
  'Knowledge-source connections and retrieval hints do not, by themselves, create semantic authority.',
]
export const AUTHORITY_LEVELS = [
  {
    label: 'curation_only',
    description:
      'Research or imported wiki material. It can support review, but it cannot be cited as law, policy, doctrine, or runtime authority.',
  },
  {
    label: 'T6 Suggestion',
    description:
      'Agent or conversational output. It becomes durable only after a governed artifact is created from it.',
  },
  {
    label: 'T5 Scoped Preference',
    description:
      'User or workspace preference that may shape local behavior without overriding organization policy or external obligations.',
  },
  {
    label: 'T4 Org Policy',
    description:
      'Organization-approved operating policy, control, procedure, or local interpretation.',
  },
  {
    label: 'T3 Doctrine',
    description:
      'Repo-owned Semantier doctrine or canonical implementation contract promoted through governed source registration.',
  },
  {
    label: 'T2 Regulation',
    description:
      'Official legal, regulatory, or accounting source text with verified source registration and precedence review.',
  },
  {
    label: 'T1 Ontology',
    description:
      'Core semantic vocabulary and schema authority used by Semantier runtime contracts.',
  },
]
export const GOVERNED_PROMOTION_STEPS = [
  'Register the source with URI, jurisdiction, effective dates, source version, anchors, extraction method, curator, and known ambiguities.',
  'Create a normalized artifact with extracted claims, constraints, or projection rules, and keep the source hash pinned.',
  'Run schema validation, authority-origin compatibility checks, and precedence review against higher-tier sources.',
  'Approve and activate the artifact in Semantier core so future answers can cite the active knowledge version.',
]

export function GovernanceModelExplainer() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl border border-primary-200 bg-primary-100/70 dark:border-neutral-800 dark:bg-neutral-900">
            <HugeiconsIcon icon={ShieldKeyIcon} size={20} strokeWidth={1.5} />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-primary-900 dark:text-neutral-100">
              {GOVERNANCE_EXPLAINER_TITLE}
            </h2>
            <p className="text-sm text-primary-600 dark:text-neutral-400">
              Governance activation lives in Semantier core. This workspace
              surface explains the model but does not expose approval or
              activation controls yet.
            </p>
          </div>
        </div>
      </section>

      <section id="authority-levels" className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="mb-3 flex items-center gap-2 text-primary-900 dark:text-neutral-100">
            <HugeiconsIcon icon={BookOpen01Icon} size={18} strokeWidth={1.5} />
            <h3 className="text-sm font-semibold">Authority Levels</h3>
          </div>
          <div className="space-y-2">
            {AUTHORITY_LEVELS.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-primary-200 bg-white/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/70"
              >
                <div className="text-xs font-semibold text-primary-900 dark:text-neutral-100">
                  {item.label}
                </div>
                <div className="mt-1 text-xs text-primary-600 dark:text-neutral-300">
                  {item.description}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="mb-3 text-sm font-semibold text-primary-900 dark:text-neutral-100">
            Authority Boundaries
          </div>
          <ul className="space-y-2 text-sm text-primary-700 dark:text-neutral-300">
            {GOVERNANCE_EXPLAINER_POINTS.map((point) => (
              <li
                key={point}
                className="rounded-2xl border border-primary-200 bg-white/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/70"
              >
                {point}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section
        id="promotion-path"
        className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60"
      >
        <div className="mb-3 text-sm font-semibold text-primary-900 dark:text-neutral-100">
          Governed Promotion Path
        </div>
        <ol className="space-y-2 text-sm text-primary-700 dark:text-neutral-300">
          {GOVERNED_PROMOTION_STEPS.map((step, index) => (
            <li
              key={step}
              className="flex gap-3 rounded-2xl border border-primary-200 bg-white/80 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/70"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-neutral-800 dark:text-neutral-200">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
