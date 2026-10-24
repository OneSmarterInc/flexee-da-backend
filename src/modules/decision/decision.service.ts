// src/modules/decision/decision.service.ts
//
// FLEXEE DA — Analytics Edition decision service.
//
// Stripped of all corporate-edition references that the cleaned schema
// no longer supports: technologies, inspection levels, shipping modes,
// carriers, warranty tiers, disposal methods, capacity expansion, VMI,
// intelligence subscriptions, shifts > 1, green score, inventory transfers,
// transferCost configs.
//
// What this file provides:
//   - create / update / submit / findById / findByFirmAndQuarter
//   - getOrCreateForQuarter (cockpit init)
//   - getFirmState (cockpit firm panel)
//   - getQuarterDecisionData (full cockpit payload — firm state, configs,
//     constraints, market info, advanced features)
//   - getSubmissionStatus (faculty view of who has submitted)
//   - validateDecision (parts/pricing/segments/me-entry checks)
//   - calculateEstimatedCost (procurement + labor + marketing + P3 launch)
//   - calculateFinancingInfo (credit tier + borrowing math)
//   - locked-module field reset on submit
//
// What changed vs. corporate edition:
//   - No technology lookup, no ownedTechKeys, no purchaseERP/etc syncing
//   - No INSPECTION/SHIPPING/CARRIER/WARRANTY/DISPOSAL/CAPACITY config tables
//   - No state.greenScore/vmiActive/warrantyTier/etc reads
//   - No shifts (always 1, baked into labor cost)
//   - No DC transfer costs (transferCost removed from DC_CONFIG)
//   - configurations.suppliers still exposes the sa module's catalog
//   - advancedFeatures only carries dcCentral and dcWest (no vmi, etc)
//   - constraints.production has no maxShifts/expansion fields
//   - constraints.dc has no transferCost fields
//   - DecisionResponseDto fields for stripped features removed entirely

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { assertCourseAccess } from '../simulation/course-access';
import {
  Decision,
  DecisionDocument,
  DecisionStatus,
  Firm,
  FirmDocument,
  QuarterState,
  QuarterStateDocument,
  Simulation,
  SimulationDocument,
  SimulationStatus,
  Enrollment,
  EnrollmentDocument,
  User,
  UserDocument,
  CreditHistory,
  CreditHistoryDocument,
  SUPPLIER_CONFIG,
  SupplierType,
  DC_CONFIG,
  UserRole,
} from '../../entities/index.entity';
import {
  CreateDecisionDto,
  UpdateDecisionDto,
  DecisionResponseDto,
  FirmStateResponseDto,
} from './dto/decision.dto';
import { SimulationService } from '../simulation/simulation.service';
import { MODULE_DECISION_FIELDS } from '../../lib/moduleDecisionMap';

// Shown to students when a save arrives after the quarter's deadline.
const QUARTER_CLOSED_MESSAGE = (quarter: number) =>
  `Quarter ${quarter} has closed, so this change was not saved. Reload the page to see the results and the next quarter.`;

/** The person making a decision call: the JWT user. */
export type DecidingUser = { _id?: unknown; role?: string };

@Injectable()
export class DecisionService {
  private readonly logger = new Logger(DecisionService.name);

  constructor(
    @InjectModel(Decision.name) private decisionModel: Model<DecisionDocument>,
    @InjectModel(Firm.name) private firmModel: Model<FirmDocument>,
    @InjectModel(QuarterState.name)
    private quarterStateModel: Model<QuarterStateDocument>,
    @InjectModel(Simulation.name)
    private simulationModel: Model<SimulationDocument>,
    @InjectModel(Enrollment.name)
    private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private simulationService: SimulationService,
    @InjectModel(CreditHistory.name)
    private creditHistoryModel: Model<CreditHistoryDocument>,
  ) {}

  // ============================================================================
  // WHO CAN DECIDE (V3 Design E)
  // ============================================================================

  /**
   * Nobody plays a reference firm. Faculty can decide only for their own firm
   * in a practice course, never for a firm in a live course. Calls with no
   * user (internal calls) are not checked.
   */
  private async assertCanDecide(
    user: DecidingUser | undefined,
    simulationId: Types.ObjectId | string,
    firmId: Types.ObjectId | string,
  ): Promise<void> {
    if (!user) return;
    const firm = await this.firmModel.findById(firmId).select('referencePath members').lean();
    if ((firm as any)?.referencePath) {
      throw new ForbiddenException('A reference firm plays a fixed path; nobody decides for it.');
    }
    if (user.role !== UserRole.FACULTY) return;
    const sim = await this.simulationModel.findById(simulationId).select('isPractice owner facultyIds').lean();
    if (!(sim as any)?.isPractice) {
      throw new ForbiddenException('Faculty can submit decisions only in a practice course.');
    }
    assertCourseAccess(user as any, sim as any);
    const enrolled = await this.enrollmentModel.exists({
      simulation: simulationId,
      firm: firmId,
      user: user._id,
      status: { $in: ['ACTIVE', 'PENDING'] },
    });
    if (!enrolled) {
      throw new ForbiddenException('You can decide only for your own practice firm.');
    }
  }

  // ============================================================================
  // QUARTER CHECK — a decision can only change while its quarter is open
  // ============================================================================

  /**
   * Refuse a save or submit unless `quarter` is the simulation's open
   * quarter. This is the early check with a clear message; the submit and
   * update writes also carry `quarterClosed: { $ne: true }` in their filter,
   * which is the check that holds if a close starts in between.
   */
  private async assertQuarterOpen(
    simulationId: Types.ObjectId | string,
    quarter: number,
  ): Promise<void> {
    const sim = await this.simulationModel
      .findById(simulationId)
      .select('currentQuarter status quarterEndsAt closingQuarter')
      .lean();
    if (!sim) {
      throw new NotFoundException(`Simulation not found`);
    }
    if (quarter !== sim.currentQuarter) {
      throw new BadRequestException(
        `This decision is for Quarter ${quarter}, but the open quarter is Quarter ${sim.currentQuarter}. Reload the page to see the open quarter.`,
      );
    }
    const pastDeadline =
      sim.status === SimulationStatus.IN_PROGRESS &&
      !!sim.quarterEndsAt &&
      Date.now() >= new Date(sim.quarterEndsAt).getTime();
    if (sim.closingQuarter === quarter || pastDeadline) {
      throw new ConflictException(QUARTER_CLOSED_MESSAGE(quarter));
    }
  }

  // ============================================================================
  // CREATE DECISION (Draft)
  // ============================================================================

  async create(dto: CreateDecisionDto, user?: DecidingUser): Promise<DecisionResponseDto> {
    await this.assertCanDecide(user, dto.simulation, dto.firm);
    const existing = await this.decisionModel.findOne({
      firm: dto.firm,
      quarter: dto.quarter,
    });

    if (existing) {
      throw new BadRequestException(
        `Decision already exists for firm ${dto.firm} quarter ${dto.quarter}`,
      );
    }

    await this.assertQuarterOpen(dto.simulation, dto.quarter);

    const sanitizedDto = await this.sanitizeLockedModuleFieldsForSave(dto, {
      simulationId: dto.simulation,
      firmId: dto.firm,
      quarter: dto.quarter,
      context: 'create',
    });

    const decision = new this.decisionModel({
      ...sanitizedDto,
      simulation: new Types.ObjectId(dto.simulation),
      firm: new Types.ObjectId(dto.firm),
      status: DecisionStatus.DRAFT,
      editedByTeam: true,
    });

    const saved = await decision.save();
    return this.toResponseDto(saved);
  }

