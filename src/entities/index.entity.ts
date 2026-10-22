// src/schemas/index.ts
// FLEXEE 2.0 DA — Analytics Edition Schema
//
// Stripped of all corporate-edition mechanics: tech purchases, VMI, warranty,
// green score, multi-carrier, capacity expansion, intelligence subscriptions,
// shifts, inspection levels, shipping modes.
//
// Kept: the six analytics modules (ds, sa, ci, nd, pi, me), the underlying
// demand model (seasonality, retailer brain, customer pools, regional
// competition), random events (faculty-triggered + random), credit/cash
// constraints, SCRM, KPI scoring, BSC, 10-Q reports, demand history.

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Re-export supplier profiles
export type {
  SupplierProfile,
  SupplierProcurementResult,
} from './supplier-profiles';
export {
  SUPPLIER_PROFILES,
  calculateSupplierProcurement,
} from './supplier-profiles';

// ============================================================================
// ENUMS
// ============================================================================
export enum SimulationStatus {
  CREATED = 'CREATED',
  INITIALIZED = 'INITIALIZED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
}

export enum RetailerMode {
  NORMAL = 'NORMAL',
  PANIC = 'PANIC',
  CLEARANCE = 'CLEARANCE',
}

export enum DecisionStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PROCESSED = 'PROCESSED',
  LOCKED = 'LOCKED',
}

export enum EventType {
  SUPPLY_DISRUPTION = 'SUPPLY_DISRUPTION',
  DEMAND_SURGE = 'DEMAND_SURGE',
  COMPETITOR_STUMBLE = 'COMPETITOR_STUMBLE',
  ECONOMIC_DOWNTURN = 'ECONOMIC_DOWNTURN',
  RAW_MATERIAL_SPIKE = 'RAW_MATERIAL_SPIKE',
}

export enum EventEffect {
  PARTS_DELAYED = 'PARTS_DELAYED',
  DEMAND_SPIKE = 'DEMAND_SPIKE',
  STEAL_INPLAY = 'STEAL_INPLAY',
  DEMAND_DROP = 'DEMAND_DROP',
  COST_INCREASE = 'COST_INCREASE',
}

export enum EventSource {
  RANDOM = 'RANDOM',
  FACULTY_TRIGGERED = 'FACULTY_TRIGGERED',
  SCENARIO = 'SCENARIO',
}

export enum SupplierType {
  GLOBAL = 'GLOBAL',
  REGIONAL = 'REGIONAL',
}

export enum ScMaturityLevel {
  BASIC = 'BASIC',
  DEVELOPING = 'DEVELOPING',
  ADVANCED = 'ADVANCED',
}

export enum UserRole {
  STUDENT = 'STUDENT',
  FACULTY = 'FACULTY',
  ADMIN = 'ADMIN',
}

export enum EnrollmentStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
}

export enum EnrollmentRole {
  TEAM_MEMBER = 'TEAM_MEMBER',
  TEAM_LEAD = 'TEAM_LEAD',
  OBSERVER = 'OBSERVER',
}

export enum DCStatus {
  NO = 'NO',
  YES = 'YES',
  CLOSE = 'CLOSE',
}

export enum ForecastMethod {
  GUT = 'GUT',
  MODEL = 'MODEL',
}

export enum ForecastSource {
  GUT = 'GUT',
  MODEL = 'MODEL',
  BASELINE = 'BASELINE',
}

export enum SCRMLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  ELEVATED = 'ELEVATED',
  HIGH = 'HIGH',
}

// ============================================================================
// SUB-DOCUMENT SCHEMAS
// ============================================================================
@Schema({ _id: false })
export class SeasonalityConfig {
  @Prop({ default: 0.85 })
  q1Multiplier!: number;

  @Prop({ default: 1.0 })
  q2Multiplier!: number;

  @Prop({ default: 1.0 })
  q3Multiplier!: number;

  @Prop({ default: 1.25 })
  q4Multiplier!: number;
}

// Module Schedule
export enum ModuleScheduleMode {
  PROGRESSIVE = 'PROGRESSIVE',
  ALL_OPEN = 'ALL_OPEN',
}

export enum SchedulePreset {
  BASIC_SCM = 'BASIC_SCM',
  SHORT_COURSE = 'SHORT_COURSE',
  STANDARD_COURSE = 'STANDARD_COURSE',
  LONG_COURSE = 'LONG_COURSE',
  CUSTOM = 'CUSTOM',
}

@Schema({ _id: false })
export class AnalyticsModuleConfig {
  @Prop({ required: true, enum: ['ds', 'sa', 'ci', 'nd', 'pi', 'me'] })
  moduleId!: string;

  @Prop({ required: true })
  order!: number;

  @Prop({ required: true })
  unlocksAtQuarter!: number;

  @Prop({ default: true })
  enabled!: boolean;
}

@Schema({ _id: false })
export class ModuleSchedule {
  @Prop({ enum: ModuleScheduleMode, default: ModuleScheduleMode.ALL_OPEN })
  mode!: ModuleScheduleMode;

  @Prop({ type: [AnalyticsModuleConfig], default: () => [] })
  modules!: AnalyticsModuleConfig[];
}

export type AnalyticsModuleId = 'ds' | 'sa' | 'ci' | 'nd' | 'pi' | 'me';

export const ANALYTICS_MODULE_IDS: AnalyticsModuleId[] = [
  'ds', 'sa', 'ci', 'nd', 'pi', 'me',
];

export const ANALYTICS_MODULE_CATALOG = [
  { id: 'ds' as AnalyticsModuleId, title: 'Demand Science', order: 1 },
  { id: 'sa' as AnalyticsModuleId, title: 'Supplier Analytics', order: 2 },
  { id: 'ci' as AnalyticsModuleId, title: 'Customer Intelligence', order: 3 },
  { id: 'nd' as AnalyticsModuleId, title: 'Network Design', order: 4 },
  { id: 'pi' as AnalyticsModuleId, title: 'Product Innovation', order: 5 },
  { id: 'me' as AnalyticsModuleId, title: 'Market Expansion', order: 6 },
];

// ────────────────────────────────────────────────────────────────────────────
// FeatureToggles — DA edition (11 fields, was 20)
// ────────────────────────────────────────────────────────────────────────────
// Kept: the underlying demand-model toggles, plus the three module-related
// flags that gate engine branches (analyticsMode for ci/sa, productInnovation
// for pi, marketExpansion for me, regionalDCs for nd).
// Removed: capacityExpansion, multiCarrierSelection, returnsGreenScore,
// intelligenceCenter, vmi, technologyInvestments, qualityControl,
// transportLogistics — all corporate-edition.
@Schema({ _id: false })
export class FeatureToggles {
  // Always-on demand model
  @Prop({ default: true })  seasonality!: boolean;
  @Prop({ default: true })  randomEvents!: boolean;
  @Prop({ default: true })  customerChurn!: boolean;
  @Prop({ default: true })  retailerBrain!: boolean;
  @Prop({ default: true })  regionalCompetition!: boolean;
  @Prop({ default: true })  demandForecasting!: boolean;
  @Prop({ default: true })  perfectOrderTracking!: boolean;

