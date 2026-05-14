/******************************************************************************
 * FLEXEE 2.0 - Supply Chain Management Simulation
 * 
 * FIXED VERSION - Inventory tracked in UNITS, not dollars
 * 
 * A teaching machine for SCM, working capital, data analytics, and strategy.
 * Core philosophy: Tradeoffs are the teacher. No optimal solution exists.
 ******************************************************************************/

/******************************************************************************
 * CONFIGURATION
 ******************************************************************************/

const CONFIG = {
  sheets: {
    DASHBOARD: "Dashboard",
    COCKPIT: "Decision_Cockpit",
    REPORT: "10Q_Report",
    DATABASE: "Database",
    SETTINGS: "Settings",
    STOCKS: "Stocks",
    ADMIN: "Faculty_Admin",
    DEMAND_HISTORY: "Demand_History",
    FORECAST_LOG: "Forecast_Log",
    SOP_DASHBOARD: "SOP_Dashboard",
    BALANCED_SCORECARD: "Balanced_Scorecard",
    KPI_HISTORY: "KPI_History",
    SCRM_DASHBOARD: "SCRM_Dashboard",
    INTEL: "Intel_Reports",
  },
  
  simulation: {
    NUM_FIRMS: 3,
    NUM_REGIONS: 3,
    NUM_PRODUCTS: 2,
    PREHISTORY_QUARTERS: 3,
    STARTING_REVENUE: 1000000000,
  },
  
  forecasting: {
    BASE_VARIABILITY: 0.05,      // ±5% random noise each quarter
    EVENT_VARIABILITY: 0.20,    // ±20% additional when events trigger
  },
  
  perfectOrder: {
    // Perfect Order = On-Time × In-Full × Damage-Free × Documentation
    // Each component has a base rate that can be affected by operations
    BASE_ON_TIME: 0.92,           // 92% base on-time delivery
    BASE_IN_FULL: 0.95,           // 95% base complete orders (affected by stockouts)
    BASE_DAMAGE_FREE: 0.97,       // 97% base damage-free
    BASE_DOCUMENTATION: 0.99,     // 99% base correct documentation
    
    // Factors that affect components
    STOCKOUT_IN_FULL_PENALTY: 0.30,    // Stockouts reduce in-full rate
    RUSH_DAMAGE_PENALTY: 0.05,          // Rush orders increase damage
    OVERLOAD_ON_TIME_PENALTY: 0.10,     // Operating at >90% capacity hurts on-time
    CSI_DOCUMENTATION_BONUS: 0.02,      // High CSI improves documentation
  },
  
  // Quality & Defect Management
  quality: {
    BASE_DEFECT_RATE: 0.03,         // 3% base production defect rate
    SUPPLIER_QUALITY_WEIGHT: 0.30,  // 30% of defects influenced by supplier quality
    
    // Inspection levels
    INSPECTION: {
      NONE: { 
        cost: 0,           // $/unit inspected
        detectionRate: 0.20,  // Catches 20% of defects (visual only)
        laborMultiplier: 1.0 
      },
      BASIC: { 
        cost: 2,           // $2/unit
        detectionRate: 0.70,  // Catches 70% of defects
        laborMultiplier: 1.05  // 5% more labor time
      },
      FULL: { 
        cost: 5,           // $5/unit
        detectionRate: 0.95,  // Catches 95% of defects
        laborMultiplier: 1.15  // 15% more labor time
      }
    },
    
    REWORK_COST: 50,         // Cost to rework a detected defect
    RETURN_RATE: 0.60,       // 60% of undetected defects become returns
    RETURN_COST: 150,        // Full cost of a return (shipping, handling, replacement)
    CSI_PENALTY_PER_RETURN_PCT: 5,  // CSI points lost per 1% return rate
  },
  
  // Warranty Network
  warranty: {
    // Warranty tiers (student decision)
    TIERS: {
      NONE: {
        name: "No Warranty",
        pricePerUnit: 0,
        includesPart: false,
        includesService: false,
        csiPenalty: 10,           // -10 CSI for no support
        churnMultiplier: 1.5      // +50% churn
      },
      BASIC: {
        name: "Basic (Part Only)",
        pricePerUnit: 1.50,
        includesPart: true,
        includesService: false,
        csiPenalty: 2,            // -2 CSI (DIY install frustration)
        churnMultiplier: 1.1      // +10% churn
      },
      STANDARD: {
        name: "Standard",
        pricePerUnit: 2.10,
        includesPart: true,
        includesService: true,
        csiPenalty: 0,
        churnMultiplier: 1.0
      },
      PREMIUM: {
        name: "Premium",
        pricePerUnit: 3.00,
        includesPart: true,
        includesService: true,
        csiPenalty: -3,           // +3 CSI bonus
        churnMultiplier: 0.9      // -10% churn
      }
    },
    DEFAULT_TIER: "STANDARD",
    
    // Part shipping costs (per claim)
    PART_SHIPPING: {
      FROM_FACTORY: { R1: 10, R2: 25, R3: 30 },
      FROM_DC: 10                 // Same for all regions (local)
    },
    
    // Third-party service visit costs
    THIRD_PARTY_SERVICE: {
      STANDARD: { R1: 75, R2: 150, R3: 175 },
      PREMIUM: { R1: 100, R2: 200, R3: 225 }
    },
    
    // In-house service (requires DC + network)
    IN_HOUSE_SERVICE: {
      STANDARD: 50,              // Per visit
      PREMIUM: 75                // Priority/faster
    },
    
    // Network setup costs
    NETWORK_SETUP_COST: 500000,  // $500K to establish warranty network at DC
    NETWORK_QUARTERLY_COST: 100000,  // $100K/quarter to maintain network
    
    // Defective part disposal
    DISPOSAL_COST: 8,            // $8 per defective part disposed (legacy, replaced by disposal methods)
    
    // CSI impact from in-house network
    CSI_BONUS_IN_HOUSE: 2,       // +2 CSI points for faster local service
  },
  
  // Returns & Green Score
  greenScore: {
    // Disposal method options
    DISPOSAL_METHODS: {
      LANDFILL: {
        name: "Landfill",
        costPerUnit: 5,
        recoveryPerUnit: 0,
        greenScoreChange: -2,     // Lose 2 points per quarter
        description: "Cheapest, environmentally harmful"
      },
      RECYCLE: {
        name: "Recycle",
        costPerUnit: 15,
        recoveryPerUnit: 0,
        greenScoreChange: 1,      // Gain 1 point per quarter
        description: "Moderate cost, responsible disposal"
      },
      REFURBISH: {
        name: "Refurbish & Resell",
        costPerUnit: 25,
        recoveryPerUnit: 40,      // Sell refurbished unit
        greenScoreChange: 2,      // Gain 2 points per quarter
        description: "Highest cost, but recovers value and builds reputation"
      }
    },
    DEFAULT_METHOD: "RECYCLE",
    
    // Eco packaging option
    ECO_PACKAGING: {
      costPerUnit: 0.50,         // Extra $0.50/unit for eco packaging
      greenScoreChange: 1        // +1 point per quarter if enabled
    },
    
    // Green Score ranges and effects (marginal impact)
    SCORE_EFFECTS: {
      POOR:          { min: 0,  max: 30, csiEffect: -1.0, churnMultiplier: 1.03, label: "Poor" },
      BELOW_AVERAGE: { min: 31, max: 50, csiEffect: -0.5, churnMultiplier: 1.01, label: "Below Average" },
      AVERAGE:       { min: 51, max: 70, csiEffect: 0,    churnMultiplier: 1.00, label: "Average" },
      GOOD:          { min: 71, max: 85, csiEffect: 0.5,  churnMultiplier: 0.99, label: "Good" },
      EXCELLENT:     { min: 86, max: 100, csiEffect: 1.0, churnMultiplier: 0.98, label: "Excellent" }
    },
    
    // Starting score
    INITIAL_SCORE: 50,
    
    // Regional sensitivity weights (for future European expansion)
    REGIONAL_WEIGHTS: {
      R1: 1.0,   // US East - baseline
      R2: 1.0,   // US Central - baseline
      R3: 1.0,   // US West - baseline
      // R4: 3.0 // Future: Europe - 3x sensitivity
    }
  },
  
  // Intelligence Center - Market research and competitor intel
  intelligence: {
    REPORTS: {
      MARKET_TRENDS: {
        name: "Market Trends Report",
        cost: 0,                    // Free
        description: "Seasonal outlook and demand direction"
      },
      COMPETITOR_PRICING: {
        name: "Competitor Pricing Report",
        cost: 0,                    // Free
        description: "Other firms' prices (1 quarter lag)"
      },
      REGIONAL_DEMAND: {
        name: "Regional Demand Analysis",
        cost: 50000,                // $50K/quarter
        description: "R1/R2/R3 demand breakdown and trends"
      },
      RETAIL_CHANNEL: {
        name: "Retail Channel Intelligence",
        cost: 50000,                // $50K/quarter
        description: "Retailer inventory, coverage, sell-through"
      },
      COMPETITOR_CAPACITY: {
        name: "Competitor Capacity Intel",
        cost: 100000,               // $100K/quarter
        description: "Expansion plans and utilization"
      },
      SUPPLIER_RISK: {
        name: "Supplier Risk Monitor",
        cost: 75000,                // $75K/quarter
        description: "Early warning on disruptions"
      },
      CUSTOMER_SENTIMENT: {
        name: "Customer Sentiment Tracker",
        cost: 75000,                // $75K/quarter
        description: "CSI trends and churn by competitor"
      }
    }
  },
  
  // VMI (Vendor Managed Inventory) - Advanced Module
  vmi: {
    // Costs
    SETUP_COST: 2000000,        // $2M one-time setup (IT integration, training)
    QUARTERLY_COST: 100000,     // $100K/quarter ongoing (data sharing, coordination)
    
    // VMI reduces bullwhip effect by smoothing retailer orders
    EFFECTS: {
      PANIC_THRESHOLD_MULTIPLIER: 0.5,     // Panic triggers at 0.5 months instead of 1
      CLEARANCE_THRESHOLD_MULTIPLIER: 1.5, // Clearance triggers at 6 months instead of 4
      PANIC_ORDER_MULTIPLIER: 1.3,         // 1.3x orders in panic (vs 1.5x)
      CLEARANCE_ORDER_MULTIPLIER: 0.7      // 0.7x orders in clearance (vs 0.5x)
    },
    DESCRIPTION: "Collaborative inventory management with retailer"
  },
  
  // Transport & Logistics
  transport: {
    // Outbound shipping modes (base feature)
    MODES: {
      STANDARD: {
        name: "Standard Ground",
        costPerUnit: 3,       // $3 per unit shipped
        onTimeBonus: 0,       // No bonus to on-time delivery
        transitDays: 7,       // Average transit time
        description: "Economical, standard delivery"
      },
      EXPRESS: {
        name: "Express Ground",
        costPerUnit: 5,       // $5 per unit shipped
        onTimeBonus: 0.03,    // +3% on-time delivery bonus
        transitDays: 3,       // Faster transit
        description: "Faster delivery, moderate cost"
      },
      AIR: {
        name: "Air Freight",
        costPerUnit: 10,      // $10 per unit shipped
        onTimeBonus: 0.08,    // +8% on-time delivery bonus
        transitDays: 1,       // Next day
        description: "Premium speed, highest cost"
      }
    },
    
    // TMS provides 8% discount on all freight costs
    TMS_DISCOUNT: 0.08,
  },
  
  // === ADVANCED MODULE: Multi-Carrier Selection ===
  multiCarrier: {
    MODES: {
      INTERMODAL: {
        name: "Intermodal",
        costPerUnit: 1.50,
        onTimeRate: 0.80,           // 80% on-time (rail + truck handoffs add variability)
        damageRate: 0.010,          // 1.0% shipping damage (more handoffs)
        volumeDiscountThreshold: null,
        volumeDiscountRate: 0,      // No volume discount
        description: "Rail + truck, cheapest but variable timing"
      },
      TRUCK: {
        name: "Truck (FTL)",
        costPerUnit: 3.50,
        onTimeRate: 0.93,           // 93% on-time (industry standard)
        damageRate: 0.005,          // 0.5% shipping damage
        volumeDiscountThreshold: 75000,
        volumeDiscountRate: 0.05,   // 5% discount over 75K units (contract rate)
        description: "Full truckload, balanced cost and reliability"
      },
      AIR: {
        name: "Air Freight",
        costPerUnit: 12.00,
        onTimeRate: 1.00,           // 100% on-time guaranteed
        damageRate: 0.000,          // 0% shipping damage (careful handling)
        volumeDiscountThreshold: null,
        volumeDiscountRate: 0,      // No volume discount
        description: "Premium speed, guaranteed delivery"
      }
    },
    
    // Default mode when module disabled
    DEFAULT_MODE: "TRUCK",
    
    // TMS discount applies to all modes
    TMS_DISCOUNT: 0.08,
    
    // Last-mile delivery from DC to customer (parcel carriers)
    LAST_MILE_COST: 2.50,           // $2.50/unit from DC to customer
  },

  // Supply Chain Risk Management
  scrm: {
    // Risk category weights for overall score
    WEIGHTS: {
      SUPPLIER_CONCENTRATION: 0.25,   // Single supplier dependency
      GEOGRAPHIC_EXPOSURE: 0.15,      // Regional concentration
      INVENTORY_BUFFER: 0.20,         // Safety stock adequacy
      DEMAND_VOLATILITY: 0.15,        // Forecast accuracy
      FINANCIAL_HEALTH: 0.15,         // Cash/debt position
      LEAD_TIME_RISK: 0.10,           // Long lead time exposure
    },
    
    // Thresholds for risk levels
    THRESHOLDS: {
      CONCENTRATION_HIGH: 0.80,       // >80% from one supplier = high risk
      CONCENTRATION_MEDIUM: 0.60,     // >60% = medium risk
      BUFFER_LOW_DAYS: 14,            // <14 days supply = low buffer
      BUFFER_TARGET_DAYS: 30,         // 30 days = adequate
      MAPE_HIGH: 0.25,                // >25% MAPE = high volatility
      MAPE_MEDIUM: 0.15,              // >15% = medium
      CASH_CRITICAL: 5000000,         // <$5M cash = critical
      CASH_LOW: 15000000,             // <$15M = concerning
    },
    
    // Risk score interpretation
    RISK_LEVELS: {
      LOW: { max: 30, label: "LOW", color: "#d9ead3" },
      MODERATE: { max: 50, label: "MODERATE", color: "#fff2cc" },
      ELEVATED: { max: 70, label: "ELEVATED", color: "#fce5cd" },
      HIGH: { max: 85, label: "HIGH", color: "#f4cccc" },
      CRITICAL: { max: 100, label: "CRITICAL", color: "#ea9999" }
    }
  },
  
  // === ADVANCED MODULE: Capacity Expansion ===
  capacityExpansion: {
    // Factory expansion options
    EXPANSION_OPTIONS: {
      SMALL_LINE: {
        name: "Small Production Line",
        cost: 8000000,           // $8M investment
        unitsPerQuarter: 50000,  // +50K units/quarter capacity
        buildTime: 1,            // Available next quarter
        maintenance: 200000,     // $200K/quarter maintenance
        description: "Add 50K units/quarter capacity"
      },
      MEDIUM_LINE: {
        name: "Medium Production Line",
        cost: 15000000,          // $15M investment
        unitsPerQuarter: 100000, // +100K units/quarter capacity
        buildTime: 2,            // Available in 2 quarters
        maintenance: 350000,     // $350K/quarter maintenance
        description: "Add 100K units/quarter capacity"
      },
      LARGE_LINE: {
        name: "Large Production Line",
        cost: 25000000,          // $25M investment
        unitsPerQuarter: 200000, // +200K units/quarter capacity
        buildTime: 3,            // Available in 3 quarters
        maintenance: 500000,     // $500K/quarter maintenance
        description: "Add 200K units/quarter capacity"
      }
    },
    
    // Capacity utilization effects
    OVERTIME_THRESHOLD: 0.85,     // Above 85% triggers overtime
    OVERTIME_COST_MULTIPLIER: 1.5, // 50% labor cost premium
    MAX_OVERTIME_CAPACITY: 1.15,  // Can push to 115% with overtime
    
    // Depreciation
    DEPRECIATION_RATE: 0.025,     // 2.5% per quarter (10% annual)
  },
  
  // === ADVANCED MODULE: Regional Distribution Centers ===
  regionalDCs: {
    // DC options by region
    // Factory is in R1 (East) and serves R1 customers directly
    // Only R2 (Central) and R3 (West) need DCs
    DCS: {
      CENTRAL: {
        name: "R2 Central DC",
        location: "Chicago",
        setupCost: 4000000,       // $4M to open
        quarterlyOpex: 700000,    // $700K/quarter operating cost
        capacity: 200000,         // Max 200K units storage
        serviceBonus: 0.03,       // +3% on-time for R2
        regionServed: "R2",
        transitDaysToCustomer: 3, // 3-day delivery
        transitDaysFromFactory: 4, // 4 days from factory
        description: "Serves R2 (Central) - balanced cost/service"
      },
      WEST: {
        name: "R3 West DC",
        location: "Los Angeles",
        setupCost: 6000000,       // $6M to open
        quarterlyOpex: 900000,    // $900K/quarter operating cost
        capacity: 150000,         // Max 150K units storage
        serviceBonus: 0.05,       // +5% on-time for R3
        regionServed: "R3",
        transitDaysToCustomer: 2, // 2-day delivery
        transitDaysFromFactory: 7, // 7 days from factory (longest)
        description: "Serves R3 (West) - fastest delivery to R3"
      }
    },
    
    // Factory serves R1 (East) directly
    FACTORY_REGION: "R1",
    FACTORY_SERVICE_BONUS: 0.05,  // +5% on-time for R1 (local)
    
    // Direct shipping (no DC) baseline
    DIRECT_SHIP: {
      transitDays: 7,            // 7-day average without DC
      serviceLevel: 0.90,        // 90% on-time baseline
    },
    
    // Inventory holding at DCs
    DC_HOLDING_COST_MULTIPLIER: 0.8,  // 20% cheaper than factory (better location)
    
    // Safety stock recommendations
    SAFETY_STOCK_DAYS: 14,       // Recommend 14 days at each DC
    
    // DC Closure - asset disposal
    DISPOSAL_VALUE_RATE: 0.25,   // Get back 25% of setup cost when closing
    
    // Inventory Rebalancing - transfer costs
    TRANSFER_COSTS: {
      DC_TO_DC: 5,               // $5/unit lateral transfer
      DC_TO_FACTORY: 4,          // $4/unit return to factory
    }
  },
  
  // SC Technology Investments
  technology: {
    MAINTENANCE_RATE: 0.15,  // 15% of purchase price per year (3.75% per quarter)
    
    SYSTEMS: {
      // Visibility Systems
      ERP: {
        name: "Basic ERP",
        category: "Visibility",
        cost: 2000000,
        benefit: "See all inventory locations",
        effect: { holdingCostReduction: 0.05 }  // 5% holding cost reduction
      },
      CONTROL_TOWER: {
        name: "Control Tower",
        category: "Visibility",
        cost: 4000000,
        benefit: "Real-time alerts, faster response",
        effect: { onTimeBonus: 0.03, eventResponseBonus: 0.10 }  // +3% on-time, reduce event impact 10%
      },
      
      // Planning Systems
      APS: {
        name: "Advanced Planning (APS)",
        category: "Planning",
        cost: 3000000,
        benefit: "Better production planning",
        effect: { capacityUtilizationBonus: 0.05 }  // 5% more effective capacity
      },
      DEMAND_SENSING: {
        name: "Demand Sensing",
        category: "Planning",
        cost: 2500000,
        benefit: "Improved forecast accuracy",
        effect: { forecastErrorReduction: 0.10 }  // 10% MAPE improvement
      },
      SOP_WORKBENCH: {
        name: "S&OP Workbench",
        category: "Planning",
        cost: 1000000,
        benefit: "Scenario planning tools",
        effect: { planningVisibility: true }  // Unlocks S&OP features
      },
      
      // Execution Systems
      WMS: {
        name: "Warehouse Management (WMS)",
        category: "Execution",
        cost: 1500000,
        benefit: "Warehouse efficiency",
        effect: { holdingCostReduction: 0.10 }  // 10% holding cost reduction
      },
      TMS: {
        name: "Transportation Management (TMS)",
        category: "Execution",
        cost: 1500000,
        benefit: "Freight optimization",
        effect: { freightCostReduction: 0.08 }  // 8% freight cost reduction (future use)
      },
      OMS: {
        name: "Order Management (OMS)",
        category: "Execution",
        cost: 1000000,
        benefit: "Order accuracy improvement",
        effect: { perfectOrderBonus: 0.05 }  // +5% to Perfect Order
      },
      
      // Analytics Systems
      ANALYTICS: {
        name: "SC Analytics Dashboard",
        category: "Analytics",
        cost: 1000000,
        benefit: "KPI tracking, benchmarks",
        effect: { analyticsEnabled: true }  // Unlocks detailed analytics
      }
    }
  },
  
  financial: {
    COGS_PERCENT: 0.60,
    GROSS_MARGIN_PERCENT: 0.40,
    OPEX_PERCENT: 0.25,
    OPERATING_INCOME_PERCENT: 0.15,
    CASH_MONTHS_OPEX: 2,
    AR_DAYS: 45,
    FIXED_ASSETS_PERCENT: 0.40,
    AP_DAYS_COGS: 30,
    SHORT_TERM_DEBT: 20000000,
    LONG_TERM_DEBT_PERCENT: 0.20,
    HOLDING_COST_PER_UNIT: 5,        // $5 per unit per quarter
    OBSOLESCENCE_RATE: 0.03,
    CREDIT_LINE_RATE: 0.15,
    CASH_FLOOR: 10000000,
  },
  
  // Unit costs for BOM
  costs: {
    RAW_MATERIAL_COST: 150,          // Cost per unit of raw materials
    STANDARD_COGS: 250,              // Standard cost per finished unit sold
  },
  
  production: {
    BASE_CAPACITY_PER_SHIFT: 250000,
    MAX_SHIFTS: 3,
    SHIFT_COSTS: { 1: 1.00, 2: 1.15, 3: 1.50 },
    LABOR_COST_PER_UNIT: 20,
    PARTS_PER_UNIT: 3,               // 3 parts needed per finished good
  },
  
  distribution: {
    SHIPPING: {
      AIR: { costPerUnit: 45 },
      TRUCK: { costPerUnit: 15 },
      OCEAN: { costPerUnit: 5 },
    },
  },
  
  market: {
    TOTAL_MARKET_SIZE: 600000,
    REGIONS: {
      1: { code: "R1", name: "East (Factory)", marketShare: 0.40, growthRate: 0.02 },
      2: { code: "R2", name: "Central", marketShare: 0.35, growthRate: 0.06 },
      3: { code: "R3", name: "West", marketShare: 0.25, growthRate: 0.02 },
    },
    
    // === ANALYTICS MODULE: Market Expansion (R4-R6) ===
    // Students analyze which regions to enter based on Market Expansion data
    EXPANSION_REGIONS: {
      4: { 
        code: "R4", 
        name: "Canada", 
        marketSize: 80000,           // 80K units/quarter potential
        growthRate: 0.04,            // 4% quarterly growth
        entryBarrier: "LOW",         // Easy market entry
        entryCost: 1500000,          // $1.5M one-time entry cost
        ongoingCost: 200000,         // $200K/quarter operating cost
        regulatoryRisk: 0.05,        // 5% chance of regulatory delay
        culturalFit: 0.95,           // 95% product-market fit (similar to US)
        description: "Adjacent market, low risk, moderate size"
      },
      5: { 
        code: "R5", 
        name: "EU (Germany)", 
        marketSize: 150000,          // 150K units/quarter potential
        growthRate: 0.03,            // 3% quarterly growth
        entryBarrier: "MEDIUM",      // Moderate entry complexity
        entryCost: 3000000,          // $3M one-time entry cost
        ongoingCost: 400000,         // $400K/quarter operating cost
        regulatoryRisk: 0.15,        // 15% regulatory compliance risk
        culturalFit: 0.80,           // 80% product-market fit
        description: "Large market, regulatory complexity, strong demand"
      },
      6: { 
        code: "R6", 
        name: "APAC (Japan)", 
        marketSize: 200000,          // 200K units/quarter potential
        growthRate: 0.08,            // 8% quarterly growth (fastest)
        entryBarrier: "HIGH",        // Complex market entry
        entryCost: 5000000,          // $5M one-time entry cost
        ongoingCost: 600000,         // $600K/quarter operating cost
        regulatoryRisk: 0.20,        // 20% regulatory/cultural risk
        culturalFit: 0.65,           // 65% product-market fit (needs adaptation)
        description: "Largest growth potential, highest complexity"
      }
    },
    
    // Ramp-up for new regions (takes time to build presence)
    EXPANSION_RAMP_UP_QUARTERS: 6,   // 6 quarters to reach full potential
    
    PRODUCTS: {
      P1: { marketShare: 0.60, basePrice: 500 },
      P2: { marketShare: 0.40, basePrice: 850 },
    },
    
    // === ANALYTICS MODULE: Product Innovation (P3) ===
    // Students design P3 based on conjoint analysis
    P3_CONFIG: {
      // P3 configurations (from conjoint analysis)
      CONFIGS: {
        STANDARD: {
          name: "P3 Standard",
          screen: "10in",
          battery: "12hr",
          storage: "128GB",
          warranty: "1yr",
          costToMake: 320,          // Production cost
          suggestedPrice: 549,      // Based on conjoint
          utilityScore: 7.2,        // Relative attractiveness (1-10)
          description: "Mid-tier: 10in, 12hr battery, 128GB, 1yr warranty"
        },
        PREMIUM: {
          name: "P3 Premium",
          screen: "12in",
          battery: "12hr",
          storage: "128GB",
          warranty: "2yr",
          costToMake: 400,          // Higher production cost
          suggestedPrice: 649,      // Based on conjoint
          utilityScore: 8.5,        // Higher attractiveness
          description: "High-end: 12in, 12hr battery, 128GB, 2yr warranty"
        }
      },
      
      // Launch costs
      LAUNCH_COST: 2000000,          // $2M one-time launch cost
      MARKETING_REQUIRED: 1000000,   // $1M minimum marketing for launch
      
      // Cannibalization rates (P3 steals from P1/P2)
      CANNIBALIZATION: {
        P1_RATE: 0.15,              // P3 Standard cannibalizes 15% of P1
        P2_RATE: 0.10,              // P3 Premium cannibalizes 10% of P2
      },
      
      // Market expansion (P3 also brings new customers)
      NEW_MARKET_RATE: 0.08,        // P3 creates 8% new demand
      
      // Ramp-up quarters (demand grows over time)
      RAMP_UP_QUARTERS: 4,          // Takes 4 quarters to reach full demand
    },
  },
  
  retailer: {
    CHANNEL_SHARE: 0.55,              // 55% of sales through retail
    INVENTORY_TARGET_MONTHS: 2.5,     // Target inventory coverage
    PANIC_THRESHOLD_MONTHS: 1.0,      // Below this, panic ordering
    CLEARANCE_THRESHOLD_MONTHS: 4.0,  // Above this, clearance pricing
    PANIC_ORDER_MULTIPLIER: 1.5,      // Order 50% more when panicked
    CLEARANCE_DISCOUNT: 0.15,         // 15% discount in clearance
    MARKUP: 0.25,                      // Standard 25% retail markup
    CSI_PENALTY_STOCKOUT: 5,          // CSI hit when retailer stocks out
    CSI_PENALTY_CLEARANCE: 2,         // CSI hit from clearance (brand damage)
  },
  
  customer: {
    // Default decision weights (used for overall calculation)
    DECISION_WEIGHTS: {
      price: 0.30,
      availability: 0.25,
      quality: 0.20,
      trust: 0.15,
      awareness: 0.10,
    },
    
    // Regional weight overrides
    REGIONAL_WEIGHTS: {
      1: {  // R1 (East) - Mature, balanced
        price: 0.30,
        availability: 0.25,
        quality: 0.20,
        trust: 0.15,
        awareness: 0.10,
      },
      2: {  // R2 (Central) - Emerging, price-sensitive
        price: 0.45,
        availability: 0.20,
        quality: 0.15,
        trust: 0.10,
        awareness: 0.10,
      },
      3: {  // R3 (West) - Established, service-sensitive
        price: 0.20,
        availability: 0.20,
        quality: 0.40,
        trust: 0.15,
        awareness: 0.05,
      },
    },
    
    // Customer pool configuration
    POOLS: {
      LOYAL_PERCENT: 0.60,        // 60% of customers are loyal at start
      IN_PLAY_PERCENT: 0.30,      // 30% are "in play" (open to switching)
      NEW_ENTRANT_PERCENT: 0.10,  // 10% are new each quarter (from growth)
    },
    
    // Churn triggers - move customers from LOYAL to IN_PLAY
    CHURN: {
      STOCKOUT: 0.20,             // 20% of affected customers churn on stockout
      PRICE_HIKE: 0.15,           // 15% churn if price increases >10%
      PRICE_HIKE_THRESHOLD: 0.10, // Price increase threshold to trigger churn
      LOW_CSI: 0.10,              // 10% churn if CSI drops below threshold
      LOW_CSI_THRESHOLD: 70,      // CSI threshold for churn
      COMPETITOR_UNDERCUT: 0.05,  // 5% churn if competitor undercuts by >15%
      UNDERCUT_THRESHOLD: 0.15,   // Price undercut threshold
      NATURAL: 0.02,              // 2% natural churn per quarter
    },
    
    // Win-back rates - IN_PLAY customers choosing a firm
    WINBACK: {
      PRICE_LEADER_BONUS: 0.15,   // 15% bonus to win IN_PLAY if lowest price
      CSI_LEADER_BONUS: 0.10,     // 10% bonus if highest CSI
      MARKETING_EFFECT: 0.05,     // 5% per $1M above average marketing
    },
    
    // === ANALYTICS MODULE: Customer Segments ===
    // Students identify segments from RFM/clustering analysis
    // Then allocate marketing budget across segments
    SEGMENTS: {
      CHAMPIONS: {
        name: "Champions",
        description: "High value, frequent buyers, highly satisfied",
        percentOfCustomers: 0.20,    // ~20% of customer base
        percentOfRevenue: 0.50,      // ~50% of revenue
        baseRetention: 0.95,         // 95% stay without effort
        marketingResponse: 0.02,     // +2% retention per 10% budget allocated
        churnRisk: "LOW"
      },
      GROWTH: {
        name: "Growth",
        description: "Medium value, increasing frequency, convertible",
        percentOfCustomers: 0.35,    // ~35% of customer base
        percentOfRevenue: 0.30,      // ~30% of revenue
        baseRetention: 0.80,         // 80% stay without effort
        marketingResponse: 0.05,     // +5% retention per 10% budget allocated
        churnRisk: "MEDIUM"
      },
      AT_RISK: {
        name: "At-Risk",
        description: "Declining activity, low satisfaction, may leave",
        percentOfCustomers: 0.25,    // ~25% of customer base
        percentOfRevenue: 0.15,      // ~15% of revenue
        baseRetention: 0.60,         // Only 60% stay without effort
        marketingResponse: 0.08,     // +8% retention per 10% budget allocated
        churnRisk: "HIGH"
      },
      OTHER: {
        name: "Other",
        description: "Low value, occasional buyers",
        percentOfCustomers: 0.20,    // ~20% of customer base
        percentOfRevenue: 0.05,      // ~5% of revenue
        baseRetention: 0.70,         // 70% stay without effort
        marketingResponse: 0.03,     // +3% retention per 10% budget allocated
        churnRisk: "LOW"
      }
    },
    
    // Default allocation (equal across segments)
    DEFAULT_SEGMENT_ALLOCATION: {
      CHAMPIONS: 25,
      GROWTH: 25,
      AT_RISK: 25,
      OTHER: 25
    }
  },
  
  seasonality: {
    ENABLED: true,
    QUARTERS: {
      1: 0.85,   // Q1: -15% (post-holiday slump)
      2: 1.00,   // Q2: normal
      3: 1.00,   // Q3: normal
      4: 1.25,   // Q4: +25% (holiday surge)
    },
  },
  
  events: {
    ENABLED: true,
    PROBABILITY: 0.15,  // 15% chance of event each quarter
    TYPES: {
      SUPPLY_DISRUPTION: {
        probability: 0.30,
        effect: "PARTS_DELAYED",
        magnitude: 0.50,  // 50% of orders delayed
        duration: 1,      // 1 quarter
      },
      DEMAND_SURGE: {
        probability: 0.25,
        effect: "DEMAND_SPIKE",
        magnitude: 0.30,  // 30% demand increase
        duration: 1,
      },
      COMPETITOR_STUMBLE: {
        probability: 0.20,
        effect: "STEAL_INPLAY",
        magnitude: 0.25,  // 25% of their IN_PLAY available
        duration: 1,
      },
      ECONOMIC_DOWNTURN: {
        probability: 0.15,
        effect: "DEMAND_DROP",
        magnitude: 0.20,  // 20% demand decrease
        duration: 2,
      },
      RAW_MATERIAL_SPIKE: {
        probability: 0.10,
        effect: "COST_INCREASE",
        magnitude: 0.25,  // 25% raw material cost increase
        duration: 1,
      },
    },
  },
  
  preHistory: {
    VARIANCE_RANGE: 0.05,
    MAX_DIVERGENCE: 0.10,
  },
  
  // === ANALYTICS MODULE: Supplier Selection ===
  // Students select suppliers based on TCO analysis from supplier_analytics_data.csv
  suppliers: {
    // Supplier profiles (matches data package)
    PROFILES: {
      SUP001: {
        name: "GlobalTech Manufacturing",
        country: "China",
        unitCost: 42.50,
        volumeDiscount5k: 0.03,    // 3% discount at 5K+ units
        volumeDiscount10k: 0.05,   // 5% discount at 10K+ units
        leadTimeDays: 45,
        onTimeDelivery: 0.88,      // 88% on-time
        defectRate: 0.025,         // 2.5% defect rate
        capacity: 500000,
        minOrder: 10000,
        tariffRate: 0.25,          // 25% tariff (China)
        freightPerUnit: 5.00,      // $5/unit ocean freight
        riskLevel: "MEDIUM"
      },
      SUP002: {
        name: "Precision Parts Inc",
        country: "USA",
        unitCost: 58.00,
        volumeDiscount5k: 0.02,
        volumeDiscount10k: 0.04,
        leadTimeDays: 14,
        onTimeDelivery: 0.96,      // 96% on-time
        defectRate: 0.008,         // 0.8% defect rate
        capacity: 200000,
        minOrder: 5000,
        tariffRate: 0,             // Domestic - no tariff
        freightPerUnit: 2.00,      // $2/unit domestic
        riskLevel: "LOW"
      },
      SUP003: {
        name: "EuroComponents GmbH",
        country: "Germany",
        unitCost: 54.00,
        volumeDiscount5k: 0.025,
        volumeDiscount10k: 0.045,
        leadTimeDays: 21,
        onTimeDelivery: 0.94,      // 94% on-time
        defectRate: 0.012,         // 1.2% defect rate
        capacity: 300000,
        minOrder: 7500,
        tariffRate: 0.05,          // 5% tariff
        freightPerUnit: 3.00,      // $3/unit
        riskLevel: "LOW"
      },
      SUP004: {
        name: "Pacific Rim Supply",
        country: "Vietnam",
        unitCost: 38.00,
        volumeDiscount5k: 0.035,
        volumeDiscount10k: 0.06,
        leadTimeDays: 52,
        onTimeDelivery: 0.82,      // 82% on-time
        defectRate: 0.035,         // 3.5% defect rate
        capacity: 400000,
        minOrder: 15000,
        tariffRate: 0.05,          // 5% tariff
        freightPerUnit: 5.00,      // $5/unit
        riskLevel: "HIGH"
      },
      SUP005: {
        name: "MexiParts SA",
        country: "Mexico",
        unitCost: 48.00,
        volumeDiscount5k: 0.03,
        volumeDiscount10k: 0.05,
        leadTimeDays: 10,
        onTimeDelivery: 0.91,      // 91% on-time
        defectRate: 0.018,         // 1.8% defect rate
        capacity: 250000,
        minOrder: 8000,
        tariffRate: 0,             // USMCA - no tariff
        freightPerUnit: 2.50,      // $2.50/unit
        riskLevel: "MEDIUM"
      },
      SUP006: {
        name: "IndiaSource Ltd",
        country: "India",
        unitCost: 36.00,
        volumeDiscount5k: 0.04,
        volumeDiscount10k: 0.07,
        leadTimeDays: 42,
        onTimeDelivery: 0.84,      // 84% on-time
        defectRate: 0.030,         // 3.0% defect rate
        capacity: 600000,
        minOrder: 20000,
        tariffRate: 0.05,          // 5% tariff
        freightPerUnit: 4.50,      // $4.50/unit
        riskLevel: "HIGH"
      }
    },
    
    // Default supplier (used in standard mode or if no selection)
    DEFAULT_PRIMARY: "SUP001",
    DEFAULT_SECONDARY: "NONE",
    DEFAULT_ALLOCATION: 100,      // 100% to primary by default
    
    // Regional supplier (fast, expensive - like current Regional option)
    REGIONAL_SUPPLIER: {
      name: "Regional Quick Supply",
      unitCost: 195,              // Premium for speed
      leadTimeDays: 0,            // Same quarter delivery
      onTimeDelivery: 0.98,
      defectRate: 0.010,
      capacity: 100000,
      minOrder: 1000,
      tariffRate: 0,
      freightPerUnit: 1.00,
      riskLevel: "LOW"
    },
    
    // Cost calculation helpers
    DEFECT_COST_PER_UNIT: 50,     // Cost to handle defective parts
    LATE_DELIVERY_COST: 10,       // Cost per unit when delivery is late
  },
};

/******************************************************************************
 * MENU
 ******************************************************************************/

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 FLEXEE 2.0")
    .addItem("▶ Process Quarter", "runQuarter")
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu("🔧 Setup")
      .addItem("Initialize New Simulation", "initializeSimulation")
      .addItem("Generate Pre-History (Q1-Q3)", "generatePreHistory")
      .addItem("Rebuild Decision Cockpit", "rebuildCockpit")
      .addItem("Reset to Q0", "resetSimulation"))
    .addSubMenu(SpreadsheetApp.getUi().createMenu("📊 Reports")
      .addItem("Show Market Summary", "showMarketSummary")
      .addItem("Refresh S&OP Dashboard", "refreshSOPDashboard"))
    .addSubMenu(SpreadsheetApp.getUi().createMenu("🎓 Faculty Admin")
      .addItem("Open Admin Panel", "showAdminPanel")
      .addItem("Toggle Seasonality", "toggleSeasonality")
      .addItem("Toggle Random Events", "toggleEvents")
      .addItem("Toggle Customer Churn", "toggleChurn")
      .addItem("Toggle Retailer Brain", "toggleRetailer")
      .addSeparator()
      .addItem("Trigger: Supply Disruption", "triggerSupplyDisruption")
      .addItem("Trigger: Demand Surge", "triggerDemandSurge")
      .addItem("Trigger: Economic Downturn", "triggerEconomicDownturn")
      .addSeparator()
      .addItem("Hide Admin Sheet", "hideAdminSheet")
      .addItem("Show Admin Sheet", "showAdminSheet"))
    .addSubMenu(SpreadsheetApp.getUi().createMenu("🔒 Backup")
      .addItem("Create Backup Now", "createBackup")
      .addItem("Create Backup in Folder", "createBackupInFolder")
      .addItem("List Recent Backups", "listRecentBackups"))
    .addToUi();
}

/**
 * Rebuild Decision Cockpit to reflect current Faculty_Admin toggle settings
 * Use this after changing advanced module toggles
 */
function rebuildCockpit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  // Get current quarter from Stocks to preserve decisions
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  let currentQuarter = 0;
  
  if (stocksSheet && stocksSheet.getLastRow() > 1) {
    const stockData = stocksSheet.getDataRange().getValues();
    const qCol = stockData[0].indexOf("Quarter");
    for (let i = stockData.length - 1; i >= 1; i--) {
      if (stockData[i][qCol] > currentQuarter) {
        currentQuarter = stockData[i][qCol];
      }
    }
  }
  
  // Delete and rebuild cockpit
  const cockpitSheet = ss.getSheetByName(CONFIG.sheets.COCKPIT);
  if (cockpitSheet) {
    ss.deleteSheet(cockpitSheet);
  }
  
  setupCockpitSheet_(ss);
  
  // Update info cells if we have data
  if (currentQuarter > 0) {
    updateCockpitInfo_(ss, currentQuarter, []);
  }
  
  ui.alert("Cockpit Rebuilt", 
    "Decision Cockpit has been rebuilt with current Faculty_Admin settings.\n\n" +
    "Note: Decision values have been reset to defaults. Please re-enter any pending decisions.",
    ui.ButtonSet.OK);
}

/**
 * Manually refresh the S&OP Dashboard
 */
function refreshSOPDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  if (!stocksSheet || stocksSheet.getLastRow() < 2) {
    ui.alert("Error", "No simulation data found. Initialize first.", ui.ButtonSet.OK);
    return;
  }
  
  // Get current quarter
  const stockData = stocksSheet.getDataRange().getValues();
  const qCol = stockData[0].indexOf("Quarter");
  let currentQuarter = 0;
  for (let i = stockData.length - 1; i >= 1; i--) {
    if (stockData[i][qCol] > currentQuarter) {
      currentQuarter = stockData[i][qCol];
    }
  }
  
  // Create empty results (just for update)
  const results = [];
  for (let f = 1; f <= CONFIG.simulation.NUM_FIRMS; f++) {
    results.push({ marketShare: 0.333 });
  }
  
  updateSOPDashboard_(ss, currentQuarter, results, null);
  
  ui.alert("S&OP Dashboard", "Dashboard refreshed for Quarter " + currentQuarter, ui.ButtonSet.OK);
}

/**
 * Toggle random events on/off
 */
function toggleEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const current = getAdminSetting_(ss, "Random Events");
  setAdminSetting_(ss, "Random Events", !current);
  ui.alert("Random Events", "Random events are now " + (!current ? "ENABLED" : "DISABLED"), ui.ButtonSet.OK);
}

/**
 * Toggle seasonality on/off
 */
function toggleSeasonality() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const current = getAdminSetting_(ss, "Seasonality");
  setAdminSetting_(ss, "Seasonality", !current);
  ui.alert("Seasonality", "Seasonal demand effects are now " + (!current ? "ENABLED" : "DISABLED"), ui.ButtonSet.OK);
}

/**
 * Toggle customer churn on/off
 */
function toggleChurn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const current = getAdminSetting_(ss, "Customer Churn");
  setAdminSetting_(ss, "Customer Churn", !current);
  ui.alert("Customer Churn", "Customer churn mechanics are now " + (!current ? "ENABLED" : "DISABLED"), ui.ButtonSet.OK);
}

/**
 * Toggle retailer brain on/off
 */
function toggleRetailer() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const current = getAdminSetting_(ss, "Retailer Brain");
  setAdminSetting_(ss, "Retailer Brain", !current);
  ui.alert("Retailer Brain", "Retailer inventory dynamics are now " + (!current ? "ENABLED" : "DISABLED"), ui.ButtonSet.OK);
}

/**
 * Show the admin panel summary
 */
function showAdminPanel() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const settings = {
    seasonality: getAdminSetting_(ss, "Seasonality"),
    events: getAdminSetting_(ss, "Random Events"),
    churn: getAdminSetting_(ss, "Customer Churn"),
    retailer: getAdminSetting_(ss, "Retailer Brain"),
    regions: getAdminSetting_(ss, "Regional Competition"),
    eventProb: getAdminSettingValue_(ss, "Event Probability"),
  };
  
  let summary = "FACULTY ADMIN PANEL\n";
  summary += "=" .repeat(35) + "\n\n";
  summary += "FEATURE TOGGLES:\n";
  summary += `  Seasonality:        ${settings.seasonality ? "✓ ON" : "✗ OFF"}\n`;
  summary += `  Random Events:      ${settings.events ? "✓ ON" : "✗ OFF"}\n`;
  summary += `  Customer Churn:     ${settings.churn ? "✓ ON" : "✗ OFF"}\n`;
  summary += `  Retailer Brain:     ${settings.retailer ? "✓ ON" : "✗ OFF"}\n`;
  summary += `  Regional Competition: ${settings.regions ? "✓ ON" : "✗ OFF"}\n`;
  summary += `\nEVENT SETTINGS:\n`;
  summary += `  Event Probability:  ${(settings.eventProb * 100).toFixed(0)}% per quarter\n`;
  summary += `\nUse Faculty Admin menu to toggle features.\n`;
  summary += `Edit Faculty_Admin sheet for advanced settings.`;
  
  ui.alert("Admin Panel", summary, ui.ButtonSet.OK);
}

/**
 * Hide admin sheet from students
 */
function hideAdminSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.sheets.ADMIN);
  if (sheet) {
    sheet.hideSheet();
    SpreadsheetApp.getUi().alert("Admin sheet hidden. Use 'Show Admin Sheet' to reveal.");
  }
}

/**
 * Show admin sheet
 */
function showAdminSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.sheets.ADMIN);
  if (sheet) {
    sheet.showSheet();
    sheet.activate();
  }
}

/**
 * Manually trigger a supply disruption event
 */
function triggerSupplyDisruption() {
  const ui = SpreadsheetApp.getUi();
  PropertiesService.getScriptProperties().setProperty('FORCED_EVENT', 'SUPPLY_DISRUPTION');
  ui.alert("Event Queued", "Supply Disruption will affect the next quarter.\n50% of parts orders will be delayed.", ui.ButtonSet.OK);
}

/**
 * Manually trigger a demand surge event
 */
function triggerDemandSurge() {
  const ui = SpreadsheetApp.getUi();
  PropertiesService.getScriptProperties().setProperty('FORCED_EVENT', 'DEMAND_SURGE');
  ui.alert("Event Queued", "Demand Surge will affect the next quarter.\n30% increase in demand across all firms.", ui.ButtonSet.OK);
}

/**
 * Manually trigger an economic downturn event
 */
function triggerEconomicDownturn() {
  const ui = SpreadsheetApp.getUi();
  PropertiesService.getScriptProperties().setProperty('FORCED_EVENT', 'ECONOMIC_DOWNTURN');
  ui.alert("Event Queued", "Economic Downturn will affect the next 2 quarters.\n20% decrease in demand.", ui.ButtonSet.OK);
}

/**
 * Get admin setting (boolean)
 */
function getAdminSetting_(ss, settingName) {
  const sheet = ss.getSheetByName(CONFIG.sheets.ADMIN);
  if (!sheet) return true;  // Default to enabled if no admin sheet
  
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === settingName) {
      const val = data[i][1];
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toUpperCase() === 'TRUE' || val.toUpperCase() === 'ON' || val.toUpperCase() === 'YES';
      return Boolean(val);
    }
  }
  return true;  // Default to enabled
}

/**
 * Check if an advanced module is enabled (defaults to FALSE)
 */
function isAdvancedModuleEnabled_(ss, moduleName) {
  const sheet = ss.getSheetByName(CONFIG.sheets.ADMIN);
  if (!sheet) return false;  // Advanced modules default to OFF
  
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === moduleName) {
      const val = data[i][1];
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toUpperCase() === 'TRUE' || val.toUpperCase() === 'ON' || val.toUpperCase() === 'YES';
      return Boolean(val);
    }
  }
  return false;  // Default to disabled for advanced modules
}

/**
 * Check if Analytics Mode is enabled (simplified cockpit)
 */
function isAnalyticsMode_(ss) {
  return isAdvancedModuleEnabled_(ss, "Analytics Mode");
}

/**
 * Get admin setting (numeric value)
 */
function getAdminSettingValue_(ss, settingName) {
  const sheet = ss.getSheetByName(CONFIG.sheets.ADMIN);
  if (!sheet) return null;
  
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === settingName) {
      return data[i][1];
    }
  }
  return null;
}

/**
 * Set admin setting
 */
function setAdminSetting_(ss, settingName, value) {
  const sheet = ss.getSheetByName(CONFIG.sheets.ADMIN);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === settingName) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
}

/**
 * Show comprehensive market summary
 */
function showMarketSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  
  if (!stocksSheet || stocksSheet.getLastRow() < 2) {
    ui.alert("No data available. Run simulation first.");
    return;
  }
  
  const data = stocksSheet.getDataRange().getValues();
  const headers = data[0];
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  
  // Find latest quarter
  const qCol = headers.indexOf("Quarter");
  let maxQ = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][qCol] > maxQ) maxQ = data[i][qCol];
  }
  
  let summary = `MARKET SUMMARY - Q${maxQ}\n`;
  summary += `${"=".repeat(40)}\n\n`;
  
  // Seasonality
  const calendarQ = ((maxQ - 1) % 4) + 1;
  const seasonal = CONFIG.seasonality.QUARTERS[calendarQ];
  const seasonLabel = getSeasonLabel_(calendarQ, seasonal);
  summary += `Season: ${seasonLabel}\n\n`;
  
  // Firm details
  for (let f = 1; f <= numFirms; f++) {
    let row = null;
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][headers.indexOf("Firm_ID")] == f && data[i][qCol] == maxQ) {
        row = data[i];
        break;
      }
    }
    if (!row) continue;
    
    const getVal = (col) => row[headers.indexOf(col)] || 0;
    
    summary += `FIRM ${f}\n`;
    summary += `  Market Share: ${(getVal("Market_Share") * 100).toFixed(1)}%\n`;
    summary += `  CSI: ${getVal("CSI").toFixed(1)}\n`;
    summary += `  Loyal Customers: ${Math.round(getVal("Customers_Loyal") / 1000)}k\n`;
    summary += `  In-Play Customers: ${Math.round(getVal("Customers_InPlay") / 1000)}k\n`;
    summary += `  Retailer Mode: ${getVal("Retailer_Mode")}\n`;
    summary += `  Cash: $${(getVal("Cash") / 1000000).toFixed(1)}M\n\n`;
  }
  
  ui.alert("Market Summary", summary, ui.ButtonSet.OK);
}

/******************************************************************************
 * UTILITIES
 ******************************************************************************/

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

/**
 * Calculate Q0 starting position
 * Returns values in appropriate units (cash in $, inventory in UNITS)
 */
function calculateStartingPosition_(revenue) {
  const F = CONFIG.financial;
  const C = CONFIG.costs;
  const M = CONFIG.market;
  
  const cogs = revenue * F.COGS_PERCENT;
  const opex = revenue * F.OPEX_PERCENT;
  
  // Cash in dollars
  const quarterlyOpex = opex / 4;
  const cash = quarterlyOpex * F.CASH_MONTHS_OPEX;
  
  // AR in dollars
  const accountsReceivable = (revenue / 365) * F.AR_DAYS;
  
  // INVENTORY IN UNITS (not dollars!)
  // Annual units sold = revenue / avg price
  const avgPrice = (M.PRODUCTS.P1.basePrice * M.PRODUCTS.P1.marketShare) + 
                   (M.PRODUCTS.P2.basePrice * M.PRODUCTS.P2.marketShare);
  const annualUnitsSold = revenue / avgPrice;
  const quarterlyUnits = annualUnitsSold / 4;
  
  // Raw materials: 6 weeks of production needs (in units of parts)
  const rawMaterialUnits = Math.round(quarterlyUnits * CONFIG.production.PARTS_PER_UNIT * (6/13));
  
  // Finished goods: 4 weeks of sales (in units)
  const finishedGoodsUnits = Math.round(quarterlyUnits * (4/13));
  
  // Fixed assets in dollars
  const fixedAssets = revenue * F.FIXED_ASSETS_PERCENT;
  
  // Liabilities in dollars
  const accountsPayable = (cogs / 365) * F.AP_DAYS_COGS;
  const shortTermDebt = F.SHORT_TERM_DEBT;
  
  // Calculate total assets and equity
  const inventoryValue = (rawMaterialUnits * C.RAW_MATERIAL_COST) + (finishedGoodsUnits * C.STANDARD_COGS);
  const totalCurrentAssets = cash + accountsReceivable + inventoryValue;
  const totalAssets = totalCurrentAssets + fixedAssets;
  const longTermDebt = totalAssets * F.LONG_TERM_DEBT_PERCENT;
  const totalLiabilities = accountsPayable + shortTermDebt + longTermDebt;
  const equity = totalAssets - totalLiabilities;
  
  return {
    // Dollars
    cash,
    accountsReceivable,
    fixedAssets,
    accountsPayable,
    shortTermDebt,
    longTermDebt,
    equity,
    totalAssets,
    
    // UNITS
    rawMaterialUnits,
    finishedGoodsUnits,
    
    // Metrics
    csi: 80,
    marketShare: 1 / CONFIG.simulation.NUM_FIRMS,
  };
}

/******************************************************************************
 * INITIALIZATION
 ******************************************************************************/

function initializeSimulation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    "Initialize New Simulation",
    "This will create all required sheets. Continue?",
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;
  
  setupSettingsSheet_(ss);
  setupStocksSheet_(ss);
  setupDatabaseSheet_(ss);
  setupCockpitSheet_(ss);
  setupReportSheet_(ss);
  setupDashboardSheet_(ss);
  setupAdminSheet_(ss);
  setupDemandHistorySheet_(ss);
  setupForecastLogSheet_(ss);
  setupSOPDashboardSheet_(ss);
  setupBalancedScorecardSheet_(ss);
  setupKPIHistorySheet_(ss);
  setupSCRMDashboardSheet_(ss);
  setupIntelSheet_(ss);
  
  // Setup Supplier Scorecards (if supplier module is installed)
  if (typeof setupSupplierScorecardsSheet_ === 'function') {
    setupSupplierScorecardsSheet_(ss);
  }
  
  initializeQ0_(ss);
  
  ui.alert("Simulation initialized!\n\nNext: Run 'Generate Pre-History' to create Q1-Q3.\n\nFaculty: Use 'Faculty Admin' menu to configure features.");
}

/**
 * Setup Faculty Admin sheet with feature toggles
 */
function setupAdminSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.ADMIN);
  sheet.clear();
  
  const data = [
    ["FACULTY ADMIN PANEL", "", ""],
    ["Configure simulation features for your course", "", ""],
    ["", "", ""],
    ["SIMULATION MODE", "Status", "Description"],
    ["Analytics Mode", false, "Simplified cockpit for analytics-focused courses"],
    ["", "", ""],
    ["FEATURE TOGGLES", "Status", "Description"],
    ["Seasonality", true, "Q4 +25% demand, Q1 -15% demand"],
    ["Random Events", true, "Supply disruptions, demand surges, etc."],
    ["Customer Churn", true, "Customers leave after stockouts, price hikes"],
    ["Retailer Brain", true, "PANIC/CLEARANCE modes based on inventory"],
    ["Regional Competition", true, "3 regions with different preferences"],
    ["Demand Forecasting", true, "Students forecast demand, see accuracy"],
    ["Perfect Order Tracking", true, "Track on-time, in-full, damage-free, documentation"],
    ["Technology Investments", true, "Students can purchase SC technology systems"],
    ["Quality Control", true, "Defects, inspection, rework, returns"],
    ["Transport & Logistics", true, "Shipping mode selection, freight costs"],
    ["", "", ""],
    ["ADVANCED MODULES", "Status", "Description"],
    ["Capacity Expansion", false, "Factory expansion, new production lines"],
    ["Regional DCs", false, "East/Central/West distribution centers"],
    ["Multi-Carrier Selection", false, "Multiple carriers with different rates/service"],
    ["Returns & Green Score", false, "Product returns, sustainability metrics"],
    ["Intelligence Center", false, "Buy competitor/market intelligence"],
    ["VMI (Vendor Managed Inventory)", false, "Smoother retailer orders, reduced bullwhip"],
    ["", "", ""],
    ["FORECASTING SETTINGS", "", ""],
    ["Show Seasonal Indices", true, "Hint for students about seasonality"],
    ["Show Forecast Helper", true, "Basic calculations (avg, last period)"],
    ["Track Forecast Accuracy", true, "MAPE, Bias metrics"],
    ["Demand Variability", 0.05, "Base random noise ±% each quarter"],
    ["", "", ""],
    ["PERFECT ORDER SETTINGS", "", ""],
    ["Base On-Time Rate", 0.92, "Base on-time delivery rate"],
    ["Base In-Full Rate", 0.95, "Base complete order rate"],
    ["Base Damage-Free Rate", 0.97, "Base damage-free rate"],
    ["Base Documentation Rate", 0.99, "Base correct documentation rate"],
    ["", "", ""],
    ["QUALITY SETTINGS", "", ""],
    ["Base Defect Rate", 0.03, "Base production defect rate (3%)"],
    ["Rework Cost", 50, "Cost to rework a detected defect ($)"],
    ["Return Cost", 150, "Full cost of a customer return ($)"],
    ["", "", ""],
    ["TRANSPORT SETTINGS", "", ""],
    ["Standard Cost/Unit", 3, "Cost per unit for Standard shipping ($)"],
    ["Express Cost/Unit", 5, "Cost per unit for Express shipping ($)"],
    ["Air Cost/Unit", 10, "Cost per unit for Air shipping ($)"],
    ["", "", ""],
    ["TECHNOLOGY SETTINGS", "", ""],
    ["Tech Maintenance Rate", 0.15, "Annual maintenance as % of purchase (quarterly = /4)"],
    ["", "", ""],
    ["EVENT SETTINGS", "", ""],
    ["Event Probability", 0.15, "Chance of random event per quarter (0-1)"],
    ["", "", ""],
    ["SEASONALITY MULTIPLIERS", "", ""],
    ["Q1 Multiplier", 0.85, "Post-holiday demand (e.g., 0.85 = -15%)"],
    ["Q2 Multiplier", 1.00, "Spring demand"],
    ["Q3 Multiplier", 1.00, "Summer demand"],
    ["Q4 Multiplier", 1.25, "Holiday demand (e.g., 1.25 = +25%)"],
    ["", "", ""],
    ["CHURN RATES", "", ""],
    ["Stockout Churn", 0.20, "% of stockout customers who churn"],
    ["Price Hike Churn", 0.15, "% who churn if price rises >10%"],
    ["Low CSI Churn", 0.10, "% who churn if CSI < 70"],
    ["Natural Churn", 0.02, "% natural churn per quarter"],
    ["", "", ""],
    ["RETAILER SETTINGS", "", ""],
    ["Retail Channel Share", 0.55, "% of sales through retailers"],
    ["Panic Threshold", 1.0, "Months of inventory to trigger PANIC"],
    ["Clearance Threshold", 4.0, "Months of inventory to trigger CLEARANCE"],
    ["", "", ""],
    ["COURSE PRESETS", "", ""],
    ["Intro Level", "→ Disable Churn, Events, Advanced Modules", "Simpler simulation"],
    ["Intermediate", "→ Enable base features, no Advanced", "Standard complexity"],
    ["Advanced", "→ Enable all features + Advanced Modules", "Full complexity"],
  ];
  
  sheet.getRange(1, 1, data.length, 3).setValues(data);
  
  // Formatting - section headers
  sheet.getRange(1, 1).setFontSize(16).setFontWeight("bold");
  sheet.getRange(4, 1, 1, 3).setFontWeight("bold").setBackground("#e8e8e8");   // Feature Toggles
  sheet.getRange(16, 1, 1, 3).setFontWeight("bold").setBackground("#d9ead3");  // Advanced Modules (green)
  sheet.getRange(23, 1, 1, 3).setFontWeight("bold").setBackground("#e8e8e8");  // Forecasting
  sheet.getRange(29, 1, 1, 3).setFontWeight("bold").setBackground("#e8e8e8");  // Perfect Order
  sheet.getRange(35, 1, 1, 3).setFontWeight("bold").setBackground("#e8e8e8");  // Quality
  sheet.getRange(40, 1, 1, 3).setFontWeight("bold").setBackground("#e8e8e8");  // Transport
  sheet.getRange(45, 1, 1, 3).setFontWeight("bold").setBackground("#e8e8e8");  // Technology
  sheet.getRange(48, 1, 1, 3).setFontWeight("bold").setBackground("#e8e8e8");  // Events
  sheet.getRange(51, 1, 1, 3).setFontWeight("bold").setBackground("#e8e8e8");  // Seasonality
  sheet.getRange(57, 1, 1, 3).setFontWeight("bold").setBackground("#e8e8e8");  // Churn
  sheet.getRange(63, 1, 1, 3).setFontWeight("bold").setBackground("#e8e8e8");  // Retailer
  sheet.getRange(68, 1, 1, 3).setFontWeight("bold").setBackground("#e8e8e8");  // Presets
  
  // Set column widths
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 300);
  
  // Add data validation for boolean toggles
  const boolRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .build();
  
  // Feature toggles (rows 5-14)
  for (let row = 5; row <= 14; row++) {
    sheet.getRange(row, 2).setDataValidation(boolRule);
  }
  // Advanced modules (rows 17-21)
  for (let row = 17; row <= 21; row++) {
    sheet.getRange(row, 2).setDataValidation(boolRule);
  }
  // Forecasting booleans (rows 24-26)
  for (let row = 24; row <= 26; row++) {
    sheet.getRange(row, 2).setDataValidation(boolRule);
  }
}

/**
 * Setup Demand History sheet - shows past market demand for forecasting
 */
function setupDemandHistorySheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.DEMAND_HISTORY);
  sheet.clear();
  
  const data = [
    ["DEMAND HISTORY", "", "", "", "", ""],
    ["Historical market demand for forecasting reference", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["TOTAL MARKET DEMAND BY QUARTER", "", "", "", "", ""],
    ["Quarter", "R1 Demand", "R2 Demand", "R3 Demand", "Total", "Season"],
    // Data rows will be populated during simulation
  ];
  
  sheet.getRange(1, 1, data.length, 6).setValues(data);
  sheet.getRange(1, 1).setFontSize(16).setFontWeight("bold");
  sheet.getRange(4, 1).setFontWeight("bold");
  sheet.getRange(5, 1, 1, 6).setFontWeight("bold").setBackground("#e8e8e8");
  
  // Add reference section
  const refStart = 20;
  const refData = [
    ["", "", "", "", "", ""],
    ["FORECASTING METHODS REFERENCE", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["Method", "Formula", "Best For", "", "", ""],
    ["Naive", "Forecast = Last period actual", "Stable demand", "", "", ""],
    ["Moving Average", "Forecast = Avg of last 3 periods", "Smoothing noise", "", "", ""],
    ["Seasonal Naive", "Forecast = Same quarter last year", "Strong seasonality", "", "", ""],
    ["Weighted Average", "Forecast = 0.5×Q-1 + 0.3×Q-2 + 0.2×Q-3", "Recent trend", "", "", ""],
    ["", "", "", "", "", ""],
    ["SEASONAL INDICES (if enabled)", "", "", "", "", ""],
    ["Q1: 0.85 (Post-Holiday)", "Q2: 1.00 (Spring)", "Q3: 1.00 (Summer)", "Q4: 1.25 (Holiday)", "", ""],
  ];
  
  sheet.getRange(refStart, 1, refData.length, 6).setValues(refData);
  sheet.getRange(refStart + 1, 1).setFontWeight("bold");
  sheet.getRange(refStart + 3, 1, 1, 3).setFontWeight("bold").setBackground("#e8e8e8");
  sheet.getRange(refStart + 9, 1).setFontWeight("bold");
  
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 100);
}

/**
 * Setup Forecast Log sheet - tracks forecasts vs actuals
 */
function setupForecastLogSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.FORECAST_LOG);
  sheet.clear();
  
  const headers = [
    "Quarter", "Firm_ID", "Timestamp",
    "Forecast_R1", "Forecast_R2", "Forecast_R3", "Forecast_Total",
    "Actual_R1", "Actual_R2", "Actual_R3", "Actual_Total",
    "Error_R1", "Error_R2", "Error_R3", "Error_Total",
    "APE_R1", "APE_R2", "APE_R3", "MAPE",
    "Bias", "Forecast_Method"
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  
  // Add summary section
  const summaryStart = 3;
  const summaryData = [
    ["FORECAST ACCURACY SUMMARY", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Firm", "Gut MAPE", "Model MAPE", "Improvement", "Avg Bias", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Firm 1", "-", "-", "-", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Firm 2", "-", "-", "-", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Firm 3", "-", "-", "-", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ];
  
  // Place summary below headers with space
  sheet.getRange(25, 1, summaryData.length, 21).setValues(summaryData);
  sheet.getRange(25, 1).setFontWeight("bold");
  sheet.getRange(27, 1, 1, 5).setFontWeight("bold").setBackground("#e8e8e8");
}

/**
 * Setup S&OP Dashboard - Sales & Operations Planning view
 */
/**
 * Setup S&OP Dashboard sheet (public wrapper for menu/dropdown)
 */
function setupSOPDashboardSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSOPDashboardSheet_(ss);
  SpreadsheetApp.getUi().alert("S&OP Dashboard sheet created/reset!");
}

function setupSOPDashboardSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.SOP_DASHBOARD);
  sheet.clear();
  
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  
  // Create template for each firm (50 rows each with quality + logistics + alerts sections)
  for (let f = 1; f <= numFirms; f++) {
    const startRow = (f - 1) * 50 + 1;
    
    const data = [
      [`S&OP DASHBOARD - FIRM ${f}`, "", "", "", "", ""],
      ["Current Quarter:", 0, "", "Last Updated:", "", ""],
      ["", "", "", "", "", ""],
      
      // DEMAND SECTION
      ["DEMAND OUTLOOK", "", "", "", "", ""],
      ["", "Q1", "Q2", "Q3", "Current", "Next (Forecast)"],
      ["Market Demand", "-", "-", "-", "-", "?"],
      ["Your Demand (Share)", "-", "-", "-", "-", "?"],
      ["Your Forecast", "-", "-", "-", "-", "Enter in Cockpit"],
      ["Forecast Error", "-", "-", "-", "-", ""],
      ["Season", "-", "-", "-", "-", "Check Calendar"],
      ["", "", "", "", "", ""],
      
      // SUPPLY SECTION
      ["SUPPLY PLAN", "", "", "", "", ""],
      ["", "Available", "Planned", "Gap", "Status", ""],
      ["Parts (Raw Materials)", 0, 0, 0, "OK", ""],
      ["Production Capacity", 0, 0, 0, "OK", ""],
      ["Finished Goods", 0, "-", "-", "OK", ""],
      ["", "", "", "", "", ""],
      
      // INVENTORY SECTION
      ["INVENTORY POSITION", "", "", "", "", ""],
      ["", "Units", "Days of Supply", "Target", "Status", ""],
      ["Raw Materials", 0, 0, "45 days", "OK", ""],
      ["Finished Goods (Your WH)", 0, 0, "30 days", "OK", ""],
      ["Retailer Inventory", 0, 0, "75 days", "OK", ""],
      ["In-Transit (Arriving)", 0, "-", "-", "OK", ""],
      ["Total Pipeline", 0, "-", "-", "", ""],
      ["", "", "", "", "", ""],
      
      // KEY METRICS
      ["KEY METRICS", "Current", "Trend", "Target", "Status", ""],
      ["Fill Rate", "0%", "-", ">95%", "OK", ""],
      ["CSI Score", 0, "-", ">80", "OK", ""],
      ["Perfect Order", "0%", "-", ">85%", "OK", ""],
      ["Forecast Accuracy (1-MAPE)", "0%", "-", ">85%", "OK", ""],
      ["Capacity Utilization", "0%", "-", "70-85%", "OK", ""],
      ["", "", "", "", "", ""],
      
      // QUALITY SECTION
      ["QUALITY CONTROL", "This Quarter", "", "", "", ""],
      ["Inspection Level", "BASIC", "", "Cost/Unit", "$2.00", ""],
      ["Defects Produced", 0, "", "Defect Rate", "3.0%", ""],
      ["Defects Detected", 0, "", "Detection Rate", "70%", ""],
      ["Defects Shipped", 0, "", "Return Rate", "0.0%", ""],
      ["Customer Returns", 0, "", "CSI Impact", "0", ""],
      ["Cost of Quality", "$0", "", "", "", ""],
      ["", "", "", "", "", ""],
      
      // LOGISTICS SECTION
      ["LOGISTICS", "This Quarter", "", "", "", ""],
      ["Shipping Mode", "STANDARD", "", "Cost/Unit", "$3.00", ""],
      ["Units Shipped", 0, "", "Transit Days", "7", ""],
      ["Freight Cost", "$0", "", "TMS Discount", "0%", ""],
      ["On-Time Bonus", "0%", "", "", "", ""],
      ["", "", "", "", "", ""],
      
      // ALERTS (3 rows for alert content)
      ["⚠️ ALERTS & RECOMMENDATIONS", "", "", "", "", ""],
      ["", "", "", "", "", ""],
      ["", "", "", "", "", ""],
      ["", "", "", "", "", ""],
    ];
    
    sheet.getRange(startRow, 1, data.length, 6).setValues(data);
    
    // Formatting
    sheet.getRange(startRow, 1).setFontSize(14).setFontWeight("bold").setBackground("#4a86e8").setFontColor("white");
    sheet.getRange(startRow, 1, 1, 6).setBackground("#4a86e8");
    
    // Section headers - DEMAND (row 4 from start = startRow + 3)
    sheet.getRange(startRow + 3, 1).setFontWeight("bold").setBackground("#c9daf8");
    sheet.getRange(startRow + 3, 1, 1, 6).setBackground("#c9daf8");
    
    // SUPPLY (row 12 from start = startRow + 11)
    sheet.getRange(startRow + 11, 1).setFontWeight("bold").setBackground("#d9ead3");
    sheet.getRange(startRow + 11, 1, 1, 6).setBackground("#d9ead3");
    
    // INVENTORY (row 18 from start = startRow + 17)
    sheet.getRange(startRow + 17, 1).setFontWeight("bold").setBackground("#fff2cc");
    sheet.getRange(startRow + 17, 1, 1, 6).setBackground("#fff2cc");
    
    // KEY METRICS (row 26 from start = startRow + 25)
    sheet.getRange(startRow + 25, 1).setFontWeight("bold").setBackground("#e6b8af");
    sheet.getRange(startRow + 25, 1, 1, 6).setBackground("#e6b8af");
    
    // QUALITY (row 33 from start = startRow + 32)
    sheet.getRange(startRow + 32, 1).setFontWeight("bold").setBackground("#d5a6bd");
    sheet.getRange(startRow + 32, 1, 1, 6).setBackground("#d5a6bd");
    
    // LOGISTICS (row 41 from start = startRow + 40)
    sheet.getRange(startRow + 40, 1).setFontWeight("bold").setBackground("#fce5cd");
    sheet.getRange(startRow + 40, 1, 1, 6).setBackground("#fce5cd");
    
    // ALERTS (row 47 from start = startRow + 46)
    sheet.getRange(startRow + 46, 1).setFontWeight("bold").setBackground("#f4cccc");
    sheet.getRange(startRow + 46, 1, 1, 6).setBackground("#f4cccc");
    
    // Column headers
    sheet.getRange(startRow + 4, 1, 1, 6).setFontWeight("bold");
    sheet.getRange(startRow + 12, 1, 1, 6).setFontWeight("bold");
    sheet.getRange(startRow + 18, 1, 1, 6).setFontWeight("bold");
  }
  
  // Set column widths
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 120);
}

function setupSettingsSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.SETTINGS);
  sheet.clear();
  
  const data = [
    ["FLEXEE 2.0 - WORLD CONSTANTS", "", "", ""],
    ["", "", "", ""],
    ["Parameter", "Value", "Unit", "Description"],
    ["Number of Firms", CONFIG.simulation.NUM_FIRMS, "firms", "Competing firms"],
    ["Starting Revenue", CONFIG.simulation.STARTING_REVENUE, "$", "Per-firm revenue"],
    ["COGS Percent", CONFIG.financial.COGS_PERCENT * 100, "%", "Cost of goods sold"],
    ["Gross Margin", CONFIG.financial.GROSS_MARGIN_PERCENT * 100, "%", "Target margin"],
    ["Holding Cost", CONFIG.financial.HOLDING_COST_PER_UNIT, "$/unit/qtr", "Inventory holding cost"],
    ["Credit Line Rate", CONFIG.financial.CREDIT_LINE_RATE * 100, "%/yr", "Emergency borrowing"],
    ["Raw Material Cost", CONFIG.costs.RAW_MATERIAL_COST, "$/unit", "Cost per raw material unit"],
    ["Standard COGS", CONFIG.costs.STANDARD_COGS, "$/unit", "Cost per finished good"],
    ["Base Capacity/Shift", CONFIG.production.BASE_CAPACITY_PER_SHIFT, "units", "Production capacity per shift"],
    ["Labor Cost", CONFIG.production.LABOR_COST_PER_UNIT, "$/unit", "Labor per unit produced"],
    ["Shift 2 Multiplier", CONFIG.production.SHIFT_COSTS[2], "x", "Second shift cost"],
    ["Shift 3 Multiplier", CONFIG.production.SHIFT_COSTS[3], "x", "Third shift cost"],
    ["Parts per Finished Good", CONFIG.production.PARTS_PER_UNIT, "parts", "BOM requirement"],
    ["Total Market Size", CONFIG.market.TOTAL_MARKET_SIZE, "units/qtr", "Market demand"],
  ];
  
  sheet.getRange(1, 1, data.length, 4).setValues(data);
  sheet.getRange(1, 1).setFontSize(14).setFontWeight("bold");
  sheet.getRange(3, 1, 1, 4).setFontWeight("bold");
}

/**
 * Setup the Balanced Scorecard sheet
 * Four perspectives: Financial, Customer, Internal Process, Learning & Growth
 */
function setupBalancedScorecardSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.BALANCED_SCORECARD);
  sheet.clear();
  
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  
  // Header for each firm
  const headers = ["BALANCED SCORECARD", "Firm 1", "Firm 2", "Firm 3", "Target", "Weight"];
  
  const data = [
    headers,
    ["Current Quarter: 0", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    
    // FINANCIAL PERSPECTIVE
    ["FINANCIAL PERSPECTIVE", "", "", "", "", "25%"],
    ["Net Income ($M)", 0, 0, 0, ">$5M", "30%"],
    ["Revenue ($M)", 0, 0, 0, ">$70M", "25%"],
    ["Gross Margin %", "0%", "0%", "0%", ">35%", "25%"],
    ["Cash Position ($M)", 0, 0, 0, ">$20M", "20%"],
    ["Financial Score", 0, 0, 0, "", ""],
    ["", "", "", "", "", ""],
    
    // CUSTOMER PERSPECTIVE
    ["CUSTOMER PERSPECTIVE", "", "", "", "", "25%"],
    ["CSI Score", 80, 80, 80, ">85", "30%"],
    ["Market Share", "33%", "33%", "33%", ">35%", "25%"],
    ["Fill Rate", "0%", "0%", "0%", ">95%", "25%"],
    ["Return Rate", "0%", "0%", "0%", "<1%", "20%"],
    ["Customer Score", 0, 0, 0, "", ""],
    ["", "", "", "", "", ""],
    
    // INTERNAL PROCESS PERSPECTIVE
    ["INTERNAL PROCESS", "", "", "", "", "25%"],
    ["Perfect Order %", "0%", "0%", "0%", ">90%", "30%"],
    ["Capacity Utilization", "0%", "0%", "0%", "70-85%", "25%"],
    ["Defect Rate", "0%", "0%", "0%", "<2%", "25%"],
    ["On-Time Delivery", "0%", "0%", "0%", ">95%", "20%"],
    ["Process Score", 0, 0, 0, "", ""],
    ["", "", "", "", "", ""],
    
    // LEARNING & GROWTH PERSPECTIVE
    ["LEARNING & GROWTH", "", "", "", "", "25%"],
    ["Technology Systems", 0, 0, 0, "4+", "30%"],
    ["Forecast Accuracy", "0%", "0%", "0%", ">85%", "30%"],
    ["SC Maturity Level", "Basic", "Basic", "Basic", "Advanced", "20%"],
    ["Innovation Investment ($M)", 0, 0, 0, ">$3M", "20%"],
    ["Learning Score", 0, 0, 0, "", ""],
    ["", "", "", "", "", ""],
    
    // OVERALL SCORES
    ["OVERALL BSC SCORE", "", "", "", "", ""],
    ["Weighted Score", 0, 0, 0, ">80", ""],
    ["Rank", 1, 2, 3, "", ""],
    ["Performance Grade", "B", "B", "B", "A", ""],
  ];
  
  sheet.getRange(1, 1, data.length, 6).setValues(data);
  
  // Formatting
  sheet.getRange(1, 1).setFontSize(14).setFontWeight("bold");
  sheet.getRange(1, 1, 1, 6).setBackground("#4a86e8").setFontColor("white");
  
  // Section headers with colors
  sheet.getRange(4, 1, 1, 6).setFontWeight("bold").setBackground("#c9daf8");  // Financial - blue
  sheet.getRange(11, 1, 1, 6).setFontWeight("bold").setBackground("#d9ead3"); // Customer - green
  sheet.getRange(18, 1, 1, 6).setFontWeight("bold").setBackground("#fff2cc"); // Process - yellow
  sheet.getRange(25, 1, 1, 6).setFontWeight("bold").setBackground("#e6b8af"); // Learning - salmon
  sheet.getRange(32, 1, 1, 6).setFontWeight("bold").setBackground("#d5a6bd"); // Overall - purple
  
  // Score rows highlighting
  sheet.getRange(9, 1, 1, 6).setBackground("#e8f0fe");   // Financial score
  sheet.getRange(16, 1, 1, 6).setBackground("#e6f4ea");  // Customer score
  sheet.getRange(23, 1, 1, 6).setBackground("#fef7e0");  // Process score
  sheet.getRange(30, 1, 1, 6).setBackground("#fce8e6");  // Learning score
  sheet.getRange(33, 1, 1, 6).setBackground("#f3e5f5");  // Weighted score
  sheet.getRange(35, 1, 1, 6).setBackground("#f3e5f5");  // Grade
  
  // Column widths
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 90);
  sheet.setColumnWidth(4, 90);
  sheet.setColumnWidth(5, 80);
  sheet.setColumnWidth(6, 70);
}

// Public wrapper for menu
function setupBalancedScorecardSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupBalancedScorecardSheet_(ss);
  SpreadsheetApp.getUi().alert("Balanced Scorecard sheet created!");
}

/**
 * Setup KPI History sheet - time series data for trend analysis
 * One row per firm per quarter, designed for easy conversion to SQL/Python
 */
function setupKPIHistorySheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.KPI_HISTORY);
  sheet.clear();
  
  // Column headers - designed as database table
  const headers = [
    "Quarter",
    "Firm_ID",
    "Timestamp",
    // Financial
    "Revenue",
    "Net_Income",
    "Cash",
    "Gross_Margin_Pct",
    // Customer
    "CSI",
    "Market_Share",
    "Fill_Rate",
    "Return_Rate",
    // Operations
    "Perfect_Order",
    "Capacity_Util",
    "Defect_Rate",
    "On_Time_Delivery",
    "MAPE",
    // Inventory
    "Raw_Material_Units",
    "FG_Units",
    "Inventory_Turnover",
    "Weeks_of_Supply",
    // Learning
    "Tech_Systems_Count",
    "SC_Maturity",
    // Scorecard
    "BSC_Financial",
    "BSC_Customer",
    "BSC_Process",
    "BSC_Learning",
    "BSC_Overall",
    "BSC_Rank"
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#4a86e8").setFontColor("white");
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Set column widths
  sheet.setColumnWidth(1, 60);   // Quarter
  sheet.setColumnWidth(2, 60);   // Firm_ID
  sheet.setColumnWidth(3, 140);  // Timestamp
}

/**
 * Setup SCRM Dashboard - Supply Chain Risk Management
 * Shows risk metrics for each firm
 */
function setupSCRMDashboardSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.SCRM_DASHBOARD);
  sheet.clear();
  
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  const SCRM = CONFIG.scrm;
  
  const data = [
    ["SUPPLY CHAIN RISK MANAGEMENT", "", "", "", "", ""],
    ["Current Quarter:", 0, "", "Last Updated:", "", ""],
    ["", "", "", "", "", ""],
    // Header row
    ["RISK CATEGORY", "Firm 1", "Firm 2", "Firm 3", "Weight", "Benchmark"],
    ["", "", "", "", "", ""],
    // SUPPLIER RISK Section
    ["SUPPLIER RISK", "", "", "", "", ""],
    ["Supplier Concentration", "0%", "0%", "0%", "25%", "<60%"],
    ["Primary Supplier %", "0%", "0%", "0%", "", "Diversify if >60%"],
    ["# of Active Suppliers", "0", "0", "0", "", "≥2 recommended"],
    ["Single Source Flag", "No", "No", "No", "", "Avoid single source"],
    ["Supplier Risk Score", 0, 0, 0, "", ""],
    ["", "", "", "", "", ""],
    // INVENTORY RISK Section
    ["INVENTORY RISK", "", "", "", "", ""],
    ["Raw Material Days", "0", "0", "0", "20%", ">30 days"],
    ["FG Days of Supply", "0", "0", "0", "", ">14 days"],
    ["Buffer Adequacy", "OK", "OK", "OK", "", "Target: 30 days"],
    ["Stockout Risk", "Low", "Low", "Low", "", ""],
    ["Inventory Risk Score", 0, 0, 0, "", ""],
    ["", "", "", "", "", ""],
    // DEMAND RISK Section
    ["DEMAND RISK", "", "", "", "", ""],
    ["Forecast MAPE", "0%", "0%", "0%", "15%", "<15%"],
    ["Demand Volatility", "Low", "Low", "Low", "", ""],
    ["Seasonal Exposure", "Normal", "Normal", "Normal", "", "Plan for Q4 surge"],
    ["Demand Risk Score", 0, 0, 0, "", ""],
    ["", "", "", "", "", ""],
    // FINANCIAL RISK Section
    ["FINANCIAL RISK", "", "", "", "", ""],
    ["Cash Position ($M)", "0", "0", "0", "15%", ">$15M"],
    ["Debt Ratio", "0%", "0%", "0%", "", "<50%"],
    ["Cash Runway (Qtrs)", "0", "0", "0", "", ">4 quarters"],
    ["Financial Risk Score", 0, 0, 0, "", ""],
    ["", "", "", "", "", ""],
    // OPERATIONAL RISK Section
    ["OPERATIONAL RISK", "", "", "", "", ""],
    ["Capacity Utilization", "0%", "0%", "0%", "15%", "70-85%"],
    ["Lead Time Exposure", "Low", "Low", "Low", "10%", ""],
    ["Perfect Order Rate", "0%", "0%", "0%", "", ">90%"],
    ["Operational Risk Score", 0, 0, 0, "", ""],
    ["", "", "", "", "", ""],
    // OVERALL RISK Section
    ["OVERALL RISK ASSESSMENT", "", "", "", "", ""],
    ["Total Risk Score", 0, 0, 0, "", "<50"],
    ["Risk Level", "LOW", "LOW", "LOW", "", ""],
    ["Trend", "→", "→", "→", "", ""],
    ["", "", "", "", "", ""],
    // RISK MITIGATION Section
    ["RECOMMENDED ACTIONS", "", "", "", "", ""],
    ["Priority 1", "-", "-", "-", "", ""],
    ["Priority 2", "-", "-", "-", "", ""],
    ["Priority 3", "-", "-", "-", "", ""],
  ];
  
  sheet.getRange(1, 1, data.length, 6).setValues(data);
  
  // Formatting
  sheet.getRange(1, 1).setFontSize(14).setFontWeight("bold");
  sheet.getRange(4, 1, 1, 6).setFontWeight("bold").setBackground("#4a86e8").setFontColor("white");
  
  // Section headers
  const sectionRows = [6, 13, 20, 26, 32, 38, 43];
  sectionRows.forEach(row => {
    sheet.getRange(row, 1, 1, 6).setFontWeight("bold").setBackground("#e8e8e8");
  });
  
  // Score rows - light yellow
  const scoreRows = [11, 18, 24, 30, 36, 39];
  scoreRows.forEach(row => {
    sheet.getRange(row, 1, 1, 6).setBackground("#fff9e6");
  });
  
  // Overall risk row - highlight
  sheet.getRange(39, 1, 3, 6).setBackground("#f3e5f5");
  
  // Column widths
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 70);
  sheet.setColumnWidth(6, 120);
  
  // Freeze header
  sheet.setFrozenRows(4);
}

/**
 * Update SCRM Dashboard with current risk metrics
 */
function updateSCRMDashboard_(ss, quarter, results) {
  const sheet = ss.getSheetByName(CONFIG.sheets.SCRM_DASHBOARD);
  if (!sheet) return;
  
  const SCRM = CONFIG.scrm;
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  const stockData = stocksSheet.getDataRange().getValues();
  const stockHeaders = stockData[0];
  
  const forecastSheet = ss.getSheetByName(CONFIG.sheets.FORECAST_LOG);
  
  // Update header
  sheet.getRange(2, 2).setValue(quarter);
  sheet.getRange(2, 5).setValue(new Date().toLocaleString());
  
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  
  for (let f = 1; f <= numFirms; f++) {
    const col = f + 1;  // Column B=2, C=3, D=4
    const result = results && results[f - 1] ? results[f - 1] : null;
    
    // Get stock data for this firm
    let stockRow = null;
    for (let i = stockData.length - 1; i >= 1; i--) {
      if (stockData[i][stockHeaders.indexOf("Firm_ID")] == f && 
          stockData[i][stockHeaders.indexOf("Quarter")] == quarter) {
        stockRow = stockData[i];
        break;
      }
    }
    
    const getStock = (name) => stockRow ? (stockRow[stockHeaders.indexOf(name)] || 0) : 0;
    
    // === SUPPLIER RISK ===
    // For now, assume single supplier (Global) - will improve with multi-supplier
    const supplierConcentration = 100;  // 100% from one supplier
    const numSuppliers = 1;  // Will track when multi-supplier added
    const singleSource = numSuppliers === 1;
    
    sheet.getRange(7, col).setValue(supplierConcentration + "%");
    sheet.getRange(8, col).setValue(supplierConcentration + "%");
    sheet.getRange(9, col).setValue(numSuppliers);
    sheet.getRange(10, col).setValue(singleSource ? "YES" : "No");
    
    // Supplier risk score (0-100, higher = more risk)
    let supplierRisk = 0;
    if (supplierConcentration > 80) supplierRisk = 80;
    else if (supplierConcentration > 60) supplierRisk = 50;
    else supplierRisk = 20;
    if (singleSource) supplierRisk += 20;
    supplierRisk = Math.min(100, supplierRisk);
    sheet.getRange(11, col).setValue(supplierRisk);
    colorCodeRisk_(sheet, 11, col, supplierRisk);
    
    // === INVENTORY RISK ===
    const rawUnits = getStock("Raw_Material_Units");
    const fgUnits = getStock("FG_Units");
    const dailyProduction = 200000 / 90;  // Approximate daily production
    const dailySales = 200000 / 90;  // Approximate daily sales
    
    const rawDays = dailyProduction > 0 ? Math.round(rawUnits / dailyProduction) : 0;
    const fgDays = dailySales > 0 ? Math.round(fgUnits / dailySales) : 0;
    
    sheet.getRange(14, col).setValue(rawDays);
    sheet.getRange(15, col).setValue(fgDays);
    
    // Buffer adequacy
    let bufferStatus = "OK";
    let stockoutRisk = "Low";
    if (fgDays < 7) { bufferStatus = "CRITICAL"; stockoutRisk = "High"; }
    else if (fgDays < 14) { bufferStatus = "LOW"; stockoutRisk = "Medium"; }
    else if (fgDays < 21) { bufferStatus = "ADEQUATE"; stockoutRisk = "Low"; }
    else { bufferStatus = "STRONG"; stockoutRisk = "Minimal"; }
    
    sheet.getRange(16, col).setValue(bufferStatus);
    sheet.getRange(17, col).setValue(stockoutRisk);
    
    // Inventory risk score
    let invRisk = 0;
    if (fgDays < 7) invRisk = 90;
    else if (fgDays < 14) invRisk = 60;
    else if (fgDays < 21) invRisk = 30;
    else invRisk = 10;
    if (rawDays < 30) invRisk += 20;
    invRisk = Math.min(100, invRisk);
    sheet.getRange(18, col).setValue(invRisk);
    colorCodeRisk_(sheet, 18, col, invRisk);
    
    // === DEMAND RISK ===
    const forecastAccuracy = getForecastAccuracySummary_(ss, f);
    const mape = forecastAccuracy.avgMape || 0.20;
    
    sheet.getRange(21, col).setValue((mape * 100).toFixed(1) + "%");
    
    let volatility = "Low";
    if (mape > 0.25) volatility = "High";
    else if (mape > 0.15) volatility = "Medium";
    sheet.getRange(22, col).setValue(volatility);
    
    // Seasonal exposure
    const calendarQ = ((quarter - 1) % 4) + 1;
    let seasonalExposure = "Normal";
    if (calendarQ === 4) seasonalExposure = "HIGH (Q4)";
    else if (calendarQ === 1) seasonalExposure = "Low Season";
    sheet.getRange(23, col).setValue(seasonalExposure);
    
    // Demand risk score
    let demandRisk = 0;
    if (mape > 0.25) demandRisk = 70;
    else if (mape > 0.15) demandRisk = 40;
    else demandRisk = 15;
    if (calendarQ === 4) demandRisk += 20;  // Q4 adds risk
    demandRisk = Math.min(100, demandRisk);
    sheet.getRange(24, col).setValue(demandRisk);
    colorCodeRisk_(sheet, 24, col, demandRisk);
    
    // === FINANCIAL RISK ===
    const cash = getStock("Cash");
    const stDebt = getStock("Short_Term_Debt");
    const ltDebt = getStock("Long_Term_Debt");
    const totalAssets = cash + getStock("Accounts_Receivable") + 
                       (rawUnits * CONFIG.costs.RAW_MATERIAL_COST) + 
                       (fgUnits * CONFIG.costs.STANDARD_COGS) +
                       getStock("Fixed_Assets");
    const totalDebt = stDebt + ltDebt;
    const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;
    
    // Cash runway (quarters of operations)
    const quarterlyBurn = 15000000;  // Approximate quarterly expenses
    const cashRunway = cash / quarterlyBurn;
    
    sheet.getRange(27, col).setValue((cash / 1000000).toFixed(1));
    sheet.getRange(28, col).setValue(debtRatio.toFixed(0) + "%");
    sheet.getRange(29, col).setValue(cashRunway.toFixed(1));
    
    // Financial risk score
    let finRisk = 0;
    if (cash < 5000000) finRisk = 80;
    else if (cash < 15000000) finRisk = 50;
    else if (cash < 25000000) finRisk = 25;
    else finRisk = 10;
    if (debtRatio > 60) finRisk += 30;
    else if (debtRatio > 40) finRisk += 15;
    finRisk = Math.min(100, finRisk);
    sheet.getRange(30, col).setValue(finRisk);
    colorCodeRisk_(sheet, 30, col, finRisk);
    
    // === OPERATIONAL RISK ===
    const unitsProduced = result ? (result.unitsProduced || 0) : 0;
    const maxCapacity = CONFIG.production.BASE_CAPACITY_PER_SHIFT * 3;
    const capacityUtil = maxCapacity > 0 ? (unitsProduced / maxCapacity) * 100 : 0;
    const perfectOrder = result ? (result.perfectOrder || 0.84) * 100 : 84;
    
    sheet.getRange(33, col).setValue(capacityUtil.toFixed(0) + "%");
    
    // Lead time exposure
    let leadTimeRisk = "Low";
    const ordersInTransit = getStock("Orders_In_Transit");
    if (ordersInTransit > rawUnits) leadTimeRisk = "High";
    else if (ordersInTransit > rawUnits * 0.5) leadTimeRisk = "Medium";
    sheet.getRange(34, col).setValue(leadTimeRisk);
    
    sheet.getRange(35, col).setValue(perfectOrder.toFixed(0) + "%");
    
    // Operational risk score
    let opRisk = 0;
    if (capacityUtil > 95) opRisk = 60;  // Over capacity = risky
    else if (capacityUtil > 85) opRisk = 40;
    else if (capacityUtil < 50) opRisk = 30;  // Under-utilized
    else opRisk = 15;  // Sweet spot
    if (perfectOrder < 80) opRisk += 30;
    else if (perfectOrder < 90) opRisk += 15;
    opRisk = Math.min(100, opRisk);
    sheet.getRange(36, col).setValue(opRisk);
    colorCodeRisk_(sheet, 36, col, opRisk);
    
    // === OVERALL RISK ===
    const W = SCRM.WEIGHTS;
    const totalRisk = Math.round(
      supplierRisk * W.SUPPLIER_CONCENTRATION +
      invRisk * W.INVENTORY_BUFFER +
      demandRisk * W.DEMAND_VOLATILITY +
      finRisk * W.FINANCIAL_HEALTH +
      opRisk * (W.GEOGRAPHIC_EXPOSURE + W.LEAD_TIME_RISK)
    );
    
    sheet.getRange(39, col).setValue(totalRisk);
    
    // Risk level
    let riskLevel = "LOW";
    let riskColor = "#d9ead3";
    if (totalRisk > 85) { riskLevel = "CRITICAL"; riskColor = "#ea9999"; }
    else if (totalRisk > 70) { riskLevel = "HIGH"; riskColor = "#f4cccc"; }
    else if (totalRisk > 50) { riskLevel = "ELEVATED"; riskColor = "#fce5cd"; }
    else if (totalRisk > 30) { riskLevel = "MODERATE"; riskColor = "#fff2cc"; }
    
    sheet.getRange(40, col).setValue(riskLevel);
    sheet.getRange(39, col, 2, 1).setBackground(riskColor);
    
    // Trend placeholder
    sheet.getRange(41, col).setValue("→");
    
    // === RECOMMENDED ACTIONS ===
    const actions = generateRiskActions_(supplierRisk, invRisk, demandRisk, finRisk, opRisk);
    sheet.getRange(44, col).setValue(actions[0] || "-");
    sheet.getRange(45, col).setValue(actions[1] || "-");
    sheet.getRange(46, col).setValue(actions[2] || "-");
  }
}

/**
 * Color code risk scores
 */
function colorCodeRisk_(sheet, row, col, score) {
  let color = "#d9ead3";  // Green - low risk
  if (score > 70) color = "#f4cccc";      // Red - high risk
  else if (score > 50) color = "#fce5cd"; // Orange - elevated
  else if (score > 30) color = "#fff2cc"; // Yellow - moderate
  sheet.getRange(row, col).setBackground(color);
}

/**
 * Generate prioritized risk mitigation actions
 */
function generateRiskActions_(supplierRisk, invRisk, demandRisk, finRisk, opRisk) {
  const actions = [];
  
  // Sort risks and generate actions for top 3
  const risks = [
    { name: "supplier", score: supplierRisk, action: "Diversify suppliers - add Regional" },
    { name: "inventory", score: invRisk, action: "Increase safety stock levels" },
    { name: "demand", score: demandRisk, action: "Improve demand forecasting (APS)" },
    { name: "financial", score: finRisk, action: "Build cash reserves" },
    { name: "operational", score: opRisk, action: "Optimize capacity utilization" }
  ];
  
  risks.sort((a, b) => b.score - a.score);
  
  for (let i = 0; i < 3; i++) {
    if (risks[i].score > 30) {
      actions.push(risks[i].action);
    }
  }
  
  return actions;
}

/**
 * Append KPI data for all firms for the current quarter
 * Called after each quarter is processed
 */
function appendKPIHistory_(ss, quarter, results) {
  const sheet = ss.getSheetByName(CONFIG.sheets.KPI_HISTORY);
  if (!sheet) return;
  
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  const stockData = stocksSheet.getDataRange().getValues();
  const stockHeaders = stockData[0];
  
  const timestamp = new Date().toISOString();
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  
  for (let f = 1; f <= numFirms; f++) {
    const result = results && results[f - 1] ? results[f - 1] : null;
    
    // Get stock data for this firm
    let stockRow = null;
    for (let i = stockData.length - 1; i >= 1; i--) {
      if (stockData[i][stockHeaders.indexOf("Firm_ID")] == f && 
          stockData[i][stockHeaders.indexOf("Quarter")] == quarter) {
        stockRow = stockData[i];
        break;
      }
    }
    
    const getStock = (name) => stockRow ? (stockRow[stockHeaders.indexOf(name)] || 0) : 0;
    
    // Calculate metrics
    const revenue = result ? result.revenue : 0;
    const netIncome = result ? result.netIncome : 0;
    const cash = getStock("Cash");
    const grossMarginPct = result && result.revenue > 0 && result.grossMargin ? 
      (result.grossMargin / result.revenue * 100) : 35;
    
    const csi = getStock("CSI") || 80;
    const marketShare = getStock("Market_Share") || 0.333;
    const fillRate = result ? (result.fillRate || 0.9) : 0.9;
    const returnRate = result && result.qualityResult ? result.qualityResult.returnRate : 0;
    
    const perfectOrder = result ? (result.perfectOrder || 0.84) : 0.84;
    const capacityUtil = result && result.unitsProduced ? 
      result.unitsProduced / (CONFIG.production.BASE_CAPACITY_PER_SHIFT * 3) : 0;
    const defectRate = result && result.qualityResult ? result.qualityResult.defectRate : 0.03;
    const onTime = result && result.poComponents ? result.poComponents.onTime : 0.92;
    const mape = result ? (result.forecastAccuracy || 0.2) : 0.2;
    
    const rawUnits = getStock("Raw_Material_Units");
    const fgUnits = getStock("FG_Units");
    const unitsSold = result ? (result.unitsSold || 0) : 0;
    const dailySales = unitsSold / 90;
    const retailerInv = getStock("Retailer_Inventory") || 0;
    const invValue = (rawUnits * CONFIG.costs.RAW_MATERIAL_COST) + (fgUnits * CONFIG.costs.STANDARD_COGS);
    const cogs = result ? (result.revenue * CONFIG.financial.COGS_PERCENT) : 0;
    const invTurnover = invValue > 0 ? (cogs * 4) / invValue : 0;
    const weeksOfSupply = dailySales > 0 ? (fgUnits + retailerInv) / (dailySales * 7) : 0;
    
    const techOwned = getStock("Tech_Owned") || "";
    const numTech = techOwned ? techOwned.split(",").filter(t => t).length : 0;
    let maturity = "Basic";
    if (numTech >= 4 && perfectOrder > 0.85) maturity = "Advanced";
    else if (numTech >= 2 && perfectOrder > 0.80) maturity = "Developing";
    
    // BSC scores (simplified recalculation)
    const bscFinancial = Math.min(100, 
      (netIncome/1000000 > 5 ? 30 : Math.max(0, netIncome/1000000 / 5 * 30)) +
      (revenue/1000000 > 70 ? 25 : revenue/1000000 / 70 * 25) +
      (grossMarginPct > 35 ? 25 : grossMarginPct / 35 * 25) +
      (cash/1000000 > 20 ? 20 : cash/1000000 / 20 * 20)
    );
    
    const bscCustomer = Math.min(100,
      (csi > 85 ? 30 : (csi - 50) / 35 * 30) +
      (marketShare * 100 > 35 ? 25 : marketShare * 100 / 35 * 25) +
      (fillRate * 100 > 95 ? 25 : fillRate * 100 / 95 * 25) +
      (returnRate * 100 < 1 ? 20 : Math.max(0, (3 - returnRate * 100) / 3 * 20))
    );
    
    const capScore = capacityUtil >= 0.70 && capacityUtil <= 0.85 ? 25 : 
      (capacityUtil < 0.70 ? capacityUtil / 0.70 * 25 : Math.max(0, (1 - capacityUtil) / 0.15 * 25));
    const bscProcess = Math.min(100,
      (perfectOrder > 0.90 ? 30 : perfectOrder / 0.90 * 30) +
      capScore +
      (defectRate < 0.02 ? 25 : Math.max(0, (0.05 - defectRate) / 0.05 * 25)) +
      (onTime > 0.95 ? 20 : onTime / 0.95 * 20)
    );
    
    const forecastAcc = 1 - mape;
    const bscLearning = Math.min(100,
      (numTech >= 4 ? 30 : numTech / 4 * 30) +
      (forecastAcc > 0.85 ? 30 : forecastAcc / 0.85 * 30) +
      (maturity === "Advanced" ? 20 : (maturity === "Developing" ? 10 : 0)) +
      (numTech * 2 > 3 ? 20 : numTech * 2 / 3 * 20)
    );
    
    const bscOverall = (bscFinancial + bscCustomer + bscProcess + bscLearning) / 4;
    
    // Row data
    const rowData = [
      quarter,
      f,
      timestamp,
      revenue,
      netIncome,
      cash,
      grossMarginPct,
      csi,
      marketShare,
      fillRate,
      returnRate,
      perfectOrder,
      capacityUtil,
      defectRate,
      onTime,
      mape,
      rawUnits,
      fgUnits,
      invTurnover,
      weeksOfSupply,
      numTech,
      maturity,
      bscFinancial,
      bscCustomer,
      bscProcess,
      bscLearning,
      bscOverall,
      0  // Rank calculated after all firms
    ];
    
    sheet.appendRow(rowData);
  }
  
  // Update ranks for this quarter
  updateKPIRanks_(sheet, quarter, numFirms);
}

/**
 * Update BSC ranks for a given quarter
 */
function updateKPIRanks_(sheet, quarter, numFirms) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const qCol = headers.indexOf("Quarter");
  const firmCol = headers.indexOf("Firm_ID");
  const overallCol = headers.indexOf("BSC_Overall");
  const rankCol = headers.indexOf("BSC_Rank");
  
  // Find rows for this quarter
  const quarterRows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][qCol] == quarter) {
      quarterRows.push({ row: i + 1, firm: data[i][firmCol], score: data[i][overallCol] });
    }
  }
  
  // Sort by score descending
  quarterRows.sort((a, b) => b.score - a.score);
  
  // Update ranks
  for (let i = 0; i < quarterRows.length; i++) {
    sheet.getRange(quarterRows[i].row, rankCol + 1).setValue(i + 1);
  }
}

function setupStocksSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.STOCKS);
  sheet.clear();
  
  // Note: Inventory columns are in UNITS, financial columns in DOLLARS
  const headers = [
    "Quarter", "Firm_ID", "Timestamp",
    "Cash", "Accounts_Receivable",          // Dollars
    "Raw_Material_Units", "FG_Units",       // UNITS (not dollars!)
    "In_Transit_Units",                     // UNITS
    "Fixed_Assets", "Accounts_Payable",     // Dollars
    "Short_Term_Debt", "Long_Term_Debt",    // Dollars
    "Capacity_Units",                       // Units
    "CSI", "Market_Share", 
    "Cumulative_Revenue", "Cumulative_Profit",
    "Orders_In_Transit",                    // UNITS
    "Retailer_Inventory",                   // UNITS - retailer's stock of our product
    "Retailer_Mode",                        // "NORMAL", "PANIC", or "CLEARANCE"
    "Customers_Loyal",                      // Customer pool - loyal customers
    "Customers_InPlay",                     // Customer pool - open to switching
    "Prev_Price_P1",                        // Previous quarter price (for churn calc)
    "Active_Event",                         // Current event affecting this firm
    // Perfect Order components
    "PO_OnTime",                            // On-time delivery rate
    "PO_InFull",                            // In-full (complete) rate
    "PO_DamageFree",                        // Damage-free rate
    "PO_Documentation",                     // Correct documentation rate
    "Perfect_Order",                        // Overall Perfect Order %
    // Technology investments (comma-separated list of owned systems)
    "Tech_Owned",                           // e.g., "ERP,WMS,OMS"
    "Tech_Maintenance_Cost",                // Quarterly maintenance expense
    // === ADVANCED: Capacity Expansion ===
    "Expansion_InProgress",                 // JSON: [{type, completesQ}]
    "Additional_Capacity",                  // Units added from expansions
    "Expansion_Maintenance",                // Quarterly maintenance for expansions
    // === ADVANCED: Regional DCs ===
    "DC_East_Open",                         // Always FALSE (R1 served by Factory)
    "DC_East_Inventory",                    // Always 0 (R1 served by Factory)
    "DC_Central_Open",                      // TRUE/FALSE - R2 Central DC
    "DC_Central_Inventory",                 // Units at R2 Central DC
    "DC_West_Open",                         // TRUE/FALSE - R3 West DC
    "DC_West_Inventory",                    // Units at R3 West DC
    "DC_Total_Opex",                        // Total DC operating costs this quarter
    // === ADVANCED: Green Score ===
    "Green_Score",                          // Sustainability score (0-100)
    "Disposal_Method",                      // LANDFILL, RECYCLE, or REFURBISH
    // === ADVANCED: VMI ===
    "VMI_Active"                            // TRUE/FALSE - VMI enabled with retailer
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
}

function setupDatabaseSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.DATABASE);
  sheet.clear();
  
  const headers = [
    "Quarter", "Firm_ID", "Timestamp",
    "D_Order_Global", "D_Order_Regional", "D_Production_P1", "D_Production_P2", "D_Shifts",
    "D_Price_P1", "D_Price_P2", "D_Marketing_Budget",
    "O_Units_Produced", "O_Units_Sold", "O_Revenue", "O_COGS", "O_Labor_Cost",
    "O_Gross_Margin", "O_Net_Income", "O_Fill_Rate", "O_CSI"
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
}

function setupCockpitSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.COCKPIT);
  sheet.clear();
  
  // Check if Analytics Mode is enabled (simplified cockpit)
  const analyticsMode = isAnalyticsMode_(ss);
  
  // Check which advanced modules are enabled (ignored in Analytics Mode)
  const capacityEnabled = !analyticsMode && isAdvancedModuleEnabled_(ss, "Capacity Expansion");
  const regionalDCsEnabled = !analyticsMode && isAdvancedModuleEnabled_(ss, "Regional DCs");
  const multiCarrierEnabled = !analyticsMode && isAdvancedModuleEnabled_(ss, "Multi-Carrier Selection");
  
  const allData = [];
  
  if (analyticsMode) {
    allData.push(["DECISION COCKPIT - ANALYTICS EDITION", "", ""]);
    allData.push(["Simplified interface for analytics-focused courses", "", ""]);
  } else {
    allData.push(["DECISION COCKPIT", "", ""]);
    allData.push(["Enter decisions in yellow cells, then Process Quarter", "", ""]);
  }
  allData.push(["", "", ""]);
  
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  
  // Track input cell positions for highlighting
  const inputCells = [];  // [{row, col, color}]
  const validationCells = {
    quality: [],
    shipping: [],
    yesNo: [],
    expansion: [],
    dcStatus: [],       // YES/NO/CLOSE
    dcAllocation: [],
    transferDest: [],   // NONE/WEST/CENTRAL/FACTORY
    carrier: [],
    warrantyTier: [],
    disposalMethod: []
  };
  
  // Track firm header rows for formatting
  const firmHeaderRows = [];
  
  for (let f = 1; f <= numFirms; f++) {
    const firmStartRow = allData.length + 1;
    firmHeaderRows.push(firmStartRow);  // Track for coloring
    
    allData.push([`FIRM ${f} DECISIONS`, "", ""]);
    allData.push(["", "", ""]);
    
    // DEMAND FORECAST
    allData.push(["DEMAND FORECAST (Your Prediction)", "", ""]);
    inputCells.push({row: allData.length + 1, color: "#fff2cc"});
    // In Analytics Mode, forecasts start blank to force entry
    const forecastDefault = analyticsMode ? "" : 80000;
    const forecastDefaultR2 = analyticsMode ? "" : 70000;
    const forecastDefaultR3 = analyticsMode ? "" : 50000;
    allData.push(["Forecast R1 (units)", forecastDefault, "R1 East (Factory region)"]);
    inputCells.push({row: allData.length + 1, color: "#fff2cc"});
    allData.push(["Forecast R2 (units)", forecastDefaultR2, "R2 Central"]);
    inputCells.push({row: allData.length + 1, color: "#fff2cc"});
    allData.push(["Forecast R3 (units)", forecastDefaultR3, "R3 West"]);
    // Forecast Method toggle (for Analytics Mode tracking)
    const forecastMethodRow = allData.length + 1;
    inputCells.push({row: forecastMethodRow, color: "#d9ead3"});
    validationCells.forecastMethod = validationCells.forecastMethod || [];
    validationCells.forecastMethod.push(forecastMethodRow);
    allData.push(["Forecast Method", "GUT", "GUT = intuition, MODEL = analytics-based"]);
    allData.push(["", "", ""]);
    
    // PROCUREMENT / SUPPLIER SELECTION
    if (analyticsMode) {
      // Analytics Mode: Supplier selection (based on Supplier Analytics module)
      allData.push(["SUPPLIER SELECTION (Analytics)", "", ""]);
      
      // Primary Supplier dropdown
      const primarySupplierRow = allData.length + 1;
      inputCells.push({row: primarySupplierRow, color: "#d9ead3"});
      validationCells.supplier = validationCells.supplier || [];
      validationCells.supplier.push(primarySupplierRow);
      allData.push(["Primary Supplier", "SUP001", "SUP001-SUP006 (see Supplier Analytics data)"]);
      
      // Secondary Supplier dropdown
      const secondarySupplierRow = allData.length + 1;
      inputCells.push({row: secondarySupplierRow, color: "#d9ead3"});
      validationCells.supplierOptional = validationCells.supplierOptional || [];
      validationCells.supplierOptional.push(secondarySupplierRow);
      allData.push(["Secondary Supplier", "NONE", "NONE or SUP001-SUP006"]);
      
      // Allocation percentage
      const allocationRow = allData.length + 1;
      inputCells.push({row: allocationRow, color: "#fff2cc"});
      allData.push(["Primary Allocation %", 100, "50-100% (rest goes to secondary)"]);
      
      // Regional/Emergency orders
      inputCells.push({row: allData.length + 1, color: "#fff2cc"});
      allData.push(["Emergency Regional Order (units)", 0, "Same quarter, premium cost"]);
      
      allData.push(["", "", ""]);
    } else {
      // Standard Mode: Order quantities
      allData.push(["PROCUREMENT", "", ""]);
      inputCells.push({row: allData.length + 1, color: "#fff2cc"});
      allData.push(["Order from Global Supplier (units)", 600000, "1 quarter lead time"]);
      inputCells.push({row: allData.length + 1, color: "#fff2cc"});
      allData.push(["Order from Regional Supplier (units)", 0, "Same quarter, +15% cost"]);
      allData.push(["", "", ""]);
    }
    
    // PRODUCTION
    allData.push(["PRODUCTION", "", ""]);
    inputCells.push({row: allData.length + 1, color: "#fff2cc"});
    allData.push(["Production Target P1 (units)", 120000, ""]);
    inputCells.push({row: allData.length + 1, color: "#fff2cc"});
    allData.push(["Production Target P2 (units)", 80000, ""]);
    // Shifts - Skip in Analytics Mode (auto-calculated)
    if (!analyticsMode) {
      inputCells.push({row: allData.length + 1, color: "#fff2cc"});
      allData.push(["Shifts to Use (1-3)", 1, "Higher = higher cost"]);
    }
    allData.push(["", "", ""]);
    
    // PRICING
    allData.push(["PRICING", "", ""]);
    inputCells.push({row: allData.length + 1, color: "#fff2cc"});
    allData.push(["Price P1 ($)", 500, ""]);
    inputCells.push({row: allData.length + 1, color: "#fff2cc"});
    allData.push(["Price P2 ($)", 850, ""]);
    allData.push(["", "", ""]);
    
    // MARKETING
    allData.push(["MARKETING", "", ""]);
    inputCells.push({row: allData.length + 1, color: "#fff2cc"});
    allData.push(["Marketing Budget ($)", 5000000, ""]);
    
    // Customer Segment Allocation (Analytics Mode only)
    if (analyticsMode) {
      allData.push(["", "", ""]);
      allData.push(["CUSTOMER SEGMENT ALLOCATION", "", "(Must total 100%)"]);
      
      const champRow = allData.length + 1;
      inputCells.push({row: champRow, color: "#d9ead3"});
      allData.push(["Segment: Champions %", 25, "High value, loyal (from your RFM analysis)"]);
      
      const growthRow = allData.length + 1;
      inputCells.push({row: growthRow, color: "#d9ead3"});
      allData.push(["Segment: Growth %", 25, "Medium value, growing potential"]);
      
      const atRiskRow = allData.length + 1;
      inputCells.push({row: atRiskRow, color: "#d9ead3"});
      allData.push(["Segment: At-Risk %", 25, "Declining, needs attention"]);
      
      const otherRow = allData.length + 1;
      inputCells.push({row: otherRow, color: "#d9ead3"});
      allData.push(["Segment: Other %", 25, "Low value, occasional"]);
    }
    allData.push(["", "", ""]);
    
    // QUALITY CONTROL - Skip in Analytics Mode (auto: STANDARD)
    if (!analyticsMode) {
      allData.push(["QUALITY CONTROL", "", ""]);
      const qualityRow = allData.length + 1;
      inputCells.push({row: qualityRow, color: "#d9ead3"});
      validationCells.quality.push(qualityRow);
      allData.push(["Inspection Level", "BASIC", "NONE / BASIC / FULL"]);
      allData.push(["", "", ""]);
    }
    
    // LOGISTICS - Skip in Analytics Mode (auto: STANDARD)
    if (!analyticsMode) {
      allData.push(["LOGISTICS", "", ""]);
      const logisticsRow = allData.length + 1;
      inputCells.push({row: logisticsRow, color: "#fce5cd"});
      validationCells.shipping.push(logisticsRow);
      allData.push(["Shipping Mode", "STANDARD", "STANDARD / EXPRESS / AIR"]);
      allData.push(["", "", ""]);
    }
    
    // === NETWORK DESIGN (Analytics Mode) ===
    // Simplified DC selection based on Network Design analysis
    if (analyticsMode) {
      allData.push(["NETWORK DESIGN (Distribution)", "", ""]);
      allData.push(["Factory (R1 East)", "OPEN", "Serves R1 directly - no decision needed"]);
      
      // Central DC decision
      const centralDCRow = allData.length + 1;
      inputCells.push({row: centralDCRow, color: "#d9ead3"});
      validationCells.dcStatusAnalytics = validationCells.dcStatusAnalytics || [];
      validationCells.dcStatusAnalytics.push(centralDCRow);
      allData.push(["Open Central DC (Chicago)?", "NO", "Serves R2 - $4M setup, $700K/qtr, +3% service"]);
      
      // West DC decision
      const westDCRow = allData.length + 1;
      inputCells.push({row: westDCRow, color: "#d9ead3"});
      validationCells.dcStatusAnalytics.push(westDCRow);
      allData.push(["Open West DC (Los Angeles)?", "NO", "Serves R3 - $6M setup, $900K/qtr, +5% service"]);
      
      allData.push(["", "", ""]);
    }
    
    // === PRODUCT INNOVATION (Analytics Mode) ===
    // P3 launch based on conjoint analysis
    if (analyticsMode) {
      allData.push(["PRODUCT INNOVATION (P3 Launch)", "", ""]);
      
      // Launch P3 decision
      const launchP3Row = allData.length + 1;
      inputCells.push({row: launchP3Row, color: "#d9ead3"});
      validationCells.p3Launch = validationCells.p3Launch || [];
      validationCells.p3Launch.push(launchP3Row);
      allData.push(["Launch P3?", "NO", "$2M launch cost (from your conjoint analysis)"]);
      
      // P3 Configuration
      const p3ConfigRow = allData.length + 1;
      inputCells.push({row: p3ConfigRow, color: "#d9ead3"});
      validationCells.p3Config = validationCells.p3Config || [];
      validationCells.p3Config.push(p3ConfigRow);
      allData.push(["P3 Configuration", "STANDARD", "STANDARD (10in/12hr/128GB) or PREMIUM (12in/12hr/128GB/2yr)"]);
      
      // P3 Price
      const p3PriceRow = allData.length + 1;
      inputCells.push({row: p3PriceRow, color: "#fff2cc"});
      allData.push(["P3 Price ($)", 549, "Suggested: $549 (Standard) or $649 (Premium)"]);
      
      // P3 Production
      const p3ProdRow = allData.length + 1;
      inputCells.push({row: p3ProdRow, color: "#fff2cc"});
      allData.push(["P3 Production Target (units)", 0, "Set > 0 once launched"]);
      
      allData.push(["", "", ""]);
    }
    
    // === MARKET EXPANSION (Analytics Mode) ===
    // New regions based on Market Expansion analysis
    if (analyticsMode) {
      allData.push(["MARKET EXPANSION (New Regions)", "", ""]);
      
      // R4 Canada
      const r4Row = allData.length + 1;
      inputCells.push({row: r4Row, color: "#d9ead3"});
      validationCells.regionExpansion = validationCells.regionExpansion || [];
      validationCells.regionExpansion.push(r4Row);
      allData.push(["Enter R4 (Canada)?", "NO", "$1.5M entry, $200K/qtr, 80K market, LOW risk"]);
      
      // R4 Forecast (if entered)
      const r4ForecastRow = allData.length + 1;
      inputCells.push({row: r4ForecastRow, color: "#fff2cc"});
      allData.push(["Forecast R4 (units)", 0, "Set > 0 once entered"]);
      
      // R5 EU
      const r5Row = allData.length + 1;
      inputCells.push({row: r5Row, color: "#d9ead3"});
      validationCells.regionExpansion.push(r5Row);
      allData.push(["Enter R5 (EU/Germany)?", "NO", "$3M entry, $400K/qtr, 150K market, MEDIUM risk"]);
      
      // R5 Forecast
      const r5ForecastRow = allData.length + 1;
      inputCells.push({row: r5ForecastRow, color: "#fff2cc"});
      allData.push(["Forecast R5 (units)", 0, "Set > 0 once entered"]);
      
      // R6 APAC
      const r6Row = allData.length + 1;
      inputCells.push({row: r6Row, color: "#d9ead3"});
      validationCells.regionExpansion.push(r6Row);
      allData.push(["Enter R6 (APAC/Japan)?", "NO", "$5M entry, $600K/qtr, 200K market, HIGH risk"]);
      
      // R6 Forecast
      const r6ForecastRow = allData.length + 1;
      inputCells.push({row: r6ForecastRow, color: "#fff2cc"});
      allData.push(["Forecast R6 (units)", 0, "Set > 0 once entered"]);
      
      allData.push(["", "", ""]);
    }
    
    // === ADVANCED: CAPACITY EXPANSION ===
    if (capacityEnabled) {
      allData.push(["CAPACITY EXPANSION", "", "⚙️ ADVANCED MODULE"]);
      allData.push(["Current Capacity (units/qtr)", "=750000", "Base: 250K × 3 shifts"]);
      
      const smallRow = allData.length + 1;
      inputCells.push({row: smallRow, color: "#e6d9f2"});
      validationCells.expansion.push(smallRow);
      allData.push(["Build Small Line ($8M, +50K)", "NO", "Available next quarter"]);
      
      const medRow = allData.length + 1;
      inputCells.push({row: medRow, color: "#e6d9f2"});
      validationCells.expansion.push(medRow);
      allData.push(["Build Medium Line ($15M, +100K)", "NO", "Available in 2 quarters"]);
      
      const largeRow = allData.length + 1;
      inputCells.push({row: largeRow, color: "#e6d9f2"});
      validationCells.expansion.push(largeRow);
      allData.push(["Build Large Line ($25M, +200K)", "NO", "Available in 3 quarters"]);
      
      allData.push(["Lines Under Construction", "0", "Pending capacity additions"]);
      allData.push(["", "", ""]);
    }
    
    // === ADVANCED: REGIONAL DCs ===
    if (regionalDCsEnabled) {
      allData.push(["REGIONAL DISTRIBUTION CENTERS", "", "⚙️ ADVANCED MODULE"]);
      allData.push(["", "Status", "Allocate Units"]);
      allData.push(["R1 (East)", "FACTORY", "Factory serves R1 directly"]);
      
      // R2 Central DC
      const centralOpenRow = allData.length + 1;
      inputCells.push({row: centralOpenRow, color: "#d9ead3"});
      validationCells.dcStatus.push(centralOpenRow);
      allData.push(["R2 Central DC (Chicago) - $4M setup, $700K/qtr", "NO", 0]);
      inputCells.push({row: centralOpenRow, color: "#fff2cc", col: 3});
      validationCells.dcAllocation.push({row: centralOpenRow, col: 3});
      
      // R3 West DC
      const westOpenRow = allData.length + 1;
      inputCells.push({row: westOpenRow, color: "#d9ead3"});
      validationCells.dcStatus.push(westOpenRow);
      allData.push(["R3 West DC (LA) - $6M setup, $900K/qtr", "NO", 0]);
      inputCells.push({row: westOpenRow, color: "#fff2cc", col: 3});
      validationCells.dcAllocation.push({row: westOpenRow, col: 3});
      
      allData.push(["", "", ""]);
      allData.push(["DC STATUS OPTIONS:", "", ""]);
      allData.push(["NO", "", "DC not open"]);
      allData.push(["YES", "", "Open DC (pay setup if new)"]);
      allData.push(["CLOSE", "", "Close DC, get 25% of setup back"]);
      
      allData.push(["", "", ""]);
      allData.push(["Total DC Operating Cost", "$0", "Sum of open DC costs"]);
      allData.push(["", "", ""]);
      
      // INVENTORY TRANSFERS
      allData.push(["INVENTORY TRANSFERS", "", "Rebalance stock between locations"]);
      allData.push(["", "Units", "Destination"]);
      
      const transferCentralRow = allData.length + 1;
      inputCells.push({row: transferCentralRow, color: "#fff2cc"});
      inputCells.push({row: transferCentralRow, color: "#d9ead3", col: 3});
      validationCells.transferDest.push(transferCentralRow);
      allData.push(["Transfer FROM Central DC", 0, "NONE"]);
      
      const transferWestRow = allData.length + 1;
      inputCells.push({row: transferWestRow, color: "#fff2cc"});
      inputCells.push({row: transferWestRow, color: "#d9ead3", col: 3});
      validationCells.transferDest.push(transferWestRow);
      allData.push(["Transfer FROM West DC", 0, "NONE"]);
      
      allData.push(["", "", ""]);
      allData.push(["TRANSFER COSTS:", "", ""]);
      allData.push(["DC → DC (lateral)", "$5/unit", "Central ↔ West"]);
      allData.push(["DC → Factory", "$4/unit", "Return to R1"]);
      allData.push(["", "", ""]);
      
      // WARRANTY PROGRAM
      allData.push(["WARRANTY PROGRAM", "", "⚙️ ADVANCED MODULE"]);
      allData.push(["", "Price/Unit", "Coverage"]);
      
      const warrantyTierRow = allData.length + 1;
      inputCells.push({row: warrantyTierRow, color: "#fce5cd"});
      validationCells.warrantyTier.push(warrantyTierRow);
      allData.push(["Warranty Tier", "STANDARD", "Select coverage level"]);
      
      allData.push(["", "", ""]);
      allData.push(["TIER OPTIONS:", "", ""]);
      allData.push(["NONE", "$0.00", "No warranty (CSI penalty)"]);
      allData.push(["BASIC", "$1.50", "Parts shipped, DIY install"]);
      allData.push(["STANDARD", "$2.10", "Parts + service visit"]);
      allData.push(["PREMIUM", "$3.00", "Parts + priority service"]);
      allData.push(["", "", ""]);
      
      // WARRANTY NETWORK (requires DC to be open)
      allData.push(["WARRANTY SERVICE NETWORK", "", "In-house reduces cost"]);
      
      const centralWarrantyRow = allData.length + 1;
      inputCells.push({row: centralWarrantyRow, color: "#d9ead3"});
      validationCells.yesNo.push(centralWarrantyRow);
      allData.push(["Central DC Warranty Network", "NO", "$500K setup, $100K/qtr"]);
      
      const westWarrantyRow = allData.length + 1;
      inputCells.push({row: westWarrantyRow, color: "#d9ead3"});
      validationCells.yesNo.push(westWarrantyRow);
      allData.push(["West DC Warranty Network", "NO", "$500K setup, $100K/qtr"]);
      
      allData.push(["", "", ""]);
      allData.push(["SERVICE COSTS:", "", ""]);
      allData.push(["Third-party (R1/R2/R3)", "$75/$150/$175", "Per visit"]);
      allData.push(["In-house (with network)", "$50", "Per visit"]);
      allData.push(["", "", ""]);
      
      // GREEN SCORE (SUSTAINABILITY)
      allData.push(["SUSTAINABILITY & GREEN SCORE", "", "⚙️ ADVANCED MODULE"]);
      allData.push(["", "Cost", "Recovery"]);
      
      const disposalRow = allData.length + 1;
      inputCells.push({row: disposalRow, color: "#b6d7a8"});
      validationCells.disposalMethod.push(disposalRow);
      allData.push(["Disposal Method", "RECYCLE", "How to handle defective returns"]);
      
      const ecoPackRow = allData.length + 1;
      inputCells.push({row: ecoPackRow, color: "#b6d7a8"});
      validationCells.yesNo.push(ecoPackRow);
      allData.push(["Eco Packaging", "NO", "+$0.50/unit, +1 Green Score"]);
      
      allData.push(["", "", ""]);
      allData.push(["DISPOSAL OPTIONS:", "", ""]);
      allData.push(["LANDFILL", "$5/unit", "$0 (cheapest, -2 score)"]);
      allData.push(["RECYCLE", "$15/unit", "$0 (responsible, +1 score)"]);
      allData.push(["REFURBISH", "$25/unit", "$40 recovery (+2 score)"]);
      allData.push(["", "", ""]);
      allData.push(["Current Green Score", "50", "Range: 0-100"]);
      allData.push(["", "", ""]);
    }
    
    // === ADVANCED: MULTI-CARRIER SELECTION ===
    if (multiCarrierEnabled) {
      allData.push(["SHIPPING MODE SELECTION", "", "⚙️ ADVANCED MODULE"]);
      allData.push(["", "Cost/Unit", "On-Time %"]);
      
      const carrierRow = allData.length + 1;
      inputCells.push({row: carrierRow, color: "#fce5cd"});
      validationCells.carrier.push(carrierRow);
      allData.push(["Select Mode", "TRUCK", "Factory → DC shipping"]);
      
      allData.push(["", "", ""]);
      allData.push(["MODE OPTIONS (to DC):", "", ""]);
      allData.push(["INTERMODAL", "$1.50", "80% (rail+truck)"]);
      allData.push(["TRUCK", "$3.50", "93% (-5% over 75K)"]);
      allData.push(["AIR", "$12.00", "100% (guaranteed)"]);
      allData.push(["", "", ""]);
      allData.push(["Last Mile (DC → Customer)", "$2.50", "Parcel delivery"]);
      allData.push(["⚠️ No DC open = Forced Air ($12)", "", ""]);
      allData.push(["", "", ""]);
    }
    
    // === ADVANCED: INTELLIGENCE CENTER ===
    const intelligenceEnabled = !analyticsMode && isAdvancedModuleEnabled_(ss, "Intelligence Center");
    if (intelligenceEnabled) {
      allData.push(["INTELLIGENCE CENTER", "", "⚙️ ADVANCED MODULE"]);
      allData.push(["", "Subscribe?", "Cost/Qtr"]);
      
      // Free reports
      allData.push(["Market Trends Report", "FREE", "$0"]);
      allData.push(["Competitor Pricing Report", "FREE", "$0"]);
      
      // Paid reports
      const regionalDemandRow = allData.length + 1;
      inputCells.push({row: regionalDemandRow, color: "#d9ead3"});
      validationCells.yesNo.push(regionalDemandRow);
      allData.push(["Regional Demand Analysis", "NO", "$50K"]);
      
      const retailChannelRow = allData.length + 1;
      inputCells.push({row: retailChannelRow, color: "#d9ead3"});
      validationCells.yesNo.push(retailChannelRow);
      allData.push(["Retail Channel Intelligence", "NO", "$50K"]);
      
      const competitorCapacityRow = allData.length + 1;
      inputCells.push({row: competitorCapacityRow, color: "#d9ead3"});
      validationCells.yesNo.push(competitorCapacityRow);
      allData.push(["Competitor Capacity Intel", "NO", "$100K"]);
      
      const supplierRiskRow = allData.length + 1;
      inputCells.push({row: supplierRiskRow, color: "#d9ead3"});
      validationCells.yesNo.push(supplierRiskRow);
      allData.push(["Supplier Risk Monitor", "NO", "$75K"]);
      
      const customerSentimentRow = allData.length + 1;
      inputCells.push({row: customerSentimentRow, color: "#d9ead3"});
      validationCells.yesNo.push(customerSentimentRow);
      allData.push(["Customer Sentiment Tracker", "NO", "$75K"]);
      
      allData.push(["", "", ""]);
      allData.push(["Total Subscription Cost", "$0/qtr", "Sum of selected reports"]);
      allData.push(["", "", ""]);
    }
    
    // === ADVANCED: VMI (Vendor Managed Inventory) ===
    const vmiEnabled = !analyticsMode && isAdvancedModuleEnabled_(ss, "VMI (Vendor Managed Inventory)");
    if (vmiEnabled) {
      allData.push(["VMI (VENDOR MANAGED INVENTORY)", "", "⚙️ ADVANCED MODULE"]);
      
      const vmiRow = allData.length + 1;
      inputCells.push({row: vmiRow, color: "#d9ead3"});
      validationCells.yesNo.push(vmiRow);
      allData.push(["Enable VMI with Retailer", "NO", "Collaborative inventory management"]);
      
      allData.push(["", "", ""]);
      allData.push(["VMI COSTS:", "", ""]);
      allData.push(["Setup Cost", "$2M", "One-time (IT integration, training)"]);
      allData.push(["Ongoing Cost", "$100K/qtr", "Data sharing, coordination"]);
      allData.push(["", "", ""]);
      allData.push(["VMI BENEFITS:", "", ""]);
      allData.push(["• Smoother retailer orders", "", "Less bullwhip effect"]);
      allData.push(["• Fewer PANIC episodes", "", "Retailer stays NORMAL longer"]);
      allData.push(["• Better demand visibility", "", "Shared POS data"]);
      allData.push(["", "", ""]);
    }
    
    // TECHNOLOGY INVESTMENTS - Skip in Analytics Mode
    if (!analyticsMode) {
      allData.push(["TECHNOLOGY INVESTMENTS", "", ""]);
      const techStart = allData.length + 1;
      inputCells.push({row: techStart, color: "#cfe2f3"});
      validationCells.yesNo.push(techStart);
      allData.push(["Purchase ERP ($2M)", "NO", "Visibility: -5% holding cost"]);
      inputCells.push({row: allData.length + 1, color: "#cfe2f3"});
      validationCells.yesNo.push(allData.length + 1);
      allData.push(["Purchase Control Tower ($4M)", "NO", "Visibility: +3% on-time, -10% event impact"]);
      inputCells.push({row: allData.length + 1, color: "#cfe2f3"});
      validationCells.yesNo.push(allData.length + 1);
      allData.push(["Purchase APS ($3M)", "NO", "Planning: +5% effective capacity"]);
      inputCells.push({row: allData.length + 1, color: "#cfe2f3"});
      validationCells.yesNo.push(allData.length + 1);
      allData.push(["Purchase Demand Sensing ($2.5M)", "NO", "Planning: -10% forecast error"]);
      inputCells.push({row: allData.length + 1, color: "#cfe2f3"});
      validationCells.yesNo.push(allData.length + 1);
      allData.push(["Purchase WMS ($1.5M)", "NO", "Execution: -10% holding cost"]);
      inputCells.push({row: allData.length + 1, color: "#cfe2f3"});
      validationCells.yesNo.push(allData.length + 1);
      allData.push(["Purchase TMS ($1.5M)", "NO", "Execution: -8% freight cost"]);
      inputCells.push({row: allData.length + 1, color: "#cfe2f3"});
      validationCells.yesNo.push(allData.length + 1);
      allData.push(["Purchase OMS ($1M)", "NO", "Execution: +5% Perfect Order"]);
      inputCells.push({row: allData.length + 1, color: "#cfe2f3"});
      validationCells.yesNo.push(allData.length + 1);
      allData.push(["Purchase Analytics ($1M)", "NO", "Analytics: Detailed KPI tracking"]);
      allData.push(["", "", ""]);
    }
  }
  
  sheet.getRange(1, 1, allData.length, 3).setValues(allData);
  sheet.getRange(1, 1).setFontSize(14).setFontWeight("bold");
  
  // Apply highlighting
  inputCells.forEach(cell => {
    const col = cell.col || 2;
    sheet.getRange(cell.row, col).setBackground(cell.color);
  });
  
  // Color firm header rows for easy identification
  const firmColors = ["#4a86e8", "#6aa84f", "#e69138"];  // Blue, Green, Orange
  firmHeaderRows.forEach((row, index) => {
    const color = firmColors[index % firmColors.length];
    sheet.getRange(row, 1, 1, 3)
      .setBackground(color)
      .setFontColor("white")
      .setFontWeight("bold")
      .setFontSize(12);
  });
  
  // Data validations
  const qualityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['NONE', 'BASIC', 'FULL'], true)
    .build();
  validationCells.quality.forEach(row => {
    sheet.getRange(row, 2).setDataValidation(qualityRule);
  });
  
  const shippingRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['STANDARD', 'EXPRESS', 'AIR'], true)
    .build();
  validationCells.shipping.forEach(row => {
    sheet.getRange(row, 2).setDataValidation(shippingRule);
  });
  
  const yesNoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['YES', 'NO'], true)
    .build();
  validationCells.yesNo.forEach(row => {
    sheet.getRange(row, 2).setDataValidation(yesNoRule);
  });
  
  // Forecast Method validation (GUT/MODEL)
  const forecastMethodRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['GUT', 'MODEL'], true)
    .build();
  if (validationCells.forecastMethod) {
    validationCells.forecastMethod.forEach(row => {
      sheet.getRange(row, 2).setDataValidation(forecastMethodRule);
    });
  }
  
  // Supplier Selection validation (Analytics Mode)
  if (validationCells.supplier && validationCells.supplier.length > 0) {
    const supplierRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['SUP001', 'SUP002', 'SUP003', 'SUP004', 'SUP005', 'SUP006'], true)
      .setHelpText('Select primary supplier (SUP001-SUP006)')
      .build();
    validationCells.supplier.forEach(row => {
      sheet.getRange(row, 2).setDataValidation(supplierRule);
    });
  }
  
  if (validationCells.supplierOptional && validationCells.supplierOptional.length > 0) {
    const supplierOptionalRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['NONE', 'SUP001', 'SUP002', 'SUP003', 'SUP004', 'SUP005', 'SUP006'], true)
      .setHelpText('Select secondary supplier or NONE')
      .build();
    validationCells.supplierOptional.forEach(row => {
      sheet.getRange(row, 2).setDataValidation(supplierOptionalRule);
    });
  }
  
  // Advanced module validations
  if (capacityEnabled) {
    validationCells.expansion.forEach(row => {
      sheet.getRange(row, 2).setDataValidation(yesNoRule);
    });
  }
  
  // DC Status validation for Analytics Mode (simplified YES/NO)
  if (validationCells.dcStatusAnalytics && validationCells.dcStatusAnalytics.length > 0) {
    validationCells.dcStatusAnalytics.forEach(row => {
      sheet.getRange(row, 2).setDataValidation(yesNoRule);
    });
  }
  
  // P3 Launch validation (YES/NO)
  if (validationCells.p3Launch && validationCells.p3Launch.length > 0) {
    validationCells.p3Launch.forEach(row => {
      sheet.getRange(row, 2).setDataValidation(yesNoRule);
    });
  }
  
  // P3 Configuration validation (STANDARD/PREMIUM)
  if (validationCells.p3Config && validationCells.p3Config.length > 0) {
    const p3ConfigRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['STANDARD', 'PREMIUM'], true)
      .build();
    validationCells.p3Config.forEach(row => {
      sheet.getRange(row, 2).setDataValidation(p3ConfigRule);
    });
  }
  
  // Region Expansion validation (YES/NO)
  if (validationCells.regionExpansion && validationCells.regionExpansion.length > 0) {
    validationCells.regionExpansion.forEach(row => {
      sheet.getRange(row, 2).setDataValidation(yesNoRule);
    });
  }
  
  if (regionalDCsEnabled) {
    // DC Status validation (YES/NO/CLOSE)
    const dcStatusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['NO', 'YES', 'CLOSE'], true)
      .build();
    validationCells.dcStatus.forEach(row => {
      sheet.getRange(row, 2).setDataValidation(dcStatusRule);
    });
    
    // Transfer destination validation
    const transferDestCentralRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['NONE', 'WEST', 'FACTORY'], true)
      .build();
    const transferDestWestRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['NONE', 'CENTRAL', 'FACTORY'], true)
      .build();
    // First transfer row is Central (can go to West or Factory)
    // Second transfer row is West (can go to Central or Factory)
    if (validationCells.transferDest.length >= 2) {
      sheet.getRange(validationCells.transferDest[0], 3).setDataValidation(transferDestCentralRule);
      sheet.getRange(validationCells.transferDest[1], 3).setDataValidation(transferDestWestRule);
    }
  }
  
  // Multi-Carrier validation
  if (multiCarrierEnabled) {
    const carrierRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['INTERMODAL', 'TRUCK', 'AIR'], true)
      .build();
    validationCells.carrier.forEach(row => {
      sheet.getRange(row, 2).setDataValidation(carrierRule);
    });
  }
  
  // Warranty tier validation
  if (regionalDCsEnabled) {
    const warrantyTierRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['NONE', 'BASIC', 'STANDARD', 'PREMIUM'], true)
      .build();
    validationCells.warrantyTier.forEach(row => {
      sheet.getRange(row, 2).setDataValidation(warrantyTierRule);
    });
    
    // Disposal method validation
    const disposalMethodRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['LANDFILL', 'RECYCLE', 'REFURBISH'], true)
      .build();
    validationCells.disposalMethod.forEach(row => {
      sheet.getRange(row, 2).setDataValidation(disposalMethodRule);
    });
  }
  
  // Column widths
  sheet.setColumnWidth(1, 280);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 250);
}

/**
 * Update cockpit informational cells after quarter processing
 * Updates: Lines Under Construction, Current Capacity, Total DC Operating Cost
 */
function updateCockpitInfo_(ss, quarter, results) {
  const sheet = ss.getSheetByName(CONFIG.sheets.COCKPIT);
  if (!sheet) return;
  
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  if (!stocksSheet) return;
  
  const stockData = stocksSheet.getDataRange().getValues();
  const headers = stockData[0];
  
  // Find column indices
  const qCol = headers.indexOf("Quarter");
  const firmCol = headers.indexOf("Firm_ID");
  const expansionCol = headers.indexOf("Expansion_InProgress");
  const additionalCapCol = headers.indexOf("Additional_Capacity");
  const dcEastCol = headers.indexOf("DC_East_Open");
  const dcCentralCol = headers.indexOf("DC_Central_Open");
  const dcWestCol = headers.indexOf("DC_West_Open");
  const dcOpexCol = headers.indexOf("DC_Total_Opex");
  
  const cockpitData = sheet.getDataRange().getValues();
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  
  const DC = CONFIG.regionalDCs;
  
  for (let f = 1; f <= numFirms; f++) {
    // Find firm's latest state from Stocks
    let firmState = null;
    for (let i = stockData.length - 1; i >= 1; i--) {
      if (stockData[i][qCol] === quarter && stockData[i][firmCol] === f) {
        firmState = stockData[i];
        break;
      }
    }
    
    if (!firmState) continue;
    
    // Find this firm's section in cockpit
    let firmStartRow = -1;
    for (let i = 0; i < cockpitData.length; i++) {
      const cell = String(cockpitData[i][0] || "").toUpperCase();
      if (cell.includes(`FIRM ${f} DECISIONS`)) {
        firmStartRow = i;
        break;
      }
    }
    
    if (firmStartRow === -1) continue;
    
    // Search for info rows within firm's section
    for (let i = firmStartRow; i < cockpitData.length && i < firmStartRow + 60; i++) {
      const label = String(cockpitData[i][0] || "").toLowerCase();
      
      // Update Lines Under Construction
      if (label.includes("lines under construction")) {
        let inProgress = [];
        try {
          inProgress = JSON.parse(firmState[expansionCol] || "[]");
        } catch (e) {}
        sheet.getRange(i + 1, 2).setValue(inProgress.length);
      }
      
      // Update Current Capacity
      else if (label.includes("current capacity")) {
        const baseCapacity = CONFIG.production.BASE_CAPACITY_PER_SHIFT * 3;
        const additionalCap = firmState[additionalCapCol] || 0;
        sheet.getRange(i + 1, 2).setValue(baseCapacity + additionalCap);
      }
      
      // Update Total DC Operating Cost (R2 Central + R3 West only, R1 served by Factory)
      else if (label.includes("total dc operating cost")) {
        let totalOpex = 0;
        if (firmState[dcCentralCol] === true || firmState[dcCentralCol] === "TRUE") {
          totalOpex += DC.DCS.CENTRAL.quarterlyOpex;
        }
        if (firmState[dcWestCol] === true || firmState[dcWestCol] === "TRUE") {
          totalOpex += DC.DCS.WEST.quarterlyOpex;
        }
        sheet.getRange(i + 1, 2).setValue(`$${(totalOpex / 1000).toFixed(0)}K`);
      }
    }
  }
}

function setupReportSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.REPORT);
  sheet.clear();
  
  const data = [
    ["10-Q QUARTERLY REPORT - FIRM 1", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["INCOME STATEMENT", "Q1", "Q2", "Q3", "Q4", "YTD"],
    ["Net Revenue", 0, 0, 0, 0, 0],
    ["Cost of Goods Sold", 0, 0, 0, 0, 0],
    ["Gross Margin", 0, 0, 0, 0, 0],
    ["", "", "", "", "", ""],
    ["OPERATING EXPENSES", "", "", "", "", ""],
    ["Labor Costs", 0, 0, 0, 0, 0],
    ["Holding Costs", 0, 0, 0, 0, 0],
    ["Marketing Expense", 0, 0, 0, 0, 0],
    ["Technology Maintenance", 0, 0, 0, 0, 0],
    ["Quality Costs", 0, 0, 0, 0, 0],
    ["Freight Costs", 0, 0, 0, 0, 0],
    ["Total OPEX", 0, 0, 0, 0, 0],
    ["", "", "", "", "", ""],
    ["Operating Income", 0, 0, 0, 0, 0],
    ["Interest Expense", 0, 0, 0, 0, 0],
    ["Net Income", 0, 0, 0, 0, 0],
    ["", "", "", "", "", ""],
    ["CASH FLOW STATEMENT", "Q1", "Q2", "Q3", "Q4", "YTD"],
    ["Operating Activities:", "", "", "", "", ""],
    ["  Net Income", 0, 0, 0, 0, 0],
    ["  Depreciation", 0, 0, 0, 0, 0],
    ["  Working Capital Changes", 0, 0, 0, 0, 0],
    ["Cash from Operations", 0, 0, 0, 0, 0],
    ["", "", "", "", "", ""],
    ["Investing Activities:", "", "", "", "", ""],
    ["  Technology Purchases", 0, 0, 0, 0, 0],
    ["Cash from Investing", 0, 0, 0, 0, 0],
    ["", "", "", "", "", ""],
    ["Financing Activities:", "", "", "", "", ""],
    ["  Net Borrowing/(Repayment)", 0, 0, 0, 0, 0],
    ["Cash from Financing", 0, 0, 0, 0, 0],
    ["", "", "", "", "", ""],
    ["Net Change in Cash", 0, 0, 0, 0, 0],
    ["Beginning Cash", 0, 0, 0, 0, 0],
    ["Ending Cash", 0, 0, 0, 0, 0],
    ["", "", "", "", "", ""],
    ["BALANCE SHEET", "Q1", "Q2", "Q3", "Q4", "Current"],
    ["Assets:", "", "", "", "", ""],
    ["  Cash", 0, 0, 0, 0, 0],
    ["  Accounts Receivable", 0, 0, 0, 0, 0],
    ["  Inventory Value ($)", 0, 0, 0, 0, 0],
    ["Total Current Assets", 0, 0, 0, 0, 0],
    ["Fixed Assets", 0, 0, 0, 0, 0],
    ["Total Assets", 0, 0, 0, 0, 0],
    ["", "", "", "", "", ""],
    ["Liabilities:", "", "", "", "", ""],
    ["  Accounts Payable", 0, 0, 0, 0, 0],
    ["  Short-Term Debt", 0, 0, 0, 0, 0],
    ["  Long-Term Debt", 0, 0, 0, 0, 0],
    ["Total Liabilities", 0, 0, 0, 0, 0],
    ["Shareholders' Equity", 0, 0, 0, 0, 0],
    ["Total Liab + Equity", 0, 0, 0, 0, 0],
    ["", "", "", "", "", ""],
    ["INVENTORY REPORT", "Q1", "Q2", "Q3", "Q4", "Current"],
    ["Raw Materials:", "", "", "", "", ""],
    ["  Units", 0, 0, 0, 0, 0],
    ["  Value ($)", 0, 0, 0, 0, 0],
    ["  Days of Supply", 0, 0, 0, 0, 0],
    ["Finished Goods:", "", "", "", "", ""],
    ["  Units", 0, 0, 0, 0, 0],
    ["  Value ($)", 0, 0, 0, 0, 0],
    ["  Days of Supply", 0, 0, 0, 0, 0],
    ["In-Transit Units", 0, 0, 0, 0, 0],
    ["Retailer Inventory", 0, 0, 0, 0, 0],
    ["", "", "", "", "", ""],
    ["Total Pipeline (units)", 0, 0, 0, 0, 0],
    ["Total Inventory Value", 0, 0, 0, 0, 0],
    ["Inventory Turnover", 0, 0, 0, 0, 0],
    ["Weeks of Supply", 0, 0, 0, 0, 0],
    ["", "", "", "", "", ""],
    ["KEY METRICS", "Q1", "Q2", "Q3", "Q4", "YTD"],
    ["Units Produced", 0, 0, 0, 0, 0],
    ["Units Sold", 0, 0, 0, 0, 0],
    ["Fill Rate", "0%", "0%", "0%", "0%", "0%"],
    ["CSI Score", 80, 80, 80, 80, 80],
    ["Market Share", "33%", "33%", "33%", "33%", "33%"],
    ["Perfect Order", "0%", "0%", "0%", "0%", "0%"],
    ["Forecast Accuracy", "0%", "0%", "0%", "0%", "0%"],
  ];
  
  sheet.getRange(1, 1, data.length, 6).setValues(data);
  
  // Formatting
  sheet.getRange(1, 1).setFontSize(14).setFontWeight("bold");
  sheet.getRange(3, 1, 1, 6).setFontWeight("bold").setBackground("#c9daf8");   // Income Statement - blue
  sheet.getRange(8, 1).setFontWeight("bold");  // OPEX header
  sheet.getRange(21, 1, 1, 6).setFontWeight("bold").setBackground("#d9ead3");  // Cash Flow - green
  sheet.getRange(40, 1, 1, 6).setFontWeight("bold").setBackground("#fff2cc");  // Balance Sheet - yellow
  sheet.getRange(57, 1, 1, 6).setFontWeight("bold").setBackground("#d5a6bd");  // Inventory Report - purple
  sheet.getRange(74, 1, 1, 6).setFontWeight("bold").setBackground("#e6b8af");  // Key Metrics - salmon
  
  // Sub-headers
  sheet.getRange(58, 1).setFontWeight("bold");  // Raw Materials
  sheet.getRange(62, 1).setFontWeight("bold");  // Finished Goods
  
  // Column widths
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 100);
  
  // Number formatting
  sheet.getRange(4, 2, 16, 5).setNumberFormat("$#,##0");      // Income Statement
  sheet.getRange(23, 2, 16, 5).setNumberFormat("$#,##0");     // Cash Flow
  sheet.getRange(42, 2, 14, 5).setNumberFormat("$#,##0");     // Balance Sheet (all columns)
  
  // Inventory Report formatting
  sheet.getRange(59, 2, 1, 5).setNumberFormat("#,##0");       // RM units
  sheet.getRange(60, 2, 1, 5).setNumberFormat("$#,##0");      // RM value
  sheet.getRange(61, 2, 1, 5).setNumberFormat("#,##0");       // RM days of supply (plain number)
  sheet.getRange(63, 2, 1, 5).setNumberFormat("#,##0");       // FG units
  sheet.getRange(64, 2, 1, 5).setNumberFormat("$#,##0");      // FG value
  sheet.getRange(65, 2, 1, 5).setNumberFormat("#,##0");       // FG days of supply (plain number)
  sheet.getRange(66, 2, 2, 5).setNumberFormat("#,##0");       // In-transit, Retailer
  sheet.getRange(69, 2, 1, 5).setNumberFormat("#,##0");       // Total pipeline
  sheet.getRange(70, 2, 1, 5).setNumberFormat("$#,##0");      // Total inv value
  sheet.getRange(71, 2, 1, 5).setNumberFormat("0.0");         // Turnover (plain decimal)
  sheet.getRange(72, 2, 1, 5).setNumberFormat("0.0");         // Weeks of supply
}

function setupDashboardSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.DASHBOARD);
  sheet.clear();
  
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  
  const data = [
    ["FLEXEE 2.0 DASHBOARD", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["Current Quarter:", 0, "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["FIRM STANDINGS", "", "", "", "", "", "", ""],
    ["Firm", "Revenue", "Net Income", "Cash", "CSI", "Market Share", "Units Sold", "Green Score"],
  ];
  
  for (let f = 1; f <= numFirms; f++) {
    data.push([`Firm ${f}`, 0, 0, 0, 80, "33.3%", 0, 50]);
  }
  
  sheet.getRange(1, 1, data.length, 8).setValues(data);
  sheet.getRange(1, 1).setFontSize(16).setFontWeight("bold");
  sheet.getRange(5, 1).setFontWeight("bold");
  sheet.getRange(6, 1, 1, 8).setFontWeight("bold");
}

function initializeQ0_(ss) {
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  const reportSheet = ss.getSheetByName(CONFIG.sheets.REPORT);
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  const revenue = CONFIG.simulation.STARTING_REVENUE;
  const CP = CONFIG.customer.POOLS;
  const PO = CONFIG.perfectOrder;
  
  const stockRows = [];
  
  for (let f = 1; f <= numFirms; f++) {
    const pos = calculateStartingPosition_(revenue);
    
    // Pre-load orders in transit so Q1 has parts arriving
    const initialOrdersInTransit = 600000;  // 1 quarter's worth of parts
    
    // Retailer starts with 2.5 months of inventory (target level)
    const quarterlyDemand = CONFIG.market.TOTAL_MARKET_SIZE / numFirms;
    const retailerDemand = quarterlyDemand * CONFIG.retailer.CHANNEL_SHARE;
    const retailerStartingInv = Math.round(retailerDemand * CONFIG.retailer.INVENTORY_TARGET_MONTHS / 3);
    
    // Customer pools - start with loyal base
    const totalCustomers = quarterlyDemand;  // Customers = units demanded
    const loyalCustomers = Math.round(totalCustomers * CP.LOYAL_PERCENT);
    const inPlayCustomers = Math.round(totalCustomers * CP.IN_PLAY_PERCENT);
    
    // Initial Perfect Order values (base rates)
    const initialPO = PO.BASE_ON_TIME * PO.BASE_IN_FULL * PO.BASE_DAMAGE_FREE * PO.BASE_DOCUMENTATION;
    
    stockRows.push([
      0, f, new Date().toISOString(),
      pos.cash,                           // Cash ($)
      pos.accountsReceivable,             // AR ($)
      pos.rawMaterialUnits,               // Raw materials (UNITS)
      pos.finishedGoodsUnits,             // Finished goods (UNITS)
      0,                                  // In transit (cleared after arrival)
      pos.fixedAssets,                    // Fixed assets ($)
      pos.accountsPayable,                // AP ($)
      pos.shortTermDebt,                  // ST Debt ($)
      pos.longTermDebt,                   // LT Debt ($)
      CONFIG.production.BASE_CAPACITY_PER_SHIFT,
      pos.csi,
      pos.marketShare,
      0,                                  // Cumulative revenue
      0,                                  // Cumulative profit
      initialOrdersInTransit,             // Orders in transit (UNITS) - parts arriving Q1
      retailerStartingInv,                // Retailer inventory (UNITS)
      "NORMAL",                           // Retailer mode
      loyalCustomers,                     // Loyal customers
      inPlayCustomers,                    // In-play customers
      500,                                // Previous P1 price (base price)
      "",                                 // Active event (none)
      // Perfect Order components
      PO.BASE_ON_TIME,                    // On-Time rate
      PO.BASE_IN_FULL,                    // In-Full rate
      PO.BASE_DAMAGE_FREE,                // Damage-Free rate
      PO.BASE_DOCUMENTATION,              // Documentation rate
      initialPO,                          // Perfect Order %
      // Technology investments
      "",                                 // Tech_Owned (none initially)
      0,                                  // Tech_Maintenance_Cost
      // === ADVANCED: Capacity Expansion ===
      "[]",                               // Expansion_InProgress (JSON array)
      0,                                  // Additional_Capacity (units)
      0,                                  // Expansion_Maintenance ($)
      // === ADVANCED: Regional DCs ===
      false,                              // DC_East_Open
      0,                                  // DC_East_Inventory
      false,                              // DC_Central_Open
      0,                                  // DC_Central_Inventory
      false,                              // DC_West_Open
      0,                                  // DC_West_Inventory
      0,                                  // DC_Total_Opex
      // === ADVANCED: Green Score ===
      50,                                 // Green_Score (starts neutral)
      "RECYCLE",                          // Disposal_Method (default)
      // === ADVANCED: VMI ===
      false                               // VMI_Active (not enabled initially)
    ]);
  }
  
  stocksSheet.getRange(2, 1, stockRows.length, stockRows[0].length).setValues(stockRows);
  
  // Update report for reference
  const pos = calculateStartingPosition_(revenue);
  reportSheet.getRange(15, 2).setValue(pos.cash);
  reportSheet.getRange(16, 2).setValue(pos.accountsReceivable);
  reportSheet.getRange(17, 2).setValue(pos.rawMaterialUnits);
  reportSheet.getRange(18, 2).setValue(pos.finishedGoodsUnits);
  reportSheet.getRange(19, 2).setValue(pos.rawMaterialUnits * CONFIG.costs.RAW_MATERIAL_COST + pos.finishedGoodsUnits * CONFIG.costs.STANDARD_COGS);
  reportSheet.getRange(34, 2).setValue(pos.csi);
}

/******************************************************************************
 * QUARTER PROCESSING
 ******************************************************************************/

function runQuarter() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  if (!stocksSheet || stocksSheet.getLastRow() < 2) {
    ui.alert("Error", "Run 'Initialize New Simulation' first.", ui.ButtonSet.OK);
    return;
  }
  
  // Validate MODEL forecasts before processing
  const modelValidation = validateModelForecasts_(ss);
  if (!modelValidation.valid) {
    ui.alert("⚠️ Forecast Validation", modelValidation.message, ui.ButtonSet.OK);
    return;
  }
  
  const stockData = stocksSheet.getDataRange().getValues();
  const headers = stockData[0];
  const qCol = headers.indexOf("Quarter");
  
  let maxQ = 0;
  for (let i = 1; i < stockData.length; i++) {
    if (stockData[i][qCol] > maxQ) maxQ = stockData[i][qCol];
  }
  const newQ = maxQ + 1;
  
  // Read admin settings
  const adminSettings = getAdminSettings_(ss);
  
  // Generate actual market demand for this quarter (shared across all firms)
  const actualMarketDemand = generateActualDemand_(ss, newQ, adminSettings);
  
  // Record to demand history
  recordDemandHistory_(ss, newQ, actualMarketDemand);
  
  // Generate random event for this quarter (if enabled)
  const activeEvent = adminSettings.eventsEnabled ? generateRandomEvent_(ss, newQ) : null;
  
  // Apply event effects to demand if applicable
  if (activeEvent) {
    const eventEffect = applyEventEffect_(activeEvent, 0);
    actualMarketDemand.R1 = Math.round(actualMarketDemand.R1 * eventEffect.demandMultiplier);
    actualMarketDemand.R2 = Math.round(actualMarketDemand.R2 * eventEffect.demandMultiplier);
    actualMarketDemand.R3 = Math.round(actualMarketDemand.R3 * eventEffect.demandMultiplier);
    actualMarketDemand.total = actualMarketDemand.R1 + actualMarketDemand.R2 + actualMarketDemand.R3;
  }
  
  // Get seasonality info for display
  const calendarQuarter = ((newQ - 1) % 4) + 1;
  const seasonalMultiplier = adminSettings.seasonalityEnabled ? 
    getSeasonalMultiplier_(ss, calendarQuarter) : 1.0;
  const seasonLabel = adminSettings.seasonalityEnabled ? 
    getSeasonLabel_(calendarQuarter, seasonalMultiplier) : `Q${calendarQuarter}`;
  
  const results = [];
  const forecastResults = [];
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  
  // First pass: process operations for each firm
  for (let f = 1; f <= numFirms; f++) {
    const result = processQuarterForFirm_(ss, stocksSheet, stockData, headers, f, newQ, activeEvent, adminSettings, actualMarketDemand);
    results.push(result);
    
    // Record forecast accuracy if forecasting is enabled
    if (adminSettings.forecastingEnabled && adminSettings.trackForecastAccuracy) {
      const forecast = {
        R1: result.forecastR1 || 0,
        R2: result.forecastR2 || 0,
        R3: result.forecastR3 || 0
      };
      // Calculate firm's share of actual demand
      const firmActualDemand = {
        R1: Math.round(actualMarketDemand.R1 * result.marketShare),
        R2: Math.round(actualMarketDemand.R2 * result.marketShare),
        R3: Math.round(actualMarketDemand.R3 * result.marketShare),
        total: Math.round(actualMarketDemand.total * result.marketShare)
      };
      const accuracy = recordForecastAccuracy_(ss, newQ, f, forecast, firmActualDemand, result.forecastMethod);
      forecastResults.push(accuracy);
    }
  }
  
  // Second pass: update market shares based on competition
  const newMarketShares = calculateMarketShareChanges_(ss, results, newQ);
  
  // Update market shares in the stocks sheet
  updateMarketShares_(stocksSheet, newQ, newMarketShares);
  
  // Update results with new market shares for dashboard
  for (let i = 0; i < results.length; i++) {
    results[i].marketShare = newMarketShares[i];
  }
  
  updateDashboard_(ss, newQ, results);
  update10QReport_(ss, newQ);
  updateSOPDashboard_(ss, newQ, results, actualMarketDemand);
  updateBalancedScorecard_(ss, newQ, results);
  appendKPIHistory_(ss, newQ, results);
  updateSCRMDashboard_(ss, newQ, results);
  
  // === INTELLIGENCE CENTER: Generate Reports ===
  if (isAdvancedModuleEnabled_(ss, "Intelligence Center")) {
    Logger.log(`Intel: Module enabled, numFirms = ${numFirms}`);
    
    // Create Intel sheet if it doesn't exist
    let intelSheet = ss.getSheetByName(CONFIG.sheets.INTEL);
    if (!intelSheet) {
      setupIntelSheet_(ss);
      intelSheet = ss.getSheetByName(CONFIG.sheets.INTEL);
    }
    
    // Clear sheet and write header
    intelSheet.clear();
    intelSheet.getRange(1, 1).setValue("INTELLIGENCE REPORTS").setFontWeight("bold").setFontSize(14);
    intelSheet.getRange(2, 1).setValue(`Updated Q${newQ} based on your subscriptions`);
    
    // Refresh stock data to get latest states
    const latestStockData = stocksSheet.getDataRange().getValues();
    
    // Get all firm states for competitor reports
    const firmCount = Math.max(numFirms, 3);
    const allFirmStates = {};
    for (let f = 1; f <= firmCount; f++) {
      allFirmStates[f] = getLatestFirmState_(latestStockData, headers, f, newQ);
    }
    
    // Determine upcoming event for supplier risk report
    const upcomingEvent = activeEvent ? activeEvent.type : null;
    
    // Generate reports for ALL firms - write sequentially
    let currentRow = 4;  // Start after header
    
    for (let f = 1; f <= firmCount; f++) {
      Logger.log(`Intel: === Starting Firm ${f} at row ${currentRow} ===`);
      try {
        const decisions = readDecisionsFromCockpit_(ss, f);
        const intelResult = processIntelligence_(ss, newQ, f, decisions, allFirmStates, actualMarketDemand.total, calendarQuarter, upcomingEvent);
        Logger.log(`Intel: Firm ${f} has ${intelResult.reports.length} reports`);
        
        // Write firm header
        intelSheet.getRange(currentRow, 1).setValue("═══════════════════════════════════════════");
        currentRow++;
        intelSheet.getRange(currentRow, 1).setValue(`FIRM ${f} INTELLIGENCE BRIEFING - Q${newQ}`).setFontWeight("bold");
        currentRow++;
        intelSheet.getRange(currentRow, 1).setValue("═══════════════════════════════════════════");
        currentRow += 2;
        
        // Write each report
        for (const report of intelResult.reports) {
          intelSheet.getRange(currentRow, 1).setValue(report.title).setFontWeight("bold");
          intelSheet.getRange(currentRow, 2).setValue(report.subtitle).setFontStyle("italic");
          currentRow++;
          intelSheet.getRange(currentRow, 1).setValue("────────────────────────────────────");
          currentRow++;
          for (const line of report.lines) {
            intelSheet.getRange(currentRow, 1).setValue(line);
            currentRow++;
          }
          currentRow += 2;  // Space between reports
        }
        
        currentRow += 3;  // Extra space between firms
        Logger.log(`Intel: Firm ${f} complete`);
        
      } catch (e) {
        Logger.log(`Intel Error Firm ${f}: ${e.message}`);
        intelSheet.getRange(currentRow, 1).setValue(`FIRM ${f}: Error - ${e.message}`);
        currentRow += 5;
      }
    }
    
    // Set column widths
    intelSheet.setColumnWidth(1, 350);
    intelSheet.setColumnWidth(2, 150);
    intelSheet.setColumnWidth(3, 150);
    intelSheet.setColumnWidth(4, 200);
    
    Logger.log(`Intel: All firms complete, ended at row ${currentRow}`);
  }
  
  // Calculate regional scores for display
  const regionalInsight = getRegionalInsight_(ss);
  
  // Build summary
  let summary = `Quarter ${newQ} Complete`;
  summary += ` (${seasonLabel})\n`;
  
  if (activeEvent) {
    summary += `⚠️ EVENT: ${formatEventName_(activeEvent.type)}\n`;
  }
  
  // Show actual market demand
  summary += `\nMarket Demand: ${Math.round(actualMarketDemand.total / 1000)}k units\n`;
  summary += `\n`;
  
  results.forEach((r, i) => {
    const shareChange = ((newMarketShares[i] - 0.3333) * 100).toFixed(1);
    const sign = shareChange >= 0 ? "+" : "";
    summary += `Firm ${i + 1}: Rev $${(r.revenue / 1000000).toFixed(1)}M, `;
    summary += `Share ${(newMarketShares[i] * 100).toFixed(1)}% (${sign}${shareChange})`;
    if (r.retailerMode && r.retailerMode !== "NORMAL") {
      summary += ` [${r.retailerMode}]`;
    }
    if (adminSettings.churnEnabled && r.churnedCustomers > 0) {
      summary += ` [Churn: ${Math.round(r.churnedCustomers / 1000)}k]`;
    }
    // Show forecast accuracy if enabled
    if (adminSettings.forecastingEnabled && forecastResults[i]) {
      const mape = (forecastResults[i].mape * 100).toFixed(1);
      summary += ` [MAPE: ${mape}%]`;
    }
    // Show Perfect Order if enabled
    if (adminSettings.perfectOrderEnabled && r.perfectOrder) {
      summary += ` [PO: ${(r.perfectOrder * 100).toFixed(1)}%]`;
    }
    // Show quality returns if any
    // Show warranty info
    if (r.warrantyTier && r.warrantyTier !== "STANDARD") {
      summary += ` [Warranty: ${r.warrantyTier}]`;
    }
    if (r.warrantyClaims > 0) {
      let warrantyInfo = `Claims: ${r.warrantyClaims}`;
      if (r.shippingDamage > 0) {
        warrantyInfo += ` (${r.shippingDamage} dmg)`;
      }
      summary += ` [${warrantyInfo}]`;
    } else if (r.qualityResult && r.qualityResult.returns > 0) {
      // Fallback: show returns if warranty not enabled
      summary += ` [Returns: ${r.qualityResult.returns}]`;
    }
    // Show carrier (multi-carrier) or shipping mode (base transport)
    if (r.carrierName) {
      summary += ` [Mode: ${r.carrierName}]`;
    } else if (r.shippingMode && r.shippingMode !== "STANDARD") {
      summary += ` [Ship: ${r.shippingMode}]`;
    }
    // Show new technology purchases if any
    if (adminSettings.technologyEnabled && r.newTechPurchases && r.newTechPurchases.length > 0) {
      summary += ` [NEW TECH: ${r.newTechPurchases.join(", ")}]`;
    }
    // Show green score if notable (not average)
    if (r.greenScore !== undefined && (r.greenScore <= 40 || r.greenScore >= 70)) {
      summary += ` [Green: ${r.greenScore}]`;
    }
    if (r.disposalMethod && r.disposalMethod !== "RECYCLE") {
      summary += ` [${r.disposalMethod}]`;
    }
    // Show VMI if active
    if (r.vmiActive) {
      summary += ` [VMI]`;
    }
    summary += `\n`;
  });
  
  summary += `\nRegional Leaders:\n`;
  summary += `R1 East (Balanced): Firm ${regionalInsight.r1Leader}\n`;
  summary += `R2 Central (Price-sensitive): Firm ${regionalInsight.r2Leader}\n`;
  summary += `R3 West (Service-sensitive): Firm ${regionalInsight.r3Leader}\n`;
  
  // Update supplier scorecards (if function exists from supplier module)
  if (typeof updateSupplierScorecards_ === 'function') {
    updateSupplierScorecards_(ss, newQ);
  }
  
  // Update cockpit informational cells (advanced modules status)
  updateCockpitInfo_(ss, newQ, results);
  
  ui.alert("Quarter Processed", summary, ui.ButtonSet.OK);
}

/**
 * Get all admin settings in one call for efficiency
 */
function getAdminSettings_(ss) {
  return {
    seasonalityEnabled: getAdminSetting_(ss, "Seasonality"),
    eventsEnabled: getAdminSetting_(ss, "Random Events"),
    churnEnabled: getAdminSetting_(ss, "Customer Churn"),
    retailerEnabled: getAdminSetting_(ss, "Retailer Brain"),
    regionsEnabled: getAdminSetting_(ss, "Regional Competition"),
    forecastingEnabled: getAdminSetting_(ss, "Demand Forecasting"),
    perfectOrderEnabled: getAdminSetting_(ss, "Perfect Order Tracking"),
    technologyEnabled: getAdminSetting_(ss, "Technology Investments"),
    qualityEnabled: getAdminSetting_(ss, "Quality Control"),
    transportEnabled: getAdminSetting_(ss, "Transport & Logistics"),
    eventProbability: getAdminSettingValue_(ss, "Event Probability") || 0.15,
    demandVariability: getAdminSettingValue_(ss, "Demand Variability") || 0.05,
    showSeasonalIndices: getAdminSetting_(ss, "Show Seasonal Indices"),
    showForecastHelper: getAdminSetting_(ss, "Show Forecast Helper"),
    trackForecastAccuracy: getAdminSetting_(ss, "Track Forecast Accuracy"),
    // Perfect Order base rates
    baseOnTime: getAdminSettingValue_(ss, "Base On-Time Rate") || 0.92,
    baseInFull: getAdminSettingValue_(ss, "Base In-Full Rate") || 0.95,
    baseDamageFree: getAdminSettingValue_(ss, "Base Damage-Free Rate") || 0.97,
    baseDocumentation: getAdminSettingValue_(ss, "Base Documentation Rate") || 0.99,
    // Technology settings
    techMaintenanceRate: getAdminSettingValue_(ss, "Tech Maintenance Rate") || 0.15,
    // Quality settings
    baseDefectRate: getAdminSettingValue_(ss, "Base Defect Rate") || 0.03,
    reworkCost: getAdminSettingValue_(ss, "Rework Cost") || 50,
    returnCost: getAdminSettingValue_(ss, "Return Cost") || 150,
  };
}

/**
 * Get seasonal multiplier from admin settings
 */
function getSeasonalMultiplier_(ss, calendarQuarter) {
  const settingNames = {
    1: "Q1 Multiplier",
    2: "Q2 Multiplier", 
    3: "Q3 Multiplier",
    4: "Q4 Multiplier"
  };
  const value = getAdminSettingValue_(ss, settingNames[calendarQuarter]);
  return value !== null ? value : CONFIG.seasonality.QUARTERS[calendarQuarter];
}

/**
 * Generate actual market demand with variability for a quarter
 * Returns demand by region
 */
function generateActualDemand_(ss, quarter, adminSettings) {
  const M = CONFIG.market;
  const variability = adminSettings.demandVariability || 0.05;
  
  // Get seasonal multiplier
  const calendarQuarter = ((quarter - 1) % 4) + 1;
  const seasonalMultiplier = adminSettings.seasonalityEnabled ? 
    getSeasonalMultiplier_(ss, calendarQuarter) : 1.0;
  
  // Base market demand per region
  const baseDemand = {
    R1: M.TOTAL_MARKET_SIZE * M.REGIONS[1].marketShare,
    R2: M.TOTAL_MARKET_SIZE * M.REGIONS[2].marketShare,
    R3: M.TOTAL_MARKET_SIZE * M.REGIONS[3].marketShare,
  };
  
  // Apply seasonality and random variability
  const actualDemand = {};
  let total = 0;
  
  for (const region of ['R1', 'R2', 'R3']) {
    // Random factor within variability range
    const randomFactor = 1 + (Math.random() * 2 - 1) * variability;
    actualDemand[region] = Math.round(baseDemand[region] * seasonalMultiplier * randomFactor);
    total += actualDemand[region];
  }
  
  actualDemand.total = total;
  actualDemand.season = getSeasonLabel_(calendarQuarter, seasonalMultiplier);
  
  return actualDemand;
}

/**
 * Record market demand to Demand_History sheet
 */
function recordDemandHistory_(ss, quarter, actualDemand) {
  const sheet = ss.getSheetByName(CONFIG.sheets.DEMAND_HISTORY);
  if (!sheet) return;
  
  const newRow = [
    quarter,
    actualDemand.R1,
    actualDemand.R2,
    actualDemand.R3,
    actualDemand.total,
    actualDemand.season
  ];
  
  // Data starts at row 6 (after headers at row 5)
  // Write to row based on quarter number: Q1 -> row 6, Q2 -> row 7, etc.
  const insertRow = 5 + quarter;  // Row 6 for Q1, 7 for Q2, etc.
  
  // Make sure we're in valid range (rows 6-19)
  if (insertRow >= 6 && insertRow <= 19) {
    sheet.getRange(insertRow, 1, 1, 6).setValues([newRow]);
  }
}

/**
 * Calculate and record forecast accuracy
 */
function recordForecastAccuracy_(ss, quarter, firmId, forecast, actualDemand, forecastMethod) {
  const sheet = ss.getSheetByName(CONFIG.sheets.FORECAST_LOG);
  if (!sheet) return;
  
  // Default to GUT if not specified
  const method = forecastMethod || "GUT";
  
  // Calculate errors
  const forecastTotal = forecast.R1 + forecast.R2 + forecast.R3;
  
  const errorR1 = forecast.R1 - actualDemand.R1;
  const errorR2 = forecast.R2 - actualDemand.R2;
  const errorR3 = forecast.R3 - actualDemand.R3;
  const errorTotal = forecastTotal - actualDemand.total;
  
  // Calculate Absolute Percentage Errors
  const apeR1 = actualDemand.R1 > 0 ? Math.abs(errorR1) / actualDemand.R1 : 0;
  const apeR2 = actualDemand.R2 > 0 ? Math.abs(errorR2) / actualDemand.R2 : 0;
  const apeR3 = actualDemand.R3 > 0 ? Math.abs(errorR3) / actualDemand.R3 : 0;
  const mape = (apeR1 + apeR2 + apeR3) / 3;
  
  // Calculate bias (positive = over-forecast, negative = under-forecast)
  const bias = actualDemand.total > 0 ? errorTotal / actualDemand.total : 0;
  
  const newRow = [
    quarter, firmId, new Date().toISOString(),
    forecast.R1, forecast.R2, forecast.R3, forecastTotal,
    actualDemand.R1, actualDemand.R2, actualDemand.R3, actualDemand.total,
    errorR1, errorR2, errorR3, errorTotal,
    apeR1, apeR2, apeR3, mape,
    bias, method
  ];
  
  // Insert at row 2 (after header), not append to end
  sheet.insertRowAfter(1);
  sheet.getRange(2, 1, 1, newRow.length).setValues([newRow]);
  
  // Update summary section
  updateForecastSummary_(ss);
  
  return {
    mape: mape,
    bias: bias,
    errorTotal: errorTotal,
    method: method
  };
}

/**
 * Update the Forecast Accuracy Summary section
 */
function updateForecastSummary_(ss) {
  const sheet = ss.getSheetByName(CONFIG.sheets.FORECAST_LOG);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const firmCol = headers.indexOf("Firm_ID");
  const mapeCol = headers.indexOf("MAPE");
  const biasCol = headers.indexOf("Bias");
  const methodCol = headers.indexOf("Forecast_Method");
  
  if (firmCol < 0 || mapeCol < 0) return;
  
  // Find summary section start row (look for "FORECAST ACCURACY SUMMARY")
  let summaryRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === "FORECAST ACCURACY SUMMARY") {
      summaryRow = i + 1;  // Convert to 1-indexed
      break;
    }
  }
  if (summaryRow < 0) return;
  
  // Calculate stats for each firm - separating GUT and MODEL
  for (let firmId = 1; firmId <= 3; firmId++) {
    const firmData = data.filter(row => row[firmCol] === firmId);
    
    if (firmData.length === 0) continue;
    
    // Separate by method
    const gutData = firmData.filter(row => row[methodCol] === "GUT" || !row[methodCol]);
    const modelData = firmData.filter(row => row[methodCol] === "MODEL");
    
    // Calculate Gut MAPE
    const gutMapes = gutData.map(row => row[mapeCol]).filter(v => typeof v === 'number');
    const avgGutMape = gutMapes.length > 0 ? gutMapes.reduce((a, b) => a + b, 0) / gutMapes.length : 0;
    
    // Calculate Model MAPE
    const modelMapes = modelData.map(row => row[mapeCol]).filter(v => typeof v === 'number');
    const avgModelMape = modelMapes.length > 0 ? modelMapes.reduce((a, b) => a + b, 0) / modelMapes.length : 0;
    
    // Calculate improvement (positive = MODEL is better)
    let improvement = "-";
    if (gutMapes.length > 0 && modelMapes.length > 0) {
      const impPts = (avgGutMape - avgModelMape) * 100;
      improvement = (impPts >= 0 ? "+" : "") + impPts.toFixed(1) + " pts";
    }
    
    // Calculate overall bias
    const allBiases = firmData.map(row => row[biasCol]).filter(v => typeof v === 'number');
    const avgBias = allBiases.length > 0 ? allBiases.reduce((a, b) => a + b, 0) / allBiases.length : 0;
    
    // Write to summary row (summaryRow + 3 is header row, +4/5/6 are firm rows)
    const firmRow = summaryRow + 3 + firmId;  // Firm 1 at +4, Firm 2 at +5, etc.
    sheet.getRange(firmRow, 2).setValue(gutMapes.length > 0 ? (avgGutMape * 100).toFixed(1) + "%" : "-");
    sheet.getRange(firmRow, 3).setValue(modelMapes.length > 0 ? (avgModelMape * 100).toFixed(1) + "%" : "-");
    sheet.getRange(firmRow, 4).setValue(improvement);
    sheet.getRange(firmRow, 5).setValue((avgBias * 100).toFixed(1) + "%");
  }
}

/**
 * Get forecast accuracy summary for a firm
 */
function getForecastAccuracySummary_(ss, firmId) {
  const sheet = ss.getSheetByName(CONFIG.sheets.FORECAST_LOG);
  if (!sheet || sheet.getLastRow() < 2) {
    return { avgMape: 0, avgBias: 0, quarters: 0 };
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const firmCol = headers.indexOf("Firm_ID");
  const mapeCol = headers.indexOf("MAPE");
  const biasCol = headers.indexOf("Bias");
  
  let totalMape = 0;
  let totalBias = 0;
  let count = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][firmCol] === firmId) {
      totalMape += data[i][mapeCol] || 0;
      totalBias += data[i][biasCol] || 0;
      count++;
    }
  }
  
  return {
    avgMape: count > 0 ? totalMape / count : 0,
    avgBias: count > 0 ? totalBias / count : 0,
    quarters: count
  };
}

/**
 * Update Demand History sheet with forecast helper calculations
 */
function updateForecastHelper_(ss, quarter) {
  const historySheet = ss.getSheetByName(CONFIG.sheets.DEMAND_HISTORY);
  if (!historySheet) return;
  
  // This function can be expanded to show moving averages, trends, etc.
  // For now, the reference section in the sheet provides the methods
}

/**
 * Generate a random event based on probability, or use forced event
 */
function generateRandomEvent_(ss, quarter) {
  const E = CONFIG.events;
  
  // Check for forced event from menu
  const forcedEvent = PropertiesService.getScriptProperties().getProperty('FORCED_EVENT');
  if (forcedEvent) {
    PropertiesService.getScriptProperties().deleteProperty('FORCED_EVENT');
    const eventConfig = E.TYPES[forcedEvent];
    if (eventConfig) {
      return {
        type: forcedEvent,
        effect: eventConfig.effect,
        magnitude: eventConfig.magnitude,
        duration: eventConfig.duration,
        startQuarter: quarter
      };
    }
  }
  
  // Get probability from admin settings
  const eventProbability = getAdminSettingValue_(ss, "Event Probability") || E.PROBABILITY;
  
  // Check if event occurs this quarter
  if (Math.random() > eventProbability) return null;
  
  // Select event type based on relative probabilities
  const rand = Math.random();
  let cumProb = 0;
  
  for (const [eventType, eventConfig] of Object.entries(E.TYPES)) {
    cumProb += eventConfig.probability;
    if (rand <= cumProb) {
      return {
        type: eventType,
        effect: eventConfig.effect,
        magnitude: eventConfig.magnitude,
        duration: eventConfig.duration,
        startQuarter: quarter
      };
    }
  }
  
  return null;
}

/**
 * Get season label for display
 */
function getSeasonLabel_(calendarQuarter, multiplier) {
  const labels = {
    1: "Q1 - Post-Holiday",
    2: "Q2 - Spring",
    3: "Q3 - Summer",
    4: "Q4 - Holiday Season"
  };
  
  let label = labels[calendarQuarter];
  if (multiplier !== 1.0) {
    const pct = Math.round((multiplier - 1) * 100);
    const sign = pct >= 0 ? "+" : "";
    label += ` [${sign}${pct}% demand]`;
  }
  return label;
}

/**
 * Format event name for display
 */
function formatEventName_(eventType) {
  const names = {
    "SUPPLY_DISRUPTION": "Supply Chain Disruption - Parts Delayed!",
    "DEMAND_SURGE": "Viral Demand Surge!",
    "COMPETITOR_STUMBLE": "Competitor PR Crisis - Customers Available!",
    "ECONOMIC_DOWNTURN": "Economic Slowdown - Demand Drops",
    "RAW_MATERIAL_SPIKE": "Raw Material Costs Spike!"
  };
  return names[eventType] || eventType;
}

/**
 * Get regional competition insights for display
 */
function getRegionalInsight_(ss) {
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  const dbSheet = ss.getSheetByName(CONFIG.sheets.DATABASE);
  
  const stockData = stocksSheet.getDataRange().getValues();
  const stockHeaders = stockData[0];
  const dbData = dbSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  
  // Collect metrics
  const firmMetrics = [];
  for (let f = 1; f <= numFirms; f++) {
    let stockRow = null;
    for (let i = stockData.length - 1; i >= 1; i--) {
      if (stockData[i][stockHeaders.indexOf("Firm_ID")] == f) {
        stockRow = stockData[i];
        break;
      }
    }
    let dbRow = null;
    for (let i = dbData.length - 1; i >= 1; i--) {
      if (dbData[i][dbHeaders.indexOf("Firm_ID")] == f) {
        dbRow = dbData[i];
        break;
      }
    }
    if (!stockRow || !dbRow) continue;
    
    firmMetrics.push({
      firmId: f,
      price: dbRow[dbHeaders.indexOf("D_Price_P1")] || 500,
      csi: stockRow[stockHeaders.indexOf("CSI")] || 80,
    });
  }
  
  // Find leaders by simple metrics
  const lowestPrice = firmMetrics.reduce((min, m) => m.price < min.price ? m : min);
  const highestCSI = firmMetrics.reduce((max, m) => m.csi > max.csi ? m : max);
  
  // R1 is balanced - use average of price rank and CSI rank
  let r1Leader = 1;
  let bestR1Score = -Infinity;
  firmMetrics.forEach(m => {
    const priceScore = 1 - (m.price / 1000);  // Lower price = higher score
    const csiScore = m.csi / 100;
    const combined = priceScore * 0.5 + csiScore * 0.5;
    if (combined > bestR1Score) {
      bestR1Score = combined;
      r1Leader = m.firmId;
    }
  });
  
  return {
    r1Leader: r1Leader,
    r2Leader: lowestPrice.firmId,  // Price-sensitive region
    r3Leader: highestCSI.firmId,   // Service-sensitive region
  };
}

/**
 * Calculate market share changes based on competitive performance BY REGION
 */
function calculateMarketShareChanges_(ss, results, quarter) {
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  const dbSheet = ss.getSheetByName(CONFIG.sheets.DATABASE);
  const M = CONFIG.market;
  
  // Get current state for each firm
  const stockData = stocksSheet.getDataRange().getValues();
  const stockHeaders = stockData[0];
  const dbData = dbSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  
  // Collect metrics for each firm
  const firmMetrics = [];
  
  for (let f = 1; f <= numFirms; f++) {
    let stockRow = null;
    for (let i = stockData.length - 1; i >= 1; i--) {
      if (stockData[i][stockHeaders.indexOf("Firm_ID")] == f) {
        stockRow = stockData[i];
        break;
      }
    }
    
    let dbRow = null;
    for (let i = dbData.length - 1; i >= 1; i--) {
      if (dbData[i][dbHeaders.indexOf("Firm_ID")] == f) {
        dbRow = dbData[i];
        break;
      }
    }
    
    if (!stockRow || !dbRow) continue;
    
    const getStock = (col) => stockRow[stockHeaders.indexOf(col)] || 0;
    const getDb = (col) => dbRow[dbHeaders.indexOf(col)] || 0;
    
    firmMetrics.push({
      firmId: f,
      price: getDb("D_Price_P1"),
      fillRate: getDb("O_Fill_Rate"),
      csi: getStock("CSI"),
      cumRevenue: getStock("Cumulative_Revenue"),
      marketing: getDb("D_Marketing_Budget"),
      currentShare: getStock("Market_Share"),
    });
  }
  
  // Find min/max for normalization (same across regions)
  const prices = firmMetrics.map(m => m.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  
  const maxFill = Math.max(...firmMetrics.map(m => m.fillRate));
  const maxCSI = Math.max(...firmMetrics.map(m => m.csi));
  const maxRevenue = Math.max(...firmMetrics.map(m => m.cumRevenue));
  const maxMarketing = Math.max(...firmMetrics.map(m => m.marketing));
  
  // Calculate scores for each region
  const regionalShares = {};
  
  for (let region = 1; region <= 3; region++) {
    const W = CONFIG.customer.REGIONAL_WEIGHTS[region];
    
    const scores = firmMetrics.map(m => {
      const priceScore = 1 - ((m.price - minPrice) / priceRange);
      const fillScore = maxFill > 0 ? m.fillRate / maxFill : 1;
      const csiScore = maxCSI > 0 ? m.csi / maxCSI : 1;
      const trustScore = maxRevenue > 0 ? m.cumRevenue / maxRevenue : 1;
      const marketingScore = maxMarketing > 0 ? m.marketing / maxMarketing : 1;
      
      const totalScore = (priceScore * W.price) +
                         (fillScore * W.availability) +
                         (csiScore * W.quality) +
                         (trustScore * W.trust) +
                         (marketingScore * W.awareness);
      
      return totalScore;
    });
    
    // Convert scores to target shares for this region
    const totalScore = scores.reduce((sum, s) => sum + s, 0);
    regionalShares[region] = scores.map(s => s / totalScore);
  }
  
  // Calculate overall share weighted by region size
  const overallTargetShares = firmMetrics.map((m, i) => {
    return (regionalShares[1][i] * M.REGIONS[1].marketShare) +
           (regionalShares[2][i] * M.REGIONS[2].marketShare) +
           (regionalShares[3][i] * M.REGIONS[3].marketShare);
  });
  
  // Gradual adjustment toward target
  const ADJUSTMENT_RATE = 0.20;
  
  const newShares = firmMetrics.map((m, i) => {
    const target = overallTargetShares[i];
    const current = m.currentShare;
    return current + (target - current) * ADJUSTMENT_RATE;
  });
  
  // Normalize to sum to 1.0
  const totalShares = newShares.reduce((sum, s) => sum + s, 0);
  const normalizedShares = newShares.map(s => s / totalShares);
  
  // Log regional breakdown for debugging
  Logger.log(`Q${quarter} Regional Scores:`);
  Logger.log(`  R1 East (Balanced): ${regionalShares[1].map(s => (s*100).toFixed(1)).join('%, ')}%`);
  Logger.log(`  R2 Central (Price): ${regionalShares[2].map(s => (s*100).toFixed(1)).join('%, ')}%`);
  Logger.log(`  R3 West (Service):  ${regionalShares[3].map(s => (s*100).toFixed(1)).join('%, ')}%`);
  Logger.log(`  Overall:       ${normalizedShares.map(s => (s*100).toFixed(1)).join('%, ')}%`);
  
  return normalizedShares;
}

/**
 * Update market shares in the stocks sheet for the current quarter
 */
function updateMarketShares_(stocksSheet, quarter, newMarketShares) {
  const data = stocksSheet.getDataRange().getValues();
  const headers = data[0];
  const qCol = headers.indexOf("Quarter");
  const firmCol = headers.indexOf("Firm_ID");
  const shareCol = headers.indexOf("Market_Share");
  
  // Find rows for this quarter and update market share
  for (let i = 1; i < data.length; i++) {
    if (data[i][qCol] == quarter) {
      const firmId = data[i][firmCol];
      const newShare = newMarketShares[firmId - 1];
      stocksSheet.getRange(i + 1, shareCol + 1).setValue(newShare);
    }
  }
}

function processQuarterForFirm_(ss, stocksSheet, stockData, headers, firmId, quarter, activeEvent, adminSettings, actualMarketDemand) {
  const P = CONFIG.production;
  const C = CONFIG.costs;
  const F = CONFIG.financial;
  const M = CONFIG.market;
  const R = CONFIG.retailer;
  const S = CONFIG.seasonality;
  const CH = CONFIG.customer.CHURN;
  
  // Use admin settings (with defaults if not provided)
  const admin = adminSettings || getAdminSettings_(ss);
  
  // Find last state for this firm
  const firmCol = headers.indexOf("Firm_ID");
  let state = null;
  
  for (let i = stockData.length - 1; i >= 1; i--) {
    if (stockData[i][firmCol] === firmId) {
      state = {};
      headers.forEach((h, idx) => { state[h] = stockData[i][idx]; });
      break;
    }
  }
  
  if (!state) throw new Error(`No state for Firm ${firmId}`);
  
  // Read decisions
  const decisions = readDecisionsFromCockpit_(ss, firmId);
  
  // === TECHNOLOGY INVESTMENTS (if enabled) ===
  const techResult = admin.technologyEnabled ?
    processTechnologyInvestments_(state, decisions, admin) :
    { ownedTech: state.Tech_Owned || "", purchaseCost: 0, maintenanceCost: 0, newPurchases: [], benefits: {} };
  
  // === ADVANCED MODULE: CAPACITY EXPANSION ===
  const capacityResult = processCapacityExpansion_(ss, quarter, firmId, decisions, state);
  
  // === ADVANCED MODULE: REGIONAL DCs ===
  // DC processing happens after production (need to know FG available)
  
  // === APPLY EVENT EFFECTS ===
  let eventEffect = { partsMultiplier: 1.0, demandMultiplier: 1.0, costMultiplier: 1.0 };
  if (activeEvent) {
    eventEffect = applyEventEffect_(activeEvent, firmId);
    // Control Tower reduces event impact
    if (techResult.benefits.eventResponseBonus) {
      eventEffect.partsMultiplier = 1 - (1 - eventEffect.partsMultiplier) * (1 - techResult.benefits.eventResponseBonus);
      eventEffect.demandMultiplier = 1 - (1 - eventEffect.demandMultiplier) * (1 - techResult.benefits.eventResponseBonus);
      eventEffect.costMultiplier = 1 - (eventEffect.costMultiplier - 1) * (1 - techResult.benefits.eventResponseBonus);
    }
  }
  
  // === PROCUREMENT (all in UNITS) ===
  let arrivingParts = state.Orders_In_Transit || 0;
  // Apply supply disruption event
  arrivingParts = Math.round(arrivingParts * eventEffect.partsMultiplier);
  
  // Check if Analytics Mode is enabled
  const analyticsMode = isAnalyticsMode_(ss);
  
  // Calculate order quantity
  let orderQuantity;
  if (analyticsMode) {
    // In Analytics Mode: auto-calculate order based on forecast + buffer
    const totalForecast = decisions.forecastR1 + decisions.forecastR2 + decisions.forecastR3;
    const partsNeeded = totalForecast * P.PARTS_PER_UNIT;
    // Order 20% buffer above forecast
    orderQuantity = Math.round(partsNeeded * 1.2);
  } else {
    // Standard Mode: use manual order quantities
    orderQuantity = decisions.orderGlobal || 600000;
  }
  
  // Calculate supplier-based costs
  const supplierResult = calculateSupplierProcurement_(decisions, orderQuantity, analyticsMode);
  
  const newPartsOrdered = supplierResult.globalOrdered;
  const regionalParts = supplierResult.regionalOrdered || 0;
  
  const totalPartsAvailable = state.Raw_Material_Units + arrivingParts + regionalParts;
  
  // Apply cost increase event to procurement cost
  const procurementCost = supplierResult.totalCost * eventEffect.costMultiplier;
  
  // Track supplier quality for quality control
  const supplierQuality = 1 - supplierResult.weightedDefectRate;
  
  // === PRODUCTION (all in UNITS) ===
  const targetP1 = decisions.productionP1;
  const targetP2 = decisions.productionP2;
  const targetTotal = targetP1 + targetP2;
  
  const maxFromParts = Math.floor(totalPartsAvailable / P.PARTS_PER_UNIT);
  const shifts = Math.min(Math.max(decisions.shifts, 1), P.MAX_SHIFTS);
  // APS provides effective capacity bonus
  const capacityBonus = techResult.benefits.capacityUtilizationBonus || 0;
  // Use expanded capacity if Capacity Expansion module is enabled
  const baseCapacity = capacityResult.totalCapacity || (state.Capacity_Units * shifts);
  const capacityAvailable = Math.round(baseCapacity * (1 + capacityBonus));
  
  const actualProduction = Math.min(targetTotal, maxFromParts, capacityAvailable);
  const partsConsumed = actualProduction * P.PARTS_PER_UNIT;
  const laborCost = actualProduction * P.LABOR_COST_PER_UNIT * P.SHIFT_COSTS[shifts];
  
  // === INVENTORY UPDATE (UNITS) ===
  const endingRawUnits = totalPartsAvailable - partsConsumed;
  const availableFGUnits = state.FG_Units + actualProduction;
  
  // === RETAILER BRAIN (if enabled) ===
  // VMI is per-firm decision, but module must be enabled in Admin
  const vmiModuleEnabled = isAdvancedModuleEnabled_(ss, "VMI (Vendor Managed Inventory)");
  const firmVMI = vmiModuleEnabled && decisions.enableVMI;
  const retailerState = admin.retailerEnabled ? 
    processRetailerBrain_(state, availableFGUnits, decisions, firmVMI) :
    { mode: "NORMAL", retailerInventory: availableFGUnits, shipmentToRetailer: 0 };
  
  // === ADVANCED MODULE: REGIONAL DCs ===
  const dcResult = processRegionalDCs_(ss, quarter, firmId, decisions, state, availableFGUnits);
  
  // === SEASONALITY (if enabled) ===
  const calendarQuarter = ((quarter - 1) % 4) + 1;  // 1-4 cycle
  const seasonalMultiplier = admin.seasonalityEnabled ? 
    getSeasonalMultiplier_(ss, calendarQuarter) : 1.0;
  
  // === DEMAND & SALES (UNITS) ===
  // Use actual market demand if provided, otherwise calculate
  let baseDemand;
  if (actualMarketDemand) {
    // Firm's share of actual market demand
    baseDemand = actualMarketDemand.total * state.Market_Share;
  } else {
    // Fallback: calculate demand (for pre-history or when forecasting disabled)
    baseDemand = M.TOTAL_MARKET_SIZE * state.Market_Share * seasonalMultiplier;
  }
  
  // Price effect
  const avgPrice = (decisions.priceP1 * M.PRODUCTS.P1.marketShare) + 
                   (decisions.priceP2 * M.PRODUCTS.P2.marketShare);
  const baseAvgPrice = (M.PRODUCTS.P1.basePrice * M.PRODUCTS.P1.marketShare) + 
                       (M.PRODUCTS.P2.basePrice * M.PRODUCTS.P2.marketShare);
  const priceEffect = baseAvgPrice / avgPrice;
  
  // CSI effect
  const csiEffect = state.CSI / 80;
  
  // Retailer clearance boosts demand (lower street price)
  const clearanceEffect = retailerState.mode === "CLEARANCE" ? 1.15 : 1.0;
  
  // Final demand
  const totalDemand = Math.round(baseDemand * priceEffect * csiEffect * clearanceEffect);
  
  // Split between retail and direct channels
  const retailDemand = Math.round(totalDemand * R.CHANNEL_SHARE);
  const directDemand = totalDemand - retailDemand;
  
  // Retail sales: limited by retailer's inventory
  const retailSales = Math.min(retailDemand, retailerState.retailerInventory);
  const retailStockout = retailDemand - retailSales;
  
  // Direct sales: limited by our FG inventory (after fulfilling retailer orders)
  const fgAfterRetailerShipment = availableFGUnits - retailerState.shipmentToRetailer;
  const directSales = Math.min(directDemand, Math.max(0, fgAfterRetailerShipment));
  const directStockout = directDemand - directSales;
  
  // Total sales and stockouts
  const unitsSold = retailSales + directSales;
  const totalStockout = retailStockout + directStockout;
  
  // Fill rate
  const fillRate = totalDemand > 0 ? unitsSold / totalDemand : 1;
  
  // Ending inventories
  // Add inventory returned from closed DCs or transfers back to factory
  const inventoryReturnedToFactory = dcResult.inventoryReturnedToFactory || 0;
  const endingFGUnits = Math.max(0, availableFGUnits - retailerState.shipmentToRetailer - directSales + inventoryReturnedToFactory);
  const endingRetailerInv = retailerState.retailerInventory - retailSales + retailerState.shipmentToRetailer;
  
  // === CUSTOMER POOL DYNAMICS (if enabled) ===
  const poolResult = admin.churnEnabled ? 
    processCustomerPools_(state, decisions, fillRate, totalStockout) :
    { loyalCustomers: state.Customers_Loyal || 0, inPlayCustomers: state.Customers_InPlay || 0, churnedCustomers: 0 };
  
  // === QUALITY CONTROL (if enabled) ===
  let qualityResult;
  if (admin.qualityEnabled !== false) {  // Default to enabled if not set
    // Use supplier quality from supplier selection (calculated earlier)
    // supplierQuality is already defined from supplierResult.weightedDefectRate
    qualityResult = processQualityControl_(
      actualProduction, 
      unitsSold, 
      decisions.inspectionLevel || "BASIC",
      supplierQuality  // From supplier calculation above
    );
  } else {
    // Quality disabled - no costs, no effects
    qualityResult = {
      inspectionLevel: "NONE",
      defectRate: 0,
      defectsProduced: 0,
      defectsDetected: 0,
      defectsUndetected: 0,
      reworkCost: 0,
      inspectionCost: 0,
      returns: 0,
      returnCost: 0,
      returnRate: 0,
      csiPenalty: 0,
      totalQualityCost: 0,
      laborMultiplier: 1.0
    };
  }
  
  // === TRANSPORT & LOGISTICS (if enabled) ===
  let transportResult;
  const multiCarrierEnabled = isAdvancedModuleEnabled_(ss, "Multi-Carrier Selection");
  const regionalDCsEnabled = isAdvancedModuleEnabled_(ss, "Regional DCs");
  
  if (admin.transportEnabled !== false) {  // Default to enabled if not set
    // Check if firm has TMS for freight discount
    const hasTMS = (techResult.ownedTech || "").includes("TMS");
    
    if (multiCarrierEnabled) {
      // Check if any DCs are open (R2 Central or R3 West - R1 is served by Factory)
      const anyDCOpen = regionalDCsEnabled && 
        (dcResult.dcCentralOpen || dcResult.dcWestOpen);
      
      // Use Multi-Carrier system with DC logic
      transportResult = processMultiCarrier_(
        unitsSold,
        decisions.carrier || "TRUCK",
        hasTMS,
        anyDCOpen,
        regionalDCsEnabled
      );
    } else {
      // Use base transport system (STANDARD/EXPRESS/AIR)
      transportResult = processTransportLogistics_(
        unitsSold,
        decisions.shippingMode || "STANDARD",
        hasTMS
      );
    }
  } else {
    // Transport disabled - no freight costs, no bonuses
    transportResult = {
      shippingMode: "STANDARD",
      modeName: "Standard Ground",
      costPerUnit: 0,
      unitsShipped: unitsSold,
      baseFreightCost: 0,
      tmsDiscount: 0,
      discountAmount: 0,
      freightCost: 0,
      onTimeBonus: 0,
      onTimeRate: 0.92,
      transitDays: 7
    };
  }
  
  // === PRODUCT INNOVATION: P3 PROCESSING (Analytics Mode) ===
  const p3Result = processP3Product_(ss, quarter, decisions, state, unitsSold);
  
  // === MARKET EXPANSION: R4-R6 PROCESSING (Analytics Mode) ===
  const expansionResult = processMarketExpansion_(ss, quarter, decisions, state);
  
  // === FINANCIALS (DOLLARS) ===
  // Revenue from both channels (P1 + P2)
  const directRevenue = directSales * avgPrice;
  const wholesalePrice = avgPrice * (1 - R.MARKUP);  // Wholesale to retailer
  const retailRevenue = retailerState.shipmentToRetailer * wholesalePrice;
  let revenue = directRevenue + retailRevenue;
  
  // Add P3 revenue (if launched)
  revenue += p3Result.p3Revenue;
  
  // Add Market Expansion revenue (R4-R6)
  revenue += expansionResult.expansionRevenue;
  
  // Adjust for P3 cannibalization (already subtracted from P1/P2 in p3Result)
  const totalUnitsSoldWithP3 = unitsSold + p3Result.p3UnitsSold + expansionResult.expansionUnitsSold;
  
  const cogs = (retailerState.shipmentToRetailer + directSales) * C.STANDARD_COGS + 
               (p3Result.p3UnitsSold * p3Result.p3CostPerUnit);
  const grossMargin = revenue - cogs;
  
  // Labor cost (affected by inspection level)
  const adjustedLaborCost = laborCost * qualityResult.laborMultiplier;
  
  // Holding cost based on units (reduced by WMS/ERP)
  const totalInventoryUnits = endingRawUnits + endingFGUnits;
  const holdingCostReduction = techResult.benefits.holdingCostReduction || 0;
  const holdingCost = totalInventoryUnits * F.HOLDING_COST_PER_UNIT * (1 - holdingCostReduction);
  
  // Technology costs
  const techPurchaseCost = techResult.purchaseCost || 0;
  const techMaintenanceCost = techResult.maintenanceCost || 0;
  
  // Quality costs
  const qualityCost = qualityResult.totalQualityCost;
  
  // Freight/Transport costs
  const freightCost = transportResult.freightCost;
  
  const marketingExp = decisions.marketingBudget;
  
  // === ADVANCED MODULE: WARRANTY PROGRAM ===
  const warrantyResult = processWarrantyNetwork_(
    ss, 
    unitsSold, 
    qualityResult, 
    transportResult, 
    dcResult, 
    decisions,
    state
  );
  const warrantyRevenue = warrantyResult.warrantyRevenue || 0;
  const warrantyExpense = warrantyResult.totalWarrantyExpense || 0;
  const warrantyCSIPenalty = warrantyResult.csiPenalty || 0;  // From tier (e.g., NONE = -10 CSI)
  
  // === ADVANCED MODULE: GREEN SCORE ===
  const greenScoreResult = processGreenScore_(
    state,
    warrantyResult.totalClaims || 0,
    decisions,
    unitsSold
  );
  const greenCsiEffect = greenScoreResult.csiEffect || 0;
  const greenChurnMultiplier = greenScoreResult.churnMultiplier || 1.0;
  const disposalCost = greenScoreResult.disposalCost || 0;
  const disposalRecovery = greenScoreResult.disposalRecovery || 0;
  const ecoPackagingCost = greenScoreResult.ecoPackagingCost || 0;
  
  // === ADVANCED MODULE: INTELLIGENCE CENTER ===
  // Note: We can't generate reports here because we need all firm states
  // Intelligence cost is calculated from decisions
  const I = CONFIG.intelligence.REPORTS;
  let intelCost = 0;
  if (decisions.intelRegionalDemand) intelCost += I.REGIONAL_DEMAND.cost;
  if (decisions.intelRetailChannel) intelCost += I.RETAIL_CHANNEL.cost;
  if (decisions.intelCompetitorCapacity) intelCost += I.COMPETITOR_CAPACITY.cost;
  if (decisions.intelSupplierRisk) intelCost += I.SUPPLIER_RISK.cost;
  if (decisions.intelCustomerSentiment) intelCost += I.CUSTOMER_SENTIMENT.cost;
  
  // === ADVANCED MODULE: VMI ===
  const VMI = CONFIG.vmi;
  const wasVMIActive = state.VMI_Active || false;
  const isVMIActive = vmiModuleEnabled && decisions.enableVMI;
  let vmiSetupCost = 0;
  let vmiOngoingCost = 0;
  
  if (isVMIActive && !wasVMIActive) {
    // First time enabling VMI - charge setup cost
    vmiSetupCost = VMI.SETUP_COST;
  }
  if (isVMIActive) {
    // Ongoing cost each quarter VMI is active
    vmiOngoingCost = VMI.QUARTERLY_COST;
  }
  
  // === ADVANCED MODULE COSTS ===
  const expansionCost = capacityResult.expansionCost || 0;
  const expansionMaintenance = capacityResult.expansionMaintenance || 0;
  const dcSetupCost = dcResult.setupCost || 0;
  const dcDisposalRevenue = dcResult.disposalRevenue || 0;
  const dcTransferCost = dcResult.transferCost || 0;
  const dcOpex = dcResult.totalDCOpex || 0;
  
  // Total revenue now includes warranty revenue, refurbish recovery, and DC disposal
  const totalRevenue = revenue + warrantyRevenue + disposalRecovery + dcDisposalRevenue;
  
  const totalOpex = adjustedLaborCost + holdingCost + marketingExp + techMaintenanceCost + qualityCost + freightCost + warrantyExpense + disposalCost + ecoPackagingCost + expansionMaintenance + dcOpex + dcTransferCost + intelCost + vmiOngoingCost;
  
  const operatingIncome = grossMargin + warrantyRevenue + disposalRecovery + dcDisposalRevenue - totalOpex;
  
  const interest = (state.Short_Term_Debt + state.Long_Term_Debt) * F.CREDIT_LINE_RATE / 4;
  
  const netIncome = operatingIncome - interest;
  
  // Cash flow (includes tech purchase, expansion, DC setup, VMI setup, P3 launch, and market expansion as investing activities)
  const cashIn = (revenue + warrantyRevenue + disposalRecovery + dcDisposalRevenue) * 0.9;
  const p3LaunchCost = p3Result.p3LaunchCost || 0;
  const marketEntryCosts = expansionResult.entryCosts || 0;
  const marketOngoingCosts = expansionResult.ongoingCosts || 0;
  const cashOut = procurementCost + adjustedLaborCost + holdingCost + marketingExp + interest + techMaintenanceCost + techPurchaseCost + qualityCost + freightCost + warrantyExpense + disposalCost + ecoPackagingCost + expansionCost + expansionMaintenance + dcSetupCost + dcOpex + dcTransferCost + intelCost + vmiSetupCost + vmiOngoingCost + p3LaunchCost + marketEntryCosts + marketOngoingCosts;
  let newCash = state.Cash + cashIn - cashOut;
  let newDebt = state.Short_Term_Debt;
  
  if (newCash < F.CASH_FLOOR) {
    newDebt += F.CASH_FLOOR - newCash;
    newCash = F.CASH_FLOOR;
  }
  
  // === CSI UPDATE ===
  // Base CSI from fill rate
  let newCSI = state.CSI * 0.7 + fillRate * 100 * 0.3;
  
  // Retailer penalties
  if (retailStockout > 0) {
    newCSI -= R.CSI_PENALTY_STOCKOUT;  // Customers blame you for empty shelves
  }
  if (retailerState.mode === "CLEARANCE") {
    newCSI -= R.CSI_PENALTY_CLEARANCE;  // Brand damage from discounting
  }
  
  // Quality penalty from returns
  newCSI -= qualityResult.csiPenalty;
  
  // DC service bonus (faster delivery improves satisfaction)
  const dcServiceBonus = dcResult.serviceBonus || 0;
  newCSI += dcServiceBonus * 100;  // Convert to CSI points
  
  // Warranty tier CSI impact (NONE = -10, BASIC = -2, STANDARD = 0, PREMIUM = +3)
  // Note: csiPenalty is positive for penalties, negative for bonuses
  newCSI -= warrantyCSIPenalty;
  
  // Warranty network bonus (faster local service)
  const warrantyCsiBonus = warrantyResult.csiBonusFromNetwork || 0;
  newCSI += warrantyCsiBonus;
  
  // Green Score CSI effect (marginal: -1 to +1)
  newCSI += greenCsiEffect;
  
  // Keep CSI in bounds
  newCSI = Math.max(50, Math.min(100, newCSI));
  
  // === PERFECT ORDER CALCULATION (if enabled) ===
  // Apply technology bonuses to Perfect Order
  const techPOBonus = techResult.benefits.perfectOrderBonus || 0;
  const techOnTimeBonus = techResult.benefits.onTimeBonus || 0;
  
  // Transport on-time bonus
  const transportOnTimeBonus = transportResult.onTimeBonus || 0;
  
  let perfectOrderResult = admin.perfectOrderEnabled ?
    calculatePerfectOrder_(admin, fillRate, totalStockout, totalDemand, actualProduction, capacityAvailable, newCSI) :
    { onTime: 0.92, inFull: 0.95, damageFree: 0.97, documentation: 0.99, perfectOrder: 0.84 };
  
  // Apply DC service bonus to on-time delivery
  // Central DC: +3% on-time for R2, West DC: +5% on-time for R3
  if (dcServiceBonus > 0.05) {  // More than just factory bonus means DCs are open
    perfectOrderResult.onTime = Math.min(1.0, perfectOrderResult.onTime + (dcServiceBonus - 0.05));
  }
  
  // Apply technology bonuses
  if (techOnTimeBonus > 0) {
    perfectOrderResult.onTime = Math.min(1.0, perfectOrderResult.onTime + techOnTimeBonus);
  }
  
  // Apply transport/carrier on-time
  // Multi-carrier: use carrier's on-time rate directly (replaces base)
  // Base transport: apply bonus on top of calculated rate
  if (transportResult.onTimeRate) {
    // Multi-carrier: carrier rate directly sets on-time (tech bonus still applies)
    perfectOrderResult.onTime = Math.min(1.0, transportResult.onTimeRate + techOnTimeBonus);
  } else if (transportOnTimeBonus > 0) {
    // Base transport: EXPRESS +3%, AIR +8% bonus on top of calculated rate
    perfectOrderResult.onTime = Math.min(1.0, perfectOrderResult.onTime + transportOnTimeBonus);
  }
  
  if (techPOBonus > 0) {
    // OMS bonus applies to overall Perfect Order
    perfectOrderResult.perfectOrder = Math.min(1.0, perfectOrderResult.perfectOrder + techPOBonus);
  }
  
  // Recalculate Perfect Order with updated on-time
  perfectOrderResult.perfectOrder = perfectOrderResult.onTime * perfectOrderResult.inFull * 
                                    perfectOrderResult.damageFree * perfectOrderResult.documentation;
  
  // === WRITE NEW STATE ===
  const newRow = [
    quarter, firmId, new Date().toISOString(),
    newCash,
    state.Accounts_Receivable + (revenue * 0.1),
    endingRawUnits,
    endingFGUnits,
    0,
    state.Fixed_Assets + expansionCost,  // Expansion adds to fixed assets
    state.Accounts_Payable,
    newDebt,
    state.Long_Term_Debt,
    capacityResult.totalCapacity || state.Capacity_Units,  // Updated capacity
    newCSI,
    state.Market_Share,
    state.Cumulative_Revenue + revenue,
    state.Cumulative_Profit + netIncome,
    newPartsOrdered,
    endingRetailerInv,
    retailerState.mode,
    poolResult.loyalCustomers,
    poolResult.inPlayCustomers,
    decisions.priceP1,
    activeEvent ? activeEvent.type : "",
    // Perfect Order components
    perfectOrderResult.onTime,
    perfectOrderResult.inFull,
    perfectOrderResult.damageFree,
    perfectOrderResult.documentation,
    perfectOrderResult.perfectOrder,
    // Technology investments
    techResult.ownedTech,
    techMaintenanceCost,
    // === ADVANCED: Capacity Expansion ===
    capacityResult.inProgress,
    capacityResult.additionalCapacity,
    capacityResult.expansionMaintenance,
    // === ADVANCED: Regional DCs ===
    dcResult.dcEastOpen,
    dcResult.dcEastInventory,
    dcResult.dcCentralOpen,
    dcResult.dcCentralInventory,
    dcResult.dcWestOpen,
    dcResult.dcWestInventory,
    dcResult.totalDCOpex,
    // === ADVANCED: Green Score ===
    greenScoreResult.newScore,
    greenScoreResult.disposalMethod,
    // === ADVANCED: VMI ===
    isVMIActive
  ];
  
  stocksSheet.appendRow(newRow);
  
  // Write to database
  const dbSheet = ss.getSheetByName(CONFIG.sheets.DATABASE);
  dbSheet.appendRow([
    quarter, firmId, new Date().toISOString(),
    decisions.orderGlobal, decisions.orderRegional, decisions.productionP1, decisions.productionP2, shifts,
    decisions.priceP1, decisions.priceP2, decisions.marketingBudget,
    actualProduction, unitsSold, revenue, cogs, laborCost,
    grossMargin, netIncome, fillRate, newCSI
  ]);
  
  // === SUPPLIER SCORECARD RECORDING ===
  // Record supplier orders based on supplier selection (Analytics Mode) or legacy (Standard Mode)
  if (supplierResult.supplierBreakdown && supplierResult.supplierBreakdown.length > 0) {
    // Analytics Mode: Record each supplier used
    supplierResult.supplierBreakdown.forEach(supplier => {
      if (supplier.quantity > 0 && typeof recordSupplierPerformance_ === 'function') {
        recordSupplierPerformance_(ss, quarter, firmId, supplier.supplierId, supplier.quantity, supplier.totalCost);
      }
    });
  } else {
    // Standard Mode: Legacy recording
    if (decisions.orderGlobal > 0 && typeof recordSupplierPerformance_ === 'function') {
      recordSupplierPerformance_(ss, quarter, firmId, "GLOBAL", decisions.orderGlobal, decisions.orderGlobal * CONFIG.costs.RAW_MATERIAL_COST);
    }
    if (decisions.orderRegional > 0 && typeof recordSupplierPerformance_ === 'function') {
      recordSupplierPerformance_(ss, quarter, firmId, "REGIONAL", decisions.orderRegional, decisions.orderRegional * CONFIG.costs.RAW_MATERIAL_COST * 1.15);
    }
  }
  
  return { 
    revenue, 
    netIncome, 
    csi: newCSI, 
    marketShare: state.Market_Share,
    unitsSold,
    unitsProduced: actualProduction,
    retailerMode: retailerState.mode,
    seasonalEffect: seasonalMultiplier,
    loyalCustomers: poolResult.loyalCustomers,
    inPlayCustomers: poolResult.inPlayCustomers,
    churnedCustomers: poolResult.churnedCustomers,
    forecastR1: decisions.forecastR1,
    forecastR2: decisions.forecastR2,
    forecastR3: decisions.forecastR3,
    forecastMethod: decisions.forecastMethod,
    perfectOrder: perfectOrderResult.perfectOrder,
    poComponents: perfectOrderResult,
    techOwned: techResult.ownedTech,
    techPurchaseCost: techPurchaseCost,
    newTechPurchases: techResult.newPurchases,
    // Quality metrics
    qualityResult: qualityResult,
    defectRate: qualityResult.defectRate,
    returnRate: qualityResult.returnRate,
    qualityCost: qualityResult.totalQualityCost,
    // Transport metrics
    transportResult: transportResult,
    shippingMode: transportResult.shippingMode,
    carrier: transportResult.carrier || null,
    carrierName: transportResult.carrierName || null,
    freightCost: transportResult.freightCost,
    // === ADVANCED: Capacity Expansion ===
    capacityResult: capacityResult,
    totalCapacity: capacityResult.totalCapacity,
    expansionCost: expansionCost,
    expansionMaintenance: expansionMaintenance,
    // === ADVANCED: Regional DCs ===
    dcResult: dcResult,
    dcSetupCost: dcSetupCost,
    dcDisposalRevenue: dcDisposalRevenue,
    dcTransferCost: dcTransferCost,
    dcOpex: dcOpex,
    inventoryReturnedToFactory: inventoryReturnedToFactory,
    // === ADVANCED: Warranty Program ===
    warrantyResult: warrantyResult,
    warrantyTier: warrantyResult.tier || "STANDARD",
    warrantyRevenue: warrantyRevenue,
    warrantyExpense: warrantyExpense,
    netWarranty: warrantyRevenue - warrantyExpense,
    warrantyClaims: warrantyResult.totalClaims || 0,
    shippingDamage: warrantyResult.shippingDamage || 0,
    // === ADVANCED: Green Score ===
    greenScoreResult: greenScoreResult,
    greenScore: greenScoreResult.newScore,
    disposalMethod: greenScoreResult.disposalMethod,
    disposalCost: disposalCost,
    disposalRecovery: disposalRecovery,
    // === ADVANCED: VMI ===
    vmiActive: isVMIActive,
    vmiSetupCost: vmiSetupCost,
    vmiOngoingCost: vmiOngoingCost
  };
}

/**
 * Calculate Perfect Order metric and its components
 * Perfect Order = On-Time × In-Full × Damage-Free × Documentation
 */
function calculatePerfectOrder_(admin, fillRate, totalStockout, totalDemand, actualProduction, capacityAvailable, csi) {
  const PO = CONFIG.perfectOrder;
  
  // Get base rates from admin or defaults
  let onTime = admin.baseOnTime || PO.BASE_ON_TIME;
  let inFull = admin.baseInFull || PO.BASE_IN_FULL;
  let damageFree = admin.baseDamageFree || PO.BASE_DAMAGE_FREE;
  let documentation = admin.baseDocumentation || PO.BASE_DOCUMENTATION;
  
  // === ADJUSTMENTS BASED ON OPERATIONS ===
  
  // 1. Stockouts directly impact In-Full rate
  if (totalDemand > 0 && totalStockout > 0) {
    const stockoutRate = totalStockout / totalDemand;
    inFull = inFull * (1 - stockoutRate * PO.STOCKOUT_IN_FULL_PENALTY);
  }
  
  // 2. Operating at high capacity hurts On-Time (overloaded operations)
  const capacityUtilization = capacityAvailable > 0 ? actualProduction / capacityAvailable : 0;
  if (capacityUtilization > 0.90) {
    const overloadPenalty = (capacityUtilization - 0.90) * PO.OVERLOAD_ON_TIME_PENALTY;
    onTime = onTime * (1 - overloadPenalty);
  }
  
  // 3. Rush operations (high utilization) increase damage
  if (capacityUtilization > 0.85) {
    const rushPenalty = (capacityUtilization - 0.85) * PO.RUSH_DAMAGE_PENALTY;
    damageFree = damageFree * (1 - rushPenalty);
  }
  
  // 4. High CSI improves documentation (good processes)
  if (csi > 85) {
    documentation = Math.min(1.0, documentation + (csi - 85) * PO.CSI_DOCUMENTATION_BONUS / 100);
  }
  
  // 5. Low fill rate impacts overall reliability
  if (fillRate < 0.90) {
    onTime = onTime * (0.90 + fillRate * 0.10);  // Mild penalty
  }
  
  // Ensure all rates stay in valid range
  onTime = Math.max(0.50, Math.min(1.0, onTime));
  inFull = Math.max(0.50, Math.min(1.0, inFull));
  damageFree = Math.max(0.80, Math.min(1.0, damageFree));
  documentation = Math.max(0.90, Math.min(1.0, documentation));
  
  // Calculate Perfect Order (multiplicative)
  const perfectOrder = onTime * inFull * damageFree * documentation;
  
  return {
    onTime: onTime,
    inFull: inFull,
    damageFree: damageFree,
    documentation: documentation,
    perfectOrder: perfectOrder
  };
}

/**
 * Calculate supplier-based procurement costs and metrics (Analytics Mode)
 * Uses supplier selection from Supplier Analytics module
 */
function calculateSupplierProcurement_(decisions, orderQuantity, analyticsMode) {
  const S = CONFIG.suppliers;
  
  // If not in Analytics Mode, use legacy calculation
  if (!analyticsMode) {
    const regionalParts = decisions.orderRegional || 0;
    const globalParts = decisions.orderGlobal || orderQuantity;
    return {
      totalOrdered: globalParts + regionalParts,
      globalOrdered: globalParts,
      regionalOrdered: regionalParts,
      totalCost: (globalParts * CONFIG.costs.RAW_MATERIAL_COST) + (regionalParts * CONFIG.costs.RAW_MATERIAL_COST * 1.15),
      weightedDefectRate: 0.025,  // Default
      weightedOnTime: 0.88,       // Default
      supplierBreakdown: []
    };
  }
  
  // Analytics Mode: Use supplier selection
  const primaryId = decisions.primarySupplier || S.DEFAULT_PRIMARY;
  const secondaryId = decisions.secondarySupplier || S.DEFAULT_SECONDARY;
  const primaryAlloc = decisions.primaryAllocation || 100;
  const emergencyOrder = decisions.emergencyRegionalOrder || 0;
  
  // Get supplier profiles
  const primary = S.PROFILES[primaryId];
  if (!primary) {
    Logger.log(`Unknown primary supplier: ${primaryId}, using default`);
    return calculateSupplierProcurement_(decisions, orderQuantity, false);
  }
  
  // Calculate quantities for each supplier
  const primaryQty = Math.round(orderQuantity * (primaryAlloc / 100));
  let secondaryQty = 0;
  let secondary = null;
  
  if (secondaryId !== "NONE" && primaryAlloc < 100) {
    secondary = S.PROFILES[secondaryId];
    if (secondary) {
      secondaryQty = orderQuantity - primaryQty;
    }
  }
  
  // Calculate costs for primary supplier
  // Apply volume discounts
  let primaryUnitCost = primary.unitCost;
  if (primaryQty >= 10000) {
    primaryUnitCost *= (1 - primary.volumeDiscount10k);
  } else if (primaryQty >= 5000) {
    primaryUnitCost *= (1 - primary.volumeDiscount5k);
  }
  // Add tariff and freight
  const primaryLandedCost = primaryUnitCost * (1 + primary.tariffRate) + primary.freightPerUnit;
  const primaryTotalCost = primaryQty * primaryLandedCost;
  
  // Calculate costs for secondary supplier (if any)
  let secondaryTotalCost = 0;
  let secondaryLandedCost = 0;
  if (secondary && secondaryQty > 0) {
    let secondaryUnitCost = secondary.unitCost;
    if (secondaryQty >= 10000) {
      secondaryUnitCost *= (1 - secondary.volumeDiscount10k);
    } else if (secondaryQty >= 5000) {
      secondaryUnitCost *= (1 - secondary.volumeDiscount5k);
    }
    secondaryLandedCost = secondaryUnitCost * (1 + secondary.tariffRate) + secondary.freightPerUnit;
    secondaryTotalCost = secondaryQty * secondaryLandedCost;
  }
  
  // Emergency regional order (premium pricing)
  const regional = S.REGIONAL_SUPPLIER;
  const emergencyCost = emergencyOrder * regional.unitCost;
  
  // Total cost
  const totalCost = primaryTotalCost + secondaryTotalCost + emergencyCost;
  const totalOrdered = primaryQty + secondaryQty + emergencyOrder;
  
  // Weighted average metrics (for quality/delivery impact)
  let totalWeight = primaryQty + secondaryQty + emergencyOrder;
  if (totalWeight === 0) totalWeight = 1;  // Avoid division by zero
  
  const weightedDefectRate = (
    (primaryQty * primary.defectRate) +
    (secondaryQty * (secondary ? secondary.defectRate : 0)) +
    (emergencyOrder * regional.defectRate)
  ) / totalWeight;
  
  const weightedOnTime = (
    (primaryQty * primary.onTimeDelivery) +
    (secondaryQty * (secondary ? secondary.onTimeDelivery : 0)) +
    (emergencyOrder * regional.onTimeDelivery)
  ) / totalWeight;
  
  // Build supplier breakdown for reporting
  const breakdown = [];
  breakdown.push({
    supplierId: primaryId,
    name: primary.name,
    quantity: primaryQty,
    unitCost: primaryLandedCost,
    totalCost: primaryTotalCost,
    defectRate: primary.defectRate,
    onTime: primary.onTimeDelivery
  });
  
  if (secondary && secondaryQty > 0) {
    breakdown.push({
      supplierId: secondaryId,
      name: secondary.name,
      quantity: secondaryQty,
      unitCost: secondaryLandedCost,
      totalCost: secondaryTotalCost,
      defectRate: secondary.defectRate,
      onTime: secondary.onTimeDelivery
    });
  }
  
  if (emergencyOrder > 0) {
    breakdown.push({
      supplierId: "REGIONAL",
      name: regional.name,
      quantity: emergencyOrder,
      unitCost: regional.unitCost,
      totalCost: emergencyCost,
      defectRate: regional.defectRate,
      onTime: regional.onTimeDelivery
    });
  }
  
  return {
    totalOrdered: totalOrdered,
    globalOrdered: primaryQty + secondaryQty,  // For compatibility
    regionalOrdered: emergencyOrder,
    totalCost: totalCost,
    weightedDefectRate: weightedDefectRate,
    weightedOnTime: weightedOnTime,
    supplierBreakdown: breakdown,
    primarySupplier: primaryId,
    secondarySupplier: secondaryId
  };
}

/**
 * Process quality control - defects, inspection, rework, returns
 */
function processQualityControl_(actualProduction, unitsSold, inspectionLevel, supplierQuality) {
  const Q = CONFIG.quality;
  
  // Get inspection settings
  const inspection = Q.INSPECTION[inspectionLevel] || Q.INSPECTION.BASIC;
  
  // Calculate base defect rate (influenced by supplier quality)
  // supplierQuality typically 0.93-0.95 from suppliers
  const supplierEffect = (1 - (supplierQuality || 0.95)) * Q.SUPPLIER_QUALITY_WEIGHT;
  const effectiveDefectRate = Q.BASE_DEFECT_RATE + supplierEffect;
  
  // Calculate defects produced
  const defectsProduced = Math.round(actualProduction * effectiveDefectRate);
  
  // Inspection catches some defects
  const defectsDetected = Math.round(defectsProduced * inspection.detectionRate);
  const defectsUndetected = defectsProduced - defectsDetected;
  
  // Detected defects get reworked (cost but saves the unit)
  const reworkCost = defectsDetected * Q.REWORK_COST;
  
  // Inspection cost (based on all production)
  const inspectionCost = actualProduction * inspection.cost;
  
  // Undetected defects ship to customers - some become returns
  const defectiveShipped = Math.min(defectsUndetected, unitsSold);
  const productDefectReturns = Math.round(defectiveShipped * Q.RETURN_RATE);
  
  // Return processing cost (receiving/handling defective product)
  const returnCost = productDefectReturns * Q.RETURN_COST;
  
  // Return rate as percentage of sales (product defects only, shipping damage added later)
  const returnRate = unitsSold > 0 ? productDefectReturns / unitsSold : 0;
  
  // CSI impact from returns
  const csiPenalty = returnRate * 100 * Q.CSI_PENALTY_PER_RETURN_PCT;
  
  // Total cost of quality (does NOT include warranty service visits - that's separate)
  const totalQualityCost = inspectionCost + reworkCost + returnCost;
  
  // Labor multiplier from inspection (affects labor cost)
  const laborMultiplier = inspection.laborMultiplier;
  
  return {
    inspectionLevel: inspectionLevel,
    defectRate: effectiveDefectRate,
    defectsProduced: defectsProduced,
    defectsDetected: defectsDetected,
    defectsUndetected: defectsUndetected,
    reworkCost: reworkCost,
    inspectionCost: inspectionCost,
    productDefectReturns: productDefectReturns,  // Returns from production defects
    returns: productDefectReturns,                // Backward compatibility (will be updated with warranty)
    returnCost: returnCost,
    returnRate: returnRate,
    csiPenalty: csiPenalty,
    totalQualityCost: totalQualityCost,
    laborMultiplier: laborMultiplier
  };
}

/**
 * Process Warranty Network - tier-based warranty model with reserve
 * 
 * Warranty tiers: NONE, BASIC (parts only), STANDARD (parts + service), PREMIUM
 * 
 * Revenue: Units Sold × Tier Price → Added to Reserve
 * Expenses: Part Shipping + Service Visit + Disposal → Deducted from Reserve
 * 
 * ADVANCED MODULE: Part of Regional DCs + Multi-Carrier integration
 */
function processWarrantyNetwork_(ss, unitsSold, qualityResult, transportResult, dcResult, decisions, state) {
  const W = CONFIG.warranty;
  const M = CONFIG.market;
  
  // Get warranty tier (default to STANDARD)
  const tierKey = decisions.warrantyTier || W.DEFAULT_TIER;
  const tier = W.TIERS[tierKey] || W.TIERS.STANDARD;
  
  // === WARRANTY REVENUE ===
  const warrantyRevenue = unitsSold * tier.pricePerUnit;
  
  // === WARRANTY CLAIMS ===
  // Get shipping damage rate from transport mode
  const shippingDamageRate = transportResult.damageRate || 0;
  const shippingDamage = Math.round(unitsSold * shippingDamageRate);
  
  // Total warranty claims = product defects + shipping damage
  const productDefects = qualityResult.productDefectReturns || qualityResult.returns || 0;
  const totalWarrantyClaims = productDefects + shippingDamage;
  
  // If NONE tier or no claims, return early
  if (tierKey === "NONE" || totalWarrantyClaims === 0) {
    return {
      tier: tierKey,
      tierName: tier.name,
      warrantyRevenue: warrantyRevenue,
      totalClaims: totalWarrantyClaims,
      productDefects: productDefects,
      shippingDamage: shippingDamage,
      partShippingCost: 0,
      serviceCost: 0,
      disposalCost: 0,
      networkMaintenanceCost: 0,
      totalWarrantyExpense: 0,
      netWarranty: warrantyRevenue,
      claimsByRegion: { R1: 0, R2: 0, R3: 0 },
      csiPenalty: tier.csiPenalty,
      churnMultiplier: tier.churnMultiplier,
      csiBonusFromNetwork: 0
    };
  }
  
  // Split claims by region based on market share
  const claimsByRegion = {
    R1: Math.round(totalWarrantyClaims * M.REGIONS[1].marketShare),
    R2: Math.round(totalWarrantyClaims * M.REGIONS[2].marketShare),
    R3: Math.round(totalWarrantyClaims * M.REGIONS[3].marketShare)
  };
  
  // Check DC and warranty network status
  const dcCentralOpen = dcResult.dcCentralOpen || false;
  const dcWestOpen = dcResult.dcWestOpen || false;
  const centralNetworkEnabled = decisions.centralWarrantyNetwork || false;
  const westNetworkEnabled = decisions.westWarrantyNetwork || false;
  
  // === PART SHIPPING COSTS (all tiers except NONE) ===
  let partShippingCost = 0;
  if (tier.includesPart) {
    // R1: Always from factory (local)
    partShippingCost += claimsByRegion.R1 * W.PART_SHIPPING.FROM_FACTORY.R1;
    
    // R2: From Central DC if open, else factory
    if (dcCentralOpen) {
      partShippingCost += claimsByRegion.R2 * W.PART_SHIPPING.FROM_DC;
    } else {
      partShippingCost += claimsByRegion.R2 * W.PART_SHIPPING.FROM_FACTORY.R2;
    }
    
    // R3: From West DC if open, else factory
    if (dcWestOpen) {
      partShippingCost += claimsByRegion.R3 * W.PART_SHIPPING.FROM_DC;
    } else {
      partShippingCost += claimsByRegion.R3 * W.PART_SHIPPING.FROM_FACTORY.R3;
    }
  }
  
  // === SERVICE COSTS (STANDARD and PREMIUM only) ===
  let serviceCost = 0;
  let networkMaintenanceCost = 0;
  let csiBonusFromNetwork = 0;
  const serviceLevel = (tierKey === "PREMIUM") ? "PREMIUM" : "STANDARD";
  
  if (tier.includesService) {
    // R1: Always third-party (factory region, no separate network needed)
    serviceCost += claimsByRegion.R1 * W.THIRD_PARTY_SERVICE[serviceLevel].R1;
    
    // R2: In-house if DC + network enabled, else third-party
    if (dcCentralOpen && centralNetworkEnabled) {
      serviceCost += claimsByRegion.R2 * W.IN_HOUSE_SERVICE[serviceLevel];
      networkMaintenanceCost += W.NETWORK_QUARTERLY_COST;
      csiBonusFromNetwork += W.CSI_BONUS_IN_HOUSE * M.REGIONS[2].marketShare;
    } else {
      serviceCost += claimsByRegion.R2 * W.THIRD_PARTY_SERVICE[serviceLevel].R2;
    }
    
    // R3: In-house if DC + network enabled, else third-party
    if (dcWestOpen && westNetworkEnabled) {
      serviceCost += claimsByRegion.R3 * W.IN_HOUSE_SERVICE[serviceLevel];
      networkMaintenanceCost += W.NETWORK_QUARTERLY_COST;
      csiBonusFromNetwork += W.CSI_BONUS_IN_HOUSE * M.REGIONS[3].marketShare;
    } else {
      serviceCost += claimsByRegion.R3 * W.THIRD_PARTY_SERVICE[serviceLevel].R3;
    }
  }
  
  // Note: Disposal costs are now handled by Green Score module
  // Warranty only passes totalClaims for disposal processing
  
  // === TOTALS ===
  const totalWarrantyExpense = partShippingCost + serviceCost + networkMaintenanceCost;
  const netWarranty = warrantyRevenue - totalWarrantyExpense;
  
  return {
    tier: tierKey,
    tierName: tier.name,
    warrantyRevenue: warrantyRevenue,
    totalClaims: totalWarrantyClaims,
    productDefects: productDefects,
    shippingDamage: shippingDamage,
    shippingDamageRate: shippingDamageRate,
    partShippingCost: partShippingCost,
    serviceCost: serviceCost,
    networkMaintenanceCost: networkMaintenanceCost,
    totalWarrantyExpense: totalWarrantyExpense,
    netWarranty: netWarranty,
    claimsByRegion: claimsByRegion,
    csiPenalty: tier.csiPenalty,
    churnMultiplier: tier.churnMultiplier,
    csiBonusFromNetwork: csiBonusFromNetwork,
    centralNetworkActive: dcCentralOpen && centralNetworkEnabled,
    westNetworkActive: dcWestOpen && westNetworkEnabled
  };
}

/**
 * Process Green Score - sustainability tracking and disposal decisions
 * 
 * Disposal methods: LANDFILL, RECYCLE, REFURBISH
 * Optional: Eco packaging
 * 
 * Green Score affects CSI and churn (marginally)
 */
function processGreenScore_(state, totalClaims, decisions, unitsSold) {
  const G = CONFIG.greenScore;
  
  // Get current score (default to initial if not set)
  const currentScore = state.Green_Score || G.INITIAL_SCORE;
  
  // Get disposal method decision
  const disposalMethod = decisions.disposalMethod || G.DEFAULT_METHOD;
  const disposal = G.DISPOSAL_METHODS[disposalMethod] || G.DISPOSAL_METHODS.RECYCLE;
  
  // Get eco packaging decision
  const ecoPackaging = decisions.ecoPackaging || false;
  
  // === DISPOSAL COSTS & RECOVERY ===
  const disposalCost = totalClaims * disposal.costPerUnit;
  const disposalRecovery = totalClaims * disposal.recoveryPerUnit;
  
  // === ECO PACKAGING COST ===
  const ecoPackagingCost = ecoPackaging ? (unitsSold * G.ECO_PACKAGING.costPerUnit) : 0;
  
  // === GREEN SCORE CHANGE ===
  let scoreChange = disposal.greenScoreChange;
  if (ecoPackaging) {
    scoreChange += G.ECO_PACKAGING.greenScoreChange;
  }
  
  // Calculate new score (bounded 0-100)
  const newScore = Math.max(0, Math.min(100, currentScore + scoreChange));
  
  // === DETERMINE EFFECT BRACKET ===
  let effect = G.SCORE_EFFECTS.AVERAGE;  // Default
  for (const [key, bracket] of Object.entries(G.SCORE_EFFECTS)) {
    if (newScore >= bracket.min && newScore <= bracket.max) {
      effect = bracket;
      break;
    }
  }
  
  return {
    previousScore: currentScore,
    newScore: newScore,
    scoreChange: scoreChange,
    disposalMethod: disposalMethod,
    disposalName: disposal.name,
    disposalCost: disposalCost,
    disposalRecovery: disposalRecovery,
    ecoPackaging: ecoPackaging,
    ecoPackagingCost: ecoPackagingCost,
    effectBracket: effect.label,
    csiEffect: effect.csiEffect,
    churnMultiplier: effect.churnMultiplier
  };
}

/**
 * Process transport & logistics - shipping mode, freight cost, on-time impact
 */
function processTransportLogistics_(unitsShipped, shippingMode, hasTMS) {
  const T = CONFIG.transport;
  
  // Get shipping mode config
  const mode = T.MODES[shippingMode] || T.MODES.STANDARD;
  
  // Calculate base freight cost
  let freightCost = unitsShipped * mode.costPerUnit;
  
  // TMS discount (8% reduction)
  const tmsDiscount = hasTMS ? T.TMS_DISCOUNT : 0;
  const discountAmount = freightCost * tmsDiscount;
  freightCost = freightCost * (1 - tmsDiscount);
  
  // On-time bonus from shipping mode
  const onTimeBonus = mode.onTimeBonus;
  
  return {
    shippingMode: shippingMode,
    modeName: mode.name,
    costPerUnit: mode.costPerUnit,
    unitsShipped: unitsShipped,
    baseFreightCost: unitsShipped * mode.costPerUnit,
    tmsDiscount: tmsDiscount,
    discountAmount: discountAmount,
    freightCost: freightCost,
    onTimeBonus: onTimeBonus,
    transitDays: mode.transitDays
  };
}

/**
 * Process Multi-Carrier Selection - mode-specific rates, on-time, volume discounts
 * ADVANCED MODULE: Multi-Carrier Selection (Intermodal / Truck / Air)
 * 
 * Logistics model when Regional DCs are enabled:
 * - No DC open: Forced to Air ($12/unit) - penalty for no regional presence
 * - DC open: Mode to DC + Last-mile ($2.50/unit) from DC to customer
 */
function processMultiCarrier_(unitsShipped, modeKey, hasTMS, anyDCOpen, regionalDCsEnabled) {
  const MC = CONFIG.multiCarrier;
  
  // Determine effective mode based on DC status
  let effectiveMode;
  let effectiveModeKey;
  let lastMileCost = 0;
  let forcedAir = false;
  
  if (regionalDCsEnabled) {
    if (!anyDCOpen) {
      // No DCs open - forced to use Air (penalty for no regional presence)
      effectiveMode = MC.MODES.AIR;
      effectiveModeKey = "AIR";
      forcedAir = true;
    } else {
      // DCs open - use selected mode + last-mile
      effectiveMode = MC.MODES[modeKey] || MC.MODES[MC.DEFAULT_MODE];
      effectiveModeKey = modeKey;
      lastMileCost = MC.LAST_MILE_COST;  // $2.50/unit from DC to customer
    }
  } else {
    // Regional DCs not enabled - just use selected mode
    effectiveMode = MC.MODES[modeKey] || MC.MODES[MC.DEFAULT_MODE];
    effectiveModeKey = modeKey;
  }
  
  // Calculate base freight cost (mode cost)
  let costPerUnit = effectiveMode.costPerUnit;
  
  // Apply volume discount if applicable (only Truck has this, not when forced Air)
  let volumeDiscount = 0;
  if (!forcedAir && effectiveMode.volumeDiscountThreshold && unitsShipped >= effectiveMode.volumeDiscountThreshold) {
    volumeDiscount = effectiveMode.volumeDiscountRate;
    costPerUnit = costPerUnit * (1 - volumeDiscount);
  }
  
  // Total cost = mode cost + last-mile (if applicable)
  const totalCostPerUnit = costPerUnit + lastMileCost;
  let freightCost = unitsShipped * totalCostPerUnit;
  
  // TMS discount (8% reduction) applies to mode cost only, not last-mile
  const tmsDiscount = hasTMS ? MC.TMS_DISCOUNT : 0;
  const tmsDiscountAmount = (unitsShipped * costPerUnit) * tmsDiscount;
  freightCost = freightCost - tmsDiscountAmount;
  
  // On-time rate from effective mode
  const onTimeRate = effectiveMode.onTimeRate;
  
  // Calculate on-time bonus for Perfect Order (difference from baseline 92%)
  const baselineOnTime = 0.92;
  const onTimeBonus = onTimeRate - baselineOnTime;
  
  // Build display name
  let displayName = effectiveMode.name;
  if (forcedAir) {
    displayName = "Air (No DC)";
  } else if (lastMileCost > 0) {
    displayName = effectiveMode.name + " + Last Mile";
  }
  
  return {
    shippingMode: effectiveModeKey,       // For compatibility
    carrier: effectiveModeKey,            // Legacy name
    carrierName: displayName,
    costPerUnit: totalCostPerUnit,        // After volume discount + last-mile
    baseCostPerUnit: effectiveMode.costPerUnit,
    lastMileCost: lastMileCost,
    forcedAir: forcedAir,
    unitsShipped: unitsShipped,
    baseFreightCost: unitsShipped * effectiveMode.costPerUnit,
    volumeDiscount: volumeDiscount,
    volumeDiscountAmount: unitsShipped * effectiveMode.costPerUnit * volumeDiscount,
    tmsDiscount: tmsDiscount,
    tmsDiscountAmount: tmsDiscountAmount,
    freightCost: freightCost,
    onTimeRate: onTimeRate,               // Mode's on-time %
    onTimeBonus: onTimeBonus,             // Bonus vs baseline (for Perfect Order)
    damageRate: effectiveMode.damageRate || 0,  // Shipping damage rate for warranty
    transitDays: 0                        // Not meaningful at quarterly level
  };
}

/**
 * Process technology investments - purchases and benefits
 */
function processTechnologyInvestments_(state, decisions, admin) {
  const T = CONFIG.technology;
  const maintenanceRate = admin.techMaintenanceRate || T.MAINTENANCE_RATE;
  
  // Get current owned technologies (comma-separated string)
  const currentTechStr = state.Tech_Owned || "";
  const currentTech = currentTechStr ? currentTechStr.split(",").filter(t => t) : [];
  
  // Map decision names to system keys
  const purchaseMap = {
    purchaseERP: "ERP",
    purchaseControlTower: "CONTROL_TOWER",
    purchaseAPS: "APS",
    purchaseDemandSensing: "DEMAND_SENSING",
    purchaseWMS: "WMS",
    purchaseTMS: "TMS",
    purchaseOMS: "OMS",
    purchaseAnalytics: "ANALYTICS"
  };
  
  // Process new purchases
  let totalPurchaseCost = 0;
  const newPurchases = [];
  
  for (const [decisionKey, systemKey] of Object.entries(purchaseMap)) {
    if (decisions[decisionKey] && !currentTech.includes(systemKey)) {
      // Purchase this system
      const system = T.SYSTEMS[systemKey];
      if (system) {
        totalPurchaseCost += system.cost;
        newPurchases.push(systemKey);
      }
    }
  }
  
  // Update owned technologies
  const ownedTech = [...currentTech, ...newPurchases];
  const ownedTechStr = ownedTech.join(",");
  
  // Calculate maintenance cost (quarterly = annual rate / 4)
  let maintenanceCost = 0;
  for (const systemKey of ownedTech) {
    const system = T.SYSTEMS[systemKey];
    if (system) {
      maintenanceCost += system.cost * maintenanceRate / 4;
    }
  }
  
  // Calculate technology benefits
  const benefits = calculateTechBenefits_(ownedTech);
  
  return {
    ownedTech: ownedTechStr,
    purchaseCost: totalPurchaseCost,
    maintenanceCost: maintenanceCost,
    newPurchases: newPurchases,
    benefits: benefits
  };
}

/**
 * Calculate cumulative benefits from owned technologies
 */
function calculateTechBenefits_(ownedTech) {
  const T = CONFIG.technology;
  
  const benefits = {
    holdingCostReduction: 0,
    onTimeBonus: 0,
    eventResponseBonus: 0,
    capacityUtilizationBonus: 0,
    forecastErrorReduction: 0,
    freightCostReduction: 0,
    perfectOrderBonus: 0,
    planningVisibility: false,
    analyticsEnabled: false
  };
  
  for (const systemKey of ownedTech) {
    const system = T.SYSTEMS[systemKey];
    if (system && system.effect) {
      // Accumulate benefits (most are additive)
      if (system.effect.holdingCostReduction) {
        benefits.holdingCostReduction += system.effect.holdingCostReduction;
      }
      if (system.effect.onTimeBonus) {
        benefits.onTimeBonus += system.effect.onTimeBonus;
      }
      if (system.effect.eventResponseBonus) {
        benefits.eventResponseBonus += system.effect.eventResponseBonus;
      }
      if (system.effect.capacityUtilizationBonus) {
        benefits.capacityUtilizationBonus += system.effect.capacityUtilizationBonus;
      }
      if (system.effect.forecastErrorReduction) {
        benefits.forecastErrorReduction += system.effect.forecastErrorReduction;
      }
      if (system.effect.freightCostReduction) {
        benefits.freightCostReduction += system.effect.freightCostReduction;
      }
      if (system.effect.perfectOrderBonus) {
        benefits.perfectOrderBonus += system.effect.perfectOrderBonus;
      }
      if (system.effect.planningVisibility) {
        benefits.planningVisibility = true;
      }
      if (system.effect.analyticsEnabled) {
        benefits.analyticsEnabled = true;
      }
    }
  }
  
  return benefits;
}

/**
 * Process customer pool dynamics - churn from LOYAL to IN_PLAY
 */
function processCustomerPools_(state, decisions, fillRate, stockoutUnits) {
  const CH = CONFIG.customer.CHURN;
  const CP = CONFIG.customer.POOLS;
  const CS = CONFIG.customer.SEGMENTS;
  const M = CONFIG.market;
  
  let loyalCustomers = state.Customers_Loyal || (M.TOTAL_MARKET_SIZE * state.Market_Share * CP.LOYAL_PERCENT);
  let inPlayCustomers = state.Customers_InPlay || (M.TOTAL_MARKET_SIZE * state.Market_Share * CP.IN_PLAY_PERCENT);
  const prevPrice = state.Prev_Price_P1 || 500;
  
  let churnedCustomers = 0;
  
  // === SEGMENT-BASED MARKETING EFFECTIVENESS (Analytics Module) ===
  // Calculate how well marketing budget is allocated across segments
  // Better allocation = lower churn
  const segAlloc = {
    champions: (decisions.segmentChampions || 25) / 100,
    growth: (decisions.segmentGrowth || 25) / 100,
    atRisk: (decisions.segmentAtRisk || 25) / 100,
    other: (decisions.segmentOther || 25) / 100
  };
  
  // Calculate segment-weighted retention bonus
  // Formula: Each segment's allocation × that segment's marketing response × segment weight
  // Higher allocation to responsive segments (At-Risk, Growth) = bigger bonus
  const retentionBonus = (
    (segAlloc.champions * CS.CHAMPIONS.marketingResponse * CS.CHAMPIONS.percentOfCustomers) +
    (segAlloc.growth * CS.GROWTH.marketingResponse * CS.GROWTH.percentOfCustomers) +
    (segAlloc.atRisk * CS.AT_RISK.marketingResponse * CS.AT_RISK.percentOfCustomers) +
    (segAlloc.other * CS.OTHER.marketingResponse * CS.OTHER.percentOfCustomers)
  ) * 10;  // Scale factor
  
  // Calculate segment-level churn reduction (based on allocation)
  // At-Risk segment: high allocation = saves more customers
  const atRiskSaved = Math.round(loyalCustomers * CS.AT_RISK.percentOfCustomers * 
    (1 - CS.AT_RISK.baseRetention) * segAlloc.atRisk * CS.AT_RISK.marketingResponse * 10);
  
  // Growth segment: marketing converts some to loyal
  const growthConverted = Math.round(inPlayCustomers * 
    segAlloc.growth * CS.GROWTH.marketingResponse * 5);
  
  // Apply segment marketing effects
  loyalCustomers += atRiskSaved;
  loyalCustomers += growthConverted;
  inPlayCustomers -= growthConverted;
  
  // 1. Stockout churn - customers who couldn't buy leave
  if (stockoutUnits > 0) {
    const stockoutChurn = Math.round(stockoutUnits * CH.STOCKOUT);
    const fromLoyal = Math.min(stockoutChurn, loyalCustomers);
    loyalCustomers -= fromLoyal;
    inPlayCustomers += fromLoyal;
    churnedCustomers += fromLoyal;
  }
  
  // 2. Price hike churn - customers leave if price increased too much
  const priceChange = (decisions.priceP1 - prevPrice) / prevPrice;
  if (priceChange > CH.PRICE_HIKE_THRESHOLD) {
    // Retention bonus reduces price churn impact
    const adjustedPriceChurn = CH.PRICE_HIKE * (1 - retentionBonus);
    const priceChurn = Math.round(loyalCustomers * adjustedPriceChurn);
    loyalCustomers -= priceChurn;
    inPlayCustomers += priceChurn;
    churnedCustomers += priceChurn;
  }
  
  // 3. Low CSI churn - dissatisfied customers leave
  if (state.CSI < CH.LOW_CSI_THRESHOLD) {
    // Retention bonus reduces CSI churn impact
    const adjustedCsiChurn = CH.LOW_CSI * (1 - retentionBonus);
    const csiChurn = Math.round(loyalCustomers * adjustedCsiChurn);
    loyalCustomers -= csiChurn;
    inPlayCustomers += csiChurn;
    churnedCustomers += csiChurn;
  }
  
  // 4. Natural churn - some customers always drift (reduced by retention bonus)
  const adjustedNaturalChurn = CH.NATURAL * (1 - retentionBonus * 0.5);  // Partial effect
  const naturalChurn = Math.round(loyalCustomers * adjustedNaturalChurn);
  loyalCustomers -= naturalChurn;
  inPlayCustomers += naturalChurn;
  churnedCustomers += naturalChurn;
  
  // 5. New entrants from market growth (added to IN_PLAY pool to be competed for)
  const growthRate = M.REGIONS[1].growthRate;  // Use Region 1 growth as proxy
  const newEntrants = Math.round(M.TOTAL_MARKET_SIZE * state.Market_Share * growthRate / 4);
  inPlayCustomers += newEntrants;
  
  return {
    loyalCustomers: Math.max(0, Math.round(loyalCustomers)),
    inPlayCustomers: Math.max(0, Math.round(inPlayCustomers)),
    churnedCustomers: churnedCustomers,
    newEntrants: newEntrants,
    retentionBonus: retentionBonus,
    atRiskSaved: atRiskSaved,
    growthConverted: growthConverted
  };
}

/**
 * Apply event effects to firm operations
 */
function applyEventEffect_(event, firmId) {
  const effects = { partsMultiplier: 1.0, demandMultiplier: 1.0, costMultiplier: 1.0 };
  
  if (!event) return effects;
  
  switch (event.effect) {
    case "PARTS_DELAYED":
      effects.partsMultiplier = 1 - event.magnitude;
      break;
    case "DEMAND_SPIKE":
      effects.demandMultiplier = 1 + event.magnitude;
      break;
    case "DEMAND_DROP":
      effects.demandMultiplier = 1 - event.magnitude;
      break;
    case "COST_INCREASE":
      effects.costMultiplier = 1 + event.magnitude;
      break;
    case "STEAL_INPLAY":
      // Handled in market share calculation
      break;
  }
  
  return effects;
}

/**
 * Retailer Brain - determines retailer ordering behavior
 */
function processRetailerBrain_(state, availableFGUnits, decisions, vmiEnabled) {
  const R = CONFIG.retailer;
  const M = CONFIG.market;
  const VMI = CONFIG.vmi.EFFECTS;
  
  // Current retailer inventory
  const currentRetailerInv = state.Retailer_Inventory || 0;
  
  // Expected monthly sales (retailer's view of demand)
  const quarterlyDemand = M.TOTAL_MARKET_SIZE * state.Market_Share;
  const retailQuarterlyDemand = quarterlyDemand * R.CHANNEL_SHARE;
  const retailMonthlySales = retailQuarterlyDemand / 3;
  
  // Current coverage in months
  const coverageMonths = retailMonthlySales > 0 ? currentRetailerInv / retailMonthlySales : R.INVENTORY_TARGET_MONTHS;
  
  // VMI effects: widen thresholds (less volatility), smoother ordering
  const panicThreshold = vmiEnabled ? 
    R.PANIC_THRESHOLD_MONTHS * VMI.PANIC_THRESHOLD_MULTIPLIER : R.PANIC_THRESHOLD_MONTHS;
  const clearanceThreshold = vmiEnabled ? 
    R.CLEARANCE_THRESHOLD_MONTHS * VMI.CLEARANCE_THRESHOLD_MULTIPLIER : R.CLEARANCE_THRESHOLD_MONTHS;
  const panicMultiplier = vmiEnabled ? VMI.PANIC_ORDER_MULTIPLIER : R.PANIC_ORDER_MULTIPLIER;
  const clearanceMultiplier = vmiEnabled ? VMI.CLEARANCE_ORDER_MULTIPLIER : 0.5;
  
  // Determine retailer mode
  let mode = "NORMAL";
  let orderMultiplier = 1.0;
  
  if (coverageMonths < panicThreshold) {
    mode = "PANIC";
    orderMultiplier = panicMultiplier;
  } else if (coverageMonths > clearanceThreshold) {
    mode = "CLEARANCE";
    orderMultiplier = clearanceMultiplier;
  }
  
  // Calculate retailer's order to firm
  // Target: bring inventory to target level
  const targetInv = retailMonthlySales * R.INVENTORY_TARGET_MONTHS;
  const baseOrder = Math.max(0, targetInv - currentRetailerInv + retailMonthlySales);
  const retailerOrder = Math.round(baseOrder * orderMultiplier);
  
  // Shipment constrained by firm's available FG inventory
  const shipmentToRetailer = Math.min(retailerOrder, availableFGUnits);
  
  // Retailer's inventory available to sell (current + incoming shipment)
  const retailerInventory = currentRetailerInv + shipmentToRetailer;
  
  return {
    mode: mode,
    coverageMonths: coverageMonths,
    retailerOrder: retailerOrder,
    shipmentToRetailer: shipmentToRetailer,
    retailerInventory: retailerInventory,
    vmiEnabled: vmiEnabled || false
  };
}

/**
 * Validate forecasts before processing quarter
 * In Analytics Mode: forecasts cannot be blank or zero
 * Returns {valid: boolean, message: string}
 */
function validateModelForecasts_(ss) {
  const analyticsMode = isAnalyticsMode_(ss);
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  const issues = [];
  
  for (let f = 1; f <= numFirms; f++) {
    const decisions = readDecisionsFromCockpit_(ss, f);
    
    if (analyticsMode) {
      // In Analytics Mode, forecasts must be entered (not blank or zero)
      const missingForecasts = [];
      if (!decisions.forecastR1 || decisions.forecastR1 === 0) missingForecasts.push("R1");
      if (!decisions.forecastR2 || decisions.forecastR2 === 0) missingForecasts.push("R2");
      if (!decisions.forecastR3 || decisions.forecastR3 === 0) missingForecasts.push("R3");
      
      if (missingForecasts.length > 0) {
        issues.push(`Firm ${f}: Enter forecast for ${missingForecasts.join(", ")}. Review your history and choose a forecasting method.`);
      }
    }
  }
  
  if (issues.length > 0) {
    return {
      valid: false,
      message: issues.join("\n\n")
    };
  }
  
  return { valid: true, message: "" };
}

function readDecisionsFromCockpit_(ss, firmId) {
  const sheet = ss.getSheetByName(CONFIG.sheets.COCKPIT);
  const data = sheet.getDataRange().getValues();
  
  // Find firm's section by searching for "FIRM X DECISIONS"
  let firmStartRow = -1;
  let firmEndRow = data.length;
  const searchPattern = `FIRM ${firmId} DECISIONS`;
  const nextFirmPattern = `FIRM ${firmId + 1} DECISIONS`;
  
  for (let i = 0; i < data.length; i++) {
    const cell = String(data[i][0] || "").toUpperCase();
    if (cell.includes(searchPattern)) {
      firmStartRow = i;
    } else if (cell.includes(nextFirmPattern)) {
      firmEndRow = i;
      break;
    }
  }
  
  if (firmStartRow === -1) {
    Logger.log(`Could not find FIRM ${firmId} section in cockpit`);
    firmStartRow = 3;  // Fallback
  }
  
  const decisions = {
    forecastR1: 0,  // Default to 0 - forces entry in Analytics Mode
    forecastR2: 0,
    forecastR3: 0,
    forecastMethod: "GUT",  // GUT or MODEL - for analytics tracking
    // Supplier Selection (Analytics Mode)
    primarySupplier: "SUP001",
    secondarySupplier: "NONE",
    primaryAllocation: 100,
    emergencyRegionalOrder: 0,
    // Standard procurement (non-Analytics Mode)
    orderGlobal: 600000,
    orderRegional: 0,
    productionP1: 120000,
    productionP2: 80000,
    shifts: 1,
    priceP1: 500,
    priceP2: 850,
    // Product Innovation (P3) - Analytics Mode
    launchP3: false,
    p3Config: "STANDARD",
    p3Price: 549,
    productionP3: 0,
    // Market Expansion (R4-R6) - Analytics Mode
    enterR4: false,
    forecastR4: 0,
    enterR5: false,
    forecastR5: 0,
    enterR6: false,
    forecastR6: 0,
    marketingBudget: 5000000,
    // Customer Segment Allocation (Analytics Mode)
    segmentChampions: 25,
    segmentGrowth: 25,
    segmentAtRisk: 25,
    segmentOther: 25,
    // Quality
    inspectionLevel: "BASIC",
    // Logistics
    shippingMode: "STANDARD",
    // Technology purchases (YES/NO)
    purchaseERP: false,
    purchaseControlTower: false,
    purchaseAPS: false,
    purchaseDemandSensing: false,
    purchaseWMS: false,
    purchaseTMS: false,
    purchaseOMS: false,
    purchaseAnalytics: false,
    // Capacity Expansion (Advanced Module)
    buildSmallLine: false,
    buildMediumLine: false,
    buildLargeLine: false,
    // Regional DCs (Advanced Module) - Factory serves R1 directly
    dcCentralStatus: "NO",      // NO, YES, or CLOSE
    dcWestStatus: "NO",         // NO, YES, or CLOSE
    allocateCentral: 0,
    allocateWest: 0,
    // Inventory Transfers
    transferFromCentral: 0,
    transferFromCentralTo: "NONE",  // NONE, WEST, FACTORY
    transferFromWest: 0,
    transferFromWestTo: "NONE",     // NONE, CENTRAL, FACTORY
    // Multi-Carrier Selection (Advanced Module)
    carrier: "TRUCK",
    // Warranty Network (Advanced Module)
    warrantyTier: "STANDARD",
    centralWarrantyNetwork: false,
    westWarrantyNetwork: false,
    // Green Score (Advanced Module)
    disposalMethod: "RECYCLE",
    ecoPackaging: false,
    // Intelligence Center (Advanced Module)
    intelRegionalDemand: false,
    intelRetailChannel: false,
    intelCompetitorCapacity: false,
    intelSupplierRisk: false,
    intelCustomerSentiment: false,
    // VMI (Advanced Module)
    enableVMI: false,
  };
  
  try {
    // Search within firm's section for each decision by label
    for (let i = firmStartRow; i < firmEndRow; i++) {
      const label = String(data[i][0] || "").toLowerCase();
      const value = data[i][1];
      const value3 = data[i][2];  // Third column for DC allocations
      
      // Forecasts
      if (label.includes("forecast r1")) {
        decisions.forecastR1 = Number(value) || decisions.forecastR1;
      } else if (label.includes("forecast r2")) {
        decisions.forecastR2 = Number(value) || decisions.forecastR2;
      } else if (label.includes("forecast r3")) {
        decisions.forecastR3 = Number(value) || decisions.forecastR3;
      } else if (label.includes("forecast method")) {
        const method = String(value).toUpperCase();
        if (method === "GUT" || method === "MODEL") {
          decisions.forecastMethod = method;
        }
      }
      // Procurement (Standard Mode)
      else if (label.includes("global supplier") && label.includes("order")) {
        decisions.orderGlobal = Number(value) || decisions.orderGlobal;
      } else if (label.includes("regional supplier") && label.includes("order")) {
        decisions.orderRegional = Number(value) || 0;
      }
      // Supplier Selection (Analytics Mode)
      else if (label.includes("primary supplier") && !label.includes("allocation")) {
        const sup = String(value).toUpperCase();
        if (sup.startsWith("SUP")) {
          decisions.primarySupplier = sup;
        }
      } else if (label.includes("secondary supplier")) {
        const sup = String(value).toUpperCase();
        if (sup === "NONE" || sup.startsWith("SUP")) {
          decisions.secondarySupplier = sup;
        }
      } else if (label.includes("primary allocation")) {
        const alloc = Number(value) || 100;
        decisions.primaryAllocation = Math.min(100, Math.max(50, alloc));
      } else if (label.includes("emergency regional")) {
        decisions.emergencyRegionalOrder = Number(value) || 0;
      }
      // Production
      else if (label.includes("production target p1")) {
        decisions.productionP1 = Number(value) || decisions.productionP1;
      } else if (label.includes("production target p2")) {
        decisions.productionP2 = Number(value) || decisions.productionP2;
      } else if (label.includes("shifts to use")) {
        decisions.shifts = Math.min(3, Math.max(1, Number(value) || 1));
      }
      // Pricing
      else if (label.includes("price p1")) {
        decisions.priceP1 = Number(value) || decisions.priceP1;
      } else if (label.includes("price p2")) {
        decisions.priceP2 = Number(value) || decisions.priceP2;
      }
      // Product Innovation (P3) - Analytics Mode
      else if (label.includes("launch p3")) {
        decisions.launchP3 = String(value).toUpperCase() === "YES";
      } else if (label.includes("p3 configuration")) {
        const config = String(value).toUpperCase();
        if (["STANDARD", "PREMIUM"].includes(config)) {
          decisions.p3Config = config;
        }
      } else if (label.includes("p3 price")) {
        decisions.p3Price = Number(value) || 549;
      } else if (label.includes("p3 production")) {
        decisions.productionP3 = Number(value) || 0;
      }
      // Market Expansion (R4-R6) - Analytics Mode
      else if (label.includes("enter r4") || label.includes("r4") && label.includes("canada")) {
        decisions.enterR4 = String(value).toUpperCase() === "YES";
      } else if (label.includes("forecast r4")) {
        decisions.forecastR4 = Number(value) || 0;
      } else if (label.includes("enter r5") || label.includes("r5") && label.includes("eu")) {
        decisions.enterR5 = String(value).toUpperCase() === "YES";
      } else if (label.includes("forecast r5")) {
        decisions.forecastR5 = Number(value) || 0;
      } else if (label.includes("enter r6") || label.includes("r6") && label.includes("apac")) {
        decisions.enterR6 = String(value).toUpperCase() === "YES";
      } else if (label.includes("forecast r6")) {
        decisions.forecastR6 = Number(value) || 0;
      }
      // Marketing
      else if (label.includes("marketing budget")) {
        decisions.marketingBudget = Number(value) || decisions.marketingBudget;
      }
      // Customer Segment Allocation (Analytics Mode)
      else if (label.includes("segment") && label.includes("champions")) {
        decisions.segmentChampions = Number(value) || 25;
      } else if (label.includes("segment") && label.includes("growth")) {
        decisions.segmentGrowth = Number(value) || 25;
      } else if (label.includes("segment") && label.includes("at-risk")) {
        decisions.segmentAtRisk = Number(value) || 25;
      } else if (label.includes("segment") && label.includes("other")) {
        decisions.segmentOther = Number(value) || 25;
      }
      // Quality
      else if (label.includes("inspection level")) {
        const inspLevel = String(value).toUpperCase();
        if (["NONE", "BASIC", "FULL"].includes(inspLevel)) {
          decisions.inspectionLevel = inspLevel;
        }
      }
      // Logistics
      else if (label.includes("shipping mode")) {
        const shipMode = String(value).toUpperCase();
        if (["STANDARD", "EXPRESS", "AIR"].includes(shipMode)) {
          decisions.shippingMode = shipMode;
        }
      }
      // Technology
      else if (label.includes("purchase erp")) {
        decisions.purchaseERP = String(value).toUpperCase() === "YES";
      } else if (label.includes("control tower")) {
        decisions.purchaseControlTower = String(value).toUpperCase() === "YES";
      } else if (label.includes("purchase aps")) {
        decisions.purchaseAPS = String(value).toUpperCase() === "YES";
      } else if (label.includes("demand sensing")) {
        decisions.purchaseDemandSensing = String(value).toUpperCase() === "YES";
      } else if (label.includes("purchase wms")) {
        decisions.purchaseWMS = String(value).toUpperCase() === "YES";
      } else if (label.includes("purchase tms")) {
        decisions.purchaseTMS = String(value).toUpperCase() === "YES";
      } else if (label.includes("purchase oms")) {
        decisions.purchaseOMS = String(value).toUpperCase() === "YES";
      } else if (label.includes("purchase analytics")) {
        decisions.purchaseAnalytics = String(value).toUpperCase() === "YES";
      }
      // === CAPACITY EXPANSION (Advanced Module) ===
      else if (label.includes("small line")) {
        decisions.buildSmallLine = String(value).toUpperCase() === "YES";
      } else if (label.includes("medium line")) {
        decisions.buildMediumLine = String(value).toUpperCase() === "YES";
      } else if (label.includes("large line")) {
        decisions.buildLargeLine = String(value).toUpperCase() === "YES";
      }
      // === REGIONAL DCs (Advanced Module) ===
      // R1 (East) is served by Factory directly - no DC decision
      // === REGIONAL DCs (Standard Mode or Analytics Mode) ===
      else if (label.includes("open central dc") || (label.includes("central") && label.includes("dc") && !label.includes("warranty") && !label.includes("transfer"))) {
        const statusValue = String(value).toUpperCase();
        if (["NO", "YES", "CLOSE"].includes(statusValue)) {
          decisions.dcCentralStatus = statusValue;
        }
        if (value3) decisions.allocateCentral = Number(value3) || 0;
      } else if (label.includes("open west dc") || (label.includes("west") && label.includes("dc") && !label.includes("warranty") && !label.includes("transfer"))) {
        const statusValue = String(value).toUpperCase();
        if (["NO", "YES", "CLOSE"].includes(statusValue)) {
          decisions.dcWestStatus = statusValue;
        }
        if (value3) decisions.allocateWest = Number(value3) || 0;
      }
      // === INVENTORY TRANSFERS ===
      else if (label.includes("transfer") && label.includes("central")) {
        decisions.transferFromCentral = Number(value) || 0;
        const destValue = String(value3).toUpperCase();
        if (["NONE", "WEST", "FACTORY"].includes(destValue)) {
          decisions.transferFromCentralTo = destValue;
        }
      } else if (label.includes("transfer") && label.includes("west")) {
        decisions.transferFromWest = Number(value) || 0;
        const destValue = String(value3).toUpperCase();
        if (["NONE", "CENTRAL", "FACTORY"].includes(destValue)) {
          decisions.transferFromWestTo = destValue;
        }
      }
      // === MULTI-CARRIER SELECTION (Advanced Module) ===
      else if (label.includes("select mode") || label.includes("select carrier")) {
        const modeValue = String(value).toUpperCase();
        const validModes = ["INTERMODAL", "TRUCK", "AIR"];
        if (validModes.includes(modeValue)) {
          decisions.carrier = modeValue;
        }
      }
      // === WARRANTY NETWORK (Advanced Module) ===
      else if (label.includes("warranty tier") || label.includes("warranty level")) {
        const tierValue = String(value).toUpperCase();
        const validTiers = ["NONE", "BASIC", "STANDARD", "PREMIUM"];
        if (validTiers.includes(tierValue)) {
          decisions.warrantyTier = tierValue;
        }
      }
      else if (label.includes("central") && label.includes("warranty") && label.includes("network")) {
        decisions.centralWarrantyNetwork = String(value).toUpperCase() === "YES";
      } else if (label.includes("west") && label.includes("warranty") && label.includes("network")) {
        decisions.westWarrantyNetwork = String(value).toUpperCase() === "YES";
      }
      // === GREEN SCORE (Advanced Module) ===
      else if (label.includes("disposal") && label.includes("method")) {
        const methodValue = String(value).toUpperCase();
        const validMethods = ["LANDFILL", "RECYCLE", "REFURBISH"];
        if (validMethods.includes(methodValue)) {
          decisions.disposalMethod = methodValue;
        }
      }
      else if (label.includes("eco") && label.includes("packaging")) {
        decisions.ecoPackaging = String(value).toUpperCase() === "YES";
      }
      // === INTELLIGENCE CENTER (Advanced Module) ===
      else if (label.includes("regional demand analysis")) {
        decisions.intelRegionalDemand = String(value).toUpperCase() === "YES";
      }
      else if (label.includes("retail channel intelligence")) {
        decisions.intelRetailChannel = String(value).toUpperCase() === "YES";
      }
      else if (label.includes("competitor capacity intel")) {
        decisions.intelCompetitorCapacity = String(value).toUpperCase() === "YES";
      }
      else if (label.includes("supplier risk monitor")) {
        decisions.intelSupplierRisk = String(value).toUpperCase() === "YES";
      }
      else if (label.includes("customer sentiment tracker")) {
        decisions.intelCustomerSentiment = String(value).toUpperCase() === "YES";
      }
      // === VMI (Advanced Module) ===
      else if (label.includes("enable vmi") || label.includes("vmi with retailer")) {
        decisions.enableVMI = String(value).toUpperCase() === "YES";
      }
    }
  } catch (e) {
    Logger.log(`Error reading decisions for Firm ${firmId}: ${e.message}`);
  }
  
  // === ANALYTICS MODE AUTO-DEFAULTS ===
  // In Analytics Mode, auto-calculate hidden decisions
  if (isAnalyticsMode_(ss)) {
    // Auto-calculate procurement based on forecast + buffer
    const totalForecast = decisions.forecastR1 + decisions.forecastR2 + decisions.forecastR3;
    const totalProduction = decisions.productionP1 + decisions.productionP2;
    // Order enough raw materials: 3 parts per unit, plus 20% buffer
    const partsNeeded = Math.round(totalProduction * CONFIG.production.PARTS_PER_UNIT * 1.2);
    decisions.orderGlobal = partsNeeded;
    decisions.orderRegional = 0;
    
    // Auto-calculate shifts based on production target
    const baseCapacity = 250000;  // per shift
    const neededShifts = Math.ceil(totalProduction / baseCapacity);
    decisions.shifts = Math.min(3, Math.max(1, neededShifts));
    
    // Set defaults for hidden options
    decisions.inspectionLevel = "STANDARD";
    decisions.shippingMode = "STANDARD";
    
    // All technology purchases OFF
    decisions.purchaseERP = false;
    decisions.purchaseControlTower = false;
    decisions.purchaseAPS = false;
    decisions.purchaseDemandSensing = false;
    decisions.purchaseWMS = false;
    decisions.purchaseTMS = false;
    decisions.purchaseOMS = false;
    decisions.purchaseAnalytics = false;
    
    // All advanced modules OFF (except DCs - now part of Network Design)
    decisions.buildSmallLine = false;
    decisions.buildMediumLine = false;
    decisions.buildLargeLine = false;
    // DC status is NOT reset - Network Design module uses it
    // decisions.dcCentralStatus and dcWestStatus are read from Cockpit
    decisions.carrier = "TRUCK";
    decisions.warrantyTier = "STANDARD";
    decisions.disposalMethod = "RECYCLE";
    decisions.ecoPackaging = false;
    decisions.enableVMI = false;
  }
  
  return decisions;
}

function updateDashboard_(ss, quarter, results) {
  const sheet = ss.getSheetByName(CONFIG.sheets.DASHBOARD);
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  
  sheet.getRange(3, 2).setValue(quarter);
  
  const stockData = stocksSheet.getDataRange().getValues();
  const headers = stockData[0];
  const cashCol = headers.indexOf("Cash");
  const firmCol = headers.indexOf("Firm_ID");
  const qCol = headers.indexOf("Quarter");
  const greenScoreCol = headers.indexOf("Green_Score");
  
  const firmData = results.map((r, i) => {
    const firmId = i + 1;
    let cash = 0;
    let greenScore = 50;
    for (let row = stockData.length - 1; row >= 1; row--) {
      if (stockData[row][firmCol] === firmId && stockData[row][qCol] === quarter) {
        cash = stockData[row][cashCol];
        greenScore = stockData[row][greenScoreCol] || 50;
        break;
      }
    }
    return [
      `Firm ${firmId}`,
      Math.round(r.revenue),
      Math.round(r.netIncome),
      Math.round(cash),
      r.csi.toFixed(1),
      (r.marketShare * 100).toFixed(1) + "%",
      r.unitsSold,
      Math.round(greenScore)
    ];
  });
  
  sheet.getRange(7, 1, firmData.length, 8).setValues(firmData);
}

/**
 * Update S&OP Dashboard for all firms
 */
function updateSOPDashboard_(ss, quarter, results, actualMarketDemand) {
  const sopSheet = ss.getSheetByName(CONFIG.sheets.SOP_DASHBOARD);
  if (!sopSheet) return;
  
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  const demandSheet = ss.getSheetByName(CONFIG.sheets.DEMAND_HISTORY);
  const forecastSheet = ss.getSheetByName(CONFIG.sheets.FORECAST_LOG);
  const dbSheet = ss.getSheetByName(CONFIG.sheets.DATABASE);
  
  const stockData = stocksSheet.getDataRange().getValues();
  const stockHeaders = stockData[0];
  
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  
  for (let f = 1; f <= numFirms; f++) {
    const startRow = (f - 1) * 50 + 1;  // 50 rows per firm (quality + logistics + alerts)
    
    // Get latest state for this firm
    const state = getLatestFirmState_(stockData, stockHeaders, f, quarter);
    if (!state) continue;
    
    // Get historical demand (last 4 quarters)
    const demandHistory = getDemandHistory_(demandSheet, quarter, 4);
    
    // Get forecast history for this firm (last 4 quarters)
    const forecastHistory = getForecastHistory_(forecastSheet, f, quarter, 4);
    
    // Get forecast accuracy for this firm (current quarter only)
    const forecastAccuracy = getForecastAccuracy_(forecastSheet, f, quarter);
    
    // Get recent database entries for fill rate, capacity utilization
    const recentMetrics = getRecentMetrics_(dbSheet, f, quarter);
    
    // Get quality and transport results if available from results array
    const firmResult = results && results[f - 1] ? results[f - 1] : null;
    const qualityResult = firmResult ? firmResult.qualityResult : null;
    const transportResult = firmResult ? firmResult.transportResult : null;
    
    // === UPDATE HEADER ===
    sopSheet.getRange(startRow + 1, 2).setValue(quarter);
    sopSheet.getRange(startRow + 1, 5).setValue(new Date().toLocaleString());
    
    // === UPDATE DEMAND OUTLOOK ===
    updateDemandSection_(sopSheet, startRow, demandHistory, forecastHistory, actualMarketDemand, state, quarter);
    
    // === UPDATE SUPPLY PLAN ===
    updateSupplySection_(sopSheet, startRow, state, recentMetrics);
    
    // === UPDATE INVENTORY POSITION ===
    updateInventorySection_(sopSheet, startRow, state, recentMetrics);
    
    // === UPDATE KEY METRICS ===
    updateMetricsSection_(sopSheet, startRow, state, recentMetrics, forecastAccuracy);
    
    // === UPDATE QUALITY SECTION ===
    updateQualitySection_(sopSheet, startRow, qualityResult);
    
    // === UPDATE LOGISTICS SECTION ===
    updateLogisticsSection_(sopSheet, startRow, transportResult);
    
    // === GENERATE ALERTS ===
    generateSOPAlerts_(sopSheet, startRow, state, recentMetrics, forecastAccuracy, qualityResult, transportResult);
  }
}

/**
 * Get latest state for a firm from stocks data
 */
function getLatestFirmState_(stockData, headers, firmId, quarter) {
  const firmCol = headers.indexOf("Firm_ID");
  const qCol = headers.indexOf("Quarter");
  
  for (let i = stockData.length - 1; i >= 1; i--) {
    if (stockData[i][firmCol] === firmId && stockData[i][qCol] === quarter) {
      const state = {};
      headers.forEach((h, idx) => { state[h] = stockData[i][idx]; });
      return state;
    }
  }
  return null;
}

/**
 * Get demand history from Demand_History sheet
 */
function getDemandHistory_(demandSheet, currentQuarter, numQuarters) {
  if (!demandSheet) return [];
  
  const data = demandSheet.getDataRange().getValues();
  const history = [];
  
  // Data rows are sheet rows 6-19, which are array indices 5-18
  for (let i = 5; i < Math.min(19, data.length); i++) {
    if (data[i] && data[i][0]) {
      history.push({
        quarter: data[i][0],
        total: data[i][4] || 0,
        season: data[i][5] || ""
      });
    }
  }
  
  // Return most recent quarters
  return history.slice(-numQuarters);
}

/**
 * Get forecast accuracy for a firm
 */
function getForecastAccuracy_(forecastSheet, firmId, quarter) {
  if (!forecastSheet) return { mape: 0, bias: 0 };
  
  const data = forecastSheet.getDataRange().getValues();
  const headers = data[0];
  const firmCol = headers.indexOf("Firm_ID");
  const qCol = headers.indexOf("Quarter");
  const mapeCol = headers.indexOf("MAPE");
  const biasCol = headers.indexOf("Bias");
  
  // Get most recent entry for this firm
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][firmCol] === firmId && data[i][qCol] === quarter) {
      return {
        mape: data[i][mapeCol] || 0,
        bias: data[i][biasCol] || 0
      };
    }
  }
  return { mape: 0, bias: 0 };
}

/**
 * Get recent metrics from database
 */
function getRecentMetrics_(dbSheet, firmId, quarter) {
  if (!dbSheet) return { fillRate: 0.95, capacityUtil: 0.75 };
  
  const data = dbSheet.getDataRange().getValues();
  const headers = data[0];
  const firmCol = headers.indexOf("Firm_ID");
  const qCol = headers.indexOf("Quarter");
  const fillCol = headers.indexOf("O_Fill_Rate") !== -1 ? headers.indexOf("O_Fill_Rate") : 17;
  const prodCol = headers.indexOf("O_Units_Produced") !== -1 ? headers.indexOf("O_Units_Produced") : 10;
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][firmCol] === firmId && data[i][qCol] === quarter) {
      return {
        fillRate: data[i][fillCol] || 0.95,
        unitsProduced: data[i][prodCol] || 0,
        capacityUtil: 0.75  // Will calculate from state
      };
    }
  }
  return { fillRate: 0.95, capacityUtil: 0.75, unitsProduced: 0 };
}

/**
 * Get forecast history for a firm (multiple quarters)
 */
function getForecastHistory_(forecastSheet, firmId, currentQuarter, numQuarters) {
  if (!forecastSheet) return {};
  
  const data = forecastSheet.getDataRange().getValues();
  const headers = data[0];
  const firmCol = headers.indexOf("Firm_ID");
  const qCol = headers.indexOf("Quarter");
  const forecastTotalCol = headers.indexOf("Forecast_Total");
  const actualTotalCol = headers.indexOf("Actual_Total");
  const mapeCol = headers.indexOf("MAPE");
  
  const history = {};
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][firmCol] === firmId) {
      const q = data[i][qCol];
      history[q] = {
        quarter: q,
        forecast: data[i][forecastTotalCol] || 0,
        actual: data[i][actualTotalCol] || 0,
        mape: data[i][mapeCol] || 0
      };
    }
  }
  
  return history;
}

/**
 * Update demand section of S&OP Dashboard
 */
function updateDemandSection_(sheet, startRow, demandHistory, forecastHistory, actualDemand, state, quarter) {
  // Row offsets: Headers (4), Market Demand (5), Your Demand (6), Your Forecast (7), Error (8), Season (9)
  // Columns: B=2, C=3, D=4, E=5, F=6
  // We show up to 4 quarters of history, left-aligned chronologically
  const marketShare = state.Market_Share || 0.333;
  
  // Determine which quarters to show (up to 4, ending with current)
  const startQ = Math.max(1, quarter - 3);  // At Q3: start at Q1. At Q8: start at Q5
  const quartersToShow = [];
  for (let q = startQ; q <= quarter; q++) {
    quartersToShow.push(q);
  }
  
  // Clear all columns first
  for (let col = 2; col <= 5; col++) {
    sheet.getRange(startRow + 4, col).setValue("-");  // Header
    sheet.getRange(startRow + 5, col).setValue("-");  // Market Demand
    sheet.getRange(startRow + 6, col).setValue("-");  // Your Demand
    sheet.getRange(startRow + 7, col).setValue("-");  // Your Forecast
    sheet.getRange(startRow + 8, col).setValue("-").setBackground(null);  // Forecast Error
    sheet.getRange(startRow + 9, col).setValue("-");  // Season
  }
  
  // Build lookup of demand by quarter
  const demandByQuarter = {};
  for (let i = 0; i < demandHistory.length; i++) {
    const d = demandHistory[i];
    demandByQuarter[d.quarter] = d;
  }
  
  // Fill columns left-to-right with chronological data
  for (let i = 0; i < quartersToShow.length; i++) {
    const col = 2 + i;  // Start at column B (2)
    const q = quartersToShow[i];
    const isCurrent = (q === quarter);
    
    // Set header
    sheet.getRange(startRow + 4, col).setValue("Q" + q + (isCurrent ? " (Now)" : ""));
    
    // Fill demand data
    const d = demandByQuarter[q];
    if (d) {
      sheet.getRange(startRow + 5, col).setValue(Math.round(d.total / 1000) + "k");
      sheet.getRange(startRow + 6, col).setValue(Math.round(d.total * marketShare / 1000) + "k");
      sheet.getRange(startRow + 9, col).setValue(d.season || "");
    }
    
    // Fill forecast and error data
    const f = forecastHistory[q];
    if (f) {
      sheet.getRange(startRow + 7, col).setValue(Math.round(f.forecast / 1000) + "k");
      const errorPct = (f.mape * 100).toFixed(0) + "%";
      sheet.getRange(startRow + 8, col).setValue(errorPct);
      // Color code error: green <10%, yellow 10-20%, red >20%
      if (f.mape < 0.10) {
        sheet.getRange(startRow + 8, col).setBackground("#d9ead3");
      } else if (f.mape < 0.20) {
        sheet.getRange(startRow + 8, col).setBackground("#fff2cc");
      } else {
        sheet.getRange(startRow + 8, col).setBackground("#f4cccc");
      }
    }
  }
  
  // Override current quarter with actualDemand if provided (more accurate)
  if (actualDemand && quartersToShow.length > 0) {
    const currentCol = 2 + quartersToShow.length - 1;  // Last filled column
    sheet.getRange(startRow + 5, currentCol).setValue(Math.round(actualDemand.total / 1000) + "k");
    sheet.getRange(startRow + 6, currentCol).setValue(Math.round(actualDemand.total * marketShare / 1000) + "k");
    sheet.getRange(startRow + 9, currentCol).setValue(actualDemand.season || "");
  }
}

/**
 * Update supply section of S&OP Dashboard
 */
function updateSupplySection_(sheet, startRow, state, metrics) {
  const P = CONFIG.production;
  
  // Parts available
  const partsAvailable = (state.Raw_Material_Units || 0) + (state.Orders_In_Transit || 0);
  const partsNeeded = 200000 * P.PARTS_PER_UNIT;  // Estimated production need
  const partsGap = partsAvailable - partsNeeded;
  const partsStatus = partsGap >= 0 ? "OK" : "LOW";
  
  sheet.getRange(startRow + 13, 2).setValue(partsAvailable);
  sheet.getRange(startRow + 13, 3).setValue(partsNeeded);
  sheet.getRange(startRow + 13, 4).setValue(partsGap);
  sheet.getRange(startRow + 13, 5).setValue(partsStatus);
  if (partsStatus === "LOW") {
    sheet.getRange(startRow + 13, 5).setBackground("#f4cccc");
  } else {
    sheet.getRange(startRow + 13, 5).setBackground("#d9ead3");
  }
  
  // Capacity
  const capacity = (state.Capacity_Units || P.BASE_CAPACITY_PER_SHIFT) * 3;  // Max with 3 shifts
  const plannedProduction = 200000;  // Typical target
  const capacityGap = capacity - plannedProduction;
  const capacityStatus = capacityGap >= 0 ? "OK" : "CONSTRAINED";
  
  sheet.getRange(startRow + 14, 2).setValue(capacity);
  sheet.getRange(startRow + 14, 3).setValue(plannedProduction);
  sheet.getRange(startRow + 14, 4).setValue(capacityGap);
  sheet.getRange(startRow + 14, 5).setValue(capacityStatus);
  
  // Finished goods
  sheet.getRange(startRow + 15, 2).setValue(state.FG_Units || 0);
}

/**
 * Update inventory section of S&OP Dashboard
 */
function updateInventorySection_(sheet, startRow, state, metrics) {
  const M = CONFIG.market;
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  const quarterlyDemand = M.TOTAL_MARKET_SIZE / numFirms * (state.Market_Share || 0.333) / 0.333;
  const dailyDemand = quarterlyDemand / 90;
  
  // Raw materials
  const rawUnits = state.Raw_Material_Units || 0;
  const rawDays = dailyDemand > 0 ? Math.round(rawUnits / CONFIG.production.PARTS_PER_UNIT / dailyDemand) : 0;
  const rawStatus = rawDays >= 30 ? "OK" : (rawDays >= 15 ? "LOW" : "CRITICAL");
  sheet.getRange(startRow + 19, 2).setValue(rawUnits);
  sheet.getRange(startRow + 19, 3).setValue(rawDays);
  sheet.getRange(startRow + 19, 5).setValue(rawStatus);
  formatStatusCell_(sheet, startRow + 19, 5, rawStatus);
  
  // Finished goods
  const fgUnits = state.FG_Units || 0;
  const fgDays = dailyDemand > 0 ? Math.round(fgUnits / dailyDemand) : 0;
  const fgStatus = fgDays >= 20 ? "OK" : (fgDays >= 10 ? "LOW" : "CRITICAL");
  sheet.getRange(startRow + 20, 2).setValue(fgUnits);
  sheet.getRange(startRow + 20, 3).setValue(fgDays);
  sheet.getRange(startRow + 20, 5).setValue(fgStatus);
  formatStatusCell_(sheet, startRow + 20, 5, fgStatus);
  
  // Retailer inventory
  const retailerUnits = state.Retailer_Inventory || 0;
  const retailerDays = dailyDemand > 0 ? Math.round(retailerUnits / (dailyDemand * 0.55)) : 0;
  const retailerStatus = retailerDays >= 45 ? "OK" : (retailerDays >= 20 ? "LOW" : "CRITICAL");
  sheet.getRange(startRow + 21, 2).setValue(retailerUnits);
  sheet.getRange(startRow + 21, 3).setValue(retailerDays);
  sheet.getRange(startRow + 21, 5).setValue(retailerStatus);
  formatStatusCell_(sheet, startRow + 21, 5, retailerStatus);
  
  // In-transit
  const inTransit = state.Orders_In_Transit || 0;
  sheet.getRange(startRow + 22, 2).setValue(inTransit);
  
  // Total pipeline
  const totalPipeline = rawUnits + fgUnits + retailerUnits + inTransit;
  sheet.getRange(startRow + 23, 2).setValue(totalPipeline);
}

/**
 * Update key metrics section
 */
function updateMetricsSection_(sheet, startRow, state, metrics, forecastAccuracy) {
  const P = CONFIG.production;
  
  // Fill Rate
  const fillRate = metrics.fillRate || 0.95;
  const fillStatus = fillRate >= 0.95 ? "OK" : (fillRate >= 0.85 ? "WARN" : "CRITICAL");
  sheet.getRange(startRow + 26, 2).setValue((fillRate * 100).toFixed(1) + "%");
  sheet.getRange(startRow + 26, 5).setValue(fillStatus);
  formatStatusCell_(sheet, startRow + 26, 5, fillStatus);
  
  // CSI
  const csi = state.CSI || 80;
  const csiStatus = csi >= 80 ? "OK" : (csi >= 70 ? "WARN" : "CRITICAL");
  sheet.getRange(startRow + 27, 2).setValue(csi.toFixed(1));
  sheet.getRange(startRow + 27, 5).setValue(csiStatus);
  formatStatusCell_(sheet, startRow + 27, 5, csiStatus);
  
  // Perfect Order
  const po = state.Perfect_Order || 0.84;
  const poStatus = po >= 0.85 ? "OK" : (po >= 0.75 ? "WARN" : "CRITICAL");
  sheet.getRange(startRow + 28, 2).setValue((po * 100).toFixed(1) + "%");
  sheet.getRange(startRow + 28, 5).setValue(poStatus);
  formatStatusCell_(sheet, startRow + 28, 5, poStatus);
  
  // Forecast Accuracy (1 - MAPE)
  const mape = forecastAccuracy.mape || 0;
  const accuracy = 1 - mape;
  const accStatus = accuracy >= 0.85 ? "OK" : (accuracy >= 0.75 ? "WARN" : "CRITICAL");
  sheet.getRange(startRow + 29, 2).setValue((accuracy * 100).toFixed(1) + "%");
  sheet.getRange(startRow + 29, 5).setValue(accStatus);
  formatStatusCell_(sheet, startRow + 29, 5, accStatus);
  
  // Capacity Utilization
  const capacity = state.Capacity_Units || P.BASE_CAPACITY_PER_SHIFT;
  const produced = metrics.unitsProduced || 0;
  const capUtil = capacity > 0 ? produced / capacity : 0;
  const capStatus = (capUtil >= 0.70 && capUtil <= 0.85) ? "OK" : 
                    ((capUtil >= 0.60 && capUtil < 0.70) || (capUtil > 0.85 && capUtil <= 0.95)) ? "WARN" : "CRITICAL";
  sheet.getRange(startRow + 30, 2).setValue((capUtil * 100).toFixed(1) + "%");
  sheet.getRange(startRow + 30, 5).setValue(capStatus);
  formatStatusCell_(sheet, startRow + 30, 5, capStatus);
}

/**
 * Update quality section of S&OP Dashboard
 */
function updateQualitySection_(sheet, startRow, qualityResult) {
  const Q = CONFIG.quality;
  
  if (!qualityResult) {
    // No quality data - show defaults
    sheet.getRange(startRow + 33, 2).setValue("BASIC");
    sheet.getRange(startRow + 33, 5).setValue("$2.00");
    return;
  }
  
  // Get inspection config
  const inspLevel = qualityResult.inspectionLevel || "BASIC";
  const inspConfig = Q.INSPECTION[inspLevel] || Q.INSPECTION.BASIC;
  
  // Row 33: Inspection Level (data array index 33)
  sheet.getRange(startRow + 33, 2).setValue(inspLevel);
  sheet.getRange(startRow + 33, 5).setValue("$" + inspConfig.cost.toFixed(2));
  
  // Row 34: Defects Produced
  sheet.getRange(startRow + 34, 2).setValue(qualityResult.defectsProduced || 0);
  sheet.getRange(startRow + 34, 5).setValue((qualityResult.defectRate * 100).toFixed(1) + "%");
  
  // Row 35: Defects Detected  
  sheet.getRange(startRow + 35, 2).setValue(qualityResult.defectsDetected || 0);
  sheet.getRange(startRow + 35, 5).setValue((inspConfig.detectionRate * 100).toFixed(0) + "%");
  
  // Row 36: Defects Shipped (undetected)
  sheet.getRange(startRow + 36, 2).setValue(qualityResult.defectsUndetected || 0);
  const returnRatePct = (qualityResult.returnRate * 100).toFixed(2) + "%";
  sheet.getRange(startRow + 36, 5).setValue(returnRatePct);
  // Color code return rate
  if (qualityResult.returnRate > 0.02) {
    sheet.getRange(startRow + 36, 5).setBackground("#f4cccc");  // Red
  } else if (qualityResult.returnRate > 0.01) {
    sheet.getRange(startRow + 36, 5).setBackground("#fff2cc");  // Yellow
  } else {
    sheet.getRange(startRow + 36, 5).setBackground("#d9ead3");  // Green
  }
  
  // Row 37: Customer Returns
  sheet.getRange(startRow + 37, 2).setValue(qualityResult.returns || 0);
  sheet.getRange(startRow + 37, 5).setValue(qualityResult.csiPenalty.toFixed(1));
  
  // Row 38: Cost of Quality
  const coqFormatted = "$" + Math.round(qualityResult.totalQualityCost).toLocaleString();
  sheet.getRange(startRow + 38, 2).setValue(coqFormatted);
  
  // Breakdown in column D-E
  const breakdown = `Insp: $${Math.round(qualityResult.inspectionCost).toLocaleString()} | ` +
                   `Rework: $${Math.round(qualityResult.reworkCost).toLocaleString()} | ` +
                   `Returns: $${Math.round(qualityResult.returnCost).toLocaleString()}`;
  sheet.getRange(startRow + 38, 4).setValue(breakdown);
}

/**
 * Update logistics section of S&OP Dashboard
 */
function updateLogisticsSection_(sheet, startRow, transportResult) {
  const T = CONFIG.transport;
  
  if (!transportResult) {
    // No transport data - show defaults
    sheet.getRange(startRow + 41, 2).setValue("STANDARD");
    sheet.getRange(startRow + 41, 5).setValue("$3.00");
    return;
  }
  
  // Get shipping mode config
  const modeConfig = T.MODES[transportResult.shippingMode] || T.MODES.STANDARD;
  
  // Row 42: Shipping Mode (startRow + 41)
  sheet.getRange(startRow + 41, 2).setValue(transportResult.shippingMode);
  sheet.getRange(startRow + 41, 5).setValue("$" + modeConfig.costPerUnit.toFixed(2));
  
  // Row 43: Units Shipped (startRow + 42) - format as plain number
  sheet.getRange(startRow + 42, 2).setNumberFormat("#,##0").setValue(transportResult.unitsShipped || 0);
  sheet.getRange(startRow + 42, 5).setNumberFormat("0").setValue(modeConfig.transitDays);
  
  // Row 44: Freight Cost (startRow + 43)
  const freightFormatted = "$" + Math.round(transportResult.freightCost).toLocaleString();
  sheet.getRange(startRow + 43, 2).setValue(freightFormatted);
  const tmsDiscountPct = (transportResult.tmsDiscount * 100).toFixed(0) + "%";
  sheet.getRange(startRow + 43, 5).setValue(tmsDiscountPct);
  // Color code if TMS discount applied
  if (transportResult.tmsDiscount > 0) {
    sheet.getRange(startRow + 43, 5).setBackground("#d9ead3");  // Green
  }
  
  // Row 45: On-Time Bonus (startRow + 44)
  const onTimeBonusPct = "+" + (transportResult.onTimeBonus * 100).toFixed(0) + "%";
  sheet.getRange(startRow + 44, 2).setValue(onTimeBonusPct);
  // Color code bonus
  if (transportResult.onTimeBonus > 0) {
    sheet.getRange(startRow + 44, 2).setBackground("#d9ead3");  // Green
  } else {
    sheet.getRange(startRow + 44, 2).setBackground("#ffffff");  // White
  }
}

/**
 * Generate alerts for S&OP Dashboard
 */
function generateSOPAlerts_(sheet, startRow, state, metrics, forecastAccuracy, qualityResult, transportResult) {
  const alerts = [];
  
  // Low inventory alerts
  if ((state.Raw_Material_Units || 0) < 300000) {
    alerts.push("⚠️ Raw materials low - consider increasing orders");
  }
  if ((state.FG_Units || 0) < 50000) {
    alerts.push("⚠️ Finished goods low - risk of stockouts");
  }
  
  // Retailer mode alerts
  if (state.Retailer_Mode === "PANIC") {
    alerts.push("🚨 Retailer in PANIC mode - shipping 50% more!");
  }
  if (state.Retailer_Mode === "CLEARANCE") {
    alerts.push("⚠️ Retailer in CLEARANCE mode - discounting your product");
  }
  
  // Performance alerts
  if ((metrics.fillRate || 1) < 0.90) {
    alerts.push("⚠️ Fill rate below 90% - customers experiencing stockouts");
  }
  if ((state.CSI || 80) < 75) {
    alerts.push("⚠️ CSI below 75 - customer satisfaction declining");
  }
  if ((forecastAccuracy.mape || 0) > 0.25) {
    alerts.push("⚠️ Forecast error >25% - review demand patterns");
  }
  
  // Quality alerts
  if (qualityResult && qualityResult.returnRate > 0.02) {
    alerts.push("🔴 Return rate >2% - consider upgrading inspection level");
  }
  if (qualityResult && qualityResult.inspectionLevel === "NONE") {
    alerts.push("⚠️ No inspection - high defect risk to customers");
  }
  
  // Transport alerts
  if (transportResult && transportResult.shippingMode === "AIR") {
    alerts.push("✈️ Using AIR freight - high cost but fast delivery");
  }
  
  // Cash alerts
  if ((state.Cash || 0) < 15000000) {
    alerts.push("💰 Cash position low - monitor spending");
  }
  if ((state.Short_Term_Debt || 0) > 50000000) {
    alerts.push("💰 High debt level - interest costs increasing");
  }
  
  // Technology reminder
  if (!(state.Tech_Owned || "")) {
    alerts.push("💡 Consider investing in SC Technology for competitive advantage");
  }
  
  // Default if no alerts
  if (alerts.length === 0) {
    alerts.push("✅ No critical issues detected");
  }
  
  // Write alerts (max 3) - row 48 from start for alerts content (after header at row 47)
  for (let i = 0; i < 3; i++) {
    const alertText = alerts[i] || "";
    sheet.getRange(startRow + 47 + i, 1).setValue(alertText);
  }
}

/**
 * Format status cell with color
 */
function formatStatusCell_(sheet, row, col, status) {
  const colors = {
    "OK": "#d9ead3",       // Green
    "WARN": "#fff2cc",     // Yellow
    "LOW": "#fff2cc",      // Yellow
    "CRITICAL": "#f4cccc", // Red
    "CONSTRAINED": "#f4cccc"
  };
  sheet.getRange(row, col).setBackground(colors[status] || "#ffffff");
}

/******************************************************************************
 * PRE-HISTORY GENERATION
 ******************************************************************************/

function generatePreHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    "Generate Pre-History",
    "Generate Q1-Q3 with random variance?",
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;
  
  let lastResults = [];
  for (let q = 1; q <= CONFIG.simulation.PREHISTORY_QUARTERS; q++) {
    lastResults = runQuarterWithVariance_(ss, q);
    appendKPIHistory_(ss, q, lastResults);  // Log each quarter
  }
  
  // Update dashboard to show Q3 results
  updateDashboard_(ss, CONFIG.simulation.PREHISTORY_QUARTERS, lastResults);
  
  // Update 10-Q Report
  update10QReport_(ss, CONFIG.simulation.PREHISTORY_QUARTERS);
  
  // Update S&OP Dashboard
  updateSOPDashboard_(ss, CONFIG.simulation.PREHISTORY_QUARTERS, lastResults, null);
  
  // Update Balanced Scorecard
  updateBalancedScorecard_(ss, CONFIG.simulation.PREHISTORY_QUARTERS, lastResults);
  
  // Update SCRM Dashboard
  updateSCRMDashboard_(ss, CONFIG.simulation.PREHISTORY_QUARTERS, lastResults);
  
  // Update Supplier Scorecards (if function exists)
  if (typeof updateSupplierScorecards_ === 'function') {
    updateSupplierScorecards_(ss, CONFIG.simulation.PREHISTORY_QUARTERS);
  }
  
  ui.alert("Pre-History Complete", "Q1-Q3 generated. Players take control at Q4.", ui.ButtonSet.OK);
}

/**
 * Update the 10-Q Report with current quarter data
 * Shows last 4 quarters of data with YTD totals
 * Includes: Income Statement, Cash Flow, Balance Sheet, Inventory Report, Key Metrics
 */
function update10QReport_(ss, quarter) {
  const reportSheet = ss.getSheetByName(CONFIG.sheets.REPORT);
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  const dbSheet = ss.getSheetByName(CONFIG.sheets.DATABASE);
  
  const C = CONFIG.costs;
  const F = CONFIG.financial;
  
  const stockData = stocksSheet.getDataRange().getValues();
  const stockHeaders = stockData[0];
  const dbData = dbSheet.getDataRange().getValues();
  const dbHeaders = dbData[0];
  
  // Helper to get column index
  const stockCol = (name) => stockHeaders.indexOf(name);
  const dbCol = (name) => dbHeaders.indexOf(name);
  
  // Determine which 4 quarters to show (current year or rolling)
  const startQ = Math.max(1, quarter - 3);
  const quarters = [];
  for (let q = startQ; q <= Math.min(startQ + 3, quarter); q++) {
    quarters.push(q);
  }
  
  // Collect data for each quarter
  const quarterData = [];
  let prevCash = 50000000;  // Starting cash
  
  for (const q of quarters) {
    // Find Firm 1's data for this quarter
    let stockRow = null, dbRow = null;
    
    for (let i = stockData.length - 1; i >= 1; i--) {
      if (stockData[i][stockCol("Firm_ID")] == 1 && stockData[i][stockCol("Quarter")] == q) {
        stockRow = stockData[i];
        break;
      }
    }
    
    for (let i = dbData.length - 1; i >= 1; i--) {
      if (dbData[i][dbCol("Firm_ID")] == 1 && dbData[i][dbCol("Quarter")] == q) {
        dbRow = dbData[i];
        break;
      }
    }
    
    if (!stockRow || !dbRow) {
      quarterData.push(null);
      continue;
    }
    
    const getStock = (col) => stockRow[stockCol(col)] || 0;
    const getDb = (col) => dbRow[dbCol(col)] || 0;
    
    // Income Statement
    const revenue = getDb("O_Revenue");
    const cogs = getDb("O_COGS");
    const grossMargin = getDb("O_Gross_Margin");
    const laborCost = getDb("O_Labor_Cost");
    const netIncome = getDb("O_Net_Income");
    const marketing = getDb("D_Marketing_Budget");
    
    // Inventory data
    const rawUnits = getStock("Raw_Material_Units");
    const fgUnits = getStock("FG_Units");
    const inTransit = getStock("In_Transit_Units") || getStock("Orders_In_Transit") || 0;
    const retailerInv = getStock("Retailer_Inventory") || 0;
    
    // Calculate costs
    const holdingCost = (rawUnits + fgUnits) * F.HOLDING_COST_PER_UNIT;
    const interest = (getStock("Short_Term_Debt") + getStock("Long_Term_Debt")) * F.CREDIT_LINE_RATE / 4;
    
    // Tech maintenance (estimate from owned tech)
    const techOwned = getStock("Tech_Owned") || "";
    const numTech = techOwned ? techOwned.split(",").filter(t => t).length : 0;
    const techMaintenance = numTech * 500000 * 0.15 / 4;
    
    // Quality and freight costs
    const fillRate = getDb("O_Fill_Rate") || 0.9;
    const qualityCost = revenue * 0.01;
    const unitsSold = getDb("O_Units_Sold") || 0;
    const freightCost = unitsSold * 3;
    
    const totalOpex = laborCost + holdingCost + marketing + techMaintenance + qualityCost + freightCost;
    const opIncome = grossMargin - totalOpex;
    
    // Cash Flow
    const endingCash = getStock("Cash");
    const cashChange = endingCash - prevCash;
    
    // Inventory values
    const rawValue = rawUnits * C.RAW_MATERIAL_COST;
    const fgValue = fgUnits * C.STANDARD_COGS;
    const totalInvValue = rawValue + fgValue;
    
    // Days of supply calculations (based on daily usage)
    const dailySales = unitsSold / 90;  // 90 days per quarter
    const dailyProduction = (getDb("O_Units_Produced") || unitsSold) / 90;
    const rawDOS = dailyProduction > 0 ? rawUnits / dailyProduction : 0;
    const fgDOS = dailySales > 0 ? fgUnits / dailySales : 0;
    
    // Total pipeline
    const totalPipeline = rawUnits + fgUnits + inTransit + retailerInv;
    
    // Inventory turnover (annualized COGS / avg inventory)
    const invTurnover = totalInvValue > 0 ? (cogs * 4) / totalInvValue : 0;
    
    // Weeks of supply
    const weeksOfSupply = dailySales > 0 ? (fgUnits + retailerInv) / (dailySales * 7) : 0;
    
    quarterData.push({
      q: q,
      // Income Statement
      revenue, cogs, grossMargin,
      laborCost, holdingCost, marketing, techMaintenance, qualityCost, freightCost,
      totalOpex, opIncome, interest, netIncome,
      // Cash Flow
      cashFromOps: netIncome + holdingCost * 0.1,
      techPurchases: 0,
      debtChange: 0,
      cashChange, prevCash, endingCash,
      // Balance Sheet
      cash: endingCash,
      ar: getStock("Accounts_Receivable"),
      invValue: totalInvValue,
      fixedAssets: getStock("Fixed_Assets"),
      ap: getStock("Accounts_Payable"),
      stDebt: getStock("Short_Term_Debt"),
      ltDebt: getStock("Long_Term_Debt"),
      // Inventory Report
      rawUnits, rawValue, rawDOS,
      fgUnits, fgValue, fgDOS,
      inTransit, retailerInv,
      totalPipeline, totalInvValue, invTurnover, weeksOfSupply,
      // Metrics
      unitsProduced: getDb("O_Units_Produced"),
      unitsSold: unitsSold,
      fillRate: fillRate,
      csi: getStock("CSI"),
      marketShare: getStock("Market_Share"),
      perfectOrder: 0.84,
      forecastAccuracy: 0.80,
    });
    
    prevCash = endingCash;
  }
  
  // Write data to sheet
  const colOffset = 2;  // Column B = index 2
  
  for (let i = 0; i < quarterData.length; i++) {
    const d = quarterData[i];
    const col = colOffset + i;
    
    if (!d) continue;
    
    // Income Statement (rows 4-19)
    reportSheet.getRange(4, col).setValue(d.revenue);
    reportSheet.getRange(5, col).setValue(d.cogs);
    reportSheet.getRange(6, col).setValue(d.grossMargin);
    reportSheet.getRange(9, col).setValue(d.laborCost);
    reportSheet.getRange(10, col).setValue(d.holdingCost);
    reportSheet.getRange(11, col).setValue(d.marketing);
    reportSheet.getRange(12, col).setValue(d.techMaintenance);
    reportSheet.getRange(13, col).setValue(d.qualityCost);
    reportSheet.getRange(14, col).setValue(d.freightCost);
    reportSheet.getRange(15, col).setValue(d.totalOpex);
    reportSheet.getRange(17, col).setValue(d.opIncome);
    reportSheet.getRange(18, col).setValue(d.interest);
    reportSheet.getRange(19, col).setValue(d.netIncome);
    
    // Cash Flow (rows 23-38)
    reportSheet.getRange(23, col).setValue(d.netIncome);
    reportSheet.getRange(24, col).setValue(0);  // Depreciation
    reportSheet.getRange(25, col).setValue(0);  // Working capital
    reportSheet.getRange(26, col).setValue(d.netIncome);
    reportSheet.getRange(29, col).setValue(-d.techPurchases);
    reportSheet.getRange(30, col).setValue(-d.techPurchases);
    reportSheet.getRange(33, col).setValue(d.debtChange);
    reportSheet.getRange(34, col).setValue(d.debtChange);
    reportSheet.getRange(36, col).setValue(d.cashChange);
    reportSheet.getRange(37, col).setValue(d.prevCash);
    reportSheet.getRange(38, col).setValue(d.endingCash);
    
    // Inventory Report (rows 59-73)
    reportSheet.getRange(59, col).setValue(d.rawUnits);
    reportSheet.getRange(60, col).setValue(d.rawValue);
    reportSheet.getRange(61, col).setValue(d.rawDOS.toFixed(0));
    reportSheet.getRange(63, col).setValue(d.fgUnits);
    reportSheet.getRange(64, col).setValue(d.fgValue);
    reportSheet.getRange(65, col).setValue(d.fgDOS.toFixed(0));
    reportSheet.getRange(66, col).setValue(d.inTransit);
    reportSheet.getRange(67, col).setValue(d.retailerInv);
    reportSheet.getRange(69, col).setValue(d.totalPipeline);
    reportSheet.getRange(70, col).setValue(d.totalInvValue);
    reportSheet.getRange(71, col).setValue(d.invTurnover.toFixed(1));
    reportSheet.getRange(72, col).setValue(d.weeksOfSupply.toFixed(1));
    
    // Balance Sheet (rows 42-55)
    reportSheet.getRange(42, col).setValue(d.cash);
    reportSheet.getRange(43, col).setValue(d.ar);
    reportSheet.getRange(44, col).setValue(d.invValue);
    const qTotalCurrentAssets = d.cash + d.ar + d.invValue;
    reportSheet.getRange(45, col).setValue(qTotalCurrentAssets);
    reportSheet.getRange(46, col).setValue(d.fixedAssets);
    reportSheet.getRange(47, col).setValue(qTotalCurrentAssets + d.fixedAssets);
    reportSheet.getRange(50, col).setValue(d.ap);
    reportSheet.getRange(51, col).setValue(d.stDebt);
    reportSheet.getRange(52, col).setValue(d.ltDebt);
    const qTotalLiab = d.ap + d.stDebt + d.ltDebt;
    reportSheet.getRange(53, col).setValue(qTotalLiab);
    const qEquity = qTotalCurrentAssets + d.fixedAssets - qTotalLiab;
    reportSheet.getRange(54, col).setValue(qEquity);
    reportSheet.getRange(55, col).setValue(qTotalCurrentAssets + d.fixedAssets);  // Total Liab + Equity
    
    // Key Metrics (rows 75-81)
    reportSheet.getRange(75, col).setValue(d.unitsProduced);
    reportSheet.getRange(76, col).setValue(d.unitsSold);
    reportSheet.getRange(77, col).setValue((d.fillRate * 100).toFixed(0) + "%");
    reportSheet.getRange(78, col).setValue(d.csi.toFixed(1));
    reportSheet.getRange(79, col).setValue((d.marketShare * 100).toFixed(1) + "%");
    reportSheet.getRange(80, col).setValue((d.perfectOrder * 100).toFixed(0) + "%");
    reportSheet.getRange(81, col).setValue((d.forecastAccuracy * 100).toFixed(0) + "%");
  }
  
  // Calculate YTD/Current totals (column F = 6)
  const ytdCol = 6;
  const validData = quarterData.filter(d => d);
  if (validData.length > 0) {
    const sum = (field) => validData.reduce((acc, d) => acc + (d[field] || 0), 0);
    const avg = (field) => sum(field) / validData.length;
    const last = validData[validData.length - 1];
    
    // Income Statement YTD sums
    reportSheet.getRange(4, ytdCol).setValue(sum("revenue"));
    reportSheet.getRange(5, ytdCol).setValue(sum("cogs"));
    reportSheet.getRange(6, ytdCol).setValue(sum("grossMargin"));
    reportSheet.getRange(9, ytdCol).setValue(sum("laborCost"));
    reportSheet.getRange(10, ytdCol).setValue(sum("holdingCost"));
    reportSheet.getRange(11, ytdCol).setValue(sum("marketing"));
    reportSheet.getRange(12, ytdCol).setValue(sum("techMaintenance"));
    reportSheet.getRange(13, ytdCol).setValue(sum("qualityCost"));
    reportSheet.getRange(14, ytdCol).setValue(sum("freightCost"));
    reportSheet.getRange(15, ytdCol).setValue(sum("totalOpex"));
    reportSheet.getRange(17, ytdCol).setValue(sum("opIncome"));
    reportSheet.getRange(18, ytdCol).setValue(sum("interest"));
    reportSheet.getRange(19, ytdCol).setValue(sum("netIncome"));
    
    // Cash Flow YTD
    reportSheet.getRange(23, ytdCol).setValue(sum("netIncome"));
    reportSheet.getRange(26, ytdCol).setValue(sum("netIncome"));
    reportSheet.getRange(36, ytdCol).setValue(sum("cashChange"));
    
    // Balance Sheet "Current" (column F = 6)
    reportSheet.getRange(42, ytdCol).setValue(last.cash);
    reportSheet.getRange(43, ytdCol).setValue(last.ar);
    reportSheet.getRange(44, ytdCol).setValue(last.invValue);
    const totalCurrentAssets = last.cash + last.ar + last.invValue;
    reportSheet.getRange(45, ytdCol).setValue(totalCurrentAssets);
    reportSheet.getRange(46, ytdCol).setValue(last.fixedAssets);
    reportSheet.getRange(47, ytdCol).setValue(totalCurrentAssets + last.fixedAssets);
    reportSheet.getRange(50, ytdCol).setValue(last.ap);
    reportSheet.getRange(51, ytdCol).setValue(last.stDebt);
    reportSheet.getRange(52, ytdCol).setValue(last.ltDebt);
    const totalLiab = last.ap + last.stDebt + last.ltDebt;
    reportSheet.getRange(53, ytdCol).setValue(totalLiab);
    const equity = totalCurrentAssets + last.fixedAssets - totalLiab;
    reportSheet.getRange(54, ytdCol).setValue(equity);
    reportSheet.getRange(55, ytdCol).setValue(totalCurrentAssets + last.fixedAssets);  // Total Liab + Equity
    
    // Inventory Report - Current values (column F)
    reportSheet.getRange(59, ytdCol).setValue(last.rawUnits);
    reportSheet.getRange(60, ytdCol).setValue(last.rawValue);
    reportSheet.getRange(61, ytdCol).setValue(last.rawDOS.toFixed(0));
    reportSheet.getRange(63, ytdCol).setValue(last.fgUnits);
    reportSheet.getRange(64, ytdCol).setValue(last.fgValue);
    reportSheet.getRange(65, ytdCol).setValue(last.fgDOS.toFixed(0));
    reportSheet.getRange(66, ytdCol).setValue(last.inTransit);
    reportSheet.getRange(67, ytdCol).setValue(last.retailerInv);
    reportSheet.getRange(69, ytdCol).setValue(last.totalPipeline);
    reportSheet.getRange(70, ytdCol).setValue(last.totalInvValue);
    reportSheet.getRange(71, ytdCol).setValue(last.invTurnover.toFixed(1));
    reportSheet.getRange(72, ytdCol).setValue(last.weeksOfSupply.toFixed(1));
    
    // Key Metrics averages
    reportSheet.getRange(75, ytdCol).setValue(sum("unitsProduced"));
    reportSheet.getRange(76, ytdCol).setValue(sum("unitsSold"));
    reportSheet.getRange(77, ytdCol).setValue((avg("fillRate") * 100).toFixed(0) + "%");
    reportSheet.getRange(78, ytdCol).setValue(avg("csi").toFixed(1));
    reportSheet.getRange(79, ytdCol).setValue((avg("marketShare") * 100).toFixed(1) + "%");
    reportSheet.getRange(80, ytdCol).setValue((avg("perfectOrder") * 100).toFixed(0) + "%");
    reportSheet.getRange(81, ytdCol).setValue((avg("forecastAccuracy") * 100).toFixed(0) + "%");
  }
}

/**
 * Update Balanced Scorecard with current quarter data for all firms
 */
function updateBalancedScorecard_(ss, quarter, results) {
  const bscSheet = ss.getSheetByName(CONFIG.sheets.BALANCED_SCORECARD);
  if (!bscSheet) return;
  
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  const stockData = stocksSheet.getDataRange().getValues();
  const stockHeaders = stockData[0];
  
  // Update quarter display
  bscSheet.getRange(2, 1).setValue("Current Quarter: " + quarter);
  
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  const firmScores = [];
  
  for (let f = 1; f <= numFirms; f++) {
    const col = f + 1;  // Column B=2, C=3, D=4
    
    // Get firm data from results array
    const result = results && results[f - 1] ? results[f - 1] : null;
    
    // Get stock data for this firm
    let stockRow = null;
    for (let i = stockData.length - 1; i >= 1; i--) {
      if (stockData[i][stockHeaders.indexOf("Firm_ID")] == f && 
          stockData[i][stockHeaders.indexOf("Quarter")] == quarter) {
        stockRow = stockData[i];
        break;
      }
    }
    
    const getStock = (name) => stockRow ? (stockRow[stockHeaders.indexOf(name)] || 0) : 0;
    
    // === FINANCIAL PERSPECTIVE (rows 5-9) ===
    const netIncome = result ? result.netIncome / 1000000 : 0;
    const revenue = result ? result.revenue / 1000000 : 0;
    // Use grossMargin from result (it's already calculated as $ amount)
    const grossMarginPct = result && result.revenue > 0 && result.grossMargin ? 
      (result.grossMargin / result.revenue * 100) : 35;  // Default 35%
    const cash = getStock("Cash") / 1000000;
    
    bscSheet.getRange(5, col).setValue(netIncome.toFixed(1));
    bscSheet.getRange(6, col).setValue(revenue.toFixed(1));
    bscSheet.getRange(7, col).setValue(grossMarginPct.toFixed(0) + "%");
    bscSheet.getRange(8, col).setValue(cash.toFixed(1));
    
    // Financial score (0-100)
    const finScore = Math.min(100, 
      (netIncome > 5 ? 30 : Math.max(0, netIncome / 5 * 30)) +
      (revenue > 70 ? 25 : revenue / 70 * 25) +
      (grossMarginPct > 35 ? 25 : grossMarginPct / 35 * 25) +
      (cash > 20 ? 20 : cash / 20 * 20)
    );
    bscSheet.getRange(9, col).setValue(finScore.toFixed(0));
    
    // === CUSTOMER PERSPECTIVE (rows 12-16) ===
    const csi = getStock("CSI") || 80;
    const marketShare = (getStock("Market_Share") || 0.333) * 100;
    const fillRate = result ? (result.fillRate || 0.9) * 100 : 90;
    const returnRate = result && result.qualityResult ? result.qualityResult.returnRate * 100 : 0;
    
    bscSheet.getRange(12, col).setValue(csi.toFixed(1));
    bscSheet.getRange(13, col).setValue(marketShare.toFixed(1) + "%");
    bscSheet.getRange(14, col).setValue(fillRate.toFixed(0) + "%");
    bscSheet.getRange(15, col).setValue(returnRate.toFixed(2) + "%");
    
    // Customer score (0-100)
    const custScore = Math.min(100,
      (csi > 85 ? 30 : (csi - 50) / 35 * 30) +
      (marketShare > 35 ? 25 : marketShare / 35 * 25) +
      (fillRate > 95 ? 25 : fillRate / 95 * 25) +
      (returnRate < 1 ? 20 : Math.max(0, (3 - returnRate) / 3 * 20))
    );
    bscSheet.getRange(16, col).setValue(custScore.toFixed(0));
    
    // === INTERNAL PROCESS PERSPECTIVE (rows 19-23) ===
    const perfectOrder = result ? (result.perfectOrder || 0.84) * 100 : 84;
    const unitsProduced = result && result.unitsProduced ? result.unitsProduced : 0;
    const maxCapacity = CONFIG.production.BASE_CAPACITY_PER_SHIFT * 3;
    const capacityUtil = maxCapacity > 0 ? (unitsProduced / maxCapacity) * 100 : 0;
    const defectRate = result && result.qualityResult ? result.qualityResult.defectRate * 100 : 3;
    const onTime = result && result.poComponents ? result.poComponents.onTime * 100 : 92;
    
    bscSheet.getRange(19, col).setValue(perfectOrder.toFixed(0) + "%");
    bscSheet.getRange(20, col).setValue(capacityUtil.toFixed(0) + "%");
    bscSheet.getRange(21, col).setValue(defectRate.toFixed(1) + "%");
    bscSheet.getRange(22, col).setValue(onTime.toFixed(0) + "%");
    
    // Process score (0-100) - capacity utilization sweet spot is 70-85%
    const capScore = capacityUtil >= 70 && capacityUtil <= 85 ? 25 : 
      (capacityUtil < 70 ? capacityUtil / 70 * 25 : Math.max(0, (100 - capacityUtil) / 15 * 25));
    const procScore = Math.min(100,
      (perfectOrder > 90 ? 30 : perfectOrder / 90 * 30) +
      capScore +
      (defectRate < 2 ? 25 : Math.max(0, (5 - defectRate) / 5 * 25)) +
      (onTime > 95 ? 20 : onTime / 95 * 20)
    );
    bscSheet.getRange(23, col).setValue(procScore.toFixed(0));
    
    // === LEARNING & GROWTH PERSPECTIVE (rows 26-30) ===
    const techOwned = getStock("Tech_Owned") || "";
    const numTech = techOwned ? techOwned.split(",").filter(t => t).length : 0;
    const forecastAcc = result && result.forecastAccuracy ? (1 - result.forecastAccuracy) * 100 : 80;
    const techInvestment = numTech * 2;  // Rough estimate in $M
    
    // SC Maturity Level based on tech and metrics
    let maturityLevel = "Basic";
    if (numTech >= 4 && perfectOrder > 85 && forecastAcc > 80) maturityLevel = "Advanced";
    else if (numTech >= 2 && perfectOrder > 80) maturityLevel = "Developing";
    
    bscSheet.getRange(26, col).setValue(numTech);
    bscSheet.getRange(27, col).setValue(forecastAcc.toFixed(0) + "%");
    bscSheet.getRange(28, col).setValue(maturityLevel);
    bscSheet.getRange(29, col).setValue(techInvestment.toFixed(1));
    
    // Learning score (0-100)
    const learnScore = Math.min(100,
      (numTech >= 4 ? 30 : numTech / 4 * 30) +
      (forecastAcc > 85 ? 30 : forecastAcc / 85 * 30) +
      (maturityLevel === "Advanced" ? 20 : (maturityLevel === "Developing" ? 10 : 0)) +
      (techInvestment > 3 ? 20 : techInvestment / 3 * 20)
    );
    bscSheet.getRange(30, col).setValue(learnScore.toFixed(0));
    
    // === OVERALL SCORE ===
    const weightedScore = (finScore * 0.25) + (custScore * 0.25) + (procScore * 0.25) + (learnScore * 0.25);
    firmScores.push({ firm: f, score: weightedScore, col: col });
    
    bscSheet.getRange(33, col).setValue(weightedScore.toFixed(0));
    
    // Grade
    let grade = "D";
    if (weightedScore >= 90) grade = "A";
    else if (weightedScore >= 80) grade = "B";
    else if (weightedScore >= 70) grade = "C";
    bscSheet.getRange(35, col).setValue(grade);
  }
  
  // Calculate ranks
  firmScores.sort((a, b) => b.score - a.score);
  for (let i = 0; i < firmScores.length; i++) {
    bscSheet.getRange(34, firmScores[i].col).setValue(i + 1);
  }
  
  // Color code scores (green > 80, yellow 60-80, red < 60)
  for (let f = 1; f <= numFirms; f++) {
    const col = f + 1;
    [9, 16, 23, 30, 33].forEach(row => {
      const score = parseFloat(bscSheet.getRange(row, col).getValue()) || 0;
      let bgColor = "#f4cccc";  // Red
      if (score >= 80) bgColor = "#d9ead3";  // Green
      else if (score >= 60) bgColor = "#fff2cc";  // Yellow
      bscSheet.getRange(row, col).setBackground(bgColor);
    });
  }
}

function runQuarterWithVariance_(ss, quarter) {
  const stocksSheet = ss.getSheetByName(CONFIG.sheets.STOCKS);
  const dbSheet = ss.getSheetByName(CONFIG.sheets.DATABASE);
  const stockData = stocksSheet.getDataRange().getValues();
  const headers = stockData[0];
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  const variance = CONFIG.preHistory.VARIANCE_RANGE;
  
  const P = CONFIG.production;
  const C = CONFIG.costs;
  const F = CONFIG.financial;
  const M = CONFIG.market;
  const R = CONFIG.retailer;
  const S = CONFIG.seasonality;
  const CP = CONFIG.customer.POOLS;
  const PO = CONFIG.perfectOrder;
  
  // Seasonality for pre-history
  const calendarQuarter = ((quarter - 1) % 4) + 1;
  const seasonalMultiplier = S.ENABLED ? S.QUARTERS[calendarQuarter] : 1.0;
  
  // Generate actual market demand for this quarter (for demand history)
  const actualMarketDemand = {
    R1: Math.round(M.TOTAL_MARKET_SIZE * M.REGIONS[1].marketShare * seasonalMultiplier),
    R2: Math.round(M.TOTAL_MARKET_SIZE * M.REGIONS[2].marketShare * seasonalMultiplier),
    R3: Math.round(M.TOTAL_MARKET_SIZE * M.REGIONS[3].marketShare * seasonalMultiplier),
    total: Math.round(M.TOTAL_MARKET_SIZE * seasonalMultiplier),
    season: getSeasonLabel_(calendarQuarter, seasonalMultiplier)
  };
  
  // Record to demand history
  recordDemandHistory_(ss, quarter, actualMarketDemand);
  
  // Generate "naive" forecasts for pre-history (base demand without seasonality adjustment)
  // This simulates what an inexperienced forecaster might predict
  const naiveForecast = {
    R1: Math.round(M.TOTAL_MARKET_SIZE * M.REGIONS[1].marketShare),
    R2: Math.round(M.TOTAL_MARKET_SIZE * M.REGIONS[2].marketShare),
    R3: Math.round(M.TOTAL_MARKET_SIZE * M.REGIONS[3].marketShare)
  };
  
  const results = [];
  
  for (let firmId = 1; firmId <= numFirms; firmId++) {
    // Record forecast accuracy for this firm (using naive forecast - treated as GUT)
    recordForecastAccuracy_(ss, quarter, firmId, naiveForecast, actualMarketDemand, "GUT");
    
    // Find state
    const firmCol = headers.indexOf("Firm_ID");
    let state = null;
    for (let i = stockData.length - 1; i >= 1; i--) {
      if (stockData[i][firmCol] === firmId) {
        state = {};
        headers.forEach((h, idx) => { state[h] = stockData[i][idx]; });
        break;
      }
    }
    
    if (!state) continue;
    
    // Random decisions - scaled to market size
    const rand = () => 1 + (Math.random() * 2 - 1) * variance;
    const decisions = {
      orderGlobal: Math.round(600000 * rand()),
      productionP1: Math.round(120000 * rand()),
      productionP2: Math.round(80000 * rand()),
      shifts: 1,
      priceP1: Math.round(500 * rand()),
      priceP2: Math.round(850 * rand()),
      marketingBudget: Math.round(5000000 * rand()),
    };
    
    // Procurement
    const arrivingParts = state.Orders_In_Transit || 0;
    const totalPartsAvailable = state.Raw_Material_Units + arrivingParts;
    const procurementCost = decisions.orderGlobal * C.RAW_MATERIAL_COST;
    
    // Production
    const targetTotal = decisions.productionP1 + decisions.productionP2;
    const maxFromParts = Math.floor(totalPartsAvailable / P.PARTS_PER_UNIT);
    const actualProduction = Math.min(targetTotal, maxFromParts, state.Capacity_Units);
    const partsConsumed = actualProduction * P.PARTS_PER_UNIT;
    const laborCost = actualProduction * P.LABOR_COST_PER_UNIT;
    
    // Inventory
    const endingRawUnits = totalPartsAvailable - partsConsumed;
    const availableFGUnits = state.FG_Units + actualProduction;
    
    // Retailer Brain (simplified for pre-history)
    // VMI is per-firm decision, but module must be enabled in Admin
    const vmiModuleEnabled = isAdvancedModuleEnabled_(ss, "VMI (Vendor Managed Inventory)");
    const firmVMI = vmiModuleEnabled && (decisions.enableVMI || false);
    const retailerState = processRetailerBrain_(state, availableFGUnits, decisions, firmVMI);
    
    // Demand & Sales with retail channel and seasonality
    let baseDemand = M.TOTAL_MARKET_SIZE * state.Market_Share;
    baseDemand = baseDemand * seasonalMultiplier;
    
    const avgPrice = (decisions.priceP1 * M.PRODUCTS.P1.marketShare) + 
                     (decisions.priceP2 * M.PRODUCTS.P2.marketShare);
    const baseAvgPrice = (M.PRODUCTS.P1.basePrice * M.PRODUCTS.P1.marketShare) + 
                         (M.PRODUCTS.P2.basePrice * M.PRODUCTS.P2.marketShare);
    const priceEffect = baseAvgPrice / avgPrice;
    const csiEffect = state.CSI / 80;
    const totalDemand = Math.round(baseDemand * priceEffect * csiEffect);
    
    // Split between channels
    const retailDemand = Math.round(totalDemand * R.CHANNEL_SHARE);
    const directDemand = totalDemand - retailDemand;
    
    const retailSales = Math.min(retailDemand, retailerState.retailerInventory);
    const fgAfterRetailer = availableFGUnits - retailerState.shipmentToRetailer;
    const directSales = Math.min(directDemand, Math.max(0, fgAfterRetailer));
    const unitsSold = retailSales + directSales;
    const stockoutUnits = totalDemand - unitsSold;
    const fillRate = totalDemand > 0 ? unitsSold / totalDemand : 1;
    
    const endingFGUnits = Math.max(0, availableFGUnits - retailerState.shipmentToRetailer - directSales);
    const endingRetailerInv = retailerState.retailerInventory - retailSales + retailerState.shipmentToRetailer;
    
    // Customer pools - simplified for pre-history
    const poolResult = processCustomerPools_(state, decisions, fillRate, stockoutUnits);
    
    // Financials
    const directRevenue = directSales * avgPrice;
    const wholesalePrice = avgPrice * (1 - R.MARKUP);
    const retailRevenue = retailerState.shipmentToRetailer * wholesalePrice;
    const revenue = directRevenue + retailRevenue;
    
    const cogs = (retailerState.shipmentToRetailer + directSales) * C.STANDARD_COGS;
    const grossMargin = revenue - cogs;
    const holdingCost = (endingRawUnits + endingFGUnits) * F.HOLDING_COST_PER_UNIT;
    const totalOpex = laborCost + holdingCost + decisions.marketingBudget;
    const operatingIncome = grossMargin - totalOpex;
    const interest = (state.Short_Term_Debt + state.Long_Term_Debt) * F.CREDIT_LINE_RATE / 4;
    const netIncome = operatingIncome - interest;
    
    const cashIn = revenue * 0.9;
    const cashOut = procurementCost + laborCost + holdingCost + decisions.marketingBudget + interest;
    let newCash = state.Cash + cashIn - cashOut;
    let newDebt = state.Short_Term_Debt;
    if (newCash < F.CASH_FLOOR) {
      newDebt += F.CASH_FLOOR - newCash;
      newCash = F.CASH_FLOOR;
    }
    
    const newCSI = state.CSI * 0.7 + fillRate * 100 * 0.3;
    
    // Perfect Order (base rates for pre-history)
    const initialPO = PO.BASE_ON_TIME * PO.BASE_IN_FULL * PO.BASE_DAMAGE_FREE * PO.BASE_DOCUMENTATION;
    
    // Write state (includes all columns: customer pool, PO, Tech, Advanced Modules)
    const newRow = [
      quarter, firmId, new Date().toISOString(),
      newCash, state.Accounts_Receivable + (revenue * 0.1),
      endingRawUnits, endingFGUnits, 0,
      state.Fixed_Assets, state.Accounts_Payable,
      newDebt, state.Long_Term_Debt, state.Capacity_Units,
      newCSI, state.Market_Share,
      state.Cumulative_Revenue + revenue, state.Cumulative_Profit + netIncome,
      decisions.orderGlobal,
      endingRetailerInv,
      retailerState.mode,
      poolResult.loyalCustomers,
      poolResult.inPlayCustomers,
      decisions.priceP1,
      "",  // No events during pre-history
      // Perfect Order components
      PO.BASE_ON_TIME,
      PO.BASE_IN_FULL,
      PO.BASE_DAMAGE_FREE,
      PO.BASE_DOCUMENTATION,
      initialPO,
      // Technology (none during pre-history)
      "",  // Tech_Owned
      0,   // Tech_Maintenance_Cost
      // === ADVANCED: Capacity Expansion (none during pre-history) ===
      "[]",  // Expansion_InProgress
      0,     // Additional_Capacity
      0,     // Expansion_Maintenance
      // === ADVANCED: Regional DCs (none during pre-history) ===
      false, // DC_East_Open
      0,     // DC_East_Inventory
      false, // DC_Central_Open
      0,     // DC_Central_Inventory
      false, // DC_West_Open
      0,     // DC_West_Inventory
      0,     // DC_Total_Opex
      // === ADVANCED: Green Score ===
      50,    // Green_Score (starts neutral)
      "RECYCLE",  // Disposal_Method (default)
      // === ADVANCED: VMI ===
      false  // VMI_Active (not during pre-history)
    ];
    
    stocksSheet.appendRow(newRow);
    
    dbSheet.appendRow([
      quarter, firmId, new Date().toISOString(),
      decisions.orderGlobal, 0, decisions.productionP1, decisions.productionP2, 1,
      decisions.priceP1, decisions.priceP2, decisions.marketingBudget,
      actualProduction, unitsSold, revenue, cogs, laborCost,
      grossMargin, netIncome, fillRate, newCSI
    ]);
    
    // Record supplier performance (if function exists)
    if (decisions.orderGlobal > 0 && typeof recordSupplierPerformance_ === 'function') {
      recordSupplierPerformance_(ss, quarter, firmId, "GLOBAL", decisions.orderGlobal, decisions.orderGlobal);
    }
    
    // Refresh stockData
    stockData.push(newRow);
    
    // Collect results for dashboard (include all fields needed by BSC and S&OP)
    results.push({
      revenue,
      netIncome,
      grossMargin,
      csi: newCSI,
      marketShare: state.Market_Share,
      unitsSold,
      unitsProduced: actualProduction,
      fillRate: fillRate,
      perfectOrder: initialPO,
      retailerMode: retailerState.mode,
      churnedCustomers: poolResult.churnedCustomers,
      // Quality result (defaults for pre-history)
      qualityResult: {
        inspectionLevel: "BASIC",
        defectRate: 0.03,
        returnRate: 0,
        defectsProduced: Math.round(actualProduction * 0.03),
        defectsDetected: Math.round(actualProduction * 0.03 * 0.70),
        defectsUndetected: Math.round(actualProduction * 0.03 * 0.30),
        returns: 0,
        csiPenalty: 0,
        totalQualityCost: actualProduction * 0.01,
        inspectionCost: actualProduction * 0.01,
        reworkCost: 0,
        returnCost: 0
      },
      // Transport result (defaults for pre-history)
      transportResult: {
        shippingMode: "STANDARD",
        unitsShipped: unitsSold,
        freightCost: unitsSold * 3,
        onTimeBonus: 0,
        tmsDiscount: 0
      },
      // Perfect Order components
      poComponents: {
        onTime: PO.BASE_ON_TIME,
        inFull: PO.BASE_IN_FULL,
        damageFree: PO.BASE_DAMAGE_FREE,
        documentation: PO.BASE_DOCUMENTATION
      }
    });
  }
  
  return results;
}

/******************************************************************************
 * RESET
 ******************************************************************************/

function resetSimulation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert("Reset?", "Clear all data and return to Q0?", ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;
  
  // Clear main data sheets
  [CONFIG.sheets.STOCKS, CONFIG.sheets.DATABASE].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
  });
  
  // Clear Demand History (data rows 6-19)
  const demandSheet = ss.getSheetByName(CONFIG.sheets.DEMAND_HISTORY);
  if (demandSheet) {
    demandSheet.getRange(6, 1, 14, 6).clearContent();
  }
  
  // Clear Forecast Log (data rows 2+)
  const forecastSheet = ss.getSheetByName(CONFIG.sheets.FORECAST_LOG);
  if (forecastSheet && forecastSheet.getLastRow() > 1) {
    forecastSheet.getRange(2, 1, forecastSheet.getLastRow() - 1, forecastSheet.getLastColumn()).clearContent();
  }
  
  // Clear Supplier Scorecards order history (rows 30+)
  const supplierSheet = ss.getSheetByName("Supplier_Scorecards");
  if (supplierSheet && supplierSheet.getLastRow() >= 30) {
    supplierSheet.getRange(30, 1, supplierSheet.getLastRow() - 29, 6).clearContent();
  }
  
  initializeQ0_(ss);
  
  const dash = ss.getSheetByName(CONFIG.sheets.DASHBOARD);
  if (dash) dash.getRange(3, 2).setValue(0);
  
  ui.alert("Reset to Q0 complete.");
}

// ============================================================
// ADVANCED MODULE: CAPACITY EXPANSION
// ============================================================

/**
 * Process capacity expansion decisions
 * Returns: {expansionCost, newMaintenance, completedCapacity, updatedInProgress}
 */
function processCapacityExpansion_(ss, quarter, firmId, decisions, state) {
  if (!isAdvancedModuleEnabled_(ss, "Capacity Expansion")) {
    return {
      expansionCost: 0,
      newMaintenance: 0,
      completedCapacity: 0,
      totalCapacity: state.Capacity_Units || CONFIG.production.BASE_CAPACITY_PER_SHIFT,
      inProgress: state.Expansion_InProgress || "[]",
      additionalCapacity: state.Additional_Capacity || 0,
      expansionMaintenance: state.Expansion_Maintenance || 0
    };
  }
  
  const CE = CONFIG.capacityExpansion;
  let expansionCost = 0;
  let newMaintenance = state.Expansion_Maintenance || 0;
  let additionalCapacity = state.Additional_Capacity || 0;
  
  // Parse in-progress expansions
  let inProgress = [];
  try {
    inProgress = JSON.parse(state.Expansion_InProgress || "[]");
  } catch (e) {
    inProgress = [];
  }
  
  // Check for completed expansions
  let completedCapacity = 0;
  const stillInProgress = [];
  
  inProgress.forEach(exp => {
    if (exp.completesQ <= quarter) {
      // This expansion is now complete
      completedCapacity += exp.capacity;
      newMaintenance += exp.maintenance;
    } else {
      stillInProgress.push(exp);
    }
  });
  
  additionalCapacity += completedCapacity;
  
  // Process new expansion decisions (decisions values are booleans)
  if (decisions.buildSmallLine) {
    const opt = CE.EXPANSION_OPTIONS.SMALL_LINE;
    expansionCost += opt.cost;
    stillInProgress.push({
      type: "SMALL_LINE",
      capacity: opt.unitsPerQuarter,
      maintenance: opt.maintenance,
      completesQ: quarter + opt.buildTime
    });
  }
  
  if (decisions.buildMediumLine) {
    const opt = CE.EXPANSION_OPTIONS.MEDIUM_LINE;
    expansionCost += opt.cost;
    stillInProgress.push({
      type: "MEDIUM_LINE",
      capacity: opt.unitsPerQuarter,
      maintenance: opt.maintenance,
      completesQ: quarter + opt.buildTime
    });
  }
  
  if (decisions.buildLargeLine) {
    const opt = CE.EXPANSION_OPTIONS.LARGE_LINE;
    expansionCost += opt.cost;
    stillInProgress.push({
      type: "LARGE_LINE",
      capacity: opt.unitsPerQuarter,
      maintenance: opt.maintenance,
      completesQ: quarter + opt.buildTime
    });
  }
  
  // Calculate total capacity
  const baseCapacity = CONFIG.production.BASE_CAPACITY_PER_SHIFT * 3;  // 3 shifts max
  const totalCapacity = baseCapacity + additionalCapacity;
  
  return {
    expansionCost: expansionCost,
    newMaintenance: newMaintenance,
    completedCapacity: completedCapacity,
    totalCapacity: totalCapacity,
    inProgress: JSON.stringify(stillInProgress),
    additionalCapacity: additionalCapacity,
    expansionMaintenance: newMaintenance
  };
}

/**
 * Get capacity expansion decisions from cockpit
 */
function getCapacityDecisions_(cockpitData, firmStartRow) {
  const decisions = {
    buildSmallLine: "NO",
    buildMediumLine: "NO",
    buildLargeLine: "NO"
  };
  
  // Search for capacity expansion section
  for (let i = firmStartRow; i < cockpitData.length && i < firmStartRow + 60; i++) {
    const label = String(cockpitData[i][0] || "").toLowerCase();
    const value = String(cockpitData[i][1] || "").toUpperCase();
    
    if (label.includes("small line")) {
      decisions.buildSmallLine = value;
    } else if (label.includes("medium line")) {
      decisions.buildMediumLine = value;
    } else if (label.includes("large line")) {
      decisions.buildLargeLine = value;
    }
  }
  
  return decisions;
}

/**
 * Find the starting row for a firm's decisions in the cockpit data
 */
function findFirmStartRow_(cockpitData, firmId) {
  const searchPattern = `FIRM ${firmId}`;
  for (let i = 0; i < cockpitData.length; i++) {
    const cell = String(cockpitData[i][0] || "").toUpperCase();
    if (cell.includes(searchPattern)) {
      return i;
    }
  }
  return 0;  // Default to start if not found
}

// ============================================================
// ANALYTICS MODULE: PRODUCT INNOVATION (P3)
// ============================================================

/**
 * Process P3 product launch and sales
 * Returns: {p3Revenue, p3UnitsSold, p3LaunchCost, p3CostPerUnit, p3Launched}
 */
function processP3Product_(ss, quarter, decisions, state, baseUnitsSold) {
  const analyticsMode = isAnalyticsMode_(ss);
  const P3 = CONFIG.market.P3_CONFIG;
  
  // Default return if P3 not launched or not in Analytics Mode
  const noP3Result = {
    p3Revenue: 0,
    p3UnitsSold: 0,
    p3LaunchCost: 0,
    p3CostPerUnit: 0,
    p3Launched: false,
    p3Config: "NONE"
  };
  
  if (!analyticsMode || !decisions.launchP3) {
    return noP3Result;
  }
  
  // Get P3 configuration
  const config = P3.CONFIGS[decisions.p3Config] || P3.CONFIGS.STANDARD;
  
  // Check if this is first quarter of P3 launch
  const wasP3Active = state.P3_Launched || false;
  const isNewLaunch = !wasP3Active;
  
  // Launch cost (one-time)
  const launchCost = isNewLaunch ? P3.LAUNCH_COST : 0;
  
  // Calculate P3 demand
  // Base: cannibalization from P1/P2 + new market expansion
  const p1Cannibalized = Math.round(baseUnitsSold * CONFIG.market.PRODUCTS.P1.marketShare * P3.CANNIBALIZATION.P1_RATE);
  const p2Cannibalized = Math.round(baseUnitsSold * CONFIG.market.PRODUCTS.P2.marketShare * P3.CANNIBALIZATION.P2_RATE);
  const newMarketDemand = Math.round(baseUnitsSold * P3.NEW_MARKET_RATE);
  
  // Total P3 potential demand
  let p3Demand = p1Cannibalized + p2Cannibalized + newMarketDemand;
  
  // Ramp-up factor (demand grows over first 4 quarters)
  const quartersActive = wasP3Active ? (state.P3_Quarters_Active || 0) + 1 : 1;
  const rampUpFactor = Math.min(1.0, quartersActive / P3.RAMP_UP_QUARTERS);
  p3Demand = Math.round(p3Demand * rampUpFactor);
  
  // Premium config gets more demand (higher utility score)
  const utilityBonus = config.utilityScore / 7.5;  // Normalize around average
  p3Demand = Math.round(p3Demand * utilityBonus);
  
  // Price sensitivity for P3
  const suggestedPrice = config.suggestedPrice;
  const actualPrice = decisions.p3Price || suggestedPrice;
  const priceRatio = suggestedPrice / actualPrice;  // Lower price = more demand
  p3Demand = Math.round(p3Demand * priceRatio);
  
  // Limited by production
  const p3Production = decisions.productionP3 || 0;
  const p3UnitsSold = Math.min(p3Demand, p3Production);
  
  // Revenue
  const p3Revenue = p3UnitsSold * actualPrice;
  
  // Cost per unit
  const p3CostPerUnit = config.costToMake;
  
  return {
    p3Revenue: p3Revenue,
    p3UnitsSold: p3UnitsSold,
    p3LaunchCost: launchCost,
    p3CostPerUnit: p3CostPerUnit,
    p3Launched: true,
    p3Config: decisions.p3Config,
    p3Demand: p3Demand,
    p3Production: p3Production,
    quartersActive: quartersActive,
    cannibalized: p1Cannibalized + p2Cannibalized,
    newMarket: newMarketDemand
  };
}

// ============================================================
// ANALYTICS MODULE: MARKET EXPANSION (R4-R6)
// ============================================================

/**
 * Process market expansion into new regions
 * Returns: {expansionRevenue, expansionCosts, entryCosts, ongoingCosts, regionResults}
 */
function processMarketExpansion_(ss, quarter, decisions, state) {
  const analyticsMode = isAnalyticsMode_(ss);
  const EXP = CONFIG.market.EXPANSION_REGIONS;
  const RAMP = CONFIG.market.EXPANSION_RAMP_UP_QUARTERS;
  
  // Default return if not in Analytics Mode
  const noExpansionResult = {
    expansionRevenue: 0,
    expansionUnitsSold: 0,
    entryCosts: 0,
    ongoingCosts: 0,
    r4Active: false,
    r5Active: false,
    r6Active: false,
    regionResults: {}
  };
  
  if (!analyticsMode) {
    return noExpansionResult;
  }
  
  let totalRevenue = 0;
  let totalUnitsSold = 0;
  let totalEntryCosts = 0;
  let totalOngoingCosts = 0;
  const regionResults = {};
  
  // Process each expansion region
  const expansionDecisions = [
    { region: 4, enter: decisions.enterR4, forecast: decisions.forecastR4, stateKey: "R4_Active", quartersKey: "R4_Quarters_Active" },
    { region: 5, enter: decisions.enterR5, forecast: decisions.forecastR5, stateKey: "R5_Active", quartersKey: "R5_Quarters_Active" },
    { region: 6, enter: decisions.enterR6, forecast: decisions.forecastR6, stateKey: "R6_Active", quartersKey: "R6_Quarters_Active" }
  ];
  
  for (const exp of expansionDecisions) {
    const regionConfig = EXP[exp.region];
    if (!regionConfig) continue;
    
    const wasActive = state[exp.stateKey] || false;
    const isNewEntry = exp.enter && !wasActive;
    const isActive = exp.enter || wasActive;
    
    if (!isActive) {
      regionResults[exp.region] = { active: false, revenue: 0, unitsSold: 0, costs: 0 };
      continue;
    }
    
    // Entry cost (one-time)
    if (isNewEntry) {
      totalEntryCosts += regionConfig.entryCost;
    }
    
    // Ongoing cost
    totalOngoingCosts += regionConfig.ongoingCost;
    
    // Calculate demand with ramp-up
    const quartersActive = wasActive ? (state[exp.quartersKey] || 0) + 1 : 1;
    const rampUpFactor = Math.min(1.0, quartersActive / RAMP);
    
    // Base demand from market size, adjusted for cultural fit
    let regionDemand = Math.round(regionConfig.marketSize * rampUpFactor * regionConfig.culturalFit);
    
    // Regulatory risk can reduce demand
    if (Math.random() < regionConfig.regulatoryRisk) {
      regionDemand = Math.round(regionDemand * 0.7);  // 30% reduction if regulatory issue
    }
    
    // Limit by forecast (production allocation)
    const regionSales = Math.min(regionDemand, exp.forecast);
    
    // Revenue (use P1 price as base for expansion regions)
    const avgPrice = CONFIG.market.PRODUCTS.P1.basePrice;
    const regionRevenue = regionSales * avgPrice;
    
    totalRevenue += regionRevenue;
    totalUnitsSold += regionSales;
    
    regionResults[exp.region] = {
      active: true,
      name: regionConfig.name,
      revenue: regionRevenue,
      unitsSold: regionSales,
      demand: regionDemand,
      forecast: exp.forecast,
      quartersActive: quartersActive,
      rampUpFactor: rampUpFactor,
      entryCost: isNewEntry ? regionConfig.entryCost : 0,
      ongoingCost: regionConfig.ongoingCost
    };
  }
  
  return {
    expansionRevenue: totalRevenue,
    expansionUnitsSold: totalUnitsSold,
    entryCosts: totalEntryCosts,
    ongoingCosts: totalOngoingCosts,
    r4Active: decisions.enterR4 || state.R4_Active,
    r5Active: decisions.enterR5 || state.R5_Active,
    r6Active: decisions.enterR6 || state.R6_Active,
    regionResults: regionResults
  };
}

// ============================================================
// ADVANCED MODULE: REGIONAL DISTRIBUTION CENTERS
// ============================================================

/**
 * Process regional DC decisions
 * Returns: {setupCost, opex, dcStatus, serviceBonus}
 */
function processRegionalDCs_(ss, quarter, firmId, decisions, state, fgAvailable) {
  const analyticsMode = isAnalyticsMode_(ss);
  const advancedModuleEnabled = isAdvancedModuleEnabled_(ss, "Regional DCs");
  
  // Allow DCs in Analytics Mode OR when Advanced Module is enabled
  if (!analyticsMode && !advancedModuleEnabled) {
    return {
      setupCost: 0,
      disposalRevenue: 0,
      transferCost: 0,
      opex: 0,
      dcEastOpen: false,      // R1 served by Factory
      dcEastInventory: 0,
      dcCentralOpen: false,
      dcCentralInventory: 0,
      dcWestOpen: false,
      dcWestInventory: 0,
      serviceBonus: 0,
      totalDCOpex: 0,
      inventoryReturnedToFactory: 0
    };
  }
  
  const DC = CONFIG.regionalDCs;
  let setupCost = 0;
  let disposalRevenue = 0;
  let transferCost = 0;
  let opex = 0;
  let serviceBonus = 0;
  let inventoryReturnedToFactory = 0;
  
  // R1 (East) is served by Factory directly - always apply factory service bonus
  serviceBonus += DC.FACTORY_SERVICE_BONUS || 0.05;
  
  // Get current DC status from state (R2 Central, R3 West only)
  let dcCentralOpen = state.DC_Central_Open || false;
  let dcWestOpen = state.DC_West_Open || false;
  
  let dcCentralInventory = state.DC_Central_Inventory || 0;
  let dcWestInventory = state.DC_West_Inventory || 0;
  
  // === PROCESS DC STATUS CHANGES ===
  
  // Central DC
  if (decisions.dcCentralStatus === "YES" && !dcCentralOpen) {
    // Opening new DC
    setupCost += DC.DCS.CENTRAL.setupCost;
    dcCentralOpen = true;
  } else if (decisions.dcCentralStatus === "CLOSE" && dcCentralOpen) {
    // Closing DC - get disposal value and transfer inventory to Factory
    disposalRevenue += DC.DCS.CENTRAL.setupCost * DC.DISPOSAL_VALUE_RATE;
    // Transfer remaining inventory back to factory
    if (dcCentralInventory > 0) {
      transferCost += dcCentralInventory * DC.TRANSFER_COSTS.DC_TO_FACTORY;
      inventoryReturnedToFactory += dcCentralInventory;
      dcCentralInventory = 0;
    }
    dcCentralOpen = false;
  }
  
  // West DC
  if (decisions.dcWestStatus === "YES" && !dcWestOpen) {
    // Opening new DC
    setupCost += DC.DCS.WEST.setupCost;
    dcWestOpen = true;
  } else if (decisions.dcWestStatus === "CLOSE" && dcWestOpen) {
    // Closing DC - get disposal value and transfer inventory to Factory
    disposalRevenue += DC.DCS.WEST.setupCost * DC.DISPOSAL_VALUE_RATE;
    // Transfer remaining inventory back to factory
    if (dcWestInventory > 0) {
      transferCost += dcWestInventory * DC.TRANSFER_COSTS.DC_TO_FACTORY;
      inventoryReturnedToFactory += dcWestInventory;
      dcWestInventory = 0;
    }
    dcWestOpen = false;
  }
  
  // === PROCESS INVENTORY TRANSFERS ===
  
  // Transfer FROM Central DC
  if (dcCentralOpen && decisions.transferFromCentral > 0 && decisions.transferFromCentralTo !== "NONE") {
    const transferAmount = Math.min(decisions.transferFromCentral, dcCentralInventory);
    if (transferAmount > 0) {
      dcCentralInventory -= transferAmount;
      
      if (decisions.transferFromCentralTo === "WEST" && dcWestOpen) {
        // Lateral transfer to West DC
        transferCost += transferAmount * DC.TRANSFER_COSTS.DC_TO_DC;
        dcWestInventory += transferAmount;
      } else if (decisions.transferFromCentralTo === "FACTORY") {
        // Return to Factory
        transferCost += transferAmount * DC.TRANSFER_COSTS.DC_TO_FACTORY;
        inventoryReturnedToFactory += transferAmount;
      }
    }
  }
  
  // Transfer FROM West DC
  if (dcWestOpen && decisions.transferFromWest > 0 && decisions.transferFromWestTo !== "NONE") {
    const transferAmount = Math.min(decisions.transferFromWest, dcWestInventory);
    if (transferAmount > 0) {
      dcWestInventory -= transferAmount;
      
      if (decisions.transferFromWestTo === "CENTRAL" && dcCentralOpen) {
        // Lateral transfer to Central DC
        transferCost += transferAmount * DC.TRANSFER_COSTS.DC_TO_DC;
        dcCentralInventory += transferAmount;
      } else if (decisions.transferFromWestTo === "FACTORY") {
        // Return to Factory
        transferCost += transferAmount * DC.TRANSFER_COSTS.DC_TO_FACTORY;
        inventoryReturnedToFactory += transferAmount;
      }
    }
  }
  
  // === CALCULATE OPERATING EXPENSES ===
  if (dcCentralOpen) {
    opex += DC.DCS.CENTRAL.quarterlyOpex;
    serviceBonus += DC.DCS.CENTRAL.serviceBonus;
  }
  if (dcWestOpen) {
    opex += DC.DCS.WEST.quarterlyOpex;
    serviceBonus += DC.DCS.WEST.serviceBonus;
  }
  
  // === PROCESS INVENTORY ALLOCATION (from Factory to DCs) ===
  let totalAllocated = 0;
  
  if (dcCentralOpen && decisions.allocateCentral > 0) {
    const allocate = Math.min(decisions.allocateCentral, fgAvailable - totalAllocated, DC.DCS.CENTRAL.capacity - dcCentralInventory);
    dcCentralInventory += allocate;
    totalAllocated += allocate;
  }
  
  if (dcWestOpen && decisions.allocateWest > 0) {
    const allocate = Math.min(decisions.allocateWest, fgAvailable - totalAllocated, DC.DCS.WEST.capacity - dcWestInventory);
    dcWestInventory += allocate;
    totalAllocated += allocate;
  }
  
  // Cap inventory at DC capacity
  dcCentralInventory = Math.min(dcCentralInventory, DC.DCS.CENTRAL.capacity);
  dcWestInventory = Math.min(dcWestInventory, DC.DCS.WEST.capacity);
  
  return {
    setupCost: setupCost,
    disposalRevenue: disposalRevenue,
    transferCost: transferCost,
    opex: opex,
    dcEastOpen: false,         // R1 served by Factory (no separate DC)
    dcEastInventory: 0,        // No inventory at "East DC"
    dcCentralOpen: dcCentralOpen,
    dcCentralInventory: dcCentralInventory,
    dcWestOpen: dcWestOpen,
    dcWestInventory: dcWestInventory,
    serviceBonus: serviceBonus,
    totalDCOpex: opex,
    inventoryAllocated: totalAllocated,
    inventoryReturnedToFactory: inventoryReturnedToFactory
  };
}

/**
 * Get regional DC decisions from cockpit
 * R1 (East) is served by Factory - only R2 Central and R3 West have DC decisions
 */
function getDCDecisions_(cockpitData, firmStartRow) {
  const decisions = {
    dcCentralStatus: "NO",
    dcWestStatus: "NO",
    allocateCentral: 0,
    allocateWest: 0,
    transferFromCentral: 0,
    transferFromCentralTo: "NONE",
    transferFromWest: 0,
    transferFromWestTo: "NONE"
  };
  
  // Search for DC section
  for (let i = firmStartRow; i < cockpitData.length && i < firmStartRow + 60; i++) {
    const label = String(cockpitData[i][0] || "").toLowerCase();
    const value2 = String(cockpitData[i][1] || "").toUpperCase();
    const value3 = cockpitData[i][2];
    
    if (label.includes("central") && label.includes("dc") && !label.includes("warranty") && !label.includes("transfer")) {
      decisions.dcCentralStatus = value2;
      decisions.allocateCentral = Number(value3) || 0;
    } else if (label.includes("west") && label.includes("dc") && !label.includes("warranty") && !label.includes("transfer")) {
      decisions.dcWestStatus = value2;
      decisions.allocateWest = Number(value3) || 0;
    } else if (label.includes("transfer") && label.includes("central")) {
      decisions.transferFromCentral = Number(value2) || 0;
      decisions.transferFromCentralTo = String(value3 || "NONE").toUpperCase();
    } else if (label.includes("transfer") && label.includes("west")) {
      decisions.transferFromWest = Number(value2) || 0;
      decisions.transferFromWestTo = String(value3 || "NONE").toUpperCase();
    }
  }
  
  return decisions;
}

/**
 * Process sales through regional DCs
 * R1 (East) served by Factory directly
 * R2 (Central) and R3 (West) served by optional DCs
 */
function processDCSales_(dcResult, regionalDemand, fillRate) {
  // R1 is always served by Factory - only check Central and West DCs
  if (!dcResult.dcCentralOpen && !dcResult.dcWestOpen) {
    // No DCs open - R1 from Factory, R2/R3 via direct ship
    return {
      dcSales: 0,
      updatedDCInventory: dcResult,
      dcServiceBonus: CONFIG.regionalDCs.FACTORY_SERVICE_BONUS || 0.05  // R1 gets factory bonus
    };
  }
  
  let dcSales = 0;
  let dcServiceBonus = CONFIG.regionalDCs.FACTORY_SERVICE_BONUS || 0.05;  // R1 always gets factory bonus
  
  // R2 Central DC serves Region 2
  if (dcResult.dcCentralOpen && dcResult.dcCentralInventory > 0) {
    const r2Demand = regionalDemand.R2 || 0;
    const r2Sales = Math.min(r2Demand, dcResult.dcCentralInventory);
    dcResult.dcCentralInventory -= r2Sales;
    dcSales += r2Sales;
    if (r2Sales > 0) dcServiceBonus += CONFIG.regionalDCs.DCS.CENTRAL.serviceBonus;
  }
  
  // R3 West DC serves Region 3
  if (dcResult.dcWestOpen && dcResult.dcWestInventory > 0) {
    const r3Demand = regionalDemand.R3 || 0;
    const r3Sales = Math.min(r3Demand, dcResult.dcWestInventory);
    dcResult.dcWestInventory -= r3Sales;
    dcSales += r3Sales;
    if (r3Sales > 0) dcServiceBonus += CONFIG.regionalDCs.DCS.WEST.serviceBonus;
  }
  
  return {
    dcSales: dcSales,
    updatedDCInventory: dcResult,
    dcServiceBonus: dcServiceBonus
  };
}

// ============================================================
// INTELLIGENCE CENTER
// ============================================================

/**
 * Setup Intel Reports sheet
 */
function setupIntelSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.sheets.INTEL);
  sheet.clear();
  
  const numFirms = CONFIG.simulation.NUM_FIRMS;
  const data = [
    ["INTELLIGENCE REPORTS", "", "", ""],
    ["Updated each quarter based on your subscriptions", "", "", ""],
    ["", "", "", ""]
  ];
  
  for (let f = 1; f <= numFirms; f++) {
    data.push([`═══════════════════════════════════════════`, "", "", ""]);
    data.push([`FIRM ${f} INTELLIGENCE BRIEFING`, "", "", ""]);
    data.push([`═══════════════════════════════════════════`, "", "", ""]);
    data.push(["", "", "", ""]);
    data.push(["Subscribe to reports in your Decision Cockpit", "", "", ""]);
    data.push(["", "", "", ""]);
    // Reserve space for reports (will be populated each quarter)
    for (let i = 0; i < 50; i++) {
      data.push(["", "", "", ""]);
    }
  }
  
  sheet.getRange(1, 1, data.length, 4).setValues(data);
  sheet.getRange(1, 1).setFontWeight("bold").setFontSize(14);
  sheet.setColumnWidth(1, 350);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 200);
}

/**
 * Process Intelligence Center for a firm
 * Returns subscriptions cost and generates reports
 */
function processIntelligence_(ss, quarter, firmId, decisions, allFirmStates, marketDemand, calendarQuarter, upcomingEvent) {
  if (!isAdvancedModuleEnabled_(ss, "Intelligence Center")) {
    return { cost: 0, reports: [] };
  }
  
  const I = CONFIG.intelligence.REPORTS;
  let cost = 0;
  const reports = [];
  
  try {
    // Calculate subscription cost
    if (decisions.intelRegionalDemand) cost += I.REGIONAL_DEMAND.cost;
    if (decisions.intelRetailChannel) cost += I.RETAIL_CHANNEL.cost;
    if (decisions.intelCompetitorCapacity) cost += I.COMPETITOR_CAPACITY.cost;
    if (decisions.intelSupplierRisk) cost += I.SUPPLIER_RISK.cost;
    if (decisions.intelCustomerSentiment) cost += I.CUSTOMER_SENTIMENT.cost;
    
    // Generate reports (always generate free ones, paid only if subscribed)
    reports.push(generateMarketTrendsReport_(quarter, calendarQuarter, marketDemand));
    reports.push(generateCompetitorPricingReport_(allFirmStates, firmId));
    
    if (decisions.intelRegionalDemand) {
      reports.push(generateRegionalDemandReport_(marketDemand, allFirmStates, firmId));
    }
    if (decisions.intelRetailChannel) {
      reports.push(generateRetailChannelReport_(allFirmStates, firmId));
    }
    if (decisions.intelCompetitorCapacity) {
      reports.push(generateCompetitorCapacityReport_(allFirmStates, firmId));
    }
    if (decisions.intelSupplierRisk) {
      reports.push(generateSupplierRiskReport_(quarter, upcomingEvent));
    }
    if (decisions.intelCustomerSentiment) {
      reports.push(generateCustomerSentimentReport_(allFirmStates, firmId));
    }
    
    Logger.log(`Intel: Firm ${firmId} generated ${reports.length} reports`);
  } catch (e) {
    Logger.log(`Intel Error for Firm ${firmId}: ${e.message}`);
  }
  
  return { cost: cost, reports: reports };
}

/**
 * Generate Market Trends Report (Free)
 */
function generateMarketTrendsReport_(quarter, calendarQuarter, marketDemand) {
  const seasonNames = { 1: "Q1 - Post-Holiday (-15%)", 2: "Q2 - Spring (Baseline)", 3: "Q3 - Summer (Baseline)", 4: "Q4 - Holiday (+25%)" };
  const nextQuarter = (calendarQuarter % 4) + 1;
  const nextSeasonName = seasonNames[nextQuarter];
  
  let trend = "Stable";
  if (nextQuarter === 4) trend = "↑ Increasing (Holiday)";
  if (nextQuarter === 1) trend = "↓ Decreasing (Post-Holiday)";
  
  return {
    title: "MARKET TRENDS REPORT",
    subtitle: "(Free)",
    lines: [
      `Current Season: ${seasonNames[calendarQuarter]}`,
      `Next Quarter: ${nextSeasonName}`,
      `Trend: ${trend}`,
      "",
      `Last Quarter Demand: ${Math.round(marketDemand / 1000)}K units`,
      "",
      "Seasonal Pattern:",
      "Q4 Holiday: +25% demand surge",
      "Q1 Post-Holiday: -15% slowdown",
      "Q2-Q3: Baseline demand"
    ]
  };
}

/**
 * Generate Competitor Pricing Report (Free)
 */
function generateCompetitorPricingReport_(allFirmStates, firmId) {
  const lines = ["         P1 Price    P2 Price"];
  
  let totalP1 = 0, totalP2 = 0, count = 0;
  
  for (let f = 1; f <= CONFIG.simulation.NUM_FIRMS; f++) {
    const state = allFirmStates[f];
    const p1 = state ? (state.Price_P1 || 500) : 500;
    const p2 = state ? (state.Price_P2 || 850) : 850;
    totalP1 += p1;
    totalP2 += p2;
    count++;
    
    const marker = (f === firmId) ? " (You)" : "";
    lines.push(`Firm ${f}${marker}:  $${p1}        $${p2}`);
  }
  
  const avgP1 = count > 0 ? Math.round(totalP1/count) : 500;
  const avgP2 = count > 0 ? Math.round(totalP2/count) : 850;
  lines.push("");
  lines.push(`Market Avg:  $${avgP1}        $${avgP2}`);
  
  // Find lowest price - only alert if someone is actually undercutting
  let lowestP1Firm = 0, lowestP1 = 9999;
  const myP1 = allFirmStates[firmId] ? (allFirmStates[firmId].Price_P1 || 500) : 500;
  
  for (let f = 1; f <= CONFIG.simulation.NUM_FIRMS; f++) {
    if (f === firmId) continue;  // Skip self
    const state = allFirmStates[f];
    if (state && (state.Price_P1 || 500) < lowestP1) {
      lowestP1 = state.Price_P1 || 500;
      lowestP1Firm = f;
    }
  }
  
  // Only show alert if competitor is actually cheaper than us
  if (lowestP1Firm > 0 && lowestP1 < myP1) {
    lines.push("");
    lines.push(`⚠️ Firm ${lowestP1Firm} is undercutting at $${lowestP1}`);
  }
  
  return {
    title: "COMPETITOR PRICING REPORT",
    subtitle: "(Free - Last Quarter)",
    lines: lines
  };
}

/**
 * Generate Regional Demand Report ($50K)
 */
function generateRegionalDemandReport_(marketDemand, allFirmStates, firmId) {
  const M = CONFIG.market;
  const r1Demand = Math.round(marketDemand * M.REGIONS[1].marketShare);
  const r2Demand = Math.round(marketDemand * M.REGIONS[2].marketShare);
  const r3Demand = Math.round(marketDemand * M.REGIONS[3].marketShare);
  
  const lines = [
    "Region      Demand    Share    Growth",
    `R1 East     ${Math.round(r1Demand/1000)}K       40%      ${(M.REGIONS[1].growthRate * 100).toFixed(0)}%`,
    `R2 Central  ${Math.round(r2Demand/1000)}K       35%      ${(M.REGIONS[2].growthRate * 100).toFixed(0)}%`,
    `R3 West     ${Math.round(r3Demand/1000)}K       25%      ${(M.REGIONS[3].growthRate * 100).toFixed(0)}%`,
    "",
    "Regional Characteristics:",
    "R1 East: Balanced preferences",
    "R2 Central: Price-sensitive (45% weight)",
    "R3 West: Service-sensitive (40% quality weight)",
    "",
    "💡 TIP: R2 responds strongly to price cuts",
    "💡 TIP: R3 values quality and on-time delivery"
  ];
  
  return {
    title: "REGIONAL DEMAND ANALYSIS",
    subtitle: "($50K subscription)",
    lines: lines
  };
}

/**
 * Generate Retail Channel Report ($50K)
 */
function generateRetailChannelReport_(allFirmStates, firmId) {
  const lines = ["         Retail Inv  Coverage  Mode"];
  
  for (let f = 1; f <= CONFIG.simulation.NUM_FIRMS; f++) {
    const state = allFirmStates[f];
    if (!state) continue;
    
    const retailInv = state.Retailer_Inventory || 0;
    const retailMode = state.Retailer_Mode || "NORMAL";
    // Estimate coverage (assuming ~60K/quarter retail sales per firm)
    const coverage = (retailInv / 60000 * 3).toFixed(1);
    
    const marker = (f === firmId) ? " (You)" : "";
    const modeIcon = retailMode === "PANIC" ? "⚠️" : (retailMode === "CLEARANCE" ? "📉" : "");
    lines.push(`Firm ${f}${marker}:  ${Math.round(retailInv/1000)}K       ${coverage} mo   ${retailMode} ${modeIcon}`);
  }
  
  lines.push("");
  lines.push("Channel Health Indicators:");
  lines.push("Target Coverage: 2.5 months");
  lines.push("PANIC Mode: < 1.0 mo (expect large orders)");
  lines.push("CLEARANCE: > 4.0 mo (discounting hurts brand)");
  
  // Add specific insights
  for (let f = 1; f <= CONFIG.simulation.NUM_FIRMS; f++) {
    if (f === firmId) continue;
    const state = allFirmStates[f];
    if (!state) continue;
    
    if (state.Retailer_Mode === "PANIC") {
      lines.push("");
      lines.push(`⚠️ Firm ${f} retailer panic ordering!`);
      lines.push("   Expect demand spike from their channel");
    }
    if (state.Retailer_Mode === "CLEARANCE") {
      lines.push("");
      lines.push(`📉 Firm ${f} in clearance mode`);
      lines.push("   Price competition may increase");
    }
  }
  
  return {
    title: "RETAIL CHANNEL INTELLIGENCE",
    subtitle: "($50K subscription)",
    lines: lines
  };
}

/**
 * Generate Competitor Capacity Report ($100K)
 */
function generateCompetitorCapacityReport_(allFirmStates, firmId) {
  const lines = ["         Base     Expansion  Total    Util%"];
  
  for (let f = 1; f <= CONFIG.simulation.NUM_FIRMS; f++) {
    const state = allFirmStates[f];
    if (!state) continue;
    
    const baseCapacity = 600000;  // Standard base
    const addlCapacity = state.Additional_Capacity || 0;
    const totalCapacity = baseCapacity + addlCapacity;
    const production = state.Units_Produced || 0;
    const utilization = totalCapacity > 0 ? Math.round((production / totalCapacity) * 100) : 0;
    
    const marker = (f === firmId) ? " (You)" : "";
    lines.push(`Firm ${f}${marker}:  ${baseCapacity/1000}K    +${addlCapacity/1000}K       ${totalCapacity/1000}K     ${utilization}%`);
  }
  
  lines.push("");
  lines.push("Expansion Status:");
  
  // Check for expansions in progress
  for (let f = 1; f <= CONFIG.simulation.NUM_FIRMS; f++) {
    if (f === firmId) continue;
    const state = allFirmStates[f];
    if (!state) continue;
    
    const linesUnderConstruction = state.Lines_Under_Construction || 0;
    if (linesUnderConstruction > 0) {
      lines.push(`⚠️ Firm ${f}: ${linesUnderConstruction} line(s) under construction`);
    }
  }
  
  lines.push("");
  lines.push("Capacity Investment Options:");
  lines.push("Small Line: $8M, +50K (1 quarter)");
  lines.push("Medium Line: $15M, +100K (2 quarters)");
  lines.push("Large Line: $25M, +200K (3 quarters)");
  
  return {
    title: "COMPETITOR CAPACITY INTEL",
    subtitle: "($100K subscription)",
    lines: lines
  };
}

/**
 * Generate Supplier Risk Report ($75K)
 */
function generateSupplierRiskReport_(quarter, upcomingEvent) {
  // Determine risk level based on upcoming events
  let riskLevel = "LOW";
  let riskIcon = "✅";
  let riskDetails = [];
  
  if (upcomingEvent && upcomingEvent.includes("SUPPLY")) {
    riskLevel = "HIGH";
    riskIcon = "🔴";
    riskDetails.push("⚠️ Supply disruption detected!");
    riskDetails.push("Recommend: Increase safety stock");
    riskDetails.push("Recommend: Use regional supplier backup");
  } else if (quarter % 4 === 0) {
    // Q4 typically has higher risk
    riskLevel = "ELEVATED";
    riskIcon = "🟡";
    riskDetails.push("Holiday season capacity constraints");
    riskDetails.push("Port congestion typical this period");
  } else {
    riskDetails.push("No immediate supply risks detected");
    riskDetails.push("Global supplier lead times normal");
  }
  
  const lines = [
    `Risk Level: ${riskLevel} ${riskIcon}`,
    "",
    "Current Conditions:",
    ...riskDetails,
    "",
    "Supplier Comparison:",
    "Global: $100/unit, 1 quarter lead time",
    "Regional: $115/unit, same quarter delivery",
    "",
    "Mitigation Strategies:",
    "• Maintain 2-week safety stock",
    "• Regional supplier for urgent needs",
    "• Monitor this report quarterly"
  ];
  
  return {
    title: "SUPPLIER RISK MONITOR",
    subtitle: "($75K subscription)",
    lines: lines
  };
}

/**
 * Generate Customer Sentiment Report ($75K)
 */
function generateCustomerSentimentReport_(allFirmStates, firmId) {
  const lines = ["         CSI     Trend    Churn    Status"];
  
  for (let f = 1; f <= CONFIG.simulation.NUM_FIRMS; f++) {
    const state = allFirmStates[f];
    if (!state) continue;
    
    const csi = (state.CSI || 80).toFixed(1);
    const churn = state.Customers_Churned || 0;
    
    let trend = "↔";
    let status = "Stable";
    if (csi > 85) { trend = "↑"; status = "Strong"; }
    if (csi < 75) { trend = "↓"; status = "At Risk"; }
    
    const marker = (f === firmId) ? " (You)" : "";
    lines.push(`Firm ${f}${marker}:  ${csi}    ${trend}        ${Math.round(churn/1000)}K       ${status}`);
  }
  
  lines.push("");
  lines.push("Customer Pool (Your Firm):");
  const myState = allFirmStates[firmId];
  if (myState) {
    const loyal = myState.Customers_Loyal || 0;
    const inPlay = myState.Customers_InPlay || 0;
    lines.push(`Loyal Customers: ${Math.round(loyal/1000)}K`);
    lines.push(`At-Risk Pool: ${Math.round(inPlay/1000)}K`);
  }
  
  lines.push("");
  lines.push("CSI Drivers:");
  lines.push("• Fill rate (availability)");
  lines.push("• Price competitiveness");
  lines.push("• Warranty program tier");
  lines.push("• Green Score");
  
  return {
    title: "CUSTOMER SENTIMENT TRACKER",
    subtitle: "($75K subscription)",
    lines: lines
  };
}

/**
 * Update Intel sheet with reports for a firm
 */
function updateIntelSheet_(ss, firmId, quarter, reports) {
  const sheet = ss.getSheetByName(CONFIG.sheets.INTEL);
  if (!sheet) {
    Logger.log(`Intel: Sheet not found for Firm ${firmId}`);
    return;
  }
  
  // Find firm section (each firm has ~150 rows to accommodate all 7 reports)
  const ROWS_PER_FIRM = 150;
  const firmStartRow = 4 + (firmId - 1) * ROWS_PER_FIRM;
  Logger.log(`Intel: Firm ${firmId} starts at row ${firmStartRow}, writing ${reports.length} reports`);
  
  // Ensure sheet has enough rows
  const requiredRows = firmStartRow + ROWS_PER_FIRM;
  if (sheet.getMaxRows() < requiredRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows() + 10);
    Logger.log(`Intel: Added rows, now have ${sheet.getMaxRows()}`);
  }
  
  // Clear previous reports (clear entire firm section)
  sheet.getRange(firmStartRow, 1, ROWS_PER_FIRM, 4).clearContent();
  
  // Write firm section header
  sheet.getRange(firmStartRow, 1).setValue("═══════════════════════════════════════════");
  sheet.getRange(firmStartRow + 1, 1).setValue(`FIRM ${firmId} INTELLIGENCE BRIEFING - Q${quarter}`).setFontWeight("bold");
  sheet.getRange(firmStartRow + 2, 1).setValue("═══════════════════════════════════════════");
  
  let currentRow = firmStartRow + 4;
  
  for (const report of reports) {
    // Report title
    sheet.getRange(currentRow, 1).setValue(report.title).setFontWeight("bold");
    sheet.getRange(currentRow, 2).setValue(report.subtitle).setFontStyle("italic");
    currentRow++;
    
    // Separator
    sheet.getRange(currentRow, 1).setValue("────────────────────────────────────");
    currentRow++;
    
    // Report content
    for (const line of report.lines) {
      sheet.getRange(currentRow, 1).setValue(line);
      currentRow++;
    }
    
    // Spacing between reports
    currentRow += 2;
  }
  Logger.log(`Intel: Firm ${firmId} complete, ended at row ${currentRow}`);
}

// ============================================================
// BACKUP UTILITIES
// ============================================================

/**
 * Create a backup copy of the entire spreadsheet (includes bound scripts)
 * Saves to same folder as original
 */
function createBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const now = new Date();
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
  const backupName = `${ss.getName()}_BACKUP_${timestamp}`;
  
  try {
    const file = DriveApp.getFileById(ss.getId());
    const parents = file.getParents();
    
    let folder;
    if (parents.hasNext()) {
      folder = parents.next();
    } else {
      folder = DriveApp.getRootFolder();
    }
    
    const backup = file.makeCopy(backupName, folder);
    
    ui.alert(
      '✅ Backup Created',
      `Backup saved as:\n${backupName}\n\nLocation: ${folder.getName()}`,
      ui.ButtonSet.OK
    );
    
    Logger.log(`Backup created: ${backupName}`);
    return backup.getId();
    
  } catch (error) {
    ui.alert('❌ Backup Failed', `Error: ${error.message}`, ui.ButtonSet.OK);
    Logger.log(`Backup failed: ${error.message}`);
    return null;
  }
}

/**
 * Create backup in a specific "FLEXEE_Backups" folder
 */
function createBackupInFolder() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const BACKUP_FOLDER_NAME = 'FLEXEE_Backups';
  
  const now = new Date();
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
  const backupName = `${ss.getName()}_BACKUP_${timestamp}`;
  
  try {
    let backupFolder;
    const folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
    
    if (folders.hasNext()) {
      backupFolder = folders.next();
    } else {
      const file = DriveApp.getFileById(ss.getId());
      const parents = file.getParents();
      
      if (parents.hasNext()) {
        backupFolder = parents.next().createFolder(BACKUP_FOLDER_NAME);
      } else {
        backupFolder = DriveApp.createFolder(BACKUP_FOLDER_NAME);
      }
    }
    
    const file = DriveApp.getFileById(ss.getId());
    const backup = file.makeCopy(backupName, backupFolder);
    
    ui.alert(
      '✅ Backup Created',
      `Backup saved as:\n${backupName}\n\nFolder: ${BACKUP_FOLDER_NAME}`,
      ui.ButtonSet.OK
    );
    
    return backup.getId();
    
  } catch (error) {
    ui.alert('❌ Backup Failed', `Error: ${error.message}`, ui.ButtonSet.OK);
    return null;
  }
}

/**
 * List recent backups
 */
function listRecentBackups() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const originalName = ss.getName();
  
  try {
    const searchQuery = `title contains '${originalName}_BACKUP_' and mimeType = 'application/vnd.google-apps.spreadsheet'`;
    const files = DriveApp.searchFiles(searchQuery);
    
    let backupList = [];
    while (files.hasNext() && backupList.length < 10) {
      const file = files.next();
      const date = Utilities.formatDate(file.getLastUpdated(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
      backupList.push(`• ${file.getName()}\n   (${date})`);
    }
    
    if (backupList.length === 0) {
      ui.alert('📁 No Backups Found', 'No backup files found.', ui.ButtonSet.OK);
    } else {
      ui.alert('📁 Recent Backups', backupList.join('\n\n'), ui.ButtonSet.OK);
    }
    
  } catch (error) {
    ui.alert('❌ Error', `Could not list backups: ${error.message}`, ui.ButtonSet.OK);
  }
}