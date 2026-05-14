/**
 * FLEXEE 2.0 - Supplier Scorecards Module
 * 
 * This file handles supplier management, performance tracking, and scorecards.
 * Works alongside the main FLEXEE script.
 * 
 * SUPPLIERS:
 * - Global Supplier: Low cost, 1 quarter lead time, reliable
 * - Regional Supplier: +15% cost, same quarter delivery, flexible
 * - (Future) Certified Supplier: Premium cost, highest quality
 */

/******************************************************************************
 * SUPPLIER CONFIGURATION
 ******************************************************************************/

const SUPPLIER_CONFIG = {
  // Supplier definitions
  SUPPLIERS: {
    GLOBAL: {
      id: "GLOBAL",
      name: "Global Parts Co.",
      location: "Asia-Pacific",
      leadTime: 1,  // quarters
      costMultiplier: 1.0,
      baseOnTime: 0.92,
      baseQuality: 0.95,
      baseFlexibility: 0.60,  // Can't rush orders easily
      minOrder: 100000,
      maxOrder: 2000000,
      description: "Low cost, 1 quarter lead time"
    },
    REGIONAL: {
      id: "REGIONAL", 
      name: "Regional Supply Inc.",
      location: "Domestic",
      leadTime: 0,  // same quarter
      costMultiplier: 1.15,
      baseOnTime: 0.95,
      baseQuality: 0.93,
      baseFlexibility: 0.90,  // Very responsive
      minOrder: 0,
      maxOrder: 500000,
      description: "+15% cost, same quarter delivery"
    }
  },
  
  // Scorecard weights for overall score
  WEIGHTS: {
    onTime: 0.30,      // 30% - delivery reliability
    quality: 0.25,     // 25% - defect-free rate
    cost: 0.25,        // 25% - cost competitiveness
    flexibility: 0.20  // 20% - responsiveness
  },
  
  // Performance variability
  VARIABILITY: {
    onTime: 0.05,    // ±5% random variation
    quality: 0.03,   // ±3% random variation
  },
  
  // Rating thresholds
  RATINGS: {
    EXCELLENT: 90,
    GOOD: 80,
    ACCEPTABLE: 70,
    POOR: 60
  }
};

/******************************************************************************
 * SHEET SETUP
 ******************************************************************************/

/**
 * Setup Supplier Scorecards sheet
 * Call this from main initialization or run standalone
 */
function setupSupplierScorecardsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupSupplierScorecardsSheet_(ss);
  SpreadsheetApp.getUi().alert("Supplier Scorecards sheet created!");
}

