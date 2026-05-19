// src/modules/decision/dto/decision.dto.ts
//
// FLEXEE DA — DTOs for decision service.
//
// Stripped of corporate-edition fields. Mirrors the Decision schema in
// src/schemas/index.ts plus a few computed fields the response includes
// (totalForecast, totalProduction, totalEstimatedCost, etc).

import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  IsArray,
} from 'class-validator';

// Enum strings — kept as string unions on the DTO side to avoid coupling
// the public API to internal Mongoose enum classes. The service's @InjectModel
// will accept either the string or the enum value.
type ForecastMethodStr = 'GUT' | 'MODEL';
type DCStatusStr = 'NO' | 'YES' | 'CLOSE';
type DecisionStatusStr = 'DRAFT' | 'SUBMITTED' | 'PROCESSED' | 'LOCKED';

// ============================================================================
// CREATE DECISION DTO
// ============================================================================

export class CreateDecisionDto {
  @IsString()
  simulation!: string;

  @IsString()
  firm!: string;

  @IsNumber()
  quarter!: number;

  // ds — Demand Science
  @IsOptional() @IsNumber() forecastR1?: number;
  @IsOptional() @IsNumber() forecastR2?: number;
  @IsOptional() @IsNumber() forecastR3?: number;
  @IsOptional() @IsString() forecastMethod?: ForecastMethodStr;

  // sa — Supplier Analytics
  @IsOptional() @IsNumber() orderGlobal?: number;
  @IsOptional() @IsString() primarySupplier?: string;
  @IsOptional() @IsString() secondarySupplier?: string;
  @IsOptional() @IsNumber() @Min(50) @Max(100) primaryAllocation?: number;
  @IsOptional() @IsNumber() emergencyRegionalOrder?: number;

  // ci — Customer Intelligence
  @IsOptional() @IsNumber() @Min(0) @Max(100) segmentChampions?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) segmentGrowth?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) segmentAtRisk?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) segmentOther?: number;
  @IsOptional() @IsNumber() marketingBudget?: number;

  // nd — Network Design
  @IsOptional() @IsString() dcCentralStatus?: DCStatusStr;
  @IsOptional() @IsString() dcWestStatus?: DCStatusStr;
  @IsOptional() @IsNumber() allocateCentral?: number;
  @IsOptional() @IsNumber() allocateWest?: number;

  // pi — Product Innovation (P3)
  @IsOptional() @IsBoolean() launchP3?: boolean;
  @IsOptional() @IsString()  p3Config?: string;
  @IsOptional() @IsNumber()  p3Price?: number;
  @IsOptional() @IsNumber()  productionP3?: number;

  // me — Market Expansion (R4-R6)
  @IsOptional() @IsBoolean() enterR4?: boolean;
  @IsOptional() @IsNumber()  forecastR4?: number;
  @IsOptional() @IsBoolean() enterR5?: boolean;
  @IsOptional() @IsNumber()  forecastR5?: number;
  @IsOptional() @IsBoolean() enterR6?: boolean;
  @IsOptional() @IsNumber()  forecastR6?: number;

  // Baseline production & pricing
  @IsOptional() @IsNumber() productionP1?: number;
  @IsOptional() @IsNumber() productionP2?: number;
  @IsOptional() @IsNumber() priceP1?: number;
  @IsOptional() @IsNumber() priceP2?: number;
}

// ============================================================================
// UPDATE DECISION DTO
// ============================================================================
// All fields optional — partial updates only.

export class UpdateDecisionDto {
  // ds
  @IsOptional() @IsNumber() forecastR1?: number;
  @IsOptional() @IsNumber() forecastR2?: number;
  @IsOptional() @IsNumber() forecastR3?: number;
  @IsOptional() @IsString() forecastMethod?: ForecastMethodStr;

