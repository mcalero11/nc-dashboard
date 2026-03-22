import {
  addWeeks,
  endOfWeek,
  isWithinInterval,
  parse,
  startOfWeek,
} from 'date-fns';
import { TZDate } from '@date-fns/tz';

const WEEK_OPTIONS = { weekStartsOn: 1 as const };
const DEFAULT_TIMEZONE = 'UTC';

export function getCurrentWeekRange(timezone?: string): {
  start: Date;
  end: Date;
} {
  const now = new TZDate(new Date(), timezone || DEFAULT_TIMEZONE);
  return {
    start: startOfWeek(now, WEEK_OPTIONS),
    end: endOfWeek(now, WEEK_OPTIONS),
  };
}

export function getWeekRangeForOffset(
  offset: number,
  timezone?: string,
): { start: Date; end: Date } {
  const now = new TZDate(new Date(), timezone || DEFAULT_TIMEZONE);
  const target = addWeeks(now, offset);
  return {
    start: startOfWeek(target, WEEK_OPTIONS),
    end: endOfWeek(target, WEEK_OPTIONS),
  };
}

export function isWithinCurrentWeek(date: Date, timezone?: string): boolean {
  const { start, end } = getCurrentWeekRange(timezone);
  return isWithinInterval(date, { start, end });
}

export function parseDDMMYYYY(dateStr: string, timezone?: string): Date {
  const refDate = new TZDate(new Date(), timezone || DEFAULT_TIMEZONE);
  return parse(dateStr, 'dd/MM/yyyy', refDate);
}
