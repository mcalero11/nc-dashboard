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
    setState((prev) => {
      const next: TimerState = {
        isRunning: true,
        startTimestamp: Date.now(),
        project,
        task,
        comment: prev.comment,
        resumeRowIndex: null,
        resumeOriginalHours: null,
        resumeDate: null,
      };
      saveState(next);
      return next;
    });
    setElapsed(0);
  }, []);

  const startResume = useCallback(
    (
      project: string,
      task: string,
      comment: string,
      rowIndex: number,
      originalHours: number,
      date: string,
    ) => {
      // Offset startTimestamp backward so elapsed naturally includes original hours
      const offsetMs = originalHours * 3600 * 1000;
      const next: TimerState = {
        isRunning: true,
        startTimestamp: Date.now() - offsetMs,
        project,
        task,
        comment,
        resumeRowIndex: rowIndex,
        resumeOriginalHours: originalHours,
        resumeDate: date,
      };
      setState(next);
      saveState(next);
      setElapsed(Math.round(originalHours * 3600));
    },
    [],
  );

  const setComment = useCallback((comment: string) => {
    setState((prev) => {
      const next = { ...prev, comment };
      saveState(next);
      return next;
    });
  }, []);

  const capture = useCallback(() => {
    const finalElapsed = state.startTimestamp
      ? getElapsedSeconds(state.startTimestamp)
      : elapsed;
    // Pause the timer but keep all data for retry on failure
    const pausedState: TimerState = { ...state, isRunning: false };
    setState(pausedState);
    saveState(pausedState);
    setElapsed(finalElapsed);
    return {
      elapsed: finalElapsed,
      project: state.project,
      task: state.task,
      comment: state.comment,
      resumeRowIndex: state.resumeRowIndex,
      resumeOriginalHours: state.resumeOriginalHours,
      resumeDate: state.resumeDate,
    };
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
    comment: state.comment,
    resumeRowIndex: state.resumeRowIndex,
    resumeOriginalHours: state.resumeOriginalHours,
    elapsed,
    display: formatElapsedTime(elapsed),
    start,
    startResume,
    capture,
    reset,
    setComment,
  };
}