  // Module gates — true in DA (always on), kept for engine branch compatibility
  @Prop({ default: true })  analyticsMode!: boolean;          // gates ci/sa logic
  @Prop({ default: true })  productInnovation!: boolean;      // gates pi (P3)
  @Prop({ default: true })  marketExpansion!: boolean;        // gates me (R4-R6)
  @Prop({ default: true })  regionalDCs!: boolean;            // gates nd
}

@Schema({ _id: false })
export class PerfectOrderComponents {
  @Prop({ default: 0.92 })  onTime!: number;
  @Prop({ default: 0.95 })  inFull!: number;
  @Prop({ default: 0.97 })  damageFree!: number;
  @Prop({ default: 0.99 })  documentation!: number;
  @Prop({ default: 0.84 })  overall!: number;
}

@Schema({ _id: false })
export class BalancedScorecard {
  @Prop({ default: 0 })  financial!: number;
  @Prop({ default: 0 })  customer!: number;
  @Prop({ default: 0 })  process!: number;
  @Prop({ default: 0 })  learning!: number;
  @Prop({ default: 0 })  overall!: number;
  @Prop({ default: 0 })  rank!: number;
  @Prop()                grade?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// CostBreakdown — slimmed down
// ────────────────────────────────────────────────────────────────────────────
// Removed: quality, freight, techMaintenance, vmiSetup, vmiOngoing.
// DA cost categories that matter: labor (production), holding (inventory),
// marketing (ci), interest (financing).
@Schema({ _id: false })
export class CostBreakdown {
  @Prop({ default: 0 })  labor!: number;
  @Prop({ default: 0 })  holding!: number;
  @Prop({ default: 0 })  marketing!: number;
  @Prop({ default: 0 })  interest!: number;
}

// ── Quarterly Schedule Item ─────────────────────────────────────────────────
// Tracks planned and actual dates for each quarter in the simulation,
// accounting for faculty extensions via timezone-aware calculations
@Schema({ _id: false })
export class QuarterScheduleItem {
  @Prop({ required: true })
  quarterNumber!: number;

  // Planned start (set at simulation creation, adjusted if prior quarters extended)
  @Prop({ type: Date, required: true })
  plannedStartAt!: Date;

  // Planned end (planned start + quarterDurationDays, adjusted for extensions)
  @Prop({ type: Date, required: true })
  plannedEndAt!: Date;

  // Actual start (when quarter actually opened, null until advanceQuarter)
  @Prop({ type: Date, default: null })
  actualStartAt?: Date | null;

  // Actual end (when quarter actually closed, null until advanceQuarter)
  @Prop({ type: Date, default: null })
  actualEndAt?: Date | null;

  // Days extended by faculty (applied when quarter is extended)
  @Prop({ default: 0, min: 0 })
  extendedByDays!: number;

  // Metadata for audit trail
  @Prop({ type: Date, default: null })
  extendedAt?: Date | null;

  @Prop({ default: '' })
  extensionReason?: string;
}

// ============================================================================
// SIMULATION SCHEMA
// ============================================================================
export type SimulationDocument = Simulation & Document;
@Schema({ timestamps: true, collection: 'simulations' })
export class Simulation {
  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ enum: SimulationStatus, default: SimulationStatus.CREATED })
  status!: SimulationStatus;

  @Prop({ default: 0 })
  currentQuarter!: number;

  @Prop({ default: 11 })
  totalQuarters!: number;

  @Prop({ default: 2, min: 0, max: 6 })
  orientationQuarters!: number;

  @Prop({ enum: SchedulePreset, default: SchedulePreset.STANDARD_COURSE })
  schedulePreset!: SchedulePreset;

  // Configuration
  @Prop({ default: 3 })
  numFirms!: number;

  @Prop({ default: 3 })
  numRegions!: number;

  @Prop({ default: 2 })
  numProducts!: number;

  @Prop({ default: 1000000000 })
  startingCash!: number;

  @Prop({ default: 1000000000 })
  startingRevenue!: number;

  @Prop({ default: 600000 })
  totalMarketSize!: number;

  @Prop({ type: FeatureToggles, default: () => ({}) })
  features!: FeatureToggles;

  @Prop({ type: SeasonalityConfig, default: () => ({}) })
  seasonality!: SeasonalityConfig;

  @Prop({ default: 0.15 })
  eventProbability!: number;

  @Prop({ default: 0.05 })
  demandVariability!: number;

  // ── Quarter pacing ──────────────────────────────────────────────────────
  // How many real-world days each simulated quarter lasts. Set once at
  // creation; same duration applies to every quarter for the life of the sim.
  // Default 14 days. Min 1, max 90.
  @Prop({ default: 14, min: 1, max: 90 })
  quarterDurationDays!: number;

  // Start date for the simulation. When the first quarter begins.
  // If not set, defaults to current time when first quarter starts.
  @Prop({ type: Date, default: null })
  simulationStartDate!: Date | null;

  // When the currently-active quarter window opened. Set whenever
  // advanceQuarter creates the next quarter's initial states. Used by the
  // cockpit to render a "Q3 closes in 3 days" countdown.
  @Prop({ type: Date, default: null })
  quarterStartedAt!: Date | null;

  // When the currently-active quarter window closes. Computed as
  // quarterStartedAt + quarterDurationDays. The auto-advance check fires
  // when now >= quarterEndsAt and not all firms have submitted.
  @Prop({ type: Date, default: null })
  quarterEndsAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  owner?: Types.ObjectId;

  @Prop()
  courseCode?: string;

  @Prop()
  institutionName?: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  facultyIds?: Types.ObjectId[];

  @Prop({ default: false })
  showQuarterData!: boolean;

  @Prop({ default: 30, min: 0 })
  enrollmentCapacity!: number;

  @Prop({ default: true })
  chartShowsAllFirms!: boolean;

  // Module schedule (canonical)
  @Prop({
    type: ModuleSchedule,
    default: () => ({ mode: 'ALL_OPEN', modules: [] }),
  })
  moduleSchedule!: ModuleSchedule;

  // Legacy field kept for backward compat with the few callers that haven't
  // migrated to moduleSchedule yet. Derived from moduleSchedule on save.
  @Prop({
    type: [String],
    enum: ['ds', 'sa', 'ci', 'nd', 'pi', 'me'],
    default: [],
  })
  assignedModules!: string[];

  // ── DEPLOYMENT STATUS (Two stages: Faculty deployment, then Student deployment) ──
  @Prop({ enum: ['NOT_DEPLOYED', 'FACULTY_DEPLOYED', 'STUDENT_DEPLOYED'], default: 'NOT_DEPLOYED' })
  deploymentStatus!: string;

  @Prop({ type: Date, default: null })
  deployedForFacultyAt?: Date | null;

  @Prop({ type: Date, default: null })
  deployedForStudentAt?: Date | null;

  @Prop({ default: false })
  scheduleSetByFaculty!: boolean;

  // ── TIMEZONE & QUARTERLY SCHEDULING ────────────────────────────────────
  // IANA timezone identifier (e.g., 'America/New_York', 'Europe/London')
  // Used to calculate when quarters open/close for faculty in their local time
  @Prop({ default: 'UTC' })
  timezone!: string;

  // Full schedule of all quarters in this simulation, including planned/actual
  // dates and any faculty-applied extensions. Enables faculty to extend
  // individual quarters and auto-adjusts all subsequent quarter end dates.
  @Prop({ type: [QuarterScheduleItem], default: () => [] })
  quarterSchedule!: QuarterScheduleItem[];

  // ── REGISTRATION TOKEN ──────────────────────────────────────────────────
  // Unique token for public registration link. Students can join using this token.
  // Generated when simulation is created.
  @Prop({ unique: true, sparse: true })
  registrationToken?: string;

  @Prop({ type: Date, default: null })
  lastSweptAt!: Date | null;

  // ── QUARTER CLOSE CLAIM ─────────────────────────────────────────────────
  // Set while one process closes a quarter. Every close path (the sweep,
  // the lazy close on page load, the faculty button) must win this claim
  // first, so a quarter is never processed twice. A claim older than
  // QUARTER_CLOSE_STALE_MINUTES is treated as dead and can be taken over.
  @Prop({ type: Number, default: null })
  closingQuarter!: number | null;

  @Prop({ type: Date, default: null })
  closingStartedAt!: Date | null;

  // The quarter whose day-before reminder has been sent. The sweep claims
  // it atomically, so each quarter's reminder goes out once.
  @Prop({ type: Number, default: null })
  reminderSentForQuarter!: number | null;

  // The course's AI switch (V3 layer 4). Off means no AI features run for
  // this course, whatever the site's ceiling.
  @Prop({ default: true })
  aiEnabled!: boolean;
}

