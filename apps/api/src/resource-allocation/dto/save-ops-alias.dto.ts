import { IsString, MinLength } from 'class-validator';

export class SaveOpsAliasDto {
  @IsString()
  @MinLength(1)
  alias: string;
}
