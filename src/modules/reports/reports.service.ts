// src/modules/reports/reports.service.ts
//
// FLEXEE DA — Reports service (Analytics Edition).
//
// What this provides:
//   - getKpiHistory / getKpiHistoryByRange  — full BSC history
//   - getCompetitorComparison               — peer ranking + benchmarks
//   - getBalancedScorecard                  — single-quarter BSC + metrics
//   - getFinancialSummary                   — cross-firm financial roll-up
//   - getTenQReport                         — quarterly 10-Q (added; was implied)
//
// What was removed and why:
//   ✗ getVmiData, getVmiTrend, calculateVmiSummary
//       VMI feature is gone in DA. KpiHistory no longer has a vmi block;
//       CostBreakdown no longer has vmiSetup/vmiOngoing.
//
//   ✗ getIntelligenceReports
//       Intelligence Center subscriptions are gone. The IntelligenceReport
//       schema is removed.
//
//   ✗ getWarrantyClaims
//       Warranty system is gone. The WarrantyClaim schema is removed.
//
//   ✗ getGreenScoreHistory
//       Green score is gone. The GreenScoreHistory schema is removed.
//
// If a frontend still calls /vmi or /intel-reports etc. routes, the controller
// should be updated to remove those endpoints — leaving them as stubs here
// would just push the 404 elsewhere. Better to fail at the controller level
// where the deletion is obvious.

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  KpiHistory,
  KpiHistoryDocument,
  TenQReport,
  TenQReportDocument,
} from '../../entities/index.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(KpiHistory.name)
    private kpiHistoryModel: Model<KpiHistoryDocument>,
    @InjectModel(TenQReport.name)
    private tenqReportModel: Model<TenQReportDocument>,
  ) {}

  // ============================================================================
  // KPI HISTORY
  // ============================================================================

  /**
   * Full KPI history for a firm across all quarters.
   */
  async getKpiHistory(
    simulationId: string,
    firmId: string,
  ): Promise<KpiHistoryDocument[]> {
    return this.kpiHistoryModel
      .find({
        simulation: new Types.ObjectId(simulationId),
        firm: new Types.ObjectId(firmId),
      })
      .sort({ quarter: 1 });
  }

  /**
   * KPI history for a quarter range (inclusive).
   */
  async getKpiHistoryByRange(
    simulationId: string,
    firmId: string,
    startQuarter: number,
    endQuarter: number,
  ): Promise<KpiHistoryDocument[]> {
    return this.kpiHistoryModel
      .find({
        simulation: new Types.ObjectId(simulationId),
        firm: new Types.ObjectId(firmId),
        quarter: { $gte: startQuarter, $lte: endQuarter },
      })
      .sort({ quarter: 1 });
  }

  // ============================================================================
  // COMPETITOR COMPARISON
  // ============================================================================
  // All firms in the simulation for a given quarter, ranked by BSC overall
  // (revenue fallback). Returns flat per-firm fields the cockpit reads.

  async getCompetitorComparison(
    simulationId: string,
    firmId: string,
    quarter: number,
  ) {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    const firmKpi = await this.kpiHistoryModel.findOne({
      simulation: simId,
      firm: frmId,
      quarter,
    });

    const allKpis = await this.kpiHistoryModel.find({
      simulation: simId,
      quarter,
    });

    // Sorted peers — primary key is BSC overall, fall back to revenue
    const sortedByScore = [...allKpis].sort(
      (a, b) =>
        (b.bsc?.overall || b.financial?.revenue || 0) -
        (a.bsc?.overall || a.financial?.revenue || 0),
    );

    const peers = sortedByScore.map((kpi, index) => {
      const isCurrentFirm = kpi.firm.toString() === firmId;
      const rev = kpi.financial?.revenue || 0;
      const cogs = kpi.financial?.cogs || 0;

      return {
        firmId: kpi.firm.toString(),
        rank: index + 1,
        isCurrentFirm,
        isYou: isCurrentFirm,

        // Financial — flat for direct frontend reads
        revenue: rev,
        netIncome: kpi.financial?.netIncome || 0,
        grossMarginPct:
          kpi.financial?.grossMarginPct ??
          (rev > 0 ? ((rev - cogs) / rev) * 100 : 0),

        // Customer
        marketShare: kpi.customer?.marketShare || 0,
        csi: kpi.customer?.csi || 0,
        fillRate: kpi.customer?.fillRate || 0,

        // Operations
        perfectOrder: kpi.operations?.perfectOrder || 0,
        mape: kpi.operations?.mape || 0,

        // BSC
        score: kpi.bsc?.overall || 0,
        bscOverall: kpi.bsc?.overall || 0,
        grade: kpi.bsc?.grade || '—',
      };
    });

    // Ranking arrays — kept for dashboard backward-compat
    const rankings = {
      byRevenue: this.rankBy(allKpis, firmId, (k) => k.financial?.revenue || 0, 'revenue'),
      byMarketShare: this.rankBy(allKpis, firmId, (k) => k.customer?.marketShare || 0, 'marketShare'),
      byCsi: this.rankBy(allKpis, firmId, (k) => k.customer?.csi || 0, 'csi'),
      byFillRate: this.rankBy(allKpis, firmId, (k) => k.customer?.fillRate || 0, 'fillRate'),
    };

    return {
      currentFirmId: firmId,
      quarter,
      peers,
      firmData: firmKpi,
      benchmarks: rankings,
      totalFirms: allKpis.length,
    };
  }

  /**
   * Generic ranking helper — replaces 4× duplicated sort/map blocks.
   */
  private rankBy(
    kpis: KpiHistoryDocument[],
    firmId: string,
    getValue: (k: KpiHistoryDocument) => number,
    valueKey: string,
  ) {
    return [...kpis]
      .sort((a, b) => getValue(b) - getValue(a))
      .map((kpi, index) => ({
        firmId: kpi.firm.toString(),
        rank: index + 1,
        [valueKey]: getValue(kpi),
        isCurrentFirm: kpi.firm.toString() === firmId,
      }));
  }

  // ============================================================================
  // BALANCED SCORECARD
  // ============================================================================
  // Slimmed: removed `vmi` from allMetrics (no longer on KpiHistory).
  // `learning` block now has only scMaturity + forecastAccuracy (the DA shape).

  async getBalancedScorecard(
    simulationId: string,
    firmId: string,
    quarter: number,
  ) {
    const kpiData = await this.kpiHistoryModel.findOne({
      simulation: new Types.ObjectId(simulationId),
      firm: new Types.ObjectId(firmId),
      quarter,
    });

    if (!kpiData) {
      return null;
    }

    return {
      quarter,
      firmId: firmId.toString(),
      scorecard: kpiData.bsc,
      allMetrics: {
        financial: kpiData.financial,
        customer: kpiData.customer,
        operations: kpiData.operations,
        inventory: kpiData.inventory,
        learning: kpiData.learning,
      },
      // CostBreakdown for cockpit cost waterfall (DA: labor/holding/marketing/interest)
      costs: kpiData.costs,
    };
  }

  // ============================================================================
  // FINANCIAL SUMMARY (cross-firm, one quarter)
  // ============================================================================

  async getFinancialSummary(simulationId: string, quarter: number) {
    const kpis = await this.kpiHistoryModel.find({
      simulation: new Types.ObjectId(simulationId),
      quarter,
    });

    if (kpis.length === 0) {
      return {
        quarter,
        firmCount: 0,
        firmSummaries: [],
        totals: {
          totalRevenue: 0,
          avgNetIncome: 0,
          avgGrossMarginPct: 0,
          avgCsi: 0,
          avgFillRate: 0,
        },
      };
    }

    const summary = kpis.map((kpi) => ({
      firmId: kpi.firm.toString(),
      revenue: kpi.financial?.revenue ?? 0,
      netIncome: kpi.financial?.netIncome ?? 0,
      grossMarginPct: kpi.financial?.grossMarginPct ?? 0,
      csi: kpi.customer?.csi ?? 0,
      marketShare: kpi.customer?.marketShare ?? 0,
      fillRate: kpi.customer?.fillRate ?? 0,
      cogs: kpi.financial?.cogs ?? 0,
      operatingExpenses: kpi.financial?.operatingExpenses ?? 0,
    }));

    const n = summary.length;
    const totals = {
      totalRevenue: summary.reduce((s, x) => s + x.revenue, 0),
      avgNetIncome: summary.reduce((s, x) => s + x.netIncome, 0) / n,
      avgGrossMarginPct: summary.reduce((s, x) => s + x.grossMarginPct, 0) / n,
      avgCsi: summary.reduce((s, x) => s + x.csi, 0) / n,
      avgFillRate: summary.reduce((s, x) => s + x.fillRate, 0) / n,
    };

    return {
      quarter,
      firmCount: n,
      firmSummaries: summary,
      totals,
    };
  }

  // ============================================================================
  // 10-Q REPORT
  // ============================================================================
  // Returns the persisted quarterly 10-Q. Engine writes this; service reads it.

  async getTenQReport(
    simulationId: string,
    firmId: string,
    quarter: number,
  ): Promise<TenQReportDocument | null> {
    return this.tenqReportModel.findOne({
      simulation: new Types.ObjectId(simulationId),
      firm: new Types.ObjectId(firmId),
      quarter,
    });
  }

  /**
   * All persisted 10-Qs for a firm — useful for "annual report" style views.
   */
  async getTenQHistory(
    simulationId: string,
    firmId: string,
  ): Promise<TenQReportDocument[]> {
    return this.tenqReportModel
      .find({
        simulation: new Types.ObjectId(simulationId),
        firm: new Types.ObjectId(firmId),
      })
      .sort({ quarter: 1 });
  }
}