function setupSupplierScorecardsSheet_(ss) {
  let sheet = ss.getSheetByName("Supplier_Scorecards");
  if (!sheet) {
    sheet = ss.insertSheet("Supplier_Scorecards");
  }
  sheet.clear();
  
  const S = SUPPLIER_CONFIG.SUPPLIERS;
  
  // Header section
  const headerData = [
    ["SUPPLIER SCORECARDS", "", "", "", "", ""],
    ["Performance tracking for procurement decisions", "", "", "", "", ""],
    ["", "", "", "", "", ""],
  ];
  
  // Supplier 1: Global
  const globalData = [
    ["GLOBAL PARTS CO.", "", "", "", "", ""],
    ["Location:", S.GLOBAL.location, "", "Lead Time:", S.GLOBAL.leadTime + " quarter", ""],
    ["Cost:", "Standard (1.0x)", "", "Min Order:", S.GLOBAL.minOrder.toLocaleString(), ""],
    ["", "", "", "", "", ""],
    ["PERFORMANCE METRICS", "Current", "3Q Avg", "Trend", "Target", "Rating"],
    ["On-Time Delivery", "92%", "92%", "→", ">90%", "GOOD"],
    ["Quality (Defect-Free)", "95%", "95%", "→", ">93%", "GOOD"],
    ["Cost Index", "100", "100", "→", "<105", "GOOD"],
    ["Flexibility Score", "60%", "60%", "→", ">70%", "WARN"],
    ["", "", "", "", "", ""],
    ["OVERALL SCORE", "82", "", "", ">80", "GOOD"],
    ["", "", "", "", "", ""],
  ];
  
  // Supplier 2: Regional
  const regionalData = [
    ["REGIONAL SUPPLY INC.", "", "", "", "", ""],
    ["Location:", S.REGIONAL.location, "", "Lead Time:", "Same quarter", ""],
    ["Cost:", "+15% Premium (1.15x)", "", "Max Order:", S.REGIONAL.maxOrder.toLocaleString(), ""],
    ["", "", "", "", "", ""],
    ["PERFORMANCE METRICS", "Current", "3Q Avg", "Trend", "Target", "Rating"],
    ["On-Time Delivery", "95%", "95%", "→", ">90%", "EXCELLENT"],
    ["Quality (Defect-Free)", "93%", "93%", "→", ">93%", "GOOD"],
    ["Cost Index", "115", "115", "→", "<120", "GOOD"],
    ["Flexibility Score", "90%", "90%", "→", ">70%", "EXCELLENT"],
    ["", "", "", "", "", ""],
    ["OVERALL SCORE", "85", "", "", ">80", "GOOD"],
    ["", "", "", "", "", ""],
  ];
  
  // Order history section
  const historyHeader = [
    ["ORDER HISTORY", "", "", "", "", ""],
    ["Quarter", "Supplier", "Quantity", "Cost", "On-Time?", "Quality Issues"],
  ];
  
  // Combine all data
  const allData = [
    ...headerData,
    ...globalData,
    ...regionalData,
    ...historyHeader
  ];
  
  sheet.getRange(1, 1, allData.length, 6).setValues(allData);
  
  // Formatting
  sheet.getRange(1, 1).setFontSize(16).setFontWeight("bold");
  
  // Global supplier header
  sheet.getRange(4, 1).setFontSize(12).setFontWeight("bold").setBackground("#4a86e8").setFontColor("white");
  sheet.getRange(4, 1, 1, 6).setBackground("#4a86e8");
  sheet.getRange(8, 1, 1, 6).setFontWeight("bold").setBackground("#c9daf8");
  sheet.getRange(14, 1, 1, 6).setFontWeight("bold").setBackground("#e8e8e8");
  
  // Regional supplier header
  sheet.getRange(16, 1).setFontSize(12).setFontWeight("bold").setBackground("#6aa84f").setFontColor("white");
  sheet.getRange(16, 1, 1, 6).setBackground("#6aa84f");
  sheet.getRange(20, 1, 1, 6).setFontWeight("bold").setBackground("#d9ead3");
  sheet.getRange(26, 1, 1, 6).setFontWeight("bold").setBackground("#e8e8e8");
  
  // Order history header
  sheet.getRange(28, 1).setFontSize(12).setFontWeight("bold");
  sheet.getRange(29, 1, 1, 6).setFontWeight("bold").setBackground("#e8e8e8");
  
  // Column widths
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 100);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 100);
}

/******************************************************************************
 * SUPPLIER PERFORMANCE TRACKING
 ******************************************************************************/

/**
 * Record supplier order and performance for a quarter
 * Called from main processQuarterForFirm_
 */
function recordSupplierPerformance_(ss, quarter, firmId, supplierType, orderQty, actualDelivered) {
  const sheet = ss.getSheetByName("Supplier_Scorecards");
  if (!sheet) return;
  
  const S = SUPPLIER_CONFIG.SUPPLIERS[supplierType];
  if (!S || orderQty <= 0) return;
  
  // Calculate performance for this order
  const performance = calculateSupplierPerformance_(S, orderQty, actualDelivered);
  
  // Find next empty row in order history (starts at row 30)
  const historyStartRow = 30;
  const lastRow = Math.max(historyStartRow, sheet.getLastRow() + 1);
  
  // Calculate cost
  const baseCost = orderQty * 50;  // $50 per unit base (from CONFIG.costs.RAW_MATERIAL_COST)
  const actualCost = baseCost * S.costMultiplier;
  
  // Record order
  const orderRow = [
    quarter,
    S.name,
    orderQty,
    "$" + Math.round(actualCost).toLocaleString(),
    performance.onTimeDelivery ? "Yes" : "Late",
    performance.qualityIssues > 0 ? performance.qualityIssues + " units" : "None"
  ];
  
  sheet.getRange(lastRow, 1, 1, 6).setValues([orderRow]);
  
  // Color code on-time column
  if (performance.onTimeDelivery) {
    sheet.getRange(lastRow, 5).setBackground("#d9ead3");
  } else {
    sheet.getRange(lastRow, 5).setBackground("#f4cccc");
  }
  
  return performance;
}

/**
 * Calculate supplier performance metrics for an order
 */
