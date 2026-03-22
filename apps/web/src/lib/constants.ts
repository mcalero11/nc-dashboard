export const API_PATHS = {
  AUTH_ME: '/api/auth/me',
  AUTH_GOOGLE: '/api/auth/google',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_REFRESH: '/api/auth/refresh',
  AUTH_SESSION: '/api/auth/session',
  TIME_ENTRIES_WEEK: '/api/time-entries/week',
  TIME_ENTRIES: '/api/time-entries',
  TIME_ENTRY: (rowIndex: number) => `/api/time-entries/${rowIndex}`,
  JOB_STATUS: (jobId: string) => `/api/time-entries/jobs/${jobId}/status`,
  HEALTH: '/api/health',
  SHEETS_DISCOVER: '/api/sheets/discover',
  SHEETS_SELECT: '/api/sheets/select',
  SHEETS_STATUS: '/api/sheets/status',
  SHEETS_PROJECTS: '/api/sheets/projects',
  RESOURCE_ALLOCATION_ALLOCATIONS: '/api/resource-allocation/allocations',
  RESOURCE_ALLOCATION_ALIASES: '/api/resource-allocation/aliases',
} as const;

export const STORAGE_KEYS = {
  TIMER_STATE: 'nc-timer-state',
} as const;

export const STALE_TIMES = {
  WEEK_ENTRIES: 30 * 1000, // 30 seconds
  PROJECTS: 15 * 60 * 1000, // 15 minutes
  USER: 5 * 60 * 1000, // 5 minutes
  SHEET_STATUS: 60 * 1000, // 1 minute
  ALLOCATIONS: 2 * 60 * 1000, // 2 minutes
} as const;

export const QUERY_KEYS = {
  weekEntries: (weekOffset?: number) =>
    ['week-entries', weekOffset ?? 0] as const,
  projects: ['projects'] as const,
  user: ['user'] as const,
  jobStatus: (jobId: string) => ['job-status', jobId] as const,
  sheetDiscovery: ['sheet-discovery'] as const,
  sheetStatus: ['sheet-status'] as const,
  opsAllocations: ['ops-allocations'] as const,
} as const;

export const JOB_POLL_INTERVAL = 2000; // 2 seconds
