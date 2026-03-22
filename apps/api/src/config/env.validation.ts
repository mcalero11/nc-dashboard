import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsNumber()
  PORT: number;

  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL: string;

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  GOOGLE_CALLBACK_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsNumber()
  JWT_EXPIRY: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{64}$/, {
    message: 'TOKEN_ENCRYPTION_KEY must be a 64-character hex string',
  })
  TOKEN_ENCRYPTION_KEY: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL: string;

  @IsNumber()
  @IsOptional()
  SESSION_MAX_AGE: number;

  @IsString()
  @IsNotEmpty()
  ALLOWED_DOMAINS: string;

  @IsString()
  @IsOptional()
  ALLOWED_EMAILS: string;

  @IsString()
  @IsNotEmpty()
  OPS_SHEET_NAME: string;

  @IsString()
  @IsNotEmpty()
  OPS_SHEET_TAB_NAME: string;

  @IsNumber()
  @IsOptional()
  OPS_SYNC_INTERVAL_MS: number;

  @IsNumber()
  @IsOptional()
  OPS_SYNC_WEEKS_AHEAD: number;

  @IsNumber()
  @IsOptional()
  OPS_SYNC_WEEKS_BEHIND: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
