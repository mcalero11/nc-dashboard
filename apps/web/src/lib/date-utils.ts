import { startOfWeek, endOfWeek, addDays, format, parse } from 'date-fns';

const DATE_FORMAT = 'dd/MM/yyyy';

export function formatDate(date: Date): string {
  return format(date, DATE_FORMAT);
}

export function parseDate(dateStr: string): Date {
  return parse(dateStr, DATE_FORMAT, new Date());
}

export function getWeekBoundaries(date: Date = new Date()) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 }); // Sunday
  return {
    weekStart,
    weekEnd,
    weekStartStr: formatDate(weekStart),
    weekEndStr: formatDate(weekEnd),
  };
}

export function getDayName(dateStr: string): string {
  const date = parseDate(dateStr);
  return format(date, 'EEE'); // Mon, Tue, etc.
}

export function getWeekDays(
  refDate: Date = new Date(),
): Array<{ label: string; value: string }> {
  const { weekStart } = getWeekBoundaries(refDate);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    return {
      label: format(day, 'EEE, dd/MM/yyyy'),
      value: formatDate(day),
    };
  });
}
