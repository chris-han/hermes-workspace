# Semantier Landing Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `v0-semantier` into a white-paper-driven marketing site whose information architecture explains Semantier as organizational-order governance infrastructure, expressed in business terms as a Finance-led Business Operating System, and add a pricing page aligned with the Semantier pricing strategy.

**Architecture:** Replace the current monolithic, translation-string-driven landing page with a narrative architecture grounded in the updated Vol.1 thesis: `Information -> Governable Consensus -> Organizational Order -> Coordinated Execution -> Trust -> Profitability -> Organizational Survival`. Keep the page mostly server-rendered, move narrative content into typed data modules, and isolate client behavior to language/theme toggles, motion, and signup interactions.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Framer Motion, existing Radix/shadcn UI primitives, Zod for content-schema validation if needed.

---

## Scope

This plan is for the landing page / marketing site in [`v0-semantier`](/home/chris/repo/semantier-runtime/v0-semantier), using the updated [`white-paper/vol1-business-os`](/home/chris/repo/semantier-runtime/white-paper/vol1-business-os) as the content source for information architecture and messaging hierarchy.

Pricing-page strategy should be derived from [`docs/semantier-pricing-strategy.md`](/home/chris/repo/semantier-runtime/docs/semantier-pricing-strategy.md).

This plan does not cover:

- Runtime product changes outside the marketing app
- New backend lead-routing beyond the existing signup endpoint
- Full CMS integration
- Full white-paper publication inside the marketing site
- Detailed billing-system implementation beyond the marketing presentation of pricing

## Current-State Assessment

The current site in [`v0-semantier/app/page.tsx`](/home/chris/repo/semantier-runtime/v0-semantier/app/page.tsx) is still a valid waitlist page, but it is now materially behind the white paper.

Problems to fix:

- The site is still framed around `enterprise consensus infrastructure`, while the updated white paper now centers Semantier on `organizational order`, `governable consensus`, and `organizational survival`.
- The current IA is feature-led and flat. It does not establish the new thesis that organizations die from consensus collapse before it tries to explain the product.
- The older plan over-weighted `Category Scale Economy` as the front door. In v4.0, `Finance-led Business` is explicitly repositioned as the business-layer manifestation of a broader organizational-order thesis.
- Content is trapped in a flat translation dictionary inside [`components/language-provider.tsx`](/home/chris/repo/semantier-runtime/v0-semantier/components/language-provider.tsx), which is unsuitable for the new three-layer narrative.
- Metadata in [`app/layout.tsx`](/home/chris/repo/semantier-runtime/v0-semantier/app/layout.tsx) still reflects the old category claim and needs to be updated to the new positioning.

## Updated Source Thesis to Preserve

The landing-page IA should now preserve the updated structure in:

- [`white-paper/vol1-business-os/README.md`](/home/chris/repo/semantier-runtime/white-paper/vol1-business-os/README.md)
- [`white-paper/vol1-business-os/00-preface.md`](/home/chris/repo/semantier-runtime/white-paper/vol1-business-os/00-preface.md)
- [`white-paper/vol1-business-os/16-organizational-order.md`](/home/chris/repo/semantier-runtime/white-paper/vol1-business-os/16-organizational-order.md)
- [`white-paper/vol1-business-os/afterword.md`](/home/chris/repo/semantier-runtime/white-paper/vol1-business-os/afterword.md)
- [`white-paper/vol1-business-os/11-business-operating-system.md`](/home/chris/repo/semantier-runtime/white-paper/vol1-business-os/11-business-operating-system.md)
- [`white-paper/vol1-business-os/12-category-scale-economy.md`](/home/chris/repo/semantier-runtime/white-paper/vol1-business-os/12-category-scale-economy.md)
- [`white-paper/vol1-business-os/13-why-now.md`](/home/chris/repo/semantier-runtime/white-paper/vol1-business-os/13-why-now.md)
- [`white-paper/vol1-business-os/core-definitions.md`](/home/chris/repo/semantier-runtime/white-paper/vol1-business-os/core-definitions.md)

