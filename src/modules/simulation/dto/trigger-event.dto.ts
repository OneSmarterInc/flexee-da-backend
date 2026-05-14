
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsArray, Min, Max } from 'class-validator';

export class TriggerEventDto {
  @ApiProperty({
    description: 'Event type',
    enum: ['SUPPLY_DISRUPTION', 'DEMAND_SURGE', 'COMPETITOR_STUMBLE', 'ECONOMIC_DOWNTURN', 'RAW_MATERIAL_SPIKE'],
    example: 'SUPPLY_DISRUPTION',
  })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: 'Custom event name', example: 'Port Strike' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Event description', example: 'West coast port workers on strike' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Effect magnitude (0.1-1.0)', example: 0.5, minimum: 0.1, maximum: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(1.0)
  magnitude?: number;

  @ApiPropertyOptional({ description: 'Duration in quarters', example: 2, minimum: 1, maximum: 4 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  duration?: number;

  // REMOVED: affectedFirms - GAS behavior applies faculty-triggered events to all firms equally
  // This prevents accidental per-firm targeting and ensures fair learning conditions
}