export const SimulationSchema = SchemaFactory.createForClass(Simulation);

// Compatibility for existing documents written before totalQuarters became
// canonical. This hydrates old maxQuarters values without mutating data at app
// startup; run scripts/migrate-maxQuarters-to-totalQuarters.js to rewrite them.
SimulationSchema.pre('init', function (data: any) {
  if (data && data.totalQuarters === undefined && data.maxQuarters !== undefined) {
    data.totalQuarters = data.maxQuarters;
  }
});

SimulationSchema.methods.isModuleUnlocked = function (
  this: any,
  moduleId: string,
): boolean {
  if (!this.moduleSchedule?.modules) return false;
  const currentQuarter = this.currentQuarter || 0;
  const orientationQuarters = Math.max(0, this.orientationQuarters ?? 2);
  if (currentQuarter <= 3 + orientationQuarters) return false;
  const config = this.moduleSchedule.modules.find(
    (m: any) => m.moduleId === moduleId.toLowerCase(),
  );
  if (!config || !config.enabled) return false;
  return currentQuarter >= config.unlocksAtQuarter;
} as any;

SimulationSchema.index({ owner: 1 });
SimulationSchema.index({ status: 1 });
SimulationSchema.index({ courseCode: 1 });

// ============================================================================
// FIRM SCHEMA
// ============================================================================
// Removed: techOwned (tech purchases gone in DA)
export type FirmDocument = Firm & Document;

@Schema({ timestamps: true, collection: 'firms' })
export class Firm {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ required: true })
  firmNumber!: number;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop()
  teamId?: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  members!: Types.ObjectId[];

  @Prop({ default: '#3B82F6' })
  color!: string;

  @Prop({ default: 0 })
  currentCash!: number;

  @Prop({ default: 80 })
  currentCsi!: number;

  @Prop({ default: 0.3333 })
  currentMarketShare!: number;

  @Prop({ default: 0 })
  cumulativeRevenue!: number;

  @Prop({ default: 0 })
  cumulativeProfit!: number;
}

export const FirmSchema = SchemaFactory.createForClass(Firm);

FirmSchema.index({ simulation: 1, firmNumber: 1 }, { unique: true });
FirmSchema.index({ members: 1 });

// ============================================================================
// QUARTER STATE SCHEMA
// ============================================================================
// Removed sub-doc classes: SupplierMetrics, SupplierPerformance,
// VmiQuarterSnapshot, expansionInProgress.
// Removed fields: techMaintenanceCost, supplierMetrics[], lastSupplierScoreUpdate,
// expansionInProgress, additionalCapacity, expansionMaintenance, dcSetupCost,
// dcDisposalRevenue, dcTransferCost, dcServiceBonus, carrierMode, freightCost,
// forcedAir, lastMileCost, volumeDiscount, tmsDiscount, greenScore, disposalMethod,
// vmiActive, vmiSnapshot, warrantyTier, centralWarrantyNetwork, westWarrantyNetwork.
// Kept: financial position, inventory, capacity (fixed), CSI/share, customer pools,
// retailer state, market expansion entry quarters, P3 launch state, DC state,
// SCRM, credit, segment allocation.
export type QuarterStateDocument = QuarterState & Document;

@Schema({ timestamps: true, collection: 'quarter_states' })
export class QuarterState {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm!: Types.ObjectId;

  @Prop({ required: true })
  quarter!: number;

  // Financial Position
  @Prop({ default: 0 })  cash!: number;
  @Prop({ default: 0 })  accountsReceivable!: number;
  @Prop({ default: 0 })  fixedAssets!: number;
  @Prop({ default: 0 })  accountsPayable!: number;
  @Prop({ default: 0 })  shortTermDebt!: number;
  @Prop({ default: 0 })  longTermDebt!: number;

  // Inventory Position
  @Prop({ default: 0 })  rawMaterialUnits!: number;
  @Prop({ default: 0 })  finishedGoodsUnits!: number;
  @Prop({ default: 0 })  inTransitUnits!: number;
  @Prop({ default: 0 })  ordersInTransit!: number;

  // Production capacity (fixed in DA — no expansion)
  @Prop({ default: 250000 })
  capacityUnits!: number;

  // Performance
  @Prop({ default: 80 })      csi!: number;
  @Prop({ default: 0.3333 })  marketShare!: number;
  @Prop({ default: 0 })       cumulativeRevenue!: number;
  @Prop({ default: 0 })       cumulativeProfit!: number;

  // Retailer Channel
  @Prop({ default: 0 })  retailerInventory!: number;
  @Prop({ enum: RetailerMode, default: RetailerMode.NORMAL })
  retailerMode!: RetailerMode;

  // Customer Pools
  @Prop({ default: 0 })  customersLoyal!: number;
  @Prop({ default: 0 })  customersInPlay!: number;
  @Prop({ default: 0 })  customersCompetitor!: number;