  // sa
  @IsOptional() @IsNumber() orderGlobal?: number;
  @IsOptional() @IsString() primarySupplier?: string;
  @IsOptional() @IsString() secondarySupplier?: string;
  @IsOptional() @IsNumber() @Min(50) @Max(100) primaryAllocation?: number;
  @IsOptional() @IsNumber() emergencyRegionalOrder?: number;

  // ci
  @IsOptional() @IsNumber() @Min(0) @Max(100) segmentChampions?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) segmentGrowth?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) segmentAtRisk?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) segmentOther?: number;
  @IsOptional() @IsNumber() marketingBudget?: number;

  // nd
  @IsOptional() @IsString() dcCentralStatus?: DCStatusStr;
  @IsOptional() @IsString() dcWestStatus?: DCStatusStr;
  @IsOptional() @IsNumber() allocateCentral?: number;
  @IsOptional() @IsNumber() allocateWest?: number;

  // pi
  @IsOptional() @IsBoolean() launchP3?: boolean;
  @IsOptional() @IsString()  p3Config?: string;
  @IsOptional() @IsNumber()  p3Price?: number;
  @IsOptional() @IsNumber()  productionP3?: number;

  // me
  @IsOptional() @IsBoolean() enterR4?: boolean;
  @IsOptional() @IsNumber()  forecastR4?: number;
  @IsOptional() @IsBoolean() enterR5?: boolean;
  @IsOptional() @IsNumber()  forecastR5?: number;
  @IsOptional() @IsBoolean() enterR6?: boolean;
  @IsOptional() @IsNumber()  forecastR6?: number;

  // Baseline production & pricing
  @IsOptional() @IsNumber() productionP1?: number;
  @IsOptional() @IsNumber() productionP2?: number;
  @IsOptional() @IsNumber() priceP1?: number;
  @IsOptional() @IsNumber() priceP2?: number;

  // Status change (for "reopen & edit" flow)
  @IsOptional() @IsEnum(['DRAFT', 'SUBMITTED', 'PROCESSED', 'LOCKED']) status?: DecisionStatusStr;
}

// ============================================================================
// DECISION RESPONSE DTO
// ============================================================================

export interface DecisionResponseDto {
  id: string;
  simulation: string;
  firm: string;
  quarter: number;
  status: DecisionStatusStr;

  // ds
  forecastMethod: ForecastMethodStr;
  forecastR1: number;
  forecastR2: number;
  forecastR3: number;
  totalForecast: number;

  // sa
  primarySupplier: string;
  secondarySupplier: string;
  primaryAllocation: number;
  emergencyRegionalOrder: number;
  orderGlobal: number;
  procurementCost: number;

  // Baseline production
  productionP1: number;
  productionP2: number;
  productionP3: number;
  totalProduction: number;

  // Pricing
  priceP1: number;
  priceP2: number;
  p3Price: number;

  // ci
  marketingBudget: number;
  segmentChampions: number;
  segmentGrowth: number;
  segmentAtRisk: number;
  segmentOther: number;

  // nd
  dcCentralStatus: DCStatusStr;
  dcWestStatus: DCStatusStr;
  allocateCentral: number;
  allocateWest: number;

  // pi
  launchP3: boolean;
  p3Config: string;

  // me
  enterR4: boolean;
  enterR5: boolean;
  enterR6: boolean;
  forecastR4: number;
  forecastR5: number;
  forecastR6: number;

  // Cost summary
  estimatedLaborCost: number;
  totalEstimatedCost: number;

  // Module unlock snapshot at submit
  modulesUnlockedAtSubmit: string[];

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
  submittedAt?: Date;
}

// ============================================================================
// FIRM STATE RESPONSE DTO
// ============================================================================

export interface FirmStateResponseDto {
  id: string;
  firmNumber: number;
  name: string;
  quarter: number;
  cash: number;
  rawMaterials: number;
  finishedGoods: number;
  inTransit: number;
  retailerInventory: number;
  csi: number;
  marketShare: number;
  perfectOrder: number;
  retailerMode: 'NORMAL' | 'PANIC' | 'CLEARANCE';
  techOwned: any[]; // always [] in DA
}