Supporting mechanism chapters remain important:

- `06-semantic-governance.md`
- `07-justification.md`
- `08-contract-validation.md`
- `09-governance-loop.md`
- `10-trust-production.md`
- `15-organizational-learning.md`

The message hierarchy should preserve these claims:

- Semantier is governance infrastructure for `Organizational Order`
- `Governable Consensus` is the scarce capability, not raw information handling
- Organizations fail through `Consensus Collapse`
- `Management Consensus Cost` is the business-visible price of disorder
- `Finance-led Business` is the business-layer implementation, not the whole theory
- `Generate != Govern`; AI accelerates action but does not create legitimacy
- Semantier governs `meaning`, `validation`, `exceptions`, and `trusted execution`
- The payoff chain is `Order -> Coordinated Execution -> Trust -> Profitability`

## Revised Information Architecture

Recommended top-level homepage narrative:

1. **Hero: The new category**
   - Semantier is governance infrastructure for organizational order
   - Business expression: Finance-led Business Operating System
   - Primary CTA: request demo / talk to us
   - Secondary CTA: read the thesis

2. **The core thesis**
   - `Information != Consensus`
   - Organizations do not survive by processing more information
   - Organizations survive by turning reality into governable consensus

3. **The existential problem**
   - `Every organization dies from consensus collapse`
   - Show how interpretation conflict becomes action conflict, then disorder

4. **The business symptom**
   - Introduce `Management Consensus Cost`
   - Connect disorder to margin erosion, slow decisions, bad resource allocation, and exception overload

5. **Why the old stack fails**
   - ERP governs records
   - Workflow governs process
   - AI governs knowledge assistance
   - None governs consensus order

6. **Semantier’s three-layer position**
   - Theory layer: Organizational Order
   - Governance layer: Governable Consensus / Management Consensus Cost / Semantic Governance
   - Business layer: Finance-led Business / Category Scale Economy

7. **How Semantier works**
   - Economic facts
   - Justification
   - Contract Validation
   - Governance Loop
   - Trust Production

8. **Business realization**
   - Explain Finance-led Business as the concrete operating model
   - Then show the shift from volume growth to profitability and category quality

9. **Proof through cases**
   - Project business
   - Cross-border ecommerce
   - AI-native business

10. **Why now**
   - Factual transparency pressure
   - AI speed pressure
   - Stronger need for trusted automation and order preservation

11. **Final CTA**
   - Protect order
   - Reduce consensus cost
   - Make truth operational

Recommended top-level pricing-page narrative:

1. **Pricing hero**
   - Finance-led platform pricing
   - Designed around process efficiency plus business outcomes

2. **Why pricing is hybrid**
   - Process work is measurable and usage-driven
   - Decision guidance creates value through operating outcomes

3. **Two-part model**
   - Base platform fee
   - Usage-based metering
   - Optional outcome-based or milestone-based value fee

4. **Packaging**
   - Foundation
   - Growth
   - Enterprise / Strategic

5. **Outcome modules**
   - Margin governance
   - Cash-flow / risk governance
   - Tax / compliance governance
   - AI-native unit-economics governance

6. **Attribution and baseline rules**
   - Historical baseline
   - Tagged intervention paths
   - Milestone settlement for longer cycles

7. **FAQ / buying confidence**
   - How ROI is measured
   - What counts as usage
   - When outcome fees apply
   - Who the product is for

8. **CTA**
   - Talk to us
   - Get a pricing walkthrough

## IA Direction Rules

Use these rules during design review:

- Do not open with feature cards.
- Do not open with `Category Scale Economy` alone; it is now too low in the hierarchy.
- Do not position Semantier first as an ERP replacement or blockchain alternative.
- Do not explain mechanism before establishing the disorder problem.
- Do not let the homepage collapse into “AI + compliance + finance” messaging soup.
- Keep one dominant question per section.

