import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPasswordResetDto {
  @ApiProperty({ 
    example: 'john@example.com',
    description: 'User email address' 
  })
  @IsEmail()
  email: string;
}