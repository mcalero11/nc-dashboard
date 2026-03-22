import { IsString, IsNotEmpty } from 'class-validator';
import type { SelectSheetRequest } from '@nc-dashboard/shared';

export class SelectSheetDto implements SelectSheetRequest {
  @IsString()
  @IsNotEmpty()
  spreadsheetId: string;
}
