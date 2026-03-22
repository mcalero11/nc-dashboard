export interface SheetInfo {
  id: string;
  name: string;
  modifiedTime: string;
  ownedByMe: boolean;
}

export interface SheetDiscoveryResponse {
  sheets: SheetInfo[];
  autoSelected: boolean;
  spreadsheetId: string | null;
}

export interface SelectSheetRequest {
  spreadsheetId: string;
}

export interface SelectSheetResponse {
  message: string;
  spreadsheetId: string;
}

export interface SheetStatusResponse {
  connected: boolean;
  spreadsheetId: string | null;
  sheetName: string | null;
  error?:
    | 'not_configured'
    | 'access_denied'
    | 'not_found'
    | 'token_error'
    | 'unknown';
}

export interface ProjectsResponse {
  projects: string[];
  source: 'planning' | 'validation' | 'none';
}
