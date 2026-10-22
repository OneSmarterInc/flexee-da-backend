// src/modules/simulation/simulation.service.ts
// FLEXEE 2.0 Supply Chain Simulation - FIXED VERSION
// Key Fix: Consistent ObjectId usage in all queries

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { CreateSimulationDto, ModuleScheduleDto } from './dto/create-simulation.dto';
import {
  UpdateSimulationDto,
  SimulationStatus,
} from './dto/update-simulation.dto';
import {
  EnrollStudentsDto,
  EnrollmentResponseDto,
  FirmWithEnrollmentsDto,
} from './dto/enroll-students.dto';
import { TriggerEventDto } from './dto/trigger-event.dto';
import { UpdateFeaturesDto } from './dto/update-features.dto';
import {
  Simulation,
  SimulationDocument,
  Firm,
  FirmDocument,
  QuarterState,
  QuarterStateDocument,
  Decision,
  DecisionDocument,
  DemandHistory,
  DemandHistoryDocument,
  Enrollment,
  EnrollmentDocument,
  User,
  UserDocument,
  Event,
  EventDocument,
  KpiHistory,
  KpiHistoryDocument,
  EnrollmentStatus,
  RetailerMode,
  UserRole,
  ScMaturityLevel,
  DecisionStatus,
  DCStatus,
  ForecastMethod,
  ForecastSource,
  SupplierOrder,
  SupplierOrderDocument,
  SUPPLIER_SCORECARD_CONFIG,
  SupplierType,
  SUPPLIER_CONFIG,
  ForecastLogDocument,
  ForecastLog,
  EnrollmentRole,
  TenQReportDocument,
  TenQReport,
  CreditHistoryDocument,
  CreditHistory,
  EventImpact,
  EventImpactDocument,
  RegionalDCResult,
  calculateSupplierProcurement,
  SUPPLIER_PROFILES,
  ModuleScheduleMode,
  SchedulePreset,
  ANALYTICS_MODULE_CATALOG,
  ANALYTICS_MODULE_IDS,
  AnalyticsModuleId,
  StudentOnboarding,
  StudentOnboardingDocument,
} from '../../entities/index.entity';
import {
  processCustomerPools,
  CustomerPoolsResult,
  SCRMDecisions,
  CUSTOMER_POOLS_CONFIG,
} from './processors/customer-pools.processor';

import {
  calculateSCRMRiskAssessment,
  SCRMRiskResult,
  SCRMRiskInputs, // ADD THIS
} from './processors/scrm-risk.processor';

// Add to entity imports:
import { SCRMHistory, SCRMHistoryDocument } from '../../entities/index.entity';

import { CONFIG } from './simulation.config';
import {
  ANALYTICS_WORKBENCH_MODULE_BY_ID,
  ANALYTICS_WORKBENCH_MODULE_CATALOG,
  ANALYTICS_WORKBENCH_MODULE_IDS,
  AnalyticsWorkbenchModuleId,
} from '../../lib/moduleCatalog';

// ============================================================================
// CONFIGURATION
// ============================================================================
// INTERFACES
// ============================================================================
// INTERFACES
// ============================================================================

interface DemandData {
  demandR1: number;
  demandR2: number;
  demandR3: number;
  totalDemand: number;
  seasonalMultiplier: number;
  calendarQuarter: number;
  variabilityApplied: number;
}

interface QuarterResult {
  firmId: Types.ObjectId;
  firmNumber: number;
  revenue: number;
  netIncome: number;
  grossProfit: number;
  cogs: number;
  operatingExpenses: number;
  interest: number;
  laborCost: number;
  holdingCost: number;
  marketingCost: number;
  qualityCost: number;
  freightCost: number;
  dcOpex: number;
  unitsSold: number;
  unitsProduced: number;
  fillRate: number;
  defectRate: number;
  perfectOrder: number;
  capacityUtilization: number;
  rawMaterialUnits: number;
  finishedGoodsUnits: number;
  retailerInventory: number;
  inTransitUnits: number;
  dcCentralInventory: number;
  dcWestInventory: number;
  csi: number;
  marketShare: number;
  customersLoyal: number;
  customersInPlay: number;
  customersChurned: number;
  cash: number;
  // Perfect Order Components (from quarterState.perfectOrder)
  poOnTime: number;
  poInFull: number;
  poDamageFree: number;
  poDocumentation: number;
}
interface CreditScore {
  currentRatioScore: number;
  debtToEquityScore: number;
  profitMarginScore: number;
  interestCoverageScore: number;
  cashFlowScore: number;
  totalScore: number;
}

interface CreditTier {
  name: string;
  minScore: number;
  creditMultiplier: number;
  annualRate: number;
}

interface CreditFacilityResult {
  // Scoring
  creditScore: CreditScore;
  tier: CreditTier;
  creditLimit: number;

  // Current position
  previousDebt: number;
  interestCharge: number;

  // Auto-borrow (if cash < floor)
  autoBorrowAmount: number;

  // Auto-repay (if cash > ceiling)
  autoRepayAmount: number;

  // Overlimit handling
  isOverlimit: boolean;
  overlimitAmount: number;
  overlimitFee: number;

  // Forced asset sale (if severely overlimit)
  forcedSaleTriggered: boolean;
  inventorySold: number;
  forcedSaleRecovery: number;

  // Final position
  newDebt: number;
  newCash: number;
  effectiveInterestRate: number;
}

interface FinancialMetrics {
  cash: number;
  accountsReceivable: number;
  inventoryValue: number;
  fixedAssets: number;
  accountsPayable: number;
  shortTermDebt: number;
  longTermDebt: number;
  revenue: number;
  netIncome: number;
  operatingIncome: number;
  interestExpense: number;
}
interface StartingPosition {
  rawMaterialUnits: number;
  finishedGoodsUnits: number;
  accountsReceivable: number;
  fixedAssets: number;
  accountsPayable: number;
  shortTermDebt: number;
  longTermDebt: number;
}

interface FeatureFlags {
  // Always-on demand model (kept for completeness; UI doesn't expose toggles)
  seasonality: boolean;
  randomEvents: boolean;
  customerChurn: boolean;
  retailerBrain: boolean;
  regionalCompetition: boolean;
  demandForecasting: boolean;
  perfectOrderTracking: boolean;

  // Analytics-mode features (always true in DA)
  analyticsMode: boolean;
  productInnovation: boolean;
  marketExpansion: boolean;
  regionalDCs: boolean;
}

