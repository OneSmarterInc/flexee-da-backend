import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { REFUSALS } from './ask-claude.service';

export class AskContextDto {
  @IsString() @MaxLength(40) page!: string;
  @IsString() @MaxLength(120) label!: string;
  @IsOptional() @IsObject() details?: Record<string, string>;
}

export class AskQuestionDto {
  // Length is checked by the service so the refusal reads the same everywhere.
  @IsString({ message: REFUSALS.length }) question!: string;
  @IsUUID('all', { message: REFUSALS.length }) conversationId!: string;
  @ValidateNested() @Type(() => AskContextDto) context!: AskContextDto;
}

export class AiSwitchDto {
  @IsBoolean() enabled!: boolean;
}