## Recommended Section Stack

This is the tighter IA stack I recommend for the homepage:

1. `Hero`
   - Headline: organizational-order claim
   - Subhead: business-layer interpretation
   - CTA pair

2. `Order Chain`
   - A single diagram or editorial block:
   - `Information -> Governable Consensus -> Organizational Order -> Coordinated Execution -> Trust -> Profitability -> Survival`

3. `Consensus Collapse`
   - The central problem section
   - This should likely replace the generic current “Why It Matters” section entirely

4. `Management Consensus Cost`
   - Business cost framing
   - This is the bridge from theory to operator pain

5. `Why Existing Systems Stop Short`
   - ERP / Workflow / AI comparison
   - Position Semantier as the missing governance layer

6. `Three-Layer Positioning`
   - Theory / Governance / Business
   - This is the clearest way to compress the updated README into homepage IA

7. `Operating Model`
   - Facts
   - Meaning
   - Validation
   - Exception governance
   - Trusted execution

8. `Finance-led Business in Practice`
   - Show how the governance thesis manifests in pricing, SKU, channel, and AI-unit-economics decisions

9. `Case Proofs`
   - Three short evidence blocks

10. `Why Now`
   - Compliance and AI pressures

11. `CTA`
   - Category summary + action

This is the recommended IA stack for the pricing page:

1. `Pricing Hero`
   - Headline: pricing for a Finance-led platform
   - Supporting line: hybrid model aligned with workflow consumption and business value
   - CTA: request pricing walkthrough

2. `Why Hybrid Pricing`
   - Explain why Semantier cannot be honestly priced as seats-only or seats-plus-features
   - Tie directly to process value plus outcome value

3. `Two-Part Pricing Model`
   - Base subscription / platform access
   - Usage-based metering for transactions, documents, or token-intensive processing
   - Optional value-based fee for measurable outcome modules

4. `Package Comparison`
   - Foundation
   - Growth
   - Enterprise
   - Focus on qualification, not commodity checkout

5. `Outcome-Based Add-Ons`
   - Cost reduction
   - Margin uplift
   - Working-capital / bad-debt improvement
   - Compliance-risk reduction

6. `How Measurement Works`
   - Baseline period
   - Intervention tagging
   - Milestone settlement when attribution is hard

7. `Pricing FAQ`
   - What is included
   - How usage is counted
   - How value share is triggered
   - When refunds / guarantees apply, if offered

8. `Bottom CTA`
   - Talk to sales / book pricing review

## Content Model Recommendation

Replace the current flat translation dictionary with structured section data.

Recommended content shape:

- `site metadata`
- `navigation labels`
- `hero`
- `order chain`
- `problem sections`
- `positioning framework`
- `operating model`
- `business realization`
- `use-case proofs`
- `timing section`
- `CTA`
- `pricing hero`
- `pricing framework`
- `package comparison`
- `outcome modules`
- `pricing FAQ`

Recommended language approach:

- Keep `zh` as the source narrative because the white paper is Chinese-first and conceptually denser there.
- Keep `en` as a curated marketing adaptation, not a chapter translation.
- Reserve `LanguageProvider` for language state and short chrome labels only.

## Visual / UX Direction

The homepage should become more editorial and more thesis-led.

Recommended direction:

- Hero feels like a manifesto, not a startup pitch
- One clean systems diagram early
- Fewer cards, more structured arguments
- Strong contrast between theory sections and business-proof sections
- Case studies presented as evidence
- Use typography and spacing to make the argument feel staged and inevitable

Preserve:

- Existing warm off-white / acid green palette in [`app/globals.css`](/home/chris/repo/semantier-runtime/v0-semantier/app/globals.css), refined rather than replaced
- Dark mode support if cheap to maintain

## Proposed File Structure

Likely file changes for the refactor:

