import { IsEmail, IsString, MinLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ 
    example: 'john@example.com',
    description: 'User email address' 
  })
  @IsEmail()
  email: string;

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

  @ApiProperty({ 
    example: '123456',
    description: 'OTP sent to email (required for password reset)',
    required: false 
  })
  @IsOptional()
  @IsString()
  otp?: string;
}