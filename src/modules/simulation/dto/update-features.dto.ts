// src/modules/simulation/dto/update-features.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateFeaturesDto {
  // Core features
  @ApiPropertyOptional({ description: 'Enable seasonal demand variations', default: true })
  @IsOptional()
  @IsBoolean()
  seasonality?: boolean;

  @ApiPropertyOptional({ description: 'Enable random market events', default: true })
  @IsOptional()
  @IsBoolean()
  randomEvents?: boolean;

  @ApiPropertyOptional({ description: 'Enable customer churn mechanics', default: true })
  @IsOptional()
  @IsBoolean()
  customerChurn?: boolean;

  @ApiPropertyOptional({ description: 'Enable smart retailer ordering behavior', default: true })
  @IsOptional()
  @IsBoolean()
  retailerBrain?: boolean;

  @ApiPropertyOptional({ description: 'Enable regional market competition', default: true })
  @IsOptional()
  @IsBoolean()
  regionalCompetition?: boolean;

  @ApiPropertyOptional({ description: 'Enable demand forecasting tools', default: true })
  @IsOptional()
  @IsBoolean()
  demandForecasting?: boolean;

  @ApiPropertyOptional({ description: 'Enable perfect order tracking', default: true })
  @IsOptional()
  @IsBoolean()
  perfectOrderTracking?: boolean;

  @ApiPropertyOptional({ description: 'Enable technology investments', default: true })
  @IsOptional()
  @IsBoolean()
  technologyInvestments?: boolean;

  @ApiPropertyOptional({ description: 'Enable quality control decisions', default: true })
  @IsOptional()
  @IsBoolean()
  qualityControl?: boolean;

  @ApiPropertyOptional({ description: 'Enable transport logistics decisions', default: true })
  @IsOptional()
  @IsBoolean()
  transportLogistics?: boolean;

  // Advanced modules (default OFF - faculty toggles)
  @ApiPropertyOptional({ description: 'Enable capacity expansion module', default: false })
  @IsOptional()
  @IsBoolean()
  capacityExpansion?: boolean;

  @ApiPropertyOptional({ description: 'Enable regional distribution centers', default: false })
  @IsOptional()
  @IsBoolean()
  regionalDCs?: boolean;

  @ApiPropertyOptional({ description: 'Enable multi-carrier selection', default: false })
  @IsOptional()
  @IsBoolean()
  multiCarrierSelection?: boolean;

  @ApiPropertyOptional({ description: 'Enable returns and green score tracking', default: false })
  @IsOptional()
  @IsBoolean()
  returnsGreenScore?: boolean;

  @ApiPropertyOptional({ description: 'Enable intelligence center reports', default: false })
  @IsOptional()
  @IsBoolean()
  intelligenceCenter?: boolean;

  @ApiPropertyOptional({ description: 'Enable vendor managed inventory', default: false })
  @IsOptional()
  @IsBoolean()
  vmi?: boolean;

  @ApiPropertyOptional({ description: 'Enable advanced analytics mode', default: false })
  @IsOptional()
  @IsBoolean()
  analyticsMode?: boolean;
}