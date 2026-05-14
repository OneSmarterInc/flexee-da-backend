import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExcelImportDto {
  @ApiProperty({ description: 'Simulation ID' })
  @IsMongoId()
  simulationId: string;

  @ApiPropertyOptional({ description: 'Custom invite message for all students' })
  @IsOptional()
  @IsString()
  inviteMessage?: string;
}

export class ExcelImportResponseDto {
  bulkImportId: string;
  totalRowsProcessed: number;
  successful: Array<{
    rowNumber: number;
    email: string;
    status: string;
  }>;
  failed: Array<{
    rowNumber: number;
    email: string;
    reason: string;
  }>;
  summary: {
    total: number;
    successCount: number;
    failureCount: number;
  };
}

export interface ExcelStudent {
  email?: string;
  [key: string]: any;
}
