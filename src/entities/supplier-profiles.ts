// ============================================================================
// SUPPLIER PROFILES - Analytics Mode
// Six supplier profiles for the Supplier Analytics module
// ============================================================================

export interface SupplierProfile {
  id: string;
  name: string;
  country: string;
  unitCost: number;
  volumeDiscount5k: number;    // Discount % at 5K+ units
  volumeDiscount10k: number;   // Discount % at 10K+ units
  leadTimeDays: number;
  onTimeDelivery: number;      // On-time delivery rate (0-1)
  defectRate: number;          // Defect rate (0-1)
  capacity: number;            // Annual capacity
  minOrder: number;            // Minimum order quantity
  tariffRate: number;          // Tariff rate (0-1)
  freightPerUnit: number;      // Freight cost per unit
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const SUPPLIER_PROFILES: Record<string, SupplierProfile> = {
  SUP001: {
    id: 'SUP001',
    name: 'GlobalTech Manufacturing',
    country: 'China',
    unitCost: 42.50,
    volumeDiscount5k: 0.03,
    volumeDiscount10k: 0.05,
    leadTimeDays: 45,
    onTimeDelivery: 0.88,
    defectRate: 0.025,
    capacity: 500000,
    minOrder: 10000,
    tariffRate: 0.25,
    freightPerUnit: 5.00,
    riskLevel: 'MEDIUM',
  },
  SUP002: {
    id: 'SUP002',
    name: 'Precision Parts Inc',
    country: 'USA',
    unitCost: 58.00,
    volumeDiscount5k: 0.02,
    volumeDiscount10k: 0.04,
    leadTimeDays: 14,
    onTimeDelivery: 0.96,
    defectRate: 0.008,
    capacity: 200000,
    minOrder: 5000,
    tariffRate: 0,
    freightPerUnit: 2.00,
    riskLevel: 'LOW',
  },
  SUP003: {
    id: 'SUP003',
    name: 'EuroComponents GmbH',
    country: 'Germany',
    unitCost: 54.00,
    volumeDiscount5k: 0.025,
    volumeDiscount10k: 0.045,
    leadTimeDays: 21,
    onTimeDelivery: 0.94,
    defectRate: 0.012,
    capacity: 300000,
    minOrder: 7500,
    tariffRate: 0.05,
    freightPerUnit: 3.00,
    riskLevel: 'LOW',
  },
  SUP004: {
    id: 'SUP004',
    name: 'Pacific Rim Supply',
    country: 'Vietnam',
    unitCost: 38.00,
    volumeDiscount5k: 0.035,
    volumeDiscount10k: 0.06,
    leadTimeDays: 52,
    onTimeDelivery: 0.82,
    defectRate: 0.035,
    capacity: 400000,
    minOrder: 15000,
    tariffRate: 0.05,
    freightPerUnit: 5.00,
    riskLevel: 'HIGH',
  },
  SUP005: {
    id: 'SUP005',
    name: 'MexiParts SA',
    country: 'Mexico',
    unitCost: 48.00,
    volumeDiscount5k: 0.03,
    volumeDiscount10k: 0.05,
    leadTimeDays: 10,
    onTimeDelivery: 0.91,
    defectRate: 0.018,
    capacity: 250000,
    minOrder: 8000,
    tariffRate: 0,
    freightPerUnit: 2.50,
    riskLevel: 'MEDIUM',
  },
  SUP006: {
    id: 'SUP006',
    name: 'IndiaSource Ltd',
    country: 'India',
    unitCost: 36.00,
    volumeDiscount5k: 0.04,
    volumeDiscount10k: 0.07,
    leadTimeDays: 42,
    onTimeDelivery: 0.84,
    defectRate: 0.030,
    capacity: 600000,
    minOrder: 20000,
    tariffRate: 0.05,
    freightPerUnit: 4.50,
    riskLevel: 'HIGH',
  },
  REGIONAL: {
    id: 'REGIONAL',
    name: 'Regional Quick Supply',
    country: 'Domestic',
    unitCost: 195,
    volumeDiscount5k: 0.0,
    volumeDiscount10k: 0.0,
    leadTimeDays: 0,
    onTimeDelivery: 0.98,
    defectRate: 0.010,
    capacity: 100000,
    minOrder: 1000,
    tariffRate: 0,
    freightPerUnit: 1.00,
    riskLevel: 'LOW',
  },
};

export interface SupplierProcurementResult {
  totalCost: number;
  weightedDefectRate: number;
  weightedOnTime: number;
  supplierBreakdown: Array<{
    supplierId: string;
    name: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    defectRate: number;
    onTimeDelivery: number;
  }>;
}

/**
 * Calculate supplier procurement cost and quality metrics in Analytics Mode
 * Used when analyticsMode is enabled and students have selected specific suppliers
 */
export function calculateSupplierProcurement(
  orderQuantity: number,
  decisions: any,
): SupplierProcurementResult {
  const primaryId = decisions?.primarySupplier || 'SUP001';
  const secondaryId = decisions?.secondarySupplier || 'NONE';
  const primaryAlloc = decisions?.primaryAllocation || 100;
  const emergencyOrder = decisions?.emergencyRegionalOrder || 0;

  const primary = SUPPLIER_PROFILES[primaryId];
  if (!primary) {
    console.error(`Unknown primary supplier: ${primaryId}, using SUP001`);
    return calculateSupplierProcurement(orderQuantity, {
      ...decisions,
      primarySupplier: 'SUP001',
    });
  }

  // Calculate quantities for each supplier
  const primaryQty = Math.round(orderQuantity * (primaryAlloc / 100));
  let secondaryQty = 0;
  let secondary: SupplierProfile | null = null;

  if (secondaryId !== 'NONE' && primaryAlloc < 100) {
    secondary = SUPPLIER_PROFILES[secondaryId];
    if (secondary) {
      secondaryQty = orderQuantity - primaryQty;
    }
  }

  // Calculate unit costs with volume discounts for primary supplier
  let primaryUnitCost = primary.unitCost;
  if (primaryQty >= 10000) {
    primaryUnitCost *= 1 - primary.volumeDiscount10k;
  } else if (primaryQty >= 5000) {
    primaryUnitCost *= 1 - primary.volumeDiscount5k;
  }
  const primaryLandedCost =
    primaryUnitCost * (1 + primary.tariffRate) + primary.freightPerUnit;
  const primaryTotalCost = primaryQty * primaryLandedCost;

  // Calculate unit costs with volume discounts for secondary supplier (if any)
  let secondaryTotalCost = 0;
  let secondaryLandedCost = 0;
  if (secondary && secondaryQty > 0) {
    let secondaryUnitCost = secondary.unitCost;
    if (secondaryQty >= 10000) {
      secondaryUnitCost *= 1 - secondary.volumeDiscount10k;
    } else if (secondaryQty >= 5000) {
      secondaryUnitCost *= 1 - secondary.volumeDiscount5k;
    }
    secondaryLandedCost =
      secondaryUnitCost * (1 + secondary.tariffRate) + secondary.freightPerUnit;
    secondaryTotalCost = secondaryQty * secondaryLandedCost;
  }

  // Emergency regional order (premium pricing)
  const regional = SUPPLIER_PROFILES['REGIONAL'];
  const emergencyCost = emergencyOrder * regional.unitCost;

  // Total cost
  const totalCost = primaryTotalCost + secondaryTotalCost + emergencyCost;
  const totalOrdered = primaryQty + secondaryQty + emergencyOrder;

  // Weighted average metrics (for quality/delivery impact)
  let totalWeight = primaryQty + secondaryQty + emergencyOrder;
  if (totalWeight === 0) totalWeight = 1; // Avoid division by zero

  const weightedDefectRate =
    (primaryQty * primary.defectRate +
      (secondary ? secondaryQty * secondary.defectRate : 0) +
      emergencyOrder * regional.defectRate) /
    totalWeight;

  const weightedOnTime =
    (primaryQty * primary.onTimeDelivery +
      (secondary ? secondaryQty * secondary.onTimeDelivery : 0) +
      emergencyOrder * regional.onTimeDelivery) /
    totalWeight;

  // Build supplier breakdown for reporting
  const breakdown: Array<{
    supplierId: string;
    name: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    defectRate: number;
    onTimeDelivery: number;
  }> = [];
  breakdown.push({
    supplierId: primaryId,
    name: primary.name,
    quantity: primaryQty,
    unitCost: primaryLandedCost,
    totalCost: primaryTotalCost,
    defectRate: primary.defectRate,
    onTimeDelivery: primary.onTimeDelivery,
  });

  if (secondary && secondaryQty > 0) {
    breakdown.push({
      supplierId: secondaryId,
      name: secondary.name,
      quantity: secondaryQty,
      unitCost: secondaryLandedCost,
      totalCost: secondaryTotalCost,
      defectRate: secondary.defectRate,
      onTimeDelivery: secondary.onTimeDelivery,
    });
  }

  if (emergencyOrder > 0) {
    breakdown.push({
      supplierId: 'REGIONAL',
      name: regional.name,
      quantity: emergencyOrder,
      unitCost: regional.unitCost,
      totalCost: emergencyCost,
      defectRate: regional.defectRate,
      onTimeDelivery: regional.onTimeDelivery,
    });
  }

  return {
    totalCost,
    weightedDefectRate,
    weightedOnTime,
    supplierBreakdown: breakdown,
  };
}