function calculateSupplierPerformance_(supplier, orderQty, actualDelivered) {
  const V = SUPPLIER_CONFIG.VARIABILITY;
  
  // On-time delivery (probabilistic based on base rate)
  const onTimeRoll = Math.random();
  const onTimeThreshold = supplier.baseOnTime + (Math.random() * 2 - 1) * V.onTime;
  const onTimeDelivery = onTimeRoll < onTimeThreshold;
  
  // Quality (defect rate)
  const qualityRate = supplier.baseQuality + (Math.random() * 2 - 1) * V.quality;
  const qualityIssues = Math.round(orderQty * (1 - qualityRate));
  
  // Actual delivered (accounting for quality issues)
  const goodUnits = actualDelivered - qualityIssues;
  
  return {
    onTimeDelivery: onTimeDelivery,
    qualityRate: qualityRate,
    qualityIssues: Math.max(0, qualityIssues),
    goodUnits: Math.max(0, goodUnits),
    flexibility: supplier.baseFlexibility,
    costIndex: supplier.costMultiplier * 100
  };
}

/**
 * Update supplier scorecard metrics based on recent history
 */
function updateSupplierScorecards_(ss, quarter) {
  const sheet = ss.getSheetByName("Supplier_Scorecards");
  if (!sheet) return;
  
  // Get order history
  const historyStartRow = 30;
  const lastRow = sheet.getLastRow();
  
  if (lastRow < historyStartRow) return;  // No history yet
  
  const historyData = sheet.getRange(historyStartRow, 1, lastRow - historyStartRow + 1, 6).getValues();
  
  // Calculate metrics for each supplier
  const globalMetrics = calculateSupplierMetrics_(historyData, "Global Parts Co.", quarter);
  const regionalMetrics = calculateSupplierMetrics_(historyData, "Regional Supply Inc.", quarter);
  
  // Update Global supplier scorecard (rows 9-13)
  if (globalMetrics.orderCount > 0) {
    updateSupplierCard_(sheet, 9, globalMetrics, SUPPLIER_CONFIG.SUPPLIERS.GLOBAL);
  }
  
  // Update Regional supplier scorecard (rows 21-25)
  if (regionalMetrics.orderCount > 0) {
    updateSupplierCard_(sheet, 21, regionalMetrics, SUPPLIER_CONFIG.SUPPLIERS.REGIONAL);
  }
}

/**
 * Calculate aggregate metrics from order history
 */
function calculateSupplierMetrics_(historyData, supplierName, currentQuarter) {
  const recentOrders = historyData.filter(row => 
    row[1] === supplierName && row[0] >= currentQuarter - 3
  );
  
  if (recentOrders.length === 0) {
    return { orderCount: 0 };
  }
  
  let onTimeCount = 0;
  let qualityIssueTotal = 0;
  let totalUnits = 0;
  
  recentOrders.forEach(order => {
    totalUnits += order[2] || 0;
    if (order[4] === "Yes") onTimeCount++;
    const issueMatch = String(order[5]).match(/(\d+)/);
    if (issueMatch) qualityIssueTotal += parseInt(issueMatch[1]);
  });
  
  const onTimeRate = recentOrders.length > 0 ? onTimeCount / recentOrders.length : 0;
  const qualityRate = totalUnits > 0 ? 1 - (qualityIssueTotal / totalUnits) : 0.95;
  
  return {
    orderCount: recentOrders.length,
    onTimeRate: onTimeRate,
    qualityRate: qualityRate,
    totalUnits: totalUnits
  };
}

/**
 * Update a supplier's scorecard section
 */
