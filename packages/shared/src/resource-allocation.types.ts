export type OpsSheetAccessState = 'unchecked' | 'has_access' | 'no_access';

export interface OpsAccessStatusResponse {
  access: OpsSheetAccessState;
  error?: 'token_error' | 'unknown';
  syncTriggered?: boolean;
}

export interface OpsProjectDto {
  projectName: string;
  engagementType: string;
  metadata: string;
  isInternal: boolean;
}

export interface OpsAllocationDto {
  projectName: string;
  role: string;
  personName: string;
  comments: string;
  isUnassigned: boolean;
  weeklyHours: Record<string, number>;
}

export interface OpsProjectsResponse {
  projects: OpsProjectDto[];
  lastSyncAt: string | null;
}

export interface OpsAllocationsBaseResponse {
  status: 'resolved' | 'ambiguous' | 'no_match';
  currentWeekDate: string;
  weekDates: string[];
  lastSyncAt: string | null;
  savedAliases: string[];
}

export interface OpsResolvedAllocationsResponse extends OpsAllocationsBaseResponse {
  status: 'resolved';
  allocations: OpsAllocationDto[];
  matchedPersonNames: string[];
  candidatePersonNames: string[];
}

export interface OpsAmbiguousAllocationsResponse extends OpsAllocationsBaseResponse {
  status: 'ambiguous';
  allocations: [];
  matchedPersonNames: [];
  candidatePersonNames: string[];
}

export interface OpsNoMatchAllocationsResponse extends OpsAllocationsBaseResponse {
  status: 'no_match';
  allocations: [];
  matchedPersonNames: [];
  candidatePersonNames: [];
}

export type OpsAllocationsResponse =
  | OpsResolvedAllocationsResponse
  | OpsAmbiguousAllocationsResponse
  | OpsNoMatchAllocationsResponse;

export interface SaveOpsAliasRequest {
  alias: string;
}

export interface SaveOpsAliasResponse {
  aliases: string[];
}

export interface RemoveOpsAliasRequest {
  alias: string;
}

export interface RemoveOpsAliasResponse {
  aliases: string[];
}

export interface OpsSyncStatusResponse {
  lastSyncAt: string | null;
  status: 'success' | 'failed' | 'never';
  error: string | null;
}
