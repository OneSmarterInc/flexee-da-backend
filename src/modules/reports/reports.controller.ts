// src/modules/reports/reports.controller.ts
//
// FLEXEE DA — Reports controller (Analytics Edition).
//
// Routes:
//   GET /reports/kpi-history/:simulationId/:firmId
//   GET /reports/kpi-history/:simulationId/:firmId/:startQuarter/:endQuarter
//   GET /reports/competitor-comparison/:simulationId/:firmId/:quarter
//   GET /reports/balanced-scorecard/:simulationId/:firmId/:quarter
//   GET /reports/financial-summary/:simulationId/:quarter
//   GET /reports/10q/:simulationId/:firmId/:quarter
//   GET /reports/10q/:simulationId/:firmId
//
// Removed corporate-edition routes:
//   ✗ GET /reports/intelligence/:sim/:firm/:quarter   — Intel Center gone
//   ✗ GET /reports/warranty-claims/:sim/:firm/:quarter — Warranty gone
//   ✗ GET /reports/green-score/:sim/:firm             — Green score gone
//
// All five corresponding service methods were also deleted; the underlying
// schemas (IntelligenceReport, WarrantyClaim, GreenScoreHistory) were removed
// from src/schemas/index.ts. If a frontend still calls these, it'll get 404 —
// remove those fetches as part of the cockpit DA pass.

import {
  Controller,
  Get,
  Param,
  Req,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/index.entity';
import { ReportsService } from './reports.service';
import { redactOtherOutcomes } from './outcome-redact';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  // ============================================================================
  // KPI HISTORY
  // ============================================================================

  /**
   * KPI history for a firm — quarter range.
   * Order matters: this must be declared BEFORE the no-range variant below
   * so Nest matches `:startQuarter/:endQuarter` first.
   */
  @Get('kpi-history/:simulationId/:firmId/:startQuarter/:endQuarter')
  async getKpiHistoryByRange(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('startQuarter') startQuarter: string,
    @Param('endQuarter') endQuarter: string,
  ) {
    const start = parseInt(startQuarter, 10);
    const end = parseInt(endQuarter, 10);

    if (isNaN(start) || isNaN(end) || start > end) {
      throw new BadRequestException(
        'Invalid quarter range. Start must be <= End',
      );
    }

    return this.reportsService.getKpiHistoryByRange(
      simulationId,
      firmId,
      start,
      end,
    );
  }

  /**
   * Full KPI history for a firm.
   */
  @Get('kpi-history/:simulationId/:firmId')
  async getKpiHistory(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
  ) {
    return this.reportsService.getKpiHistory(simulationId, firmId);
  }

  // ============================================================================
  // COMPETITOR COMPARISON
  // ============================================================================

  @Get('competitor-comparison/:simulationId/:firmId/:quarter')
  async getCompetitorComparison(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
    @Req() req?: any,
  ) {
    const quarterNum = this.parseQuarter(quarter);

    const result: any = await this.reportsService.getCompetitorComparison(
      simulationId,
      firmId,
      quarterNum,
    );
    if (req?.user?.role !== UserRole.STUDENT || !Array.isArray(result?.peers)) return result;
    // A student sees their own firm's outcome, not the others'.
    const own = await this.reportsService.studentFirmId(simulationId, req.user._id);
    return { ...result, peers: redactOtherOutcomes(result.peers, own, (p: any) => p.firmId) };
  }

  // ============================================================================
  // BALANCED SCORECARD
  // ============================================================================

  @Get('balanced-scorecard/:simulationId/:firmId/:quarter')
  async getBalancedScorecard(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
    @Req() req?: any,
  ) {
    const quarterNum = this.parseQuarter(quarter);

    const scorecard: any = await this.reportsService.getBalancedScorecard(
      simulationId,
      firmId,
      quarterNum,
    );

    if (!scorecard) {
      throw new NotFoundException(
        `Balanced Scorecard not found for firm ${firmId}, quarter ${quarterNum}`,
      );
    }

    // A student sees their own firm's outcome, not another firm's.
    if (req?.user?.role === UserRole.STUDENT) {
      const own = await this.reportsService.studentFirmId(simulationId, req.user._id);
      if (own !== firmId) return { ...scorecard, outcome: null };
    }
    return scorecard;
  }

  // ============================================================================
  // FINANCIAL SUMMARY (cross-firm)
  // ============================================================================

  @Get('financial-summary/:simulationId/:quarter')
  async getFinancialSummary(
    @Param('simulationId') simulationId: string,
    @Param('quarter') quarter: string,
  ) {
    const quarterNum = this.parseQuarter(quarter);

    return this.reportsService.getFinancialSummary(simulationId, quarterNum);
  }

  // ============================================================================
  // 10-Q REPORT
  // ============================================================================

  /**
   * Quarterly 10-Q for a single quarter.
   * Order: more-specific route before the firm-only variant.
   */
  @Get('10q/:simulationId/:firmId/:quarter')
  async getTenQReport(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
  ) {
    const quarterNum = this.parseQuarter(quarter);

    const report = await this.reportsService.getTenQReport(
      simulationId,
      firmId,
      quarterNum,
    );

    if (!report) {
      throw new NotFoundException(
        `10-Q report not found for firm ${firmId}, quarter ${quarterNum}`,
      );
    }

    return report;
  }

  /**
   * All persisted 10-Qs for a firm.
   */
  @Get('10q/:simulationId/:firmId')
  async getTenQHistory(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
  ) {
    return this.reportsService.getTenQHistory(simulationId, firmId);
  }

  // ============================================================================
  // SIMULATION PERFORMANCE
  // ============================================================================

  @Get('simulation/:simulationId/performance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.FACULTY)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get cross-firm performance time series for a simulation',
    description:
      'Returns full KPI history grouped by firm, plus a current-standings ' +
      'leaderboard. Used by the faculty performance dashboard for line charts ' +
      'across quarters and ranking tables.',
  })
  @ApiResponse({ status: 200, description: 'Performance data retrieved' })
  async getSimulationPerformance(
    @Param('simulationId') simulationId: string,
  ) {
    return this.reportsService.getSimulationPerformance(simulationId);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Parses a path-param quarter string and validates it's a positive integer.
   * Throws BadRequestException with a consistent message on failure.
   */
  private parseQuarter(value: string): number {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1) {
      throw new BadRequestException('Quarter must be a positive number');
    }
    return n;
  }
}