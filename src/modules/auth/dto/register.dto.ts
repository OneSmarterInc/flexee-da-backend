import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ 
    example: 'john@example.com',
    description: 'User email address (unique)' 
  })
  @IsEmail()
  email: string;

  @ApiProperty({ 
    example: 'John',
    description: 'First name' 
  })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ 
    example: 'Doe',
    description: 'Last name' 
  })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty({ 
    example: 'SecurePassword@123',
    description: 'Password (min 8 characters, must contain uppercase, lowercase, number, special char)' 
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ 
    example: 'STU001',
    description: 'Student ID (optional)',
    required: false 
  })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiProperty({ 
    example: 'MIT',
    description: 'Organization/Institution (optional)',
    required: false 
  })
  @IsOptional()
  @IsString()
  organization?: string;
}