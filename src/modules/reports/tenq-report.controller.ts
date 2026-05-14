import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { TenqReportService } from './tenq-report.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reports/tenq')
@UseGuards(JwtAuthGuard)
export class TenqReportController {
  constructor(private readonly tenqReportService: TenqReportService) {}

  /**
   * Get all 10-Q reports for a firm
   * GET /reports/tenq/:simulationId/:firmId
   */
  @Get(':simulationId/:firmId')
  async getTenQReportsByFirm(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
  ) {
    return this.tenqReportService.getTenQReportsByFirm(simulationId, firmId);
  }

  /**
   * Get financial trend for a firm
   * GET /reports/tenq/:simulationId/:firmId/trend
   * Query params: ?startQuarter=1&endQuarter=4
   */
  @Get(':simulationId/:firmId/trend')
  async getFinancialTrend(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Query('startQuarter') startQuarter?: string,
    @Query('endQuarter') endQuarter?: string,
  ) {
    return this.tenqReportService.getFinancialTrend(
      simulationId,
      firmId,
      startQuarter ? parseInt(startQuarter, 10) : undefined,
      endQuarter ? parseInt(endQuarter, 10) : undefined,
    );
  }

  /**
   * Get 10-Q report summary
   * GET /reports/tenq/:simulationId/:firmId/:quarter/summary
   */
  @Get(':simulationId/:firmId/:quarter/summary')
  async getTenQSummary(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
  ) {
    return this.tenqReportService.getTenQSummary(
      simulationId,
      firmId,
      parseInt(quarter, 10),
    );
  }

  /**
   * Get inventory details from 10-Q report
   * GET /reports/tenq/:simulationId/:firmId/:quarter/inventory
   */
  @Get(':simulationId/:firmId/:quarter/inventory')
  async getInventoryDetails(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
  ) {
    return this.tenqReportService.getInventoryDetails(
      simulationId,
      firmId,
      parseInt(quarter, 10),
    );
  }

  /**
   * Compare firm with peers
   * GET /reports/tenq/:simulationId/:firmId/:quarter/compare
   */
  @Get(':simulationId/:firmId/:quarter/compare')
  async compareFirmWithPeers(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
  ) {
    return this.tenqReportService.compareFirmWithPeers(
      simulationId,
      firmId,
      parseInt(quarter, 10),
    );
  }

  /**
   * Get YTD totals for a firm
   * GET /reports/tenq/:simulationId/:firmId/:quarter/ytd
   */
  @Get(':simulationId/:firmId/:quarter/ytd')
  async getYtdTotals(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
  ) {
    return this.tenqReportService.getYtdTotals(
      simulationId,
      firmId,
      parseInt(quarter, 10),
    );
  }

  /**
   * Get a specific 10-Q report for a firm in a quarter
   * GET /reports/tenq/:simulationId/:firmId/:quarter
   */
  @Get(':simulationId/:firmId/:quarter')
  async getTenQReport(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
  ) {
    return this.tenqReportService.getTenQReport(
      simulationId,
      firmId,
      parseInt(quarter, 10),
    );
  }
}
