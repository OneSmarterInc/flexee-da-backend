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
import { loadOutcomes } from './outcome.loader';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  KpiHistory,
  KpiHistoryDocument,
  TenQReport,
  TenQReportDocument,
  Firm,
  FirmDocument,
  Decision,
  DecisionDocument,
  Simulation,
  SimulationDocument,
  Enrollment,
  EnrollmentDocument,
  EnrollmentStatus,
} from '../../entities/index.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(KpiHistory.name)
    private kpiHistoryModel: Model<KpiHistoryDocument>,
    @InjectModel(TenQReport.name)
    private tenqReportModel: Model<TenQReportDocument>,
    @InjectModel(Firm.name)
    private firmModel: Model<FirmDocument>,
    @InjectModel(Decision.name)
    private decisionModel: Model<DecisionDocument>,
    @InjectModel(Simulation.name)
    private simulationModel: Model<SimulationDocument>,
    @InjectModel(Enrollment.name)
    private enrollmentModel: Model<EnrollmentDocument>,
  ) {}

  /** The firm an active student is on in this course, or null. */
  async studentFirmId(simulationId: string, userId: unknown): Promise<string | null> {
    const e = await this.enrollmentModel
      .findOne({
        simulation: new Types.ObjectId(simulationId),
        user: new Types.ObjectId(String(userId)),
        status: { $in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
        firm: { $ne: null },
      })
      .select('firm')
      .lean();
    return e?.firm ? String(e.firm) : null;
  }

  private outcomes(simulationId: Types.ObjectId) {
    return loadOutcomes(
      {
        kpiHistoryModel: this.kpiHistoryModel,
        decisionModel: this.decisionModel,
        simulationModel: this.simulationModel,
      },
      simulationId,
    );
  }

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

    const outcomes = await this.outcomes(simId);

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
        outcome: outcomes.get(kpi.firm.toString()) ?? null,
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

    const outcomes = await this.outcomes(new Types.ObjectId(simulationId));

    return {
      quarter,
      firmId: firmId.toString(),
      // Old documents still carry bsc.grade; it is never sent.
      scorecard: (({ grade: _grade, ...rest }: any) => rest)(
        (kpiData.bsc as any)?.toObject?.() ?? kpiData.bsc ?? {},
      ),
      outcome: outcomes.get(firmId.toString()) ?? null,
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

  // ============================================================================
  // SIMULATION PERFORMANCE
  // ============================================================================
  // Returns the full time-series of KPIs for every firm in a simulation, in
  // a shape that's easy for charts to consume directly. One DB read for the
  // KPI history (sorted by quarter), one for firm metadata (name/color/number),
  // then in-memory grouping.

  async getSimulationPerformance(simulationId: string): Promise<any> {
    const simId = new Types.ObjectId(simulationId);

    // Pull KPI history sorted by firm then quarter so the groupBy stays cheap
    const kpis = await this.kpiHistoryModel
      .find({ simulation: simId })
      .sort({ firm: 1, quarter: 1 });

    // Firm metadata for display (name, color, firmNumber)
    const firms = await this.firmModel
      .find({ simulation: simId })
      .sort({ firmNumber: 1 });

    // Group KPI rows by firm. Map keyed on string firmId for stable lookups.
    const byFirm = new Map<string, any[]>();
    for (const kpi of kpis) {
      const fid = kpi.firm.toString();
      if (!byFirm.has(fid)) byFirm.set(fid, []);
      byFirm.get(fid)!.push({
        quarter: kpi.quarter,
        financial: kpi.financial,
        customer: kpi.customer,
        operations: kpi.operations,
        inventory: kpi.inventory,
        learning: kpi.learning,
        bsc: kpi.bsc,
        costs: kpi.costs,
      });
    }

    // Build per-firm output. Firms with no KPI rows yet still appear so the
    // chart legend stays consistent across the run — they just show empty
    // series. Better than omitting them and having the legend change mid-sim.
    const firmSeries = firms.map((firm: any) => {
      const series = byFirm.get(firm._id.toString()) || [];
      return {
        firmId: firm._id.toString(),
        firmNumber: firm.firmNumber,
        name: firm.name,
        color: firm.color,
        series,
        latest: series.length > 0 ? series[series.length - 1] : null,
      };
    });

    // Compute current quarter as max quarter across all KPI rows. We don't
    // read it off the Simulation entity here because it can drift in edge
    // cases (sim advanced but engine hasn't materialized the new quarter's
    // KPIs yet). Using the data we have keeps charts honest.
    const allQuarters = kpis.map(k => k.quarter);
    const currentQuarter = allQuarters.length > 0 ? Math.max(...allQuarters) : 0;
    const totalQuarters = new Set(allQuarters).size;

    // Leaderboard: rank by latest BSC overall (with revenue fallback). Firms
    // with no data sit at the bottom with score=0 rather than being filtered
    // out — faculty can still see they exist.
    const outcomes = await this.outcomes(simId);

    const leaderboard = [...firmSeries]
      .map(f => {
        const latest = f.latest;
        return {
          firmId: f.firmId,
          firmNumber: f.firmNumber,
          name: f.name,
          color: f.color,
          score: latest?.bsc?.overall ?? 0,
          outcome: outcomes.get(f.firmId) ?? null,
          missedQuarters: outcomes.get(f.firmId)?.missed ?? 0,
          revenue: latest?.financial?.revenue ?? 0,
          netIncome: latest?.financial?.netIncome ?? 0,
          marketShare: latest?.customer?.marketShare ?? 0,
          csi: latest?.customer?.csi ?? 0,
          fillRate: latest?.customer?.fillRate ?? 0,
          hasData: latest != null,
        };
      })
      .sort((a, b) => {
        // Has-data firms first, then by score desc, then by revenue desc as
        // tiebreaker so the order is fully deterministic.
        if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
        if (b.score !== a.score) return b.score - a.score;
        return b.revenue - a.revenue;
      })
      .map((f, i) => ({ ...f, rank: i + 1 }));

    return {
      simulationId,
      currentQuarter,
      totalQuarters,
      firmCount: firms.length,
      firms: firmSeries,
      leaderboard,
    };
  }
}