  @Prop({ default: 500 })
  prevPriceP1!: number;

  // === Market Expansion (me) ===
  @Prop({ default: false })  r4Active!: boolean;
  @Prop({ default: 0 })      r4QuartersActive!: number;
  @Prop({ default: null, type: Number })  r4EntryQuarter!: number | null;

  @Prop({ default: false })  r5Active!: boolean;
  @Prop({ default: 0 })      r5QuartersActive!: number;
  @Prop({ default: null, type: Number })  r5EntryQuarter!: number | null;

  @Prop({ default: false })  r6Active!: boolean;
  @Prop({ default: 0 })      r6QuartersActive!: number;
  @Prop({ default: null, type: Number })  r6EntryQuarter!: number | null;

  // === Network Design (nd) — DC state ===
  @Prop({ default: false })  dcCentralOpen!: boolean;
  @Prop({ default: 0 })      dcCentralInventory!: number;
  @Prop({ default: false })  dcWestOpen!: boolean;
  @Prop({ default: 0 })      dcWestInventory!: number;
  @Prop({ default: 0 })      dcTotalOpex!: number;
  @Prop({ default: 0 })      inventoryReturnedToFactory!: number;

  // Active event reference
  @Prop({ type: Types.ObjectId, ref: 'Event' })
  activeEvent?: Types.ObjectId;

  // Perfect Order
  @Prop({ type: PerfectOrderComponents, default: () => ({}) })
  perfectOrder!: PerfectOrderComponents;

  // === Product Innovation (pi) — P3 state ===
  @Prop({ default: false })  p3Launched!: boolean;
  @Prop({ default: null, type: Number })  p3LaunchQuarter!: number | null;
  @Prop({ type: String, default: null })  p3Config!: string | null;

  // === Credit ===
  @Prop({ default: 0 })       creditScore!: number;
  @Prop({ default: 'Fair' })  creditTier!: string;
  @Prop({ default: 50_000_000 })  creditLimit!: number;
  @Prop({ default: 0.18 })    currentInterestRate!: number;
  @Prop({ default: false })   wasOverlimitThisQuarter!: boolean;
  @Prop({ default: false })   forcedSaleThisQuarter!: boolean;

  // === SCRM ===
  @Prop({ default: 0 })       scrmRiskScore!: number;
  @Prop({ default: 'LOW' })   scrmRiskLevel!: string;

  // === Customer Intelligence (ci) — segment allocation ===
  @Prop({ type: Object })
  segmentAllocation?: {
    champions: number;
    growth: number;
    atRisk: number;
    other: number;
  };
}

export const QuarterStateSchema = SchemaFactory.createForClass(QuarterState);

QuarterStateSchema.index(
  { simulation: 1, firm: 1, quarter: 1 },
  { unique: true },
);
QuarterStateSchema.index({ firm: 1, quarter: -1 });

// ============================================================================
// DECISION SCHEMA (already cleaned in your applied version — kept identical)
// ============================================================================
export type DecisionDocument = Decision & Document;

@Schema({ timestamps: true, collection: 'decisions' })
export class Decision {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm!: Types.ObjectId;

  @Prop({ required: true })
  quarter!: number;

  @Prop({ enum: DecisionStatus, default: DecisionStatus.DRAFT })
  status!: DecisionStatus;

  // ds — DEMAND SCIENCE
  @Prop({ default: 80000 })  forecastR1!: number;
  @Prop({ default: 70000 })  forecastR2!: number;
  @Prop({ default: 50000 })  forecastR3!: number;
  @Prop({ enum: ForecastMethod, default: ForecastMethod.GUT })
  forecastMethod!: ForecastMethod;

  // sa — SUPPLIER ANALYTICS
  @Prop({ default: 600000 })   orderGlobal!: number;
  @Prop({ default: 'SUP001' }) primarySupplier!: string;
  @Prop({ default: 'NONE' })   secondarySupplier!: string;
  @Prop({ default: 100, min: 50, max: 100 })  primaryAllocation!: number;
  @Prop({ default: 0 })        emergencyRegionalOrder!: number;

  // ci — CUSTOMER INTELLIGENCE
  @Prop({ default: 25, min: 0, max: 100 })  segmentChampions!: number;
  @Prop({ default: 25, min: 0, max: 100 })  segmentGrowth!: number;
  @Prop({ default: 25, min: 0, max: 100 })  segmentAtRisk!: number;
  @Prop({ default: 25, min: 0, max: 100 })  segmentOther!: number;
  @Prop({ default: 5000000 })  marketingBudget!: number;

  // nd — NETWORK DESIGN
  @Prop({ enum: DCStatus, default: DCStatus.NO })  dcCentralStatus!: DCStatus;
  @Prop({ enum: DCStatus, default: DCStatus.NO })  dcWestStatus!: DCStatus;
  @Prop({ default: 0 })  allocateCentral!: number;
  @Prop({ default: 0 })  allocateWest!: number;

  // pi — PRODUCT INNOVATION
  @Prop({ default: false })       launchP3!: boolean;
  @Prop({ default: 'STANDARD' })  p3Config!: string;
  @Prop({ default: 549 })         p3Price!: number;
  @Prop({ default: 0 })           productionP3!: number;

  // me — MARKET EXPANSION
  @Prop({ default: false })  enterR4!: boolean;
  @Prop({ default: 0 })      forecastR4!: number;
  @Prop({ default: false })  enterR5!: boolean;
  @Prop({ default: 0 })      forecastR5!: number;
  @Prop({ default: false })  enterR6!: boolean;
  @Prop({ default: 0 })      forecastR6!: number;

  // Baseline production & pricing
  @Prop({ default: 120000 })  productionP1!: number;
  @Prop({ default: 80000 })   productionP2!: number;
  @Prop({ default: 500 })     priceP1!: number;
  @Prop({ default: 850 })     priceP2!: number;

  // Outcomes (engine fills)
  @Prop()  actualProduction?: number;
  @Prop()  unitsSold?: number;
  @Prop()  revenue?: number;
  @Prop()  cogs?: number;
  @Prop()  laborCost?: number;
  @Prop()  grossMargin?: number;
  @Prop()  netIncome?: number;
  @Prop()  fillRate?: number;
  @Prop()  endingCsi?: number;
  @Prop()  freightCost?: number;

  // Cash & Credit
  @Prop({ default: 0 })     estimatedTotalCost!: number;
  @Prop({ default: 0 })     borrowingNeeded!: number;
  @Prop({ default: 0 })     interestCost!: number;
  @Prop({ default: 0.15 })  creditLineRate!: number;
  @Prop({ default: 0 })     totalCostWithInterest!: number;

  // Metadata
  @Prop({ type: Types.ObjectId, ref: 'User' })
  submittedBy?: Types.ObjectId;

  @Prop()  submittedAt?: Date;

