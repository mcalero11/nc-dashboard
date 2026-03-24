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

export interface RecentTasksResponse {
  tasks: string[];
}
