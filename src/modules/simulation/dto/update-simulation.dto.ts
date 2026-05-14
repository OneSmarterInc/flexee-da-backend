// src/simulation/dto/update-simulation.dto.ts
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsArray,
  IsMongoId,
  IsIn,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SeasonalityConfigDto, FeatureTogglesDto, ModuleScheduleDto } from './create-simulation.dto';
import { SchedulePreset } from '../../../entities/index.entity';

export enum SimulationStatus {
  CREATED = 'CREATED',
  INITIALIZED = 'INITIALIZED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
}

export class UpdateSimulationDto {
  @ApiPropertyOptional({ description: 'Simulation name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Simulation description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: SimulationStatus, description: 'Simulation status' })
  @IsOptional()
  @IsEnum(SimulationStatus)
  status?: SimulationStatus;

  @ApiPropertyOptional({ description: 'Current quarter number' })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentQuarter?: number;

  @ApiPropertyOptional({ description: 'Total quarters' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(24)
  totalQuarters?: number;

  @ApiPropertyOptional({ description: 'Orientation quarters counted from Q4' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  orientationQuarters?: number;

  @ApiPropertyOptional({ enum: SchedulePreset, description: 'Faculty-facing schedule preset label' })
  @IsOptional()
  @IsEnum(SchedulePreset)
  schedulePreset?: SchedulePreset;

  @ApiPropertyOptional({ description: 'Course code' })
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

  @ApiPropertyOptional({ description: 'Event probability' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.5)
  eventProbability?: number;

  @ApiPropertyOptional({ description: 'Demand variability' })
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

  @ApiPropertyOptional({ description: 'Is simulation archived' })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

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
    description: 'Module schedule with per-module unlock quarters.',
    type: ModuleScheduleDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModuleScheduleDto)
  moduleSchedule?: ModuleScheduleDto;

  @ApiPropertyOptional({ default: 14, description: 'Number of real-world days per simulated quarter (1-90). Faculty can extend mid-sim but cannot shorten below elapsed time.' })
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