  // True once the quarter's close has started. Set on every decision of the
  // quarter by the close, and checked inside the submit and update writes,
  // so a late save can't land on a quarter that is already closing.
  @Prop({ type: Boolean, default: false })
  quarterClosed!: boolean;
  @Prop()  processedAt?: Date;

  @Prop({
    type: [String],
    enum: ['ds', 'sa', 'ci', 'nd', 'pi', 'me'],
    default: [],
  })
  modulesUnlockedAtSubmit!: string[];
}

export const DecisionSchema = SchemaFactory.createForClass(Decision);

DecisionSchema.index({ simulation: 1, firm: 1, quarter: 1 }, { unique: true });
DecisionSchema.index({ firm: 1, status: 1 });

DecisionSchema.pre('save', function (next) {
  const total =
    (this as any).segmentChampions +
    (this as any).segmentGrowth +
    (this as any).segmentAtRisk +
    (this as any).segmentOther;
  if (Math.abs(total - 100) > 0.01) {
    return next(
      new Error(
        `Customer segment allocations must sum to 100, got ${total}. ` +
          `(champions=${(this as any).segmentChampions}, growth=${(this as any).segmentGrowth}, ` +
          `atRisk=${(this as any).segmentAtRisk}, other=${(this as any).segmentOther})`,
      ),
    );
  }
  next();
});

// ============================================================================
// EVENT SCHEMA + EVENT IMPACT
// ============================================================================
// Kept entirely — random events and faculty-triggered events both work in DA.
export type EventDocument = Event & Document;

@Schema({ timestamps: true, collection: 'events' })
export class Event {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ enum: EventType, required: true })
  type!: EventType;

  @Prop({ enum: EventEffect, required: true })
  effect!: EventEffect;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  startQuarter!: number;

  @Prop({ default: 1 })
  duration!: number;

  @Prop()
  endQuarter?: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  magnitude!: number;

  @Prop({ type: [Types.ObjectId], ref: 'Firm', default: [] })
  affectedFirms!: Types.ObjectId[];

  @Prop({ enum: EventSource, default: EventSource.RANDOM })
  source!: EventSource;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  triggeredBy?: Types.ObjectId;
}

export const EventSchema = SchemaFactory.createForClass(Event);
EventSchema.index({ simulation: 1, startQuarter: 1 });
EventSchema.index({ simulation: 1, isActive: 1 });

// ── EVENT IMPACT ───────────────────────────────────────────────────────
export type EventImpactDocument = EventImpact & Document;

@Schema({ _id: false })
export class EventImpactDetails {
  @Prop()  partsDelayed?: number;
  @Prop()  ordersAffected?: number;
  @Prop()  demandModifier?: number;
  @Prop()  demandChangeUnits?: number;
  @Prop()  demandChangePercent?: number;
  @Prop()  additionalCost?: number;
  @Prop()  costIncreasePercent?: number;
  @Prop()  customersGained?: number;
  @Prop()  marketShareChange?: number;
}

@Schema({ _id: false })
export class FirmContextSnapshot {
  @Prop()  cashBefore?: number;
  @Prop()  inventoryBefore?: number;
  @Prop()  marketShareBefore?: number;
  @Prop()  csiBefore?: number;
  @Prop()  ordersInTransit?: number;
}

@Schema({ timestamps: true, collection: 'event_impacts' })
export class EventImpact {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  event!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm!: Types.ObjectId;

  @Prop({ required: true })
  quarter!: number;

  @Prop({
    enum: ['SUPPLY_DISRUPTION', 'DEMAND_SURGE', 'COMPETITOR_STUMBLE', 'ECONOMIC_DOWNTURN', 'RAW_MATERIAL_SPIKE'],
    required: true,
  })
  eventType!: string;

  @Prop({
    enum: ['PARTS_DELAYED', 'DEMAND_SPIKE', 'STEAL_INPLAY', 'DEMAND_DROP', 'COST_INCREASE'],
    required: true,
  })
  eventEffect!: string;

  @Prop({ enum: ['RANDOM', 'FACULTY_TRIGGERED', 'SCENARIO'], required: true })
  source!: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  triggeredBy?: Types.ObjectId;

  @Prop({ required: true })  rawMagnitude!: number;

  // Mitigation kept for parity, but in DA there's no Control Tower —
  // these will always be zero/false. Left in so engine code doesn't break.
  @Prop({ default: 0 })      mitigationApplied!: number;
  @Prop({ default: false })  hasControlTower!: boolean;

  @Prop({ required: true })  effectiveMagnitude!: number;

  @Prop({ type: EventImpactDetails, default: () => ({}) })
  impacts!: EventImpactDetails;

  @Prop({ default: 0 })  revenueImpact!: number;
  @Prop({ default: 0 })  costImpact!: number;
  @Prop({ default: 0 })  netImpact!: number;

  @Prop({ type: FirmContextSnapshot })
  firmContext?: FirmContextSnapshot;
}

export const EventImpactSchema = SchemaFactory.createForClass(EventImpact);

EventImpactSchema.index({ simulation: 1, quarter: 1 });
EventImpactSchema.index({ event: 1 });
EventImpactSchema.index({ firm: 1, quarter: -1 });
EventImpactSchema.index({ source: 1, simulation: 1 });
EventImpactSchema.index({ triggeredBy: 1, simulation: 1 });

// ============================================================================
// DEMAND HISTORY SCHEMA (unchanged)
// ============================================================================
export type DemandHistoryDocument = DemandHistory & Document;

@Schema({ timestamps: true, collection: 'demand_history' })
export class DemandHistory {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ required: true })
  quarter!: number;

  @Prop({ default: 0 })  demandR1!: number;
  @Prop({ default: 0 })  demandR2!: number;
  @Prop({ default: 0 })  demandR3!: number;
  @Prop({ default: 0 })  totalDemand!: number;

  @Prop({ default: 1.0 })  seasonalMultiplier!: number;
  @Prop()                  seasonLabel?: string;
  @Prop({ min: 1, max: 4 }) calendarQuarter!: number;

  @Prop({ default: 1.0 })  demandVariabilityApplied!: number;
  @Prop()                  eventImpact?: string;
}

export const DemandHistorySchema = SchemaFactory.createForClass(DemandHistory);
DemandHistorySchema.index({ simulation: 1, quarter: 1 }, { unique: true });

// ============================================================================
// FORECAST LOG SCHEMA (unchanged)
// ============================================================================
export type ForecastLogDocument = ForecastLog & Document;

@Schema({ timestamps: true, collection: 'forecast_logs' })
export class ForecastLog {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm!: Types.ObjectId;

  @Prop({ required: true })
  quarter!: number;

  @Prop({ type: Object })
  forecast!: { r1: number; r2: number; r3: number; total: number };

  @Prop({ type: Object })
  actual!: { r1: number; r2: number; r3: number; total: number };

  @Prop({ type: Object })
  error!: { r1: number; r2: number; r3: number; total: number };

