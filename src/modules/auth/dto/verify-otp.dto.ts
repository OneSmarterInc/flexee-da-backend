import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ 
    example: 'john@example.com',
    description: 'User email address' 
  })
  @IsEmail()
  email: string;

  @ApiProperty({ 
    example: '123456',
    description: 'OTP code (6 digits)' 
  })
  @IsString()
  @Length(6, 6)
  otp: string;
}