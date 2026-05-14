// src/modules/simulation/processors/scrm-risk.processor.ts
// SCRM Risk Assessment - Supply Chain Risk Management
// EXACT GAS SPECIFICATION (lines 2176-2384)
// Calculates risk score from 5 categories using QuarterState data only (NOT decisions)

export interface SCRMRiskInputs {
  // Supplier Concentration (25%)
  globalOrders: number;
  regionalOrders: number;
  supplierConcentration: number;
  numSuppliers: number;
  
  // Inventory Buffer (20%)
  rawMaterialUnits: number;
  finishedGoodsUnits: number;
  rawDaysOfSupply: number;
  fgDaysOfSupply: number;
  totalRevenue: number;
  
  // Demand Volatility (15%)
  demandMape: number;
  calendarQuarter: number;
  
  // Financial Health (15%)
  cash: number;
  shortTermDebt: number;
  longTermDebt: number;
  debtRatio: number;
  cashRunway: number;
  accountsReceivable: number;
  fixedAssets: number;
  inventoryValue: number;
  
  // Operational (25%)
  unitsProduced: number;
  maxCapacity: number;
  capacityUtilization: number;
  perfectOrder: number;
  ordersInTransit: number;
  leadTimeExposure: number;
  
  // Context
  dcCentralOpen: boolean;
  dcWestOpen: boolean;
}

export interface SCRMRiskResult {
  totalScore: number;
  level: {
    level: string;
    color: string;
    description: string;
  };
  breakdown: {
    supplierConcentrationRisk: number;  // Category 1: 25% weight
    inventoryBufferRisk: number;        // Category 2: 20% weight
    demandVolatilityRisk: number;       // Category 3: 15% weight
    financialHealthRisk: number;        // Category 4: 15% weight
    operationalRisk: number;            // Category 5: 25% weight
  };
  details: {
    supplierDetails: string;
    inventoryDetails: string;
    demandDetails: string;
    financialDetails: string;
    operationalDetails: string;
  };
  inputs: SCRMRiskInputs;
  recommendations: string[];
}

export const SCRM_RISK_CONFIG = {
  // GAS lines 346-352: Exact weight breakdown
  weights: {
    SUPPLIER_CONCENTRATION: 0.25,   // 25%
    INVENTORY_BUFFER: 0.20,         // 20%
    DEMAND_VOLATILITY: 0.15,        // 15%
    FINANCIAL_HEALTH: 0.15,         // 15%
    OPERATIONAL: 0.25,              // 25% (includes lead time + geographic)
  },

  // GAS lines 356-365: Thresholds
  thresholds: {
    CONCENTRATION_HIGH: 0.80,
    CONCENTRATION_MEDIUM: 0.60,
    BUFFER_LOW_DAYS: 14,
    BUFFER_TARGET_DAYS: 30,
    MAPE_HIGH: 0.25,
    MAPE_MEDIUM: 0.15,
    CASH_CRITICAL: 5_000_000,
    CASH_LOW: 15_000_000,
    CASH_MODERATE: 25_000_000,
  },

  // GAS lines 368-374: Risk levels
  levels: {
    LOW: { max: 30, label: 'LOW', color: '#d9ead3' },
    MODERATE: { max: 50, label: 'MODERATE', color: '#fff2cc' },
    ELEVATED: { max: 70, label: 'ELEVATED', color: '#fce5cd' },
    HIGH: { max: 85, label: 'HIGH', color: '#f4cccc' },
    CRITICAL: { max: 100, label: 'CRITICAL', color: '#ea9999' },
  },

  // Key constants for calculations (GAS lines 2233-2234)
  BASE_CAPACITY_PER_SHIFT: 250_000,
  MAX_SHIFTS: 3,
  DAYS_PER_QUARTER: 90,
  OPEX_PER_QUARTER: 15_000_000,
  DAILY_UNITS_ESTIMATE: 200_000 / 90,
};

/**
 * Calculate comprehensive SCRM risk assessment
 * GAS lines 2176-2384
 */
