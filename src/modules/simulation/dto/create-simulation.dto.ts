// src/simulation/dto/create-simulation.dto.ts
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumber,
  IsMongoId,
  IsArray,
  IsIn,
  Min,
  Max,
  ValidateNested,
  IsEnum,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModuleScheduleMode, SchedulePreset } from '../../../entities/index.entity';

export class SeasonalityConfigDto {
  @ApiPropertyOptional({ default: 0.85, description: 'Q1 demand multiplier (post-holiday)' })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(1.5)
  q1Multiplier?: number;

  @ApiPropertyOptional({ default: 1.0, description: 'Q2 demand multiplier (spring)' })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(1.5)
  q2Multiplier?: number;

  @ApiPropertyOptional({ default: 1.0, description: 'Q3 demand multiplier (summer)' })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(1.5)
  q3Multiplier?: number;

  @ApiPropertyOptional({ default: 1.25, description: 'Q4 demand multiplier (holiday)' })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  q4Multiplier?: number;
}

export class FeatureTogglesDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  seasonality?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  randomEvents?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  customerChurn?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  retailerBrain?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  regionalCompetition?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  demandForecasting?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  perfectOrderTracking?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  technologyInvestments?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  qualityControl?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  transportLogistics?: boolean;
}

export class FirmConfigDto {
  @ApiProperty({ description: 'Firm number (1-6)' })
  @IsInt()
  @Min(1)
  @Max(6)
  firmNumber!: number;

  @ApiProperty({ description: 'Firm display name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Firm color for UI' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class AnalyticsModuleConfigDto {
  @ApiProperty({
    description: 'Module short code',
    enum: ['ds', 'sa', 'ci', 'nd', 'pi', 'me'],
    example: 'ds',
  })
  @IsString()
  @IsIn(['ds', 'sa', 'ci', 'nd', 'pi', 'me'] as const)
  moduleId!: string;

  @ApiProperty({ description: 'Display order (1 = Module 1)', example: 1 })
  @IsInt()
  @Min(1)
  @Max(20)
  order!: number;

  @ApiProperty({ description: 'Quarter at which this module unlocks for students', example: 6 })
  @IsInt()
  @Min(1)
  unlocksAtQuarter!: number;

  @ApiPropertyOptional({ description: 'Whether this module is active in the simulation', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ModuleScheduleDto {
  @ApiPropertyOptional({
    description: 'PROGRESSIVE = per-module unlock quarters; ALL_OPEN = enabled modules unlock after orientation',
    enum: ModuleScheduleMode,
    default: ModuleScheduleMode.PROGRESSIVE,
  })
  @IsOptional()
  @IsEnum(ModuleScheduleMode)
  mode?: ModuleScheduleMode;

  @ApiProperty({
    description: 'Per-module configuration (id, order, unlock quarter, enabled)',
    type: [AnalyticsModuleConfigDto],
  })
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AnalyticsModuleConfigDto)
  modules!: AnalyticsModuleConfigDto[];
}

export class CreateSimulationDto {
  @ApiProperty({ description: 'Simulation name', example: 'MBA Supply Chain 2025' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Simulation description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 11, description: 'Total quarters to run' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(24)
  totalQuarters?: number;

  @ApiPropertyOptional({
    default: 2,
    description: 'Quarters at the start of student play (from Q4) where DA modules remain locked',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  orientationQuarters?: number;

  @ApiPropertyOptional({
    enum: SchedulePreset,
    default: SchedulePreset.STANDARD_COURSE,
    description: 'Faculty-facing schedule preset. CUSTOM uses submitted moduleSchedule.',
  })
  @IsOptional()
  @IsEnum(SchedulePreset)
  schedulePreset?: SchedulePreset;

  @ApiPropertyOptional({ default: 3, description: 'Number of competing firms' })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  numFirms?: number;

  @ApiPropertyOptional({ default: 3, description: 'Number of regions' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  numRegions?: number;

  @ApiPropertyOptional({ default: 2, description: 'Number of products' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  numProducts?: number;

  @ApiPropertyOptional({ default: 600000, description: 'Total market size (units)' })
  @IsOptional()
  @IsNumber()
  @Min(100000)
  totalMarketSize?: number;

  @ApiPropertyOptional({ default: 50000000, description: 'Starting cash per firm' })
  @IsOptional()
  @IsNumber()
  @Min(10000000)
  startingCash?: number;

  @ApiPropertyOptional({ default: 1000000000, description: 'Starting annual revenue for financial calculations (Q0 assumption)' })
  @IsOptional()
  @IsNumber()
  @Min(100000000)
  startingRevenue?: number;

  @ApiPropertyOptional({ description: 'Course code for grouping' })
  @IsOptional()
  @IsString()
  courseCode?: string;

  @ApiPropertyOptional({ description: 'Institution name' })
  @IsOptional()
  @IsString()
  institutionName?: string;

  @ApiPropertyOptional({ description: 'Feature toggles' })
  @IsOptional()
  @ValidateNested()
  @Type(() => FeatureTogglesDto)
  features?: FeatureTogglesDto;

  @ApiPropertyOptional({ description: 'Seasonality configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeasonalityConfigDto)
  seasonality?: SeasonalityConfigDto;

  @ApiPropertyOptional({ default: 0.15, description: 'Event probability per quarter' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.5)
  eventProbability?: number;

  @ApiPropertyOptional({ default: 0.05, description: 'Demand variability factor' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.2)
  demandVariability?: number;

  @ApiPropertyOptional({ description: 'Faculty IDs to assign' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  facultyIds?: string[];

  @ApiPropertyOptional({ description: 'Custom firm configurations' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FirmConfigDto)
  firmConfigs?: FirmConfigDto[];

  @ApiPropertyOptional({
    description: 'FLEXEE DA modules assigned to this simulation',
    example: ['ds', 'sa', 'ci'],
    enum: ['ds', 'sa', 'ci', 'nd', 'pi', 'me'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn(['ds', 'sa', 'ci', 'nd', 'pi', 'me'] as const, { each: true })
  assignedModules?: string[];

  @ApiPropertyOptional({
    description: 'Module schedule with per-module unlock quarters. Used when schedulePreset is CUSTOM. If omitted, the server applies the default progressive DA schedule.',
    type: ModuleScheduleDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModuleScheduleDto)
  moduleSchedule?: ModuleScheduleDto;

  @ApiPropertyOptional({ default: 14, description: 'Number of real-world days per simulated quarter (1-90)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(90)
  quarterDurationDays?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Whether students can see all firms on the forecast accuracy chart.',
  })
  @IsOptional()
  @IsBoolean()
  chartShowsAllFirms?: boolean;
}