  @Prop({ type: Object })
  ape!: { r1: number; r2: number; r3: number };

  @Prop({ default: 0 })  mape!: number;
  @Prop({ default: 0 })  bias!: number;
  @Prop({ default: 0 })  accuracy!: number;

  @Prop({ enum: ForecastMethod, default: ForecastMethod.GUT })
  forecastMethod!: ForecastMethod;

  @Prop({ enum: ForecastSource, default: ForecastSource.GUT })
  forecastSource!: ForecastSource;
}

export const ForecastLogSchema = SchemaFactory.createForClass(ForecastLog);

ForecastLogSchema.index(
  { simulation: 1, firm: 1, quarter: 1 },
  { unique: true },
);
ForecastLogSchema.index({
  simulation: 1, firm: 1, forecastSource: 1, quarter: 1,
});
ForecastLogSchema.index({
  simulation: 1, firm: 1, forecastMethod: 1, quarter: 1,
});

// ============================================================================
// SUPPLIER ORDER SCHEMA (kept — sa module relies on it)
// ============================================================================
export type SupplierOrderDocument = SupplierOrder & Document;

@Schema({ timestamps: true, collection: 'supplier_orders' })
export class SupplierOrder {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm!: Types.ObjectId;

  @Prop({ required: true })
  quarter!: number;

  // Now stores the supplier ID string (SUP001, SUP002, etc.) from the
  // sa module's catalog, not just GLOBAL/REGIONAL enum.
  @Prop({ required: true })
  supplierType!: string;

  @Prop({ required: true })  quantityOrdered!: number;
  @Prop()                    quantityReceived?: number;
  @Prop({ required: true })  unitCost!: number;
  @Prop({ required: true })  totalCost!: number;

  @Prop({ default: 1 })  leadTimeQuarters!: number;
  @Prop()                expectedDeliveryQuarter?: number;
  @Prop()                actualDeliveryQuarter?: number;

  @Prop()                fillRate?: number;
  @Prop({ default: false }) wasDelayed!: boolean;
  @Prop()                delayReason?: string;

  @Prop({ default: 0 })  defectiveUnits!: number;
  @Prop({ default: 0 })  defectRate!: number;
}

export const SupplierOrderSchema = SchemaFactory.createForClass(SupplierOrder);
SupplierOrderSchema.index({ simulation: 1, firm: 1, quarter: 1 });

// ============================================================================
// KPI HISTORY SCHEMA — slimmed
// ============================================================================
// Removed: vmi block. Inside operations: removed totalCapacity/additionalCapacity/
// expansionsInProgress (no expansion in DA). Inside learning: removed
// techSystemsCount, techInvestmentTotal, scMaturity (kept simplified —
// inferred from forecast accuracy alone).
export type KpiHistoryDocument = KpiHistory & Document;

@Schema({ timestamps: true, collection: 'kpi_history' })
export class KpiHistory {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm!: Types.ObjectId;

  @Prop({ required: true })
  quarter!: number;

  @Prop({ type: Object })
  financial!: {
    revenue: number;
    netIncome: number;
    cash: number;
    grossMarginPct: number;
    cogs: number;
    operatingExpenses: number;
  };

  @Prop({ type: Object })
  customer!: {
    csi: number;
    marketShare: number;
    fillRate: number;
    returnRate: number;
    customersLoyal: number;
    customersInPlay: number;
    customersChurned: number;
  };

  @Prop({ type: Object })
  operations!: {
    perfectOrder: number;
    capacityUtilization: number;
    defectRate: number;
    onTimeDelivery: number;
    inFull: number;
    damageFree: number;
    documentation: number;
    mape: number;
    unitsProduced: number;
    unitsSold: number;
  };

  @Prop({ type: Object })
  inventory!: {
    rawMaterialUnits: number;
    finishedGoodsUnits: number;
    inventoryValue: number;
    inventoryTurnover: number;
    weeksOfSupply: number;
    retailerInventory: number;
    inTransitUnits: number;
  };

  // Learning & Growth — simplified for DA:
  // forecastAccuracy is the only learning signal that matters here
  // (GUT vs MODEL forecasting is the pedagogical hook of the ds module)
  @Prop({ type: Object })
  learning!: {
    scMaturity: ScMaturityLevel;     // derived from forecast accuracy
    forecastAccuracy: number;        // 1 - mape, capped at 1
  };

  @Prop({ type: BalancedScorecard, default: () => ({}) })
  bsc!: BalancedScorecard;

  @Prop({ type: CostBreakdown, default: () => ({}) })
  costs!: CostBreakdown;
}

export const KpiHistorySchema = SchemaFactory.createForClass(KpiHistory);

KpiHistorySchema.index(
  { simulation: 1, firm: 1, quarter: 1 },
  { unique: true },
);
KpiHistorySchema.index({ firm: 1, quarter: -1 });

// ============================================================================
// USER SCHEMA (unchanged)
// ============================================================================
export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ default: '' })
  firstName!: string;

  @Prop({ default: '' })
  lastName!: string;

  @Prop()
  displayName?: string;

  @Prop({ select: false })
  passwordHash?: string;

  @Prop({ enum: UserRole, default: UserRole.STUDENT })
  role!: UserRole;

  @Prop()
  studentId?: string;

  @Prop()
  organization?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  avatarUrl?: string;

  @Prop()
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });

// ============================================================================
// ENROLLMENT SCHEMA (unchanged)
// ============================================================================
export type EnrollmentDocument = Enrollment & Document;

@Schema({ timestamps: true, collection: 'enrollments' })
export class Enrollment {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', default: null })
  firm!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ type: Number, default: null })
  firmNumber!: number | null;

  @Prop({ enum: EnrollmentStatus, default: EnrollmentStatus.PENDING })
  status!: EnrollmentStatus;

  @Prop({ enum: EnrollmentRole, default: EnrollmentRole.TEAM_MEMBER })
  role!: EnrollmentRole;

  @Prop()
  teamName?: string;

  @Prop({ default: true })
  canSubmitDecisions!: boolean;

  @Prop({ default: true })
  canViewReports!: boolean;

  @Prop({ default: false })
  canViewCompetitorData!: boolean;

  @Prop({ default: 0 })
  decisionsSubmitted!: number;

  @Prop()
  lastActivityAt?: Date;

  // ── STUDENT PAYMENT TRACKING ────────────────────────────────────────────
  // Faculty marks individual students as paid or unpaid for this simulation.
  // Each student's payment status is tracked independently.
  @Prop({ default: false })
  hasPaid!: boolean;

  // Date when faculty marked this student as paid (null if unpaid)
  @Prop({ type: Date, default: null })
  paidAt?: Date | null;

  // Optional notes from faculty about payment (e.g., "paid via venmo", "pending invoice")
  @Prop({ default: '' })
  paymentNotes?: string;

  // Individual student payment due date (can differ from simulation level)
  @Prop({ type: Date, default: null })
  paymentDueDate?: Date | null;

  // Extended payment date for this student (faculty can extend individual deadlines)
  @Prop({ type: Date, default: null })
  paymentExtendedDate?: Date | null;
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);
EnrollmentSchema.index({ simulation: 1, user: 1 }, { unique: true });
EnrollmentSchema.index({ simulation: 1, firm: 1 });
EnrollmentSchema.index({ user: 1 });

