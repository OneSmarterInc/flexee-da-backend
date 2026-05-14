import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TenQReport,
  TenQReportDocument,
} from '../../entities/index.entity';

@Injectable()
export class TenqReportService {
  constructor(
    @InjectModel(TenQReport.name)
    private tenqReportModel: Model<TenQReportDocument>,
  ) {}

  /**
   * Get a specific 10-Q report for a firm in a quarter
   */
  async getTenQReport(
    simulationId: string,
    firmId: string,
    quarter: number,
  ): Promise<TenQReportDocument> {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    const report = await this.tenqReportModel.findOne({
      simulation: simId,
      firm: frmId,
      quarter,
    });

    if (!report) {
      throw new NotFoundException(
        `10-Q report not found for firm ${firmId} in quarter ${quarter}`,
      );
    }

    return report;
  }

  /**
   * Get all 10-Q reports for a firm
   */
  async getTenQReportsByFirm(
    simulationId: string,
    firmId: string,
  ): Promise<TenQReportDocument[]> {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    return this.tenqReportModel.find({
      simulation: simId,
      firm: frmId,
    }).sort({ quarter: 1 });
  }

  /**
   * Get 10-Q reports for a quarter across all firms
   */
  async getTenQReportsByQuarter(
    simulationId: string,
    quarter: number,
  ): Promise<TenQReportDocument[]> {
    const simId = new Types.ObjectId(simulationId);

    return this.tenqReportModel.find({
      simulation: simId,
      quarter,
    });
  }

  /**
   * Get 10-Q report summary (key metrics only)
   */
  async getTenQSummary(
    simulationId: string,
    firmId: string,
    quarter: number,
  ) {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    const report = await this.tenqReportModel.findOne({
      simulation: simId,
      firm: frmId,
      quarter,
    });

    if (!report) {
      throw new NotFoundException(
        `10-Q report not found for firm ${firmId} in quarter ${quarter}`,
      );
    }

    return {
      firmId: firmId,
      quarter,
      generatedAt: report.generatedAt,
      incomeStatement: report.incomeStatement,
      balanceSheet: report.balanceSheet,
      cashFlow: report.cashFlow,
      keyMetrics: report.keyMetrics,
    };
  }

  /**
   * Get financial trend for a firm across multiple quarters
   */
  async getFinancialTrend(
    simulationId: string,
    firmId: string,
    startQuarter?: number,
    endQuarter?: number,
  ) {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    let query: any = {
      simulation: simId,
      firm: frmId,
    };

    if (startQuarter && endQuarter) {
      query.quarter = { $gte: startQuarter, $lte: endQuarter };
    }

    const reports = await this.tenqReportModel.find(query).sort({ quarter: 1 });

    if (!reports.length) {
      throw new NotFoundException(
        `No 10-Q reports found for firm ${firmId}`,
      );
    }

    const trend = reports.map((report) => ({
      quarter: report.quarter,
      revenue: report.incomeStatement?.revenue,
      netIncome: report.incomeStatement?.netIncome,
      operatingIncome: report.incomeStatement?.operatingIncome,
      totalAssets: report.balanceSheet?.totalAssets,
      totalLiabilities: report.balanceSheet?.totalLiabilities,
      equity: report.balanceSheet?.equity,
      cashFromOperations: report.cashFlow?.cashFromOperations,
      unitsProduced: report.keyMetrics?.unitsProduced,
      unitsSold: report.keyMetrics?.unitsSold,
      inventoryValue: report.inventoryReport?.totalInventoryValue,
    }));

    return {
      firmId: firmId,
      quarterRange: {
        start: reports[0].quarter,
        end: reports[reports.length - 1].quarter,
      },
      trend,
    };
  }

  /**
   * Get inventory details from 10-Q report
   */
  async getInventoryDetails(
    simulationId: string,
    firmId: string,
    quarter: number,
  ) {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    const report = await this.tenqReportModel.findOne({
      simulation: simId,
      firm: frmId,
      quarter,
    });

    if (!report) {
      throw new NotFoundException(
        `10-Q report not found for firm ${firmId} in quarter ${quarter}`,
      );
    }

    return {
      firmId: firmId,
      quarter,
      inventoryReport: report.inventoryReport,
    };
  }

  /**
   * Compare firm financials with peers
   */
  async compareFirmWithPeers(
    simulationId: string,
    firmId: string,
    quarter: number,
  ) {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    const firmReport = await this.tenqReportModel.findOne({
      simulation: simId,
      firm: frmId,
      quarter,
    });

    if (!firmReport) {
      throw new NotFoundException(
        `10-Q report not found for firm ${firmId} in quarter ${quarter}`,
      );
    }

    const allReports = await this.tenqReportModel.find({
      simulation: simId,
      quarter,
    });

    const comparison = allReports.map((report) => ({
      firmId: report.firm.toString(),
      revenue: report.incomeStatement?.revenue,
      netIncome: report.incomeStatement?.netIncome,
      grossProfit: report.incomeStatement?.grossProfit,
      grossMarginPct: report.incomeStatement?.grossMarginPct,
      totalAssets: report.balanceSheet?.totalAssets,
      equity: report.balanceSheet?.equity,
      fillRate: report.keyMetrics?.fillRate,
      csi: report.keyMetrics?.csi,
      marketShare: report.keyMetrics?.marketShare,
      isCurrentFirm: report.firm.toString() === firmId,
    }));

    return {
      currentFirmId: firmId,
      quarter,
      firms: comparison,
      totalFirms: allReports.length,
    };
  }

  /**
   * Get YTD totals for a firm
   */
  async getYtdTotals(
    simulationId: string,
    firmId: string,
    upToQuarter: number,
  ) {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    const reports = await this.tenqReportModel.find({
      simulation: simId,
      firm: frmId,
      quarter: { $lte: upToQuarter },
    }).sort({ quarter: 1 });

    if (!reports.length) {
      throw new NotFoundException(
        `No 10-Q reports found for firm ${firmId}`,
      );
    }

    const currentReport = reports[reports.length - 1];

    return {
      firmId: firmId,
      throughQuarter: upToQuarter,
      ytdTotals: currentReport.ytdTotals,
      quarterlySummary: reports.map((r) => ({
        quarter: r.quarter,
        revenue: r.incomeStatement?.revenue,
        netIncome: r.incomeStatement?.netIncome,
        unitsSold: r.keyMetrics?.unitsSold,
      })),
    };
  }

  /**
   * Create or update a 10-Q report
   */
  async createOrUpdateTenQReport(
    simulationId: string,
    firmId: string,
    quarter: number,
    reportData: Partial<TenQReport>,
  ): Promise<TenQReportDocument> {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    return this.tenqReportModel.findOneAndUpdate(
      { simulation: simId, firm: frmId, quarter },
      {
        ...reportData,
        simulation: simId,
        firm: frmId,
        quarter,
        generatedAt: new Date(),
      },
      { upsert: true, new: true },
    );
  }
}