- Modify: [`v0-semantier/app/page.tsx`](/home/chris/repo/semantier-runtime/v0-semantier/app/page.tsx)
- Modify: [`v0-semantier/app/layout.tsx`](/home/chris/repo/semantier-runtime/v0-semantier/app/layout.tsx)
- Modify: [`v0-semantier/app/globals.css`](/home/chris/repo/semantier-runtime/v0-semantier/app/globals.css)
- Modify: [`v0-semantier/components/header.tsx`](/home/chris/repo/semantier-runtime/v0-semantier/components/header.tsx)
- Modify: [`v0-semantier/components/language-provider.tsx`](/home/chris/repo/semantier-runtime/v0-semantier/components/language-provider.tsx)
- Modify: [`v0-semantier/components/email-signup.tsx`](/home/chris/repo/semantier-runtime/v0-semantier/components/email-signup.tsx)
- Create: `v0-semantier/app/pricing/page.tsx`

Recommended new files:

- Create: `v0-semantier/content/landing/home.ts`
- Create: `v0-semantier/content/landing/pricing.ts`
- Create: `v0-semantier/content/landing/types.ts`
- Create: `v0-semantier/lib/landing-content.ts`
- Create: `v0-semantier/components/landing/hero.tsx`
- Create: `v0-semantier/components/landing/order-chain.tsx`
- Create: `v0-semantier/components/landing/consensus-collapse.tsx`
- Create: `v0-semantier/components/landing/consensus-cost.tsx`
- Create: `v0-semantier/components/landing/system-boundaries.tsx`
- Create: `v0-semantier/components/landing/three-layer-positioning.tsx`
- Create: `v0-semantier/components/landing/operating-model.tsx`
- Create: `v0-semantier/components/landing/finance-led-business.tsx`
- Create: `v0-semantier/components/landing/use-case-proofs.tsx`
- Create: `v0-semantier/components/landing/why-now.tsx`
- Create: `v0-semantier/components/landing/final-cta.tsx`
- Create: `v0-semantier/components/landing/section-heading.tsx`
- Create: `v0-semantier/components/landing/site-footer.tsx`
- Create: `v0-semantier/components/pricing/pricing-hero.tsx`
- Create: `v0-semantier/components/pricing/pricing-model.tsx`
- Create: `v0-semantier/components/pricing/package-comparison.tsx`
- Create: `v0-semantier/components/pricing/outcome-modules.tsx`
- Create: `v0-semantier/components/pricing/measurement-rules.tsx`
- Create: `v0-semantier/components/pricing/pricing-faq.tsx`
- Create: `v0-semantier/components/pricing/pricing-cta.tsx`

Potential deletions or deprecations after migration:

- `v0-semantier/components/features-grid.tsx`
- `v0-semantier/components/consensus-comparison.tsx`
- `v0-semantier/components/animated-grid.tsx`

## Rollout Plan

### Task 1: Rebuild the content architecture around organizational order

**Files:**
- Create: `v0-semantier/content/landing/types.ts`
- Create: `v0-semantier/content/landing/home.ts`
- Create: `v0-semantier/content/landing/pricing.ts`
- Create: `v0-semantier/lib/landing-content.ts`
- Modify: `v0-semantier/components/language-provider.tsx`

- [ ] Map the updated white-paper hierarchy into homepage sections.
- [ ] Map `docs/semantier-pricing-strategy.md` into a pricing-page content model that explains hybrid pricing clearly without promising unsupported guarantees.
- [ ] Encode the new three-layer positioning and order chain in typed content structures.
- [ ] Keep short UI labels in `LanguageProvider`, but remove long-form narrative copy from it.
- [ ] Add a small content accessor in `lib/landing-content.ts` so section components read structured content instead of translation keys.
- [ ] Verify the content model supports section-level bilingual content and future expansion into multi-page thought leadership.

**Acceptance criteria:**