// ExpansionInProgress removed — capacity expansion not in DA

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class SimulationService {
  constructor(
    @InjectModel(Simulation.name)
    private simulationModel: Model<SimulationDocument>,
    @InjectModel(Firm.name) private firmModel: Model<FirmDocument>,
    @InjectModel(QuarterState.name)
    private quarterStateModel: Model<QuarterStateDocument>,
    @InjectModel(Decision.name) private decisionModel: Model<DecisionDocument>,
    @InjectModel(DemandHistory.name)
    private demandHistoryModel: Model<DemandHistoryDocument>,
    @InjectModel(Enrollment.name)
    private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(KpiHistory.name)
    private kpiHistoryModel: Model<KpiHistoryDocument>,
    @InjectModel(SupplierOrder.name)
    private supplierOrderModel: Model<SupplierOrderDocument>,
    @InjectModel(ForecastLog.name)
    private forecastLogModel: Model<ForecastLogDocument>,
    @InjectModel(TenQReport.name)
    private tenqReportModel: Model<TenQReportDocument>,
    @InjectModel(CreditHistory.name)
    private creditHistoryModel: Model<CreditHistoryDocument>,
    @InjectModel(SCRMHistory.name)
    private scrmHistoryModel: Model<SCRMHistoryDocument>,
    @InjectModel(EventImpact.name)
    private eventImpactModel: Model<EventImpactDocument>,
    @InjectModel(StudentOnboarding.name)
    private studentOnboardingModel: Model<StudentOnboardingDocument>,
  ) {}

  // ============================================================================
  // HELPER: Convert string to ObjectId safely
  // ============================================================================

  private toObjectId(id: string | Types.ObjectId): Types.ObjectId {
    if (id instanceof Types.ObjectId) return id;
    return new Types.ObjectId(id);
  }

  /**
   * Calculate creditworthiness score based on 5 financial metrics
   * Matching GAS calculateCreditworthiness_() function
   */
  private calculateCreditworthinessScore(
    metrics: FinancialMetrics,
  ): CreditScore {
    const W = CONFIG.credit.SCORING_WEIGHTS;
    const T = CONFIG.credit.SCORING_THRESHOLDS;

    // Calculate financial ratios
    const currentAssets =
      metrics.cash + metrics.accountsReceivable + metrics.inventoryValue;
    const currentLiabilities = metrics.accountsPayable + metrics.shortTermDebt;
    const totalDebt = metrics.shortTermDebt + metrics.longTermDebt;
    const totalAssets = currentAssets + metrics.fixedAssets;
    const equity = totalAssets - (currentLiabilities + metrics.longTermDebt);

    // 1. Current Ratio Score (20 pts)
    const currentRatio =
      currentLiabilities > 0 ? currentAssets / currentLiabilities : 999;
    let currentRatioScore = 0;
    if (currentRatio >= T.CURRENT_RATIO.excellent) {
      currentRatioScore = W.CURRENT_RATIO;
    } else if (currentRatio >= T.CURRENT_RATIO.good) {
      currentRatioScore = W.CURRENT_RATIO * 0.8;
    } else if (currentRatio >= T.CURRENT_RATIO.fair) {
      currentRatioScore = W.CURRENT_RATIO * 0.6;
    } else if (currentRatio >= T.CURRENT_RATIO.poor) {
      currentRatioScore = W.CURRENT_RATIO * 0.3;
    } else {
      currentRatioScore = W.CURRENT_RATIO * 0.1;
    }

    // 2. Debt to Equity Score (25 pts) - Lower is better
    const debtToEquity = equity > 0 ? totalDebt / equity : 999;
    let debtToEquityScore = 0;
    if (debtToEquity <= T.DEBT_TO_EQUITY.excellent) {
      debtToEquityScore = W.DEBT_TO_EQUITY;
    } else if (debtToEquity <= T.DEBT_TO_EQUITY.good) {
      debtToEquityScore = W.DEBT_TO_EQUITY * 0.8;
    } else if (debtToEquity <= T.DEBT_TO_EQUITY.fair) {
      debtToEquityScore = W.DEBT_TO_EQUITY * 0.6;
    } else if (debtToEquity <= T.DEBT_TO_EQUITY.poor) {
      debtToEquityScore = W.DEBT_TO_EQUITY * 0.3;
    } else {
      debtToEquityScore = W.DEBT_TO_EQUITY * 0.1;
    }

    // 3. Profit Margin Score (20 pts)
    const profitMargin =
      metrics.revenue > 0 ? metrics.netIncome / metrics.revenue : 0;
    let profitMarginScore = 0;
    if (profitMargin >= T.PROFIT_MARGIN.excellent) {
      profitMarginScore = W.PROFIT_MARGIN;
    } else if (profitMargin >= T.PROFIT_MARGIN.good) {
      profitMarginScore = W.PROFIT_MARGIN * 0.8;
    } else if (profitMargin >= T.PROFIT_MARGIN.fair) {
      profitMarginScore = W.PROFIT_MARGIN * 0.6;
    } else if (profitMargin >= T.PROFIT_MARGIN.poor) {
      profitMarginScore = W.PROFIT_MARGIN * 0.3;
    } else {
      profitMarginScore = W.PROFIT_MARGIN * 0.1;
    }

    // 4. Interest Coverage Score (15 pts)
    const interestCoverage =
      metrics.interestExpense > 0
        ? metrics.operatingIncome / metrics.interestExpense
        : 999;
    let interestCoverageScore = 0;
    if (interestCoverage >= T.INTEREST_COVERAGE.excellent) {
      interestCoverageScore = W.INTEREST_COVERAGE;
    } else if (interestCoverage >= T.INTEREST_COVERAGE.good) {
      interestCoverageScore = W.INTEREST_COVERAGE * 0.8;
    } else if (interestCoverage >= T.INTEREST_COVERAGE.fair) {
      interestCoverageScore = W.INTEREST_COVERAGE * 0.6;
    } else if (interestCoverage >= T.INTEREST_COVERAGE.poor) {
      interestCoverageScore = W.INTEREST_COVERAGE * 0.3;
    } else {
      interestCoverageScore = W.INTEREST_COVERAGE * 0.1;
    }

    // 5. Cash Flow Score (20 pts) - Cash relative to floor
    const cashFloorRatio = metrics.cash / CONFIG.credit.CASH_FLOOR;
    let cashFlowScore = 0;
    if (cashFloorRatio >= T.CASH_FLOW.excellent) {
      cashFlowScore = W.CASH_FLOW;
    } else if (cashFloorRatio >= T.CASH_FLOW.good) {
      cashFlowScore = W.CASH_FLOW * 0.8;
    } else if (cashFloorRatio >= T.CASH_FLOW.fair) {
      cashFlowScore = W.CASH_FLOW * 0.6;
    } else if (cashFloorRatio >= T.CASH_FLOW.poor) {
      cashFlowScore = W.CASH_FLOW * 0.3;
    } else {
      cashFlowScore = W.CASH_FLOW * 0.1;
    }

    const totalScore = Math.round(
      currentRatioScore +
        debtToEquityScore +
        profitMarginScore +
        interestCoverageScore +
        cashFlowScore,
    );

    return {
      currentRatioScore: Math.round(currentRatioScore),
      debtToEquityScore: Math.round(debtToEquityScore),
      profitMarginScore: Math.round(profitMarginScore),
      interestCoverageScore: Math.round(interestCoverageScore),
      cashFlowScore: Math.round(cashFlowScore),
      totalScore: Math.min(100, Math.max(0, totalScore)),
    };
  }

  /**
   * Determine credit tier based on creditworthiness score
   */
  private determineCreditTier(score: number): CreditTier {
    const tiers = CONFIG.credit.TIERS;

    if (score >= tiers.EXCELLENT.minScore) return tiers.EXCELLENT;
    if (score >= tiers.GOOD.minScore) return tiers.GOOD;
    if (score >= tiers.FAIR.minScore) return tiers.FAIR;
    if (score >= tiers.POOR.minScore) return tiers.POOR;
    return tiers.DISTRESSED;
  }

  /**
   * Process credit facility for a firm during quarter processing
   * Handles auto-borrow, auto-repay, overlimit fees, and forced sales
   * Matching GAS processCreditFacility_() function
   */
  private processCreditFacility(
    metrics: FinancialMetrics,
    rawMaterialUnits: number,
    finishedGoodsUnits: number,
  ): CreditFacilityResult {
    const CF = CONFIG.credit;
    const C = CONFIG.costs;

    // Step 1: Calculate creditworthiness and determine tier
    const creditScore = this.calculateCreditworthinessScore(metrics);
    const tier = this.determineCreditTier(creditScore.totalScore);
    const creditLimit = CF.BASE_CREDIT_LINE * tier.creditMultiplier;

    // Step 2: Calculate interest on existing debt (quarterly rate)
    const previousDebt = metrics.shortTermDebt;
    const quarterlyRate = tier.annualRate / 4;
    const interestCharge = previousDebt * quarterlyRate;

    // Initialize tracking variables
    let currentCash = metrics.cash;
    let currentDebt = previousDebt;
    let autoBorrowAmount = 0;
    let autoRepayAmount = 0;
    let overlimitAmount = 0;
    let overlimitFee = 0;
    let forcedSaleTriggered = false;
    let inventorySold = 0;
    let forcedSaleRecovery = 0;

    // Step 3: Deduct interest from cash
    currentCash -= interestCharge;

    // Step 4: Auto-borrow if cash falls below floor
    if (currentCash < CF.CASH_FLOOR) {
      const shortfall = CF.CASH_FLOOR - currentCash;
      autoBorrowAmount = shortfall;
      currentDebt += autoBorrowAmount;
      currentCash = CF.CASH_FLOOR;
    }

    // Step 5: Check overlimit status
    const isOverlimit = currentDebt > creditLimit;
    if (isOverlimit) {
      overlimitAmount = currentDebt - creditLimit;
      overlimitFee = overlimitAmount * CF.OVERLIMIT_FEE_RATE;
      currentCash -= overlimitFee;

      // Step 6: Check for severe overlimit - trigger forced asset sale
      if (currentDebt > creditLimit * CF.SEVERE_OVERLIMIT_THRESHOLD) {
        forcedSaleTriggered = true;

        // Calculate inventory to liquidate (10% of total)
        const totalInventoryUnits = rawMaterialUnits + finishedGoodsUnits;
        inventorySold = Math.floor(
          totalInventoryUnits * CF.FORCED_SALE_INVENTORY_PERCENT,
        );

        // Calculate recovery value (50% of inventory value)
        const avgUnitValue = (C.RAW_MATERIAL_COST + C.STANDARD_COGS) / 2;
        forcedSaleRecovery =
          inventorySold * avgUnitValue * CF.FORCED_SALE_RECOVERY_RATE;

        // Apply recovery to debt reduction
        currentDebt = Math.max(0, currentDebt - forcedSaleRecovery);
      }

      // Re-borrow if overlimit fee pushed us below floor
      if (currentCash < CF.CASH_FLOOR) {
        const additionalBorrow = CF.CASH_FLOOR - currentCash;
        autoBorrowAmount += additionalBorrow;
        currentDebt += additionalBorrow;
        currentCash = CF.CASH_FLOOR;
      }
    }

    // Step 7: Auto-repay if cash exceeds ceiling
    if (currentCash > CF.CASH_CEILING && currentDebt > 0) {
      const excessCash = currentCash - CF.CASH_CEILING;
      autoRepayAmount = Math.min(
        excessCash * CF.AUTO_REPAY_PERCENT,
        currentDebt,
      );
      currentDebt -= autoRepayAmount;
      currentCash -= autoRepayAmount;
    }

    // Calculate effective interest rate (for reporting)
    const totalCharges = interestCharge + overlimitFee;
    const effectiveRate =
      previousDebt > 0 ? (totalCharges / previousDebt) * 4 : tier.annualRate;

    return {
      creditScore,
      tier,
      creditLimit,
      previousDebt,
      interestCharge,
      autoBorrowAmount,
      autoRepayAmount,
      isOverlimit,
      overlimitAmount,
      overlimitFee,
      forcedSaleTriggered,
      inventorySold,
      forcedSaleRecovery,
      newDebt: currentDebt,
      newCash: currentCash,
      effectiveInterestRate: effectiveRate,
    };
  }

  /**
   * Record credit facility history to database
   */
  private async recordCreditHistory(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    beginningCash: number,
    creditResult: CreditFacilityResult,
  ): Promise<void> {
    await this.creditHistoryModel.create({
      simulation: simulationId,
      firm: firmId,
      quarter,
      creditScore: creditResult.creditScore,
      tierName: creditResult.tier.name,
      creditLimit: creditResult.creditLimit,
      annualRate: creditResult.tier.annualRate,
      effectiveRate: creditResult.effectiveInterestRate,
      beginningDebt: creditResult.previousDebt,
      endingDebt: creditResult.newDebt,
      interestCharge: creditResult.interestCharge,
      autoBorrowAmount: creditResult.autoBorrowAmount,
      autoRepayAmount: creditResult.autoRepayAmount,
      wasOverlimit: creditResult.isOverlimit,
      overlimitAmount: creditResult.overlimitAmount,
      overlimitFee: creditResult.overlimitFee,
      forcedSaleTriggered: creditResult.forcedSaleTriggered,
      inventorySoldUnits: creditResult.inventorySold,
      forcedSaleRecovery: creditResult.forcedSaleRecovery,
      beginningCash,
      endingCash: creditResult.newCash,
    });
  }

  /**
   * Get credit facility history for a firm
   */
  async getCreditHistory(
    simulationId: string,
    firmId: string,
    quarters?: number,
  ): Promise<any> {
    const firm = await this.resolveFirm(simulationId, firmId);
    const simObjectId = this.toObjectId(simulationId);

    let query = this.creditHistoryModel
      .find({ simulation: simObjectId, firm: firm._id })
      .sort({ quarter: -1 });

    if (quarters) {
      query = query.limit(quarters);
    }

    const history = await query;

    // Calculate summary statistics
    const summary = {
      currentTier: history[0]?.tierName || 'N/A',
      currentScore: history[0]?.creditScore?.totalScore || 0,
      currentCreditLimit: history[0]?.creditLimit || 0,
      currentDebt: history[0]?.endingDebt || 0,
      utilizationRate: history[0]
        ? (history[0].endingDebt / history[0].creditLimit) * 100
        : 0,
      totalInterestPaid: history.reduce((sum, h) => sum + h.interestCharge, 0),
      totalOverlimitFees: history.reduce((sum, h) => sum + h.overlimitFee, 0),
      timesOverlimit: history.filter((h) => h.wasOverlimit).length,
      forcedSalesCount: history.filter((h) => h.forcedSaleTriggered).length,
    };

    return {
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      summary,
      history: quarters ? history.reverse() : history,
    };
  }

  // ============================================================================
  // CREATE SIMULATION
  // ============================================================================

  async create(
    userId: string,
    dto: CreateSimulationDto,
  ): Promise<SimulationDocument> {
    const totalQuarters = dto.totalQuarters ?? 11;
    const scheduleConfig = this.resolveScheduleConfig(dto, totalQuarters);
    const quarterDurationDays = dto.quarterDurationDays ?? 14;
    const timezone = dto.timezone ?? 'UTC';
    const simulationStartDate = dto.simulationStartDate ? new Date(dto.simulationStartDate) : null;

    // Generate full quarterly schedule starting from the specified start date or now
    const quarterSchedule = this.generateQuarterSchedule(
      totalQuarters,
      quarterDurationDays,
      simulationStartDate || new Date(),
    );

    const simulation = new this.simulationModel({
      name: dto.name,
      description: dto.description,
      status: SimulationStatus.CREATED,
      currentQuarter: 0,
      totalQuarters,
      orientationQuarters: scheduleConfig.orientationQuarters,
      schedulePreset: scheduleConfig.schedulePreset,
      numFirms: dto.numFirms ?? 3,
      numRegions: dto.numRegions ?? 3,
      numProducts: dto.numProducts ?? 2,
      startingRevenue:
        dto.startingRevenue ?? CONFIG.simulation.STARTING_REVENUE,
      startingCash: dto.startingCash ?? 50_000_000,
      totalMarketSize: dto.totalMarketSize ?? CONFIG.market.TOTAL_MARKET_SIZE,
      features: this.buildFeatureToggles(dto.features),
      seasonality: dto.seasonality ?? {
        q1Multiplier: CONFIG.seasonality.QUARTERS[1],
        q2Multiplier: CONFIG.seasonality.QUARTERS[2],
        q3Multiplier: CONFIG.seasonality.QUARTERS[3],
        q4Multiplier: CONFIG.seasonality.QUARTERS[4],
      },
      eventProbability: dto.eventProbability ?? 0.15,
      demandVariability: dto.demandVariability ?? 0.05,
      quarterDurationDays,
      chartShowsAllFirms: dto.chartShowsAllFirms ?? true,
      quarterStartedAt: null,
      quarterEndsAt: null,
      courseCode: dto.courseCode,
      institutionName: dto.institutionName,
      facultyIds: dto.facultyIds?.map((id) => this.toObjectId(id)) ?? [],
      moduleSchedule: scheduleConfig.moduleSchedule,
      owner: this.toObjectId(userId),
      enrollmentCapacity: dto.enrollmentCapacity ?? 30,
      timezone,
      simulationStartDate,
      quarterSchedule,
      registrationToken: randomBytes(32).toString('hex'),
    });

    const savedSimulation = await simulation.save();
    const simulationId = savedSimulation._id as Types.ObjectId;
    const numFirms = dto.numFirms ?? 3;
    const startingCash = dto.startingCash ?? 50_000_000;

    try {
      // Create firms
      const firms: FirmDocument[] = [];
      for (let i = 1; i <= numFirms; i++) {
        const firmConfig = dto.firmConfigs?.find((f) => f.firmNumber === i);
        const firm = new this.firmModel({
          simulation: simulationId, // Use ObjectId directly
          firmNumber: i,
          name: firmConfig?.name ?? `Firm ${i}`,
          color: firmConfig?.color ?? this.getDefaultColor(i),
          currentCash: startingCash,
          currentCsi: 80,
          currentMarketShare: 1 / numFirms,
          cumulativeRevenue: 0,
          cumulativeProfit: 0,
          techOwned: [],
          members: [],
        });

        const savedFirm = await firm.save();
        firms.push(savedFirm);

        // Create initial Q0 state
        await this.createInitialQuarterState(
          simulationId,
          savedFirm._id as Types.ObjectId,
          numFirms,
          startingCash,
          savedSimulation.features as FeatureFlags,
        );
      }

      // Verify firms were created
      const firmCount = await this.firmModel.countDocuments({
        simulation: simulationId,
      });
      console.log(`Created ${firmCount} firms for simulation ${simulationId}`);

      if (firmCount === 0) {
        throw new Error('No firms were created');
      }

      // Pre-seed quarters Q1-Q3
      await this.preSeedQuarters(savedSimulation, firms);

      // Verify demand history was created
      const demandCount = await this.demandHistoryModel.countDocuments({
        simulation: simulationId,
      });
      console.log(
        `Created ${demandCount} demand history records for simulation ${simulationId}`,
      );

      // Verify KPI history was created
      const kpiCount = await this.kpiHistoryModel.countDocuments({
        simulation: simulationId,
      });
      console.log(
        `Created ${kpiCount} KPI history records for simulation ${simulationId}`,
      );

      // Update simulation status & open the Q1 window. From Q1 onward,
      // quarterStartedAt and quarterEndsAt are always populated, computed
      // from quarterDurationDays (set at creation).
      savedSimulation.currentQuarter =
        CONFIG.simulation.PREHISTORY_QUARTERS + 1;
      savedSimulation.status = SimulationStatus.INITIALIZED;
      savedSimulation.quarterStartedAt = new Date();
      savedSimulation.quarterEndsAt = new Date(
        savedSimulation.quarterStartedAt.getTime() +
          savedSimulation.quarterDurationDays * 86_400_000,
      );
      await savedSimulation.save();
    } catch (error) {
      console.error('Error creating simulation:', error);
      await this.cleanupFailedSimulation(simulationId);
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(
        `Failed to create simulation: ${errorMsg}`,
      );
    }

    return this.findOne(simulationId.toString());
  }

  private buildFeatureToggles(dto?: Partial<FeatureFlags>): FeatureFlags {
    return {
      seasonality: dto?.seasonality ?? true,
      randomEvents: dto?.randomEvents ?? true,
      customerChurn: dto?.customerChurn ?? true,
      retailerBrain: dto?.retailerBrain ?? true,
      regionalCompetition: dto?.regionalCompetition ?? true,
      demandForecasting: dto?.demandForecasting ?? true,
      perfectOrderTracking: dto?.perfectOrderTracking ?? true,
      analyticsMode: dto?.analyticsMode ?? true,
      productInnovation: dto?.productInnovation ?? true,
      marketExpansion: dto?.marketExpansion ?? true,
      regionalDCs: dto?.regionalDCs ?? true,
    };
  }

  /**
   * Resolve faculty schedule settings into the persisted canonical shape.
   * Presets override submitted moduleSchedule unless CUSTOM is selected.
   */
  private resolveScheduleConfig(
    dto: {
      moduleSchedule?: ModuleScheduleDto;
      assignedModules?: string[];
      orientationQuarters?: number;
      schedulePreset?: SchedulePreset;
    },
    totalQuarters: number,
  ): {
    orientationQuarters: number;
    schedulePreset: SchedulePreset;
    moduleSchedule: { mode: ModuleScheduleMode; modules: any[] };
  } {
    const hasAssignedModules = Array.isArray(dto.assignedModules) && dto.assignedModules.length > 0;
    const schedulePreset = dto.schedulePreset ?? ((dto.moduleSchedule || hasAssignedModules) ? SchedulePreset.CUSTOM : SchedulePreset.STANDARD_COURSE);
    if (!dto.schedulePreset && !dto.moduleSchedule && !hasAssignedModules) {
      const orientationQuarters = this.normalizeOrientationQuarters(2, totalQuarters);
      return {
        orientationQuarters,
        schedulePreset,
        moduleSchedule: this.buildDefaultModuleSchedule(totalQuarters, orientationQuarters),
      };
    }

    if (schedulePreset !== SchedulePreset.CUSTOM) {
      const preset = this.buildPresetSchedule(schedulePreset, totalQuarters);
      return {
        orientationQuarters: preset.orientationQuarters,
        schedulePreset,
        moduleSchedule: preset.moduleSchedule,
      };
    }

    const orientationQuarters = this.normalizeOrientationQuarters(
      dto.orientationQuarters ?? 2,
      totalQuarters,
    );

    if (
      dto.moduleSchedule &&
      Array.isArray(dto.moduleSchedule.modules) &&
      dto.moduleSchedule.modules.length > 0
    ) {
      return {
        orientationQuarters,
        schedulePreset,
        moduleSchedule: this.buildModuleSchedule(
          dto.moduleSchedule,
          totalQuarters,
          orientationQuarters,
        ),
      };
    }

    if (Array.isArray(dto.assignedModules) && dto.assignedModules.length > 0) {
      const requested = new Set(dto.assignedModules);
      const moduleSchedule = this.buildModuleSchedule({
        mode: ModuleScheduleMode.ALL_OPEN,
        modules: ANALYTICS_MODULE_CATALOG
          .filter(m => requested.has(m.id))
          .map(m => ({
            moduleId: m.id,
            order: m.order,
            unlocksAtQuarter: 4 + orientationQuarters,
            enabled: true,
          })),
      }, totalQuarters, orientationQuarters);

      return { orientationQuarters, schedulePreset, moduleSchedule };
    }

    return {
      orientationQuarters,
      schedulePreset,
      moduleSchedule: this.buildDefaultModuleSchedule(totalQuarters, orientationQuarters),
    };
  }

  private normalizeOrientationQuarters(value: number, totalQuarters: number): number {
    if (!Number.isInteger(value) || value < 0 || value > 6) {
      throw new BadRequestException(
        `orientationQuarters=${value} is invalid. Valid range is 0 through 6.`,
      );
    }
    if (value >= totalQuarters) {
      throw new BadRequestException(
        `orientationQuarters=${value} conflicts with totalQuarters=${totalQuarters}. orientationQuarters must be less than totalQuarters.`,
      );
    }
    return value;
  }

  private buildPresetSchedule(
    preset: SchedulePreset,
    totalQuarters: number,
  ): { orientationQuarters: number; moduleSchedule: { mode: ModuleScheduleMode; modules: any[] } } {
    const neverQuarter = totalQuarters + 1;
    const presetMap: Record<Exclude<SchedulePreset, SchedulePreset.CUSTOM>, { orientationQuarters: number; unlocks: Record<AnalyticsModuleId, number | null> }> = {
      [SchedulePreset.BASIC_SCM]: {
        orientationQuarters: 0,
        unlocks: { ds: null, sa: null, ci: null, nd: null, pi: null, me: null },
      },
      [SchedulePreset.SHORT_COURSE]: {
        orientationQuarters: 1,
        unlocks: { ds: 5, sa: 6, ci: null, nd: null, pi: null, me: null },
      },
      [SchedulePreset.STANDARD_COURSE]: {
        orientationQuarters: 2,
        unlocks: { ds: 6, sa: 7, ci: 8, nd: 9, pi: 10, me: 11 },
      },
      [SchedulePreset.LONG_COURSE]: {
        orientationQuarters: 3,
        unlocks: { ds: 7, sa: 9, ci: 11, nd: 13, pi: 15, me: 17 },
      },
    };

    const resolved = presetMap[preset as Exclude<SchedulePreset, SchedulePreset.CUSTOM>];
    if (!resolved) {
      throw new BadRequestException(
        `schedulePreset=${preset} is invalid. Valid presets are BASIC_SCM, SHORT_COURSE, STANDARD_COURSE, LONG_COURSE, CUSTOM.`,
      );
    }

    const orientationQuarters = this.normalizeOrientationQuarters(
      resolved.orientationQuarters,
      totalQuarters,
    );
    const modules = ANALYTICS_MODULE_CATALOG.map(m => {
      const unlock = resolved.unlocks[m.id];
      const enabled = typeof unlock === 'number' && unlock <= totalQuarters;
      return {
        moduleId: m.id,
        order: m.order,
        unlocksAtQuarter: enabled ? unlock : neverQuarter,
        enabled,
      };
    });

    return {
      orientationQuarters,
      moduleSchedule: this.buildModuleSchedule(
        { mode: ModuleScheduleMode.PROGRESSIVE, modules },
        totalQuarters,
        orientationQuarters,
      ),
    };
  }

  private buildDefaultModuleSchedule(
    totalQuarters: number,
    orientationQuarters: number,
  ): { mode: ModuleScheduleMode; modules: any[] } {
    const firstUnlockQuarter = 4 + orientationQuarters;
    const availableUnlockSlots = Math.max(0, totalQuarters - (3 + orientationQuarters));
    const neverQuarter = totalQuarters + 1;

    // FLEXEE DA default: Q1-Q3 are generated prehistory, then orientation
    // quarters begin at Q4, and analytics modules unlock one per quarter in
    // catalog order only when the simulation length has room for them.
    const modules = ANALYTICS_MODULE_CATALOG.map((m, index) => {
      const fits = index < availableUnlockSlots;
      return {
        moduleId: m.id,
        order: m.order,
        unlocksAtQuarter: fits ? firstUnlockQuarter + index : neverQuarter,
        enabled: fits,
      };
    });

    return this.buildModuleSchedule(
      { mode: ModuleScheduleMode.PROGRESSIVE, modules },
      totalQuarters,
      orientationQuarters,
    );
  }

  private buildModuleSchedule(
    sched: ModuleScheduleDto,
    totalQuarters: number,
    orientationQuarters: number,
  ): { mode: ModuleScheduleMode; modules: any[] } {
    this.normalizeOrientationQuarters(orientationQuarters, totalQuarters);
    const mode = (sched.mode as ModuleScheduleMode) ?? ModuleScheduleMode.PROGRESSIVE;
    const earliestUnlockQuarter = 4 + orientationQuarters;
    const neverQuarter = totalQuarters + 1;
    const seen = new Set<string>();

    const modules = sched.modules.map((m) => {
      const moduleId = String(m.moduleId || '').toLowerCase() as AnalyticsModuleId;
      if (!ANALYTICS_MODULE_IDS.includes(moduleId)) {
        throw new BadRequestException(
          `moduleSchedule.modules contains moduleId="${m.moduleId}". Valid moduleId values are ds, sa, ci, nd, pi, me.`,
        );
      }
      if (seen.has(moduleId)) {
        throw new BadRequestException(
          `moduleSchedule.modules contains duplicate moduleId="${moduleId}". Each module can appear once.`,
        );
      }
      seen.add(moduleId);

      if (!Number.isInteger(m.unlocksAtQuarter) || m.unlocksAtQuarter < 1) {
        throw new BadRequestException(
          `moduleSchedule.modules[${moduleId}].unlocksAtQuarter=${m.unlocksAtQuarter} is invalid. Valid values are integers >= 1; values greater than totalQuarters=${totalQuarters} are treated as Never.`,
        );
      }

      const requestedEnabled = m.enabled ?? true;
      if (mode !== ModuleScheduleMode.ALL_OPEN && requestedEnabled && m.unlocksAtQuarter < earliestUnlockQuarter) {
        throw new BadRequestException(
          `Module ${moduleId} cannot unlock at Q${m.unlocksAtQuarter} because orientationQuarters=${orientationQuarters}. Earliest valid unlock quarter is Q${earliestUnlockQuarter}.`,
        );
      }

      const withinRun = requestedEnabled && m.unlocksAtQuarter <= totalQuarters;
      return {
        moduleId,
        order: m.order,
        unlocksAtQuarter: withinRun ? m.unlocksAtQuarter : neverQuarter,
        enabled: withinRun,
      };
    });

    if (mode === ModuleScheduleMode.ALL_OPEN) {
      return {
        mode,
        modules: ANALYTICS_MODULE_CATALOG.map((m) => {
          const submitted = modules.find((item) => item.moduleId === m.id);
          const included = submitted ? submitted.enabled : true;
          return {
            moduleId: m.id,
            order: submitted?.order ?? m.order,
            unlocksAtQuarter: included ? earliestUnlockQuarter : neverQuarter,
            enabled: included,
          };
        }),
      };
    }

    return { mode, modules };
  }

  private async cleanupFailedSimulation(
    simulationId: Types.ObjectId,
  ): Promise<void> {
    // Gather firms first — several collections key off firm IDs, not the
    // simulation ID, so we need both for full cleanup.
    const firms = await this.firmModel.find({ simulation: simulationId }).select('_id');
    const firmIds = firms.map((f) => f._id);

    // Track what we cleaned for the dev log. Useful when debugging "why
    // does this old data still appear" complaints.
    const counts: Record<string, number> = {};

    const runDelete = async (
      name: string,
      promise: Promise<{ deletedCount?: number }>,
    ) => {
      try {
        const res = await promise;
        counts[name] = res.deletedCount ?? 0;
      } catch (err) {
        // Log but don't bail — we want to clean as much as possible even
        // if one collection fails. The simulation doc itself is deleted last.
        console.warn(
          `[cleanupFailedSimulation] ${name} cleanup failed:`,
          (err as Error).message,
        );
        counts[name] = -1;
      }
    };

    // Run all the firm-and-simulation-scoped deletes in parallel. Each one
    // is independent — order doesn't matter.
    await Promise.all([
      // ── Per-firm operational data ──
      runDelete('firms', this.firmModel.deleteMany({ simulation: simulationId })),
      runDelete(
        'enrollments',
        this.enrollmentModel.deleteMany({
          $or: [
            { simulation: simulationId },
            // Catch enrollments stored with simulation as string (legacy bug)
            { simulation: String(simulationId) },
            // Catch enrollments where firm was set but the firm got purged
            ...(firmIds.length ? [{ firm: { $in: firmIds } }] : []),
          ],
        }),
      ),
      runDelete(
        'quarter_states',
        this.quarterStateModel.deleteMany({ simulation: simulationId }),
      ),
      runDelete(
        'demand_history',
        this.demandHistoryModel.deleteMany({ simulation: simulationId }),
      ),
      runDelete(
        'kpi_history',
        this.kpiHistoryModel.deleteMany({ simulation: simulationId }),
      ),
      runDelete(
        'decisions',
        this.decisionModel.deleteMany({ simulation: simulationId }),
      ),
      runDelete(
        'credit_history',
        this.creditHistoryModel.deleteMany({ simulation: simulationId }),
      ),

      // ── Events + impacts ──
      runDelete('events', this.eventModel.deleteMany({ simulation: simulationId })),
      runDelete(
        'event_impacts',
        this.eventImpactModel.deleteMany({ simulation: simulationId }),
      ),

      // ── Reports ──
      runDelete(
        'tenq_reports',
        this.tenqReportModel.deleteMany({ simulation: simulationId }),
      ),

      // ── Supplier + forecast ──
      runDelete(
        'supplier_orders',
        this.supplierOrderModel.deleteMany({ simulation: simulationId }),
      ),
      runDelete(
        'forecast_logs',
        this.forecastLogModel.deleteMany({ simulation: simulationId }),
      ),

      // ── SCRM ──
      runDelete(
        'scrm_history',
        this.scrmHistoryModel.deleteMany({ simulation: simulationId }),
      ),

      // ── Onboarding invites ──
      runDelete(
        'student_onboardings',
        this.studentOnboardingModel.deleteMany({ simulation: simulationId }),
      ),
    ]);

    // Delete the simulation doc LAST. If anything above failed, the sim
    // still exists and a retry will work. If everything succeeded, this
    // closes the loop.
    const simRes = await this.simulationModel.deleteOne({ _id: simulationId });
    counts['simulations'] = simRes.deletedCount ?? 0;

    console.log(
      `[cleanupFailedSimulation] sim=${simulationId} firms=${firmIds.length}`,
      counts,
    );
  }
  // ============================================================================
  // INITIAL QUARTER STATE (Q0)
  // ============================================================================

  private async createInitialQuarterState(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    numFirms: number,
    startingCash: number,
    features: FeatureFlags,
  ): Promise<void> {
    const pos = this.calculateStartingPosition(numFirms);
    const PO = CONFIG.perfectOrder;
    const R = CONFIG.retailer;
    const CP = CONFIG.customer.POOLS;
    const M = CONFIG.market;

    const quarterlyDemand = M.TOTAL_MARKET_SIZE / numFirms;
    const retailerDemand = quarterlyDemand * R.CHANNEL_SHARE;
    const retailerStartingInv = Math.round(
      (retailerDemand * R.INVENTORY_TARGET_MONTHS) / 3,
    );

    const totalCustomers = quarterlyDemand;
    const loyalCustomers = Math.round(totalCustomers * CP.LOYAL_PERCENT);
    const inPlayCustomers = Math.round(totalCustomers * CP.IN_PLAY_PERCENT);

    const perfectOrderOverall =
      PO.BASE_ON_TIME *
      PO.BASE_IN_FULL *
      PO.BASE_DAMAGE_FREE *
      PO.BASE_DOCUMENTATION;

    await this.quarterStateModel.create({
      simulation: simulationId,
      firm: firmId,
      quarter: 0,
      cash: startingCash,
      accountsReceivable: pos.accountsReceivable,
      fixedAssets: pos.fixedAssets,
      accountsPayable: pos.accountsPayable,
      shortTermDebt: pos.shortTermDebt,
      longTermDebt: pos.longTermDebt,
      rawMaterialUnits: pos.rawMaterialUnits,
      finishedGoodsUnits: pos.finishedGoodsUnits,
      inTransitUnits: 0,
      ordersInTransit: 600_000,
      capacityUnits: CONFIG.production.BASE_CAPACITY_PER_SHIFT,
      csi: 80,
      marketShare: 1 / numFirms,
      cumulativeRevenue: 0,
      cumulativeProfit: 0,
      retailerInventory: retailerStartingInv,
      retailerMode: RetailerMode.NORMAL,
      customersLoyal: loyalCustomers,
      customersInPlay: inPlayCustomers,
      prevPriceP1: M.PRODUCTS.P1.basePrice,
      perfectOrder: {
        onTime: PO.BASE_ON_TIME,
        inFull: PO.BASE_IN_FULL,
        damageFree: PO.BASE_DAMAGE_FREE,
        documentation: PO.BASE_DOCUMENTATION,
        overall: perfectOrderOverall,
      },
      dcCentralOpen: false,
      dcCentralInventory: 0,
      dcWestOpen: false,
      dcWestInventory: 0,
      dcTotalOpex: 0,
    });
  }

  private calculateStartingPosition(numFirms: number): StartingPosition {
    const F = CONFIG.financial;
    const C = CONFIG.costs;
    const M = CONFIG.market;
    const P = CONFIG.production;
    const revenue = CONFIG.simulation.STARTING_REVENUE;

    const cogs = revenue * F.COGS_PERCENT;
    const opex = revenue * F.OPEX_PERCENT;

    const avgPrice =
      M.PRODUCTS.P1.basePrice * M.PRODUCTS.P1.marketShare +
      M.PRODUCTS.P2.basePrice * M.PRODUCTS.P2.marketShare;
    const annualUnitsSold = revenue / avgPrice;
    const quarterlyUnits = annualUnitsSold / 4;

    const rawMaterialUnits = Math.round(
      quarterlyUnits * P.PARTS_PER_UNIT * (6 / 13),
    );
    const finishedGoodsUnits = Math.round(quarterlyUnits * (4 / 13));

    const accountsReceivable = (revenue / 365) * F.AR_DAYS;
    const fixedAssets = revenue * F.FIXED_ASSETS_PERCENT;
    const accountsPayable = (cogs / 365) * F.AP_DAYS_COGS;
    const shortTermDebt = F.SHORT_TERM_DEBT;

    const inventoryValue =
      rawMaterialUnits * C.RAW_MATERIAL_COST +
      finishedGoodsUnits * C.STANDARD_COGS;
    const quarterlyOpex = opex / 4;
    const totalAssets =
      quarterlyOpex * F.CASH_MONTHS_OPEX +
      accountsReceivable +
      inventoryValue +
      fixedAssets;
    const longTermDebt = totalAssets * F.LONG_TERM_DEBT_PERCENT;

    return {
      rawMaterialUnits,
      finishedGoodsUnits,
      accountsReceivable,
      fixedAssets,
      accountsPayable,
      shortTermDebt,
      longTermDebt,
    };
  }

  // In SimulationService constructor, add this injection:

  // Add this method to record forecast accuracy (like GAS recordForecastAccuracy_)
  private async recordForecastAccuracy(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    naiveForecast: { r1: number; r2: number; r3: number },
    actualDemand: { demandR1: number; demandR2: number; demandR3: number },
    forecastMethod?: ForecastMethod,
    forecastSource?: ForecastSource,
  ): Promise<void> {
    // Calculate errors
    const errorR1 = naiveForecast.r1 - actualDemand.demandR1;
    const errorR2 = naiveForecast.r2 - actualDemand.demandR2;
    const errorR3 = naiveForecast.r3 - actualDemand.demandR3;
    const totalError =
      naiveForecast.r1 +
      naiveForecast.r2 +
      naiveForecast.r3 -
      (actualDemand.demandR1 + actualDemand.demandR2 + actualDemand.demandR3);

    // Calculate Absolute Percentage Errors (APE)
    const apeR1 =
      actualDemand.demandR1 > 0 ? Math.abs(errorR1) / actualDemand.demandR1 : 0;
    const apeR2 =
      actualDemand.demandR2 > 0 ? Math.abs(errorR2) / actualDemand.demandR2 : 0;
    const apeR3 =
      actualDemand.demandR3 > 0 ? Math.abs(errorR3) / actualDemand.demandR3 : 0;

    // Calculate MAPE: Average of regional APEs (matching GAS exactly)
    const mape = (apeR1 + apeR2 + apeR3) / 3;

    // Calculate bias: Percentage bias (matching GAS exactly)
    const totalActual =
      actualDemand.demandR1 + actualDemand.demandR2 + actualDemand.demandR3;
    const bias = totalActual > 0 ? totalError / totalActual : 0;

    // Calculate accuracy (inverse of MAPE, capped at 100%)
    const accuracy = Math.max(0, Math.min(1, 1 - mape));

    await this.forecastLogModel.create({
      simulation: simulationId,
      firm: firmId,
      quarter,
      forecast: {
        r1: naiveForecast.r1,
        r2: naiveForecast.r2,
        r3: naiveForecast.r3,
        total: naiveForecast.r1 + naiveForecast.r2 + naiveForecast.r3,
      },
      actual: {
        r1: actualDemand.demandR1,
        r2: actualDemand.demandR2,
        r3: actualDemand.demandR3,
        total: totalActual,
      },
      error: {
        r1: errorR1,
        r2: errorR2,
        r3: errorR3,
        total: totalError,
      },
      ape: {
        r1: apeR1,
        r2: apeR2,
        r3: apeR3,
      },
      mape,
      bias,
      accuracy,
      forecastMethod: forecastMethod || ForecastMethod.GUT,
      forecastSource: forecastSource || ForecastSource.GUT,
    });
  }

  // Update preSeedQuarters to call forecast accuracy recording:
  private async preSeedQuarters(
    simulation: SimulationDocument,
    firms: FirmDocument[],
  ): Promise<void> {
    const simulationId = simulation._id as Types.ObjectId;
    const features = simulation.features as FeatureFlags;
    const M = CONFIG.market;

    console.log(
      `Pre-seeding ${CONFIG.simulation.PREHISTORY_QUARTERS} quarters for ${firms.length} firms`,
    );

    for (
      let quarter = 1;
      quarter <= CONFIG.simulation.PREHISTORY_QUARTERS;
      quarter++
    ) {
      console.log(`Processing quarter ${quarter}...`);

      // Generate and record demand
      const demandData = await this.generateAndRecordDemand(
        simulationId,
        quarter,
        simulation.demandVariability,
        features.seasonality,
        simulation.seasonality,
      );

      console.log(`Quarter ${quarter} demand: ${demandData.totalDemand}`);

      // Generate naive forecast (base demand without seasonality - like GAS does)
      // This creates realistic forecast error for pre-history
      const calendarQuarter = ((quarter - 1) % 4) + 1;
      const naiveForecast = {
        r1: Math.round(M.TOTAL_MARKET_SIZE * M.REGIONS[1].marketShare),
        r2: Math.round(M.TOTAL_MARKET_SIZE * M.REGIONS[2].marketShare),
        r3: Math.round(M.TOTAL_MARKET_SIZE * M.REGIONS[3].marketShare),
      };

      // Process each firm
      const quarterResults: QuarterResult[] = [];
      for (const firm of firms) {
        const firmId = firm._id as Types.ObjectId;

        // Record forecast accuracy for this firm (naive forecast vs actual demand)
        // In pre-seed phase, these are BASELINE forecasts (system defaults)
        await this.recordForecastAccuracy(
          simulationId,
          firmId,
          quarter,
          naiveForecast,
          {
            demandR1: demandData.demandR1,
            demandR2: demandData.demandR2,
            demandR3: demandData.demandR3,
          },
          ForecastMethod.GUT,
          ForecastSource.BASELINE,
        );

        const result = await this.runFirmQuarterWithVariance(
          simulationId,
          firm,
          quarter,
          demandData,
          features,
        );
        quarterResults.push(result);
      }

      // Record KPI history
      await this.recordKpiHistory(simulationId, firms, quarter, quarterResults);
      for (const firm of firms) {
        const firmId = firm._id as Types.ObjectId;
        await this.generateTenQReport(simulationId, firmId, quarter);
      }
    }
  }

  // ============================================================================
  // DEMAND GENERATION
  // ============================================================================

  private async generateAndRecordDemand(
    simulationId: Types.ObjectId,
    quarter: number,
    variability: number,
    applySeasonality: boolean,
    seasonalityConfig: any,
  ): Promise<DemandData> {
    const M = CONFIG.market;
    const calendarQuarter = ((quarter - 1) % 4) + 1;

    let seasonalMultiplier = 1.0;
    if (applySeasonality) {
      const seasonalityMap: Record<number, number> = {
        1: seasonalityConfig?.q1Multiplier ?? CONFIG.seasonality.QUARTERS[1],
        2: seasonalityConfig?.q2Multiplier ?? CONFIG.seasonality.QUARTERS[2],
        3: seasonalityConfig?.q3Multiplier ?? CONFIG.seasonality.QUARTERS[3],
        4: seasonalityConfig?.q4Multiplier ?? CONFIG.seasonality.QUARTERS[4],
      };
      seasonalMultiplier = seasonalityMap[calendarQuarter];
    }

    const variabilityApplied = 1 + (Math.random() * 2 - 1) * variability;

    const demandR1 = Math.round(
      M.TOTAL_MARKET_SIZE *
        M.REGIONS[1].marketShare *
        seasonalMultiplier *
        variabilityApplied,
    );
    const demandR2 = Math.round(
      M.TOTAL_MARKET_SIZE *
        M.REGIONS[2].marketShare *
        seasonalMultiplier *
        variabilityApplied,
    );
    const demandR3 = Math.round(
      M.TOTAL_MARKET_SIZE *
        M.REGIONS[3].marketShare *
        seasonalMultiplier *
        variabilityApplied,
    );
    const totalDemand = demandR1 + demandR2 + demandR3;

    // Create demand history record with explicit ObjectId
    await this.demandHistoryModel.create({
      simulation: simulationId, // ObjectId
      quarter,
      demandR1,
      demandR2,
      demandR3,
      totalDemand,
      seasonalMultiplier,
      seasonLabel: this.getSeasonLabel(calendarQuarter, seasonalMultiplier),
      calendarQuarter,
      demandVariabilityApplied: variabilityApplied,
    });

    return {
      demandR1,
      demandR2,
      demandR3,
      totalDemand,
      seasonalMultiplier,
      calendarQuarter,
      variabilityApplied,
    };
  }

  // ============================================================================
  // PRE-HISTORY QUARTER PROCESSING
  // ============================================================================

  private async runFirmQuarterWithVariance(
    simulationId: Types.ObjectId,
    firm: FirmDocument,
    quarter: number,
    demandData: DemandData,
    features: FeatureFlags,
  ): Promise<QuarterResult> {
    const variance = CONFIG.preHistory.VARIANCE_RANGE;
    const rand = () => 1 + (Math.random() * 2 - 1) * variance;
    const firmId = firm._id as Types.ObjectId;

    const prevState = await this.quarterStateModel
      .findOne({
        simulation: simulationId,
        firm: firmId,
        quarter: quarter - 1,
      })
      .lean();

    if (!prevState) {
      throw new Error(
        `No state found for firm ${firm.firmNumber} quarter ${quarter - 1}`,
      );
    }

    const decisions = {
      forecastR1: Math.round(demandData.demandR1 * rand()),
      forecastR2: Math.round(demandData.demandR2 * rand()),
      forecastR3: Math.round(demandData.demandR3 * rand()),
      forecastMethod: ForecastMethod.GUT,
      orderGlobal: Math.round(600_000 * rand()),
      primarySupplier: 'SUP001',
      secondarySupplier: 'NONE',
      primaryAllocation: 100,
      emergencyRegionalOrder: 0,
      productionP1: Math.round(120_000 * rand()),
      productionP2: Math.round(80_000 * rand()),
      priceP1: Math.round(CONFIG.market.PRODUCTS.P1.basePrice * rand()),
      priceP2: Math.round(CONFIG.market.PRODUCTS.P2.basePrice * rand()),
      marketingBudget: Math.round(5_000_000 * rand()),
      segmentChampions: 25,
      segmentGrowth: 25,
      segmentAtRisk: 25,
      segmentOther: 25,
      dcCentralStatus: DCStatus.NO,
      dcWestStatus: DCStatus.NO,
      allocateCentral: 0,
      allocateWest: 0,
      launchP3: false,
      p3Config: 'STANDARD',
      p3Price: 549,
      productionP3: 0,
      enterR4: false,
      forecastR4: 0,
      enterR5: false,
      forecastR5: 0,
      enterR6: false,
      forecastR6: 0,
      estimatedTotalCost: 0,
      borrowingNeeded: 0,
      interestCost: 0,
      creditLineRate: 0.15,
      totalCostWithInterest: 0,
    };
    await this.decisionModel.create({
      simulation: simulationId,
      firm: firmId,
      quarter,
      status: DecisionStatus.PROCESSED, // Already processed since it's pre-history
      submittedAt: new Date(),
      processedAt: new Date(),
      ...decisions,
    });
    return this.processQuarter(
      simulationId,
      firm,
      quarter,
      prevState as any,
      decisions,
      demandData,
      features,
    );
  }

  // ============================================================================
  // UTILITY HELPERS
  // ============================================================================

  private getSeasonLabel(calendarQuarter: number, multiplier: number): string {
    const label = CONFIG.seasonality.LABELS[calendarQuarter];
    const effect =
      multiplier < 1
        ? `${((1 - multiplier) * 100).toFixed(0)}% below normal`
        : multiplier > 1
          ? `${((multiplier - 1) * 100).toFixed(0)}% above normal`
          : 'Normal';
    return `${label} (${effect})`;
  }

  private getDefaultColor(firmNumber: number): string {
    const colors = [
      '#3B82F6',
      '#10B981',
      '#F59E0B',
      '#EF4444',
      '#8B5CF6',
      '#EC4899',
    ];
    return colors[(firmNumber - 1) % colors.length];
  }

  // ============================================================================
  // QUARTERLY SCHEDULE MANAGEMENT
  // ============================================================================

  /**
   * Generate a full quarterly schedule for the entire simulation.
   * @param totalQuarters Total number of quarters in the simulation
   * @param quarterDurationDays Duration of each quarter in real-world days
   * @param startDate The date when Q1 should start
   * @returns Array of QuarterScheduleItem objects for all quarters
   */
  private generateQuarterSchedule(
    totalQuarters: number,
    quarterDurationDays: number,
    startDate: Date,
  ): any[] {
    const schedule: any[] = [];
    let currentStart = new Date(startDate);

    for (let q = 1; q <= totalQuarters; q++) {
      const plannedEnd = new Date(
        currentStart.getTime() + quarterDurationDays * 86_400_000,
      );

      schedule.push({
        quarterNumber: q,
        plannedStartAt: new Date(currentStart),
        plannedEndAt: plannedEnd,
        actualStartAt: null,
        actualEndAt: null,
        extendedByDays: 0,
        extendedAt: null,
        extensionReason: '',
      });

      // Next quarter starts when this one ends
      currentStart = plannedEnd;
    }

    return schedule;
  }

  /**
   * Extend a specific quarter by N days and adjust all future quarters.
   * Called by faculty to extend deadline for a specific quarter.
   * @param simulationId The simulation ID
   * @param quarterNumber The quarter to extend
   * @param extensionDays Number of days to extend by
   * @param reason Reason for extension (audit trail)
   */
  async extendQuarter(
    simulationId: string,
    quarterNumber: number,
    extensionDays: number,
    reason?: string,
  ): Promise<SimulationDocument> {
    if (extensionDays <= 0) {
      throw new BadRequestException('Extension days must be greater than 0');
    }

    const simId = new Types.ObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    if (!simulation.quarterSchedule || simulation.quarterSchedule.length === 0) {
      throw new BadRequestException('No quarter schedule found for this simulation');
    }

    const quarterItem = simulation.quarterSchedule.find(
      (q) => q.quarterNumber === quarterNumber,
    );
    if (!quarterItem) {
      throw new BadRequestException(
        `Quarter ${quarterNumber} not found in schedule`,
      );
    }

    // Extend this quarter
    const extensionMs = extensionDays * 86_400_000;
    quarterItem.extendedByDays = (quarterItem.extendedByDays || 0) + extensionDays;
    quarterItem.plannedEndAt = new Date(
      quarterItem.plannedEndAt.getTime() + extensionMs,
    );
    quarterItem.extendedAt = new Date();
    quarterItem.extensionReason = reason || '';

    // Find the index of the extended quarter and shift all future quarters
    const extendedQuarterIndex = simulation.quarterSchedule.findIndex(
      (q) => q.quarterNumber === quarterNumber,
    );
    
    // Adjust all future quarters (starting from the next one)
    for (let i = extendedQuarterIndex + 1; i < simulation.quarterSchedule.length; i++) {
      const nextQuarter = simulation.quarterSchedule[i];
      nextQuarter.plannedStartAt = new Date(
        nextQuarter.plannedStartAt.getTime() + extensionMs,
      );
      nextQuarter.plannedEndAt = new Date(
        nextQuarter.plannedEndAt.getTime() + extensionMs,
      );
    }

    // Update quarterEndsAt if this is the current quarter
    if (simulation.currentQuarter === quarterNumber) {
      simulation.quarterEndsAt = new Date(
        simulation.quarterEndsAt!.getTime() + extensionMs,
      );
    }

    return simulation.save();
  }

  // ============================================================================
  // PROCESS QUARTER (Core Engine)
  // ============================================================================

  private async processQuarter(
    simulationId: Types.ObjectId,
    firm: FirmDocument,
    quarter: number,
    prevState: QuarterStateDocument,
    decisions: any,
    demandData: DemandData,
    features: FeatureFlags,
  ): Promise<QuarterResult> {
    const M = CONFIG.market;
    const P = CONFIG.production;
    const C = CONFIG.costs;
    const F = CONFIG.financial;
    const R = CONFIG.retailer;
    const PO = CONFIG.perfectOrder;
    const firmId = firm._id as Types.ObjectId;

    // ========================================================================
    // CAPACITY (Fixed in DA — no expansion)
    // ========================================================================
    let totalCapacity = prevState.capacityUnits;
    let expansionCost = 0;

    // ========================================================================
    // PROCUREMENT
    // ========================================================================
    const arrivingParts = prevState.ordersInTransit || 0;
    const totalPartsAvailable = prevState.rawMaterialUnits + arrivingParts;
    let procurementCost: number;
    let supplierDefectRate = P.BASE_DEFECT_RATE;  // Default defect rate
    let supplierOnTimeRate = PO.BASE_ON_TIME;     // Default on-time rate
    let supplierBreakdown: any = null;

    if (features.analyticsMode) {
      // Analytics Mode: Use supplier selection from decisions
      const totalOrderQuantity =
        (decisions.orderGlobal || 0) + (decisions.orderRegional || 0) + (decisions.emergencyRegionalOrder || 0);
      const supplierResult = calculateSupplierProcurement(totalOrderQuantity, decisions);
      procurementCost = supplierResult.totalCost;
      supplierDefectRate = supplierResult.weightedDefectRate;
      supplierOnTimeRate = supplierResult.weightedOnTime;
      supplierBreakdown = supplierResult.supplierBreakdown;
      
      console.log(`[Q${quarter}] Supplier procurement: cost=$${Math.round(procurementCost)}, defect=${(supplierDefectRate * 100).toFixed(2)}%, onTime=${(supplierOnTimeRate * 100).toFixed(1)}%`);
    } else {
      // Standard Mode: Legacy calculation (GLOBAL and REGIONAL suppliers only)
      procurementCost =
        (decisions.orderGlobal || 0) * C.RAW_MATERIAL_COST +
        (decisions.orderRegional || 0) *
          C.RAW_MATERIAL_COST *
          (1 + C.EMERGENCY_PROCUREMENT_PREMIUM);
    }

    // ========================================================================
    // PRODUCTION - P1, P2, and P3 (if productInnovation enabled)
    // ========================================================================
    let targetTotal = decisions.productionP1 + decisions.productionP2;
    let p3Production = 0;
    let p3LaunchCost = 0;
    let p3Config = prevState.p3Config || null;
    let p3Launched = prevState.p3Launched || false;
    let p3LaunchQuarter = prevState.p3LaunchQuarter || null;

    if (features.productInnovation) {
      // Check if launching P3 this quarter
      if (decisions.launchP3 && !p3Launched) {
        p3Launched = true;
        p3LaunchQuarter = quarter;
        p3Config = decisions.p3Config || 'STANDARD';
        p3LaunchCost = CONFIG.market.P3_CONFIG.LAUNCH_COST;

        // Validate marketing budget meets minimum
        if (
          decisions.marketingBudget < CONFIG.market.P3_CONFIG.MARKETING_REQUIRED
        ) {
          // Could log warning or adjust here
        }
      }

      // Add P3 production if launched
      if (p3Launched && decisions.productionP3 > 0) {
        p3Production = decisions.productionP3;
        targetTotal += p3Production;
      }
    }

    // DA uses single shift (shifts = 1) with standard efficiency
    const shiftCostMultiplier = 1.0;
    const shiftEfficiency = 1.0;
    const effectiveCapacity = Math.floor(totalCapacity * shiftEfficiency);
    const maxFromParts = Math.floor(totalPartsAvailable / P.PARTS_PER_UNIT);
    const actualProduction = Math.min(
      targetTotal,
      maxFromParts,
      effectiveCapacity,
    );
    const partsConsumed = actualProduction * P.PARTS_PER_UNIT;
    const laborCost =
      actualProduction * P.LABOR_COST_PER_UNIT * shiftCostMultiplier;
    const capacityUtilization =
      effectiveCapacity > 0 ? actualProduction / effectiveCapacity : 0;

    // ========================================================================
    // QUALITY CONTROL - Only if feature enabled
    // ========================================================================
    // In Analytics Mode, use supplier defect rate; otherwise use base rate
    let defectRate = features.analyticsMode ? supplierDefectRate : P.BASE_DEFECT_RATE;
    let qualityCost = 0;
    let defectsProduced = 0;
    let defectsDetected = 0;

    // DA: No quality control inspection — use basic detection only
    defectsProduced = Math.round(actualProduction * defectRate);
    defectsDetected = Math.round(
      defectsProduced * CONFIG.quality.INSPECTION.NONE.detectionRate,
    );

    const goodProduction = actualProduction - defectsDetected;
    const endingRawUnits = totalPartsAvailable - partsConsumed;
    let availableFGUnits = prevState.finishedGoodsUnits + goodProduction;

    // ========================================================================
    // REGIONAL DCs - Only if feature enabled
    // ========================================================================
    let dcCentralOpen = prevState.dcCentralOpen || false;
    let dcCentralInventory = prevState.dcCentralInventory || 0;
    let dcWestOpen = prevState.dcWestOpen || false;
    let dcWestInventory = prevState.dcWestInventory || 0;
    let dcTotalOpex = 0,
      dcSetupCost = 0,
      dcDisposalRecovery = 0,
      transferCost = 0;
    let allocatedToCentral = 0,
      allocatedToWest = 0;

    if (features.regionalDCs) {
      const dcResult = this.processRegionalDCs(
        decisions,
        prevState,
        availableFGUnits,
      );
      dcCentralOpen = dcResult.dcCentralOpen;
      dcCentralInventory = dcResult.dcCentralInventory;
      dcWestOpen = dcResult.dcWestOpen;
      dcWestInventory = dcResult.dcWestInventory;
      dcTotalOpex = dcResult.opex;
      dcSetupCost = dcResult.setupCost;
      dcDisposalRecovery = dcResult.disposalRecovery;
      transferCost = dcResult.transferCost;
      allocatedToCentral = dcResult.allocatedToCentral;
      allocatedToWest = dcResult.allocatedToWest;
      availableFGUnits -= allocatedToCentral + allocatedToWest;
    }

    // ========================================================================
    // MARKET EXPANSION (R4-R6) - Only if feature enabled
    // ========================================================================
    let expansionRegionCosts = 0;
    let expansionRegionDemand = { r4: 0, r5: 0, r6: 0 };
    let r4Active = prevState.r4Active || false;
    let r5Active = prevState.r5Active || false;
    let r6Active = prevState.r6Active || false;
    let r4EntryQuarter = prevState.r4EntryQuarter || null;
    let r5EntryQuarter = prevState.r5EntryQuarter || null;
    let r6EntryQuarter = prevState.r6EntryQuarter || null;

    if (features.marketExpansion) {
      const expansionResult = this.processMarketExpansion(
        decisions,
        prevState,
        quarter,
      );
      r4Active = expansionResult.r4Active;
      r5Active = expansionResult.r5Active;
      r6Active = expansionResult.r6Active;
      r4EntryQuarter = expansionResult.r4EntryQuarter;
      r5EntryQuarter = expansionResult.r5EntryQuarter;
      r6EntryQuarter = expansionResult.r6EntryQuarter;
      expansionRegionCosts = expansionResult.totalCost;
      expansionRegionDemand = expansionResult.demand;
    }

    // ========================================================================
    // DEMAND CALCULATION - With regional competition if enabled
    // ========================================================================
    let firmBaseDemand = demandData.totalDemand * prevState.marketShare;

    // Add expansion region demand if active
    if (features.marketExpansion) {
      firmBaseDemand +=
        expansionRegionDemand.r4 +
        expansionRegionDemand.r5 +
        expansionRegionDemand.r6;
    }

    const avgPrice =
      decisions.priceP1 * M.PRODUCTS.P1.marketShare +
      decisions.priceP2 * M.PRODUCTS.P2.marketShare;
    const baseAvgPrice =
      M.PRODUCTS.P1.basePrice * M.PRODUCTS.P1.marketShare +
      M.PRODUCTS.P2.basePrice * M.PRODUCTS.P2.marketShare;

    let priceEffect = baseAvgPrice / avgPrice;
    let csiEffect = prevState.csi / 80;

    // Regional competition affects price sensitivity
    if (features.regionalCompetition) {
      // Apply regional weight adjustments (future: compare with competitors)
      priceEffect *= 0.95 + Math.random() * 0.1;
    }

    // Green score effect on demand (DA: not used — neutral effect)
    let greenScoreEffect = 1.0;

    // P3 cannibalization and new market effect
    let p3DemandEffect = 0;
    if (features.productInnovation && p3Launched) {
      const p3Cfg = CONFIG.market.P3_CONFIG;
      const quartersActive = quarter - (p3LaunchQuarter || quarter);
      const rampUpFactor = Math.min(1, quartersActive / p3Cfg.RAMP_UP_QUARTERS);

      // P3 creates new demand
      p3DemandEffect = firmBaseDemand * p3Cfg.NEW_MARKET_RATE * rampUpFactor;
    }

    const totalFirmDemand = Math.round(
      (firmBaseDemand + p3DemandEffect) *
        priceEffect *
        csiEffect *
        greenScoreEffect,
    );

    // ========================================================================
    // RETAILER LOGIC - Only apply "brain" if feature enabled
    // ========================================================================
    const retailDemand = Math.round(totalFirmDemand * R.CHANNEL_SHARE);
    const directDemand = totalFirmDemand - retailDemand;

    let retailerInventory = prevState.retailerInventory || 0;
    let retailerMode: RetailerMode = RetailerMode.NORMAL;
    let shipmentToRetailer = Math.round(retailDemand * 1.1); // Default 10% buffer

    if (features.retailerBrain) {
      // Full retailer brain logic with panic/clearance modes
      // FIX: single declaration of monthlyDemand used throughout this block
      const monthlyDemand = retailDemand / 3;
      const coverageMonths =
        monthlyDemand > 0
          ? retailerInventory / monthlyDemand
          : R.INVENTORY_TARGET_MONTHS;

      let panicThreshold = R.PANIC_THRESHOLD_MONTHS;
      let clearanceThreshold = R.CLEARANCE_THRESHOLD_MONTHS;
      let panicMultiplier = R.PANIC_ORDER_MULTIPLIER;
      let clearanceMultiplier = R.CLEARANCE_ORDER_MULTIPLIER;

      // DA: No VMI - use standard thresholds only
      const targetInv = monthlyDemand * R.INVENTORY_TARGET_MONTHS;
      const baseOrder = Math.max(
        0,
        targetInv - retailerInventory + monthlyDemand,
      );

      if (coverageMonths < panicThreshold) {
        retailerMode = RetailerMode.PANIC;
        shipmentToRetailer = Math.round(baseOrder * panicMultiplier);
      } else if (coverageMonths > clearanceThreshold) {
        retailerMode = RetailerMode.CLEARANCE;
        shipmentToRetailer = Math.round(baseOrder * clearanceMultiplier);
      } else {
        shipmentToRetailer = Math.round(baseOrder); // normal mode — target-based too
      }
    }
    // If retailerBrain is disabled, retailer just orders steadily (shipmentToRetailer already set)

    const totalAvailableForShipping =
      availableFGUnits + dcCentralInventory + dcWestInventory;
    shipmentToRetailer = Math.min(
      shipmentToRetailer,
      totalAvailableForShipping,
    );

    // ========================================================================
    // TRANSPORT LOGISTICS / MULTI-CARRIER - Conditional on features
    // ========================================================================
    let freightCost = 0;
    let onTimeRate = PO.BASE_ON_TIME;
    let damageRate = 0;
    const shippedUnits = shipmentToRetailer + directDemand;

    // DA: No advanced transport logistics - use default truck rate
    freightCost = shippedUnits * 3;

    // ========================================================================
    // SALES CALCULATION
    // ========================================================================
    const retailSales = Math.min(
      retailDemand,
      retailerInventory + shipmentToRetailer,
    );
    const fgAfterRetailer = Math.max(0, availableFGUnits - shipmentToRetailer);
    const directSales = Math.min(directDemand, fgAfterRetailer);
    const unitsSold = retailSales + directSales;
    const stockoutUnits = totalFirmDemand - unitsSold;
    const fillRate = totalFirmDemand > 0 ? unitsSold / totalFirmDemand : 1;

    const endingFGUnits = Math.max(
      0,
      availableFGUnits - shipmentToRetailer - directSales,
    );
    const endingRetailerInv = Math.max(
      0,
      retailerInventory - retailSales + shipmentToRetailer,
    );

    // Calculate demand by region for warranty processing
    const demandByRegion = {
      r1: Math.round(totalFirmDemand * M.REGIONS[1].marketShare),
      r2: Math.round(totalFirmDemand * M.REGIONS[2].marketShare),
      r3: Math.round(totalFirmDemand * M.REGIONS[3].marketShare),
    };

    // ========================================================================
    // WARRANTY & GREEN SCORE (DA: not used — set to defaults)
    // ========================================================================
    let warrantyRevenue = 0;
    let warrantyCost = 0;
    let totalWarrantyClaims = 0;
    let greenScore = 50; // Neutral score
    let disposalCost = 0;
    let disposalRecovery = 0;
    let ecoPackagingCost = 0;

    // ========================================================================
    // TECHNOLOGY INVESTMENTS (DA: not used — set to 0)
    // ========================================================================
    let techMaintenanceCost = 0;
    let techPurchaseCost = 0;

    // ========================================================================
    // VMI SETUP - Only if feature enabled
    //
    // FIX 1: vmiActive is re-evaluated fresh each quarter from decisions,
    //         not latched permanently once true. Mirrors GAS behaviour where
    //         isVMIActive = vmiModuleEnabled && decisions.enableVMI.
    //
    // FIX 2: costs are split into vmiSetupCost (capital, hits cashOut only)
    //         and vmiOngoingCost (opex, hits both totalOpex and cashOut).
    //         Previously a single vmiCost was used for both, which incorrectly
    //         let the $2M setup cost distort operating income in the activation
    //         quarter.
    // ========================================================================
    let vmiActive = false;
    let vmiSetupCost = 0;
    let vmiOngoingCost = 0;

    // DA: VMI not available — costs remain at 0

    // ========================================================================
    // VMI SNAPSHOT - Not used in Analytics Edition (DA)
    // VMI feature is disabled; vmiSetupCost and vmiOngoingCost are already 0
    // ========================================================================
    const vmiSnapshot = null; // DA: VMI not supported

    // ========================================================================
    // INTELLIGENCE CENTER - Only if feature enabled
    // ========================================================================
    let intelligenceCost = 0;
    // DA: Intelligence Center feature not supported

    // ========================================================================
    // RANDOM EVENTS - Only process if feature enabled
    // ========================================================================
    let eventImpact: {
      costIncrease: number;
      demandModifier: number;
      partsDelayed: number;
      eventImpacts: any[];
    } = {
      costIncrease: 0,
      demandModifier: 1.0,
      partsDelayed: 0,
      eventImpacts: [],
    };

    if (features.randomEvents) {
      eventImpact = await this.processRandomEvents(
        simulationId,
        firmId,
        quarter,
        prevState,
        [], // DA: techOwned not supported
      );
    }

    // Apply event impacts
    const adjustedProcurementCost =
      procurementCost * (1 + eventImpact.costIncrease);

    // ========================================================================
    // FINANCIALS
    // ========================================================================
    const directRevenue = directSales * avgPrice;
    const wholesalePrice = avgPrice * (1 - R.MARKUP);
    let retailRevenue = shipmentToRetailer * wholesalePrice;

    // Clearance discount affects revenue
    if (retailerMode === RetailerMode.CLEARANCE) {
      retailRevenue *= 1 - R.CLEARANCE_DISCOUNT;
    }

    // P3 revenue if applicable
    let p3Revenue = 0;
    if (features.productInnovation && p3Launched && p3Production > 0) {
      const p3PriceConfig =
        CONFIG.market.P3_CONFIG.CONFIGS[p3Config || 'STANDARD'];
      const p3Price = decisions.p3Price || p3PriceConfig.suggestedPrice;
      const p3Sold = Math.round(p3Production * fillRate);
      p3Revenue = p3Sold * p3Price;
    }

    const revenue = directRevenue + retailRevenue + warrantyRevenue + p3Revenue;
    const cogs = (shipmentToRetailer + directSales) * C.STANDARD_COGS;
    const grossProfit = revenue - cogs;

    const holdingCost =
      (endingRawUnits + endingFGUnits) * F.HOLDING_COST_PER_UNIT;
    const unfilledOrderCost = stockoutUnits * C.UNFILLED_ORDER_COST;

    // FIX: totalOpex uses vmiOngoingCost only (recurring opex).
    //      vmiSetupCost is a capital outlay and must NOT flow through
    //      operating income — it belongs in cashOut only.
    //      ecoPackagingCost is now correctly included (was silently dropped).
    const totalOpex =
      laborCost +
      holdingCost +
      decisions.marketingBudget +
      qualityCost +
      freightCost +
      techMaintenanceCost +
      dcTotalOpex +
      warrantyCost +
      disposalCost -
      disposalRecovery +
      ecoPackagingCost +
      unfilledOrderCost +
      transferCost +
      vmiOngoingCost +
      p3LaunchCost +
      expansionRegionCosts +
      intelligenceCost;

    const operatingIncome = grossProfit - totalOpex;
    const interest =
      ((prevState.shortTermDebt + prevState.longTermDebt) *
        F.CREDIT_LINE_RATE) /
      4;
    const netIncome = operatingIncome - interest;

    const cashIn = revenue * 0.9;
    // FIX: cashOut uses vmiSetupCost + vmiOngoingCost (both hit cash),
    //      and ecoPackagingCost is now included here too.
    const cashOut =
      adjustedProcurementCost +
      laborCost +
      holdingCost +
      decisions.marketingBudget +
      qualityCost +
      freightCost +
      interest +
      dcSetupCost +
      expansionCost +
      warrantyCost +
      disposalCost -
      disposalRecovery -
      dcDisposalRecovery +
      ecoPackagingCost +
      transferCost +
      vmiSetupCost +
      vmiOngoingCost +
      techPurchaseCost +
      p3LaunchCost +
      expansionRegionCosts +
      intelligenceCost;

    // ========================================================================
    // CREDIT FACILITY
    // ========================================================================
    const financialMetrics: FinancialMetrics = {
      cash: prevState.cash + cashIn - cashOut,
      accountsReceivable: prevState.accountsReceivable + revenue * 0.1,
      inventoryValue:
        endingRawUnits * C.RAW_MATERIAL_COST + endingFGUnits * C.STANDARD_COGS,
      fixedAssets:
        prevState.fixedAssets + dcSetupCost + expansionCost + techPurchaseCost,
      accountsPayable: prevState.accountsPayable,
      shortTermDebt: prevState.shortTermDebt,
      longTermDebt: prevState.longTermDebt,
      revenue,
      netIncome: grossProfit - totalOpex - interest,
      operatingIncome: grossProfit - totalOpex,
      interestExpense: interest,
    };

    const creditResult = this.processCreditFacility(
      financialMetrics,
      endingRawUnits,
      endingFGUnits,
    );
    let newCash = creditResult.newCash;
    let newDebt = creditResult.newDebt;

    // Adjust inventory if forced sale occurred
    let adjustedRawUnits = endingRawUnits;
    let adjustedFGUnits = endingFGUnits;
    if (creditResult.forcedSaleTriggered && creditResult.inventorySold > 0) {
      const totalUnits = endingRawUnits + endingFGUnits;
      const rawProportion = totalUnits > 0 ? endingRawUnits / totalUnits : 0.5;
      const rawSold = Math.floor(creditResult.inventorySold * rawProportion);
      const fgSold = creditResult.inventorySold - rawSold;
      adjustedRawUnits = Math.max(0, endingRawUnits - rawSold);
      adjustedFGUnits = Math.max(0, endingFGUnits - fgSold);
    }

    const finalInterest =
      creditResult.interestCharge + creditResult.overlimitFee;
    const finalNetIncome = grossProfit - totalOpex - finalInterest;

    await this.recordCreditHistory(
      simulationId,
      firmId,
      quarter,
      prevState.cash,
      creditResult,
    );

    // ========================================================================
    // CSI CALCULATION
    // ========================================================================
    const newCSI = this.calculateCSI(
      fillRate,
      defectRate,
      onTimeRate,
      prevState.csi,
      greenScore,
    );

    // ========================================================================
    // CUSTOMER POOLS & SCRM - Only if customerChurn enabled
    // ========================================================================
    const poolsResult = await this.processCustomerPoolsAndSCRM(
      simulationId,
      firmId,
      quarter,
      prevState,
      decisions,
      features,
      newCSI,
      fillRate,
      stockoutUnits,
      actualProduction,
      newCash,
      dcCentralOpen,
      dcWestOpen,
    );

    // ========================================================================
    // PERFECT ORDER - Calculate (tracking optional but always computed)
    // ========================================================================
    const damageFree = 1 - damageRate;
    const inFull = fillRate;
    let perfectOrderOverall =
      onTimeRate * inFull * damageFree * PO.BASE_DOCUMENTATION;

    if (features.perfectOrderTracking) {
      // DA: Capacity expansion tracking not supported in Analytics Edition
    }

    // ========================================================================
    // PERSIST QUARTER STATE
    // ========================================================================
    await this.quarterStateModel.findOneAndUpdate(
      { simulation: simulationId, firm: firmId, quarter },
      {
        $set: {
          cash: newCash,
          accountsReceivable: prevState.accountsReceivable + revenue * 0.1,
          fixedAssets:
            prevState.fixedAssets +
            dcSetupCost +
            expansionCost +
            techPurchaseCost,
          accountsPayable: prevState.accountsPayable,
          shortTermDebt: newDebt,
          longTermDebt: prevState.longTermDebt,
          rawMaterialUnits: adjustedRawUnits,
          finishedGoodsUnits: adjustedFGUnits,
          inTransitUnits: 0,
          ordersInTransit: decisions.orderGlobal,
          capacityUnits: prevState.capacityUnits,
          csi: newCSI,
          marketShare: prevState.marketShare,
          cumulativeRevenue: prevState.cumulativeRevenue + revenue,
          cumulativeProfit: prevState.cumulativeProfit + finalNetIncome,
          retailerInventory: endingRetailerInv,
          retailerMode,
          customersLoyal: poolsResult.customersLoyal,
          customersInPlay: poolsResult.customersInPlay,
          customersCompetitor: poolsResult.customersCompetitor,
          scrmRiskScore: poolsResult.scrmRiskScore,
          scrmRiskLevel: poolsResult.scrmRiskLevel,
          segmentAllocation: poolsResult.segmentAllocation,
          vmiActive,
          prevPriceP1: decisions.priceP1,
          perfectOrder: {
            onTime: onTimeRate,
            inFull,
            damageFree,
            documentation: PO.BASE_DOCUMENTATION,
            overall: perfectOrderOverall,
          },
          dcCentralOpen,
          dcCentralInventory,
          dcWestOpen,
          dcWestInventory,
          dcTotalOpex,
          // Market expansion state
          r4Active,
          r5Active,
          r6Active,
          r4EntryQuarter,
          r5EntryQuarter,
          r6EntryQuarter,
          // Product innovation state
          p3Launched,
          p3LaunchQuarter,
          p3Config,
        },
      },
      { upsert: true, new: true },
    );

    // Update firm
    await this.firmModel.updateOne(
      { _id: firmId },
      {
        currentCash: newCash,
        currentCsi: newCSI,
        cumulativeRevenue: prevState.cumulativeRevenue + revenue,
        cumulativeProfit: prevState.cumulativeProfit + finalNetIncome,
      },
    );

    return {
      firmId,
      firmNumber: firm.firmNumber,
      revenue,
      netIncome: finalNetIncome,
      grossProfit,
      cogs,
      operatingExpenses: totalOpex,
      interest: finalInterest,
      laborCost,
      holdingCost,
      marketingCost: decisions.marketingBudget,
      qualityCost,
      freightCost,
      dcOpex: dcTotalOpex,
      unitsSold,
      unitsProduced: actualProduction,
      fillRate,
      defectRate,
      perfectOrder: perfectOrderOverall,
      capacityUtilization,
      rawMaterialUnits: adjustedRawUnits,
      finishedGoodsUnits: adjustedFGUnits,
      retailerInventory: endingRetailerInv,
      inTransitUnits: 0,
      dcCentralInventory,
      dcWestInventory,
      csi: newCSI,
      marketShare: prevState.marketShare,
      customersLoyal: poolsResult.customersLoyal,
      customersInPlay: poolsResult.customersInPlay,
      customersChurned: 0,
      cash: newCash,
      poOnTime: onTimeRate,
      poInFull: inFull,
      poDamageFree: damageFree,
      poDocumentation: PO.BASE_DOCUMENTATION,
    };
  }

  // ============================================================================
  // ADVANCED MODULE PROCESSORS
  // ============================================================================

  private processCapacityExpansion(
    decisions: any,
    currentExpansions: any[],
    currentAdditionalCapacity: number,
    currentMaintenance: number,
    quarter: number,
    availableCash: number,
  ) {
    // DA: Capacity expansion not supported
    return {
      expansionInProgress: [],
      additionalCapacity: 0,
      maintenanceCost: 0,
      capitalCost: 0,
    };
  }

  private processRegionalDCs(
    decisions: any,
    prevState: any,
    availableFGUnits: number,
  ) {
    let dcCentralOpen = prevState.dcCentralOpen || false;
    let dcCentralInventory = prevState.dcCentralInventory || 0;
    let dcWestOpen = prevState.dcWestOpen || false;
    let dcWestInventory = prevState.dcWestInventory || 0;
    let opex = 0,
      setupCost = 0,
      disposalRecovery = 0,
      transferCost = 0;
    let allocatedToCentral = 0,
      allocatedToWest = 0;

    if (decisions.dcCentralStatus === DCStatus.YES && !dcCentralOpen) {
      dcCentralOpen = true;
      setupCost += CONFIG.dc.CENTRAL.setupCost;
    } else if (decisions.dcCentralStatus === DCStatus.CLOSE && dcCentralOpen) {
      dcCentralOpen = false;
      disposalRecovery +=
        CONFIG.dc.CENTRAL.setupCost * CONFIG.dc.DISPOSAL_VALUE_RATE;
      dcCentralInventory = 0;
    }

    if (decisions.dcWestStatus === DCStatus.YES && !dcWestOpen) {
      dcWestOpen = true;
      setupCost += CONFIG.dc.WEST.setupCost;
    } else if (decisions.dcWestStatus === DCStatus.CLOSE && dcWestOpen) {
      dcWestOpen = false;
      disposalRecovery +=
        CONFIG.dc.WEST.setupCost * CONFIG.dc.DISPOSAL_VALUE_RATE;
      dcWestInventory = 0;
    }

    if (dcCentralOpen) opex += CONFIG.dc.CENTRAL.quarterlyOpex;
    if (dcWestOpen) opex += CONFIG.dc.WEST.quarterlyOpex;

    if (dcCentralOpen && decisions.allocateCentral > 0) {
      allocatedToCentral = Math.min(
        decisions.allocateCentral,
        availableFGUnits,
        CONFIG.dc.CENTRAL.capacity - dcCentralInventory,
      );
      dcCentralInventory += allocatedToCentral;
    }

    if (dcWestOpen && decisions.allocateWest > 0) {
      const remaining = availableFGUnits - allocatedToCentral;
      allocatedToWest = Math.min(
        decisions.allocateWest,
        remaining,
        CONFIG.dc.WEST.capacity - dcWestInventory,
      );
      dcWestInventory += allocatedToWest;
    }

    // DA: Regional transfers not supported - removed transferFromCentral/West logic

    return {
      dcCentralOpen,
      dcCentralInventory,
      dcWestOpen,
      dcWestInventory,
      opex,
      setupCost,
      disposalRecovery,
      transferCost,
      allocatedToCentral,
      allocatedToWest,
    };
  }

  // ============================================================================
  // PROCESS MULTI-CARRIER SELECTION
  // ============================================================================
  /**
   * Process Multi-Carrier Selection
   * Handles mode selection, volume discounts, TMS effects, and last-mile costs
   */
  private processMultiCarrier(
    decision: DecisionDocument,
    firm: FirmDocument,
    unitsShipped: number,
    anyDCOpen: boolean,
    features: any,
  ): any {
    // DA: Multi-carrier selection not supported, use default
    return {
      carrierMode: 'TRUCK',
      carrierName: 'Truck',
      costPerUnit: 3,
      baseCostPerUnit: 3,
      lastMileCost: 0,
      forcedAir: false,
      unitsShipped,
      baseFreightCost: unitsShipped * 3,
      volumeDiscount: 0,
      volumeDiscountAmount: 0,
      tmsDiscount: 0,
      tmsDiscountAmount: 0,
      freightCost: unitsShipped * 3,
      onTimeRate: 0.94,
      onTimeBonus: 0.02,
      damageRate: 0.01,
    };
  }

  // ============================================================================
  // PROCESS DC SALES
  // ============================================================================
  /**
   * Process DC Sales - fulfill regional demand from DCs
   * R1 (East) served by Factory directly
   * R2 (Central) and R3 (West) served by optional DCs
   */
  private processDCSales(
    dcResult: any,
    regionalDemand: { R1: number; R2: number; R3: number },
    factoryFGInventory: number,
  ): any {
    // R1 is always served by Factory
    let factoryInventory = factoryFGInventory;
    let dcSales = 0;
    let dcServiceBonus = CONFIG.dc.FACTORY_SERVICE_BONUS;

    // R1 sales from Factory
    const r1Sales = Math.min(regionalDemand.R1 || 0, factoryInventory);
    factoryInventory -= r1Sales;

    // R2 Central DC serves Region 2
    let r2Sales = 0;
    if (dcResult.dcCentralOpen && dcResult.dcCentralInventory > 0) {
      r2Sales = Math.min(regionalDemand.R2 || 0, dcResult.dcCentralInventory);
      dcResult.dcCentralInventory -= r2Sales;
      dcSales += r2Sales;
      if (r2Sales > 0) dcServiceBonus += CONFIG.dc.CENTRAL.serviceBonus;
    } else {
      // No Central DC - serve R2 from Factory
      const r2FromFactory = Math.min(regionalDemand.R2 || 0, factoryInventory);
      factoryInventory -= r2FromFactory;
      r2Sales = r2FromFactory;
    }

    // R3 West DC serves Region 3
    let r3Sales = 0;
    if (dcResult.dcWestOpen && dcResult.dcWestInventory > 0) {
      r3Sales = Math.min(regionalDemand.R3 || 0, dcResult.dcWestInventory);
      dcResult.dcWestInventory -= r3Sales;
      dcSales += r3Sales;
      if (r3Sales > 0) dcServiceBonus += CONFIG.dc.WEST.serviceBonus;
    } else {
      // No West DC - serve R3 from Factory
      const r3FromFactory = Math.min(regionalDemand.R3 || 0, factoryInventory);
      factoryInventory -= r3FromFactory;
      r3Sales = r3FromFactory;
    }

    return {
      r1Sales,
      r2Sales,
      r3Sales,
      dcSales,
      totalSales: r1Sales + r2Sales + r3Sales,
      dcServiceBonus,
      updatedDCResult: dcResult,
      remainingFactoryInventory: factoryInventory,
    };
  }

  // ============================================================================
  // SUPPLIER TRACKING METHODS
  // ============================================================================

  private async recordSupplierPerformance(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    supplierType: SupplierType,
    orderQty: number,
    actualDelivered: number,
  ): Promise<void> {
    const supplier = SUPPLIER_CONFIG[supplierType];
    const performance = this.calculateSupplierPerformance(
      supplier,
      orderQty,
      actualDelivered,
    );

    // Record the supplier order
    await this.supplierOrderModel.create({
      simulation: simulationId,
      firm: firmId,
      quarter,
      supplierType,
      quantityOrdered: orderQty,
      quantityReceived: actualDelivered,
      unitCost: supplier.unitCost,
      totalCost: orderQty * supplier.unitCost,
      leadTimeQuarters: supplier.leadTime,
      expectedDeliveryQuarter:
        supplier.leadTime > 0 ? quarter + supplier.leadTime : quarter,
      actualDeliveryQuarter: quarter + (supplier.leadTime > 0 ? 1 : 0),
      fillRate: actualDelivered / orderQty,
      wasDelayed: false,
      defectiveUnits: Math.round(
        actualDelivered * (1 - performance.qualityRate),
      ),
      defectRate: 1 - performance.qualityRate,
    });

    // DA: Supplier metrics tracking not supported
    // supplierMetrics field removed from QuarterState in Analytics Edition
  }

  private calculateSupplierPerformance(
    supplier: any,
    orderQty: number,
    actualDelivered: number,
  ): {
    onTimeDelivery: boolean;
    qualityRate: number;
    flexibility: number;
    costIndex: number;
  } {
    const V = SUPPLIER_SCORECARD_CONFIG.VARIABILITY;
    const W = SUPPLIER_SCORECARD_CONFIG.WEIGHTS;

    // On-time delivery with variability
    const onTimeRoll = Math.random();
    const onTimeThreshold =
      supplier.baseOnTime + (Math.random() * 2 - 1) * V.onTime;
    const onTimeDelivery = onTimeRoll < onTimeThreshold;

    // Quality rate with variability
    const qualityRate = Math.min(
      1.0,
      Math.max(0.0, supplier.baseQuality + (Math.random() * 2 - 1) * V.quality),
    );

    // Cost index (normalized to 100 = baseline)
    const costIndex = supplier.costMultiplier * 100;

    return {
      onTimeDelivery,
      qualityRate,
      flexibility: supplier.baseFlexibility,
      costIndex,
    };
  }

  private calculateSupplierScore(
    performance: {
      onTimeDelivery: boolean;
      qualityRate: number;
      flexibility: number;
      costIndex: number;
    },
    ordersPlaced: number,
  ): number {
    const W = SUPPLIER_SCORECARD_CONFIG.WEIGHTS;

    const onTimeScore = performance.onTimeDelivery ? 1.0 : 0.6;
    const qualityScore = performance.qualityRate;
    const costScore = Math.min(1.0, 150 / performance.costIndex); // Normalize to 150 baseline
    const flexibilityScore = performance.flexibility;

    const overallScore =
      onTimeScore * W.onTime * 100 +
      qualityScore * W.quality * 100 +
      costScore * W.cost * 100 +
      flexibilityScore * W.flexibility * 100;

    return Math.round(overallScore);
  }

  private processWarranty(
    unitsSold: number,
    defectsReachingCustomers: number,
    damageRate: number,
    demandByRegion: any,
    centralNetworkActive: boolean,
    westNetworkActive: boolean,
  ) {
    // DA: Warranty tier not tracked - use default values
    const pricePerUnit = 50;
    const revenue = unitsSold * pricePerUnit;
    const productDefects = defectsReachingCustomers;
    const shippingDamage = Math.round(unitsSold * damageRate);
    const totalClaims = productDefects + shippingDamage;

    const totalDemand =
      demandByRegion.r1 + demandByRegion.r2 + demandByRegion.r3;
    const claimsByRegion = {
      r1: Math.round(totalClaims * (demandByRegion.r1 / totalDemand)),
      r2: Math.round(totalClaims * (demandByRegion.r2 / totalDemand)),
      r3: Math.round(totalClaims * (demandByRegion.r3 / totalDemand)),
    };

    let partShippingCost = totalClaims * 15;
    let serviceCost = (claimsByRegion.r1 + claimsByRegion.r2 + claimsByRegion.r3) * 25;
    let networkMaintenanceCost = 0;

    if (centralNetworkActive) {
      networkMaintenanceCost += 50_000;
      claimsByRegion.r2 = Math.round(claimsByRegion.r2 * 0.8);
    }
    if (westNetworkActive) {
      networkMaintenanceCost += 75_000;
      claimsByRegion.r3 = Math.round(claimsByRegion.r3 * 0.7);
    }

    return {
      revenue,
      totalCost: partShippingCost + serviceCost + networkMaintenanceCost,
      totalClaims,
      productDefects,
      shippingDamage,
      claimsByRegion,
      partShippingCost,
      serviceCost,
      networkMaintenanceCost,
    };
  }

  private processCustomerChurn(
    loyalCustomers: number,
    inPlayCustomers: number,
    fillRate: number,
    csi: number,
    currentPrice: number,
    previousPrice: number,
  ) {
    let churnRate = CONFIG.customer.BASE_CHURN_RATE;

    if (csi < 70) churnRate += 0.03;
    else if (csi < 80) churnRate += 0.01;
    else if (csi > 90) churnRate -= 0.02;
    if (fillRate < 0.9) churnRate += 0.02;
    else if (fillRate < 0.95) churnRate += 0.01;

    const priceChange = (currentPrice - previousPrice) / previousPrice;
    if (priceChange > 0.1) churnRate += 0.02;
    else if (priceChange > 0.05) churnRate += 0.01;

    // DA: Green score and warranty tier not tracked

    const loyalChurned = Math.round(loyalCustomers * churnRate * 0.5);
    const inPlayChurned = Math.round(inPlayCustomers * churnRate);

    return {
      loyal: Math.max(0, loyalCustomers - loyalChurned),
      inPlay: Math.max(0, inPlayCustomers - inPlayChurned + loyalChurned),
      churned: loyalChurned + inPlayChurned,
    };
  }

  // ============================================================================
  // CSI & GREEN SCORE CALCULATIONS
  // ============================================================================

  private calculateCSI(
    fillRate: number,
    defectRate: number,
    onTimeRate: number,
    previousCSI: number,
    greenScore: number,
  ): number {
    const W = CONFIG.scoring.CSI_WEIGHTS;
    const productQuality = (1 - defectRate) * 100;
    const serviceQuality = onTimeRate * 100;
    const availabilityQuality = fillRate * 100;

    let newCSI =
      productQuality * W.PRODUCT_QUALITY +
      serviceQuality * W.SERVICE_QUALITY +
      availabilityQuality * W.AVAILABILITY_QUALITY;

    // DA: Warranty penalties removed, green score not factored into CSI
    newCSI = newCSI * 0.7 + previousCSI * 0.3;

    return Math.max(0, Math.min(100, newCSI));
  }

  private getGreenScoreBracket(score: number): string {
    return score >= 80
      ? 'LEADER'
      : score >= 60
        ? 'GOOD'
        : score >= 40
          ? 'AVERAGE'
          : score >= 20
            ? 'LAGGING'
            : 'POOR';
  }

  private getGreenScoreCSIEffect(score: number): number {
    return score >= 80
      ? 3
      : score >= 60
        ? 1
        : score >= 40
          ? 0
          : score >= 20
            ? -1
            : -3;
  }

  private getGreenScoreChurnMultiplier(score: number): number {
    return score >= 80
      ? 0.9
      : score >= 60
        ? 0.95
        : score >= 40
          ? 1.0
          : score >= 20
            ? 1.1
            : 1.2;
  }

  // ============================================================================
  // KPI HISTORY & BSC SCORING
  // ============================================================================

  // Competitive market share: each firm's relative attractiveness (price,
  // CSI, marketing, availability) pulls its share toward its fair slice of the
  // market, smoothed so shares move gradually. Shares always sum to 1.
  // Mutates results[].marketShare and persists to this quarter's state, which
  // is what next quarter's demand (totalDemand * marketShare) reads.
  private async updateMarketShares(
    simulationId: Types.ObjectId,
    quarter: number,
    results: QuarterResult[],
  ): Promise<void> {
    if (results.length < 2) return;
    const S = CONFIG.market.SHARE_DYNAMICS;
    const P = CONFIG.market.PRODUCTS;
    const basePrice =
      P.P1.basePrice * P.P1.marketShare + P.P2.basePrice * P.P2.marketShare;
    const safe = (v: number, d: number) => (Number.isFinite(v) && v > 0 ? v : d);

    const decisions = await this.decisionModel.find({
      simulation: simulationId,
      quarter,
    });
    const avgMarketing =
      results.reduce((a, r) => a + safe(r.marketingCost, 0), 0) /
      results.length;

    const prevShare = 1 / results.length;
    const rows = results.map((r) => {
      const d = decisions.find((x) => (x.firm as Types.ObjectId).equals(r.firmId));
      const avgPrice = d
        ? safe(d.priceP1, P.P1.basePrice) * P.P1.marketShare +
          safe(d.priceP2, P.P2.basePrice) * P.P2.marketShare
        : basePrice;
      const priceScore = Math.pow(basePrice / avgPrice, S.PRICE_ELASTICITY);
      const csiScore = Math.pow(safe(r.csi, 80) / 80, S.CSI_WEIGHT);
      const mktScore =
        avgMarketing > 0
          ? Math.pow(
              Math.max(0.25, safe(r.marketingCost, 0) / avgMarketing),
              S.MARKETING_WEIGHT,
            )
          : 1;
      const fill = Math.min(1, Math.max(0, Number(r.fillRate) || 0));
      const availability = S.FILL_RATE_FLOOR + (1 - S.FILL_RATE_FLOOR) * fill;
      return {
        r,
        score: priceScore * csiScore * mktScore * availability,
        prev: safe(r.marketShare, prevShare),
      };
    });

    const totalScore = rows.reduce((a, x) => a + x.score, 0);
    if (totalScore <= 0) return;

    let shares = rows.map((x) => {
      const target = x.score / totalScore;
      const next = x.prev + S.SMOOTHING * (target - x.prev);
      return Math.min(S.MAX_SHARE, Math.max(S.MIN_SHARE, next));
    });
    const sum = shares.reduce((a, b) => a + b, 0);
    shares = shares.map((s) => s / sum);

    for (let i = 0; i < rows.length; i++) {
      rows[i].r.marketShare = shares[i];
      await this.quarterStateModel.updateOne(
        { simulation: simulationId, firm: rows[i].r.firmId, quarter },
        { $set: { marketShare: shares[i] } },
      );
    }
  }

  private async recordKpiHistory(
    simulationId: Types.ObjectId,
    firms: FirmDocument[],
    quarter: number,
    results: QuarterResult[],
    updateMarketShare = false,
  ): Promise<void> {
    const C = CONFIG.costs;

    if (updateMarketShare) {
      await this.updateMarketShares(simulationId, quarter, results);
    }

    // Seasonal context for this quarter (used to normalise scorecard targets
    // and to expose season-adjusted revenue to the dashboard).
    const demandForQuarter = await this.demandHistoryModel.findOne({
      simulation: simulationId,
      quarter,
    });
    const seasonalMultiplier = demandForQuarter?.seasonalMultiplier ?? 1;
    const seasonValues = Object.values(CONFIG.seasonality.QUARTERS) as number[];
    const seasonAvg =
      seasonValues.reduce((a, b) => a + b, 0) / seasonValues.length;
    const seasonIndex =
      seasonalMultiplier > 0 && seasonAvg > 0
        ? seasonalMultiplier / seasonAvg
        : 1;

    for (const result of results) {
      const firm = firms.find((f) =>
        (f._id as Types.ObjectId).equals(result.firmId),
      );
      if (!firm) continue;

      const inventoryValue =
        result.rawMaterialUnits * C.RAW_MATERIAL_COST +
        result.finishedGoodsUnits * C.STANDARD_COGS;
      const dailySales = result.unitsSold / 90;
      const weeksOfSupply =
        dailySales > 0
          ? (result.finishedGoodsUnits + result.retailerInventory) /
            (dailySales * 7)
          : 0;
      const inventoryTurnover =
        inventoryValue > 0 ? (result.cogs * 4) / inventoryValue : 0;

      let scMaturity: ScMaturityLevel = ScMaturityLevel.BASIC;
      if (result.perfectOrder > 0.85) scMaturity = ScMaturityLevel.ADVANCED;
      else if (result.perfectOrder > 0.8)
        scMaturity = ScMaturityLevel.DEVELOPING;

      // Get ForecastLog for this quarter to fetch actual MAPE
      const forecastLog = await this.forecastLogModel.findOne({
        simulation: simulationId,
        firm: result.firmId,
        quarter,
      });
      const actualMape = forecastLog?.mape ?? 0;

      const bscFinancial = this.calculateFinancialScore(result, seasonIndex);
      const bscCustomer = this.calculateCustomerScore(result);
      const bscProcess = this.calculateProcessScore(result);
      const forecastAccuracy = Math.max(0, Math.min(1, 1 - actualMape));
      const prevForecastLog = await this.forecastLogModel.findOne({
        simulation: simulationId,
        firm: result.firmId,
        quarter: quarter - 1,
      });
      const prevForecastAccuracy =
        prevForecastLog?.mape !== undefined && prevForecastLog?.mape !== null
          ? Math.max(0, Math.min(1, 1 - prevForecastLog.mape))
          : null;
      const bscLearning = this.calculateLearningScore(
        forecastAccuracy,
        prevForecastAccuracy,
      );
      const parts = [bscFinancial, bscCustomer, bscProcess, bscLearning].map(
        (v) => (Number.isFinite(v) ? v : 0),
      );
      const bscOverall = parts.reduce((a, b) => a + b, 0) / parts.length;

      await this.kpiHistoryModel.create({
        simulation: simulationId,
        firm: firm._id,
        quarter,
        financial: {
          revenue: result.revenue,
          seasonalMultiplier,
          seasonIndex,
          seasonAdjustedRevenue:
            seasonIndex > 0 ? result.revenue / seasonIndex : result.revenue,
          netIncome: result.netIncome,
          cash: result.cash,
          grossMarginPct:
            result.revenue > 0
              ? (result.grossProfit / result.revenue) * 100
              : 0,
          cogs: result.cogs,
          operatingExpenses: result.operatingExpenses,
        },
        customer: {
          csi: result.csi,
          marketShare: result.marketShare,
          fillRate: result.fillRate,
          returnRate: result.defectRate,
          customersLoyal: result.customersLoyal,
          customersInPlay: result.customersInPlay,
          customersChurned: result.customersChurned,
        },
        operations: {
          perfectOrder: result.perfectOrder,
          capacityUtilization: result.capacityUtilization,
          defectRate: result.defectRate,
          onTimeDelivery: result.poOnTime,
          inFull: result.poInFull,
          damageFree: result.poDamageFree,
          documentation: result.poDocumentation,
          mape: actualMape,
          unitsProduced: result.unitsProduced,
          unitsSold: result.unitsSold,
        },
        inventory: {
          rawMaterialUnits: result.rawMaterialUnits,
          finishedGoodsUnits: result.finishedGoodsUnits,
          inventoryValue,
          inventoryTurnover,
          weeksOfSupply,
          retailerInventory: result.retailerInventory,
          inTransitUnits: result.inTransitUnits,
        },
        learning: {
          techSystemsCount: 0, // DA: Tech investments not supported
          scMaturity,
          techInvestmentTotal: 0,
          forecastAccuracy,
        },
        bsc: {
          financial: bscFinancial,
          customer: bscCustomer,
          process: bscProcess,
          learning: bscLearning,
          overall: bscOverall,
          rank: 0,
        },
        costs: {
          labor: result.laborCost,
          holding: result.holdingCost,
          marketing: result.marketingCost,
          quality: result.qualityCost,
          freight: result.freightCost,
          interest: result.interest,
        },
        // DA: VMI, warranty, and tech maintenance not supported
      });
    }

    await this.updateKpiRanks(simulationId, quarter);
  }

  private async updateKpiRanks(
    simulationId: Types.ObjectId,
    quarter: number,
  ): Promise<void> {
    const kpis = await this.kpiHistoryModel
      .find({ simulation: simulationId, quarter })
      .sort({ 'bsc.overall': -1 });
    for (let i = 0; i < kpis.length; i++) {
      kpis[i].bsc.rank = i + 1;
      kpis[i].bsc.grade = this.getGrade(kpis[i].bsc.overall);
      await kpis[i].save();
    }
  }

  private getGrade(score: number): string {
    return score >= 90
      ? 'A'
      : score >= 80
        ? 'B'
        : score >= 70
          ? 'C'
          : score >= 60
            ? 'D'
            : 'F';
  }

  // seasonIndex = this quarter's seasonal multiplier relative to the yearly
  // average (1.0 = average quarter). Flow targets (revenue, net income) are
  // scaled by it so a good trough quarter scores like a good peak quarter.
  private calculateFinancialScore(
    result: QuarterResult,
    seasonIndex = 1,
  ): number {
    const T = CONFIG.scoring.BSC_THRESHOLDS;
    const revenueTarget = T.REVENUE_TARGET * seasonIndex;
    const netIncomeTarget = T.NET_INCOME_TARGET * seasonIndex;
    const safe = (v: number) => (Number.isFinite(v) ? v : 0);

    const netIncome = safe(result.netIncome);
    const revenue = safe(result.revenue);
    const grossProfit = safe(result.grossProfit);
    const cash = safe(result.cash);

    const netIncomePart =
      netIncome >= netIncomeTarget
        ? 30
        : Math.max(0, (netIncome / netIncomeTarget) * 30);

    const revenuePart =
      revenue >= revenueTarget ? 25 : (revenue / revenueTarget) * 25;

    const grossPct = revenue > 0 ? grossProfit / revenue : 0;
    const grossPart =
      grossPct >= T.GROSS_MARGIN_TARGET
        ? 25
        : (grossPct / T.GROSS_MARGIN_TARGET) * 25;

    const cashPart = cash >= T.CASH_TARGET ? 20 : (cash / T.CASH_TARGET) * 20;

    return Math.min(
      100,
      safe(netIncomePart) +
        safe(revenuePart) +
        safe(grossPart) +
        safe(cashPart),
    );
  }

  private calculateCustomerScore(result: QuarterResult): number {
    const T = CONFIG.scoring.BSC_THRESHOLDS;
    const safe = (v: number) => (Number.isFinite(v) ? v : 0);

    const csi = safe(result.csi);
    const marketShare = safe(result.marketShare);
    const fillRate = safe(result.fillRate);

    const csiPart =
      csi >= T.CSI_TARGET
        ? 30
        : Math.max(0, ((csi - 50) / (T.CSI_TARGET - 50)) * 30);

    const marketPart =
      marketShare >= T.MARKET_SHARE_TARGET
        ? 25
        : (marketShare / T.MARKET_SHARE_TARGET) * 25;

    const fillPart =
      fillRate >= T.FILL_RATE_TARGET
        ? 25
        : (fillRate / T.FILL_RATE_TARGET) * 25;

    return Math.min(
      100,
      safe(csiPart) + safe(marketPart) + safe(fillPart) + 20,
    );
  }

  private calculateProcessScore(result: QuarterResult): number {
    const T = CONFIG.scoring.BSC_THRESHOLDS;
    const safe = (v: number) => (Number.isFinite(v) ? v : 0);

    const perfectOrder = safe(result.perfectOrder);
    const capacityUtilization = safe(result.capacityUtilization);
    // Actual on-time delivery achieved this quarter (falls back to baseline)
    const baseOnTime = safe(
      Number.isFinite(result.poOnTime) && result.poOnTime > 0
        ? result.poOnTime
        : CONFIG.perfectOrder.BASE_ON_TIME,
    );

    let capScore = 0;
    if (
      capacityUtilization >= T.CAPACITY_UTIL_OPTIMAL_LOW &&
      capacityUtilization <= T.CAPACITY_UTIL_OPTIMAL_HIGH
    ) {
      capScore = 25;
    } else if (capacityUtilization < T.CAPACITY_UTIL_OPTIMAL_LOW) {
      capScore = (capacityUtilization / T.CAPACITY_UTIL_OPTIMAL_LOW) * 25;
    } else {
      capScore = Math.max(0, ((1 - capacityUtilization) / 0.15) * 25);
    }
    capScore = safe(capScore);

    const perfectPart =
      perfectOrder >= T.PERFECT_ORDER_TARGET
        ? 30
        : (perfectOrder / T.PERFECT_ORDER_TARGET) * 30;

    const onTimePart = baseOnTime >= 0.95 ? 20 : (baseOnTime / 0.95) * 20;

    return Math.min(100, safe(perfectPart) + capScore + 22 + safe(onTimePart));
  }

  // Learning = how well the firm forecasts and whether it is improving.
  //   accuracy (1 - MAPE): 0 pts at <=50%, 60 pts at >=90%
  //   trend vs last quarter's accuracy: 0 pts at -5pp or worse, 20 at flat,
  //   40 at +5pp or better; 20 when there is no prior quarter. A firm that
  //   already sits at >=90% accuracy keeps the full 40 (no room to improve).
  private calculateLearningScore(
    accuracy: number,
    prevAccuracy: number | null,
  ): number {
    const safeNum = (v: number) => (Number.isFinite(v) ? v : 0);
    const acc = Math.min(1, Math.max(0, safeNum(accuracy)));

    const accPart = Math.min(60, Math.max(0, ((acc - 0.5) / 0.4) * 60));

    let trendPart = 20;
    if (acc >= 0.9) {
      trendPart = 40;
    } else if (prevAccuracy !== null && Number.isFinite(prevAccuracy)) {
      const delta = acc - prevAccuracy;
      trendPart = Math.min(40, Math.max(0, 20 + (delta / 0.05) * 20));
    }

    return Math.min(100, accPart + trendPart);
  }

  // ============================================================================
  // CRUD OPERATIONS - FIXED WITH EXPLICIT ObjectId CONVERSION
  // ============================================================================

  async findAllByUser(userId: string): Promise<any[]> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    let simulations: SimulationDocument[];
    if (user.role === UserRole.ADMIN) {
      // Admins see all simulations
      simulations = await this.simulationModel.find().sort({ createdAt: -1 });
    } else if (user.role === UserRole.FACULTY) {
      // Faculty only see simulations deployed for them or assigned to them
      // (FACULTY_DEPLOYED and STUDENT_DEPLOYED states)
      simulations = await this.simulationModel
        .find({
          deploymentStatus: { $in: ['FACULTY_DEPLOYED', 'STUDENT_DEPLOYED'] },
          $or: [
            { owner: this.toObjectId(userId) },
            { facultyIds: this.toObjectId(userId) },
          ],
        })
        .sort({ createdAt: -1 });
    } else {
      // Students only see simulations deployed for them (STUDENT_DEPLOYED)
      const enrollments = await this.enrollmentModel.find({
        user: this.toObjectId(userId),
        status: { $in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING] },
      });
      simulations = await this.simulationModel
        .find({
          deploymentStatus: 'STUDENT_DEPLOYED',
          _id: { $in: enrollments.map((e) => e.simulation) },
        })
        .sort({ createdAt: -1 });
    }

    return Promise.all(
      simulations.map(async (sim) => {
        const simId = sim._id as Types.ObjectId;
        const firms = await this.firmModel.find({ simulation: simId });
        const enrollmentCount = await this.enrollmentModel.countDocuments({
          simulation: simId,
          status: EnrollmentStatus.ACTIVE,
        });
        return {
          ...sim.toObject(),
          firms: firms.map((f) => ({
            id: f._id,
            firmNumber: f.firmNumber,
            name: f.name,
            color: f.color,
          })),
          enrollmentCount,
        };
      }),
    );
  }

  async findOne(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    // Lazy expiry check — auto-advances if quarter window elapsed
    const advanced = await this.checkQuarterExpiry(simulation);
    if (advanced) {
      // Reload — simulation state has changed
      const reloaded = await this.simulationModel.findById(simObjectId);
      if (reloaded) Object.assign(simulation, reloaded.toObject());
    }

    const firms = await this.firmModel.find({ simulation: simObjectId });
    const firmsWithEnrollments = await Promise.all(
      firms.map(async (firm) => {
        const firmId = firm._id as Types.ObjectId;
        const enrollments = await this.enrollmentModel
          .find({ firm: firmId })
          .populate('user', 'email firstName lastName');
        return {
          id: firmId.toString(),
          firmNumber: firm.firmNumber,
          name: firm.name,
          color: firm.color,
          currentCash: firm.currentCash,
          currentCsi: firm.currentCsi,
          currentMarketShare: firm.currentMarketShare,
          // DA: techOwned not supported
          enrollments: enrollments.map((e) => ({
            id: (e._id as Types.ObjectId).toString(),
            simulation: (e.simulation as Types.ObjectId).toString(),
            firm: {
              id: firmId.toString(),
              firmNumber: firm.firmNumber,
              name: firm.name,
            },
            user: {
              id: (e.user as any)._id.toString(),
              email: (e.user as any).email,
              firstName: (e.user as any).firstName,
              lastName: (e.user as any).lastName,
            },
            firmNumber: e.firmNumber,
            status: e.status,
            role: e.role,
            teamName: e.teamName,
            canSubmitDecisions: e.canSubmitDecisions,
            canViewReports: e.canViewReports,
            canViewCompetitorData: e.canViewCompetitorData,
            decisionsSubmitted: e.decisionsSubmitted,
            createdAt: e['createdAt'],
            updatedAt: e['updatedAt'],
            hasPaid: e.hasPaid,
            paidAt: e.paidAt,
            paymentNotes: e.paymentNotes,
          })),
          memberCount: enrollments.length,
        };
      }),
    );

    const activeEvents = await this.eventModel.find({
      simulation: simObjectId,
      isActive: true,
    });
    return {
      ...simulation.toObject(),
      firms: firmsWithEnrollments,
      activeEvents: activeEvents.map((e) => ({
        id: e._id,
        name: e.name,
        type: e.type,
        effect: e.effect,
        magnitude: e.magnitude,
        startQuarter: e.startQuarter,
        duration: e.duration,
      })),
    };
  }

  async update(
    simulationId: string,
    dto: UpdateSimulationDto,
  ): Promise<SimulationDocument> {
    const simulation = await this.simulationModel.findById(
      this.toObjectId(simulationId),
    );
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    // Guard: module schedule can only be edited before the sim starts running.
    // Once status is IN_PROGRESS / PAUSED / COMPLETED, the schedule is locked
    // to prevent fairness issues across teams mid-simulation.
    if (dto.moduleSchedule || dto.orientationQuarters !== undefined || dto.schedulePreset !== undefined || dto.totalQuarters !== undefined) {
      const editable =
        simulation.status === SimulationStatus.CREATED ||
        simulation.status === SimulationStatus.INITIALIZED;
      if (!editable) {
        throw new BadRequestException(
          `Module schedule is locked once the simulation starts (current status: ${simulation.status}).`,
        );
      }
      const totalQ = dto.totalQuarters ?? simulation.totalQuarters ?? 12;
      const scheduleConfig = this.resolveScheduleConfig(
        {
          moduleSchedule: dto.moduleSchedule ?? (simulation.moduleSchedule as any),
          orientationQuarters: dto.orientationQuarters ?? simulation.orientationQuarters ?? 2,
          schedulePreset: dto.schedulePreset ?? simulation.schedulePreset ?? SchedulePreset.CUSTOM,
        },
        totalQ,
      );
      (dto as any).orientationQuarters = scheduleConfig.orientationQuarters;
      (dto as any).schedulePreset = scheduleConfig.schedulePreset;
      (dto as any).moduleSchedule = scheduleConfig.moduleSchedule;
    }

    // Block direct writes to assignedModules — it's now derived.
    if ((dto as any).assignedModules) {
      throw new BadRequestException(
        'assignedModules is now derived from moduleSchedule and cannot be set directly. Use moduleSchedule instead.',
      );
    }

    // Guard against shortening quarter duration below elapsed time
    if (dto.quarterDurationDays !== undefined) {
      const elapsed = simulation.quarterStartedAt
        ? (Date.now() - simulation.quarterStartedAt.getTime()) / 86_400_000
        : 0;
      if (dto.quarterDurationDays < elapsed) {
        throw new BadRequestException(
          `Cannot shorten quarter duration to ${dto.quarterDurationDays} days — ` +
          `${elapsed.toFixed(1)} days have already elapsed in the current quarter. ` +
          `Set duration to ${Math.ceil(elapsed)} or higher.`,
        );
      }
      // If shortening or extending, recompute the window end. Start stays fixed.
      if (simulation.quarterStartedAt) {
        simulation.quarterEndsAt = new Date(
          simulation.quarterStartedAt.getTime() +
            dto.quarterDurationDays * 86_400_000,
        );
      }
    }

    if (dto.status)
      this.validateStatusTransition(
        simulation.status as SimulationStatus,
        dto.status,
      );
    
    // Auto-mark faculty intent whenever schedule-related fields are edited.
    // The frontend sends scheduleSetByFaculty:true explicitly, but this also
    // covers any other path that touches the schedule (admin tools, scripts).
    if (
      dto.moduleSchedule ||
      dto.orientationQuarters !== undefined ||
      dto.schedulePreset !== undefined
    ) {
      (dto as any).scheduleSetByFaculty = true;
    }
    
    // Only assign defined properties to avoid overwriting required fields with undefined
    Object.entries(dto).forEach(([key, value]) => {
      if (value !== undefined) {
        (simulation as any)[key] = value;
      }
    });
    
    await simulation.save();
    return this.findOne(simulationId);
  }

  private validateStatusTransition(
    current: SimulationStatus,
    next: SimulationStatus,
  ): void {
    const validTransitions: Record<SimulationStatus, SimulationStatus[]> = {
      [SimulationStatus.CREATED]: [SimulationStatus.INITIALIZED],
      [SimulationStatus.INITIALIZED]: [SimulationStatus.IN_PROGRESS],
      [SimulationStatus.IN_PROGRESS]: [
        SimulationStatus.PAUSED,
        SimulationStatus.COMPLETED,
      ],
      [SimulationStatus.PAUSED]: [
        SimulationStatus.IN_PROGRESS,
        SimulationStatus.COMPLETED,
      ],
      [SimulationStatus.COMPLETED]: [],
    };
    if (!validTransitions[current].includes(next))
      throw new BadRequestException(
        `Cannot transition from ${current} to ${next}`,
      );
  }

  async delete(simulationId: string): Promise<{ message: string }> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    await this.cleanupFailedSimulation(simObjectId);
    return {
      message: `Simulation ${simulationId} and all related data deleted successfully`,
    };
  }

  // ============================================================================
  // CURRENT QUARTER DATA - FIXED
  // ============================================================================

  async getCurrentQuarterData(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    // Lazy expiry check — auto-advances if quarter window elapsed
    const advanced = await this.checkQuarterExpiry(simulation);
    if (advanced) {
      // Reload — simulation state has changed
      const reloaded = await this.simulationModel.findById(simObjectId);
      if (reloaded) Object.assign(simulation, reloaded.toObject());
    }

    const quarter = simulation.currentQuarter;
    const firms = await this.firmModel.find({ simulation: simObjectId });

    console.log(
      `getCurrentQuarterData: Found ${firms.length} firms for simulation ${simulationId}`,
    );

    const firmsData = await Promise.all(
      firms.map(async (firm) => {
        const firmId = firm._id as Types.ObjectId;
        const quarterState = await this.quarterStateModel
          .findOne({ firm: firmId, quarter })
          .sort({ quarter: -1 });
        const decision = await this.decisionModel.findOne({
          firm: firmId,
          quarter,
        });
        const kpiHistory = await this.kpiHistoryModel
          .find({ firm: firmId })
          .sort({ quarter: -1 })
          .limit(4);

        return {
          firm: {
            id: firmId,
            firmNumber: firm.firmNumber,
            name: firm.name,
            color: firm.color,
          },
          state: quarterState
            ? {
                cash: quarterState.cash,
                rawMaterials: quarterState.rawMaterialUnits,
                finishedGoods: quarterState.finishedGoodsUnits,
                inTransit: quarterState.inTransitUnits,
                retailerInventory: quarterState.retailerInventory,
                csi: quarterState.csi,
                marketShare: quarterState.marketShare,
                perfectOrder: quarterState.perfectOrder,
                retailerMode: quarterState.retailerMode,
                cumulativeRevenue: quarterState.cumulativeRevenue,
                cumulativeProfit: quarterState.cumulativeProfit,
                dcCentralOpen: quarterState.dcCentralOpen,
                dcCentralInventory: quarterState.dcCentralInventory,
                dcWestOpen: quarterState.dcWestOpen,
                dcWestInventory: quarterState.dcWestInventory,
              }
            : null,
          decision: decision
            ? {
                id: decision._id,
                status: decision.status,
                submittedAt: decision.submittedAt,
                forecastTotal:
                  decision.forecastR1 +
                  decision.forecastR2 +
                  decision.forecastR3,
                productionTotal: decision.productionP1 + decision.productionP2,
              }
            : null,
          kpiTrend: kpiHistory.reverse(),
        };
      }),
    );

    const demandHistory = await this.demandHistoryModel.findOne({
      simulation: simObjectId,
      quarter,
    });
    const activeEvents = await this.eventModel.find({
      simulation: simObjectId,
      isActive: true,
      startQuarter: { $lte: quarter },
    });
    const calendarQuarter = ((quarter - 1) % 4) + 1;

    return {
      simulation: {
        id: simulation._id,
        name: simulation.name,
        status: simulation.status,
        currentQuarter: quarter,
        totalQuarters: simulation.totalQuarters,
        features: simulation.features,
      },
      seasonality: {
        calendarQuarter,
        label: CONFIG.seasonality.LABELS[calendarQuarter],
        multiplier:
          simulation.seasonality?.[`q${calendarQuarter}Multiplier`] ??
          CONFIG.seasonality.QUARTERS[calendarQuarter],
      },
      firms: firmsData,
      demandHistory: demandHistory
        ? {
            demandR1: demandHistory.demandR1,
            demandR2: demandHistory.demandR2,
            demandR3: demandHistory.demandR3,
            totalDemand: demandHistory.totalDemand,
            seasonalMultiplier: demandHistory.seasonalMultiplier,
          }
        : null,
      activeEvents: activeEvents.map((e) => ({
        id: e._id,
        name: e.name,
        type: e.type,
        effect: e.effect,
        magnitude: e.magnitude,
        startQuarter: e.startQuarter,
        duration: e.duration,
      })),
      allDecisionsSubmitted: firmsData.every(
        (f) =>
          f.decision?.status === 'SUBMITTED' ||
          f.decision?.status === 'PROCESSED',
      ),
      quarterPacing: {
        durationDays: simulation.quarterDurationDays,
        startedAt: simulation.quarterStartedAt,
        endsAt: simulation.quarterEndsAt,
        msRemaining: simulation.quarterEndsAt
          ? Math.max(0, simulation.quarterEndsAt.getTime() - Date.now())
          : null,
        isWindowOpen:
          simulation.status === SimulationStatus.IN_PROGRESS &&
          !!simulation.quarterEndsAt &&
          Date.now() < simulation.quarterEndsAt.getTime(),
      },
    };
  }

  // ============================================================================
  // DEMAND HISTORY - FIXED
  // ============================================================================

  async getDemandHistory(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const demandHistory = await this.demandHistoryModel
      .find({ simulation: simObjectId })
      .sort({ quarter: 1 });

    console.log(
      `getDemandHistory: Found ${demandHistory.length} demand records for simulation ${simulationId}`,
    );

    return {
      simulationId,
      totalMarketSize: simulation.totalMarketSize,
      demandHistory,
    };
  }

  // ============================================================================
  // LEADERBOARD - FIXED
  // ============================================================================

  async getLeaderboard(simulationId: string, quarter?: any): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const parsed =
      quarter !== undefined && quarter !== null
        ? parseInt(String(quarter), 10)
        : NaN;
    const targetQuarter =
      Number.isFinite(parsed) && !isNaN(parsed)
        ? parsed
        : simulation.currentQuarter;

    const kpis = await this.kpiHistoryModel
      .find({ simulation: simObjectId, quarter: targetQuarter })
      .sort({ 'bsc.overall': -1 })
      .populate('firm', 'firmNumber name color');

    const rankings = kpis.map((kpi, index) => ({
      rank: index + 1,
      firmId: (kpi.firm as any)?._id ?? null,
      firmNumber: (kpi.firm as any)?.firmNumber ?? null,
      firmName: (kpi.firm as any)?.name ?? null,
      firmColor: (kpi.firm as any)?.color ?? null,
      bscOverall: kpi.bsc?.overall ?? null,
      bscFinancial: kpi.bsc?.financial ?? null,
      bscCustomer: kpi.bsc?.customer ?? null,
      bscProcess: kpi.bsc?.process ?? null,
      bscLearning: kpi.bsc?.learning ?? null,
      grade: kpi.bsc?.grade ?? null,
      csi: kpi.customer?.csi ?? null,
      marketShare: kpi.customer?.marketShare ?? null,
      revenue: kpi.financial?.revenue ?? null,
      netIncome: kpi.financial?.netIncome ?? null,
    }));

    return { simulationId, quarter: targetQuarter, rankings };
  }

  // ============================================================================
  // QUARTER HISTORY - FIXED
  // ============================================================================

  async getQuarterHistory(
    simulationId: string,
    fromQuarter?: number,
    toQuarter?: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const from = fromQuarter ?? 1;
    const to = toQuarter ?? simulation.currentQuarter;

    const demandHistory = await this.demandHistoryModel
      .find({
        simulation: simObjectId,
        quarter: { $gte: from, $lte: to },
      })
      .sort({ quarter: 1 });

    const firms = await this.firmModel.find({ simulation: simObjectId });
    const firmKpis: Record<string, any[]> = {};

    for (const firm of firms) {
      const kpis = await this.kpiHistoryModel
        .find({
          firm: firm._id,
          quarter: { $gte: from, $lte: to },
        })
        .sort({ quarter: 1 });
      firmKpis[firm.firmNumber] = kpis;
    }

    return {
      simulationId,
      fromQuarter: from,
      toQuarter: to,
      demandHistory,
      firmKpis,
    };
  }

  // ============================================================================
  // GET QUARTER BY NUMBER
  // ============================================================================

  async getQuarterByNumber(
    simulationId: string,
    quarterNumber: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    if (quarterNumber < 0 || quarterNumber > simulation.currentQuarter) {
      throw new BadRequestException(
        `Quarter ${quarterNumber} is invalid. Current quarter is ${simulation.currentQuarter}`,
      );
    }

    const firms = await this.firmModel.find({ simulation: simObjectId });

    const firmsData = await Promise.all(
      firms.map(async (firm) => {
        const firmId = firm._id as Types.ObjectId;
        const quarterState = await this.quarterStateModel.findOne({
          firm: firmId,
          quarter: quarterNumber,
        });
        const decision = await this.decisionModel.findOne({
          firm: firmId,
          quarter: quarterNumber,
        });
        const kpiHistory = await this.kpiHistoryModel.findOne({
          firm: firmId,
          quarter: quarterNumber,
        });

        return {
          firm: {
            id: firmId,
            firmNumber: firm.firmNumber,
            name: firm.name,
            color: firm.color,
          },
          state: quarterState
            ? {
                cash: quarterState.cash,
                rawMaterials: quarterState.rawMaterialUnits,
                finishedGoods: quarterState.finishedGoodsUnits,
                inTransit: quarterState.inTransitUnits,
                retailerInventory: quarterState.retailerInventory,
                csi: quarterState.csi,
                marketShare: quarterState.marketShare,
                perfectOrder: quarterState.perfectOrder,
                retailerMode: quarterState.retailerMode,
                cumulativeRevenue: quarterState.cumulativeRevenue,
                cumulativeProfit: quarterState.cumulativeProfit,
                dcCentralOpen: quarterState.dcCentralOpen,
                dcCentralInventory: quarterState.dcCentralInventory,
                dcWestOpen: quarterState.dcWestOpen,
                dcWestInventory: quarterState.dcWestInventory,
              }
            : null,
          decision: decision
            ? {
                id: decision._id,
                status: decision.status,
                submittedAt: decision.submittedAt,
                forecastTotal:
                  decision.forecastR1 +
                  decision.forecastR2 +
                  decision.forecastR3,
                productionTotal: decision.productionP1 + decision.productionP2,
              }
            : null,
          kpi: kpiHistory
            ? {
                bscOverall: kpiHistory.bsc?.overall ?? null,
                bscFinancial: kpiHistory.bsc?.financial ?? null,
                bscCustomer: kpiHistory.bsc?.customer ?? null,
                bscProcess: kpiHistory.bsc?.process ?? null,
                bscLearning: kpiHistory.bsc?.learning ?? null,
                grade: kpiHistory.bsc?.grade ?? null,
                csi: kpiHistory.customer?.csi ?? null,
                marketShare: kpiHistory.customer?.marketShare ?? null,
                revenue: kpiHistory.financial?.revenue ?? null,
                netIncome: kpiHistory.financial?.netIncome ?? null,
              }
            : null,
        };
      }),
    );

    const demandHistory = await this.demandHistoryModel.findOne({
      simulation: simObjectId,
      quarter: quarterNumber,
    });
    const activeEvents = await this.eventModel.find({
      simulation: simObjectId,
      isActive: true,
      startQuarter: { $lte: quarterNumber },
    });
    const calendarQuarter = ((quarterNumber - 1) % 4) + 1;

    return {
      simulation: {
        id: simulation._id,
        name: simulation.name,
        status: simulation.status,
        currentQuarter: simulation.currentQuarter,
        totalQuarters: simulation.totalQuarters,
        features: simulation.features,
      },
      quarter: quarterNumber,
      seasonality: {
        calendarQuarter,
        label: CONFIG.seasonality.LABELS[calendarQuarter],
        multiplier:
          simulation.seasonality?.[`q${calendarQuarter}Multiplier`] ??
          CONFIG.seasonality.QUARTERS[calendarQuarter],
      },
      firms: firmsData,
      demandHistory: demandHistory
        ? {
            demandR1: demandHistory.demandR1,
            demandR2: demandHistory.demandR2,
            demandR3: demandHistory.demandR3,
            totalDemand: demandHistory.totalDemand,
            seasonalMultiplier: demandHistory.seasonalMultiplier,
          }
        : null,
      activeEvents: activeEvents.map((e) => ({
        id: e._id,
        name: e.name,
        type: e.type,
        effect: e.effect,
        magnitude: e.magnitude,
        remainingQuarters: e.duration - (quarterNumber - e.startQuarter),
      })),
    };
  }
  // ============================================================================
  // ENROLLMENTS - FIXED
  // ============================================================================

  async getSimulationEnrollments(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const firms = await this.firmModel.find({ simulation: simObjectId });
    const firmsResult: any[] = [];

    for (const firm of firms) {
      const enrollments = await this.enrollmentModel
        .find({ firm: firm._id })
        .populate('user', 'email firstName lastName studentId');

      firmsResult.push({
        firm: {
          id: firm._id,
          firmNumber: firm.firmNumber,
          name: firm.name,
          color: firm.color,
        },
        enrollments: enrollments.map((e) => ({
          id: e._id,
          user: {
            id: (e.user as any)?._id,
            email: (e.user as any)?.email,
            firstName: (e.user as any)?.firstName,
            lastName: (e.user as any)?.lastName,
            studentId: (e.user as any)?.studentId,
          },
          status: e.status,
          role: e.role,
          teamName: e.teamName,
          canSubmitDecisions: e.canSubmitDecisions,
          canViewReports: e.canViewReports,
          canViewCompetitorData: e.canViewCompetitorData,
          decisionsSubmitted: e.decisionsSubmitted,
          lastActivityAt: e.lastActivityAt,
          hasPaid: e.hasPaid,
          paidAt: e.paidAt,
          paymentNotes: e.paymentNotes,
        })),
        memberCount: enrollments.length,
      });
    }

    // Collect students enrolled in this simulation but not yet placed in a firm
    // Unplaced means: firm field is null OR firm doesn't belong to this simulation
    const allEnrollments = await this.enrollmentModel
      .find({ simulation: simObjectId })
      .populate('user', 'email firstName lastName studentId')
      .populate('firm');

    const validFirmIds = new Set(firms.map((f) => String(f._id)));

    // An enrollment counts as unplaced if:
    //   - its firm field is null/undefined, OR
    //   - its firm field is a real ObjectId but doesn't belong to this simulation's firms
    //     (this catches the legacy bogus-placeholder ObjectId state)
    const unplacedEnrollments = allEnrollments.filter((e) => {
      if (!e.firm) return true;
      const firmIdStr = String((e.firm as any)?._id ?? e.firm);
      return !validFirmIds.has(firmIdStr);
    });

    const unplaced = unplacedEnrollments.map(e => ({
      id: e._id,
      user: {
        id: (e.user as any)?._id,
        email: (e.user as any)?.email,
        firstName: (e.user as any)?.firstName,
        lastName: (e.user as any)?.lastName,
        studentId: (e.user as any)?.studentId,
      },
      status: e.status,
      role: e.role,
      decisionsSubmitted: e.decisionsSubmitted,
      lastActivityAt: e.lastActivityAt,
      hasPaid: e.hasPaid,
      paidAt: e.paidAt,
      paymentNotes: e.paymentNotes,
    }));

    return {
      simulationId,
      firms: firmsResult,
      unplaced,
      unplacedCount: unplaced.length,
      totalEnrolled: allEnrollments.length,
    };
  }

  async enrollStudentsInFirm(
    simulationId: string,
    dto: EnrollStudentsDto,
  ): Promise<EnrollmentResponseDto[]> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    let firm: FirmDocument | null = null;
    if (Types.ObjectId.isValid(dto.firmId)) {
      firm = await this.firmModel.findOne({
        _id: this.toObjectId(dto.firmId),
        simulation: simObjectId,
      });
    }
    if (!firm) {
      const firmNumber = parseInt(dto.firmId, 10);
      if (!isNaN(firmNumber)) {
        firm = await this.firmModel.findOne({
          simulation: simObjectId,
          firmNumber,
        });
      }
    }
    if (!firm) throw new NotFoundException(`Firm ${dto.firmId} not found`);

    const firmId = firm._id as Types.ObjectId;
    const enrollments: EnrollmentResponseDto[] = [];

    for (const student of dto.students) {
      const user = await this.userModel.findById(student.studentId);
      if (!user)
        throw new NotFoundException(`User ${student.studentId} not found`);

      const existingEnrollment = await this.enrollmentModel.findOne({
        simulation: simObjectId,
        user: this.toObjectId(student.studentId),
      });
      if (existingEnrollment) {
        // Update existing enrollment instead of creating duplicate
        existingEnrollment.firm = firmId;
        existingEnrollment.firmNumber = firm.firmNumber;
        existingEnrollment.status = EnrollmentStatus.ACTIVE;
        existingEnrollment.role = student.role ?? EnrollmentRole.TEAM_MEMBER;
        existingEnrollment.teamName = dto.teamName;
        existingEnrollment.canSubmitDecisions = dto.canSubmitDecisions ?? true;
        existingEnrollment.canViewReports = dto.canViewReports ?? true;
        existingEnrollment.canViewCompetitorData =
          dto.canViewCompetitorData ?? false;
        await existingEnrollment.save();
        // Keep existing decisionsSubmitted count
      }

      // Count submitted decisions for this student in this firm
      const submittedCount = await this.decisionModel.countDocuments({
        firm: firmId,
        submittedBy: this.toObjectId(student.studentId),
        status: { $in: ['SUBMITTED', 'PROCESSED'] },
      });

      const enrollment =
        existingEnrollment ||
        new this.enrollmentModel({
          simulation: simObjectId,
          firm: firmId,
          user: this.toObjectId(student.studentId),
          firmNumber: firm.firmNumber,
          status: EnrollmentStatus.ACTIVE,
          role: student.role ?? 'TEAM_MEMBER',
          teamName: dto.teamName,
          canSubmitDecisions: dto.canSubmitDecisions ?? true,
          canViewReports: dto.canViewReports ?? true,
          canViewCompetitorData: dto.canViewCompetitorData ?? false,
          decisionsSubmitted: submittedCount, // Set actual count
        });

      const savedEnrollment = existingEnrollment
        ? enrollment
        : await enrollment.save();

      if (!existingEnrollment) {
        await this.firmModel.findByIdAndUpdate(firmId, {
          $addToSet: { members: student.studentId },
        });
      }

      enrollments.push({
        id: (savedEnrollment._id as Types.ObjectId).toString(),
        simulation: simulationId,
        firm: {
          id: firmId.toString(),
          firmNumber: firm.firmNumber,
          name: firm.name,
        },
        user: {
          id: (user as any)._id.toString(),
          email: (user as any).email,
          firstName: (user as any).firstName,
          lastName: (user as any).lastName,
        },
        firmNumber: firm.firmNumber,
        status: savedEnrollment.status,
        role: savedEnrollment.role,
        teamName: savedEnrollment.teamName,
        canSubmitDecisions: savedEnrollment.canSubmitDecisions,
        canViewReports: savedEnrollment.canViewReports,
        canViewCompetitorData: savedEnrollment.canViewCompetitorData,
        decisionsSubmitted: savedEnrollment.decisionsSubmitted,
        createdAt: savedEnrollment['createdAt'],
        updatedAt: savedEnrollment['updatedAt'],
      });
    }

    return enrollments;
  }

  async unassignStudentFromFirm(
    simulationId: string,
    enrollmentId: string,
  ): Promise<{ success: boolean; enrollmentId: string }> {
    const simObjectId = this.toObjectId(simulationId);

    const enrollment = await this.enrollmentModel.findOne({
      _id: this.toObjectId(enrollmentId),
      simulation: simObjectId,
    });
    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found`);
    }

    // If the student has already submitted decisions, disallow unassign to avoid
    // orphaned decision records pointing at a now-empty firm
    if (enrollment.decisionsSubmitted > 0) {
      throw new BadRequestException(
        'Cannot unassign a student who has already submitted decisions. Reset their decisions first.',
      );
    }

    enrollment.firm = null as any;
    enrollment.firmNumber = null as any;
    enrollment.status = EnrollmentStatus.PENDING;
    enrollment.canSubmitDecisions = false;
    enrollment.teamName = undefined as any;
    await enrollment.save();

    return { success: true, enrollmentId };
  }

  /**
   * Delete a single student enrollment from the simulation (enrollment only)
   * Also removes the student from their firm's members list if enrolled in a firm
   */
  async deleteEnrollment(
    simulationId: string,
    enrollmentId: string,
  ): Promise<{ deletedCount: number; deletedIds: string[]; message: string }> {
    const simObjectId = this.toObjectId(simulationId);

    const enrollment = await this.enrollmentModel.findOne({
      _id: this.toObjectId(enrollmentId),
      simulation: simObjectId,
    });
    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found`);
    }

    // If student is enrolled in a firm, remove them from firm's members list
    if (enrollment.firm) {
      await this.firmModel.updateOne(
        { _id: enrollment.firm },
        { $pull: { members: enrollment.user } },
      );
    }

    // Delete the enrollment
    await this.enrollmentModel.deleteOne({ _id: this.toObjectId(enrollmentId) });

    return {
      deletedCount: 1,
      deletedIds: [enrollmentId],
      message: `Enrollment ${enrollmentId} deleted successfully. Student removed from firm members.`,
    };
  }

  /**
   * Delete a single student enrollment from the simulation with user deletion
   * Also removes the student from their firm's members list if enrolled in a firm
   * And deletes the user record from the Users collection
   */
  async deleteEnrollmentWithUser(
    simulationId: string,
    enrollmentId: string,
  ): Promise<{ deletedCount: number; deletedIds: string[]; message: string }> {
    const simObjectId = this.toObjectId(simulationId);

    const enrollment = await this.enrollmentModel.findOne({
      _id: this.toObjectId(enrollmentId),
      simulation: simObjectId,
    });
    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found`);
    }

    const userId = enrollment.user;

    // If student is enrolled in a firm, remove them from firm's members list
    if (enrollment.firm) {
      await this.firmModel.updateOne(
        { _id: enrollment.firm },
        { $pull: { members: userId } },
      );
    }

    // Delete the enrollment
    await this.enrollmentModel.deleteOne({ _id: this.toObjectId(enrollmentId) });

    // Delete the user from Users collection
    await this.userModel.deleteOne({ _id: userId });

    return {
      deletedCount: 1,
      deletedIds: [enrollmentId],
      message: `Enrollment ${enrollmentId} and user deleted successfully.`,
    };
  }

  /**
   * Bulk delete multiple student enrollments from the simulation (enrollments only)
   * Also removes students from their firm's members list if enrolled in firms
   */
  async bulkDeleteEnrollments(
    simulationId: string,
    enrollmentIds: string[],
  ): Promise<{ deletedCount: number; deletedIds: string[]; message: string }> {
    const simObjectId = this.toObjectId(simulationId);
    const enrollmentObjectIds = enrollmentIds.map(id => this.toObjectId(id));

    // Verify all enrollments belong to this simulation
    const enrollments = await this.enrollmentModel.find({
      _id: { $in: enrollmentObjectIds },
      simulation: simObjectId,
    });

    if (enrollments.length === 0) {
      throw new NotFoundException(
        `No enrollments found for the given IDs in simulation ${simulationId}`,
      );
    }

    if (enrollments.length !== enrollmentIds.length) {
      throw new BadRequestException(
        `Some enrollment IDs do not belong to simulation ${simulationId}`,
      );
    }

    // Remove students from their firms' members lists
    for (const enrollment of enrollments) {
      if (enrollment.firm) {
        await this.firmModel.updateOne(
          { _id: enrollment.firm },
          { $pull: { members: enrollment.user } },
        );
      }
    }

    // Delete all enrollments
    const result = await this.enrollmentModel.deleteMany({
      _id: { $in: enrollmentObjectIds },
      simulation: simObjectId,
    });

    return {
      deletedCount: result.deletedCount || 0,
      deletedIds: enrollmentIds,
      message: `${result.deletedCount || 0} enrollments deleted successfully.`,
    };
  }

  /**
   * Bulk delete multiple student enrollments from the simulation with user deletion
   * Also removes students from their firm's members list if enrolled in firms
   * And deletes the user records from the Users collection
   */
  async bulkDeleteEnrollmentsWithUsers(
    simulationId: string,
    enrollmentIds: string[],
  ): Promise<{ deletedCount: number; deletedIds: string[]; message: string }> {
    const simObjectId = this.toObjectId(simulationId);
    const enrollmentObjectIds = enrollmentIds.map(id => this.toObjectId(id));

    // Verify all enrollments belong to this simulation
    const enrollments = await this.enrollmentModel.find({
      _id: { $in: enrollmentObjectIds },
      simulation: simObjectId,
    });

    if (enrollments.length === 0) {
      throw new NotFoundException(
        `No enrollments found for the given IDs in simulation ${simulationId}`,
      );
    }

    if (enrollments.length !== enrollmentIds.length) {
      throw new BadRequestException(
        `Some enrollment IDs do not belong to simulation ${simulationId}`,
      );
    }

    // Collect user IDs for deletion
    const userIds = enrollments.map(e => e.user);

    // Remove students from their firms' members lists
    for (const enrollment of enrollments) {
      if (enrollment.firm) {
        await this.firmModel.updateOne(
          { _id: enrollment.firm },
          { $pull: { members: enrollment.user } },
        );
      }
    }

    // Delete all enrollments
    const result = await this.enrollmentModel.deleteMany({
      _id: { $in: enrollmentObjectIds },
      simulation: simObjectId,
    });

    // Delete all users from Users collection
    await this.userModel.deleteMany({
      _id: { $in: userIds },
    });

    return {
      deletedCount: result.deletedCount || 0,
      deletedIds: enrollmentIds,
      message: `${result.deletedCount || 0} enrollments and ${userIds.length} users deleted successfully.`,
    };
  }

  // ============================================================================
  // ENROLLMENT DETAIL & ACCESS CONTROL
  // ============================================================================

  async getEnrollmentDetail(
    simulationId: string,
    enrollmentId: string,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const enrObjectId = this.toObjectId(enrollmentId);

    const enrollment = await this.enrollmentModel
      .findOne({ _id: enrObjectId, simulation: simObjectId })
      .populate('user', 'email firstName lastName studentId isActive lastLoginAt organization createdAt')
      .populate('firm');

    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found in this simulation`);
    }

    const user = enrollment.user as any;
    const firm = enrollment.firm as any;

    // Count decisions submitted by this user in this sim
    let decisionsSubmitted = 0;
    try {
      decisionsSubmitted = await this.decisionModel.countDocuments({
        simulation: simObjectId,
        $or: [
          { submittedBy: user?._id },
          { user: user?._id },
        ],
      });
    } catch { /* decisionModel might not be available */ }

    return {
      id: enrollment._id,
      user: user ? {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        studentId: user.studentId,
        organization: user.organization,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user['createdAt'],
      } : null,
      firm: firm ? {
        id: firm._id,
        name: firm.name,
        firmNumber: firm.firmNumber,
        color: firm.color,
      } : null,
      status: enrollment.status,
      role: enrollment.role,
      teamName: enrollment.teamName,
      canSubmitDecisions: enrollment.canSubmitDecisions,
      canViewReports: enrollment.canViewReports,
      canViewCompetitorData: enrollment.canViewCompetitorData,
      decisionsSubmitted: enrollment.decisionsSubmitted ?? decisionsSubmitted,
      lastActivityAt: enrollment.lastActivityAt,
      hasPaid: enrollment.hasPaid,
      paidAt: enrollment.paidAt,
      paymentNotes: enrollment.paymentNotes,
      createdAt: enrollment['createdAt'],
      updatedAt: enrollment['updatedAt'],
    };
  }

  async blockEnrollment(
    simulationId: string,
    enrollmentId: string,
    reason?: string,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const enrObjectId = this.toObjectId(enrollmentId);

    const enrollment = await this.enrollmentModel.findOne({
      _id: enrObjectId,
      simulation: simObjectId,
    });
    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found in this simulation`);
    }
    if (enrollment.status === EnrollmentStatus.DROPPED) {
      return { ok: true, status: enrollment.status, alreadyBlocked: true };
    }

    enrollment.status = EnrollmentStatus.DROPPED;
    await enrollment.save();

    // Audit log only — don't pollute domain fields. If you have a dedicated
    // audit log table, write the entry there with simulationId, enrollmentId,
    // facultyUserId (pull from request context), reason, and timestamp.
    console.log(
      `[block] enrollment=${enrollmentId} sim=${simulationId} reason=${reason || '(none)'}`,
    );

    return {
      ok: true,
      status: enrollment.status,
      enrollmentId: enrollment._id,
      blockedAt: new Date(),
      reason: reason || null,
    };
  }

  async unblockEnrollment(
    simulationId: string,
    enrollmentId: string,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const enrObjectId = this.toObjectId(enrollmentId);

    const enrollment = await this.enrollmentModel.findOne({
      _id: enrObjectId,
      simulation: simObjectId,
    });
    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found in this simulation`);
    }
    if (enrollment.status !== EnrollmentStatus.DROPPED) {
      return { ok: true, status: enrollment.status, alreadyActive: true };
    }

    enrollment.status = EnrollmentStatus.ACTIVE;
    await enrollment.save();

    return {
      ok: true,
      status: enrollment.status,
      enrollmentId: enrollment._id,
    };
  }

  async resetEnrollmentPassword(
    simulationId: string,
    enrollmentId: string,
  ): Promise<{ ok: true; tempPassword: string; userEmail: string }> {
    const simObjectId = this.toObjectId(simulationId);
    const enrObjectId = this.toObjectId(enrollmentId);

    const enrollment = await this.enrollmentModel
      .findOne({ _id: enrObjectId, simulation: simObjectId })
      .populate('user', 'email firstName lastName passwordHash');

    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found in this simulation`);
    }
    const user = enrollment.user as any;
    if (!user) {
      throw new NotFoundException('Student user account not found');
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { passwordHash } },
    );

    return {
      ok: true,
      tempPassword,
      userEmail: user.email,
    };
  }

  private generateTempPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digit = '23456789';
    const crypto = require('crypto');
    const pick = (chars: string, n: number) => Array.from(
      { length: n },
      () => chars[crypto.randomInt(0, chars.length)],
    );
    const all = [...pick(upper, 4), ...pick(lower, 4), ...pick(digit, 4)];
    for (let i = all.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.join('');
  }

  // ============================================================================
  // ACCESS CONTROL — check if student can view this simulation
  // ============================================================================

  async getMyAccessToSimulation(
    simulationId: string,
    userId: string,
  ): Promise<{
    access: 'ACTIVE' | 'PENDING' | 'BLOCKED' | 'NOT_ENROLLED' | 'COMPLETED';
    enrollmentId?: string;
    firm?: { id: string; name: string; color?: string; firmNumber?: number };
    blockedAt?: Date;
    reason?: string | null;
  }> {
    if (!userId) return { access: 'NOT_ENROLLED' };

    const simObjectId = this.toObjectId(simulationId);
    const userObjectId = this.toObjectId(userId);

    const enrollment = await this.enrollmentModel
      .findOne({ simulation: simObjectId, user: userObjectId })
      .populate('firm');

    if (!enrollment) return { access: 'NOT_ENROLLED' };

    // Map enrollment status to a frontend-friendly access verdict. DROPPED is
    // renamed BLOCKED here so the student-facing API speaks the right language.
    const map: Record<string, 'ACTIVE' | 'PENDING' | 'BLOCKED' | 'COMPLETED'> = {
      [EnrollmentStatus.ACTIVE]:    'ACTIVE',
      [EnrollmentStatus.PENDING]:   'PENDING',
      [EnrollmentStatus.DROPPED]:   'BLOCKED',
      [EnrollmentStatus.COMPLETED]: 'COMPLETED',
    };

    const access = map[enrollment.status] || 'NOT_ENROLLED';
    const firm = enrollment.firm as any;

    return {
      access,
      enrollmentId: String(enrollment._id),
      firm: firm ? {
        id: String(firm._id),
        name: firm.name,
        color: firm.color,
        firmNumber: firm.firmNumber,
      } : undefined,
      blockedAt: enrollment.status === EnrollmentStatus.DROPPED
        ? (enrollment as any).updatedAt
        : undefined,
    };
  }

  // ============================================================================
  // STUDENT PAYMENT TRACKING (per-student, per-simulation)
  // ============================================================================

  async markStudentPaid(
    simulationId: string,
    enrollmentId: string,
    notes?: string,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const enrollment = await this.enrollmentModel
      .findOne({
        _id: this.toObjectId(enrollmentId),
        simulation: simObjectId,
      })
      .populate('user', 'email firstName lastName studentId');

    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found`);
    }

    enrollment.hasPaid = true;
    enrollment.paidAt = new Date();
    enrollment.paymentNotes = notes || '';
    await enrollment.save();

    return {
      success: true,
      enrollmentId,
      message: `${(enrollment.user as any)?.firstName} ${(enrollment.user as any)?.lastName} marked as paid`,
      hasPaid: enrollment.hasPaid,
      paidAt: enrollment.paidAt,
      paymentNotes: enrollment.paymentNotes,
    };
  }

  async markStudentUnpaid(
    simulationId: string,
    enrollmentId: string,
    notes?: string,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const enrollment = await this.enrollmentModel
      .findOne({
        _id: this.toObjectId(enrollmentId),
        simulation: simObjectId,
      })
      .populate('user', 'email firstName lastName studentId');

    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found`);
    }

    enrollment.hasPaid = false;
    enrollment.paidAt = null;
    enrollment.paymentNotes = notes || '';
    await enrollment.save();

    return {
      success: true,
      enrollmentId,
      message: `${(enrollment.user as any)?.firstName} ${(enrollment.user as any)?.lastName} marked as unpaid`,
      hasPaid: enrollment.hasPaid,
      paidAt: enrollment.paidAt,
      paymentNotes: enrollment.paymentNotes,
    };
  }

  async getStudentPaymentStatus(
    simulationId: string,
    groupBy: 'firm' | 'payment' = 'firm',
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);

    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const enrollments = await this.enrollmentModel
      .find({ simulation: simObjectId })
      .populate('user', 'email firstName lastName studentId')
      .populate('firm', 'firmNumber name color');

    if (groupBy === 'payment') {
      // Group by payment status
      const paid: any[] = [];
      const unpaid: any[] = [];

      for (const enrollment of enrollments) {
        const item = {
          enrollmentId: enrollment._id,
          student: {
            id: (enrollment.user as any)?._id,
            email: (enrollment.user as any)?.email,
            firstName: (enrollment.user as any)?.firstName,
            lastName: (enrollment.user as any)?.lastName,
            studentId: (enrollment.user as any)?.studentId,
          },
          firm: enrollment.firm
            ? {
                id: (enrollment.firm as any)?._id,
                firmNumber: (enrollment.firm as any)?.firmNumber,
                name: (enrollment.firm as any)?.name,
                color: (enrollment.firm as any)?.color,
              }
            : null,
          hasPaid: enrollment.hasPaid,
          paidAt: enrollment.paidAt,
          paymentNotes: enrollment.paymentNotes,
        };

        if (enrollment.hasPaid) {
          paid.push(item);
        } else {
          unpaid.push(item);
        }
      }

      return {
        simulationId,
        totalStudents: enrollments.length,
        paidCount: paid.length,
        unpaidCount: unpaid.length,
        paid,
        unpaid,
      };
    } else {
      // Group by firm (default)
      const firms = await this.firmModel.find({ simulation: simObjectId });
      const byFirm: any[] = [];

      for (const firm of firms) {
        const firmEnrollments = enrollments.filter(
          (e) => String(e.firm?._id) === String(firm._id),
        );

        const paid = firmEnrollments.filter((e) => e.hasPaid);
        const unpaid = firmEnrollments.filter((e) => !e.hasPaid);

        byFirm.push({
          firm: {
            id: firm._id,
            firmNumber: firm.firmNumber,
            name: firm.name,
            color: firm.color,
          },
          totalMembers: firmEnrollments.length,
          paidCount: paid.length,
          unpaidCount: unpaid.length,
          members: firmEnrollments.map((e) => ({
            enrollmentId: e._id,
            student: {
              id: (e.user as any)?._id,
              email: (e.user as any)?.email,
              firstName: (e.user as any)?.firstName,
              lastName: (e.user as any)?.lastName,
              studentId: (e.user as any)?.studentId,
            },
            hasPaid: e.hasPaid,
            paidAt: e.paidAt,
            paymentNotes: e.paymentNotes,
          })),
        });
      }

      // Also include unplaced students
      const unplaced = enrollments.filter((e) => !e.firm);
      if (unplaced.length > 0) {
        byFirm.push({
          firm: null,
          totalMembers: unplaced.length,
          paidCount: unplaced.filter((e) => e.hasPaid).length,
          unpaidCount: unplaced.filter((e) => !e.hasPaid).length,
          members: unplaced.map((e) => ({
            enrollmentId: e._id,
            student: {
              id: (e.user as any)?._id,
              email: (e.user as any)?.email,
              firstName: (e.user as any)?.firstName,
              lastName: (e.user as any)?.lastName,
              studentId: (e.user as any)?.studentId,
            },
            hasPaid: e.hasPaid,
            paidAt: e.paidAt,
            paymentNotes: e.paymentNotes,
          })),
        });
      }

      const totalPaid = enrollments.filter((e) => e.hasPaid).length;
      return {
        simulationId,
        totalStudents: enrollments.length,
        totalPaid,
        totalUnpaid: enrollments.length - totalPaid,
        byFirm,
      };
    }
  }

  async markAllStudentsPaid(simulationId: string, notes?: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);

    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const enrollments = await this.enrollmentModel.find({ simulation: simObjectId });

    const now = new Date();
    const updates = enrollments.map((enrollment) => ({
      updateOne: {
        filter: { _id: enrollment._id },
        update: {
          $set: {
            hasPaid: true,
            paidAt: now,
            paymentNotes: notes || '',
          },
        },
      },
    }));

    if (updates.length > 0) {
      await this.enrollmentModel.bulkWrite(updates);
    }

    return {
      success: true,
      simulationId,
      message: `Marked ${enrollments.length} students as paid`,
      markedCount: enrollments.length,
      timestamp: now,
    };
  }

  async markAllStudentsUnpaid(simulationId: string, notes?: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);

    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const enrollments = await this.enrollmentModel.find({ simulation: simObjectId });

    const updates = enrollments.map((enrollment) => ({
      updateOne: {
        filter: { _id: enrollment._id },
        update: {
          $set: {
            hasPaid: false,
            paidAt: null,
            paymentNotes: notes || '',
          },
        },
      },
    }));

    if (updates.length > 0) {
      await this.enrollmentModel.bulkWrite(updates);
    }

    return {
      success: true,
      simulationId,
      message: `Marked ${enrollments.length} students as unpaid`,
      markedCount: enrollments.length,
      timestamp: new Date(),
    };
  }

  async extendStudentPaymentDate(
    simulationId: string,
    enrollmentId: string,
    extensionDays: number,
    reason?: string,
  ): Promise<any> {
    if (extensionDays <= 0 || extensionDays > 60) {
      throw new BadRequestException('Extension days must be between 1 and 60');
    }

    const simObjectId = this.toObjectId(simulationId);
    const enrollment = await this.enrollmentModel
      .findOne({
        _id: this.toObjectId(enrollmentId),
        simulation: simObjectId,
      })
      .populate('user', 'email firstName lastName studentId');

    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found`);
    }

    // Calculate new extended date
    const extensionMs = extensionDays * 86_400_000; // Convert days to milliseconds
    const now = new Date();
    const newExtendedDate = new Date(now.getTime() + extensionMs);

    // If no payment due date set yet, use current date as base
    if (!enrollment.paymentDueDate) {
      enrollment.paymentDueDate = now;
    }

    enrollment.paymentExtendedDate = newExtendedDate;
    enrollment.paymentNotes = reason ? `${enrollment.paymentNotes || ''}${enrollment.paymentNotes ? ' | ' : ''}Extended by ${extensionDays} days: ${reason}` : `${enrollment.paymentNotes || ''}${enrollment.paymentNotes ? ' | ' : ''}Extended by ${extensionDays} days`;
    await enrollment.save();

    return {
      success: true,
      enrollmentId,
      student: {
        firstName: (enrollment.user as any)?.firstName,
        lastName: (enrollment.user as any)?.lastName,
        email: (enrollment.user as any)?.email,
      },
      message: `Payment deadline extended by ${extensionDays} days`,
      paymentDueDate: enrollment.paymentDueDate,
      paymentExtendedDate: enrollment.paymentExtendedDate,
      extensionDays,
      reason,
      extendedAt: now,
    };
  }

  // ============================================================================
  // FIRM DETAILS - FIXED
  // ============================================================================


  async getFirmDetails(simulationId: string, firmId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const firm = await this.resolveFirm(simulationId, firmId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const currentState = await this.quarterStateModel
      .findOne({ firm: firm._id, quarter: simulation.currentQuarter })
      .lean();
    const enrollments = await this.enrollmentModel
      .find({ firm: firm._id })
      .populate('user', 'email firstName lastName');
    const recentKpis = await this.kpiHistoryModel
      .find({ firm: firm._id })
      .sort({ quarter: -1 })
      .limit(4);

    return {
      firm: {
        id: firm._id,
        firmNumber: firm.firmNumber,
        name: firm.name,
        color: firm.color,
        currentCash: firm.currentCash,
        currentCsi: firm.currentCsi,
        currentMarketShare: firm.currentMarketShare,
        cumulativeRevenue: firm.cumulativeRevenue,
        cumulativeProfit: firm.cumulativeProfit,
      },
      currentState: currentState
        ? {
            quarter: currentState.quarter,
            cash: currentState.cash,
            rawMaterialUnits: currentState.rawMaterialUnits,
            finishedGoodsUnits: currentState.finishedGoodsUnits,
            retailerInventory: currentState.retailerInventory,
            csi: currentState.csi,
            marketShare: currentState.marketShare,
            perfectOrder: currentState.perfectOrder,
            dcCentralOpen: currentState.dcCentralOpen,
            dcCentralInventory: currentState.dcCentralInventory,
            dcWestOpen: currentState.dcWestOpen,
            dcWestInventory: currentState.dcWestInventory,
          }
        : null,
      enrollments: enrollments.map((e) => ({
        id: e._id,
        user: {
          id: (e.user as any)._id,
          email: (e.user as any).email,
          firstName: (e.user as any).firstName,
          lastName: (e.user as any).lastName,
        },
        status: e.status,
        role: e.role,
      })),
      recentKpis: recentKpis.reverse(),
    };
  }

  async getFirmKpiHistory(
    simulationId: string,
    firmId: string,
    quarters?: number,
  ): Promise<any> {
    const firm = await this.resolveFirm(simulationId, firmId);
    let query = this.kpiHistoryModel
      .find({ firm: firm._id })
      .sort({ quarter: 1 });
    if (quarters)
      query = this.kpiHistoryModel
        .find({ firm: firm._id })
        .sort({ quarter: -1 })
        .limit(quarters);
    const kpis = await query;
    return {
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      kpiHistory: quarters ? kpis.reverse() : kpis,
    };
  }

  async getFirmStateHistory(
    simulationId: string,
    firmId: string,
  ): Promise<any> {
    const firm = await this.resolveFirm(simulationId, firmId);
    const states = await this.quarterStateModel
      .find({ firm: firm._id })
      .sort({ quarter: 1 })
      .select('-__v');
    return {
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      stateHistory: states,
    };
  }

  // ============================================================================
  // ADVANCED MODULE DATA - FIXED
  // ============================================================================

  async getWarrantyClaimsHistory(
    simulationId: string,
    firmId: string,
  ): Promise<any> {
    const firm = await this.resolveFirm(simulationId, firmId);
    // DA: Warranty claims not tracked
    return {
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      warrantyClaims: [],
    };
  }

  async getGreenScoreHistory(
    simulationId: string,
    firmId: string,
  ): Promise<any> {
    const firm = await this.resolveFirm(simulationId, firmId);
    // DA: Green score history not tracked
    return {
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      greenScoreHistory: [],
    };
  }

  async getIntelligenceReports(
    simulationId: string,
    firmId: string,
    quarter?: number,
  ): Promise<any> {
    const firm = await this.resolveFirm(simulationId, firmId);
    // DA: Intelligence center not supported
    return {
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      reports: [],
      reportCatalog: {},
    };
  }

  // ============================================================================
  // EVENTS - FIXED
  // ============================================================================

  async getSimulationEvents(
    simulationId: string,
    activeOnly?: boolean,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const query: any = { simulation: simObjectId };
    if (activeOnly) query.isActive = true;

    const events = await this.eventModel.find(query).sort({ startQuarter: -1 });

    return {
      simulationId,
      currentQuarter: simulation.currentQuarter,
      events: events.map((e) => ({
        id: e._id,
        type: e.type,
        name: e.name,
        description: e.description,
        effect: e.effect,
        magnitude: e.magnitude,
        startQuarter: e.startQuarter,
        duration: e.duration,
        isActive: e.isActive,
        source: e.source,
        affectedFirms: e.affectedFirms,
      })),
    };
  }

  async triggerEvent(
    simulationId: string,
    userId: string,
    eventDto: TriggerEventDto,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const EVENT_CONFIG = {
      SUPPLY_DISRUPTION: {
        name: 'Supply Chain Disruption',
        effect: 'PARTS_DELAYED',
        defaultMagnitude: 0.5,
        defaultDuration: 1,
      },
      DEMAND_SURGE: {
        name: 'Viral Demand Surge',
        effect: 'DEMAND_SPIKE',
        defaultMagnitude: 0.3,
        defaultDuration: 1,
      },
      COMPETITOR_STUMBLE: {
        name: 'Competitor PR Crisis',
        effect: 'STEAL_INPLAY',
        defaultMagnitude: 0.25,
        defaultDuration: 1,
      },
      ECONOMIC_DOWNTURN: {
        name: 'Economic Slowdown',
        effect: 'DEMAND_DROP',
        defaultMagnitude: 0.2,
        defaultDuration: 2,
      },
      RAW_MATERIAL_SPIKE: {
        name: 'Raw Material Cost Spike',
        effect: 'COST_INCREASE',
        defaultMagnitude: 0.25,
        defaultDuration: 1,
      },
    };

    const config = EVENT_CONFIG[eventDto.type];
    if (!config)
      throw new BadRequestException(`Invalid event type: ${eventDto.type}`);

    const event = new this.eventModel({
      simulation: simObjectId,
      type: eventDto.type,
      effect: config.effect,
      name: eventDto.name || config.name,
      description: eventDto.description || `Faculty-triggered ${config.name}`,
      startQuarter: simulation.currentQuarter,
      duration: eventDto.duration || config.defaultDuration,
      magnitude: eventDto.magnitude || config.defaultMagnitude,
      isActive: true,
      source: 'FACULTY_TRIGGERED',
      triggeredBy: this.toObjectId(userId),
      // GAS behavior: ALL events apply to ALL firms equally
      // Empty array = affects ALL firms (matching GAS behavior)
      // Only COMPETITOR_STUMBLE might logically target specific firms in future
      affectedFirms: [],
    });

    const savedEvent = await event.save();

    return {
      message: 'Event triggered successfully',
      event: {
        id: savedEvent._id,
        type: savedEvent.type,
        name: savedEvent.name,
        effect: savedEvent.effect,
        magnitude: savedEvent.magnitude,
        startQuarter: savedEvent.startQuarter,
        duration: savedEvent.duration,
      },
    };
  }

  // ============================================================================
  // FEATURE TOGGLES - FIXED
  // ============================================================================

  async updateFeatureToggles(
    simulationId: string,
    featuresDto: UpdateFeaturesDto,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    simulation.features = { ...simulation.features, ...featuresDto };
    await simulation.save();

    return {
      simulationId,
      features: simulation.features,
      message: 'Feature toggles updated. Changes take effect on next quarter.',
    };
  }

  // ============================================================================
  // UI CONTROLS - QUARTER DATA VISIBILITY
  // ============================================================================

  async setShowQuarterData(
    simulationId: string,
    showQuarterData: boolean,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    simulation.showQuarterData = showQuarterData;
    await simulation.save();

    return {
      simulationId,
      showQuarterData: simulation.showQuarterData,
      message: `Quarter data visibility set to ${showQuarterData ? 'visible' : 'hidden'}`,
    };
  }

  async getQuarterDataVisibility(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    return {
      simulationId,
      showQuarterData: simulation.showQuarterData,
    };
  }

  // ============================================================================
  // ACCESS CONTROL
  // ============================================================================

  async checkUserAccess(
    userId: string,
    simulationId: string,
    requiredRole?: string[],
  ): Promise<{ hasAccess: boolean; role: string; firmId?: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) return { hasAccess: false, role: 'none' };
    if (user.role === UserRole.ADMIN)
      return { hasAccess: true, role: UserRole.ADMIN };

    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (simulation?.owner?.toString() === userId)
      return { hasAccess: true, role: 'owner' };

    const enrollment = await this.enrollmentModel.findOne({
      simulation: simObjectId,
      user: this.toObjectId(userId),
      status: EnrollmentStatus.ACTIVE,
    });
    if (enrollment) {
      if (requiredRole && !requiredRole.includes(enrollment.role))
        return {
          hasAccess: false,
          role: enrollment.role,
          firmId: enrollment.firm ? enrollment.firm.toString() : undefined,
        };
      return {
        hasAccess: true,
        role: enrollment.role,
        firmId: enrollment.firm ? enrollment.firm.toString() : undefined,
      };
    }
    return { hasAccess: false, role: 'none' };
  }

  async findSimulationsByFaculty(facultyId: string): Promise<any[]> {
    const objectId = this.toObjectId(facultyId);
    const simulations = await this.simulationModel
      .find({ $or: [{ owner: objectId }, { facultyIds: { $in: [objectId] } }] })
      .sort({ createdAt: -1 });
    return Promise.all(
      simulations.map(async (sim) => {
        const simId = sim._id as Types.ObjectId;
        const firms = await this.firmModel.find({ simulation: simId });
        const enrollmentCount = await this.enrollmentModel.countDocuments({
          simulation: simId,
          status: EnrollmentStatus.ACTIVE,
        });
        return {
          ...sim.toObject(),
          firms: firms.map((f) => ({
            id: f._id,
            firmNumber: f.firmNumber,
            name: f.name,
            color: f.color,
            memberCount: f.members?.length ?? 0,
          })),
          enrollmentCount,
        };
      }),
    );
  }

  async findSimulationsByStudent(studentId: string): Promise<any[]> {
    const enrollments = await this.enrollmentModel
      .find({
        user: this.toObjectId(studentId),
        // Include DROPPED so the student can see what they've been removed from
        // (the frontend renders DROPPED enrollments with an "access removed"
        // state instead of a normal launch button). Without DROPPED here the
        // sim silently disappears from the student's list and they have no
        // way to reach the AccessRevokedScreen.
        status: {
          $in: [
            EnrollmentStatus.ACTIVE,
            EnrollmentStatus.PENDING,
            EnrollmentStatus.DROPPED,
            EnrollmentStatus.COMPLETED,
          ],
        },
      })
      .populate('simulation')
      .populate('firm');

    // Skip enrollments where simulation got deleted (defensive — shouldn't happen
    // because of the cascade delete, but cheap to guard against).
    const activeEnrollments = enrollments.filter((e) => !!e.simulation);
    
    // Fire expiry checks in parallel — most will no-op
    const sims = activeEnrollments
      .map(e => e.simulation as any);
    await Promise.all(
      sims.map((s: SimulationDocument) => this.checkQuarterExpiry(s).catch(() => {})),
    );

    return activeEnrollments
      .map((enrollment) => {
        const firm = enrollment.firm as any;          // null when not yet assigned
        const hasFirmAssignment = !!firm;
        const isBlocked = enrollment.status === EnrollmentStatus.DROPPED;

        return {
          simulation: enrollment.simulation,

          // firm is null when the student has accepted the invite but faculty
          // hasn't placed them in a team yet. Keep the shape consistent so the
          // frontend can render an "awaiting assignment" state without crashing.
          firm: hasFirmAssignment
            ? {
                id: firm._id,
                firmNumber: firm.firmNumber,
                name: firm.name,
                color: firm.color,
              }
            : null,

          enrollment: {
            id: enrollment._id,
            status: enrollment.status,
            role: enrollment.role,
            teamName: enrollment.teamName,
            canSubmitDecisions: enrollment.canSubmitDecisions,
            canViewReports: enrollment.canViewReports,
            canViewCompetitorData: enrollment.canViewCompetitorData,
            decisionsSubmitted: enrollment.decisionsSubmitted,
            // ─── NEW: convenience flag for the frontend ─────────────────────
            // True when the student is enrolled but not yet placed. The
            // student dashboard reads this to show "Waiting for firm
            // assignment" instead of a broken cockpit link.
            awaitingFirmAssignment: !hasFirmAssignment,
            // True when the student has been removed from the sim. Frontend
            // greys out the entry and shows an "Access removed" badge.
            isBlocked,
          },
        };
      });
  }

  // ============================================================================
  // HELPER: RESOLVE FIRM
  // ============================================================================

  private async resolveFirm(
    simulationId: string,
    firmId: string,
  ): Promise<FirmDocument> {
    const simObjectId = this.toObjectId(simulationId);
    let firm: FirmDocument | null = null;

    if (Types.ObjectId.isValid(firmId)) {
      firm = await this.firmModel.findOne({
        _id: this.toObjectId(firmId),
        simulation: simObjectId,
      });
    }

    if (!firm) {
      const firmNumber = parseInt(firmId, 10);
      if (!isNaN(firmNumber)) {
        firm = await this.firmModel.findOne({
          simulation: simObjectId,
          firmNumber,
        });
      }
    }

    if (!firm) {
      throw new NotFoundException(
        `Firm ${firmId} not found in simulation ${simulationId}`,
      );
    }

    return firm;
  }

  // Add this to simulation.service.ts

  async advanceQuarter(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);

    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const firms = await this.firmModel.find({ simulation: simObjectId });

    // Find which firms haven't submitted. We don't block — we carry forward
    // their previous quarter's decisions and auto-seed any newly unlocked
    // modules with sane defaults. Faculty can override this behavior by
    // passing { strict: true } from the controller.
    const submittedFirmIds = await this.decisionModel.distinct('firm', {
      simulation: simObjectId,
      quarter: simulation.currentQuarter,
      status: { $in: [DecisionStatus.SUBMITTED, DecisionStatus.PROCESSED] },
    });
    const submittedSet = new Set(submittedFirmIds.map(id => id.toString()));

    const missingFirms = firms.filter(
      (f: any) => !submittedSet.has((f._id as any).toString()),
    );
    const carryForwardSummary: {
      firmId: string;
      firmNumber: number;
      firmName: string;
      action: 'CARRY_FORWARD' | 'BASELINE' | 'PROMOTED_DRAFT';
      newlyUnlockedModules: string[];
    }[] = [];

    if (missingFirms.length > 0) {
      console.log(
        `[advanceQuarter] Q${simulation.currentQuarter}: ${missingFirms.length}/${firms.length} firms missing — carrying forward`,
      );

      // Which modules newly unlocked this quarter? Used to seed defaults
      // for firms that haven't seen these decisions before.
      const newlyUnlockedModules = (simulation.moduleSchedule?.modules || [])
        .filter(m => m.enabled && m.unlocksAtQuarter === simulation.currentQuarter)
        .map(m => m.moduleId);

      for (const firm of missingFirms) {
        // Detect what action we're about to take, for the audit summary
        const existing = await this.decisionModel.findOne({
          simulation: simObjectId,
          firm: firm._id,
          quarter: simulation.currentQuarter,
        });
        const prev = await this.decisionModel.findOne({
          simulation: simObjectId,
          firm: firm._id,
          quarter: simulation.currentQuarter - 1,
        });

        let action: 'CARRY_FORWARD' | 'BASELINE' | 'PROMOTED_DRAFT';
        if (existing?.status === DecisionStatus.DRAFT) {
          action = 'PROMOTED_DRAFT';
        } else if (prev) {
          action = 'CARRY_FORWARD';
        } else {
          action = 'BASELINE';
        }

        // Reuse existing helper for the heavy lifting
        await this.carryForwardDecision(
          simObjectId,
          (firm as any)._id,
          simulation.currentQuarter,
        );

        // Seed defaults for newly unlocked modules
        if (newlyUnlockedModules.length > 0) {
          await this.seedDefaultsForNewModules(
            simObjectId,
            (firm as any)._id,
            simulation.currentQuarter,
            newlyUnlockedModules,
          );
        }

        carryForwardSummary.push({
          firmId: ((firm as any)._id as any).toString(),
          firmNumber: (firm as any).firmNumber,
          firmName: (firm as any).name,
          action,
          newlyUnlockedModules,
        });
      }
    }

    // Generate demand data for current quarter if it doesn't exist
    let demandData = await this.demandHistoryModel.findOne({
      simulation: simObjectId,
      quarter: simulation.currentQuarter,
    });

    if (!demandData) {
      // Generate demand if not already created
      await this.generateAndRecordDemand(
        simObjectId,
        simulation.currentQuarter,
        simulation.demandVariability || 0.05,
        simulation.features?.seasonality ?? true,
        simulation.seasonality,
      );
      demandData = await this.demandHistoryModel.findOne({
        simulation: simObjectId,
        quarter: simulation.currentQuarter,
      });
    }

    const quarterResults: any[] = [];

    for (const firm of firms) {
      const decision = await this.decisionModel.findOne({
        firm: firm._id,
        quarter: simulation.currentQuarter,
      });

      const prevState = await this.quarterStateModel.findOne({
        firm: firm._id,
        quarter: simulation.currentQuarter - 1,
      });

      if (decision && prevState && demandData) {
        // Mark decision as processed
        decision.status = DecisionStatus.PROCESSED;
        decision.processedAt = new Date();
        await decision.save();

        // Process the quarter
        const result = await this.processQuarter(
          simObjectId,
          firm,
          simulation.currentQuarter,
          prevState,
          decision.toObject(),
          demandData as any,
          simulation.features,
        );

        // Record forecast accuracy for this firm's actual decision
        // This captures whether they used GUT or MODEL forecasting
        const decisionObj = decision.toObject();
        const actualForecast = {
          r1: decisionObj.forecastR1 || 0,
          r2: decisionObj.forecastR2 || 0,
          r3: decisionObj.forecastR3 || 0,
        };

        // ▼ FIX 2: Compute forecastSource based on module-lock state ▼
        const isDsUnlocked = (simulation as any).isModuleUnlocked
          ? (simulation as any).isModuleUnlocked('ds')
          : true;

        const forecastSource: ForecastSource = !isDsUnlocked
          ? ForecastSource.BASELINE
          : decisionObj.forecastMethod === ForecastMethod.MODEL
            ? ForecastSource.MODEL
            : ForecastSource.GUT;

        await this.recordForecastAccuracy(
          simObjectId,
          firm._id as Types.ObjectId,
          simulation.currentQuarter,
          actualForecast,
          {
            demandR1: demandData.demandR1,
            demandR2: demandData.demandR2,
            demandR3: demandData.demandR3,
          },
          decisionObj.forecastMethod || ForecastMethod.GUT,
          forecastSource,
        );
        // ▲ END FIX 2 ▲

        quarterResults.push({
          firmId: firm._id,
          firmNumber: firm.firmNumber,
          result,
        });
      }
    }

    if (quarterResults.length > 0) {
      await this.recordKpiHistory(
        simObjectId,
        firms,
        simulation.currentQuarter,
        quarterResults.map((qr) => qr.result) as QuarterResult[], // Extract the actual results
        true,
      );

      for (const firmResult of quarterResults) {
        await this.generateTenQReport(
          simObjectId,
          firmResult.firmId,
          simulation.currentQuarter,
        );
      }
    }

    // Advance to next quarter
    const previousQuarter = simulation.currentQuarter;
    simulation.currentQuarter += 1;
    const nextQuarter = simulation.currentQuarter;

    // The first advance flips the sim to IN_PROGRESS. Subsequent advances
    // keep it there. The old Q3→Q4 gate was vestigial.
    if (simulation.status === SimulationStatus.INITIALIZED) {
      simulation.status = SimulationStatus.IN_PROGRESS;
    }

    // Create next quarter's initial states for all firms by copying previous quarter's state
    // This ensures inventory is carried forward and students have data to work with
    for (const firm of firms) {
      const prevQuarterState = await this.quarterStateModel.findOne({
        simulation: simObjectId,
        firm: firm._id,
        quarter: previousQuarter,
      });

      if (prevQuarterState) {
        // Check if next quarter state already exists (in case of re-processing)
        const existingNextState = await this.quarterStateModel.findOne({
          simulation: simObjectId,
          firm: firm._id,
          quarter: nextQuarter,
        });

        if (!existingNextState) {
          await this.quarterStateModel.create({
            simulation: simObjectId,
            firm: firm._id,
            quarter: nextQuarter,
            cash: prevQuarterState.cash,
            accountsReceivable: prevQuarterState.accountsReceivable,
            fixedAssets: prevQuarterState.fixedAssets,
            accountsPayable: prevQuarterState.accountsPayable,
            shortTermDebt: prevQuarterState.shortTermDebt,
            longTermDebt: prevQuarterState.longTermDebt,
            rawMaterialUnits: prevQuarterState.rawMaterialUnits,
            finishedGoodsUnits: prevQuarterState.finishedGoodsUnits,
            inTransitUnits: prevQuarterState.inTransitUnits,
            ordersInTransit: prevQuarterState.ordersInTransit,
            capacityUnits: prevQuarterState.capacityUnits,
            csi: prevQuarterState.csi,
            marketShare: prevQuarterState.marketShare,
            cumulativeRevenue: prevQuarterState.cumulativeRevenue,
            cumulativeProfit: prevQuarterState.cumulativeProfit,
            retailerInventory: prevQuarterState.retailerInventory,
            retailerMode: prevQuarterState.retailerMode,
            customersLoyal: prevQuarterState.customersLoyal,
            customersInPlay: prevQuarterState.customersInPlay,
            prevPriceP1: prevQuarterState.prevPriceP1,
            perfectOrder: prevQuarterState.perfectOrder,
            dcCentralOpen: prevQuarterState.dcCentralOpen,
            dcCentralInventory: prevQuarterState.dcCentralInventory,
            dcWestOpen: prevQuarterState.dcWestOpen,
            dcWestInventory: prevQuarterState.dcWestInventory,
            dcTotalOpex: prevQuarterState.dcTotalOpex,
          });
        }
      }
    }

    // Generate demand for the next quarter so it's available for students
    const nextQuarterDemand = await this.demandHistoryModel.findOne({
      simulation: simObjectId,
      quarter: nextQuarter,
    });

    if (!nextQuarterDemand) {
      await this.generateAndRecordDemand(
        simObjectId,
        nextQuarter,
        simulation.demandVariability || 0.05,
        simulation.features?.seasonality ?? true,
        simulation.seasonality,
      );
    }

    // Refresh the submission window on every advance. Edit 1 opens Q1
    // at sim creation; this keeps Q2..Qn aligned with the current
    // quarterDurationDays setting (which an admin may have changed).
    simulation.quarterStartedAt = new Date();
    simulation.quarterEndsAt = new Date(
      simulation.quarterStartedAt.getTime() +
        simulation.quarterDurationDays * 86_400_000,
    );

    await simulation.save();

    return {
      message: `Quarter advanced to ${simulation.currentQuarter}`,
      previousQuarter,
      currentQuarter: simulation.currentQuarter,
      simulationStatus: simulation.status,
      firmCount: firms.length,
      processedResults: quarterResults,
      carryForwardSummary,
      autoSubmittedCount: carryForwardSummary.length,
    };
  }

  // ============================================================================
  // 10-Q REPORT GENERATION (ALIGNED WITH GAS)
  // ============================================================================

  /**
   * Generate 10-Q report for a firm - ALIGNED WITH GAS flexeemaster.gs
   * Pulls data from KPI history, QuarterState, and related records
   */
  private async generateTenQReport(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
  ): Promise<TenQReportDocument | null> {
    try {
      // Get KPI data for this quarter
      const kpiData = await this.kpiHistoryModel.findOne({
        simulation: simulationId,
        firm: firmId,
        quarter,
      });

      if (!kpiData) {
        return null;
      }

      // Get quarter state for balance sheet and inventory data
      const quarterState = await this.quarterStateModel.findOne({
        simulation: simulationId,
        firm: firmId,
        quarter,
      });

      if (!quarterState) {
        return null;
      }

      // Get KPI history for YTD calculations (rolling 4 quarters)
      const startQuarter = Math.max(1, quarter - 3);
      const kpiHistory = await this.kpiHistoryModel.find({
        simulation: simulationId,
        firm: firmId,
        quarter: { $gte: startQuarter, $lte: quarter },
      });

      const C = CONFIG.costs;
      const F = CONFIG.financial;

      // ========================================================================
      // INCOME STATEMENT (directly from KPI or calculated from state)
      // ========================================================================

      const revenue = kpiData.financial?.revenue || 0;
      const cogs = kpiData.financial?.cogs || 0;
      const grossProfit = revenue - cogs;  // dollar value
      const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;  // percentage
      const unitsSold = kpiData.operations?.unitsSold || 0;
      const unitsProduced = kpiData.operations?.unitsProduced || 0;

      // Calculate operating expenses breakdown (matching GAS)
      // GAS calculates these from actual quarterly data
      const holdingCost =
        (quarterState.rawMaterialUnits + quarterState.finishedGoodsUnits) *
        F.HOLDING_COST_PER_UNIT;
      const laborCost = revenue * 0.15; // Estimate from revenue
      const qualityCost = revenue * 0.01; // Fixed 1% of revenue
      const freightCost = unitsSold * 3; // Fixed $3 per unit sold

      // Tech maintenance: DA does not track technology
      const numTech = 0;
      const techMaintenance = 0;

      const marketing = revenue * 0.08; // Estimate marketing budget
      const totalOpex =
        laborCost +
        holdingCost +
        marketing +
        qualityCost +
        freightCost;
      const operatingIncome = grossProfit - totalOpex;

      // Interest expense from actual debt
      const interest =
        ((quarterState.shortTermDebt + quarterState.longTermDebt) *
          F.CREDIT_LINE_RATE) /
        4;

      const netIncome = kpiData.financial?.netIncome || 0;

      // ========================================================================
      // BALANCE SHEET (from QuarterState)
      // ========================================================================

      const cash = quarterState.cash || 0;
      const accountsReceivable = quarterState.accountsReceivable || 0;
      const fixedAssets = quarterState.fixedAssets || 0;
      const accountsPayable = quarterState.accountsPayable || 0;
      const shortTermDebt = quarterState.shortTermDebt || 0;
      const longTermDebt = quarterState.longTermDebt || 0;

      const inventoryValue =
        kpiData.inventory?.inventoryValue ||
        quarterState.rawMaterialUnits * C.RAW_MATERIAL_COST +
          quarterState.finishedGoodsUnits * C.STANDARD_COGS;

      const totalCurrentAssets = cash + accountsReceivable + inventoryValue;
      const totalAssets = totalCurrentAssets + fixedAssets;
      const totalLiabilities = accountsPayable + shortTermDebt + longTermDebt;
      const equity = totalAssets - totalLiabilities;

      // ========================================================================
      // INVENTORY REPORT (matching GAS calculations)
      // ========================================================================

      const rawUnits = quarterState.rawMaterialUnits || 0;
      const fgUnits = quarterState.finishedGoodsUnits || 0;
      const inTransit = quarterState.inTransitUnits || 0;
      const retailerInv = quarterState.retailerInventory || 0;

      const rawValue = rawUnits * C.RAW_MATERIAL_COST;
      const fgValue = fgUnits * C.STANDARD_COGS;

      // Days of supply calculations (based on daily usage - GAS uses 90 days per quarter)
      const dailySales = unitsSold > 0 ? unitsSold / 90 : 0;
      const dailyProduction = unitsProduced > 0 ? unitsProduced / 90 : 0;

      const rawDOS = dailyProduction > 0 ? rawUnits / dailyProduction : 0;
      const fgDOS = dailySales > 0 ? fgUnits / dailySales : 0;

      // Total pipeline
      const totalPipeline = rawUnits + fgUnits + inTransit + retailerInv;

      // Inventory turnover (annualized COGS / inventory value)
      const invTurnover = inventoryValue > 0 ? (cogs * 4) / inventoryValue : 0;

      // Weeks of supply (FG + retailer inventory / weekly sales)
      const weeksOfSupply =
        dailySales > 0 ? (fgUnits + retailerInv) / (dailySales * 7) : 0;

      // ========================================================================
      // CASH FLOW STATEMENT
      // ========================================================================

      // Get previous quarter state for cash change calculation
      const prevQuarterState = await this.quarterStateModel.findOne({
        simulation: simulationId,
        firm: firmId,
        quarter: quarter - 1,
      });

      const prevCash = prevQuarterState?.cash || 0;
      const cashChange = cash - prevCash;

      const cashFromOperations = netIncome + holdingCost * 0.1; // Simple approximation

      // ========================================================================
      // KEY METRICS
      // ========================================================================

      const fillRate = kpiData.customer?.fillRate || 0;
      const csi = kpiData.customer?.csi || 0;
      const marketShare = kpiData.customer?.marketShare || 0;
      const perfectOrder = kpiData.operations?.perfectOrder || 0;
      const forecastAccuracy = 1 - (kpiData.operations?.mape || 0); // Inverse of MAPE
      const mape = kpiData.operations?.mape || 0;

      // Extract PO components from quarter state
      const poComponents = {
        onTime: quarterState.perfectOrder?.onTime || 0,
        inFull: quarterState.perfectOrder?.inFull || 0,
        damageFree: quarterState.perfectOrder?.damageFree || 0,
        documentation: quarterState.perfectOrder?.documentation || 0,
      };

      // ========================================================================
      // YTD TOTALS (matching GAS YTD calculation)
      // ========================================================================

      // Sum cashFromOperations from all quarters (Q1 to current)
      const previousTenQReports = await this.tenqReportModel.find({
        simulation: simulationId,
        firm: firmId,
        quarter: { $lt: quarter },
      });

      const ytdCashFromOperations =
        previousTenQReports.reduce(
          (sum, report) => sum + (report.cashFlow?.cashFromOperations || 0),
          0,
        ) + cashFromOperations;

      const ytdTotals = this.calculateYtdTotals(kpiHistory, ytdCashFromOperations);

      // ========================================================================
      // CREATE 10-Q REPORT DOCUMENT
      // ========================================================================

      const tenqData: Partial<TenQReportDocument> = {
        simulation: simulationId,
        firm: firmId,
        quarter,
        incomeStatement: {
          revenue,
          cogs,
          grossProfit,
          grossMarginPct: revenue > 0 ? ((grossProfit / revenue) * 100) : 0,
          laborCost,
          holdingCost,
          marketing,
          totalOpex,
          operatingIncome,
          interest,
          netIncome,
        },
        balanceSheet: {
          cash,
          accountsReceivable,
          inventoryValue,
          totalCurrentAssets,
          fixedAssets,
          totalAssets,
          accountsPayable,
          shortTermDebt,
          longTermDebt,
          totalLiabilities,
          equity,
        },
        cashFlow: {
          netIncome,
          depreciation: 0,
          workingCapitalChange: 0,
          cashFromOperations,
          capitalExpenditures: 0,
          cashUsedInvesting: 0,
          debtChange: 0,
          dividends: 0,
          cashFromFinancing: 0,
          netCashChange: cashChange,
          beginningCash: prevCash,
          endingCash: cash,
        },
        inventoryReport: {
          rawMaterialUnits: rawUnits,
          rawMaterialValue: rawValue,
          rawDaysOfSupply: Math.round(rawDOS),
          finishedGoodsUnits: fgUnits,
          finishedGoodsValue: fgValue,
          finishedGoodsDaysOfSupply: Math.round(fgDOS),
          inTransitUnits: inTransit,
          retailerInventory: retailerInv,
          totalPipeline,
          totalInventoryValue: inventoryValue,
          inventoryTurnover: parseFloat(invTurnover.toFixed(1)),
          weeksOfSupply: parseFloat(weeksOfSupply.toFixed(1)),
        },
        keyMetrics: {
          unitsProduced,
          unitsSold,
          fillRate,
          csi,
          marketShare,
          perfectOrder,
          forecastAccuracy,
          mape,
          poComponents,
        },
        ytdTotals,
        generatedAt: new Date(),
      };

      // Create and save the 10-Q report
      const report = new this.tenqReportModel(tenqData);
      return await report.save();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error generating 10-Q report for Q${quarter}: ${errorMsg}`);
      return null;
    }
  }

  /**
   * Calculate year-to-date totals from KPI history (4-quarter rolling)
   * Matches GAS YTD calculation logic
   */
  private calculateYtdTotals(history: KpiHistoryDocument[], cashGenerated: number = 0): {
    revenue: number;
    netIncome: number;
    unitsSold: number;
    avgFillRate: number;
    avgCsi: number;
    cashGenerated: number;
  } {
    if (history.length === 0) {
      return {
        revenue: 0,
        netIncome: 0,
        unitsSold: 0,
        avgFillRate: 0,
        avgCsi: 0,
        cashGenerated: 0,
      };
    }

    // Sum all quarters
    const revenue = history.reduce(
      (sum, h) => sum + (h.financial?.revenue || 0),
      0,
    );
    const netIncome = history.reduce(
      (sum, h) => sum + (h.financial?.netIncome || 0),
      0,
    );
    const unitsSold = history.reduce(
      (sum, h) => sum + (h.operations?.unitsSold || 0),
      0,
    );

    // Average metrics (GAS uses averages for these)
    const avgFillRate =
      history.reduce((sum, h) => sum + (h.customer?.fillRate || 0), 0) /
      history.length;
    const avgCsi =
      history.reduce((sum, h) => sum + (h.customer?.csi || 0), 0) /
      history.length;

    return {
      revenue,
      netIncome,
      unitsSold,
      avgFillRate,
      avgCsi,
      cashGenerated,
    };
  }
  private async processCustomerPoolsAndSCRM(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    prevState: QuarterStateDocument,
    decisions: any,
    features: FeatureFlags,
    newCSI: number,
    fillRate: number,
    stockoutUnits: number,
    actualProduction: number,
    newCash: number,
    dcCentralOpen: boolean,
    dcWestOpen: boolean,
  ): Promise<{
    customersLoyal: number;
    customersInPlay: number;
    customersCompetitor: number;
    scrmRiskScore: number;
    scrmRiskLevel: string;
    segmentAllocation: {
      champions: number;
      growth: number;
      atRisk: number;
      other: number;
    } | null;
  }> {
    const M = CUSTOMER_POOLS_CONFIG.market;

    let customersLoyal =
      prevState.customersLoyal ||
      Math.round(
        M.TOTAL_MARKET_SIZE *
          prevState.marketShare *
          CUSTOMER_POOLS_CONFIG.customer.POOLS.LOYAL_PERCENT,
      );
    let customersInPlay =
      prevState.customersInPlay ||
      Math.round(
        M.TOTAL_MARKET_SIZE *
          prevState.marketShare *
          CUSTOMER_POOLS_CONFIG.customer.POOLS.IN_PLAY_PERCENT,
      );
    let customersCompetitor = prevState.customersCompetitor || 0;

    let segmentAllocation: {
      champions: number;
      growth: number;
      atRisk: number;
      other: number;
    } | null = null;
    let scrmRiskScore = 0;
    let scrmRiskLevel = 'LOW';

    if (features.customerChurn) {
      const customerDecisions: SCRMDecisions = {
        priceP1: decisions.priceP1,
        marketingBudget: decisions.marketingBudget,
        segmentChampions: decisions.segmentChampions || 25,
        segmentGrowth: decisions.segmentGrowth || 25,
        segmentAtRisk: decisions.segmentAtRisk || 25,
        segmentOther: decisions.segmentOther || 25,
      };

      const isPriceLeader = false; // TODO: Compare with other firms
      const isCsiLeader = false; // TODO: Compare with other firms

      const customerResult: CustomerPoolsResult = processCustomerPools(
        M.TOTAL_MARKET_SIZE,
        prevState.marketShare,
        customersLoyal,
        customersInPlay,
        customersCompetitor,
        prevState.prevPriceP1,
        customerDecisions,
        fillRate,
        stockoutUnits,
        newCSI,
        isPriceLeader,
        isCsiLeader,
      );

      customersLoyal = customerResult.loyalCustomers;
      customersInPlay = customerResult.inPlayCustomers;
      customersCompetitor = customerResult.competitorCustomers;

      if (features.analyticsMode) {
        segmentAllocation = {
          champions: (decisions.segmentChampions || 25) / 100,
          growth: (decisions.segmentGrowth || 25) / 100,
          atRisk: (decisions.segmentAtRisk || 25) / 100,
          other: (decisions.segmentOther || 25) / 100,
        };
      }

      // Get actual MAPE from forecast history
      let demandMape = 0.15;
      const recentForecasts = await this.forecastLogModel
        .find({ simulation: simulationId, firm: firmId })
        .sort({ quarter: -1 })
        .limit(4)
        .exec();

      if (recentForecasts.length > 0) {
        const mapeSum = recentForecasts.reduce(
          (sum, f) => sum + (f.mape || 0),
          0,
        );
        demandMape = mapeSum / recentForecasts.length;
      }

      // Calculate perfectOrder % from fill rate and other factors
      // Perfect Order = On-Time * In-Full * Damage-Free * Documentation
      const perfectOrderPercent = fillRate * 0.96; // Approximate: fill rate is primary driver

      // SCRM calculation uses ALL data from QuarterState, NOT decisions
      // GAS lines 2176-2384
      // Estimate quarterly revenue from market size and average price
      const estimatedTotalRevenue = CONFIG.market.TOTAL_MARKET_SIZE * 333; // 600k units * $333 avg price ≈ $200M

      const inventoryValue =
        prevState.rawMaterialUnits * CONFIG.costs.RAW_MATERIAL_COST +
        prevState.finishedGoodsUnits * CONFIG.costs.STANDARD_COGS;

      // Calculate SCRM with all 5 risk categories as per GAS
      const scrmResult: SCRMRiskResult = calculateSCRMRiskAssessment(
        // Category 1: Supplier Concentration (25%)
        decisions.orderGlobal || 0,
        decisions.orderRegional || 0,

        // Category 2: Inventory Buffer (20%)
        prevState.rawMaterialUnits,
        prevState.finishedGoodsUnits,
        estimatedTotalRevenue,

        // Category 3: Demand Volatility (15%)
        demandMape,
        quarter,

        // Category 4: Financial Health (15%)
        newCash,
        prevState.shortTermDebt,
        prevState.longTermDebt,
        prevState.accountsReceivable,
        prevState.fixedAssets,
        inventoryValue,

        // Category 5: Operational (25%)
        actualProduction,
        perfectOrderPercent,
        prevState.ordersInTransit,

        // Context
        dcCentralOpen,
        dcWestOpen,
      );

      scrmRiskScore = scrmResult.totalScore;
      scrmRiskLevel = scrmResult.level.level;

      // Persist SCRM history
      await this.scrmHistoryModel.create({
        simulation: simulationId,
        firm: firmId,
        quarter,
        totalRiskScore: scrmResult.totalScore,
        riskLevel: scrmResult.level.level,
        riskColor: scrmResult.level.color,
        riskDescription: scrmResult.level.description,
        breakdown: scrmResult.breakdown,
        details: scrmResult.details,
        customersLoyal,
        customersInPlay,
        customersCompetitor,
        customerMovements: {
          churnedToCompetitor: customerResult.churnedToCompetitor,
          degradedFromLoyal: customerResult.degradedFromLoyal,
          wonBackFromCompetitor: customerResult.wonBackFromCompetitor,
          newEntrants: customerResult.newEntrants,
          growthConverted: customerResult.growthConverted,
          atRiskSaved: customerResult.atRiskSaved,
        },
        inputs: scrmResult.inputs,
        recommendations: scrmResult.recommendations,
      });
    }

    return {
      customersLoyal,
      customersInPlay,
      customersCompetitor,
      scrmRiskScore,
      scrmRiskLevel,
      segmentAllocation,
    };
  }

  /**
   * Get SCRM data for a specific simulation and quarter
   * Returns risk assessment and customer metrics for all firms
   */
  async getSCRMDataByQuarter(
    simulationId: string,
    quarterNumber: number,
  ): Promise<any> {
    const simulation = await this.simulationModel.findById(simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    if (quarterNumber < 1 || quarterNumber > simulation.currentQuarter) {
      throw new BadRequestException(
        `Invalid quarter. Simulation is currently at Q${simulation.currentQuarter}`,
      );
    }

    // Get SCRM history for all firms in this simulation for the specified quarter
    const scrmData = await this.scrmHistoryModel
      .find({
        simulation: new Types.ObjectId(simulationId),
        quarter: quarterNumber,
      })
      .populate('firm', 'firmNumber firmName')
      .sort({ firmNumber: 1 })
      .exec();

    if (!scrmData || scrmData.length === 0) {
      throw new NotFoundException(
        `No SCRM data found for Q${quarterNumber} in this simulation`,
      );
    }

    return {
      simulation: {
        id: simulation._id,
        name: simulation.name,
      },
      quarter: quarterNumber,
      timestamp: new Date(),
      firms: scrmData.map((history: any) => ({
        firm: {
          id: history.firm._id,
          name: history.firm.firmName,
          number: history.firm.firmNumber,
        },
        riskAssessment: {
          totalRiskScore: history.totalRiskScore,
          riskLevel: history.riskLevel,
          riskColor: history.riskColor,
          riskDescription: history.riskDescription,
        },
        breakdown: history.breakdown,
        customerMetrics: {
          loyal: history.customersLoyal,
          inPlay: history.customersInPlay,
          competitor: history.customersCompetitor,
        },
        customerMovements: history.customerMovements,
        segmentAllocation: history.segmentAllocation,
        retentionMetrics: {
          retentionBonus: history.retentionBonus,
          csiImpact: history.csiImpact,
        },
        inputs: history.inputs,
        recommendations: history.recommendations,
        createdAt: history.createdAt,
      })),
    };
  }

  /**
   * Get SCRM data for a specific firm across all quarters
   */
  async getSCRMHistoryByFirm(
    simulationId: string,
    firmId: string,
  ): Promise<any> {
    const simulation = await this.simulationModel.findById(simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    // Resolve firm ID if numeric firmNumber is provided
    let resolvedFirmId = firmId;
    if (!Types.ObjectId.isValid(firmId)) {
      const firm = await this.firmModel.findOne({
        simulation: new Types.ObjectId(simulationId),
        firmNumber: parseInt(firmId, 10),
      });
      if (!firm) {
        throw new NotFoundException('Firm not found');
      }
      resolvedFirmId = (firm._id as Types.ObjectId).toString();
    }

    // Get SCRM history for this firm across all quarters
    const scrmHistory = await this.scrmHistoryModel
      .find({
        simulation: new Types.ObjectId(simulationId),
        firm: new Types.ObjectId(resolvedFirmId),
      })
      .sort({ quarter: 1 })
      .exec();

    if (!scrmHistory || scrmHistory.length === 0) {
      throw new NotFoundException('No SCRM history found for this firm');
    }

    const firm = scrmHistory[0];

    return {
      simulation: {
        id: simulation._id,
        name: simulation.name,
      },
      firm: {
        id: firm.firm,
        name: (scrmHistory[0] as any).firm?.firmName || 'Unknown',
      },
      quarters: scrmHistory.map((history: any) => ({
        quarter: history.quarter,
        riskAssessment: {
          totalRiskScore: history.totalRiskScore,
          riskLevel: history.riskLevel,
          riskColor: history.riskColor,
          riskDescription: history.riskDescription,
        },
        breakdown: history.breakdown,
        customerMetrics: {
          loyal: history.customersLoyal,
          inPlay: history.customersInPlay,
          competitor: history.customersCompetitor,
        },
        customerMovements: history.customerMovements,
        segmentAllocation: history.segmentAllocation,
        retentionMetrics: {
          retentionBonus: history.retentionBonus,
          csiImpact: history.csiImpact,
        },
        recommendations: history.recommendations,
        createdAt: history.createdAt,
      })),
    };
  }

  // ============================================================================
  // NEW: MARKET EXPANSION PROCESSOR (R4-R6)
  // ============================================================================

  private processMarketExpansion(
    decisions: any,
    prevState: any,
    quarter: number,
  ): {
    r4Active: boolean;
    r5Active: boolean;
    r6Active: boolean;
    r4EntryQuarter: number | null;
    r5EntryQuarter: number | null;
    r6EntryQuarter: number | null;
    totalCost: number;
    demand: { r4: number; r5: number; r6: number };
  } {
    const EXP = CONFIG.market.EXPANSION_REGIONS;
    let totalCost = 0;
    const demand = { r4: 0, r5: 0, r6: 0 };

    // R4 (Canada)
    let r4Active = prevState.r4Active || false;
    let r4EntryQuarter = prevState.r4EntryQuarter || null;
    if (decisions.enterR4 && !r4Active) {
      r4Active = true;
      r4EntryQuarter = quarter;
      totalCost += EXP[4].entryCost;
    }
    if (r4Active) {
      totalCost += EXP[4].ongoingCost;
      const quartersActive = quarter - (r4EntryQuarter || quarter);
      const rampUp = Math.min(
        1,
        quartersActive / CONFIG.market.EXPANSION_RAMP_UP_QUARTERS,
      );
      demand.r4 = Math.round(EXP[4].marketSize * rampUp * EXP[4].culturalFit);
    }

    // R5 (EU)
    let r5Active = prevState.r5Active || false;
    let r5EntryQuarter = prevState.r5EntryQuarter || null;
    if (decisions.enterR5 && !r5Active) {
      r5Active = true;
      r5EntryQuarter = quarter;
      totalCost += EXP[5].entryCost;
    }
    if (r5Active) {
      totalCost += EXP[5].ongoingCost;
      const quartersActive = quarter - (r5EntryQuarter || quarter);
      const rampUp = Math.min(
        1,
        quartersActive / CONFIG.market.EXPANSION_RAMP_UP_QUARTERS,
      );
      // Check for regulatory delay
      if (Math.random() < EXP[5].regulatoryRisk) {
        demand.r5 = 0; // Regulatory delay this quarter
      } else {
        demand.r5 = Math.round(EXP[5].marketSize * rampUp * EXP[5].culturalFit);
      }
    }

    // R6 (APAC)
    let r6Active = prevState.r6Active || false;
    let r6EntryQuarter = prevState.r6EntryQuarter || null;
    if (decisions.enterR6 && !r6Active) {
      r6Active = true;
      r6EntryQuarter = quarter;
      totalCost += EXP[6].entryCost;
    }
    if (r6Active) {
      totalCost += EXP[6].ongoingCost;
      const quartersActive = quarter - (r6EntryQuarter || quarter);
      const rampUp = Math.min(
        1,
        quartersActive / CONFIG.market.EXPANSION_RAMP_UP_QUARTERS,
      );
      if (Math.random() < EXP[6].regulatoryRisk) {
        demand.r6 = 0;
      } else {
        demand.r6 = Math.round(EXP[6].marketSize * rampUp * EXP[6].culturalFit);
      }
    }

    return {
      r4Active,
      r5Active,
      r6Active,
      r4EntryQuarter,
      r5EntryQuarter,
      r6EntryQuarter,
      totalCost,
      demand,
    };
  }

  // ============================================================================
  // NEW: DISPOSAL AND GREEN SCORE PROCESSOR
  // ============================================================================

  private processDisposalAndGreenScore(
    unitsToDispose: number,
    ecoPackaging: boolean,
    unitsSold: number,
    currentGreenScore: number,
  ): {
    disposalCost: number;
    disposalRecovery: number;
    ecoPackagingCost: number;
    newGreenScore: number;
  } {
    // DA: Disposal and green score not tracked
    return {
      disposalCost: 0,
      disposalRecovery: 0,
      ecoPackagingCost: 0,
      newGreenScore: currentGreenScore,
    };
  }

  // ============================================================================
  // NEW: TECHNOLOGY PURCHASES PROCESSOR
  // ============================================================================

  private processTechnologyPurchases(
    techPurchases: Record<string, boolean>,
    currentTech: string[],
    availableCash: number,
  ): {
    maintenanceCost: number;
    newTech: string[];
    purchaseCost: number;
  } {
    const TECH = CONFIG.technology.SYSTEMS;

    // Mapping from frontend camelCase to backend SNAKE_CASE
    const techKeyToType: Record<string, string> = {
      erp: 'ERP',
      controlTower: 'CONTROL_TOWER',
      aps: 'APS',
      demandSensing: 'DEMAND_SENSING',
      wms: 'WMS',
      tms: 'TMS',
      oms: 'OMS',
      analytics: 'ANALYTICS',
    };

    let maintenanceCost = 0;
    const newTech: string[] = [];
    let purchaseCost = 0;

    // Calculate maintenance for existing tech
    for (const tech of currentTech) {
      const techConfig = TECH[tech];
      if (techConfig) {
        maintenanceCost +=
          (techConfig.cost * CONFIG.technology.MAINTENANCE_RATE) / 4;
      }
    }

    // Process new purchases
    for (const [techKey, purchased] of Object.entries(techPurchases)) {
      const techType = techKeyToType[techKey]; // Convert camelCase to SNAKE_CASE
      if (!techType) continue; // Unknown tech key

      if (purchased && !currentTech.includes(techType)) {
        const techConfig = TECH[techType];
        if (techConfig && availableCash - purchaseCost >= techConfig.cost) {
          newTech.push(techType); // Now correctly adds 'CONTROL_TOWER' instead of 'CONTROLTOWER'
          purchaseCost += techConfig.cost;
          maintenanceCost +=
            (techConfig.cost * CONFIG.technology.MAINTENANCE_RATE) / 4;
        }
      }
    }

    return { maintenanceCost, newTech, purchaseCost };
  }

  // ============================================================================
  // NEW: INTELLIGENCE CENTER PROCESSOR
  // ============================================================================

  private async processIntelligenceCenter(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    subscriptions: Record<string, boolean>,
    firmState: any,
    demandData: any,
  ): Promise<{ totalCost: number }> {
    // DA: Intelligence Center feature not supported
    return { totalCost: 0 };
  }

  // ============================================================================
  // INTELLIGENCE REPORT GENERATORS (NOT USED IN DA)
  // ============================================================================

  /**
   * Market Trends Report (Free)
   * Shows seasonal outlook and demand direction
   */
  private generateMarketTrendsReport(
    quarter: number,
    calendarQuarter: number,
    nextCalendarQuarter: number,
    seasonNames: Record<number, string>,
    lastQuarterDemand: number,
  ): any {
    let trend = 'STABLE';
    let trendLabel = 'Stable';
    if (nextCalendarQuarter === 4) {
      trend = 'INCREASING';
      trendLabel = 'Increasing (Holiday)';
    }
    if (nextCalendarQuarter === 1) {
      trend = 'DECREASING';
      trendLabel = 'Decreasing (Post-Holiday)';
    }

    return {
      currentSeason: seasonNames[calendarQuarter],
      nextQuarterSeason: seasonNames[nextCalendarQuarter],
      trend,
      trendLabel,
      lastQuarterDemandUnits: Math.round(lastQuarterDemand),
      lastQuarterDemandK: Math.round(lastQuarterDemand / 1000),
      seasonalPattern: {
        Q4_Holiday: '+25% demand surge',
        Q1_PostHoliday: '-15% slowdown',
        Q2_Q3: 'Baseline demand',
      },
      lines: [
        `Current Season: ${seasonNames[calendarQuarter]}`,
        `Next Quarter: ${seasonNames[nextCalendarQuarter]}`,
        `Trend: ${trendLabel}`,
        '',
        `Last Quarter Demand: ${Math.round(lastQuarterDemand / 1000)}K units`,
        '',
        'Seasonal Pattern:',
        'Q4 Holiday: +25% demand surge',
        'Q1 Post-Holiday: -15% slowdown',
        'Q2-Q3: Baseline demand',
      ],
    };
  }

  /**
   * Competitor Pricing Report (Free - Last Quarter)
   * Shows all firms' P1/P2 prices with market averages and undercut alerts
   */
  private generateCompetitorPricingReport(
    allFirmStates: Record<number, any>,
    firmNumber: number,
  ): any {
    const firms: any[] = [];
    let totalP1 = 0;
    let totalP2 = 0;
    let count = 0;

    for (const [fNum, state] of Object.entries(allFirmStates)) {
      const fn = Number(fNum);
      const p1 = state.priceP1 || 500;
      const p2 = state.priceP2 || 850;
      totalP1 += p1;
      totalP2 += p2;
      count++;
      firms.push({
        firmNumber: fn,
        isYou: fn === firmNumber,
        priceP1: p1,
        priceP2: p2,
      });
    }

    const avgP1 = count > 0 ? Math.round(totalP1 / count) : 500;
    const avgP2 = count > 0 ? Math.round(totalP2 / count) : 850;

    // Detect undercutting
    const myP1 = allFirmStates[firmNumber]?.priceP1 || 500;
    let undercutAlert: any = null;
    for (const [fNum, state] of Object.entries(allFirmStates)) {
      const fn = Number(fNum);
      if (fn === firmNumber) continue;
      if ((state.priceP1 || 500) < myP1) {
        if (!undercutAlert || state.priceP1 < undercutAlert.price) {
          undercutAlert = {
            firmNumber: fn,
            price: state.priceP1,
          };
        }
      }
    }

    // Build display lines (matching GAS format)
    const lines: string[] = ['         P1 Price    P2 Price'];
    for (const f of firms) {
      const marker = f.isYou ? ' (You)' : '';
      lines.push(
        `Firm ${f.firmNumber}${marker}:  $${f.priceP1}        $${f.priceP2}`,
      );
    }
    lines.push('');
    lines.push(`Market Avg:  $${avgP1}        $${avgP2}`);
    if (undercutAlert) {
      lines.push('');
      lines.push(
        `WARNING: Firm ${undercutAlert.firmNumber} is undercutting at $${undercutAlert.price}`,
      );
    }

    return {
      firms,
      marketAverage: { p1: avgP1, p2: avgP2 },
      undercutAlert,
      lines,
    };
  }

  /**
   * Regional Demand Analysis ($50K)
   * R1/R2/R3 demand breakdown with growth rates and regional characteristics
   */
  private generateRegionalDemandReport(demandData: any): any {
    const M = CONFIG.market;
    const totalDemand = demandData.totalDemand || 0;
    const r1Demand =
      demandData.demandR1 || Math.round(totalDemand * M.REGIONS[1].marketShare);
    const r2Demand =
      demandData.demandR2 || Math.round(totalDemand * M.REGIONS[2].marketShare);
    const r3Demand =
      demandData.demandR3 || Math.round(totalDemand * M.REGIONS[3].marketShare);

    return {
      regions: {
        R1: {
          name: 'East',
          demand: r1Demand,
          demandK: Math.round(r1Demand / 1000),
          share: '40%',
          growthRate: `${(M.REGIONS[1].growthRate * 100).toFixed(0)}%`,
          characteristic: 'Balanced preferences',
        },
        R2: {
          name: 'Central',
          demand: r2Demand,
          demandK: Math.round(r2Demand / 1000),
          share: '35%',
          growthRate: `${(M.REGIONS[2].growthRate * 100).toFixed(0)}%`,
          characteristic: 'Price-sensitive (45% weight)',
        },
        R3: {
          name: 'West',
          demand: r3Demand,
          demandK: Math.round(r3Demand / 1000),
          share: '25%',
          growthRate: `${(M.REGIONS[3].growthRate * 100).toFixed(0)}%`,
          characteristic: 'Service-sensitive (40% quality weight)',
        },
      },
      tips: [
        'R2 responds strongly to price cuts',
        'R3 values quality and on-time delivery',
      ],
      lines: [
        'Region      Demand    Share    Growth',
        `R1 East     ${Math.round(r1Demand / 1000)}K       40%      ${(M.REGIONS[1].growthRate * 100).toFixed(0)}%`,
        `R2 Central  ${Math.round(r2Demand / 1000)}K       35%      ${(M.REGIONS[2].growthRate * 100).toFixed(0)}%`,
        `R3 West     ${Math.round(r3Demand / 1000)}K       25%      ${(M.REGIONS[3].growthRate * 100).toFixed(0)}%`,
        '',
        'Regional Characteristics:',
        'R1 East: Balanced preferences',
        'R2 Central: Price-sensitive (45% weight)',
        'R3 West: Service-sensitive (40% quality weight)',
        '',
        'TIP: R2 responds strongly to price cuts',
        'TIP: R3 values quality and on-time delivery',
      ],
    };
  }

  /**
   * Retail Channel Intelligence ($50K)
   * Retailer inventory, coverage months, and mode for all firms with alerts
   */
  private generateRetailChannelReport(
    allFirmStates: Record<number, any>,
    firmNumber: number,
    totalDemand: number,
  ): any {
    const firms: any[] = [];
    const alerts: any[] = [];

    for (const [fNum, state] of Object.entries(allFirmStates)) {
      const fn = Number(fNum);
      const retailInv = state.retailerInventory || 0;
      const retailMode = state.retailerMode || 'NORMAL';
      // Estimate coverage (assuming ~60K/quarter retail sales per firm)
      const estimatedMonthlySales = 20000;
      const coverage =
        estimatedMonthlySales > 0
          ? (retailInv / estimatedMonthlySales).toFixed(1)
          : '0.0';

      firms.push({
        firmNumber: fn,
        isYou: fn === firmNumber,
        retailerInventory: retailInv,
        retailerInventoryK: Math.round(retailInv / 1000),
        coverageMonths: parseFloat(coverage),
        retailerMode: retailMode,
      });

      // Competitor alerts
      if (fn !== firmNumber) {
        if (retailMode === 'PANIC') {
          alerts.push({
            firmNumber: fn,
            type: 'PANIC',
            message: `Firm ${fn} retailer panic ordering! Expect demand spike from their channel`,
          });
        }
        if (retailMode === 'CLEARANCE') {
          alerts.push({
            firmNumber: fn,
            type: 'CLEARANCE',
            message: `Firm ${fn} in clearance mode. Price competition may increase`,
          });
        }
      }
    }

    // Build display lines
    const lines: string[] = ['         Retail Inv  Coverage  Mode'];
    for (const f of firms) {
      const marker = f.isYou ? ' (You)' : '';
      const modeIcon =
        f.retailerMode === 'PANIC'
          ? ' WARNING'
          : f.retailerMode === 'CLEARANCE'
            ? ' DECLINING'
            : '';
      lines.push(
        `Firm ${f.firmNumber}${marker}:  ${f.retailerInventoryK}K       ${f.coverageMonths} mo   ${f.retailerMode}${modeIcon}`,
      );
    }
    lines.push('');
    lines.push('Channel Health Indicators:');
    lines.push('Target Coverage: 2.5 months');
    lines.push('PANIC Mode: < 1.0 mo (expect large orders)');
    lines.push('CLEARANCE: > 4.0 mo (discounting hurts brand)');

    for (const alert of alerts) {
      lines.push('');
      lines.push(`${alert.type}: ${alert.message}`);
    }

    return {
      firms,
      alerts,
      healthIndicators: {
        targetCoverage: 2.5,
        panicThreshold: 1.0,
        clearanceThreshold: 4.0,
      },
      lines,
    };
  }

  /**
   * Competitor Capacity Intel ($100K)
   * Base capacity, expansions, utilization, and expansion alerts
   */
  private generateCompetitorCapacityReport(
    allFirmStates: Record<number, any>,
    firmNumber: number,
  ): any {
    const firms: any[] = [];
    const expansionAlerts: any[] = [];
    const baseCapacity = 250000;

    for (const [fNum, state] of Object.entries(allFirmStates)) {
      const fn = Number(fNum);
      const addlCapacity = state.additionalCapacity || 0;
      const totalCapacity =
        (state.capacityUnits || baseCapacity) + addlCapacity;
      const production = state.unitsProduced || 0;
      const utilization =
        totalCapacity > 0 ? Math.round((production / totalCapacity) * 100) : 0;

      firms.push({
        firmNumber: fn,
        isYou: fn === firmNumber,
        baseCapacity: state.capacityUnits || baseCapacity,
        baseCapacityK: Math.round((state.capacityUnits || baseCapacity) / 1000),
        additionalCapacity: addlCapacity,
        additionalCapacityK: Math.round(addlCapacity / 1000),
        totalCapacity,
        totalCapacityK: Math.round(totalCapacity / 1000),
        utilization,
      });

      // Expansion alerts for competitors
      if (fn !== firmNumber) {
        const linesUnderConstruction = (state.expansionInProgress || []).length;
        if (linesUnderConstruction > 0) {
          expansionAlerts.push({
            firmNumber: fn,
            linesUnderConstruction,
            message: `Firm ${fn}: ${linesUnderConstruction} line(s) under construction`,
          });
        }
      }
    }

    // Build display lines
    const lines: string[] = ['         Base     Expansion  Total    Util%'];
    for (const f of firms) {
      const marker = f.isYou ? ' (You)' : '';
      lines.push(
        `Firm ${f.firmNumber}${marker}:  ${f.baseCapacityK}K    +${f.additionalCapacityK}K       ${f.totalCapacityK}K     ${f.utilization}%`,
      );
    }
    lines.push('');
    lines.push('Expansion Status:');
    if (expansionAlerts.length > 0) {
      for (const alert of expansionAlerts) {
        lines.push(`WARNING: ${alert.message}`);
      }
    } else {
      lines.push('No competitor expansions detected');
    }
    lines.push('');
    lines.push('Capacity Investment Options:');
    lines.push('Small Line: $8M, +50K (1 quarter)');
    lines.push('Medium Line: $15M, +100K (2 quarters)');
    lines.push('Large Line: $25M, +200K (3 quarters)');

    return {
      firms,
      expansionAlerts,
      investmentOptions: {
        small: { cost: 8000000, capacity: 50000, buildTime: 1 },
        medium: { cost: 15000000, capacity: 100000, buildTime: 2 },
        large: { cost: 25000000, capacity: 200000, buildTime: 3 },
      },
      lines,
    };
  }

  /**
   * Supplier Risk Monitor ($75K)
   * Risk assessment based on active events and seasonal patterns
   */
  private generateSupplierRiskReport(
    quarter: number,
    calendarQuarter: number,
    activeEventTypes: string[],
  ): any {
    let riskLevel = 'LOW';
    let riskIcon = 'GREEN';
    const riskDetails: string[] = [];
    const mitigationStrategies: string[] = [];

    // Check for supply-related events
    const hasSupplyEvent = activeEventTypes.some(
      (t) =>
        t.includes('SUPPLY') ||
        t.includes('PARTS_DELAYED') ||
        t.includes('DISRUPTION'),
    );

    if (hasSupplyEvent) {
      riskLevel = 'HIGH';
      riskIcon = 'RED';
      riskDetails.push('Supply disruption detected!');
      riskDetails.push('Recommend: Increase safety stock');
      riskDetails.push('Recommend: Use regional supplier backup');
    } else if (calendarQuarter === 4) {
      riskLevel = 'ELEVATED';
      riskIcon = 'YELLOW';
      riskDetails.push('Holiday season capacity constraints');
      riskDetails.push('Port congestion typical this period');
    } else {
      riskDetails.push('No immediate supply risks detected');
      riskDetails.push('Global supplier lead times normal');
    }

    mitigationStrategies.push('Maintain 2-week safety stock');
    mitigationStrategies.push('Regional supplier for urgent needs');
    mitigationStrategies.push('Monitor this report quarterly');

    const lines: string[] = [
      `Risk Level: ${riskLevel} (${riskIcon})`,
      '',
      'Current Conditions:',
      ...riskDetails,
      '',
      'Supplier Comparison:',
      'Global: $100/unit, 1 quarter lead time',
      'Regional: $115/unit, same quarter delivery',
      '',
      'Mitigation Strategies:',
      ...mitigationStrategies.map((s) => `- ${s}`),
    ];

    return {
      riskLevel,
      riskIcon,
      conditions: riskDetails,
      supplierComparison: {
        global: { costPerUnit: 100, leadTime: '1 quarter' },
        regional: { costPerUnit: 115, leadTime: 'Same quarter' },
      },
      mitigationStrategies,
      lines,
    };
  }

  /**
   * Customer Sentiment Tracker ($75K)
   * CSI trends, churn data, and customer pool breakdown across all firms
   */
  private generateCustomerSentimentReport(
    allFirmStates: Record<number, any>,
    firmNumber: number,
  ): any {
    const firms: any[] = [];

    for (const [fNum, state] of Object.entries(allFirmStates)) {
      const fn = Number(fNum);
      const csi = (state.csi || 80).toFixed(1);
      const churn = state.customersChurned || 0;

      let trend = 'STABLE';
      let trendIcon = 'FLAT';
      let status = 'Stable';
      if (parseFloat(csi) > 85) {
        trend = 'UP';
        trendIcon = 'UP';
        status = 'Strong';
      }
      if (parseFloat(csi) < 75) {
        trend = 'DOWN';
        trendIcon = 'DOWN';
        status = 'At Risk';
      }

      firms.push({
        firmNumber: fn,
        isYou: fn === firmNumber,
        csi: parseFloat(csi),
        trend,
        trendIcon,
        status,
        churnedK: Math.round(churn / 1000),
      });
    }

    // Own firm customer pool breakdown
    const myState = allFirmStates[firmNumber];
    const customerPool = myState
      ? {
          loyalCustomers: myState.customersLoyal || 0,
          loyalCustomersK: Math.round((myState.customersLoyal || 0) / 1000),
          atRiskPool: myState.customersInPlay || 0,
          atRiskPoolK: Math.round((myState.customersInPlay || 0) / 1000),
        }
      : {
          loyalCustomers: 0,
          loyalCustomersK: 0,
          atRiskPool: 0,
          atRiskPoolK: 0,
        };

    const csiDrivers = [
      'Fill rate (availability)',
      'Price competitiveness',
      'Warranty program tier',
      'Green Score',
    ];

    // Build display lines
    const lines: string[] = ['         CSI     Trend    Churn    Status'];
    for (const f of firms) {
      const marker = f.isYou ? ' (You)' : '';
      lines.push(
        `Firm ${f.firmNumber}${marker}:  ${f.csi}    ${f.trendIcon}        ${f.churnedK}K       ${f.status}`,
      );
    }
    lines.push('');
    lines.push('Customer Pool (Your Firm):');
    lines.push(`Loyal Customers: ${customerPool.loyalCustomersK}K`);
    lines.push(`At-Risk Pool: ${customerPool.atRiskPoolK}K`);
    lines.push('');
    lines.push('CSI Drivers:');
    for (const driver of csiDrivers) {
      lines.push(`- ${driver}`);
    }

    return {
      firms,
      customerPool,
      csiDrivers,
      lines,
    };
  }

  // ============================================================================
  // NEW: RANDOM EVENTS PROCESSOR
  // ============================================================================

  private async processRandomEvents(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    prevState: any,
    techOwned: string[] = [],
  ): Promise<{
    costIncrease: number;
    demandModifier: number;
    partsDelayed: number;
    eventImpacts: any[];
  }> {
    let costIncrease = 0;
    let demandModifier = 1.0;
    let partsDelayed = 0;
    const eventImpacts: any[] = [];

    // Check if firm has Control Tower for mitigation
    const hasControlTower = techOwned.includes('CONTROL_TOWER');
    const mitigationRate = hasControlTower ? 0.1 : 0; // 10% reduction with Control Tower

    const activeEvents = await this.eventModel.find({
      simulation: simulationId,
      isActive: true,
      startQuarter: { $lte: quarter },
    });

    for (const event of activeEvents) {
      const eventEndQuarter = event.startQuarter + event.duration;

      // Skip if this firm is not affected (when affectedFirms is specified)
      if (
        event.affectedFirms &&
        event.affectedFirms.length > 0 &&
        !event.affectedFirms.some((f) => f.equals(firmId))
      ) {
        continue;
      }

      // Calculate effective magnitude after mitigation
      const rawMagnitude = event.magnitude;
      const effectiveMagnitude = rawMagnitude * (1 - mitigationRate);

      // Build impact record
      const impactRecord: any = {
        event: event._id,
        simulation: simulationId,
        firm: firmId,
        quarter,
        eventType: event.type,
        eventEffect: event.effect,
        source: event.source,
        triggeredBy: event.triggeredBy,
        rawMagnitude,
        mitigationApplied: mitigationRate,
        hasControlTower,
        effectiveMagnitude,
        impacts: {},
        firmContext: {
          cashBefore: prevState.cash,
          inventoryBefore: prevState.finishedGoodsUnits,
          marketShareBefore: prevState.marketShare,
          csiBefore: prevState.csi,
          ordersInTransit: prevState.ordersInTransit,
        },
        revenueImpact: 0,
        costImpact: 0,
        netImpact: 0,
      };

      // Apply event effects
      switch (event.effect) {
        case 'PARTS_DELAYED':
          const delayedUnits = Math.round(
            prevState.ordersInTransit * effectiveMagnitude,
          );
          partsDelayed += delayedUnits;
          impactRecord.impacts = {
            partsDelayed: delayedUnits,
            ordersAffected: prevState.ordersInTransit,
          };
          break;

        case 'DEMAND_SPIKE':
          const spikeModifier = 1 + effectiveMagnitude;
          demandModifier *= spikeModifier;
          impactRecord.impacts = {
            demandModifier: spikeModifier,
            demandChangePercent: effectiveMagnitude * 100,
          };
          break;

        case 'DEMAND_DROP':
          const dropModifier = 1 - effectiveMagnitude;
          demandModifier *= dropModifier;
          impactRecord.impacts = {
            demandModifier: dropModifier,
            demandChangePercent: -effectiveMagnitude * 100,
          };
          break;

        case 'COST_INCREASE':
          costIncrease += effectiveMagnitude;
          const estimatedProduction = prevState.capacityUnits * 0.8;
          // Cost impact: production * parts per unit * unit cost * magnitudeo
          const additionalCost =
            estimatedProduction *
            CONFIG.production.PARTS_PER_UNIT *
            SUPPLIER_CONFIG[SupplierType.GLOBAL].unitCost *
            effectiveMagnitude;
          impactRecord.impacts = {
            costIncreasePercent: effectiveMagnitude * 100,
            additionalCost,
          };
          impactRecord.costImpact = additionalCost;
          impactRecord.netImpact = -additionalCost;
          break;

        case 'STEAL_INPLAY':
          impactRecord.impacts = {
            marketShareChange: effectiveMagnitude * 100,
          };
          break;
      }

      eventImpacts.push(impactRecord);

      // Deactivate event if duration is complete
      if (quarter >= eventEndQuarter) {
        event.isActive = false;
        await event.save();
      }
    }

    // Persist all event impacts
    if (eventImpacts.length > 0) {
      await this.eventImpactModel.insertMany(eventImpacts);
    }

    return { costIncrease, demandModifier, partsDelayed, eventImpacts };
  }

  // ============================================================================
  // EVENT IMPACT TRACKING - Faculty Dashboard Methods
  // ============================================================================

  /**
   * Get all event impacts for a simulation with optional filters
   */
  async getEventImpacts(
    simulationId: string,
    options?: {
      quarter?: number;
      source?: string;
      triggeredBy?: string;
      firmId?: string;
    },
  ): Promise<any[]> {
    const simObjectId = this.toObjectId(simulationId);
    const query: any = { simulation: simObjectId };

    if (options?.quarter !== undefined) query.quarter = options.quarter;
    if (options?.source) query.source = options.source;
    if (options?.triggeredBy)
      query.triggeredBy = this.toObjectId(options.triggeredBy);
    if (options?.firmId) query.firm = this.toObjectId(options.firmId);

    return this.eventImpactModel
      .find(query)
      .populate('event', 'name description')
      .populate('firm', 'name firmNumber color')
      .populate('triggeredBy', 'email firstName lastName')
      .sort({ quarter: -1, createdAt: -1 });
  }

  /**
   * Get summary of faculty-triggered events for dashboard
   */
  async getFacultyEventSummary(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);

    const summary = await this.eventImpactModel.aggregate([
      {
        $match: {
          simulation: simObjectId,
          source: 'FACULTY_TRIGGERED',
        },
      },
      {
        $group: {
          _id: { eventType: '$eventType', quarter: '$quarter' },
          firmsAffected: { $sum: 1 },
          avgRawMagnitude: { $avg: '$rawMagnitude' },
          avgEffectiveMagnitude: { $avg: '$effectiveMagnitude' },
          firmsWithMitigation: { $sum: { $cond: ['$hasControlTower', 1, 0] } },
          totalCostImpact: { $sum: '$costImpact' },
          totalNetImpact: { $sum: '$netImpact' },
        },
      },
      { $sort: { '_id.quarter': -1 } },
    ]);

    return { simulationId, impacts: summary };
  }

  /**
   * Get detailed view of a single event's impact across all firms
   */
  async getEventImpactDetails(eventId: string): Promise<any> {
    const eventObjectId = this.toObjectId(eventId);

    const [event, impacts] = await Promise.all([
      this.eventModel
        .findById(eventObjectId)
        .populate('triggeredBy', 'email firstName lastName'),
      this.eventImpactModel
        .find({ event: eventObjectId })
        .populate('firm', 'name firmNumber color'),
    ]);

    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    return {
      event: {
        id: event._id,
        type: event.type,
        effect: event.effect,
        name: event.name,
        description: event.description,
        source: event.source,
        triggeredBy: event.triggeredBy,
        startQuarter: event.startQuarter,
        duration: event.duration,
        magnitude: event.magnitude,
      },
      firmImpacts: impacts.map((imp) => ({
        firm: imp.firm,
        quarter: imp.quarter,
        rawMagnitude: imp.rawMagnitude,
        effectiveMagnitude: imp.effectiveMagnitude,
        mitigated: imp.hasControlTower,
        impacts: imp.impacts,
        netImpact: imp.netImpact,
      })),
      totals: {
        firmsAffected: impacts.length,
        firmsMitigated: impacts.filter((i) => i.hasControlTower).length,
        totalNetImpact: impacts.reduce((sum, i) => sum + (i.netImpact || 0), 0),
      },
    };
  }

  // ============================================================================
  // GREEN SCORE HELPERS - Using GAS config
  // ============================================================================

  private getGreenScoreEffect(score: number): {
    csiEffect: number;
    churnMultiplier: number;
    label: string;
  } {
    const effects = CONFIG.greenScore.SCORE_EFFECTS;
    if (score >= effects.EXCELLENT.min) return effects.EXCELLENT;
    if (score >= effects.GOOD.min) return effects.GOOD;
    if (score >= effects.AVERAGE.min) return effects.AVERAGE;
    if (score >= effects.BELOW_AVERAGE.min) return effects.BELOW_AVERAGE;
    return effects.POOR;
  }

  // ============================================================================
  // DC STATUS AND CARRIER ANALYSIS
  // ============================================================================

  /**
   * Get DC status for all firms
   * Endpoint: GET /simulations/:id/dc-status?quarter=X
   */
  async getDCStatus(simulationId: string, quarter?: number): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);

    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    // Check if regional DCs feature is enabled
    if (!simulation.features?.regionalDCs) {
      return {
        simulationId,
        featureEnabled: false,
        message: 'Regional DCs feature is not enabled for this simulation',
      };
    }

    const targetQuarter = quarter || simulation.currentQuarter;
    const firms = await this.firmModel.find({ simulation: simObjectId });

    const dcData = await Promise.all(
      firms.map(async (firm) => {
        const firmId = firm._id as Types.ObjectId;

        // Get quarter state for the target quarter
        const state = await this.quarterStateModel.findOne({
          simulation: simObjectId,
          firm: firmId,
          quarter: targetQuarter,
        });

        // Get decision for DC setup costs
        const decision = await this.decisionModel.findOne({
          simulation: simObjectId,
          firm: firmId,
          quarter: targetQuarter,
        });

        // Get previous state to detect new openings
        const prevState = await this.quarterStateModel.findOne({
          simulation: simObjectId,
          firm: firmId,
          quarter: targetQuarter - 1,
        });

        // Calculate setup costs incurred this quarter
        let setupCostThisQuarter = 0;
        if (state?.dcCentralOpen && !prevState?.dcCentralOpen) {
          setupCostThisQuarter += CONFIG.dc.CENTRAL.setupCost;
        }
        if (state?.dcWestOpen && !prevState?.dcWestOpen) {
          setupCostThisQuarter += CONFIG.dc.WEST.setupCost;
        }

        // Calculate quarterly opex
        let quarterlyOpex = 0;
        if (state?.dcCentralOpen) {
          quarterlyOpex += CONFIG.dc.CENTRAL.quarterlyOpex;
        }
        if (state?.dcWestOpen) {
          quarterlyOpex += CONFIG.dc.WEST.quarterlyOpex;
        }

        // Calculate service bonus
        let serviceBonus = CONFIG.dc.FACTORY_SERVICE_BONUS || 0.05;
        if (state?.dcCentralOpen)
          serviceBonus += CONFIG.dc.CENTRAL.serviceBonus;
        if (state?.dcWestOpen) serviceBonus += CONFIG.dc.WEST.serviceBonus;

        return {
          firmId: firmId.toString(),
          firmNumber: firm.firmNumber,
          firmName: firm.name,
          firmColor: firm.color,
          dcCentral: {
            open: state?.dcCentralOpen || false,
            inventory: state?.dcCentralInventory || 0,
            capacity: CONFIG.dc.CENTRAL.capacity,
            utilization: state?.dcCentralOpen
              ? ((state.dcCentralInventory || 0) / CONFIG.dc.CENTRAL.capacity) *
                100
              : 0,
          },
          dcWest: {
            open: state?.dcWestOpen || false,
            inventory: state?.dcWestInventory || 0,
            capacity: CONFIG.dc.WEST.capacity,
            utilization: state?.dcWestOpen
              ? ((state.dcWestInventory || 0) / CONFIG.dc.WEST.capacity) * 100
              : 0,
          },
          opex: quarterlyOpex,
          setupCostThisQuarter,
          serviceBonus,
          // Allocation from decision (DA: transfers not supported)
          allocatedToCentral: decision?.allocateCentral || 0,
          allocatedToWest: decision?.allocateWest || 0,
        };
      }),
    );

    // Calculate aggregate stats
    const summary = {
      totalCentralOpen: dcData.filter((f) => f.dcCentral.open).length,
      totalWestOpen: dcData.filter((f) => f.dcWest.open).length,
      totalCentralInventory: dcData.reduce(
        (sum, f) => sum + f.dcCentral.inventory,
        0,
      ),
      totalWestInventory: dcData.reduce(
        (sum, f) => sum + f.dcWest.inventory,
        0,
      ),
      totalOpex: dcData.reduce((sum, f) => sum + f.opex, 0),
      totalSetupCost: dcData.reduce(
        (sum, f) => sum + f.setupCostThisQuarter,
        0,
      ),
      avgCentralUtilization:
        dcData.filter((f) => f.dcCentral.open).length > 0
          ? dcData
              .filter((f) => f.dcCentral.open)
              .reduce((sum, f) => sum + f.dcCentral.utilization, 0) /
            dcData.filter((f) => f.dcCentral.open).length
          : 0,
      avgWestUtilization:
        dcData.filter((f) => f.dcWest.open).length > 0
          ? dcData
              .filter((f) => f.dcWest.open)
              .reduce((sum, f) => sum + f.dcWest.utilization, 0) /
            dcData.filter((f) => f.dcWest.open).length
          : 0,
    };

    return {
      simulationId,
      quarter: targetQuarter,
      featureEnabled: true,
      summary,
      firms: dcData,
      dcConfig: {
        factory: {
          region: CONFIG.dc.FACTORY_REGION || 'R1',
          serviceBonus: CONFIG.dc.FACTORY_SERVICE_BONUS || 0.05,
        },
        central: {
          name: CONFIG.dc.CENTRAL.name || 'Central DC',
          location: CONFIG.dc.CENTRAL.location || 'Chicago',
          capacity: CONFIG.dc.CENTRAL.capacity,
          setupCost: CONFIG.dc.CENTRAL.setupCost,
          quarterlyOpex: CONFIG.dc.CENTRAL.quarterlyOpex,
          serviceBonus: CONFIG.dc.CENTRAL.serviceBonus || 0.03,
          regionServed: CONFIG.dc.CENTRAL.regionServed || 'R2',
        },
        west: {
          name: CONFIG.dc.WEST.name || 'West DC',
          location: CONFIG.dc.WEST.location || 'Los Angeles',
          capacity: CONFIG.dc.WEST.capacity,
          setupCost: CONFIG.dc.WEST.setupCost,
          quarterlyOpex: CONFIG.dc.WEST.quarterlyOpex,
          serviceBonus: CONFIG.dc.WEST.serviceBonus || 0.05,
          regionServed: CONFIG.dc.WEST.regionServed || 'R3',
        },
        transferCosts: CONFIG.dc.TRANSFER_COSTS || {
          DC_TO_DC: 5,
          DC_TO_FACTORY: 4,
        },
        disposalValueRate: CONFIG.dc.DISPOSAL_VALUE_RATE || 0.25,
      },
    };
  }

  // ============================================================================
  // CARRIER ANALYSIS - Get carrier selection and performance for all firms
  // Endpoint: GET /simulations/:id/carrier-analysis?quarter=X
  // ============================================================================

  async getCarrierAnalysis(
    simulationId: string,
    quarter?: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);

    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    // DA: Multi-carrier selection not supported
    return {
      simulationId,
      featureEnabled: false,
      message: 'Multi-Carrier Selection feature is not available in Analytics Edition',
    };
  }

  // ============================================================================
  // ANALYTICS DASHBOARD
  // ============================================================================

  async getAnalyticsDashboard(
    simulationId: string,
    firmId: string,
    quarter?: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const firm = await this.resolveFirm(simulationId, firmId);
    const firmObjectId = firm._id as Types.ObjectId;

    // DA: Analytics dashboard is always available (no tech purchase required)

    const targetQuarter =
      quarter !== undefined ? Number(quarter) : simulation.currentQuarter;

    // Pull KPI history for this firm up to targetQuarter
    const kpiHistory = await this.kpiHistoryModel
      .find({
        simulation: simObjectId,
        firm: firmObjectId,
        quarter: { $lte: targetQuarter },
      })
      .sort({ quarter: 1 });

    if (kpiHistory.length === 0) {
      return {
        simulationId,
        firmId: firmObjectId.toString(),
        firmNumber: firm.firmNumber,
        featureEnabled: true,
        hasData: false,
        message: 'No KPI data available yet for this firm.',
        kpiHistory: [],
      };
    }

    // Current quarter snapshot
    const current = kpiHistory[kpiHistory.length - 1];
    const prev = kpiHistory.length >= 2 ? kpiHistory[kpiHistory.length - 2] : null;

    // ── FINANCIAL PANEL ──────────────────────────────────────────────────────
    const revenue = current.financial?.revenue ?? 0;
    const prevRevenue = prev?.financial?.revenue ?? revenue;
    const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

    const netIncome = current.financial?.netIncome ?? 0;
    const grossMarginPct = current.financial?.grossMarginPct ?? 0;
    const cash = current.financial?.cash ?? 0;

    const financialPanel = {
      revenue,
      revenueGrowth: parseFloat(revenueGrowth.toFixed(2)),
      netIncome,
      netMarginPct:
        revenue > 0 ? parseFloat(((netIncome / revenue) * 100).toFixed(2)) : 0,
      grossMarginPct: parseFloat(grossMarginPct.toFixed(2)),
      cash,
      cogs: current.financial?.cogs ?? 0,
      operatingExpenses: current.financial?.operatingExpenses ?? 0,
    };

    // ── CUSTOMER PANEL ───────────────────────────────────────────────────────
    const csi = current.customer?.csi ?? 80;
    const prevCsi = prev?.customer?.csi ?? csi;
    const marketShare = (current.customer?.marketShare ?? 0.333) * 100;
    const fillRate = (current.customer?.fillRate ?? 0.95) * 100;
    const returnRate = (current.customer?.returnRate ?? 0) * 100;

    const customerPanel = {
      csi: parseFloat(csi.toFixed(1)),
      csiTrend: parseFloat((csi - prevCsi).toFixed(1)),
      csiStatus: csi >= 80 ? 'OK' : csi >= 70 ? 'WARN' : 'CRITICAL',
      marketSharePct: parseFloat(marketShare.toFixed(2)),
      fillRatePct: parseFloat(fillRate.toFixed(1)),
      fillRateStatus:
        fillRate >= 95 ? 'OK' : fillRate >= 85 ? 'WARN' : 'CRITICAL',
      returnRatePct: parseFloat(returnRate.toFixed(2)),
      customersLoyal: current.customer?.customersLoyal ?? 0,
      customersInPlay: current.customer?.customersInPlay ?? 0,
      customersChurned: current.customer?.customersChurned ?? 0,
    };

    // ── OPERATIONS PANEL ─────────────────────────────────────────────────────
    const perfectOrder = (current.operations?.perfectOrder ?? 0.84) * 100;
    const capacityUtil = (current.operations?.capacityUtilization ?? 0) * 100;
    const defectRate = (current.operations?.defectRate ?? 0.03) * 100;
    const onTimeDelivery = (current.operations?.onTimeDelivery ?? 0.92) * 100;
    const mape = current.operations?.mape ?? 0;
    const forecastAccuracyPct = (1 - mape) * 100;

    // Capacity utilisation sweet spot: 70–85% is optimal (from GAS logic)
    const capStatus =
      capacityUtil >= 70 && capacityUtil <= 85
        ? 'OPTIMAL'
        : capacityUtil >= 60 && capacityUtil < 70
          ? 'UNDERUTILISED'
          : capacityUtil > 85 && capacityUtil <= 95
            ? 'HIGH'
            : 'CRITICAL';

    const operationsPanel = {
      perfectOrderPct: parseFloat(perfectOrder.toFixed(1)),
      perfectOrderStatus:
        perfectOrder >= 85 ? 'OK' : perfectOrder >= 75 ? 'WARN' : 'CRITICAL',
      capacityUtilPct: parseFloat(capacityUtil.toFixed(1)),
      capacityStatus: capStatus,
      defectRatePct: parseFloat(defectRate.toFixed(2)),
      defectStatus: defectRate < 2 ? 'OK' : defectRate < 4 ? 'WARN' : 'CRITICAL',
      onTimeDeliveryPct: parseFloat(onTimeDelivery.toFixed(1)),
      forecastAccuracyPct: parseFloat(forecastAccuracyPct.toFixed(1)),
      forecastStatus:
        forecastAccuracyPct >= 85
          ? 'OK'
          : forecastAccuracyPct >= 75
            ? 'WARN'
            : 'CRITICAL',
      unitsProduced: current.operations?.unitsProduced ?? 0,
      unitsSold: current.operations?.unitsSold ?? 0,
    };

    // ── INVENTORY PANEL ──────────────────────────────────────────────────────
    const inventoryPanel = {
      rawMaterialUnits: current.inventory?.rawMaterialUnits ?? 0,
      finishedGoodsUnits: current.inventory?.finishedGoodsUnits ?? 0,
      inventoryValue: current.inventory?.inventoryValue ?? 0,
      inventoryTurnover: parseFloat(
        (current.inventory?.inventoryTurnover ?? 0).toFixed(2),
      ),
      weeksOfSupply: parseFloat(
        (current.inventory?.weeksOfSupply ?? 0).toFixed(1),
      ),
      retailerInventory: current.inventory?.retailerInventory ?? 0,
      inTransitUnits: current.inventory?.inTransitUnits ?? 0,
      rawMaterialStatus:
        (current.inventory?.rawMaterialUnits ?? 0) >= 300000
          ? 'OK'
          : (current.inventory?.rawMaterialUnits ?? 0) >= 150000
            ? 'WARN'
            : 'CRITICAL',
      finishedGoodsStatus:
        (current.inventory?.finishedGoodsUnits ?? 0) >= 50000
          ? 'OK'
          : (current.inventory?.finishedGoodsUnits ?? 0) >= 20000
            ? 'WARN'
            : 'CRITICAL',
    };

    // ── LEARNING & GROWTH PANEL ──────────────────────────────────────────────
    // DA: Technology not tracked
    const techCount = 0;
    const maturity = current.learning?.scMaturity ?? 'BASIC';
    const techInvestmentTotal = 0;

    const learningPanel = {
      techSystemsCount: techCount,
      techSystemsOwned: [],
      scMaturity: maturity,
      techInvestmentTotal,
      forecastAccuracyPct: parseFloat(forecastAccuracyPct.toFixed(1)),
      maturityStatus:
        maturity === 'ADVANCED' ? 'OK' : maturity === 'DEVELOPING' ? 'WARN' : 'BASIC',
    };

    // ── COST BREAKDOWN ───────────────────────────────────────────────────────
    const costBreakdown = current.costs
      ? {
          labor: current.costs.labor ?? 0,
          holding: current.costs.holding ?? 0,
          marketing: current.costs.marketing ?? 0,
          interest: current.costs.interest ?? 0,
          total: Object.values(current.costs).reduce(
            (sum: number, v: any) => sum + (typeof v === 'number' ? v : 0),
            0,
          ),
        }
      : null;

    // ── BSC SNAPSHOT ─────────────────────────────────────────────────────────
    const bscSnapshot = current.bsc
      ? {
          financial: current.bsc.financial ?? 0,
          customer: current.bsc.customer ?? 0,
          process: current.bsc.process ?? 0,
          learning: current.bsc.learning ?? 0,
          overall: current.bsc.overall ?? 0,
          rank: current.bsc.rank ?? null,
          grade: current.bsc.grade ?? null,
        }
      : null;

    // ── TREND SERIES (for charts) ─────────────────────────────────────────────
    const trendSeries = kpiHistory.map((k) => ({
      quarter: k.quarter,
      revenue: k.financial?.revenue ?? 0,
      netIncome: k.financial?.netIncome ?? 0,
      cash: k.financial?.cash ?? 0,
      csi: k.customer?.csi ?? 80,
      marketSharePct: (k.customer?.marketShare ?? 0.333) * 100,
      fillRatePct: (k.customer?.fillRate ?? 0.95) * 100,
      perfectOrderPct: (k.operations?.perfectOrder ?? 0.84) * 100,
      capacityUtilPct: (k.operations?.capacityUtilization ?? 0) * 100,
      forecastAccuracyPct: (1 - (k.operations?.mape ?? 0)) * 100,
      defectRatePct: (k.operations?.defectRate ?? 0.03) * 100,
      bscOverall: k.bsc?.overall ?? 0,
    }));

    return {
      simulationId,
      firmId: firmObjectId.toString(),
      firmNumber: firm.firmNumber,
      firmName: firm.name,
      firmColor: firm.color,
      quarter: targetQuarter,
      featureEnabled: true,
      hasData: true,
      panels: {
        financial: financialPanel,
        customer: customerPanel,
        operations: operationsPanel,
        inventory: inventoryPanel,
        learning: learningPanel,
      },
      costBreakdown,
      bscSnapshot,
      trendSeries,
    };
  }

  // ============================================================================
  // BALANCED SCORECARD
  // ============================================================================

  async getBalancedScorecard(
    simulationId: string,
    quarter?: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const parsed =
      quarter !== undefined ? parseInt(String(quarter), 10) : NaN;
    const targetQuarter = Number.isFinite(parsed)
      ? parsed
      : simulation.currentQuarter;

    const firms = await this.firmModel
      .find({ simulation: simObjectId })
      .sort({ firmNumber: 1 });

    // Pull KPI records for ALL firms at targetQuarter in a single query
    const firmIds = firms.map((f) => f._id);
    const kpiRecords = await this.kpiHistoryModel.find({
      simulation: simObjectId,
      firm: { $in: firmIds },
      quarter: targetQuarter,
    });

    // Index by firm _id string for O(1) lookup
    const kpiByFirm = new Map<string, typeof kpiRecords[0]>();
    for (const k of kpiRecords) {
      kpiByFirm.set((k.firm as Types.ObjectId).toString(), k);
    }

    // If no KPI records exist for any firm at this quarter, the requested
    // quarter hasn't been processed yet. Return an explicit empty state
    // so the cockpit can show "no data" UI instead of zero-filled cards.
    if (kpiRecords.length === 0) {
      return {
        simulationId,
        quarter: targetQuarter,
        hasData: false,
        message: `No engine output for Q${targetQuarter} yet.`,
        firms: [],
        gradeThresholds: { A: 90, B: 80, C: 70, D: 0 },
        perspectiveWeights: { financial: 0.25, customer: 0.25, process: 0.25, learning: 0.25 },
        leader: null,
      };
    }

    // ── BSC SCORE CALCULATION ─────────────────────────────────────────────
    // Mirrors GAS updateBalancedScorecard_ four-perspective scoring exactly.
    // Each perspective scores 0–100; overall = equal 25% weight per perspective.

    const scoreResults: Array<{
      firmId: string;
      firmNumber: number;
      firmName: string;
      firmColor: string;
      financial: {
        score: number;
        netIncomeMil: number;
        revenueMil: number;
        grossMarginPct: number;
        cashMil: number;
      };
      customer: {
        score: number;
        csi: number;
        marketSharePct: number;
        fillRatePct: number;
        returnRatePct: number;
      };
      process: {
        score: number;
        perfectOrderPct: number;
        capacityUtilPct: number;
        defectRatePct: number;
        onTimeDeliveryPct: number;
      };
      learning: {
        score: number;
        techCount: number;
        forecastAccuracyPct: number;
        maturityLevel: string;
        techInvestmentMil: number;
      };
      overall: number;
      grade: string;
      rank?: number;
    }> = [];

    for (const firm of firms) {
      const firmIdStr = (firm._id as Types.ObjectId).toString();
      const kpi = kpiByFirm.get(firmIdStr);

      // ── FINANCIAL PERSPECTIVE ──────────────────────────────────────────
      const netIncomeMil = kpi ? (kpi.financial?.netIncome ?? 0) / 1_000_000 : 0;
      const revenueMil = kpi ? (kpi.financial?.revenue ?? 0) / 1_000_000 : 0;
      const grossMarginPct = kpi ? (kpi.financial?.grossMarginPct ?? 35) : 35;
      const cashMil = kpi ? (kpi.financial?.cash ?? 0) / 1_000_000 : 0;

      const finScoreLocal = Math.min(
        100,
        (netIncomeMil > 5 ? 30 : Math.max(0, (netIncomeMil / 5) * 30)) +
          (revenueMil > 70 ? 25 : (revenueMil / 70) * 25) +
          (grossMarginPct > 35 ? 25 : (grossMarginPct / 35) * 25) +
          (cashMil > 20 ? 20 : (cashMil / 20) * 20),
      );

      // ── CUSTOMER PERSPECTIVE ───────────────────────────────────────────
      const csi = kpi ? (kpi.customer?.csi ?? 80) : 80;
      const marketSharePct = kpi ? (kpi.customer?.marketShare ?? 0.333) * 100 : 33.3;
      const fillRatePct = kpi ? (kpi.customer?.fillRate ?? 0.9) * 100 : 90;
      const returnRatePct = kpi ? (kpi.customer?.returnRate ?? 0) * 100 : 0;

      const custScoreLocal = Math.min(
        100,
        (csi > 85 ? 30 : ((csi - 50) / 35) * 30) +
          (marketSharePct > 35 ? 25 : (marketSharePct / 35) * 25) +
          (fillRatePct > 95 ? 25 : (fillRatePct / 95) * 25) +
          (returnRatePct < 1 ? 20 : Math.max(0, ((3 - returnRatePct) / 3) * 20)),
      );

      // ── PROCESS PERSPECTIVE ────────────────────────────────────────────
      const perfectOrderPct = kpi ? (kpi.operations?.perfectOrder ?? 0.84) * 100 : 84;
      const capacityUtilPct = kpi ? (kpi.operations?.capacityUtilization ?? 0) * 100 : 0;
      const defectRatePct = kpi ? (kpi.operations?.defectRate ?? 0.03) * 100 : 3;
      const onTimeDeliveryPct = kpi ? (kpi.operations?.onTimeDelivery ?? 0.92) * 100 : 92;

      // Capacity utilization sweet spot 70–85% = full 25 pts (GAS logic)
      const capScore =
        capacityUtilPct >= 70 && capacityUtilPct <= 85
          ? 25
          : capacityUtilPct < 70
            ? (capacityUtilPct / 70) * 25
            : Math.max(0, ((100 - capacityUtilPct) / 15) * 25);

      const procScoreLocal = Math.min(
        100,
        (perfectOrderPct > 90 ? 30 : (perfectOrderPct / 90) * 30) +
          capScore +
          (defectRatePct < 2 ? 25 : Math.max(0, ((5 - defectRatePct) / 5) * 25)) +
          (onTimeDeliveryPct > 95 ? 20 : (onTimeDeliveryPct / 95) * 20),
      );

      // ── LEARNING & GROWTH PERSPECTIVE ──────────────────────────────────
      // DA: Technology not tracked
      const techCount = 0;
      const mape = kpi ? (kpi.operations?.mape ?? 0) : 0;
      const forecastAccuracyPct = (1 - mape) * 100;
      const techInvestmentMil = 0;

      // Maturity: basic level since no tech
      const maturityLevel = 'Basic';

      const learnScoreLocal = Math.min(
        100,
        (forecastAccuracyPct > 85 ? 30 : (forecastAccuracyPct / 85) * 30) + 10,
      );

      // Prefer the scores stored at quarter close (season-adjusted, same
      // source as the dashboard); the local formulas are only a fallback.
      const stored = kpi?.bsc as any;
      const pick = (v: unknown, fallback: number) =>
        typeof v === 'number' && Number.isFinite(v) ? v : fallback;
      const finScore = pick(stored?.financial, finScoreLocal);
      const custScore = pick(stored?.customer, custScoreLocal);
      const procScore = pick(stored?.process, procScoreLocal);
      const learnScore = pick(stored?.learning, learnScoreLocal);

      // ── OVERALL ────────────────────────────────────────────────────────
      const overall = (finScore + custScore + procScore + learnScore) / 4;
      const grade =
        overall >= 90
          ? 'A'
          : overall >= 80
            ? 'B'
            : overall >= 70
              ? 'C'
              : 'D';

      scoreResults.push({
        firmId: firmIdStr,
        firmNumber: firm.firmNumber,
        firmName: firm.name,
        firmColor: firm.color,
        financial: {
          score: parseFloat(finScore.toFixed(1)),
          netIncomeMil: parseFloat(netIncomeMil.toFixed(2)),
          revenueMil: parseFloat(revenueMil.toFixed(2)),
          grossMarginPct: parseFloat(grossMarginPct.toFixed(1)),
          cashMil: parseFloat(cashMil.toFixed(2)),
        },
        customer: {
          score: parseFloat(custScore.toFixed(1)),
          csi: parseFloat(csi.toFixed(1)),
          marketSharePct: parseFloat(marketSharePct.toFixed(2)),
          fillRatePct: parseFloat(fillRatePct.toFixed(1)),
          returnRatePct: parseFloat(returnRatePct.toFixed(2)),
        },
        process: {
          score: parseFloat(procScore.toFixed(1)),
          perfectOrderPct: parseFloat(perfectOrderPct.toFixed(1)),
          capacityUtilPct: parseFloat(capacityUtilPct.toFixed(1)),
          defectRatePct: parseFloat(defectRatePct.toFixed(2)),
          onTimeDeliveryPct: parseFloat(onTimeDeliveryPct.toFixed(1)),
        },
        learning: {
          score: parseFloat(learnScore.toFixed(1)),
          techCount,
          forecastAccuracyPct: parseFloat(forecastAccuracyPct.toFixed(1)),
          maturityLevel,
          techInvestmentMil: parseFloat(techInvestmentMil.toFixed(2)),
        },
        overall: parseFloat(overall.toFixed(1)),
        grade,
      });
    }

    // Assign ranks (1 = highest overall score)
    const sorted = [...scoreResults].sort((a, b) => b.overall - a.overall);
    sorted.forEach((s, i) => {
      s.rank = i + 1;
    });

    // Restore original firm order for output, with ranks attached
    const rankMap = new Map(sorted.map((s) => [s.firmId, s.rank]));
    scoreResults.forEach((s) => {
      s.rank = rankMap.get(s.firmId);
    });

    // Thresholds reference (mirrors GAS color coding)
    const gradeThresholds = {
      A: 90,
      B: 80,
      C: 70,
      D: 0,
    };

    const perspectiveWeights = {
      financial: 0.25,
      customer: 0.25,
      process: 0.25,
      learning: 0.25,
    };

    return {
      simulationId,
      quarter: targetQuarter,
      hasData: true,
      firms: scoreResults,
      gradeThresholds,
      perspectiveWeights,
      leader: sorted[0]
        ? { firmId: sorted[0].firmId, firmNumber: sorted[0].firmNumber, overall: sorted[0].overall }
        : null,
    };
  }

  // ============================================================================
  // SOP DASHBOARD
  // ============================================================================

  async getSOPDashboard(
    simulationId: string,
    firmId: string,
    quarter?: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const firm = await this.resolveFirm(simulationId, firmId);
    const firmObjectId = firm._id as Types.ObjectId;

    const targetQuarter =
      quarter !== undefined ? Number(quarter) : simulation.currentQuarter;

    // ── DEMAND OUTLOOK ────────────────────────────────────────────────────────────
    // Last 4 quarters of actual market demand (mirrors getDemandHistory_ in GAS)
    const fromDemand = Math.max(1, targetQuarter - 3);
    const demandHistory = await this.demandHistoryModel
      .find({
        simulation: simObjectId,
        quarter: { $gte: fromDemand, $lte: targetQuarter },
      })
      .sort({ quarter: 1 });

    const demandOutlook = demandHistory.map((d) => ({
      quarter: d.quarter,
      calendarQuarter: d.calendarQuarter,
      seasonLabel: d.seasonLabel ?? '',
      seasonalMultiplier: d.seasonalMultiplier,
      demandR1: d.demandR1,
      demandR2: d.demandR2,
      demandR3: d.demandR3,
      totalDemand: d.totalDemand,
      eventImpact: d.eventImpact ?? null,
    }));

    const currentDemand = demandHistory.find((d) => d.quarter === targetQuarter);

    // Engine output check: demand history is written ONLY when a quarter
    // closes (inside generateAndRecordDemand, called from advanceQuarter
    // and the pre-history loop). If currentDemand is missing, the requested
    // quarter hasn't run yet — return early with hasData:false so the
    // caller knows to render an empty state, not zeros.
    if (!currentDemand) {
      return {
        simulationId,
        firmId: firmObjectId.toString(),
        firmNumber: firm.firmNumber,
        firmName: firm.name,
        firmColor: firm.color,
        quarter: targetQuarter,
        hasData: false,
        message: `No engine output for Q${targetQuarter} yet. Quarter is either open or not yet processed.`,
        generatedAt: new Date().toISOString(),
      };
    }

    const totalMarketDemand = currentDemand.totalDemand;

    // ── FORECAST HISTORY ─────────────────────────────────────────────────────────────
    // Last 4 quarters of firm's forecasts vs actuals (mirrors getForecastHistory_ in GAS)
    const forecastLogs = await this.forecastLogModel
      .find({
        simulation: simObjectId,
        firm: firmObjectId,
        quarter: { $gte: fromDemand, $lte: targetQuarter },
      })
      .sort({ quarter: 1 });

    const forecastHistory = forecastLogs.map((f) => ({
      quarter: f.quarter,
      forecast: f.forecast,
      actual: f.actual,
      error: f.error,
      ape: f.ape,
      mape: parseFloat((f.mape * 100).toFixed(1)),
      accuracyPct: parseFloat((f.accuracy * 100).toFixed(1)),
      bias: parseFloat((f.bias * 100).toFixed(2)),
    }));

    // Current-quarter forecast accuracy (mirrors getForecastAccuracy_ in GAS)
    const currentForecastLog = forecastLogs.find((f) => f.quarter === targetQuarter);
    const forecastAccuracy = currentForecastLog
      ? {
          mape: parseFloat((currentForecastLog.mape * 100).toFixed(1)),
          accuracyPct: parseFloat((currentForecastLog.accuracy * 100).toFixed(1)),
          bias: parseFloat((currentForecastLog.bias * 100).toFixed(2)),
          status:
            currentForecastLog.accuracy >= 0.85
              ? 'OK'
              : currentForecastLog.accuracy >= 0.75
                ? 'WARN'
                : 'CRITICAL',
        }
      : { mape: 0, accuracyPct: 0, bias: 0, status: 'NO_DATA' };

    // ── QUARTER STATE ──────────────────────────────────────────────────────────────────────
    const state = await this.quarterStateModel.findOne({
      simulation: simObjectId,
      firm: firmObjectId,
      quarter: targetQuarter,
    });

    // ── KPI SNAPSHOT ────────────────────────────────────────────────────────────────────────────
    const kpi = await this.kpiHistoryModel.findOne({
      simulation: simObjectId,
      firm: firmObjectId,
      quarter: targetQuarter,
    });

    // ── SUPPLY PLAN ─────────────────────────────────────────────────────────────────────────────────────
    const unitsProduced = kpi?.operations?.unitsProduced ?? 0;
    const capacityUtilPct = 0; // DA: Capacity expansion not tracked

    const supplyPlan = {
      unitsProduced,
      capacityUtilPct: parseFloat(capacityUtilPct.toFixed(1)),
      capacityStatus: 'OK',
    };

    // ── INVENTORY POSITION ───────────────────────────────────────────────────────────────────
    const rawMaterialUnits = kpi?.inventory?.rawMaterialUnits ?? state?.rawMaterialUnits ?? 0;
    const finishedGoodsUnits = kpi?.inventory?.finishedGoodsUnits ?? state?.finishedGoodsUnits ?? 0;
    const retailerInventory = kpi?.inventory?.retailerInventory ?? state?.retailerInventory ?? 0;
    const inTransitUnits = kpi?.inventory?.inTransitUnits ?? state?.inTransitUnits ?? 0;

    const inventoryPosition = {
      rawMaterialUnits,
      rawMaterialStatus:
        rawMaterialUnits >= 300000
          ? 'OK'
          : rawMaterialUnits >= 150000
            ? 'WARN'
            : 'CRITICAL',
      finishedGoodsUnits,
      finishedGoodsStatus:
        finishedGoodsUnits >= 50000
          ? 'OK'
          : finishedGoodsUnits >= 20000
            ? 'WARN'
            : 'CRITICAL',
      inventoryValue: kpi?.inventory?.inventoryValue ?? 0,
      inventoryTurnover: parseFloat((kpi?.inventory?.inventoryTurnover ?? 0).toFixed(2)),
      weeksOfSupply: parseFloat((kpi?.inventory?.weeksOfSupply ?? 0).toFixed(1)),
      retailerInventory,
      retailerMode: state?.retailerMode ?? 'NORMAL',
      inTransitUnits,
    };

    // ── KEY METRICS ────────────────────────────────────────────────────────────────────────────
    // Mirrors updateMetricsSection_ in GAS — same status thresholds
    const fillRate = kpi?.customer?.fillRate ?? 0.95;
    const csi = kpi?.customer?.csi ?? 80;
    const perfectOrder = kpi?.operations?.perfectOrder ?? 0.84;
    const cash = kpi?.financial?.cash ?? state?.cash ?? 0;
    const shortTermDebt = state?.shortTermDebt ?? 0;

    const keyMetrics = {
      fillRate: {
        value: parseFloat((fillRate * 100).toFixed(1)),
        status: fillRate >= 0.95 ? 'OK' : fillRate >= 0.85 ? 'WARN' : 'CRITICAL',
      },
      csi: {
        value: parseFloat(csi.toFixed(1)),
        status: csi >= 80 ? 'OK' : csi >= 70 ? 'WARN' : 'CRITICAL',
      },
      perfectOrder: {
        value: parseFloat((perfectOrder * 100).toFixed(1)),
        status: perfectOrder >= 0.85 ? 'OK' : perfectOrder >= 0.75 ? 'WARN' : 'CRITICAL',
      },
      forecastAccuracy: {
        value: forecastAccuracy.accuracyPct,
        status: forecastAccuracy.status,
      },
      capacityUtil: {
        value: parseFloat(capacityUtilPct.toFixed(1)),
        status: supplyPlan.capacityStatus,
      },
      cash: {
        value: cash,
        status: cash >= 15_000_000 ? 'OK' : cash >= 5_000_000 ? 'WARN' : 'CRITICAL',
      },
      shortTermDebt: {
        value: shortTermDebt,
        status: shortTermDebt <= 50_000_000 ? 'OK' : shortTermDebt <= 100_000_000 ? 'WARN' : 'CRITICAL',
      },
    };

    // ── QUALITY SECTION ────────────────────────────────────────────────────────────────────────────────────
    // Mirrors updateQualitySection_ in GAS (built from KPI data)
    const qualitySection = kpi
      ? {
          inspectionLevel: 'BASIC',
          defectRatePct: parseFloat(((kpi.operations?.defectRate ?? 0) * 100).toFixed(2)),
          returnRatePct: parseFloat(((kpi.customer?.returnRate ?? 0) * 100).toFixed(2)),
          returnRateStatus:
            (kpi.customer?.returnRate ?? 0) < 0.01
              ? 'OK'
              : (kpi.customer?.returnRate ?? 0) < 0.02
                ? 'WARN'
                : 'CRITICAL',
        }
      : null;

    // ── LOGISTICS SECTION ────────────────────────────────────────────────────────────────────────────────────────────
    // DA: Multi-carrier selection not supported - use standard defaults
    const logisticsSection = state
      ? {
          carrierMode: 'TRUCK',
          freightCost: 0,
          lastMileCost: 0,
          volumeDiscount: 0,
          tmsDiscountPct: 0,
          tmsDiscountApplied: false,
        }
      : null;

    // ── ALERTS ─────────────────────────────────────────────────────────────────────────────
    const alerts: Array<{ level: 'INFO' | 'WARN' | 'CRITICAL'; message: string }> = [];

    if (rawMaterialUnits < 300_000)
      alerts.push({ level: 'WARN', message: 'Raw materials low — consider increasing orders' });

    if (finishedGoodsUnits < 50_000)
      alerts.push({ level: 'WARN', message: 'Finished goods low — risk of stockouts next quarter' });

    if (state?.retailerMode === 'PANIC')
      alerts.push({ level: 'CRITICAL', message: 'Retailer in PANIC mode — shipping 50% more than normal' });

    if (state?.retailerMode === 'CLEARANCE')
      alerts.push({ level: 'WARN', message: 'Retailer in CLEARANCE mode — discounting your product' });

    if (fillRate < 0.90)
      alerts.push({ level: 'CRITICAL', message: 'Fill rate below 90% — customers experiencing stockouts' });

    if (csi < 75)
      alerts.push({ level: 'WARN', message: 'CSI below 75 — customer satisfaction declining' });

    if (forecastAccuracy.mape > 25)
      alerts.push({ level: 'WARN', message: 'Forecast error above 25% — review demand patterns' });

    if (qualitySection && qualitySection.returnRatePct > 2)
      alerts.push({ level: 'CRITICAL', message: 'Return rate above 2% — consider upgrading inspection level' });

    if (cash < 15_000_000)
      alerts.push({ level: 'WARN', message: 'Cash position low — monitor spending closely' });

    if (shortTermDebt > 50_000_000)
      alerts.push({ level: 'WARN', message: 'High short-term debt — interest costs are increasing' });

    // DA: Technology not tracked
    if (alerts.length === 0)
      alerts.push({ level: 'INFO', message: 'No critical issues detected this quarter' });

    return {
      simulationId,
      firmId: firmObjectId.toString(),
      firmNumber: firm.firmNumber,
      firmName: firm.name,
      firmColor: firm.color,
      quarter: targetQuarter,
      hasData: true,
      totalMarketDemand,
      demandOutlook,
      forecastHistory,
      forecastAccuracy,
      supplyPlan,
      inventoryPosition,
      keyMetrics,
      qualitySection,
      logisticsSection,
      alerts,
      generatedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // ANALYTICS MODE - DATA DOWNLOADS & ACCURACY TRACKING
  // ============================================================================

  /**
   * Get forecast accuracy trend comparing GUT vs MODEL decisions
   * Used for the GUT-vs-MODEL accuracy trend chart on the Analytics Workbench
   */
  async getForecastAccuracyTrend(
    simulationId: string,
    firmId: string,
    userId: string,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const user = await this.userModel.findById(this.toObjectId(userId));
    if (!user) {
      throw new ForbiddenException('You do not have access to this simulation.');
    }

    const requestingFirm = await this.resolveFirm(simulationId, firmId);
    const requestingFirmId = String(requestingFirm._id);
    const chartShowsAllFirms = simulation.chartShowsAllFirms ?? true;

    if (user.role === UserRole.STUDENT) {
      const activeEnrollment = await this.enrollmentModel.findOne({
        simulation: simObjectId,
        user: this.toObjectId(userId),
        status: EnrollmentStatus.ACTIVE,
        firm: { $ne: null },
      });
      if (!activeEnrollment || String(activeEnrollment.firm) !== requestingFirmId) {
        throw new ForbiddenException(
          'You can only request forecast accuracy for your own firm.',
        );
      }
    } else if (user.role === UserRole.FACULTY) {
      const isOwner = simulation.owner?.toString() === userId;
      const isAssignedFaculty = ((simulation as any).facultyIds ?? []).some(
        (facultyId: Types.ObjectId | string) => facultyId.toString() === userId,
      );
      if (!isOwner && !isAssignedFaculty) {
        throw new ForbiddenException('You do not have access to this simulation.');
      }
    } else if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have access to this simulation.');
    }

    const allFirms = await this.firmModel
      .find({ simulation: simObjectId })
      .sort({ firmNumber: 1, name: 1, createdAt: 1 })
      .lean()
      .exec();
    const visibleFirms = chartShowsAllFirms
      ? allFirms
      : allFirms.filter((firm: any) => String(firm._id) === requestingFirmId);
    const visibleFirmIds = visibleFirms.map((firm: any) => firm._id);

    const forecastLogs = await this.forecastLogModel
      .find({
        simulation: simObjectId,
        firm: { $in: visibleFirmIds },
      })
      .sort({ firm: 1, quarter: 1, updatedAt: -1, createdAt: -1, _id: -1 })
      .lean()
      .exec();

    const latestSubmittedByFirmQuarter = new Map<
      string,
      { quarter: number; mape: number; method: ForecastMethod }
    >();

    for (const log of forecastLogs as any[]) {
      const source = log.forecastSource;
      let method: ForecastMethod | null = null;
      if (source === ForecastSource.GUT || source === ForecastSource.MODEL) {
        method =
          source === ForecastSource.MODEL
            ? ForecastMethod.MODEL
            : ForecastMethod.GUT;
      } else if (
        !source &&
        (log.forecastMethod === ForecastMethod.GUT ||
          log.forecastMethod === ForecastMethod.MODEL)
      ) {
        method = log.forecastMethod;
      }
      if (!method || typeof log.mape !== 'number') {
        continue;
      }
      const key = `${String(log.firm)}:${log.quarter}`;
      if (!latestSubmittedByFirmQuarter.has(key)) {
        latestSubmittedByFirmQuarter.set(key, {
          quarter: log.quarter,
          mape: log.mape,
          method,
        });
      }
    }

    return {
      simulationId,
      requestingFirmId,
      chartShowsAllFirms,
      firms: visibleFirms.map((firm: any) => {
        const firmIdString = String(firm._id);
        const dataPoints = Array.from(latestSubmittedByFirmQuarter.entries())
          .filter(([key]) => key.startsWith(`${firmIdString}:`))
          .map(([, point]) => point)
          .sort((a, b) => a.quarter - b.quarter);
        return {
          firmId: firmIdString,
          firmName: firm.name ?? `Firm ${firm.firmNumber}`,
          isRequestingFirm: firmIdString === requestingFirmId,
          dataPoints,
        };
      }),
    };
  }

  private async assertWorkbenchAccess(
    userId: string,
    simulationId: string,
  ): Promise<SimulationDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new ForbiddenException('You do not have access to this simulation.');
    }

    const simulation = await this.simulationModel.findById(
      this.toObjectId(simulationId),
    );
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    if (user.role === UserRole.ADMIN) {
      return simulation;
    }

    const userObjectId = this.toObjectId(userId);
    const isOwner = simulation.owner?.toString() === userId;
    const isAssignedFaculty = ((simulation as any).facultyIds ?? []).some(
      (facultyId: Types.ObjectId | string) => facultyId.toString() === userId,
    );

    if (user.role === UserRole.FACULTY && (isOwner || isAssignedFaculty)) {
      return simulation;
    }

    const activeEnrollment = await this.enrollmentModel.findOne({
      simulation: simulation._id,
      user: userObjectId,
      status: EnrollmentStatus.ACTIVE,
      firm: { $ne: null },
    });

    if (!activeEnrollment) {
      throw new ForbiddenException('You do not have access to this simulation.');
    }

    return simulation;
  }

  async getWorkbench(simulationId: string, userId: string): Promise<any> {
    const simulation = await this.assertWorkbenchAccess(userId, simulationId);

    const schedule = await this.getModuleScheduleWithState(simulationId);
    const modulesById = new Map(
      (schedule.modules ?? []).map((module: any) => [module.moduleId, module]),
    );

    return {
      simulationId,
      currentQuarter: schedule.currentQuarter,
      totalQuarters: schedule.totalQuarters,
      chartShowsAllFirms: simulation.chartShowsAllFirms ?? true,
      orientationStatus: schedule.orientationStatus,
      modules: ANALYTICS_WORKBENCH_MODULE_CATALOG.map((catalogEntry) => {
        const scheduleModule = modulesById.get(catalogEntry.moduleId) as any;
        return {
          moduleId: catalogEntry.moduleId,
          moduleName: catalogEntry.moduleName,
          shortDescription: catalogEntry.shortDescription,
          status: scheduleModule?.status ?? 'NEVER_UNLOCKS',
          unlocksAtQuarter: scheduleModule?.unlocksAtQuarter ?? null,
          dataDownloadUrl: `/api/simulations/${simulationId}/analytics/${catalogEntry.moduleId}/data`,
          assignmentDownloadUrl: `/api/simulations/${simulationId}/analytics/${catalogEntry.moduleId}/assignment`,
        };
      }),
    };
  }

  async getWorkbenchAsset(
    simulationId: string,
    userId: string,
    moduleId: string,
    assetKind: 'data' | 'assignment',
  ): Promise<{ contentType: string; fileName: string; buffer: Buffer }> {
    await this.assertWorkbenchAccess(userId, simulationId);

    const normalizedModuleId = moduleId.toLowerCase() as AnalyticsWorkbenchModuleId;
    const catalogEntry = ANALYTICS_WORKBENCH_MODULE_BY_ID[normalizedModuleId];
    if (!catalogEntry) {
      throw new BadRequestException(
        `Invalid moduleId "${moduleId}". Valid moduleIds are ${ANALYTICS_WORKBENCH_MODULE_IDS.join(', ')}.`,
      );
    }

    const schedule = await this.getModuleScheduleWithState(simulationId);
    const scheduleModule = (schedule.modules ?? []).find(
      (module: any) => module.moduleId === normalizedModuleId,
    );
    if (scheduleModule?.status !== 'UNLOCKED') {
      throw new ForbiddenException('This module is currently locked.');
    }

    const configuredFileName =
      assetKind === 'data'
        ? catalogEntry.dataFileName
        : catalogEntry.assignmentFileName;
    const assetPath = join(
      __dirname,
      '..',
      '..',
      '..',
      'assets',
      'analytics',
      catalogEntry.directoryKey,
      configuredFileName,
    );

    if (!existsSync(assetPath)) {
      throw new NotFoundException(
        assetKind === 'data'
          ? 'Data package not available. Contact your faculty.'
          : 'Assignment not available. Contact your faculty.',
      );
    }

    const friendlyBaseName = catalogEntry.directoryKey.replace(/-/g, '_');
    return {
      contentType:
        assetKind === 'data'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName:
        assetKind === 'data'
          ? `${friendlyBaseName}_data.csv`
          : `${friendlyBaseName}_assignment.docx`,
      buffer: readFileSync(assetPath),
    };
  }

  /**
   * Public method on SimulationService so DecisionService can call it without
   * a circular dependency. Use this to gate decision submissions on unlock state.
   */
  async assertModuleUnlocked(
    simulationId: string | Types.ObjectId,
    moduleId: string,
  ): Promise<void> {
    const simulation = await this.simulationModel.findById(simulationId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }
    if (!(simulation as any).isModuleUnlocked(moduleId)) {
      const config = simulation.moduleSchedule?.modules?.find(
        (m: any) => m.moduleId === moduleId.toLowerCase(),
      );
      if (!config) {
        throw new BadRequestException(`Module "${moduleId}" is not part of this simulation.`);
      }
      if (!config.enabled) {
        throw new BadRequestException(`Module "${moduleId}" is disabled in this simulation.`);
      }
      const orientationQuarters = simulation.orientationQuarters ?? 2;
      if ((simulation.currentQuarter ?? 0) <= 3 + orientationQuarters) {
        throw new BadRequestException(
          `Module "${moduleId}" is locked during orientation. orientationQuarters=${orientationQuarters}; modules can unlock starting Q${4 + orientationQuarters}.`,
        );
      }
      throw new BadRequestException(
        `Module "${moduleId}" unlocks at Q${config.unlocksAtQuarter} (currently Q${simulation.currentQuarter ?? 0}).`,
      );
    }
  }

  /**
   * Get module schedule with per-module unlock state for the cockpit.
   * Returns schedule plus derived isUnlocked boolean per module based on currentQuarter.
   * Frontend uses this to render locked vs unlocked module cards.
   */
  async getModuleScheduleWithState(
    simulationId: string,
  ): Promise<any> {
    const simulation = await this.simulationModel.findById(
      this.toObjectId(simulationId),
    );
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const currentQ = simulation.currentQuarter ?? 0;
    const sched = simulation.moduleSchedule;
    const orientationQuarters = simulation.orientationQuarters ?? 2;
    const firstPostOrientationQuarter = 4 + orientationQuarters;
    const isOrientation =
      orientationQuarters > 0 &&
      currentQ >= 4 &&
      currentQ <= 3 + orientationQuarters;
    const orientationQuarterIndex = isOrientation ? currentQ - 3 : null;
    const totalQuarters = simulation.totalQuarters;
    const modulesById = new Map(
      (sched?.modules ?? []).map((m: any) => [m.moduleId, m]),
    );

    const modules = ANALYTICS_MODULE_CATALOG
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((meta) => {
        const m = modulesById.get(meta.id) as any;
        const enabled = !!m?.enabled;
        const configuredUnlockQuarter = Number(m?.unlocksAtQuarter ?? 0);
        const neverUnlocks =
          !enabled ||
          !Number.isFinite(configuredUnlockQuarter) ||
          configuredUnlockQuarter < 1 ||
          configuredUnlockQuarter > totalQuarters;
        const effectiveUnlockQuarter = neverUnlocks
          ? null
          : Math.max(configuredUnlockQuarter, firstPostOrientationQuarter);
        const isUnlocked = !neverUnlocks && (simulation as any).isModuleUnlocked(meta.id);
        const status = neverUnlocks
          ? 'NEVER_UNLOCKS'
          : isUnlocked
            ? 'UNLOCKED'
            : isOrientation
              ? 'LOCKED_ORIENTATION'
              : 'LOCKED_SCHEDULED';
        return {
          moduleId: meta.id,
          moduleName: meta.title,
          title: meta.title,
          order: meta.order,
          unlocksAtQuarter: effectiveUnlockQuarter,
          configuredUnlockQuarter: neverUnlocks ? null : configuredUnlockQuarter,
          enabled,
          status,
          isUnlocked,
          quartersUntilUnlock:
            effectiveUnlockQuarter === null
              ? null
              : Math.max(0, effectiveUnlockQuarter - currentQ),
        };
      });

    return {
      mode: sched?.mode ?? ModuleScheduleMode.PROGRESSIVE,
      schedulePreset: simulation.schedulePreset ?? SchedulePreset.CUSTOM,
      currentQuarter: currentQ,
      totalQuarters,
      orientationQuarters,
      orientationStatus: {
        isOrientation,
        orientationQuartersTotal: orientationQuarters,
        orientationQuarterIndex,
      },
      modules,
    };
  }

  async getCurrentForecast(
    simulationId: string,
    firmId: string,
  ): Promise<{
    quarter: number;
    forecastR1: number | null;
    forecastR2: number | null;
    forecastR3: number | null;
    source: ForecastSource | null;
    isReadOnly: boolean;
  }> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const firm = await this.resolveFirm(simulationId, firmId);
    const firmObjectId = firm._id as Types.ObjectId;
    const quarter = simulation.currentQuarter;
    const isDsUnlocked = (simulation as any).isModuleUnlocked
      ? (simulation as any).isModuleUnlocked('ds')
      : false;
    const currentForecastLog = await this.forecastLogModel.findOne({
      simulation: simObjectId,
      firm: firmObjectId,
      quarter,
    });

    if (currentForecastLog) {
      const source = currentForecastLog.forecastSource ?? ForecastSource.BASELINE;
      return {
        quarter,
        forecastR1: currentForecastLog.forecast?.r1 ?? null,
        forecastR2: currentForecastLog.forecast?.r2 ?? null,
        forecastR3: currentForecastLog.forecast?.r3 ?? null,
        source,
        isReadOnly: source === ForecastSource.BASELINE || !isDsUnlocked,
      };
    }

    if (!isDsUnlocked) {
      const currentDecision = await this.decisionModel.findOne({
        simulation: simObjectId,
        firm: firmObjectId,
        quarter,
      });
      const prevDecision = await this.decisionModel.findOne({
        simulation: simObjectId,
        firm: firmObjectId,
        quarter: quarter - 1,
      });
      const baseline = currentDecision ?? prevDecision;
      return {
        quarter,
        forecastR1: baseline?.forecastR1 ?? 80000,
        forecastR2: baseline?.forecastR2 ?? 70000,
        forecastR3: baseline?.forecastR3 ?? 50000,
        source: ForecastSource.BASELINE,
        isReadOnly: true,
      };
    }

    const submittedDecision = await this.decisionModel.findOne({
      simulation: simObjectId,
      firm: firmObjectId,
      quarter,
      status: { $in: [DecisionStatus.SUBMITTED, DecisionStatus.PROCESSED] },
    });
    if (!submittedDecision) {
      return {
        quarter,
        forecastR1: null,
        forecastR2: null,
        forecastR3: null,
        source: null,
        isReadOnly: false,
      };
    }

    return {
      quarter,
      forecastR1: submittedDecision.forecastR1 ?? null,
      forecastR2: submittedDecision.forecastR2 ?? null,
      forecastR3: submittedDecision.forecastR3 ?? null,
      source:
        submittedDecision.forecastMethod === ForecastMethod.MODEL
          ? ForecastSource.MODEL
          : ForecastSource.GUT,
      isReadOnly: false,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LAZY QUARTER EXPIRY & AUTO-ADVANCE
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Lazy expiry check. Called from any endpoint that reads simulation state.
   * If the current quarter's time window has elapsed:
   *   - For any firm that didn't submit, copy their previous quarter's
   *     decision forward and mark it SUBMITTED
   *   - Trigger advanceQuarter to process the quarter
   *
   * If the window is still open or everyone already submitted, this is a
   * no-op. Safe to call frequently — does one cheap query when the window
   * is still open.
   *
   * Returns true if an auto-advance happened, false otherwise.
   */
  private async checkQuarterExpiry(
    simulation: SimulationDocument,
  ): Promise<boolean> {
    // Only running sims have an active window
    if (simulation.status !== SimulationStatus.IN_PROGRESS) return false;
    if (!simulation.quarterEndsAt) return false;
    if (Date.now() < simulation.quarterEndsAt.getTime()) return false;

    const simObjectId = simulation._id as Types.ObjectId;
    const currentQuarter = simulation.currentQuarter;

    // Who's missing?
    const firms = await this.firmModel.find({ simulation: simObjectId });
    const submittedFirmIds = await this.decisionModel.distinct('firm', {
      simulation: simObjectId,
      quarter: currentQuarter,
      status: { $in: [DecisionStatus.SUBMITTED, DecisionStatus.PROCESSED] },
    });
    const submittedSet = new Set(submittedFirmIds.map((id) => String(id)));
    const missingFirms = firms.filter(
      (f) => !submittedSet.has(String(f._id)),
    );

    if (missingFirms.length > 0) {
      console.log(
        `[QuarterExpiry] sim=${simObjectId} Q${currentQuarter} expired with ` +
          `${missingFirms.length}/${firms.length} firms unsubmitted. ` +
          `Carrying forward prior-quarter decisions.`,
      );

      for (const firm of missingFirms) {
        await this.carryForwardDecision(
          simObjectId,
          firm._id as Types.ObjectId,
          currentQuarter,
        );
      }
    }

    // Now everyone is submitted — advance.
    try {
      await this.advanceQuarter(String(simObjectId));
      return true;
    } catch (err) {
      console.error(
        `[QuarterExpiry] auto-advance failed for sim ${simObjectId}:`,
        err,
      );
      return false;
    }
  }

  /**
   * Copy a firm's previous quarter's decision forward and mark SUBMITTED.
   * Used by checkQuarterExpiry when a firm runs out of time. If the firm
   * has a DRAFT for the current quarter already, that gets promoted to
   * SUBMITTED rather than being overwritten — student's draft work is not
   * destroyed.
   */
  /**
   * Seed sensible defaults on a SUBMITTED decision for modules that newly
   * unlocked this quarter. Called only when carry-forward couldn't fill these
   * fields (because the firm has never made a decision for the module).
   *
   * The defaults bias toward "safe middle of the road" — enough to keep the
   * sim running without crashing the engine. Non-submitting teams will be
   * out-performed by teams that actually engage.
   */
  private async seedDefaultsForNewModules(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    moduleIds: string[],
  ): Promise<void> {
    const decision = await this.decisionModel.findOne({
      simulation: simulationId,
      firm: firmId,
      quarter,
    });
    if (!decision) return;

    let modified = false;

    for (const moduleId of moduleIds) {
      switch (moduleId) {
        case 'ds': {
          // Demand Science — use the BASELINE forecast (not gut, not model).
          if (!(decision as any).forecastSource) {
            (decision as any).forecastSource = 'BASELINE';
            modified = true;
          }
          break;
        }
        case 'sa': {
          // Supplier Analytics — keep current supplier mix. If the team
          // hadn't picked a mix yet, default to 70/30 global/regional.
          if ((decision as any).supplierGlobalPct == null) {
            (decision as any).supplierGlobalPct = 0.7;
            (decision as any).supplierRegionalPct = 0.3;
            modified = true;
          }
          break;
        }
        case 'ci': {
          // Customer Intelligence — equal weighting across segments.
          if ((decision as any).segmentChampionsWeight == null) {
            (decision as any).segmentChampionsWeight = 0.25;
            (decision as any).segmentGrowthWeight = 0.25;
            (decision as any).segmentAtRiskWeight = 0.25;
            (decision as any).segmentOtherWeight = 0.25;
            modified = true;
          }
          break;
        }
        case 'nd': {
          // Network Design — DCs default to CLOSED.
          if ((decision as any).dcCentralStatus == null) {
            (decision as any).dcCentralStatus = 'NO';
            (decision as any).dcWestStatus = 'NO';
            modified = true;
          }
          break;
        }
        case 'pi': {
          // Product Innovation — no new product launches.
          if ((decision as any).newProductLaunch == null) {
            (decision as any).newProductLaunch = false;
            modified = true;
          }
          break;
        }
        case 'me': {
          // Market Expansion — no new regions entered.
          if ((decision as any).expandToNewRegion == null) {
            (decision as any).expandToNewRegion = false;
            modified = true;
          }
          break;
        }
      }
    }

    if (modified) {
      await decision.save();
      console.log(
        `[seedDefaults] firm=${firmId} Q${quarter}: seeded defaults for [${moduleIds.join(', ')}]`,
      );
    }
  }

  private async carryForwardDecision(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
  ): Promise<void> {
    // Is there a draft already? If so, promote it as-is. The student saved
    // draft work; respect it.
    const existing = await this.decisionModel.findOne({
      simulation: simulationId,
      firm: firmId,
      quarter,
    });

    if (existing && existing.status === DecisionStatus.DRAFT) {
      existing.status = DecisionStatus.SUBMITTED;
      existing.submittedAt = new Date();
      // submittedBy left undefined — system-submitted, not user-submitted
      await existing.save();
      console.log(
        `[carryForward] firm=${firmId} Q${quarter}: promoted DRAFT to SUBMITTED`,
      );
      return;
    }

    if (existing) {
      // Already SUBMITTED or PROCESSED — nothing to do
      return;
    }

    // No record at all. Pull last quarter's decision and clone it.
    // Latest earlier decision (not strictly quarter-1) so gaps don't reset
    // the firm to schema defaults.
    const prev = await this.decisionModel
      .findOne({
        simulation: simulationId,
        firm: firmId,
        quarter: { $lt: quarter },
      })
      .sort({ quarter: -1 })
      .lean();

    if (!prev) {
      // No prior decision either (shouldn't happen post-pre-seed, but handle
      // gracefully). Create a baseline draft and submit it.
      console.warn(
        `[carryForward] firm=${firmId} Q${quarter}: no prior decision found, ` +
          `creating baseline. This should not happen after pre-seed.`,
      );
      await this.decisionModel.create({
        simulation: simulationId,
        firm: firmId,
        quarter,
        status: DecisionStatus.SUBMITTED,
        submittedAt: new Date(),
        // Schema defaults handle the rest
      });
      return;
    }

    // Clone prev — strip mongo internals and per-quarter outcome fields.
    // Outcome fields (revenue, netIncome, etc) are computed by the engine,
    // not carried.
    const {
      _id, __v, createdAt, updatedAt,
      revenue, cogs, netIncome, grossMargin, fillRate, endingCsi,
      laborCost, freightCost, actualProduction, unitsSold,
      submittedBy, submittedAt, processedAt,
      modulesUnlockedAtSubmit,
      ...carryable
    } = prev as any;

    await this.decisionModel.create({
      ...carryable,
      // One-off purchase: do not re-execute last quarter's emergency order.
      emergencyRegionalOrder: 0,
      simulation: simulationId,
      firm: firmId,
      quarter,
      status: DecisionStatus.SUBMITTED,
      submittedAt: new Date(),
    });

    console.log(
      `[carryForward] firm=${firmId} Q${quarter}: cloned from Q${quarter - 1}`,
    );
  }

  async getFacultyForSimulation(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const facultyIds = simulation.facultyIds || [];
    const faculty = await this.userModel.find({ _id: { $in: facultyIds } });

    return {
      simulationId,
      count: faculty.length,
      faculty: faculty.map((f) => ({
        id: f._id,
        email: f.email,
        firstName: f.firstName,
        lastName: f.lastName,
        role: f.role,
      })),
    };
  }

  async addFacultyToSimulation(simulationId: string, email: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const user = await this.userModel.findOne({ email });
    if (!user)
      throw new NotFoundException(`User with email ${email} not found`);

    if (user.role !== UserRole.FACULTY)
      throw new BadRequestException(`User ${email} is not a faculty member`);

    // Check if faculty is already added
    const userObjectId = user._id as Types.ObjectId;
    if (simulation.facultyIds?.some((id) => String(id) === String(userObjectId))) {
      throw new BadRequestException(`Faculty ${email} is already added to this simulation`);
    }

    // Add faculty to simulation
    if (!simulation.facultyIds) {
      simulation.facultyIds = [];
    }
    simulation.facultyIds.push(userObjectId);
    await simulation.save();

    return {
      simulationId,
      message: `Faculty ${email} added successfully`,
      faculty: {
        id: userObjectId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async deploySimulation(simulationId: string, deploymentType: 'faculty' | 'student' = 'faculty'): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    // Check if at least one firm has been allocated
    const firms = await this.firmModel.find({ simulation: simObjectId });
    if (!firms || firms.length === 0)
      throw new BadRequestException('At least one firm must be allocated before deployment');

    if (deploymentType === 'faculty') {
      // Deploy for Faculty (stage 1)
      if (simulation.deploymentStatus !== 'NOT_DEPLOYED')
        throw new BadRequestException('Simulation is already deployed for faculty');
      
      simulation.deploymentStatus = 'FACULTY_DEPLOYED';
      simulation.deployedForFacultyAt = new Date();
    } else if (deploymentType === 'student') {
      // Deploy for Student (stage 2) - requires faculty deployment first
      if (simulation.deploymentStatus !== 'FACULTY_DEPLOYED')
        throw new BadRequestException('Simulation must be deployed for faculty before deploying for students');
      
      simulation.deploymentStatus = 'STUDENT_DEPLOYED';
      simulation.deployedForStudentAt = new Date();
    }

    await simulation.save();

    return {
      simulationId,
      message: `Simulation deployed for ${deploymentType} successfully`,
      deploymentStatus: simulation.deploymentStatus,
      deployedForFacultyAt: simulation.deployedForFacultyAt,
      deployedForStudentAt: simulation.deployedForStudentAt,
    };
  }

  // ============================================================================
  // BILLING METRICS
  // ============================================================================
  // Calculate total billed, received, and pending amounts for a simulation.
  // Uses a fixed fee per student (default $200). Can be adjusted based on requirements.
  async getBillingMetrics(simulationId: string, feePerStudent: number = 200): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);

    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const enrollments = await this.enrollmentModel.find({ simulation: simObjectId });

    // Calculate metrics
    const totalStudents = enrollments.length;
    const paidStudents = enrollments.filter((e) => e.hasPaid).length;
    const unpaidStudents = totalStudents - paidStudents;

    const totalBilled = totalStudents * feePerStudent;
    const receivedAmount = paidStudents * feePerStudent;
    const pendingAmount = unpaidStudents * feePerStudent;

    return {
      simulationId,
      simulationName: simulation.name,
      feePerStudent,
      totalStudents,
      paidStudents,
      unpaidStudents,
      totalBilled,
      receivedAmount,
      pendingAmount,
    };
  }

  // ============================================================================
  // TEST TEAM PROVISIONING
  // ============================================================================

  /**
   * Provision a complete test cohort for a simulation.
   *
   * Algorithm:
   *   1. Load the simulation and its firms.
   *   2. Find any existing mailinator test users for this simulation
   *      (matched by email pattern `test-{simId}-*@mailinator.com`).
   *   3. If existing count < (firms × studentsPerFirm), create new ones with
   *      sequential numbering, password "test1234" hashed, role STUDENT.
   *   4. For each user not already enrolled in a firm of this simulation,
   *      round-robin assign to firms (balancing existing firm sizes).
   *
   * Idempotent — running twice with same args reuses users and only enrolls
   * those who aren't already placed.
   */
  /**
   * Provision a complete test cohort for a simulation.
   *
   * Pool model: test users are GLOBAL — emails are test-1@mailinator.com,
   * test-2@mailinator.com, etc. The pool grows on demand and is shared
   * across all simulations.
   *
   * Algorithm:
   *   1. Load the simulation and its firms.
   *   2. Count existing test-N@mailinator.com users globally and find the
   *      highest N (the "high-water mark" of the pool).
   *   3. Determine which pool members aren't yet enrolled in THIS simulation —
   *      these can be immediately enrolled here.
   *   4. If pool isn't big enough to cover (firms × studentsPerFirm), create
   *      new test users with sequential numbering starting after the
   *      high-water mark.
   *   5. Round-robin enroll into firms, balanced by current firm size.
   *
   * Idempotent — running twice with same args reuses users and only enrolls
   * those who aren't already placed.
   */
// REPLACE the existing setupTestTeam method in your simulation.service.ts
// with this version.
//
// Bug fixes:
//
//   1. User creation wrote `password: hashedPassword` — the User schema field
//      is `passwordHash`. Mongoose strict mode silently dropped the unknown
//      field, so every test user got created without any stored password.
//      That's why test-1@mailinator.com (and likely test-2, test-3, ...)
//      can't log in even though they exist in the users collection.
//
//   2. Missing `displayName` and `isActive: true`. Your normal register() and
//      login flow set/check both. Without isActive: true, the login check
//      `if (!user.isActive)` rejects them as deactivated. Without displayName,
//      UI fall-back logic shows raw emails.
//
//   3. The `existing` user check inside the create loop ran a findOne per
//      iteration. Cheap enough at small scale but quadratic-ish at large
//      cohorts. Left as-is since you cap by targetTotal which is usually
//      small (12-30), but flagging for the future.

async setupTestTeam(simulationId: string, studentsPerFirm: number) {
  const simObjectId = this.toObjectId(simulationId);
  const simulation = await this.simulationModel.findById(simObjectId);
  if (!simulation) {
    throw new NotFoundException(`Simulation ${simulationId} not found`);
  }

  const firms = await this.firmModel
    .find({ simulation: simObjectId })
    .sort({ firmNumber: 1 });
  if (firms.length === 0) {
    throw new BadRequestException(
      'No firms exist for this simulation. Allocate firms first.',
    );
  }

  const targetTotal = firms.length * studentsPerFirm;

  // 1. Find ALL existing test-N@mailinator.com users globally
  //    Pattern: test-{number}@mailinator.com (e.g. test-1@, test-42@)
  const emailNumberPattern = /^test-(\d+)@mailinator\.com$/i;
  const allPoolUsers = await this.userModel
    .find({ email: { $regex: '^test-\\d+@mailinator\\.com$', $options: 'i' } });

  // Determine the high-water mark — the highest N in use globally
  let highestN = 0;
  for (const u of allPoolUsers) {
    const match = u.email.match(emailNumberPattern);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > highestN) highestN = n;
    }
  }

  // Sort pool by their N so reuse is predictable (test-1, test-2, …)
  allPoolUsers.sort((a, b) => {
    const na = parseInt((a.email.match(emailNumberPattern) || ['', '0'])[1], 10);
    const nb = parseInt((b.email.match(emailNumberPattern) || ['', '0'])[1], 10);
    return na - nb;
  });

  // 2. Of the pool users, find ones NOT already enrolled in this sim
  const existingEnrollmentsThisSim = await this.enrollmentModel.find({
    simulation: simObjectId,
    user: { $in: allPoolUsers.map((u) => u._id) },
  });
  const alreadyEnrolledHereIds = new Set(
    existingEnrollmentsThisSim.map((e) => String(e.user)),
  );

  // 2a. FILTER: split into "properly placed" (has firm) vs "unplaced" (no firm)
  const properlyPlacedIds = new Set<string>();
  const unplacedEnrollments: any[] = [];
  
  for (const enrollment of existingEnrollmentsThisSim) {
    if (enrollment.firm) {
      properlyPlacedIds.add(String(enrollment.user));
    } else {
      unplacedEnrollments.push(enrollment);
    }
  }

  const availableFromPool = allPoolUsers.filter(
    (u) => !properlyPlacedIds.has(String(u._id)),
  );

  // 2b. For unplaced enrollments, we'll assign them to firms below (don't skip them)

  // 2b. REPAIR any existing pool users that are missing passwordHash. These
  //     are leftovers from the buggy version of this method that wrote to a
  //     `password` field that didn't exist on the schema. Without this, the
  //     reused pool users would still fail to log in even after we fix the
  //     creation path below.
  const testPassword = 'test1234';
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  const brokenPoolUsers = availableFromPool.filter(
    (u: any) => !u.passwordHash,
  );
  if (brokenPoolUsers.length > 0) {
    await this.userModel.updateMany(
      { _id: { $in: brokenPoolUsers.map((u) => u._id) } },
      {
        $set: {
          passwordHash: hashedPassword,
          isActive: true,
          displayName: brokenPoolUsers[0]
            ? undefined  // set per-user below
            : undefined,
        },
      },
    );
    // displayName needs to be per-user. Do it individually since updateMany
    // doesn't easily reference other fields without an aggregation pipeline.
    for (const u of brokenPoolUsers) {
      await this.userModel.updateOne(
        { _id: u._id },
        {
          $set: {
            displayName: `${u.firstName} ${u.lastName}`.trim(),
            isActive: true,
          },
        },
      );
      // Reflect the changes on the in-memory object so the response payload
      // reports them correctly.
      (u as any).passwordHash = hashedPassword;
      (u as any).isActive = true;
      (u as any).displayName = `${u.firstName} ${u.lastName}`.trim();
    }
  }

  // 3. Create additional pool users if we don't have enough available
  const needed = Math.max(0, targetTotal - availableFromPool.length);
  let createdCount = 0;
  const newUsers: any[] = [];

  if (needed > 0) {
    let n = highestN + 1;

    for (let i = 0; i < needed; i++) {
      const email = `test-${n}@mailinator.com`;

      // Defensive: skip if somehow already exists (race condition or stale
      // high-water mark from concurrent runs).
      const existing = await this.userModel.findOne({ email });
      if (existing) {
        // If the pre-existing record is broken (no passwordHash), repair it
        // before reusing so login works.
        if (!(existing as any).passwordHash) {
          existing.passwordHash = hashedPassword;
          (existing as any).isActive = true;
          (existing as any).displayName = `${existing.firstName || 'Test'} ${existing.lastName || `Student ${n}`}`.trim();
          await existing.save();
        }
        newUsers.push(existing);
      } else {
        const firstName = 'Test';
        const lastName = `Student ${n}`;
        const newUser = await this.userModel.create({
          email,
          passwordHash: hashedPassword,             // <-- was `password` (broken)
          firstName,
          lastName,
          displayName: `${firstName} ${lastName}`,  // <-- was missing
          role: UserRole.STUDENT,
          isActive: true,                           // <-- was missing
          institutionName: simulation.institutionName,
        });
        newUsers.push(newUser);
        createdCount++;
      }
      n++;
    }
  }

  // 4. The cohort we'll enroll = available-from-pool + newly-created + unplaced enrollments needing firm assignment
  // Unplaced enrollments are special: they already have enrollment records, just need firm assignment
  const cohort = [...availableFromPool, ...newUsers].slice(0, targetTotal);
  
  // Track which unplaced enrollments we'll assign (don't assign more than needed)
  const unplacedToAssign = unplacedEnrollments.slice(0, Math.max(0, targetTotal - cohort.length));

  // 5. Get current firm sizes to balance the new assignments
  // Count properly placed students (those with existing firm assignments)
  const firmSizes = await Promise.all(
    firms.map((f) =>
      this.enrollmentModel.countDocuments({
        firm: f._id,
        status: EnrollmentStatus.ACTIVE,
      }),
    ),
  );

  let enrolledCount = 0;
  const enrollmentDetails: any[] = [];
  
  // First, assign unplaced enrollments to firms (update existing records)
  for (const enrollment of unplacedToAssign) {
    // Pick the firm with the smallest current size
    let minIdx = 0;
    for (let i = 1; i < firmSizes.length; i++) {
      if (firmSizes[i] < firmSizes[minIdx]) minIdx = i;
    }
    const targetFirm = firms[minIdx];

    // Update the unplaced enrollment with firm assignment
    await this.enrollmentModel.updateOne(
      { _id: enrollment._id },
      {
        $set: {
          firm: targetFirm._id,
          firmNumber: targetFirm.firmNumber,
          status: EnrollmentStatus.ACTIVE,
          canSubmitDecisions: true,
          canViewReports: true,
          canViewCompetitorData: false,
          hasPaid: true,
          paidAt: new Date(),
          paymentNotes: 'Auto-paid (test team)',
        },
      },
    );

    // Get user info for response
    const user = allPoolUsers.find((u) => String(u._id) === String(enrollment.user));
    if (user) {
      enrollmentDetails.push({
        email: user.email,
        firmName: targetFirm.name,
        firmNumber: targetFirm.firmNumber,
        status: 'upgraded (was unplaced)',
      });
    }

    firmSizes[minIdx]++;
    enrolledCount++;
  }

  // Then, create new enrollments for cohort users
  for (const user of cohort) {
    // Pick the firm with the smallest current size
    let minIdx = 0;
    for (let i = 1; i < firmSizes.length; i++) {
      if (firmSizes[i] < firmSizes[minIdx]) minIdx = i;
    }
    const targetFirm = firms[minIdx];

    await this.enrollmentModel.create({
      simulation: simObjectId,
      firm: targetFirm._id,
      user: user._id,
      firmNumber: targetFirm.firmNumber,
      status: EnrollmentStatus.ACTIVE,
      role: EnrollmentRole.TEAM_MEMBER,
      canSubmitDecisions: true,
      canViewReports: true,
      canViewCompetitorData: false,
      decisionsSubmitted: 0,
      hasPaid: true,
      paidAt: new Date(),
      paymentNotes: 'Auto-paid (test team)',
    });

    enrollmentDetails.push({
      email: user.email,
      firmName: targetFirm.name,
      firmNumber: targetFirm.firmNumber,
    });

    firmSizes[minIdx]++;
    enrolledCount++;
  }

  return {
    simulationId,
    firmsAllocated: firms.length,
    studentsPerFirm,
    studentsCreated: createdCount,
    studentsReused: availableFromPool.length,
    studentsRepaired: brokenPoolUsers.length,
    studentsUpgradedFromUnplaced: unplacedToAssign.length,
    studentsNewlyEnrolled: enrolledCount,
    totalEnrolled: cohort.length + unplacedToAssign.length,
    poolHighWaterMark: highestN + createdCount,
    password: testPassword,
    students: cohort.map((u) => ({
      id: String(u._id),
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
    })),
    enrollmentDetails,
    message:
      enrolledCount > 0
        ? `Provisioned ${enrolledCount} test student${enrolledCount === 1 ? '' : 's'} across ${firms.length} firms.${unplacedToAssign.length > 0 ? ` Also upgraded ${unplacedToAssign.length} previously unplaced enrollment${unplacedToAssign.length === 1 ? '' : 's'}.` : ''}`
        : 'All test students for this simulation are already enrolled.',
  };
}

/**
   * Public entry point for the quarter-tick cron sweeper. Loads the sim and
   * runs the same expiry/auto-advance path the lazy in-request check uses.
   *
   * Kept thin on purpose — all the actual logic lives in checkQuarterExpiry
   * so the lazy and scheduled paths can't drift apart.
   *
   * Returns true if the simulation was advanced, false otherwise.
   */
  async autoAdvanceExpiredQuarter(simulationId: string): Promise<boolean> {
    const simulation = await this.simulationModel.findById(
      this.toObjectId(simulationId),
    );
    if (!simulation) return false;
    return this.checkQuarterExpiry(simulation);
  }
}
