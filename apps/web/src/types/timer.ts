export interface TimerState {
  isRunning: boolean;
  startTimestamp: number | null;
  project: string;
  task: string;
  comment: string;
  resumeRowIndex: number | null;
  resumeOriginalHours: number | null;
  resumeDate: string | null;
}

export const INITIAL_TIMER_STATE: TimerState = {
  isRunning: false,
  startTimestamp: null,
  project: '',
  task: '',
  comment: '',
  resumeRowIndex: null,
  resumeOriginalHours: null,
  resumeDate: null,
};
