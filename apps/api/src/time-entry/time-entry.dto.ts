import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type {
  CreateTimeEntryRequest,
  UpdateTimeEntryRequest,
} from '@nc-dashboard/shared';
import { IsIANATimezone } from '../common/validators/is-iana-timezone.validator.js';
import { IsQuarterHour } from '../common/validators/is-quarter-hour.validator.js';

export class CreateTimeEntryDto implements CreateTimeEntryRequest {
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, { message: 'Date must be DD/MM/YYYY' })
  date: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  project: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  task?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(24)
  @IsQuarterHour()
  hours: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comments?: string;

  @IsOptional()
  @IsIANATimezone()
  timezone?: string;
}

export class RecentTasksQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  project?: string;
}

export class TaskSummaryQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Transform(({ value }) => (value as string)?.trim())
  task: string;
}

export class UpdateTimeEntryDto implements UpdateTimeEntryRequest {
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, { message: 'Date must be DD/MM/YYYY' })
  date?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  project?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  task?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(24)
  @IsQuarterHour()
  hours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comments?: string;

  @IsOptional()
  @IsIANATimezone()
  timezone?: string;
}
