// src/modules/simulation/dto/delete-enrollments.dto.ts
import { IsArray, IsMongoId, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkDeleteEnrollmentsDto {
  @ApiProperty({
    description: 'Array of enrollment IDs to delete',
    type: [String],
    example: ['60d5ec49c1234567890abcd1', '60d5ec49c1234567890abcd2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  enrollmentIds: string[];
}

export class DeleteEnrollmentResponseDto {
  @ApiProperty({ description: 'Number of enrollments deleted' })
  deletedCount: number;

  @ApiProperty({ description: 'Array of deleted enrollment IDs' })
  deletedIds: string[];

  @ApiProperty({ description: 'Success message' })
  message: string;
}