function updateSupplierCard_(sheet, startRow, metrics, supplier) {
  const W = SUPPLIER_CONFIG.WEIGHTS;
  const R = SUPPLIER_CONFIG.RATINGS;
  
  // Current values
  const onTimePct = Math.round(metrics.onTimeRate * 100);
  const qualityPct = Math.round(metrics.qualityRate * 100);
  const costIndex = Math.round(supplier.costMultiplier * 100);
  const flexPct = Math.round(supplier.baseFlexibility * 100);
  
  // Calculate overall score
  const onTimeScore = Math.min(100, onTimePct / 0.9 * 100);  // 90% = 100 points
  const qualityScore = Math.min(100, qualityPct / 0.93 * 100);  // 93% = 100 points
  const costScore = Math.max(0, 100 - (costIndex - 100) * 2);  // 100 = 100 points, 115 = 70 points
  const flexScore = Math.min(100, flexPct / 0.7 * 100);  // 70% = 100 points
  
  const overallScore = Math.round(
    onTimeScore * W.onTime +
    qualityScore * W.quality +
    costScore * W.cost +
    flexScore * W.flexibility
  );
  
  // Determine ratings
  const getRate = (val, target, isLower) => {
    if (isLower) {
      if (val <= target) return "EXCELLENT";
      if (val <= target * 1.1) return "GOOD";
      if (val <= target * 1.2) return "WARN";
      return "POOR";
    } else {
      if (val >= target * 1.1) return "EXCELLENT";
      if (val >= target) return "GOOD";
      if (val >= target * 0.9) return "WARN";
      return "POOR";
    }
  };
  
  // Update cells
  sheet.getRange(startRow, 2).setValue(onTimePct + "%");
  sheet.getRange(startRow, 6).setValue(getRate(onTimePct, 90, false));
  formatRatingCell_(sheet, startRow, 6);
  
  sheet.getRange(startRow + 1, 2).setValue(qualityPct + "%");
  sheet.getRange(startRow + 1, 6).setValue(getRate(qualityPct, 93, false));
  formatRatingCell_(sheet, startRow + 1, 6);
  
  sheet.getRange(startRow + 2, 2).setValue(costIndex);
  sheet.getRange(startRow + 2, 6).setValue(getRate(costIndex, 105, true));
  formatRatingCell_(sheet, startRow + 2, 6);
  
  sheet.getRange(startRow + 3, 2).setValue(flexPct + "%");
  sheet.getRange(startRow + 3, 6).setValue(getRate(flexPct, 70, false));
  formatRatingCell_(sheet, startRow + 3, 6);
  
  // Overall score
  sheet.getRange(startRow + 5, 2).setValue(overallScore);
  const overallRating = overallScore >= R.EXCELLENT ? "EXCELLENT" :
                        overallScore >= R.GOOD ? "GOOD" :
                        overallScore >= R.ACCEPTABLE ? "WARN" : "POOR";
  sheet.getRange(startRow + 5, 6).setValue(overallRating);
  formatRatingCell_(sheet, startRow + 5, 6);
}

/**
 * Format rating cell with color
 */
function formatRatingCell_(sheet, row, col) {
  const value = sheet.getRange(row, col).getValue();
  const colors = {
    "EXCELLENT": "#d9ead3",
    "GOOD": "#fff2cc",
    "WARN": "#fce5cd",
    "POOR": "#f4cccc"
  };
  sheet.getRange(row, col).setBackground(colors[value] || "#ffffff");
}

/******************************************************************************
 * INTEGRATION HELPERS
 ******************************************************************************/

/**
 * Get supplier info for decision support
 */
function getSupplierInfo(supplierType) {
  return SUPPLIER_CONFIG.SUPPLIERS[supplierType] || null;
}

/**
 * Calculate order cost for a supplier
 */
function calculateSupplierCost(supplierType, quantity, baseUnitCost) {
  const supplier = SUPPLIER_CONFIG.SUPPLIERS[supplierType];
  if (!supplier) return quantity * baseUnitCost;
  return quantity * baseUnitCost * supplier.costMultiplier;
}

/**
 * Check if order quantity is valid for supplier
 */
function validateSupplierOrder(supplierType, quantity) {
  const supplier = SUPPLIER_CONFIG.SUPPLIERS[supplierType];
  if (!supplier) return { valid: false, message: "Unknown supplier" };
  
  if (quantity < supplier.minOrder) {
    return { valid: false, message: `Minimum order: ${supplier.minOrder.toLocaleString()} units` };
  }
  if (quantity > supplier.maxOrder) {
    return { valid: false, message: `Maximum order: ${supplier.maxOrder.toLocaleString()} units` };
  }
  return { valid: true, message: "OK" };
}

/******************************************************************************
 * MENU INTEGRATION
 ******************************************************************************/

/**
 * Add supplier menu items (call from main onOpen or run standalone)
 */
function addSupplierMenu() {
  SpreadsheetApp.getUi()
    .createMenu("📦 Suppliers")
    .addItem("View Supplier Scorecards", "showSupplierScorecards")
    .addItem("Refresh Scorecards", "refreshSupplierScorecards")
    .addSeparator()
    .addItem("Setup Supplier Sheet", "setupSupplierScorecardsSheet")
    .addToUi();
}

/**
 * Navigate to supplier scorecards sheet
 */
function showSupplierScorecards() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Supplier_Scorecards");
  
  if (!sheet) {
    setupSupplierScorecardsSheet_(ss);
    sheet = ss.getSheetByName("Supplier_Scorecards");
  }
  
  ss.setActiveSheet(sheet);
}

/**
 * Manually refresh scorecard calculations
 */
function refreshSupplierScorecards() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stocksSheet = ss.getSheetByName("Stocks");
  
  if (!stocksSheet || stocksSheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert("No simulation data found.");
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
  
  updateSupplierScorecards_(ss, currentQuarter);
  SpreadsheetApp.getUi().alert("Supplier Scorecards refreshed for Q" + currentQuarter);
}