  // ============================================================================
  // UPDATE DECISION (Draft only)
  // ============================================================================
  // No more techPurchases / intelSubscriptions sync — those features are gone.

  async update(
    id: string,
    dto: UpdateDecisionDto,
    user?: DecidingUser,
  ): Promise<DecisionResponseDto> {
    const decisionId = new Types.ObjectId(id);

    const decision = await this.decisionModel.findById(decisionId);
    if (!decision) {
      throw new NotFoundException(`Decision ${id} not found`);
    }
    await this.assertCanDecide(user, decision.simulation, decision.firm);

    // Guard: PROCESSED/LOCKED decisions can only have status changes (for reopening to DRAFT)
    if (decision.status === DecisionStatus.PROCESSED || decision.status === DecisionStatus.LOCKED) {
      const hasDataChanges = Object.entries(dto).some(
        ([key, value]) => key !== 'status' && value !== undefined
      );
      if (hasDataChanges) {
        throw new BadRequestException(
          `Cannot update decision data with status ${decision.status}. Only reopening (status change to DRAFT) is allowed.`,
        );
      }
      // Prevent status changes to anything other than DRAFT on PROCESSED/LOCKED
      if (dto.status && dto.status !== DecisionStatus.DRAFT && dto.status !== decision.status) {
        throw new BadRequestException(
          `Cannot change status to ${dto.status} from ${decision.status}. Only reopening to DRAFT is allowed.`,
        );
      }
    }
    // DRAFT and SUBMITTED: Allow all changes (data and status)

    const changesData = Object.entries(dto).some(
      ([key, value]) => key !== 'status' && value !== undefined,
    );
    // Any status change on a draft or submitted decision (submit, or
    // withdraw back to draft) needs the quarter open. Reopening a PROCESSED
    // or LOCKED decision is the existing faculty path and is left as is.
    const resubmits =
      dto.status !== undefined &&
      (dto.status as DecisionStatus) !== decision.status &&
      decision.status !== DecisionStatus.PROCESSED &&
      decision.status !== DecisionStatus.LOCKED;
    if (changesData || resubmits) {
      await this.assertQuarterOpen(decision.simulation, decision.quarter);
    }

    const sanitizedDto = await this.sanitizeLockedModuleFieldsForSave(dto, {
      simulationId: decision.simulation.toString(),
      firmId: decision.firm.toString(),
      quarter: decision.quarter,
      context: 'update',
    });

    const updated = await this.decisionModel.findOneAndUpdate(
      changesData || resubmits
        ? { _id: decisionId, quarterClosed: { $ne: true } }
        : { _id: decisionId },
      { $set: changesData ? { ...sanitizedDto, editedByTeam: true } : sanitizedDto },
      { new: true, runValidators: false },
    );

    if (!updated) {
      // The decision exists (we read it above), so the filter failed on
      // quarterClosed: the close started between our check and this write.
      throw new ConflictException(QUARTER_CLOSED_MESSAGE(decision.quarter));
    }

    return this.toResponseDto(updated);
  }

  // ============================================================================
  // SUBMIT DECISION
  // ============================================================================

  async submit(id: string, userId?: string, user?: DecidingUser): Promise<DecisionResponseDto> {
    const decision = await this.decisionModel.findById(id);

    if (!decision) {
      throw new NotFoundException(`Decision ${id} not found`);
    }
    await this.assertCanDecide(user, decision.simulation, decision.firm);

    if (decision.status !== DecisionStatus.DRAFT) {
      throw new BadRequestException(
        `Decision already submitted with status ${decision.status}`,
      );
    }

    await this.assertQuarterOpen(decision.simulation, decision.quarter);

    await this.sanitizeLockedModuleFieldsOnDocument(decision, 'submit');
    await decision.save();

    await this.validateDecision(decision);

    const latestState = await this.quarterStateModel
      .findOne({ firm: decision.firm })
      .sort({ quarter: -1 });
    const availableCash = latestState?.cash ?? 50_000_000;

    await this.saveFinancingInfo(decision, availableCash);

    // Sanitize locked-module fields at submit time
    const simulation = await this.simulationModel.findById(decision.simulation);
    if (!simulation) {
      throw new NotFoundException(`Simulation not found`);
    }

    const lockedFieldsReset: string[] = [];
    const prevDecision = await this.findPreviousDecision(
      decision.firm,
      decision.quarter,
    );
    const baselineDefaults = this.buildDecisionDefaults(prevDecision);

    for (const [moduleId, fields] of Object.entries(MODULE_DECISION_FIELDS)) {
      const isUnlocked = (simulation as any).isModuleUnlocked
        ? (simulation as any).isModuleUnlocked(moduleId)
        : true; // Defensive: if the helper isn't on the doc, assume open
      if (isUnlocked) continue;

      // Module is locked — any divergence from the baseline default is a UI bypass.
      for (const field of fields) {
        const submitted = (decision as any)[field];
        const baseline = (baselineDefaults as any)[field];
        if (
          submitted !== baseline &&
          submitted !== undefined &&
          submitted !== null
        ) {
          (decision as any)[field] = baseline;
          lockedFieldsReset.push(`${field}(M:${moduleId})`);
        }
      }
    }

    if (lockedFieldsReset.length > 0) {
      this.logger.debug(
        `[Q${decision.quarter}][firm=${decision.firm}] Reset locked-module fields to defaults: ${lockedFieldsReset.join(', ')}`,
      );
    }

    // Snapshot module-unlock state onto the decision
    (decision as any).modulesUnlockedAtSubmit = (
      simulation.moduleSchedule?.modules ?? []
    )
      .filter(
        (m: any) =>
          m.enabled &&
          (simulation as any).isModuleUnlocked?.(m.moduleId),
      )
      .map((m: any) => m.moduleId);

    // Save the checked decision while it is still a draft, then flip it to
    // SUBMITTED in one conditional write. The filter is the quarter check
    // inside the write: if the close has started, quarterClosed is true and
    // the flip finds nothing.
    await decision.save();

    const submittedFields: Record<string, unknown> = {
      status: DecisionStatus.SUBMITTED,
      submittedAt: new Date(),
      submittedHow: 'team',
    };
    if (userId) {
      submittedFields.submittedBy = new Types.ObjectId(userId);
    }

    const saved = await this.decisionModel.findOneAndUpdate(
      {
        _id: decision._id,
        status: DecisionStatus.DRAFT,
        quarterClosed: { $ne: true },
      },
      { $set: submittedFields },
      { new: true },
    );
    if (!saved) {
      throw new ConflictException(QUARTER_CLOSED_MESSAGE(decision.quarter));
    }

    if (userId) {
      await this.enrollmentModel.updateOne(
        { user: new Types.ObjectId(userId), firm: decision.firm },
        { $inc: { decisionsSubmitted: 1 } },
      );
    }

    // ▼ CHANGED 2026-05: Quarter advancement is now time-window-driven, not submission-driven.
    // Do NOT auto-advance when all firms submit. Instead, checkQuarterExpiry() will fire
    // lazily on state reads when quarterEndsAt timestamp elapses. Missing firms get
    // carryForwardDecision() auto-submission at that time.
    console.log(
      `[Q${decision.quarter}] Firm ${decision.firm} submitted decision. Waiting for quarter window to close (quarterEndsAt = ${simulation.quarterEndsAt}).`,
    );

    return this.toResponseDto(saved);
  }