- Homepage content exists as structured data, not a large flat dictionary.
- Chinese content aligns with v4.0’s organizational-order framing.
- English content is positioned as a deliberate marketing adaptation.

### Task 2: Refactor the homepage into thesis-led sections

**Files:**
- Modify: `v0-semantier/app/page.tsx`
- Create: `v0-semantier/components/landing/hero.tsx`
- Create: `v0-semantier/components/landing/order-chain.tsx`
- Create: `v0-semantier/components/landing/consensus-collapse.tsx`
- Create: `v0-semantier/components/landing/consensus-cost.tsx`
- Create: `v0-semantier/components/landing/system-boundaries.tsx`
- Create: `v0-semantier/components/landing/three-layer-positioning.tsx`
- Create: `v0-semantier/components/landing/operating-model.tsx`
- Create: `v0-semantier/components/landing/finance-led-business.tsx`
- Create: `v0-semantier/components/landing/use-case-proofs.tsx`
- Create: `v0-semantier/components/landing/why-now.tsx`
- Create: `v0-semantier/components/landing/final-cta.tsx`
- Create: `v0-semantier/components/landing/section-heading.tsx`
- Create: `v0-semantier/components/landing/site-footer.tsx`

- [ ] Replace the monolithic homepage with section components matching the revised IA.
- [ ] Keep `app/page.tsx` responsible only for content loading and section assembly.
- [ ] Make non-interactive sections server components by default.
- [ ] Remove generic sections that survived only from the old waitlist design.
- [ ] Preserve anchor-based navigation only for sections that truly matter in the new reading path.

**Acceptance criteria:**

- The page reads like an argument, not a feature inventory.
- Each narrative block has a clear single job.
- The section order mirrors the approved IA.

### Task 3: Add a pricing page aligned with the hybrid pricing strategy

**Files:**
- Create: `v0-semantier/app/pricing/page.tsx`
- Create: `v0-semantier/components/pricing/pricing-hero.tsx`
- Create: `v0-semantier/components/pricing/pricing-model.tsx`
- Create: `v0-semantier/components/pricing/package-comparison.tsx`
- Create: `v0-semantier/components/pricing/outcome-modules.tsx`
- Create: `v0-semantier/components/pricing/measurement-rules.tsx`
- Create: `v0-semantier/components/pricing/pricing-faq.tsx`
- Create: `v0-semantier/components/pricing/pricing-cta.tsx`
- Modify: `v0-semantier/components/header.tsx`
- Modify: `v0-semantier/components/landing/site-footer.tsx`

- [ ] Create a dedicated pricing page linked from global navigation and homepage CTAs.
- [ ] Present Semantier pricing as a hybrid of platform fee, usage fee, and optional value-based modules.
- [ ] Make the page qualify buyers toward a conversation rather than pretend the product is a self-serve commodity.
- [ ] Explain baseline, attribution, and milestone logic clearly to reduce buyer confusion.

**Acceptance criteria:**

- The pricing page is coherent with the homepage thesis.
- Pricing is understandable without flattening the model into a fake simple seat table.
- Every pricing CTA leads toward contact, walkthrough, or qualification.

### Task 4: Reframe category claim, navigation, metadata, and CTA system

**Files:**
- Modify: `v0-semantier/components/header.tsx`
- Modify: `v0-semantier/app/layout.tsx`
- Modify: `v0-semantier/components/email-signup.tsx`
- Create: `v0-semantier/components/landing/site-footer.tsx`

- [ ] Update navigation labels to match the new reading path, for example `Thesis`, `Cost`, `Model`, `Cases`, `Why Now`, `Talk to Us`.
- [ ] Add `Pricing` to global navigation and route CTAs between homepage and pricing page intentionally.
- [ ] Rewrite page metadata around organizational order and Finance-led Business.
- [ ] Make the primary CTA less like a generic waitlist and more like a serious operator-facing conversation.
- [ ] Add a secondary “read the thesis” path only if it reinforces the primary CTA rather than distracting from it.

