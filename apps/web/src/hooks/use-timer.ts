'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimerState } from '@/types/timer';
import { INITIAL_TIMER_STATE } from '@/types/timer';
import { STORAGE_KEYS } from '@/lib/constants';
import { getElapsedSeconds, formatElapsedTime } from '@/lib/timer-utils';

function loadState(): TimerState {
  if (typeof window === 'undefined') return INITIAL_TIMER_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TIMER_STATE);
    if (!raw) return INITIAL_TIMER_STATE;
    return JSON.parse(raw);
  } catch {
    return INITIAL_TIMER_STATE;
  }
}

function saveState(state: TimerState) {
  localStorage.setItem(STORAGE_KEYS.TIMER_STATE, JSON.stringify(state));
}

export function useTimer() {
  const [state, setState] = useState<TimerState>(() => loadState());
  const [elapsed, setElapsed] = useState(() => {
    const s = loadState();
    return s.isRunning && s.startTimestamp
      ? getElapsedSeconds(s.startTimestamp)
      : 0;
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick interval
  useEffect(() => {
    if (state.isRunning && state.startTimestamp) {
      intervalRef.current = setInterval(() => {
        setElapsed(getElapsedSeconds(state.startTimestamp!));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isRunning, state.startTimestamp]);

  const start = useCallback((project: string, task: string) => {
    const next: TimerState = {
      isRunning: true,
      startTimestamp: Date.now(),
      project,
      task,
    };
    setState(next);
    saveState(next);
    setElapsed(0);
  }, []);

  const stop = useCallback(() => {
    const finalElapsed = state.startTimestamp
      ? getElapsedSeconds(state.startTimestamp)
      : elapsed;
    const stoppedState: TimerState = { ...INITIAL_TIMER_STATE };
    setState(stoppedState);
    saveState(stoppedState);
    setElapsed(0);
    return { elapsed: finalElapsed, project: state.project, task: state.task };
  }, [state, elapsed]);

  const reset = useCallback(() => {
    setState(INITIAL_TIMER_STATE);
    saveState(INITIAL_TIMER_STATE);
    setElapsed(0);
  }, []);

  return {
    isRunning: state.isRunning,
    project: state.project,
    task: state.task,
    elapsed,
    display: formatElapsedTime(elapsed),
    start,
    stop,
    reset,
  };
}
