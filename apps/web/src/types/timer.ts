export interface TimerState {
  isRunning: boolean;
  startTimestamp: number | null;
  project: string;
  task: string;
}

export const INITIAL_TIMER_STATE: TimerState = {
  isRunning: false,
  startTimestamp: null,
  project: '',
  task: '',
};
