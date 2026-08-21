/**
 * Negative regression fixture for the showcase import boundary.
 *
 * This file intentionally imports a forbidden live-runtime module and is
 * excluded from the showcase tree only by the explicit allow-list in the
 * boundary guard test. If the negative test is moved into the showcase
 * subtree, `semantica-showcase-boundary.test.ts` must fail. This guards
 * against accidental re-introduction of live runtime coupling.
 */
import { fixtureGovernedGraphProjection } from '../../graph-api-client'

export function __negativeRegressionProbe() {
  return fixtureGovernedGraphProjection()
}
