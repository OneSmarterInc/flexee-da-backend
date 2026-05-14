// src/modules/simulation/dto/quarter-data-visibility.dto.ts

import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QuarterDataVisibilityDto {
  @IsBoolean()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Controls whether quarter data is shown on UI',
    example: true,
    type: Boolean,
  })
  showQuarterData: boolean;
}
