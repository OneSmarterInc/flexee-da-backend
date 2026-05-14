/**
 * MongoDB Migration: Clean Decision Schema for Analytics Edition
 * 
 * This migration removes fields from existing decision documents that are no longer
 * in the schema. Run this ONCE after deploying the schema changes.
 * 
 * Usage:
 *   mongo <database_url> scripts/migration-clean-decision-schema.js
 * 
 * Or in Mongo shell:
 *   load('scripts/migration-clean-decision-schema.js');
 */

// Strip removed fields from all existing decision rows
const result = db.decisions.updateMany(
  {},
  {
    $unset: {
      // Procurement legacy
      orderRegional: '',

      // Production / shifts / quality / logistics
      shifts: '',
      inspectionLevel: '',
      shippingMode: '',
      carrier: '',

      // Capacity expansion
      buildSmallLine: '',
      buildMediumLine: '',
      buildLargeLine: '',

      // Inventory transfers
      transferFromCentral: '',
      transferFromCentralTo: '',
      transferFromWest: '',
      transferFromWestTo: '',

      // Warranty
      warrantyTier: '',
      centralWarrantyNetwork: '',
      westWarrantyNetwork: '',

      // Green score
      disposalMethod: '',
      ecoPackaging: '',

      // VMI
      enableVMI: '',

      // Technology — both representations
      techPurchases: '',
      purchaseERP: '',
      purchaseControlTower: '',
      purchaseAPS: '',
      purchaseDemandSensing: '',
      purchaseWMS: '',
      purchaseTMS: '',
      purchaseOMS: '',
      purchaseAnalytics: '',

      // Intel subscriptions — both representations
      intelSubscriptions: '',
      intelRegionalDemand: '',
      intelRetailChannel: '',
      intelCompetitorCapacity: '',
      intelSupplierRisk: '',
      intelCustomerSentiment: '',

      // Quality outcomes
      defectsProduced: '',
      defectsDetected: '',
      customerReturns: '',
      qualityCost: '',

      // Tech outcomes
      techPurchaseCost: '',
      techMaintenanceCost: '',
    },
  }
);

print('Migration completed successfully');
print(`Matched: ${result.matchedCount} documents`);
print(`Modified: ${result.modifiedCount} documents`);

// Verify counts — all should be 0
print('\n--- Verification ---');
const counts = {
  'techPurchases': db.decisions.countDocuments({ techPurchases: { $exists: true } }),
  'shifts': db.decisions.countDocuments({ shifts: { $exists: true } }),
  'warrantyTier': db.decisions.countDocuments({ warrantyTier: { $exists: true } }),
  'enableVMI': db.decisions.countDocuments({ enableVMI: { $exists: true } }),
  'inspectionLevel': db.decisions.countDocuments({ inspectionLevel: { $exists: true } }),
  'carrier': db.decisions.countDocuments({ carrier: { $exists: true } }),
  'orderRegional': db.decisions.countDocuments({ orderRegional: { $exists: true } }),
};

for (const [field, count] of Object.entries(counts)) {
  print(`${field}: ${count} documents still have this field`);
}

if (Object.values(counts).every(c => c === 0)) {
  print('\n✓ All removed fields successfully deleted from existing documents');
} else {
  print('\n✗ WARNING: Some documents still contain removed fields!');
}
