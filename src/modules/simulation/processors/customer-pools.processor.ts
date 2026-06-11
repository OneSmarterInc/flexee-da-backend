// src/modules/simulation/processors/customer-pools.processor.ts
// Customer Pool Dynamics — CORRECTED
// Handles LOYAL ⇄ IN_PLAY ⇄ COMPETITOR customer movements
//
// ═══════════════════════════════════════════════════════════════════════════
// FIXES vs previous version (each one was visible in live data):
//
// 1. COMPETITOR POOL WAS DEAD. `competitor` was read once and never written,
//    so it sat at 0 for every firm forever. Churn triggers now deposit real
//    exits into it, and win-back withdraws from it — bounded by what's there.
//
// 2. DOUBLE-COUNTED MOVEMENTS. Every churn block incremented BOTH
//    churnedToCompetitor AND degradedFromLoyal for the same customers.
//    Now each customer appears in exactly one movement: exits count as
//    churnedToCompetitor, recoverable downgrades as degradedFromLoyal.
//
// 3. MISLABELED WIN-BACK. The old "wonBackFromCompetitor" converted IN_PLAY
//    customers (the code comment admitted it). That conversion is now
//    reported under growthConverted (which is literally what it is), and
//    wonBackFromCompetitor strictly means withdrawals from the competitor
//    pool, capped by the pool's actual size.
//
// 4. FABRICATED CUSTOMERS. `loyal += atRiskSaved` minted customers from
//    nothing (observable as firm totals growing by atRiskSaved + newEntrants
//    every quarter, e.g. +4,285 = 3,285 + 1,000). "Saved" now means churn
//    PREVENTED: the at-risk slice's potential churn is computed, marketing
//    saves a fraction, and only the unsaved remainder degrades.
//
// 5. UPGRADE COUNTED AS DOWNGRADE. `degradedFromLoyal += growthConverted`
//    reported in-play→loyal conversions as loyal degradations. Removed.
//
// CONSERVATION GUARANTEE: loyal + inPlay + competitor changes ONLY by
// newEntrants (market growth, by design). Every other operation is a
// transfer between pools. Run the included self-check in tests:
//   before + newEntrants === after
// ═══════════════════════════════════════════════════════════════════════════

export interface SCRMDecisions {
  priceP1: number;
  marketingBudget: number;
  segmentChampions?: number;
  segmentGrowth?: number;
  segmentAtRisk?: number;
  segmentOther?: number;
}

export interface CustomerPoolsResult {
  loyalCustomers: number;
  inPlayCustomers: number;
  competitorCustomers: number;
  churnedToCompetitor: number;
  degradedFromLoyal: number;
  wonBackFromCompetitor: number;
  newEntrants: number;
  growthConverted: number;
  atRiskSaved: number;
}

export const CUSTOMER_POOLS_CONFIG = {
  market: {
    TOTAL_MARKET_SIZE: 600_000,
    REGIONS: {
      1: { marketShare: 0.4, growthRate: 0.02, name: 'East' },
      2: { marketShare: 0.35, growthRate: 0.06, name: 'Central' },
      3: { marketShare: 0.25, growthRate: 0.02, name: 'West' },
    },
  },

  customer: {
    POOLS: {
      LOYAL_PERCENT: 0.60,
      IN_PLAY_PERCENT: 0.30,
      NEW_ENTRANT_PERCENT: 0.10,
    },

    CHURN: {
      STOCKOUT: 0.20, // 20% of affected customers churn on stockout
      PRICE_HIKE: 0.15,
      PRICE_HIKE_THRESHOLD: 0.10,
      LOW_CSI: 0.10,
      LOW_CSI_THRESHOLD: 70,
      NATURAL: 0.02,
      // NEW: of each churn event, this share truly EXITS to the competitor
      // pool; the remainder degrades to IN_PLAY (recoverable). At 0.5 the
      // overall loyal outflow matches the old model — only the destination
      // split is new.
      EXIT_SHARE: 0.5,
    },

    CONVERSION: {
      // Base quarterly rate at which IN_PLAY customers convert to LOYAL
      // (this was the old hardcoded 0.25 "win-back" — relabeled, not retuned)
      IN_PLAY_BASE: 0.25,
      IN_PLAY_CAP: 0.8,
    },

    WINBACK: {
      // Base quarterly rate at which the COMPETITOR pool can be won back.
      // Lower than in-play conversion: these customers actively left.
      COMPETITOR_BASE: 0.10,
      COMPETITOR_CAP: 0.5,
      PRICE_LEADER_BONUS: 0.15,
      CSI_LEADER_BONUS: 0.10,
      MARKETING_EFFECT: 0.05,
    },

    SEGMENTS: {
      CHAMPIONS: {
        percentOfCustomers: 0.20,
        percentOfRevenue: 0.50,
        baseRetention: 0.95,
        marketingResponse: 0.02,
      },
      GROWTH: {
        percentOfCustomers: 0.35,
        percentOfRevenue: 0.30,
        baseRetention: 0.80,
        marketingResponse: 0.05,
      },
      AT_RISK: {
        percentOfCustomers: 0.25,
        percentOfRevenue: 0.15,
        baseRetention: 0.60,
        marketingResponse: 0.08,
      },
      OTHER: {
        percentOfCustomers: 0.20,
        percentOfRevenue: 0.05,
        baseRetention: 0.70,
        marketingResponse: 0.03,
      },
    },
  },
};