// ============================================================================
// 10-Q REPORT SCHEMA — slimmed
// ============================================================================
// Income statement: removed techMaintenance, qualityCost, freightCost lines
// (still included by engine if needed, but defaulted to 0).
export type TenQReportDocument = TenQReport & Document;

@Schema({ timestamps: true, collection: 'tenq_reports' })
export class TenQReport {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm!: Types.ObjectId;

  @Prop({ required: true })
  quarter!: number;

  @Prop({ type: Object })
  incomeStatement!: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
    laborCost: number;
    holdingCost: number;
    marketing: number;
    totalOpex: number;
    operatingIncome: number;
    interest: number;
    netIncome: number;
  };

  @Prop({ type: Object })
  balanceSheet!: {
    cash: number;
    accountsReceivable: number;
    inventoryValue: number;
    totalCurrentAssets: number;
    fixedAssets: number;
    totalAssets: number;
    accountsPayable: number;
    shortTermDebt: number;
    longTermDebt: number;
    totalLiabilities: number;
    equity: number;
  };

  @Prop({ type: Object })
  cashFlow!: {
    netIncome: number;
    depreciation: number;
    workingCapitalChange: number;
    cashFromOperations: number;
    capitalExpenditures: number;
    cashUsedInvesting: number;
    debtChange: number;
    dividends: number;
    cashFromFinancing: number;
    netCashChange: number;
    beginningCash: number;
    endingCash: number;
  };

  @Prop({ type: Object })
  inventoryReport!: {
    rawMaterialUnits: number;
    rawMaterialValue: number;
    rawDaysOfSupply: number;
    finishedGoodsUnits: number;
    finishedGoodsValue: number;
    finishedGoodsDaysOfSupply: number;
    inTransitUnits: number;
    retailerInventory: number;
    totalPipeline: number;
    totalInventoryValue: number;
    inventoryTurnover: number;
    weeksOfSupply: number;
  };

  @Prop({ type: Object })
  keyMetrics!: {
    unitsProduced: number;
    unitsSold: number;
    fillRate: number;
    csi: number;
    marketShare: number;
    perfectOrder: number;
    forecastAccuracy: number;
    mape: number;
    poComponents: {
      onTime: number;
      inFull: number;
      damageFree: number;
      documentation: number;
    };
  };

  @Prop({ type: Object })
  ytdTotals?: {
    revenue: number;
    netIncome: number;
    unitsSold: number;
    avgFillRate: number;
    avgCsi: number;
    cashGenerated: number;
  };

  @Prop({ default: new Date() })
  generatedAt!: Date;
}

export const TenQReportSchema = SchemaFactory.createForClass(TenQReport);
TenQReportSchema.index(
  { simulation: 1, firm: 1, quarter: 1 },
  { unique: true },
);
TenQReportSchema.index({ firm: 1, quarter: -1 });

// ============================================================================
// CREDIT HISTORY SCHEMA (unchanged — credit constraint applies in DA)
// ============================================================================
export type CreditHistoryDocument = CreditHistory & Document;

@Schema({ timestamps: true, collection: 'credit_history' })
export class CreditHistory {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true, index: true })
  simulation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true, index: true })
  firm!: Types.ObjectId;

  @Prop({ required: true, index: true })
  quarter!: number;

  @Prop({ type: Object, required: true })
  creditScore!: {
    currentRatioScore: number;
    debtToEquityScore: number;
    profitMarginScore: number;
    interestCoverageScore: number;
    cashFlowScore: number;
    totalScore: number;
  };

  @Prop({ required: true })  tierName!: string;
  @Prop({ required: true })  creditLimit!: number;
  @Prop({ required: true })  annualRate!: number;
  @Prop({ required: true })  effectiveRate!: number;

  @Prop({ required: true })  beginningDebt!: number;
  @Prop({ required: true })  endingDebt!: number;
  @Prop({ required: true })  interestCharge!: number;

  @Prop({ default: 0 })  autoBorrowAmount!: number;
  @Prop({ default: 0 })  autoRepayAmount!: number;

  @Prop({ default: false })  wasOverlimit!: boolean;
  @Prop({ default: 0 })      overlimitAmount!: number;
  @Prop({ default: 0 })      overlimitFee!: number;

  @Prop({ default: false })  forcedSaleTriggered!: boolean;
  @Prop({ default: 0 })      inventorySoldUnits!: number;
  @Prop({ default: 0 })      forcedSaleRecovery!: number;

  @Prop({ required: true })  beginningCash!: number;
  @Prop({ required: true })  endingCash!: number;
}

export const CreditHistorySchema = SchemaFactory.createForClass(CreditHistory);
CreditHistorySchema.index(
  { simulation: 1, firm: 1, quarter: 1 },
  { unique: true },
);

// ============================================================================
// SCRM HISTORY SCHEMA (unchanged — sa/ci modules use it)
// ============================================================================
export type SCRMHistoryDocument = SCRMHistory & Document;

@Schema({ timestamps: true, collection: 'scrm_history' })
export class SCRMHistory {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true, index: true })
  simulation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true, index: true })
  firm!: Types.ObjectId;

  @Prop({ required: true, index: true })
  quarter!: number;

  @Prop({ default: 0 })       totalRiskScore!: number;
  @Prop({ default: 'LOW' })   riskLevel!: string;
  @Prop({ default: '#d9ead3' }) riskColor!: string;
  @Prop()                     riskDescription?: string;

  @Prop({ type: Object, required: true })
  breakdown!: {
    supplierConcentrationRisk: number;
    inventoryBufferRisk: number;
    demandVolatilityRisk: number;
    financialHealthRisk: number;
    operationalRisk: number;
  };

  @Prop({ type: Object })
  details?: {
    supplierDetails: string;
    inventoryDetails: string;
    demandDetails: string;
    financialDetails: string;
    operationalDetails: string;
  };

  @Prop({ default: 0 })  customersLoyal!: number;
  @Prop({ default: 0 })  customersInPlay!: number;
  @Prop({ default: 0 })  customersCompetitor!: number;

  @Prop({ type: Object })
  customerMovements?: {
    churnedToCompetitor: number;
    degradedFromLoyal: number;
    wonBackFromCompetitor: number;
    newEntrants: number;
    growthConverted: number;
    atRiskSaved: number;
  };

  @Prop({ type: Object })
  segmentAllocation?: {
    champions: number;
    growth: number;
    atRisk: number;
    other: number;
  };

  @Prop({ default: 0 })  retentionBonus!: number;
  @Prop({ default: 0 })  csiImpact!: number;

  @Prop({ type: Object })
  inputs?: {
    globalOrders: number;
    regionalOrders: number;
    supplierConcentration: number;
    numSuppliers: number;
    rawMaterialUnits: number;
    finishedGoodsUnits: number;
    rawDaysOfSupply: number;
    fgDaysOfSupply: number;
    totalRevenue: number;
    demandMape: number;
    calendarQuarter: number;
    cash: number;
    shortTermDebt: number;
    longTermDebt: number;
    debtRatio: number;
    cashRunway: number;
    accountsReceivable: number;
    fixedAssets: number;
    inventoryValue: number;
    unitsProduced: number;
    maxCapacity: number;
    capacityUtilization: number;
    perfectOrder: number;
    ordersInTransit: number;
    leadTimeExposure: number;
    dcCentralOpen: boolean;
    dcWestOpen: boolean;
  };

  @Prop({ type: [String], default: [] })
  recommendations!: string[];
}

