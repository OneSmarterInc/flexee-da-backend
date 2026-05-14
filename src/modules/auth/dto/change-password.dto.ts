import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ 
    example: 'CurrentPassword@123',
    description: 'Current password' 
  })
  @IsString()
  @MinLength(8)
  oldPassword: string;

  @ApiProperty({ 
    example: 'NewPassword@456',
    description: 'New password (min 8 characters)' 
  })
  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message: 'Password must contain uppercase, lowercase, number and special character',
    }
  )
  newPassword: string;

  @ApiProperty({ 
    example: 'NewPassword@456',
    description: 'Confirm new password (must match newPassword)' 
  })
  @IsString()
  @MinLength(8)
  confirmPassword: string;
}