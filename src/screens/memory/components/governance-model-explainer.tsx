import { BookOpen01Icon, ShieldKeyIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export const GOVERNANCE_EXPLAINER_TITLE = 'Governance Model'
export const GOVERNANCE_EXPLAINER_POINTS = [
  'T6 suggestions are conversational and non-authoritative until they are materialized into governed artifacts.',
  'T5 scoped preferences may optimize local behavior but cannot weaken T4, T3, or T2 obligations.',
  'T4, T3, T2, and T1 require governed approval and activation in Semantier core.',
  'Knowledge-source connections and retrieval hints do not, by themselves, create semantic authority.',
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

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-primary-200 bg-primary-50/80 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="mb-3 flex items-center gap-2 text-primary-900 dark:text-neutral-100">
            <HugeiconsIcon icon={BookOpen01Icon} size={18} strokeWidth={1.5} />
            <h3 className="text-sm font-semibold">Tier Progression</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'T6 Suggestion',
              'T5 Scoped Preference',
              'T4 Org Policy',
              'T3 Doctrine',
              'T2 Regulation',
              'T1 Ontology',
            ].map((item) => (
              <span
                key={item}
                className="rounded-full border border-primary-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-primary-700 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-200"
              >
                {item}
              </span>
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
    </div>
  )
}