export const SCRMHistorySchema = SchemaFactory.createForClass(SCRMHistory);
SCRMHistorySchema.index(
  { simulation: 1, firm: 1, quarter: 1 },
  { unique: true },
);
SCRMHistorySchema.index({ firm: 1, quarter: -1 });
SCRMHistorySchema.index({ simulation: 1, riskLevel: 1 });

// ============================================================================
// STATIC CONFIG TABLES (DA-only)
// ============================================================================

// Two-supplier base profiles. Detailed multi-supplier catalog (SUP001…SUP006)
// lives in supplier-profiles.ts and is what the sa module actually uses.
// This table is kept for the engine's procurement fallback path.
export const SUPPLIER_CONFIG: Record<
  SupplierType,
  {
    id: string;
    name: string;
    location: string;
    leadTime: number;
    costMultiplier: number;
    unitCost: number;
    premium: number;
    minOrder: number;
    maxOrder: number;
    description: string;
    baseOnTime: number;
    baseQuality: number;
    baseFlexibility: number;
  }
> = {
  [SupplierType.GLOBAL]: {
    id: 'GLOBAL',
    name: 'Global Parts Co.',
    location: 'Asia-Pacific',
    leadTime: 1,
    costMultiplier: 1.0,
    unitCost: 150,
    premium: 1.0,
    minOrder: 100000,
    maxOrder: 2000000,
    description: 'Low cost, 1 quarter lead time',
    baseOnTime: 0.92,
    baseQuality: 0.95,
    baseFlexibility: 0.6,
  },
  [SupplierType.REGIONAL]: {
    id: 'REGIONAL',
    name: 'Regional Supply Inc.',
    location: 'Domestic',
    leadTime: 0,
    costMultiplier: 1.15,
    unitCost: 172.5,
    premium: 1.15,
    minOrder: 0,
    maxOrder: 500000,
    description: '+15% cost, same quarter delivery',
    baseOnTime: 0.95,
    baseQuality: 0.93,
    baseFlexibility: 0.9,
  },
};

export const SUPPLIER_SCORECARD_CONFIG = {
  WEIGHTS: {
    onTime: 0.3,
    quality: 0.25,
    cost: 0.25,
    flexibility: 0.2,
  },
  VARIABILITY: {
    onTime: 0.05,
    quality: 0.03,
  },
  RATINGS: {
    EXCELLENT: 90,
    GOOD: 80,
    ACCEPTABLE: 70,
    POOR: 60,
  },
};

// Distribution Center config (nd module)
export const DC_CONFIG = {
  CENTRAL: {
    name: 'Central Distribution Center',
    location: 'Central Region',
    setupCost: 4000000,
    quarterlyOpex: 700000,
    capacity: 200000,
    serviceBonus: 0.03,
    regionServed: 'R1',
  },
  WEST: {
    name: 'West Distribution Center',
    location: 'West Region',
    setupCost: 6000000,
    quarterlyOpex: 900000,
    capacity: 150000,
    serviceBonus: 0.02,
    regionServed: 'R3',
  },
  DISPOSAL_VALUE_RATE: 0.3,
};

// Type interface for nd module's DC processing result
export interface RegionalDCResult {
  setupCost: number;
  disposalRevenue: number;
  opex: number;
  dcCentralOpen: boolean;
  dcCentralInventory: number;
  dcWestOpen: boolean;
  dcWestInventory: number;
  serviceBonus: number;
  totalDCOpex: number;
  inventoryAllocated: number;
  inventoryReturnedToFactory: number;
}

// ============================================================================
// STUDENT ONBOARDING SCHEMA (unchanged)
// ============================================================================
export enum InviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export type StudentOnboardingDocument = StudentOnboarding & Document;

@Schema({ timestamps: true, collection: 'student_onboardings' })
export class StudentOnboarding {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ required: true })
  email!: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  user?: Types.ObjectId;

  @Prop({ required: true })
  inviteToken!: string;

  @Prop({ enum: InviteStatus, default: InviteStatus.PENDING })
  status!: InviteStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedBy!: Types.ObjectId;

  @Prop()
  inviteMessage?: string;

  @Prop({ default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
  expiresAt!: Date;

  @Prop()
  acceptedAt?: Date;

  @Prop()
  rejectedAt?: Date;

  @Prop({ default: false })
  sentEmailNotification!: boolean;

  @Prop()
  emailSentAt?: Date;

  @Prop()
  bulkImportId?: string;

  @Prop()
  rowNumber?: number;
}

export const StudentOnboardingSchema = SchemaFactory.createForClass(StudentOnboarding);

StudentOnboardingSchema.index({ simulation: 1, email: 1 }, { unique: true });
StudentOnboardingSchema.index({ inviteToken: 1 }, { unique: true });
StudentOnboardingSchema.index({ status: 1, expiresAt: 1 });
StudentOnboardingSchema.index({ user: 1 });
StudentOnboardingSchema.index({ bulkImportId: 1 });

// ============================================================================
// REGISTRATION LINK — Shareable registration link for open self-registration
// ============================================================================
export enum RegistrationLinkStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  DISABLED = 'DISABLED',
}

export type RegistrationLinkDocument = RegistrationLink & Document;

@Schema({ timestamps: true })
export class RegistrationLink {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  token!: string;

  @Prop({ enum: RegistrationLinkStatus, default: RegistrationLinkStatus.ACTIVE })
  status!: RegistrationLinkStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) })
  expiresAt!: Date;

  @Prop({ default: 0 })
  usedCount!: number;

  @Prop()
  maxUses?: number;

  @Prop()
  description?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const RegistrationLinkSchema = SchemaFactory.createForClass(RegistrationLink);

RegistrationLinkSchema.index({ simulation: 1 });
RegistrationLinkSchema.index({ token: 1 }, { unique: true });
RegistrationLinkSchema.index({ status: 1, expiresAt: 1 });