  // ============================================================================
  // GET DECISION BY ID
  // ============================================================================

  async findById(id: string): Promise<DecisionResponseDto> {
    const decision = await this.decisionModel.findById(id);
    if (!decision) {
      throw new NotFoundException(`Decision ${id} not found`);
    }
    return this.toResponseDto(decision);
  }

  // ============================================================================
  // GET DECISION BY FIRM AND QUARTER
  // ============================================================================

  async findByFirmAndQuarter(
    firmId: string,
    quarter: number,
  ): Promise<DecisionResponseDto | null> {
    const decision = await this.decisionModel.findOne({
      firm: firmId,
      quarter,
    });
    return decision ? this.toResponseDto(decision) : null;
  }

  // ============================================================================
  // GET OR CREATE DECISION (for Decision Cockpit UI)
  // ============================================================================

  async getOrCreateForQuarter(
    simulationId: string,
    firmId: string,
    quarter: number,
  ): Promise<DecisionResponseDto> {
    let decision = await this.decisionModel.findOne({
      simulation: new Types.ObjectId(simulationId),
      firm: new Types.ObjectId(firmId),
      quarter,
    });

    if (!decision) {
      const prevDecision = await this.findPreviousDecision(
        new Types.ObjectId(firmId),
        quarter,
      );

      decision = new this.decisionModel({
        simulation: new Types.ObjectId(simulationId),
        firm: new Types.ObjectId(firmId),
        quarter,
        status: DecisionStatus.DRAFT,
        // Opening the cockpit makes a draft; it isn't the team's work yet.
        editedByTeam: false,
        ...this.buildDecisionDefaults(prevDecision),
      });

      decision = await decision.save();
    }

    return this.toResponseDto(decision);
  }

  // ============================================================================
  // GET FIRM STATE (for Decision Cockpit UI)
  // ============================================================================

  async getFirmState(firmId: string): Promise<FirmStateResponseDto> {
    const firm = await this.firmModel.findById(firmId);
    if (!firm) {
      throw new NotFoundException(`Firm ${firmId} not found`);
    }

    const latestState = await this.quarterStateModel
      .findOne({ firm: firmId })
      .sort({ quarter: -1 });

    return {
      id: (firm._id as Types.ObjectId).toString(),
      firmNumber: firm.firmNumber,
      name: firm.name,
      quarter: latestState?.quarter ?? 0,
      cash: latestState?.cash ?? 50_000_000,
      rawMaterials: latestState?.rawMaterialUnits ?? 0,
      finishedGoods: latestState?.finishedGoodsUnits ?? 0,
      inTransit: latestState?.inTransitUnits ?? 0,
      retailerInventory: latestState?.retailerInventory ?? 0,
      csi: latestState?.csi ?? 80,
      marketShare: latestState?.marketShare ?? 0.3333,
      perfectOrder: latestState?.perfectOrder?.overall ?? 0.84,
      retailerMode: (latestState?.retailerMode as any) ?? 'NORMAL',
      techOwned: [], // DA: No technologies in Analytics Edition
    };
  }

  private async sanitizeLockedModuleFieldsForSave<T extends object>(
    payload: T,
    opts: {
      simulationId: string;
      firmId: string;
      quarter: number;
      context: string;
    },
  ): Promise<T> {
    const simulation = await this.simulationModel.findById(
      new Types.ObjectId(opts.simulationId),
    );
    if (!simulation) {
      throw new NotFoundException(`Simulation ${opts.simulationId} not found`);
    }

    const prevDecision = await this.findPreviousDecision(
      new Types.ObjectId(opts.firmId),
      opts.quarter,
      new Types.ObjectId(opts.simulationId),
    );
    const baselineDefaults = this.buildDecisionDefaults(prevDecision);
    const sanitized: any = { ...payload };
    const stripped: string[] = [];

    for (const [moduleId, fields] of Object.entries(MODULE_DECISION_FIELDS)) {
      const isUnlocked = (simulation as any).isModuleUnlocked
        ? (simulation as any).isModuleUnlocked(moduleId)
        : true;
      if (isUnlocked) continue;

      for (const field of fields) {
        if (!(field in sanitized)) continue;
        sanitized[field] = this.lockedModuleDefaultValue(
          moduleId,
          field,
          baselineDefaults,
        );
        stripped.push(`${field}(M:${moduleId})`);
      }
    }

    if (stripped.length > 0) {
      this.logger.debug(
        `[${opts.context}] Reset locked-module fields for firm=${opts.firmId} Q${opts.quarter}: ${stripped.join(', ')}`,
      );
    }

    return sanitized as T;
  }

  private async sanitizeLockedModuleFieldsOnDocument(
    decision: DecisionDocument,
    context: string,
  ): Promise<void> {
    const simulation = await this.simulationModel.findById(decision.simulation);
    if (!simulation) {
      throw new NotFoundException(`Simulation not found`);
    }

    const prevDecision = await this.findPreviousDecision(
      decision.firm,
      decision.quarter,
      decision.simulation,
    );
    const baselineDefaults = this.buildDecisionDefaults(prevDecision);
    const stripped: string[] = [];

    for (const [moduleId, fields] of Object.entries(MODULE_DECISION_FIELDS)) {
      const isUnlocked = (simulation as any).isModuleUnlocked
        ? (simulation as any).isModuleUnlocked(moduleId)
        : true;
      if (isUnlocked) continue;

      for (const field of fields) {
        const baseline = this.lockedModuleDefaultValue(
          moduleId,
          field,
          baselineDefaults,
        );
        if ((decision as any)[field] !== baseline) {
          (decision as any)[field] = baseline;
          stripped.push(`${field}(M:${moduleId})`);
        }
      }
    }

    if (stripped.length > 0) {
      this.logger.debug(
        `[${context}] Reset locked-module fields for firm=${decision.firm} Q${decision.quarter}: ${stripped.join(', ')}`,
      );
    }
  }

  private lockedModuleDefaultValue(
    moduleId: string,
    field: string,
    baselineDefaults: Record<string, any>,
  ): any {
    if (moduleId === 'ci') return 25;
    return baselineDefaults[field];
  }

  // ============================================================================
  // VALIDATE DECISION
  // ============================================================================

