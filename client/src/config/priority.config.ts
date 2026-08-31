/**
 * Priority lookup table — derived from ITIL Impact × Urgency matrix.
 *
 * Impact  : '1 - High' | '2 - Medium' | '3 - Low'
 * Urgency : '1 - High' | '2 - Medium' | '3 - Low'
 *
 * Matrix:
 *             Urgency
 *             1-High     2-Medium   3-Low
 * Impact 1H : 1-Critical 2-High     3-Moderate
 * Impact 2M : 2-High     3-Moderate 4-Low
 * Impact 3L : 3-Moderate 4-Low      4-Low
 *
 * The resulting Priority string maps to the backend VALID_PRIORITIES values:
 *   1-Critical → 'URGENT'
 *   2-High     → 'HIGH'
 *   3-Moderate → 'MEDIUM'
 *   4-Low      → 'LOW'
 */

export type ImpactLevel  = '1 - High' | '2 - Medium' | '3 - Low';
export type UrgencyLevel = '1 - High' | '2 - Medium' | '3 - Low';
export type PriorityResult = '1 - Critical' | '2 - High' | '3 - Moderate' | '4 - Low';

/** Human-readable labels for Impact options (ordered 1→3). */
export const IMPACT_OPTIONS: ImpactLevel[] = ['1 - High', '2 - Medium', '3 - Low'];

/** Human-readable labels for Urgency options (ordered 1→3). */
export const URGENCY_OPTIONS: UrgencyLevel[] = ['1 - High', '2 - Medium', '3 - Low'];

/** All possible priority result values in display order. */
export const PRIORITY_RESULTS: PriorityResult[] = [
  '1 - Critical',
  '2 - High',
  '3 - Moderate',
  '4 - Low',
];

/**
 * ITIL Impact × Urgency → Priority lookup.
 * Returns the computed PriorityResult given the selected Impact and Urgency.
 */
export const PRIORITY_MATRIX: Record<ImpactLevel, Record<UrgencyLevel, PriorityResult>> = {
  '1 - High': {
    '1 - High':   '1 - Critical',
    '2 - Medium': '2 - High',
    '3 - Low':    '3 - Moderate',
  },
  '2 - Medium': {
    '1 - High':   '2 - High',
    '2 - Medium': '3 - Moderate',
    '3 - Low':    '4 - Low',
  },
  '3 - Low': {
    '1 - High':   '3 - Moderate',
    '2 - Medium': '4 - Low',
    '3 - Low':    '4 - Low',
  },
};

/**
 * Compute priority from impact + urgency.
 * Returns null when either value is not yet selected.
 */
export function computePriority(
  impact: ImpactLevel | '',
  urgency: UrgencyLevel | '',
): PriorityResult | null {
  if (!impact || !urgency) return null;
  return PRIORITY_MATRIX[impact][urgency];
}

/**
 * Map a PriorityResult to the backend priority enum value.
 *   1-Critical → 'URGENT'
 *   2-High     → 'HIGH'
 *   3-Moderate → 'MEDIUM'
 *   4-Low      → 'LOW'
 */
export function priorityResultToApiValue(result: PriorityResult): string {
  switch (result) {
    case '1 - Critical': return 'URGENT';
    case '2 - High':     return 'HIGH';
    case '3 - Moderate': return 'MEDIUM';
    case '4 - Low':      return 'LOW';
  }
}

/** Tailwind colour classes for each priority result badge. */
export const PRIORITY_BADGE_CLASS: Record<PriorityResult, string> = {
  '1 - Critical': 'bg-red-100 text-red-800 ring-red-300',
  '2 - High':     'bg-orange-100 text-orange-800 ring-orange-300',
  '3 - Moderate': 'bg-yellow-100 text-yellow-800 ring-yellow-300',
  '4 - Low':      'bg-green-100 text-green-800 ring-green-300',
};
