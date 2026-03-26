import type { TimeEntry, OpsAllocationDto } from '@nc-dashboard/shared';
import { getDayName } from './date-utils';
import { DAY_ORDER } from './constants';

export interface DailyHoursData {
  day: string;
  date: string;
  hours: number;
}

export interface ProjectDistributionData {
  project: string;
  hours: number;
  fill: string;
}

const CHART_PALETTE = [
  'hsl(221, 83%, 53%)', // blue
  'hsl(349, 89%, 60%)', // rose
  'hsl(142, 71%, 45%)', // green
  'hsl(31, 97%, 60%)', // orange
  'hsl(262, 83%, 58%)', // violet
  'hsl(187, 85%, 43%)', // cyan
  'hsl(47, 96%, 53%)', // amber
  'hsl(326, 80%, 55%)', // pink
  'hsl(173, 80%, 40%)', // teal
  'hsl(15, 90%, 55%)', // red-orange
  'hsl(199, 89%, 48%)', // sky
  'hsl(293, 69%, 49%)', // fuchsia
  'hsl(84, 81%, 44%)', // lime
  'hsl(0, 84%, 60%)', // red
];

export function buildDailyHoursData(entries: TimeEntry[]): DailyHoursData[] {
  const byDate = new Map<string, { day: string; hours: number }>();

  for (const entry of entries) {
    const day = getDayName(entry.date);
    const existing = byDate.get(entry.date);
    if (existing) {
      existing.hours += entry.hours;
    } else {
      byDate.set(entry.date, { day, hours: entry.hours });
    }
  }

  return DAY_ORDER.map((day) => {
    const match = [...byDate.entries()].find(([, v]) => v.day === day);
    return {
      day,
      date: match?.[0] ?? '',
      hours: match ? Math.round(match[1].hours * 100) / 100 : 0,
    };
  });
}

export function buildProjectDistributionData(
  entries: TimeEntry[],
): ProjectDistributionData[] {
  const byProject = new Map<string, number>();

  for (const entry of entries) {
    byProject.set(
      entry.project,
      (byProject.get(entry.project) ?? 0) + entry.hours,
    );
  }

  return [...byProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([project, hours], index) => ({
      project,
      hours: Math.round(hours * 100) / 100,
      fill: CHART_PALETTE[index % CHART_PALETTE.length],
    }));
}

export type AllocationStatus =
  | 'on-track'
  | 'approaching'
  | 'at-budget'
  | 'slightly-over'
  | 'over-budget'
  | 'untracked';

export interface AllocationComparisonItem {
  project: string;
  allocatedHours: number;
  actualHours: number;
  utilizationPct: number;
  status: AllocationStatus;
}

export interface AllocationComparisonSummary {
  totalAllocated: number;
  totalActual: number;
  overallUtilization: number;
  items: AllocationComparisonItem[];
}

const PROJECT_QUALIFIER_TOKENS = new Set([
  'backend',
  'migration',
  'migracion',
  'support',
  'interno',
  'internal',
  'project',
]);

const PROJECT_ALIAS_GROUPS = [
  { key: 'ballot box', requiredTokens: ['ballot', 'box'] },
  { key: 'ingenieria', requiredTokens: ['ingenieria'] },
  { key: 'newcombin', requiredTokens: ['newcombin'] },
  { key: 'time off', requiredTokens: ['vacac'] },
  { key: 'time off', requiredTokens: ['vacaciones'] },
  { key: 'time off', requiredTokens: ['lic'] },
  { key: 'time off', requiredTokens: ['feria'] },
  { key: 'time off', requiredTokens: ['no', 'laborado'] },
];

function normalizeProjectTokens(projectName: string): string[] {
  return projectName
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) =>
      token.startsWith('z') && token.length > 4 ? token.slice(1) : token,
    );
}

function canonicalProjectName(projectName: string): string {
  const tokens = normalizeProjectTokens(projectName);
  if (!tokens.length) return '';

  for (const aliasGroup of PROJECT_ALIAS_GROUPS) {
    if (aliasGroup.requiredTokens.every((token) => tokens.includes(token))) {
      return aliasGroup.key;
    }
  }

  const filteredTokens = tokens.filter(
    (token) => !PROJECT_QUALIFIER_TOKENS.has(token),
  );

  return (filteredTokens.length > 0 ? filteredTokens : tokens).join(' ');
}

function matchProject(allocName: string, entryName: string): boolean {
  const a = canonicalProjectName(allocName);
  const b = canonicalProjectName(entryName);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
}

function getStatus(pct: number): AllocationStatus {
  if (pct > 120) return 'over-budget';
  if (pct > 100) return 'slightly-over';
  if (pct === 100) return 'at-budget';
  if (pct >= 80) return 'approaching';
  return 'on-track';
}

export function buildComparisonData(
  entries: TimeEntry[],
  allocations: OpsAllocationDto[],
  weekDate: string,
): AllocationComparisonSummary | null {
  if (!allocations.length) return null;

  // Sum actual hours per project from entries
  const actualByProject = new Map<string, number>();
  for (const entry of entries) {
    actualByProject.set(
      entry.project,
      (actualByProject.get(entry.project) ?? 0) + entry.hours,
    );
  }

  // Sum allocated hours per project for the given week
  const allocByProject = new Map<string, number>();
  for (const alloc of allocations) {
    const hours = alloc.weeklyHours[weekDate] ?? 0;
    if (hours > 0) {
      allocByProject.set(
        alloc.projectName,
        (allocByProject.get(alloc.projectName) ?? 0) + hours,
      );
    }
  }

  if (allocByProject.size === 0 && actualByProject.size === 0) return null;

  const items: AllocationComparisonItem[] = [];
  const matchedEntryProjects = new Set<string>();

  // Process allocated projects and find matching actual entries
  for (const [allocProject, allocHours] of allocByProject) {
    let actualHours = 0;
    for (const [entryProject, entryHours] of actualByProject) {
      if (matchProject(allocProject, entryProject)) {
        actualHours += entryHours;
        matchedEntryProjects.add(entryProject);
      }
    }
    const pct = allocHours > 0 ? (actualHours / allocHours) * 100 : 0;
    items.push({
      project: allocProject,
      allocatedHours: Math.round(allocHours * 100) / 100,
      actualHours: Math.round(actualHours * 100) / 100,
      utilizationPct: Math.round(pct),
      status: getStatus(pct),
    });
  }

  // Append unmatched actual entries as "untracked"
  for (const [entryProject, entryHours] of actualByProject) {
    if (!matchedEntryProjects.has(entryProject)) {
      items.push({
        project: entryProject,
        allocatedHours: 0,
        actualHours: Math.round(entryHours * 100) / 100,
        utilizationPct: 0,
        status: 'untracked',
      });
    }
  }

  // Sort: allocated projects by hours desc, then untracked at bottom
  items.sort((a, b) => {
    if (a.status === 'untracked' && b.status !== 'untracked') return 1;
    if (a.status !== 'untracked' && b.status === 'untracked') return -1;
    return b.allocatedHours - a.allocatedHours;
  });

  const totalAllocated = items.reduce((s, i) => s + i.allocatedHours, 0);
  const totalActual = items.reduce((s, i) => s + i.actualHours, 0);
  const overallUtilization =
    totalAllocated > 0 ? Math.round((totalActual / totalAllocated) * 100) : 0;

  return { totalAllocated, totalActual, overallUtilization, items };
}
