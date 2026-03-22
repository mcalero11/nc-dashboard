import { IsString, MinLength } from 'class-validator';

export class RemoveOpsAliasDto {
  @IsString()
  @MinLength(1)
  alias: string;
}
