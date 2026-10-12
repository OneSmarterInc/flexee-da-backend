export const CONFIG = {
  simulation: {
    PREHISTORY_QUARTERS: 3,
    STARTING_REVENUE: 1_000_000_000,
  },

  financial: {
    COGS_PERCENT: 0.6,
    GROSS_MARGIN_PERCENT: 0.4,
    OPEX_PERCENT: 0.25,
    AR_DAYS: 45,
    AP_DAYS_COGS: 30,
    FIXED_ASSETS_PERCENT: 0.4,
    LONG_TERM_DEBT_PERCENT: 0.2,
    SHORT_TERM_DEBT: 20_000_000,
    HOLDING_COST_PER_UNIT: 5,           // GAS: $5/unit/quarter
    CREDIT_LINE_RATE: 0.15,
    CASH_FLOOR: 10_000_000,
    CASH_MONTHS_OPEX: 2,
    OBSOLESCENCE_RATE: 0.03,            // GAS: 3% obsolescence
  },

  costs: {
    RAW_MATERIAL_COST: 150,
    STANDARD_COGS: 250,
    UNFILLED_ORDER_COST: 25,
    EMERGENCY_PROCUREMENT_PREMIUM: 0.3,
    EMERGENCY_PRODUCTION_PREMIUM: 0.25,
  },

  production: {
    BASE_CAPACITY_PER_SHIFT: 250_000,   // GAS: 250K units/shift
    MAX_SHIFTS: 3,
    LABOR_COST_PER_UNIT: 20,            // GAS: $20/unit
    PARTS_PER_UNIT: 3,                  // GAS: 3 parts per FG
    BASE_DEFECT_RATE: 0.03,             // GAS: 3% base defect rate
    // GAS uses SHIFT_COSTS as cost multipliers: 1: 1.00, 2: 1.15, 3: 1.50
    SHIFT_COSTS: { 1: 1.0, 2: 1.15, 3: 1.5 } as Record<number, number>,
    // Efficiency decreases with more shifts
    SHIFT_EFFICIENCY: { 1: 1.0, 2: 0.95, 3: 0.9 } as Record<number, number>,
  },

  market: {
    TOTAL_MARKET_SIZE: 600_000,
    // Competitive share dynamics (applied after each live quarter).
    SHARE_DYNAMICS: {
      PRICE_ELASTICITY: 1.5,    // exponent on (basePrice / avgPrice)
      CSI_WEIGHT: 1.0,          // exponent on (csi / 80)
      MARKETING_WEIGHT: 0.15,   // exponent on (marketing / peer average)
      FILL_RATE_FLOOR: 0.5,     // availability = floor + (1 - floor) * fillRate
      SMOOTHING: 0.35,          // fraction of gap to target closed per quarter
      MIN_SHARE: 0.10,
      MAX_SHARE: 0.60,
    },
    REGIONS: {
      1: { marketShare: 0.4, growthRate: 0.02, name: 'East (Factory)' },
      2: { marketShare: 0.35, growthRate: 0.06, name: 'Central' },
      3: { marketShare: 0.25, growthRate: 0.02, name: 'West' },
    } as Record<
      number,
      { marketShare: number; growthRate: number; name: string }
    >,
    PRODUCTS: {
      P1: { marketShare: 0.6, basePrice: 500, name: 'Standard' },
      P2: { marketShare: 0.4, basePrice: 850, name: 'Premium' },
    },
    EXPANSION_REGIONS: {
      4: {
        code: 'R4',
        name: 'Canada',
        marketSize: 80000,
        growthRate: 0.04,
        entryBarrier: 'LOW',
        entryCost: 1500000,
        ongoingCost: 200000,
        regulatoryRisk: 0.05,
        culturalFit: 0.95,
      },
      5: {
        code: 'R5',
        name: 'EU (Germany)',
        marketSize: 150000,
        growthRate: 0.03,
        entryBarrier: 'MEDIUM',
        entryCost: 3000000,
        ongoingCost: 400000,
        regulatoryRisk: 0.15,
        culturalFit: 0.80,
      },
      6: {
        code: 'R6',
        name: 'APAC (Japan)',
        marketSize: 200000,
        growthRate: 0.08,
        entryBarrier: 'HIGH',
        entryCost: 5000000,
        ongoingCost: 600000,
        regulatoryRisk: 0.20,
        culturalFit: 0.65,
      },
    },
    EXPANSION_RAMP_UP_QUARTERS: 6,
    P3_CONFIG: {
      CONFIGS: {
        STANDARD: {
          name: 'P3 Standard',
          screen: '10in',
          battery: '12hr',
          storage: '128GB',
          warranty: '1yr',
          costToMake: 320,
          suggestedPrice: 549,
          utilityScore: 7.2,
        },
        PREMIUM: {
          name: 'P3 Premium',
          screen: '12in',
          battery: '12hr',
          storage: '128GB',
          warranty: '2yr',
          costToMake: 400,
          suggestedPrice: 649,
          utilityScore: 8.5,
        },
      },
      LAUNCH_COST: 2000000,
      MARKETING_REQUIRED: 1000000,
      CANNIBALIZATION: {
        P1_RATE: 0.15,
        P2_RATE: 0.10,
      },
      NEW_MARKET_RATE: 0.08,
      RAMP_UP_QUARTERS: 4,
    },
  },

  retailer: {
    CHANNEL_SHARE: 0.55,                // GAS: 55% through retail
    INVENTORY_TARGET_MONTHS: 2.5,       // GAS: 2.5 months
    PANIC_THRESHOLD_MONTHS: 1.0,        // GAS: 1 month triggers panic
    CLEARANCE_THRESHOLD_MONTHS: 4.0,    // GAS: 4 months triggers clearance
    MARKUP: 0.25,                       // GAS: 25% markup
    PANIC_ORDER_MULTIPLIER: 1.5,        // GAS: 1.5x orders in panic
    CLEARANCE_ORDER_MULTIPLIER: 0.5,    // GAS: 0.5x orders in clearance
    CLEARANCE_DISCOUNT: 0.15,           // GAS: 15% clearance discount
    CSI_PENALTY_STOCKOUT: 5,            // GAS: -5 CSI
    CSI_PENALTY_CLEARANCE: 2,           // GAS: -2 CSI
  },

  vmi: {
    SETUP_COST: 2000000,                // GAS: $2M (was $500K - FIXED)
    QUARTERLY_COST: 100000,             // GAS: $100K
    EFFECTS: {
      PANIC_THRESHOLD_MULTIPLIER: 0.5,  // GAS: 0.5 (panic at 0.5 months)
      CLEARANCE_THRESHOLD_MULTIPLIER: 1.5, // GAS: 1.5 (clearance at 6 months)
      PANIC_ORDER_MULTIPLIER: 1.3,      // GAS: 1.3x (was 1.8 - FIXED)
      CLEARANCE_ORDER_MULTIPLIER: 0.7,  // GAS: 0.7x (was 0.6 - FIXED)
    },
  },

  carrier: {
    ['INTERMODAL']: {
      name: 'Intermodal',
      costPerUnit: 1.50,                // GAS: $1.50
      onTimeRate: 0.80,                 // GAS: 80%
      damageRate: 0.010,                // GAS: 1.0%
      volumeDiscountThreshold: null,
      volumeDiscountRate: 0,
    },
    ['TRUCK']: {
      name: 'Truck (FTL)',
      costPerUnit: 3.50,                // GAS: $3.50
      onTimeRate: 0.93,                 // GAS: 93%
      damageRate: 0.005,                // GAS: 0.5%
      volumeDiscountThreshold: 75000,   // GAS: 75K units
      volumeDiscountRate: 0.05,         // GAS: 5%
    },
    ['AIR']: {
      name: 'Air Freight',
      costPerUnit: 12.00,               // GAS: $12.00
      onTimeRate: 1.00,                 // GAS: 100%
      damageRate: 0.000,                // GAS: 0%
      volumeDiscountThreshold: null,
      volumeDiscountRate: 0,
    },
    DEFAULT_MODE: 'TRUCK',
    TMS_DISCOUNT: 0.08,                 // GAS: 8% TMS discount
    LAST_MILE_COST: 2.50,               // GAS: $2.50/unit
  },

  customer: {
    POOLS: {
      LOYAL_PERCENT: 0.6,               // GAS: 60%
      IN_PLAY_PERCENT: 0.3,             // GAS: 30%
      NEW_ENTRANT_PERCENT: 0.1,         // GAS: 10% (NOT "Competitor")
    },
    BASE_CHURN_RATE: 0.05,
    CSI_CHURN_SENSITIVITY: 0.002,
    PRICE_SENSITIVITY: 0.15,
    DECISION_WEIGHTS: {
      price: 0.30,
      availability: 0.25,
      quality: 0.20,
      trust: 0.15,
      awareness: 0.10,
    },
    // Regional weight overrides - GAS lines 772-793
    REGIONAL_WEIGHTS: {
      1: { price: 0.30, availability: 0.25, quality: 0.20, trust: 0.15, awareness: 0.10 },
      2: { price: 0.45, availability: 0.20, quality: 0.15, trust: 0.10, awareness: 0.10 },
      3: { price: 0.20, availability: 0.20, quality: 0.40, trust: 0.15, awareness: 0.05 },
    },
    // Customer segments for analytics mode - GAS lines 821-862
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
    // Churn triggers - GAS lines 803-812
    CHURN: {
      STOCKOUT: 0.20,
      PRICE_HIKE: 0.15,
      PRICE_HIKE_THRESHOLD: 0.10,
      LOW_CSI: 0.10,
      LOW_CSI_THRESHOLD: 70,
      COMPETITOR_UNDERCUT: 0.05,
      UNDERCUT_THRESHOLD: 0.15,
      NATURAL: 0.02,
    },
    // Win-back rates - GAS lines 815-819
    WINBACK: {
      PRICE_LEADER_BONUS: 0.15,
      CSI_LEADER_BONUS: 0.10,
      MARKETING_EFFECT: 0.05,
    },
  },

  seasonality: {
    QUARTERS: { 1: 0.85, 2: 1.0, 3: 1.0, 4: 1.25 } as Record<number, number>,
    LABELS: {
      1: 'Q1 Post-Holiday',
      2: 'Q2 Spring',
      3: 'Q3 Summer',
      4: 'Q4 Holiday',
    } as Record<number, string>,
  },

  preHistory: {
    VARIANCE_RANGE: 0.05,
  },

  perfectOrder: {
    BASE_ON_TIME: 0.92,                 // GAS: 92%
    BASE_IN_FULL: 0.95,                 // GAS: 95%
    BASE_DAMAGE_FREE: 0.97,             // GAS: 97%
    BASE_DOCUMENTATION: 0.99,           // GAS: 99%
    // Factors that affect components - GAS lines 54-58
    STOCKOUT_IN_FULL_PENALTY: 0.30,
    RUSH_DAMAGE_PENALTY: 0.05,
    OVERLOAD_ON_TIME_PENALTY: 0.10,
    CSI_DOCUMENTATION_BONUS: 0.02,
  },
  dc: {
    CENTRAL: {
      name: 'R2 Central DC',
      location: 'Chicago',
      setupCost: 4000000,               // GAS: $4M (was $2M - FIXED)
      quarterlyOpex: 700000,            // GAS: $700K (was $500K - FIXED)
      capacity: 200000,                 // GAS: 200K units
      serviceBonus: 0.03,               // GAS: +3% on-time
      regionServed: 'R2',
      transitDaysToCustomer: 3,
      transitDaysFromFactory: 4,
    },
    WEST: {
      name: 'R3 West DC',
      location: 'Los Angeles',
      setupCost: 6000000,               // GAS: $6M (was $1.8M - FIXED)
      quarterlyOpex: 900000,            // GAS: $900K (was $450K - FIXED)
      capacity: 150000,                 // GAS: 150K units
      serviceBonus: 0.05,               // GAS: +5% on-time
      regionServed: 'R3',
      transitDaysToCustomer: 2,
      transitDaysFromFactory: 7,
    },
    FACTORY_REGION: 'R1',
    FACTORY_SERVICE_BONUS: 0.05,
    DIRECT_SHIP: {
      transitDays: 7,
      serviceLevel: 0.90,
    },
    DC_HOLDING_COST_MULTIPLIER: 0.8,    // GAS: 20% cheaper
    SAFETY_STOCK_DAYS: 14,              // GAS: 14 days
    DISPOSAL_VALUE_RATE: 0.25,          // GAS: 25% recovery
    TRANSFER_COSTS: {
      DC_TO_DC: 5,                      // GAS: $5/unit
      DC_TO_FACTORY: 4,                 // GAS: $4/unit
    },
  },
  scoring: {
    CSI_WEIGHTS: {
      PRODUCT_QUALITY: 0.3,
      SERVICE_QUALITY: 0.35,
      AVAILABILITY_QUALITY: 0.35,
    },
    BSC_THRESHOLDS: {
      NET_INCOME_TARGET: 5_000_000,
      REVENUE_TARGET: 70_000_000,
      GROSS_MARGIN_TARGET: 0.35,
      CASH_TARGET: 20_000_000,
      CSI_TARGET: 85,
      MARKET_SHARE_TARGET: 0.35,
      FILL_RATE_TARGET: 0.95,
      PERFECT_ORDER_TARGET: 0.9,
      CAPACITY_UTIL_OPTIMAL_LOW: 0.7,
      CAPACITY_UTIL_OPTIMAL_HIGH: 0.85,
    },
  },
  credit: {
    BASE_CREDIT_LINE: 50_000_000, // $50M base credit line
    CASH_FLOOR: 10_000_000, // Minimum cash before auto-borrow
    CASH_CEILING: 20_000_000, // Auto-repay above this level
    AUTO_REPAY_PERCENT: 0.5, // Repay 50% of excess cash
    OVERLIMIT_FEE_RATE: 0.02, // 2% fee on overlimit amounts
    SEVERE_OVERLIMIT_THRESHOLD: 1.5, // 150% of credit limit triggers forced sale
    FORCED_SALE_INVENTORY_PERCENT: 0.1, // Sell 10% of inventory
    FORCED_SALE_RECOVERY_RATE: 0.5, // Recover 50% of value

    // Creditworthiness scoring weights (total = 100)
    SCORING_WEIGHTS: {
      CURRENT_RATIO: 20,
      DEBT_TO_EQUITY: 25,
      PROFIT_MARGIN: 20,
      INTEREST_COVERAGE: 15,
      CASH_FLOW: 20,
    },

    // Credit tiers with thresholds and terms
    TIERS: {
      EXCELLENT: {
        minScore: 80,
        creditMultiplier: 2.0,
        annualRate: 0.08,
        name: 'Excellent',
      },
      GOOD: {
        minScore: 60,
        creditMultiplier: 1.5,
        annualRate: 0.12,
        name: 'Good',
      },
      FAIR: {
        minScore: 40,
        creditMultiplier: 1.0,
        annualRate: 0.18,
        name: 'Fair',
      },
      POOR: {
        minScore: 20,
        creditMultiplier: 0.5,
        annualRate: 0.24,
        name: 'Poor',
      },
      DISTRESSED: {
        minScore: 0,
        creditMultiplier: 0.25,
        annualRate: 0.3,
        name: 'Distressed',
      },
    },

    // Scoring thresholds for each metric
    SCORING_THRESHOLDS: {
      CURRENT_RATIO: {
        excellent: 2.0, // >= 2.0 = full points
        good: 1.5,
        fair: 1.0,
        poor: 0.5,
      },
      DEBT_TO_EQUITY: {
        excellent: 0.3, // <= 0.3 = full points (lower is better)
        good: 0.5,
        fair: 1.0,
        poor: 2.0,
      },
      PROFIT_MARGIN: {
        excellent: 0.15, // >= 15% = full points
        good: 0.1,
        fair: 0.05,
        poor: 0.0,
      },
      INTEREST_COVERAGE: {
        excellent: 5.0, // >= 5x = full points
        good: 3.0,
        fair: 1.5,
        poor: 1.0,
      },
      CASH_FLOW: {
        excellent: 3.0, // >= 3x cash floor = full points
        good: 2.0,
        fair: 1.0,
        poor: 0.5,
      },
    },
  },

  greenScore: {
    ECO_PACKAGING: {
      costPerUnit: 0.50,
      greenScoreChange: 1,
    },
    SCORE_EFFECTS: {
      POOR: { min: 0, max: 30, csiEffect: -1.0, churnMultiplier: 1.03, label: 'Poor' },
      BELOW_AVERAGE: { min: 31, max: 50, csiEffect: -0.5, churnMultiplier: 1.01, label: 'Below Average' },
      AVERAGE: { min: 51, max: 70, csiEffect: 0, churnMultiplier: 1.00, label: 'Average' },
      GOOD: { min: 71, max: 85, csiEffect: 0.5, churnMultiplier: 0.99, label: 'Good' },
      EXCELLENT: { min: 86, max: 100, csiEffect: 1.0, churnMultiplier: 0.98, label: 'Excellent' },
    },
    INITIAL_SCORE: 50,
  },

  quality: {
    BASE_DEFECT_RATE: 0.03,
    SUPPLIER_QUALITY_WEIGHT: 0.30,
    INSPECTION: {
      NONE: {
        cost: 0,
        detectionRate: 0.20,
        laborMultiplier: 1.0,
      },
      BASIC: {
        cost: 2,
        detectionRate: 0.70,
        laborMultiplier: 1.05,
      },
      FULL: {
        cost: 5,
        detectionRate: 0.95,
        laborMultiplier: 1.15,
      },
    },
    REWORK_COST: 50,
    RETURN_RATE: 0.60,
    RETURN_COST: 150,
    CSI_PENALTY_PER_RETURN_PCT: 5,
  },

  intelligence: {
    REPORTS: {
      MARKET_TRENDS: { cost: 0, name: 'Market Trends Report', description: 'Seasonal outlook and demand direction' },
      COMPETITOR_PRICING: { cost: 0, name: 'Competitor Pricing Report', description: 'Other firms\' prices (1 quarter lag)' },
      REGIONAL_DEMAND: { cost: 50000, name: 'Regional Demand Analysis', description: 'R1/R2/R3 demand breakdown and trends' },
      RETAIL_CHANNEL: { cost: 50000, name: 'Retail Channel Intelligence', description: 'Retailer inventory, coverage, sell-through' },
      COMPETITOR_CAPACITY: { cost: 100000, name: 'Competitor Capacity Intel', description: 'Expansion plans and utilization' },
      SUPPLIER_RISK: { cost: 75000, name: 'Supplier Risk Monitor', description: 'Early warning on disruptions' },
      CUSTOMER_SENTIMENT: { cost: 75000, name: 'Customer Sentiment Tracker', description: 'CSI trends and churn by competitor' },
    },
  },

  technology: {
    MAINTENANCE_RATE: 0.15,
    SYSTEMS: {
      ERP: { name: 'Basic ERP', category: 'Visibility', cost: 2000000, effect: { holdingCostReduction: 0.05 } },
      CONTROL_TOWER: { name: 'Control Tower', category: 'Visibility', cost: 4000000, effect: { onTimeBonus: 0.03, eventResponseBonus: 0.10 } },
      APS: { name: 'Advanced Planning', category: 'Planning', cost: 3000000, effect: { capacityUtilizationBonus: 0.05 } },
      DEMAND_SENSING: { name: 'Demand Sensing', category: 'Planning', cost: 2500000, effect: { forecastErrorReduction: 0.10 } },
      SOP_WORKBENCH: { name: 'S&OP Workbench', category: 'Planning', cost: 1000000, effect: { planningVisibility: true } },
      WMS: { name: 'Warehouse Management', category: 'Execution', cost: 1500000, effect: { holdingCostReduction: 0.10 } },
      TMS: { name: 'Transportation Management', category: 'Execution', cost: 1500000, effect: { freightCostReduction: 0.08 } },
      OMS: { name: 'Order Management', category: 'Execution', cost: 1000000, effect: { perfectOrderBonus: 0.05 } },
      ANALYTICS: { name: 'SC Analytics Dashboard', category: 'Analytics', cost: 1000000, effect: { analyticsEnabled: true } },
    },
  },

  events: {
    BASE_VARIABILITY: 0.05,
    EVENT_VARIABILITY: 0.20,
    TYPES: {
      SUPPLY_DISRUPTION: { name: 'Supply Chain Disruption', effect: 'PARTS_DELAYED', defaultMagnitude: 0.5, defaultDuration: 1 },
      DEMAND_SURGE: { name: 'Viral Demand Surge', effect: 'DEMAND_SPIKE', defaultMagnitude: 0.3, defaultDuration: 1 },
      COMPETITOR_STUMBLE: { name: 'Competitor PR Crisis', effect: 'STEAL_INPLAY', defaultMagnitude: 0.25, defaultDuration: 1 },
      ECONOMIC_DOWNTURN: { name: 'Economic Slowdown', effect: 'DEMAND_DROP', defaultMagnitude: 0.2, defaultDuration: 2 },
      RAW_MATERIAL_SPIKE: { name: 'Raw Material Cost Spike', effect: 'COST_INCREASE', defaultMagnitude: 0.25, defaultDuration: 1 },
    },
  },
};
