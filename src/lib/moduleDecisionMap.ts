/**
 * MODULE → DECISION FIELD MAPPING
 * 
 * Defines which decision fields belong to which analytics module.
 * Any field NOT listed here is "always available" (e.g., productionP1, shifts,
 * priceP1 — these are baseline decisions every quarter, not gated by modules).
 * 
 * Used by:
 * - decision.service.ts submit() to sanitize locked-module fields
 * - Workbench for decision attribution post-game
 */

export const MODULE_DECISION_FIELDS: Record<string, string[]> = {
  // Module 1 — Demand Science
  ds: ['forecastR1', 'forecastR2', 'forecastR3', 'forecastMethod'],

  // Module 2 — Supplier Analytics
  sa: ['primarySupplier', 'secondarySupplier', 'primaryAllocation', 'emergencyRegionalOrder', 'orderGlobal'],

  // Module 3 — Customer Intelligence
  ci: ['segmentChampions', 'segmentGrowth', 'segmentAtRisk', 'segmentOther'],

  // Module 4 — Network Design
  nd: ['dcCentralStatus', 'dcWestStatus', 'allocateCentral', 'allocateWest'],

  // Module 5 — Product Innovation
  pi: ['launchP3', 'p3Config', 'p3Price', 'productionP3'],

  // Module 6 — Market Expansion
  me: ['enterR4', 'forecastR4', 'enterR5', 'forecastR5', 'enterR6', 'forecastR6'],
};

/**
 * Reverse lookup: which module (if any) contains this field.
 * Returns undefined if the field is always-available.
 */
export function moduleForField(fieldName: string): string | undefined {
  for (const [moduleId, fields] of Object.entries(MODULE_DECISION_FIELDS)) {
    if (fields.includes(fieldName)) return moduleId;
  }
  return undefined;
}