  private async validateDecision(decision: DecisionDocument): Promise<void> {
    const errors: string[] = [];

    // State going INTO this quarter (state produced by previous quarter)
    const latestState = await this.quarterStateModel.findOne({
      firm: decision.firm,
      quarter: decision.quarter - 1,
    });

    const currentQuarter = decision.quarter;

    // Total production across products
    const totalProduction =
      (decision.productionP1 ?? 0) +
      (decision.productionP2 ?? 0) +
      (decision.productionP3 ?? 0);

    // Parts availability — skip on Q1 (no prior state exists)
    const isFirstQuarter = currentQuarter <= 1 || !latestState;

    if (!isFirstQuarter) {
      const partsPerUnit = 3;
      const partsNeeded = totalProduction * partsPerUnit;

      const pendingOrdersArrivingThisQuarter = await this.calculatePendingOrders(
        decision.firm.toString(),
        currentQuarter,
      );

      const currentRawMaterials = latestState!.rawMaterialUnits ?? 0;
      const currentInTransit = latestState!.inTransitUnits ?? 0;
      const globalOrders = decision.orderGlobal ?? 0;
      const globalOrdersArriving =
        pendingOrdersArrivingThisQuarter.inTransitFromPriorQuarters;

      const partsAvailable =
        currentRawMaterials +
        currentInTransit +
        globalOrdersArriving +
        globalOrders;

      if (partsAvailable < partsNeeded) {
        const shortfall = partsNeeded - partsAvailable;
        errors.push(
          `Insufficient parts for Q${currentQuarter} production. ` +
            `Need: ${partsNeeded.toLocaleString()} (${totalProduction.toLocaleString()} units × 3 parts/unit). ` +
            `Available: ${partsAvailable.toLocaleString()}. ` +
            `Shortfall: ${shortfall.toLocaleString()} parts. Increase orderGlobal or reduce production.`,
        );
      }
    }

    // Pricing range validation
    const priceP1 = decision.priceP1 ?? 500;
    const priceP2 = decision.priceP2 ?? 850;
    if (priceP1 < 250 || priceP1 > 1000) {
      errors.push(`P1 price ($${priceP1}) must be between $250 and $1,000`);
    }
    if (priceP2 < 425 || priceP2 > 1500) {
      errors.push(`P2 price ($${priceP2}) must be between $425 and $1,500`);
    }

    // Customer segment allocation — sum must be 100
    const champions = decision.segmentChampions;
    const growth = decision.segmentGrowth;
    const atRisk = decision.segmentAtRisk;
    const other = decision.segmentOther;

    if (
      champions !== null && champions !== undefined &&
      growth !== null && growth !== undefined &&
      atRisk !== null && atRisk !== undefined &&
      other !== null && other !== undefined
    ) {
      const segmentTotal = champions + growth + atRisk + other;
      if (Math.abs(segmentTotal - 100) > 1) {
        errors.push(
          `Customer segment allocation (${segmentTotal}%) must sum to 100%. ` +
            `Adjust Champions + Growth + At-Risk + Other.`,
        );
      }
    }

    // Market expansion — forecast required when entering
    if (decision.enterR4 && (decision.forecastR4 ?? 0) <= 0) {
      errors.push('R4 forecast must be greater than 0 when entering the market');
    }
    if (decision.enterR5 && (decision.forecastR5 ?? 0) <= 0) {
      errors.push('R5 forecast must be greater than 0 when entering the market');
    }
    if (decision.enterR6 && (decision.forecastR6 ?? 0) <= 0) {
      errors.push('R6 forecast must be greater than 0 when entering the market');
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Decision validation failed',
        errors,
      });
    }
  }

  // ============================================================================
  // CALCULATE ESTIMATED COST (DA simplified)
  // ============================================================================
  // Procurement ($150/unit) + labor ($20/unit) + marketing + P3 launch ($2M).

  private calculateEstimatedCost(
    decision: DecisionDocument,
    state?: QuarterStateDocument,
  ): number {
    const totalProduction =
      (decision.productionP1 ?? 0) +
      (decision.productionP2 ?? 0) +
      (decision.productionP3 ?? 0);

    const procurementCost = (decision.orderGlobal ?? 0) * 150;
    const laborCost = totalProduction * 20;

    let p3Cost = 0;
    if (decision.launchP3 && !state?.p3Launched) {
      p3Cost = 2_000_000;
    }

    return (
      procurementCost +
      laborCost +
      (decision.marketingBudget ?? 0) +
      p3Cost
    );
  }

  // ============================================================================
  // CALCULATE FINANCING INFO
  // ============================================================================

  private async calculateFinancingInfo(
    firmId: string,
    estimatedCost: number,
    availableCash: number,
    quarterState: QuarterStateDocument | null,
  ): Promise<{
    borrowingNeeded: number;
    interestCost: number;
    totalCostWithInterest: number;
    creditTierName: string;
    creditLimit: number;
    annualRate: number;
    canBorrow: boolean;
    borrowingWarning?: string;
  }> {
    const state =
      quarterState ||
      (await this.quarterStateModel
        .findOne({ firm: firmId })
        .sort({ quarter: -1 }));

    const metrics = {
      cash: state?.cash || availableCash,
      accountsReceivable: state?.accountsReceivable || 0,
      inventoryValue:
        (state?.rawMaterialUnits || 0) * 150 +
        (state?.finishedGoodsUnits || 0) * 250,
      fixedAssets: state?.fixedAssets || 0,
      accountsPayable: state?.accountsPayable || 0,
      shortTermDebt: state?.shortTermDebt || 0,
      longTermDebt: state?.longTermDebt || 0,
      revenue: 0,
      netIncome: 0,
      operatingIncome: 0,
      interestExpense: 0,
    };

    const creditScore = this.calculateCreditworthinessScore(metrics);
    const tier = this.determineCreditTier(creditScore.totalScore);
    const creditLimit = 50_000_000 * tier.creditMultiplier;

    let borrowingNeeded = 0;
    let borrowingWarning: string | undefined;

    if (estimatedCost > availableCash) {
      borrowingNeeded = estimatedCost - availableCash;
      const totalDebt = (state?.shortTermDebt || 0) + borrowingNeeded;
      if (totalDebt > creditLimit) {
        borrowingWarning =
          `Warning: Total debt ($${totalDebt.toLocaleString()}) exceeds credit limit ($${creditLimit.toLocaleString()})`;
      }
    }

    const quarterlyRate = tier.annualRate / 4;
    const interestOnExistingDebt = (state?.shortTermDebt || 0) * quarterlyRate;
    const interestOnNewBorrowing = borrowingNeeded * quarterlyRate * 0.5;
    const totalInterestCost =
      interestOnExistingDebt + interestOnNewBorrowing;

    return {
      borrowingNeeded,
      interestCost: totalInterestCost,
      totalCostWithInterest: estimatedCost + totalInterestCost,
      creditTierName: tier.name,
      creditLimit,
      annualRate: tier.annualRate,
      canBorrow: borrowingNeeded > 0 ? borrowingNeeded <= creditLimit : true,
      borrowingWarning,
    };
  }

  private calculateCreditworthinessScore(metrics: any): {
    currentRatioScore: number;
    debtToEquityScore: number;
    profitMarginScore: number;
    interestCoverageScore: number;
    cashFlowScore: number;
    totalScore: number;
  } {
    const W = {
      CURRENT_RATIO: 20,
      DEBT_TO_EQUITY: 25,
      PROFIT_MARGIN: 20,
      INTEREST_COVERAGE: 15,
      CASH_FLOW: 20,
    };
    const T = {
      CURRENT_RATIO: { excellent: 2.0, good: 1.5, fair: 1.0, poor: 0.5 },
      DEBT_TO_EQUITY: { excellent: 0.3, good: 0.5, fair: 1.0, poor: 2.0 },
      PROFIT_MARGIN: { excellent: 0.15, good: 0.1, fair: 0.05, poor: 0.0 },
      INTEREST_COVERAGE: { excellent: 5.0, good: 3.0, fair: 1.5, poor: 1.0 },
      CASH_FLOW: { excellent: 3.0, good: 2.0, fair: 1.0, poor: 0.5 },
    };
    const CASH_FLOOR = 10_000_000;

    const currentAssets =
      metrics.cash + metrics.accountsReceivable + metrics.inventoryValue;
    const currentLiabilities =
      metrics.accountsPayable + metrics.shortTermDebt;
    const totalDebt = metrics.shortTermDebt + metrics.longTermDebt;
    const totalAssets = currentAssets + metrics.fixedAssets;
    const equity =
      totalAssets - (currentLiabilities + metrics.longTermDebt);

    const currentRatio =
      currentLiabilities > 0 ? currentAssets / currentLiabilities : 999;
    const debtToEquity = equity > 0 ? totalDebt / equity : 999;
    const profitMargin =
      metrics.revenue > 0 ? metrics.netIncome / metrics.revenue : 0;
    const interestCoverage =
      metrics.interestExpense > 0
        ? metrics.operatingIncome / metrics.interestExpense
        : 999;
    const cashFloorRatio = metrics.cash / CASH_FLOOR;

    const score = (value: number, thresholds: any, lower: boolean) => {
      if (!lower) {
        if (value >= thresholds.excellent) return 1.0;
        if (value >= thresholds.good) return 0.8;
        if (value >= thresholds.fair) return 0.6;
        if (value >= thresholds.poor) return 0.3;
        return 0.1;
      } else {
        if (value <= thresholds.excellent) return 1.0;
        if (value <= thresholds.good) return 0.8;
        if (value <= thresholds.fair) return 0.6;
        if (value <= thresholds.poor) return 0.3;
        return 0.1;
      }
    };

    const currentRatioScore =
      W.CURRENT_RATIO * score(currentRatio, T.CURRENT_RATIO, false);
    const debtToEquityScore =
      W.DEBT_TO_EQUITY * score(debtToEquity, T.DEBT_TO_EQUITY, true);
    const profitMarginScore =
      W.PROFIT_MARGIN * score(profitMargin, T.PROFIT_MARGIN, false);
    const interestCoverageScore =
      W.INTEREST_COVERAGE *
      score(interestCoverage, T.INTEREST_COVERAGE, false);
    const cashFlowScore =
      W.CASH_FLOW * score(cashFloorRatio, T.CASH_FLOW, false);

    const totalScore = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          currentRatioScore +
            debtToEquityScore +
            profitMarginScore +
            interestCoverageScore +
            cashFlowScore,
        ),
      ),
    );

    return {
      currentRatioScore: Math.round(currentRatioScore),
      debtToEquityScore: Math.round(debtToEquityScore),
      profitMarginScore: Math.round(profitMarginScore),
      interestCoverageScore: Math.round(interestCoverageScore),
      cashFlowScore: Math.round(cashFlowScore),
      totalScore,
    };
  }

  private determineCreditTier(score: number): {
    name: string;
    minScore: number;
    creditMultiplier: number;
    annualRate: number;
  } {
    if (score >= 80)
      return { name: 'Excellent', minScore: 80, creditMultiplier: 2.0, annualRate: 0.08 };
    if (score >= 60)
      return { name: 'Good', minScore: 60, creditMultiplier: 1.5, annualRate: 0.12 };
    if (score >= 40)
      return { name: 'Fair', minScore: 40, creditMultiplier: 1.0, annualRate: 0.18 };
    if (score >= 20)
      return { name: 'Poor', minScore: 20, creditMultiplier: 0.5, annualRate: 0.24 };
    return { name: 'Distressed', minScore: 0, creditMultiplier: 0.25, annualRate: 0.30 };
  }

  // ============================================================================
  // CONVERT TO RESPONSE DTO (DA-only fields)
  // ============================================================================

  private toResponseDto(decision: DecisionDocument): DecisionResponseDto {
    const totalForecast =
      (decision.forecastR1 ?? 0) +
      (decision.forecastR2 ?? 0) +
      (decision.forecastR3 ?? 0);
    const totalProduction =
      (decision.productionP1 ?? 0) +
      (decision.productionP2 ?? 0) +
      (decision.productionP3 ?? 0);

    const totalEstimatedCost = this.calculateEstimatedCost(decision);
    const procurementCost = (decision.orderGlobal ?? 0) * 150;
    const estimatedLaborCost = totalProduction * 20;

    return {
      id: (decision._id as Types.ObjectId).toString(),
      simulation: decision.simulation.toString(),
      firm: decision.firm.toString(),
      quarter: decision.quarter,
      status: decision.status,

      // ds — Demand Science
      forecastMethod: (decision.forecastMethod as any) ?? 'GUT',
      forecastR1: decision.forecastR1,
      forecastR2: decision.forecastR2,
      forecastR3: decision.forecastR3,
      totalForecast,

      // sa — Supplier Analytics
      primarySupplier: decision.primarySupplier,
      secondarySupplier: decision.secondarySupplier,
      primaryAllocation: decision.primaryAllocation,
      emergencyRegionalOrder: decision.emergencyRegionalOrder,
      orderGlobal: decision.orderGlobal,
      procurementCost,

      // Baseline production
      productionP1: decision.productionP1,
      productionP2: decision.productionP2,
      productionP3: decision.productionP3,
      totalProduction,

      // Pricing
      priceP1: decision.priceP1,
      priceP2: decision.priceP2,
      p3Price: decision.p3Price,

      // ci — Customer Intelligence
      marketingBudget: decision.marketingBudget,
      segmentChampions: decision.segmentChampions,
      segmentGrowth: decision.segmentGrowth,
      segmentAtRisk: decision.segmentAtRisk,
      segmentOther: decision.segmentOther,

      // nd — Network Design
      dcCentralStatus: decision.dcCentralStatus,
      dcWestStatus: decision.dcWestStatus,
      allocateCentral: decision.allocateCentral,
      allocateWest: decision.allocateWest,

      // pi — Product Innovation (P3)
      launchP3: decision.launchP3,
      p3Config: decision.p3Config,

      // me — Market Expansion
      enterR4: decision.enterR4,
      enterR5: decision.enterR5,
      enterR6: decision.enterR6,
      forecastR4: decision.forecastR4,
      forecastR5: decision.forecastR5,
      forecastR6: decision.forecastR6,

      // Cost summary
      estimatedLaborCost,
      totalEstimatedCost,

      // Module unlock snapshot
      modulesUnlockedAtSubmit:
        (decision as any).modulesUnlockedAtSubmit ?? [],

      // Timestamps
      createdAt: (decision as any)['createdAt'],
      updatedAt: (decision as any)['updatedAt'],
      submittedAt: decision.submittedAt,
    };
  }

  // ============================================================================
  // SAVE FINANCING INFORMATION
  // ============================================================================

  private async saveFinancingInfo(
    decision: DecisionDocument,
    availableCash: number,
  ): Promise<void> {
    const quarterState = await this.quarterStateModel
      .findOne({ firm: decision.firm })
      .sort({ quarter: -1 });

    const estimatedCost = this.calculateEstimatedCost(
      decision,
      quarterState || undefined,
    );
    const financingInfo = await this.calculateFinancingInfo(
      decision.firm.toString(),
      estimatedCost,
      availableCash,
      quarterState,
    );

    decision.estimatedTotalCost = estimatedCost;
    decision.borrowingNeeded = financingInfo.borrowingNeeded;
    decision.interestCost = financingInfo.interestCost;
    decision.creditLineRate = financingInfo.annualRate;
    decision.totalCostWithInterest = financingInfo.totalCostWithInterest;
  }

  // ============================================================================
  // BUILD DECISION DEFAULTS
  // ============================================================================
  // Carry forward from prev quarter or fall back to schema defaults.

  async getAllForFirm(firmId: string): Promise<DecisionResponseDto[]> {
    const decisions = await this.decisionModel
      .find({ firm: new Types.ObjectId(firmId) })
      .sort({ quarter: 1 });
    return decisions.map((d) => this.toResponseDto(d));
  }

  // Most recent decision this firm made BEFORE `quarter` (not just quarter-1),
  // so a gap in the history never resets the form to hard-coded defaults.
  private async findPreviousDecision(
    firm: Types.ObjectId,
    quarter: number,
    simulation?: Types.ObjectId,
  ): Promise<DecisionDocument | null> {
    const filter: Record<string, any> = { firm, quarter: { $lt: quarter } };
    if (simulation) filter.simulation = simulation;
    return this.decisionModel.findOne(filter).sort({ quarter: -1 });
  }

  private buildDecisionDefaults(
    prev: DecisionDocument | null,
  ): Record<string, any> {
    return {
      // ds
      forecastR1: prev?.forecastR1 ?? 80000,
      forecastR2: prev?.forecastR2 ?? 70000,
      forecastR3: prev?.forecastR3 ?? 50000,
      forecastMethod: prev?.forecastMethod ?? 'GUT',

      // sa
      primarySupplier: prev?.primarySupplier ?? 'SUP001',
      secondarySupplier: prev?.secondarySupplier ?? 'NONE',
      primaryAllocation: prev?.primaryAllocation ?? 100,
      // One-off purchase: never carried forward, so a past emergency order
      // is not silently re-executed (and re-charged) every quarter.
      emergencyRegionalOrder: 0,
      orderGlobal: prev?.orderGlobal ?? 600000,

      // Baseline production
      productionP1: prev?.productionP1 ?? 120000,
      productionP2: prev?.productionP2 ?? 80000,

      // Pricing
      priceP1: prev?.priceP1 ?? 500,
      priceP2: prev?.priceP2 ?? 850,

      // ci
      marketingBudget: prev?.marketingBudget ?? 5_000_000,
      segmentChampions: prev?.segmentChampions ?? 25,
      segmentGrowth: prev?.segmentGrowth ?? 25,
      segmentAtRisk: prev?.segmentAtRisk ?? 25,
      segmentOther: prev?.segmentOther ?? 25,

      // nd
      dcCentralStatus: prev?.dcCentralStatus ?? 'NO',
      dcWestStatus: prev?.dcWestStatus ?? 'NO',
      allocateCentral: prev?.allocateCentral ?? 0,
      allocateWest: prev?.allocateWest ?? 0,

      // pi (P3)
      launchP3: prev?.launchP3 ?? false,
      p3Config: prev?.p3Config ?? 'STANDARD',
      p3Price: prev?.p3Price ?? 549,
      productionP3: prev?.productionP3 ?? 0,

      // me (R4-R6)
      enterR4: prev?.enterR4 ?? false,
      forecastR4: prev?.forecastR4 ?? 0,
      enterR5: prev?.enterR5 ?? false,
      forecastR5: prev?.forecastR5 ?? 0,
      enterR6: prev?.enterR6 ?? false,
      forecastR6: prev?.forecastR6 ?? 0,
    };
  }

  // ============================================================================
  // CALCULATE PENDING ORDERS
  // ============================================================================
  // Global orders take ~45 days (≈0.5 quarters). Q3 placement → arrives Q4.

  private async calculatePendingOrders(
    firmId: string,
    currentQuarter: number,
  ): Promise<{
    inTransitFromPriorQuarters: number;
    globalOrdersArriving: {
      placedQuarter: number;
      quantity: number;
      arrivalQuarter: number;
    }[];
    pendingOrderDetails: string;
  }> {
    const GLOBAL_LEAD_TIME_QUARTERS = 0.5;

    const priorDecisions = await this.decisionModel.find({
      firm: new Types.ObjectId(firmId),
      quarter: { $lt: currentQuarter },
      status: { $in: [DecisionStatus.SUBMITTED, DecisionStatus.PROCESSED] },
    });

    let totalInTransit = 0;
    const arrivingOrders: {
      placedQuarter: number;
      quantity: number;
      arrivalQuarter: number;
    }[] = [];

    priorDecisions.forEach((decision) => {
      const global = decision.orderGlobal ?? 0;
      if (global <= 0) return;

      const expectedArrivalQuarter = Math.ceil(
        decision.quarter + GLOBAL_LEAD_TIME_QUARTERS,
      );

      if (expectedArrivalQuarter === currentQuarter) {
        totalInTransit += global;
        arrivingOrders.push({
          placedQuarter: decision.quarter,
          quantity: global,
          arrivalQuarter: expectedArrivalQuarter,
        });
      }
    });

    const details =
      arrivingOrders
        .map(
          (o) =>
            `Q${o.placedQuarter}: ${o.quantity.toLocaleString()} units → Q${o.arrivalQuarter}`,
        )
        .join('; ') || 'None';

    return {
      inTransitFromPriorQuarters: totalInTransit,
      globalOrdersArriving: arrivingOrders,
      pendingOrderDetails: details,
    };
  }

  // ============================================================================
  // GET QUARTER DECISION DATA
  // ============================================================================
  // Comprehensive cockpit payload — firm state, configurations, constraints.
  // All corporate-edition config tables (inspection, shipping, carrier,
  // warranty, disposal, capacity expansion) removed. VMI section dropped.

  async getQuarterDecisionData(
    simulationId: string,
    firmId: string,
    quarter: number,
  ): Promise<any> {
    const firm = await this.firmModel.findById(firmId);
    if (!firm) {
      throw new NotFoundException(`Firm ${firmId} not found`);
    }

    const simulation = await this.simulationModel.findById(
      new Types.ObjectId(simulationId),
    );
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const prevDecision = await this.findPreviousDecision(
      new Types.ObjectId(firmId),
      quarter,
    );

    const decision = await this.decisionModel.findOneAndUpdate(
      {
        simulation: new Types.ObjectId(simulationId),
        firm: new Types.ObjectId(firmId),
        quarter,
      },
      {
        $setOnInsert: {
          simulation: new Types.ObjectId(simulationId),
          firm: new Types.ObjectId(firmId),
          quarter,
          status: DecisionStatus.DRAFT,
          editedByTeam: false,
          ...this.buildDecisionDefaults(prevDecision),
        },
      },
      { upsert: true, new: true, lean: false },
    );

    if (!decision) {
      throw new NotFoundException(
        `Could not get-or-create decision for firm ${firmId} Q${quarter}`,
      );
    }

    // State going INTO this quarter
    const currentState = await this.quarterStateModel.findOne({
      firm: firmId,
      quarter: quarter - 1,
    });

    const previousState = await this.quarterStateModel.findOne({
      firm: firmId,
      quarter: quarter - 2,
    });

    const pendingOrders = await this.calculatePendingOrders(firmId, quarter);

    if (pendingOrders.inTransitFromPriorQuarters > 0) {
      console.log(
        `[Order Tracking Q${quarter}] Firm ${firm.name} has ${pendingOrders.inTransitFromPriorQuarters.toLocaleString()} units arriving: ${pendingOrders.pendingOrderDetails}`,
      );
    }

    // ── Build current state response ─────────────────────────────────────
    const currentStateResponse = currentState
      ? {
          quarter: currentState.quarter,
          cash: currentState.cash,
          accountsReceivable: currentState.accountsReceivable,
          accountsPayable: currentState.accountsPayable,
          shortTermDebt: currentState.shortTermDebt,
          longTermDebt: currentState.longTermDebt,
          rawMaterialUnits: currentState.rawMaterialUnits,
          finishedGoodsUnits: currentState.finishedGoodsUnits,
          inTransitUnits:
            currentState.inTransitUnits +
            pendingOrders.inTransitFromPriorQuarters,
          // Aliases for frontend
          rawMaterials: currentState.rawMaterialUnits,
          finishedGoods: currentState.finishedGoodsUnits,
          inTransit:
            currentState.inTransitUnits +
            pendingOrders.inTransitFromPriorQuarters,
          ordersInTransit: currentState.ordersInTransit,
          pendingOrderArrivals: pendingOrders.globalOrdersArriving,
          retailerInventory: currentState.retailerInventory,
          csi: currentState.csi,
          marketShare: currentState.marketShare,
          perfectOrder: currentState.perfectOrder,
          retailerMode: currentState.retailerMode,
          customersLoyal: currentState.customersLoyal,
          customersInPlay: currentState.customersInPlay,
          cumulativeRevenue: currentState.cumulativeRevenue,
          cumulativeProfit: currentState.cumulativeProfit,

          // nd — DC state
          dcCentralOpen: currentState.dcCentralOpen ?? false,
          dcCentralInventory: currentState.dcCentralInventory ?? 0,
          dcWestOpen: currentState.dcWestOpen ?? false,
          dcWestInventory: currentState.dcWestInventory ?? 0,
          dcTotalOpex: currentState.dcTotalOpex ?? 0,

          // Capacity (fixed in DA)
          capacityUnits: currentState.capacityUnits ?? 250000,

          // me — Market Expansion
          r4Active: currentState.r4Active ?? false,
          r5Active: currentState.r5Active ?? false,
          r6Active: currentState.r6Active ?? false,
          r4EntryQuarter: currentState.r4EntryQuarter ?? null,
          r5EntryQuarter: currentState.r5EntryQuarter ?? null,
          r6EntryQuarter: currentState.r6EntryQuarter ?? null,

          // pi — Product Innovation
          p3Launched: currentState.p3Launched ?? false,
          p3LaunchQuarter: currentState.p3LaunchQuarter ?? null,
          p3Config: currentState.p3Config ?? null,

          // Credit
          creditScore: currentState.creditScore ?? 0,
          creditTier: currentState.creditTier ?? 'Fair',
          creditLimit: currentState.creditLimit ?? 50_000_000,
          currentInterestRate: currentState.currentInterestRate ?? 0.18,

          // SCRM
          scrmRiskScore: currentState.scrmRiskScore ?? 0,
          scrmRiskLevel: currentState.scrmRiskLevel ?? 'LOW',
        }
      : {
          // Q1 cold-start defaults
          quarter: 0,
          cash: 50_000_000,
          accountsReceivable: 0,
          accountsPayable: 0,
          shortTermDebt: 0,
          longTermDebt: 0,
          rawMaterialUnits: 0,
          finishedGoodsUnits: 0,
          inTransitUnits: 0,
          rawMaterials: 0,
          finishedGoods: 0,
          inTransit: 0,
          ordersInTransit: 0,
          pendingOrderArrivals: [],
          retailerInventory: 0,
          csi: 80,
          marketShare: 0.3333,
          perfectOrder: {
            onTime: 0.92,
            inFull: 0.95,
            damageFree: 0.97,
            documentation: 0.99,
            overall: 0.84,
          },
          retailerMode: 'NORMAL',
          customersLoyal: 0,
          customersInPlay: 0,
          cumulativeRevenue: 0,
          cumulativeProfit: 0,
          dcCentralOpen: false,
          dcCentralInventory: 0,
          dcWestOpen: false,
          dcWestInventory: 0,
          dcTotalOpex: 0,
          capacityUnits: 250000,
          r4Active: false,
          r5Active: false,
          r6Active: false,
          r4EntryQuarter: null,
          r5EntryQuarter: null,
          r6EntryQuarter: null,
          p3Launched: false,
          p3LaunchQuarter: null,
          p3Config: null,
          creditScore: 0,
          creditTier: 'Fair',
          creditLimit: 50_000_000,
          currentInterestRate: 0.18,
          scrmRiskScore: 0,
          scrmRiskLevel: 'LOW',
        };

    // Capacity is fixed in DA — no expansion math
    const totalCapacity = currentStateResponse.capacityUnits;

    return {
      decision: this.toResponseDto(decision),
      firmState: {
        id: (firm._id as Types.ObjectId).toString(),
        firmNumber: firm.firmNumber,
        name: firm.name,
        color: firm.color,
        quarter,
        cumulativeRevenue: firm.cumulativeRevenue,
        cumulativeProfit: firm.cumulativeProfit,
        currentState: currentStateResponse,
        previousState: previousState
          ? {
              quarter: previousState.quarter,
              cash: previousState.cash,
              rawMaterialUnits: previousState.rawMaterialUnits,
              finishedGoodsUnits: previousState.finishedGoodsUnits,
              retailerInventory: previousState.retailerInventory,
              csi: previousState.csi,
              marketShare: previousState.marketShare,
              perfectOrder: previousState.perfectOrder,
              cumulativeRevenue: previousState.cumulativeRevenue,
              cumulativeProfit: previousState.cumulativeProfit,
              customersLoyal: previousState.customersLoyal,
              customersInPlay: previousState.customersInPlay,
              capacityUnits: previousState.capacityUnits ?? 250000,
            }
          : null,
      },
      configurations: {
        // sa module supplier catalog (full 6-supplier set)
        suppliers: [
          { id: 'SUP001', label: 'SUP001 — GlobalTech Mfg (China)',         country: 'China',   unitCost: 42.50, leadTimeDays: 45, onTimeDelivery: 0.88, defectRate: 0.025, tariffRate: 0.25, freightPerUnit: 5.00, riskLevel: 'MEDIUM', capacity: 500000 },
          { id: 'SUP002', label: 'SUP002 — Precision Parts Inc (USA)',       country: 'USA',     unitCost: 58.00, leadTimeDays: 14, onTimeDelivery: 0.96, defectRate: 0.008, tariffRate: 0,    freightPerUnit: 2.00, riskLevel: 'LOW',    capacity: 200000 },
          { id: 'SUP003', label: 'SUP003 — EuroComponents GmbH (Germany)',   country: 'Germany', unitCost: 54.00, leadTimeDays: 21, onTimeDelivery: 0.94, defectRate: 0.012, tariffRate: 0.05, freightPerUnit: 3.00, riskLevel: 'LOW',    capacity: 300000 },
          { id: 'SUP004', label: 'SUP004 — Pacific Rim Supply (Vietnam)',    country: 'Vietnam', unitCost: 38.00, leadTimeDays: 52, onTimeDelivery: 0.82, defectRate: 0.035, tariffRate: 0.05, freightPerUnit: 5.00, riskLevel: 'HIGH',   capacity: 400000 },
          { id: 'SUP005', label: 'SUP005 — MexiParts SA (Mexico)',           country: 'Mexico',  unitCost: 48.00, leadTimeDays: 10, onTimeDelivery: 0.91, defectRate: 0.018, tariffRate: 0,    freightPerUnit: 2.50, riskLevel: 'MEDIUM', capacity: 250000 },
          { id: 'SUP006', label: 'SUP006 — IndiaSource Ltd (India)',         country: 'India',   unitCost: 36.00, leadTimeDays: 42, onTimeDelivery: 0.84, defectRate: 0.030, tariffRate: 0.05, freightPerUnit: 4.50, riskLevel: 'HIGH',   capacity: 600000 },
        ],
        // P3 (pi module) configurations
        p3Configs: [
          { id: 'STANDARD', label: 'Standard',  basePrice: 549, qualityIndex: 0.85 },
          { id: 'PREMIUM',  label: 'Premium',   basePrice: 749, qualityIndex: 1.00 },
          { id: 'BUDGET',   label: 'Budget',    basePrice: 399, qualityIndex: 0.70 },
        ],
      },
      advancedFeatures: {
        // nd module — DC config
        dcCentral: {
          name: DC_CONFIG.CENTRAL.name,
          location: DC_CONFIG.CENTRAL.location,
          setupCost: DC_CONFIG.CENTRAL.setupCost,
          quarterlyOpex: DC_CONFIG.CENTRAL.quarterlyOpex,
          capacity: DC_CONFIG.CENTRAL.capacity,
          serviceBonus: DC_CONFIG.CENTRAL.serviceBonus,
          regionServed: DC_CONFIG.CENTRAL.regionServed,
        },
        dcWest: {
          name: DC_CONFIG.WEST.name,
          location: DC_CONFIG.WEST.location,
          setupCost: DC_CONFIG.WEST.setupCost,
          quarterlyOpex: DC_CONFIG.WEST.quarterlyOpex,
          capacity: DC_CONFIG.WEST.capacity,
          serviceBonus: DC_CONFIG.WEST.serviceBonus,
          regionServed: DC_CONFIG.WEST.regionServed,
        },
      },
      constraints: {
        production: {
          maxTotal: totalCapacity,
          baseCapacity: totalCapacity,
          partsPerUnit: 3,
        },
        financial: {
          minCash: 10_000_000,
          maxMarketingBudget:
            (currentStateResponse.cash ?? 50_000_000) * 0.2,
          cashFloor: 10_000_000,
        },
        pricing: {
          maxPrice: { P1: 1000, P2: 1500, P3: 1200 },
          minPrice: { P1: 250,  P2: 425,  P3: 300  },
        },
        procurement: {
          globalLeadTime:    SUPPLIER_CONFIG[SupplierType.GLOBAL].leadTime,
          regionalLeadTime:  SUPPLIER_CONFIG[SupplierType.REGIONAL].leadTime,
          globalCostPerUnit: SUPPLIER_CONFIG[SupplierType.GLOBAL].unitCost,
          regionalCostPerUnit:
            SUPPLIER_CONFIG[SupplierType.REGIONAL].unitCost,
        },
        inventory: {
          maxRawMaterial:
            (currentStateResponse.cash ?? 50_000_000) * 0.15,
          maxFinishedGoods:
            (currentStateResponse.cash ?? 50_000_000) * 0.15,
          targetRetailerInventoryMonths: 3,
        },
        dc: {
          dcCentralCapacity: DC_CONFIG.CENTRAL.capacity,
          dcWestCapacity:    DC_CONFIG.WEST.capacity,
        },
        // ci — segment allocation must sum to 100
        segments: {
          mustSumTo: 100,
          fields: [
            'segmentChampions',
            'segmentGrowth',
            'segmentAtRisk',
            'segmentOther',
          ],
        },
      },
      marketInfo: {
        quarter,
        calendarQuarter: ((quarter - 1) % 4) + 1,
        firmMarketShare: currentStateResponse.marketShare ?? 0.3333,
        firmCsi: currentStateResponse.csi ?? 80,
        isFirstQuarter: quarter <= 1 || !currentState,
      },

      // ▼ NEW: Quarter pacing for cockpit countdown
      quarterPacing: {
        durationDays: simulation.quarterDurationDays,
        startedAt: simulation.quarterStartedAt,
        endsAt: simulation.quarterEndsAt,
        msRemaining: simulation.quarterEndsAt
          ? Math.max(0, simulation.quarterEndsAt.getTime() - Date.now())
          : null,
        isWindowOpen:
          (simulation.status as any) === 'IN_PROGRESS' &&
          !!simulation.quarterEndsAt &&
          Date.now() < simulation.quarterEndsAt.getTime(),
      },
    };
  }

  // ============================================================================
  // GET SUBMISSION STATUS
  // ============================================================================

  async getSubmissionStatus(
    simulationId: string,
    quarter?: number,
  ): Promise<any> {
    const sim = await this.simulationModel.findById(
      new Types.ObjectId(simulationId),
    );
    if (!sim) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const targetQuarter = quarter ?? sim.currentQuarter;
    const firms = await this.firmModel.find({
      simulation: new Types.ObjectId(simulationId),
    });

    const submissionStatus = await Promise.all(
      firms.map(async (firm) => {
        const decision = await this.decisionModel.findOne({
          firm: firm._id,
          quarter: targetQuarter,
        });
        return {
          firmId: firm._id,
          firmNumber: firm.firmNumber,
          firmName: firm.name,
          decisionId: decision?._id,
          status: decision?.status ?? 'NOT_CREATED',
          submittedAt: decision?.submittedAt,
        };
      }),
    );

    const allSubmitted = submissionStatus.every(
      (s) =>
        s.status === DecisionStatus.SUBMITTED ||
        s.status === DecisionStatus.PROCESSED,
    );

    return {
      simulationId,
      quarter: targetQuarter,
      totalFirms: firms.length,
      submittedCount: submissionStatus.filter(
        (s) =>
          s.status === DecisionStatus.SUBMITTED ||
          s.status === DecisionStatus.PROCESSED,
      ).length,
      allSubmitted,
      submissions: submissionStatus,
    };
  }
}
