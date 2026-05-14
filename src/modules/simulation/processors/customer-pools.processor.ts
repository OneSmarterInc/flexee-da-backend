// src/modules/simulation/processors/customer-pools.processor.ts
// Customer Pool Dynamics - Aligned with flexeemaster.gs
// Handles LOYAL → IN_PLAY → COMPETITOR customer movements

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
    },

    WINBACK: {
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
 * Process customer pool dynamics
 * Matches GAS processCustomerPools_() function
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

  // Calculate retention bonus from segment allocation
  const retentionBonus =
    segAlloc.champions * CS.CHAMPIONS.marketingResponse * 
      CS.CHAMPIONS.percentOfCustomers +
    segAlloc.growth * CS.GROWTH.marketingResponse * 
      CS.GROWTH.percentOfCustomers +
    segAlloc.atRisk * CS.AT_RISK.marketingResponse * 
      CS.AT_RISK.percentOfCustomers +
    segAlloc.other * CS.OTHER.marketingResponse * 
      CS.OTHER.percentOfCustomers;

  // Calculate segment-level churn reduction
  atRiskSaved = Math.round(
    loyal *
      CS.AT_RISK.percentOfCustomers *
      (1 - CS.AT_RISK.baseRetention) *
      segAlloc.atRisk *
      CS.AT_RISK.marketingResponse *
      10,
  );

  growthConverted = Math.round(
    inPlay * segAlloc.growth * CS.GROWTH.marketingResponse * 5,
  );

  loyal += atRiskSaved;
  loyal += growthConverted;
  inPlay -= growthConverted;
  degradedFromLoyal += growthConverted;

  // === CHURN TRIGGERS ===

  // 1. Stockout churn
  if (stockoutUnits > 0) {
    const stockoutChurn = Math.round(stockoutUnits * CH.STOCKOUT);
    const fromLoyal = Math.min(stockoutChurn, loyal);
    loyal -= fromLoyal;
    inPlay += fromLoyal;
    churnedToCompetitor += fromLoyal;
    degradedFromLoyal += fromLoyal;
  }

  // 2. Price hike churn
  const priceChange =
    decisions.priceP1 > 0
      ? (decisions.priceP1 - prevPriceP1) / prevPriceP1
      : 0;

  if (priceChange > CH.PRICE_HIKE_THRESHOLD) {
    const adjustedPriceChurn = CH.PRICE_HIKE * (1 - retentionBonus * 0.1);
    const priceChurn = Math.round(loyal * adjustedPriceChurn);
    loyal -= priceChurn;
    inPlay += priceChurn;
    churnedToCompetitor += priceChurn;
    degradedFromLoyal += priceChurn;
  }

  // 3. Low CSI churn
  if (csi < CH.LOW_CSI_THRESHOLD) {
    const adjustedCsiChurn = CH.LOW_CSI * (1 - retentionBonus * 0.1);
    const csiChurn = Math.round(loyal * adjustedCsiChurn);
    loyal -= csiChurn;
    inPlay += csiChurn;
    churnedToCompetitor += csiChurn;
    degradedFromLoyal += csiChurn;
  }

  // 4. Natural churn
  const adjustedNaturalChurn = CH.NATURAL * (1 - retentionBonus * 0.5);
  const naturalChurn = Math.round(loyal * adjustedNaturalChurn);
  loyal -= naturalChurn;
  inPlay += naturalChurn;
  churnedToCompetitor += naturalChurn;
  degradedFromLoyal += naturalChurn;

  // 5. New entrants from market growth
  const growthRate = M.REGIONS[1].growthRate;
  newEntrants = Math.round(
    marketSize * marketShare * (growthRate / 4)
  );
  inPlay += newEntrants;

  // === WIN-BACK FROM IN_PLAY POOL ===
  // Firms compete for IN_PLAY customers
  let winBackRate = 0.25; // Base 25% of IN_PLAY pool

  if (isPriceLeader) {
    winBackRate += WB.PRICE_LEADER_BONUS;
  }
  if (isCsiLeader) {
    winBackRate += WB.CSI_LEADER_BONUS;
  }

  // Marketing effect (additive per $1M above average)
  const avgMarketingBudget = 5_000_000; // Placeholder average
  if (decisions.marketingBudget > avgMarketingBudget) {
    const extraBudget = decisions.marketingBudget - avgMarketingBudget;
    const marketingBonus = (extraBudget / 1_000_000) * WB.MARKETING_EFFECT;
    winBackRate += marketingBonus;
  }

  winBackRate = Math.min(0.8, winBackRate); // Cap at 80%

  wonBackFromCompetitor = Math.round(inPlay * winBackRate);
  loyal += wonBackFromCompetitor;
  inPlay -= wonBackFromCompetitor;

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