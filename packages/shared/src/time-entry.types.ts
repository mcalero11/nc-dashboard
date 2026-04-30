export interface TimeEntry {
  rowIndex: number;
  date: string;
  project: string;
  task: string;
  hours: number;
  comments: string;
}

export interface WeekEntriesResponse {
  weekStart: string;
  weekEnd: string;
  entries: TimeEntry[];
  totalHours: number;
}

export interface CreateTimeEntryRequest {
  date: string;
  project: string;
  task?: string;
  hours: number;
  comments?: string;
  timezone?: string;
}

export interface UpdateTimeEntryRequest {
  date?: string;
  project?: string;
  task?: string;
  hours?: number;
  comments?: string;
  timezone?: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: string;
}

export interface WeekEntriesQuery {
  timezone?: string;
}

export interface RecentTask {
  task: string;
  project: string;
}

export interface RecentTasksResponse {
  tasks: RecentTask[];
}

export interface TaskSummaryEntry {
  date: string;
  project: string;
  hours: number;
  comments: string;
}

export interface TaskSummaryResponse {
  task: string;
  totalHours: number;
  entryCount: number;
  earliestDate: string;
  latestDate: string;
  averageHoursPerEntry: number;
  entries: TaskSummaryEntry[];
}

export interface ProjectUsageEntry {
  project: string;
  count: number;
  lastUsedDate: string;
}

export interface ProjectUsageResponse {
  usage: ProjectUsageEntry[];
}