/**
 * Process customer pool dynamics — conservation-safe version.
 *
 * Pool topology:
 *   LOYAL  --(churn: exit share)-->  COMPETITOR
 *   LOYAL  --(churn: degrade share)--> IN_PLAY
 *   IN_PLAY --(conversion)--> LOYAL          (reported: growthConverted)
 *   COMPETITOR --(win-back, bounded)--> LOYAL (reported: wonBackFromCompetitor)
 *   MARKET GROWTH --> IN_PLAY                 (reported: newEntrants)
 */
export function processCustomerPools(
  marketSize: number,
  marketShare: number,
  loyalCustomers: number,
  inPlayCustomers: number,
  competitorCustomers: number,
  prevPriceP1: number,
  decisions: SCRMDecisions,
  fillRate: number,
  stockoutUnits: number,
  csi: number,
  isPriceLeader: boolean = false,
  isCsiLeader: boolean = false,
): CustomerPoolsResult {
  const CH = CUSTOMER_POOLS_CONFIG.customer.CHURN;
  const CP = CUSTOMER_POOLS_CONFIG.customer.POOLS;
  const CS = CUSTOMER_POOLS_CONFIG.customer.SEGMENTS;
  const CV = CUSTOMER_POOLS_CONFIG.customer.CONVERSION;
  const M = CUSTOMER_POOLS_CONFIG.market;
  const WB = CUSTOMER_POOLS_CONFIG.customer.WINBACK;

  let loyal = loyalCustomers || marketSize * marketShare * CP.LOYAL_PERCENT;
  let inPlay = inPlayCustomers || marketSize * marketShare * CP.IN_PLAY_PERCENT;
  let competitor = competitorCustomers || 0;

  let churnedToCompetitor = 0;
  let degradedFromLoyal = 0;
  let wonBackFromCompetitor = 0;
  let newEntrants = 0;
  let growthConverted = 0;
  let atRiskSaved = 0;

  // === SEGMENT-BASED MARKETING EFFECTIVENESS ===
  const segAlloc = {
    champions: (decisions.segmentChampions || 25) / 100,
    growth: (decisions.segmentGrowth || 25) / 100,
    atRisk: (decisions.segmentAtRisk || 25) / 100,
    other: (decisions.segmentOther || 25) / 100,
  };

  // Normalize if not 100%
  const totalAlloc =
    segAlloc.champions +
    segAlloc.growth +
    segAlloc.atRisk +
    segAlloc.other;
  if (Math.abs(totalAlloc - 1.0) > 0.01) {
    const scale = 1.0 / totalAlloc;
    segAlloc.champions *= scale;
    segAlloc.growth *= scale;
    segAlloc.atRisk *= scale;
    segAlloc.other *= scale;
  }

  // Retention bonus from segment allocation (softens churn rates below)
  const retentionBonus =
    segAlloc.champions * CS.CHAMPIONS.marketingResponse *
      CS.CHAMPIONS.percentOfCustomers +
    segAlloc.growth * CS.GROWTH.marketingResponse *
      CS.GROWTH.percentOfCustomers +
    segAlloc.atRisk * CS.AT_RISK.marketingResponse *
      CS.AT_RISK.percentOfCustomers +
    segAlloc.other * CS.OTHER.marketingResponse *
      CS.OTHER.percentOfCustomers;

  // === SHARED CHURN APPLICATOR ===
  // One churned customer appears in exactly ONE movement bucket:
  //   - EXIT_SHARE of them truly leave → competitor pool (churnedToCompetitor)
  //   - the rest degrade to IN_PLAY (degradedFromLoyal) and can be re-won
  const applyChurn = (requested: number) => {
    const c = Math.min(Math.max(0, Math.round(requested)), loyal);
    if (c === 0) return;
    const exits = Math.round(c * CH.EXIT_SHARE);
    const degrades = c - exits;
    loyal -= c;
    competitor += exits;
    inPlay += degrades;
    churnedToCompetitor += exits;
    degradedFromLoyal += degrades;
  };

  // === AT-RISK SEGMENT: marketing PREVENTS churn (no customer creation) ===
  // The at-risk slice of loyal customers would churn at (1 − baseRetention)
  // annually → quartered. Allocation to the segment saves a fraction; only
  // the UNSAVED remainder actually churns.
  const atRiskPotentialChurn = Math.round(
    loyal *
      CS.AT_RISK.percentOfCustomers *
      ((1 - CS.AT_RISK.baseRetention) / 4),
  );
  atRiskSaved = Math.min(
    atRiskPotentialChurn,
    Math.round(
      atRiskPotentialChurn *
        segAlloc.atRisk *
        CS.AT_RISK.marketingResponse *
        10,
    ),
  );
  applyChurn(atRiskPotentialChurn - atRiskSaved);

  // === GROWTH SEGMENT: in-play → loyal conversion from targeted marketing ===
  // An UPGRADE — it is NOT added to degradedFromLoyal (old bug #5).
  const segGrowthConverted = Math.min(
    Math.round(inPlay * segAlloc.growth * CS.GROWTH.marketingResponse * 5),
    inPlay,
  );
  loyal += segGrowthConverted;
  inPlay -= segGrowthConverted;
  growthConverted += segGrowthConverted;

  // === CHURN TRIGGERS ===

  // 1. Stockout churn
  if (stockoutUnits > 0) {
    applyChurn(stockoutUnits * CH.STOCKOUT);
  }

  // 2. Price hike churn
  const priceChange =
    decisions.priceP1 > 0 && prevPriceP1 > 0
      ? (decisions.priceP1 - prevPriceP1) / prevPriceP1
      : 0;
  if (priceChange > CH.PRICE_HIKE_THRESHOLD) {
    const adjustedPriceChurn = CH.PRICE_HIKE * (1 - retentionBonus * 0.1);
    applyChurn(loyal * adjustedPriceChurn);
  }

  // 3. Low CSI churn
  if (csi < CH.LOW_CSI_THRESHOLD) {
    const adjustedCsiChurn = CH.LOW_CSI * (1 - retentionBonus * 0.1);
    applyChurn(loyal * adjustedCsiChurn);
  }

  // 4. Natural churn
  const adjustedNaturalChurn = CH.NATURAL * (1 - retentionBonus * 0.5);
  applyChurn(loyal * adjustedNaturalChurn);

  // 5. New entrants from market growth — the ONLY source of net new
  // customers, by design
  const growthRate = M.REGIONS[1].growthRate;
  newEntrants = Math.round(marketSize * marketShare * (growthRate / 4));
  inPlay += newEntrants;

  // === IN-PLAY CONVERSION (was mislabeled "win-back from competitor") ===
  // Firms compete for IN_PLAY customers; converting them to LOYAL is the
  // core loyalty engine. Reported under growthConverted — that's what it is.
  let conversionRate = CV.IN_PLAY_BASE;
  if (isPriceLeader) conversionRate += WB.PRICE_LEADER_BONUS;
  if (isCsiLeader) conversionRate += WB.CSI_LEADER_BONUS;

  // Marketing effect (additive per $1M above average)
  const avgMarketingBudget = 5_000_000; // Placeholder average
  let marketingBonus = 0;
  if (decisions.marketingBudget > avgMarketingBudget) {
    const extraBudget = decisions.marketingBudget - avgMarketingBudget;
    marketingBonus = (extraBudget / 1_000_000) * WB.MARKETING_EFFECT;
    conversionRate += marketingBonus;
  }
  conversionRate = Math.min(CV.IN_PLAY_CAP, conversionRate);

  const inPlayConverted = Math.min(
    Math.round(inPlay * conversionRate),
    inPlay,
  );
  loyal += inPlayConverted;
  inPlay -= inPlayConverted;
  growthConverted += inPlayConverted;

  // === TRUE WIN-BACK FROM THE COMPETITOR POOL — bounded by the pool ===
  // These customers actively left, so the base rate is lower than in-play
  // conversion, but the same leader/marketing bonuses apply.
  let winBackRate = WB.COMPETITOR_BASE;
  if (isPriceLeader) winBackRate += WB.PRICE_LEADER_BONUS;
  if (isCsiLeader) winBackRate += WB.CSI_LEADER_BONUS;
  winBackRate += marketingBonus;
  winBackRate = Math.min(WB.COMPETITOR_CAP, winBackRate);

  wonBackFromCompetitor = Math.min(
    Math.round(competitor * winBackRate),
    competitor, // can never win back more customers than exist in the pool
  );
  competitor -= wonBackFromCompetitor;
  loyal += wonBackFromCompetitor;

  return {
    loyalCustomers: Math.max(0, Math.round(loyal)),
    inPlayCustomers: Math.max(0, Math.round(inPlay)),
    competitorCustomers: Math.max(0, Math.round(competitor)),
    churnedToCompetitor,
    degradedFromLoyal,
    wonBackFromCompetitor,
    newEntrants,
    growthConverted,
    atRiskSaved,
  };
}