import {
  IsString,
  IsOptional,
  MinLength,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({ description: 'Invite token from email' })
  @IsString()
  inviteToken: string;

  @ApiPropertyOptional({ description: 'New password (if user does not exist)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain uppercase, lowercase, and number characters',
  })
  password?: string;

  @ApiPropertyOptional({ description: 'First name (for new accounts)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name (for new accounts)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;
}

export class AcceptInviteResponseDto {
  success: boolean;
  message: string;
  simulation: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}