**Acceptance criteria:**

- Metadata and nav express the new category cleanly.
- CTA language fits the new level of strategic positioning.

### Task 5: Redesign the visual system around argument hierarchy

**Files:**
- Modify: `v0-semantier/app/globals.css`
- Modify: landing section components created in Task 2
- Modify: pricing section components created in Task 3

- [ ] Introduce typography, spacing, and layout tokens that support manifesto-like reading flow.
- [ ] Give the `Order Chain` and `Three-Layer Positioning` sections distinctive presentation so they become memory anchors.
- [ ] Reduce decorative repetition and generic icon-card treatments.
- [ ] Preserve accessible contrast and mobile readability.

**Acceptance criteria:**

- The page feels category-defining rather than template-derived.
- The core claim is legible within the first two scrolls.

### Task 6: Turn the appendices into proof-oriented homepage evidence

**Files:**
- Modify: `v0-semantier/content/landing/home.ts`
- Modify: `v0-semantier/components/landing/use-case-proofs.tsx`

- [ ] Distill appendix A into a project-profitability governance proof.
- [ ] Distill appendix B into a contribution-margin governance proof.
- [ ] Distill appendix C into an AI-native unit-economics governance proof.
- [ ] Structure each case as `disorder pattern -> blind spot -> Semantier intervention -> better decision`.

**Acceptance criteria:**

- Cases prove the thesis rather than repeating product claims.
- Each case demonstrates a different kind of consensus-governance problem.

### Task 7: Verify build and reading flow

**Files:**
- Modify as needed across `v0-semantier/`

- [ ] Run `pnpm lint` in `v0-semantier`.
- [ ] Run `pnpm build` in `v0-semantier`.
- [ ] Verify mobile and desktop reading flow manually.
- [ ] Verify language toggle behavior after the content-model refactor.
- [ ] Verify anchor navigation and signup interactions still work.
- [ ] Verify homepage-to-pricing and pricing-to-contact CTA paths.

**Acceptance criteria:**

- The app builds cleanly.
- Core interactions remain functional.
- The IA survives responsive layouts without collapsing into generic stacked cards.

## Copy Strategy Notes

Approved high-level direction:

- Primary claim: `Semantier governs organizational order`
- Business-layer claim: `Semantier is a Finance-led Business Operating System`
- Problem framing: `Organizations die from consensus collapse`
- Operator pain: `Management Consensus Cost`
- Mechanism distinction: `Generate != Govern`
- Outcome chain: `Order -> Trust -> Profitability`
- Slogan to preserve: `Semantier Makes Truth Operational`
- Pricing direction: `hybrid platform fee + usage fee + optional measurable outcome fee`

Avoid these weaker framings:

- Opening with “blockchain alternative”
- Opening with “single source of truth” without the order thesis
- Reducing Semantier to compliance software
- Reducing Semantier to finance tooling
- Treating `Category Scale Economy` as the top-level product category
- Pretending pricing is simple self-serve SaaS if the sales model is consultative

## Review Questions

- Should the homepage lead with the stronger Chinese thesis even if the English rendering becomes more adaptive?
- Is the immediate CTA `Talk to us`, `Request demo`, or `Get early access`?
- Should the site remain single-page for now, with “Read the thesis” pointing externally or into a future `/thesis` page?
- Should pricing show example numbers/ranges now, or explain structure only until packaging is finalized?

## Verification Commands

Run from [`v0-semantier`](/home/chris/repo/semantier-runtime/v0-semantier):

```bash
pnpm lint
pnpm build
```

## Suggested Execution Order

1. Approve the revised IA and category hierarchy.
2. Approve the structured content-model approach.
3. Implement the section stack and metadata changes.
4. Tighten the visual system after the argument structure is stable.

Plan complete and saved to `docs/superpowers/plans/2026-06-07-semantier-landing-refactor.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