export function calculateSCRMRiskAssessment(
  // Supplier Concentration Risk (25%)
  globalOrders: number,
  regionalOrders: number,
  
  // Inventory Buffer Risk (20%)
  rawMaterialUnits: number,
  finishedGoodsUnits: number,
  totalRevenue: number,
  
  // Demand Volatility Risk (15%)
  demandMape: number,
  quarter: number,
  
  // Financial Health Risk (15%)
  cash: number,
  shortTermDebt: number,
  longTermDebt: number,
  accountsReceivable: number,
  fixedAssets: number,
  inventoryValue: number,
  
  // Operational Risk (25%)
  unitsProduced: number,
  perfectOrder: number,
  ordersInTransit: number,
  
  // Context
  dcCentralOpen: boolean = false,
  dcWestOpen: boolean = false,
): SCRMRiskResult {
  const W = SCRM_RISK_CONFIG.weights;
  const C = SCRM_RISK_CONFIG;
  const T = SCRM_RISK_CONFIG.thresholds;

  // ============================================================================
  // CATEGORY 1: SUPPLIER CONCENTRATION RISK (25%)
  // GAS lines 2209-2227
  // ============================================================================
  const totalOrders = globalOrders + regionalOrders;
  let supplierConcentration = 100;
  let numSuppliers = 1;
  
  if (totalOrders > 0) {
    supplierConcentration = (globalOrders / totalOrders) * 100;
    numSuppliers = (globalOrders > 0 ? 1 : 0) + (regionalOrders > 0 ? 1 : 0);
  }
  
  const singleSource = numSuppliers === 1;

  let supplierConcentrationRisk = 0;
  if (supplierConcentration > 80) supplierConcentrationRisk = 80;
  else if (supplierConcentration > 60) supplierConcentrationRisk = 50;
  else supplierConcentrationRisk = 20;
  
  if (singleSource) supplierConcentrationRisk += 20;
  supplierConcentrationRisk = Math.min(100, supplierConcentrationRisk);

  const supplierDetails = `Concentration: ${supplierConcentration.toFixed(0)}% | Suppliers: ${numSuppliers} | Single Source: ${singleSource ? 'YES' : 'No'}`;

  // ============================================================================
  // CATEGORY 2: INVENTORY BUFFER RISK (20%)
  // GAS lines 2230-2262
  // ============================================================================
  const dailyProduction = C.DAILY_UNITS_ESTIMATE;
  const dailySales = dailyProduction;

  const rawDays = dailyProduction > 0 ? rawMaterialUnits / dailyProduction : 0;
  const fgDays = dailySales > 0 ? finishedGoodsUnits / dailySales : 0;

  let inventoryBufferRisk = 0;
  if (fgDays < 7) inventoryBufferRisk = 90;
  else if (fgDays < 14) inventoryBufferRisk = 60;
  else if (fgDays < 21) inventoryBufferRisk = 30;
  else inventoryBufferRisk = 10;
  
  if (rawDays < 30) inventoryBufferRisk += 20;
  inventoryBufferRisk = Math.min(100, inventoryBufferRisk);

  let bufferStatus = 'STRONG';
  if (fgDays < 7) bufferStatus = 'CRITICAL';
  else if (fgDays < 14) bufferStatus = 'LOW';
  else if (fgDays < 21) bufferStatus = 'ADEQUATE';

  const inventoryDetails = `Raw Days: ${rawDays.toFixed(0)} | FG Days: ${fgDays.toFixed(0)} | Buffer: ${bufferStatus}`;

  // ============================================================================
  // CATEGORY 3: DEMAND VOLATILITY RISK (15%)
  // GAS lines 2264-2290
  // ============================================================================
  const calendarQuarter = ((quarter - 1) % 4) + 1;
  
  let demandVolatilityRisk = 0;
  if (demandMape > 0.25) demandVolatilityRisk = 70;
  else if (demandMape > 0.15) demandVolatilityRisk = 40;
  else demandVolatilityRisk = 15;

  if (calendarQuarter === 4) demandVolatilityRisk += 20;
  demandVolatilityRisk = Math.min(100, demandVolatilityRisk);

  let volatilityLabel = 'Low';
  if (demandMape > 0.25) volatilityLabel = 'High';
  else if (demandMape > 0.15) volatilityLabel = 'Medium';

  let seasonalExposure = 'Normal';
  if (calendarQuarter === 4) seasonalExposure = 'HIGH (Q4)';
  else if (calendarQuarter === 1) seasonalExposure = 'Low Season';

  const demandDetails = `MAPE: ${(demandMape * 100).toFixed(1)}% | Volatility: ${volatilityLabel} | Season: ${seasonalExposure}`;

  // ============================================================================
  // CATEGORY 4: FINANCIAL HEALTH RISK (15%)
  // GAS lines 2292-2321
  // ============================================================================
  const totalDebt = shortTermDebt + longTermDebt;
  const totalAssets = cash + accountsReceivable + inventoryValue + fixedAssets;
  const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;
  const cashRunway = cash / C.OPEX_PER_QUARTER;

  let financialHealthRisk = 0;
  if (cash < T.CASH_CRITICAL) financialHealthRisk = 80;
  else if (cash < T.CASH_LOW) financialHealthRisk = 50;
  else if (cash < T.CASH_MODERATE) financialHealthRisk = 25;
  else financialHealthRisk = 10;

  if (debtRatio > 60) financialHealthRisk += 30;
  else if (debtRatio > 40) financialHealthRisk += 15;
  financialHealthRisk = Math.min(100, financialHealthRisk);

  const financialDetails = `Cash: $${(cash / 1_000_000).toFixed(1)}M | Debt Ratio: ${debtRatio.toFixed(0)}% | Runway: ${cashRunway.toFixed(1)}Q`;

  // ============================================================================
  // CATEGORY 5: OPERATIONAL RISK (25%)
  // GAS lines 2323-2350
  // ============================================================================
  const maxCapacity = C.BASE_CAPACITY_PER_SHIFT * C.MAX_SHIFTS;
  const capacityUtilization = maxCapacity > 0 ? (unitsProduced / maxCapacity) * 100 : 0;
  const perfectOrderPercent = perfectOrder * 100;
  const leadTimeExposure = rawMaterialUnits > 0 ? ordersInTransit / rawMaterialUnits : 0;

  let leadTimeRisk = 'Low';
  if (ordersInTransit > rawMaterialUnits) leadTimeRisk = 'High';
  else if (ordersInTransit > rawMaterialUnits * 0.5) leadTimeRisk = 'Medium';

  let operationalRisk = 0;
  
  if (capacityUtilization > 95) operationalRisk = 60;
  else if (capacityUtilization > 85) operationalRisk = 40;
  else if (capacityUtilization < 50) operationalRisk = 30;
  else operationalRisk = 15;

  if (perfectOrderPercent < 80) operationalRisk += 30;
  else if (perfectOrderPercent < 90) operationalRisk += 15;
  
  if (leadTimeExposure > 1.0) operationalRisk += 20;
  else if (leadTimeExposure > 0.5) operationalRisk += 10;
  
  operationalRisk = Math.min(100, operationalRisk);

  const operationalDetails = `Capacity: ${capacityUtilization.toFixed(0)}% | Perfect Order: ${perfectOrderPercent.toFixed(0)}% | Lead Time: ${leadTimeRisk}`;

  // ============================================================================
  // CALCULATE WEIGHTED TOTAL SCORE
  // GAS lines 2352-2360
  // ============================================================================
  const totalScore = Math.round(
    supplierConcentrationRisk * W.SUPPLIER_CONCENTRATION +
    inventoryBufferRisk * W.INVENTORY_BUFFER +
    demandVolatilityRisk * W.DEMAND_VOLATILITY +
    financialHealthRisk * W.FINANCIAL_HEALTH +
    operationalRisk * W.OPERATIONAL
  );

  // ============================================================================
  // DETERMINE RISK LEVEL
  // GAS lines 2365-2373
  // ============================================================================
  let level: { level: string; color: string; description: string };

  if (totalScore <= 30) {
    level = { level: 'LOW', color: '#d9ead3', description: 'Good supply chain health' };
  } else if (totalScore <= 50) {
    level = { level: 'MODERATE', color: '#fff2cc', description: 'Some risks to monitor' };
  } else if (totalScore <= 70) {
    level = { level: 'ELEVATED', color: '#fce5cd', description: 'Significant risks identified' };
  } else if (totalScore <= 85) {
    level = { level: 'HIGH', color: '#f4cccc', description: 'Critical risks require action' };
  } else {
    level = { level: 'CRITICAL', color: '#ea9999', description: 'URGENT: Supply chain at severe risk' };
  }

  // ============================================================================
  // GENERATE RECOMMENDATIONS
  // GAS lines 2400-2420
  // ============================================================================
  const riskActions = [
    { name: 'supplier', score: supplierConcentrationRisk, action: 'Diversify suppliers - add Regional' },
    { name: 'inventory', score: inventoryBufferRisk, action: 'Increase safety stock levels' },
    { name: 'demand', score: demandVolatilityRisk, action: 'Improve demand forecasting (APS)' },
    { name: 'financial', score: financialHealthRisk, action: 'Build cash reserves' },
    { name: 'operational', score: operationalRisk, action: 'Optimize capacity utilization' },
  ];
  
  riskActions.sort((a, b) => b.score - a.score);
  
  const recommendations = riskActions
    .filter(r => r.score > 30)
    .slice(0, 3)
    .map(r => r.action);
  
  if (recommendations.length === 0) {
    recommendations.push('Supply chain is healthy. Continue monitoring.');
  }

  // ============================================================================
  // BUILD INPUTS OBJECT FOR AUDIT TRAIL
  // ============================================================================
  const inputs: SCRMRiskInputs = {
    // Supplier Concentration (25%)
    globalOrders,
    regionalOrders,
    supplierConcentration: Math.round(supplierConcentration),
    numSuppliers,
    
    // Inventory Buffer (20%)
    rawMaterialUnits,
    finishedGoodsUnits,
    rawDaysOfSupply: Math.round(rawDays),
    fgDaysOfSupply: Math.round(fgDays),
    totalRevenue,
    
    // Demand Volatility (15%)
    demandMape,
    calendarQuarter,
    
    // Financial Health (15%)
    cash,
    shortTermDebt,
    longTermDebt,
    debtRatio: Math.round(debtRatio * 10) / 10,
    cashRunway: Math.round(cashRunway * 10) / 10,
    accountsReceivable,
    fixedAssets,
    inventoryValue,
    
    // Operational (25%)
    unitsProduced,
    maxCapacity,
    capacityUtilization: Math.round(capacityUtilization * 10) / 10,
    perfectOrder,
    ordersInTransit,
    leadTimeExposure: Math.round(leadTimeExposure * 100) / 100,
    
    // Context
    dcCentralOpen,
    dcWestOpen,
  };

  return {
    totalScore,
    level,
    breakdown: {
      supplierConcentrationRisk,
      inventoryBufferRisk,
      demandVolatilityRisk,
      financialHealthRisk,
      operationalRisk,
    },
    details: {
      supplierDetails,
      inventoryDetails,
      demandDetails,
      financialDetails,
      operationalDetails,
    },
    inputs,
    recommendations,
  };
}